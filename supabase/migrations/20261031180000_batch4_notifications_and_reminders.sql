-- ============================================================================
-- Migration: 20261031180000_batch4_notifications_and_reminders.sql
-- Description: Batch 4 — Notifications, Reminders & Remaining User Workflows
--   1. Notification Logs Table & Deduplication Architecture (Idempotency)
--   2. Scheduled Dispatcher: Makeup Expiry Reminders (7-day, 1-day) & Expiries
--   3. Scheduled Dispatcher: Monthly Fee Due & Overdue Notifications
--   4. Event-Driven Makeup Notifications (Booked, Cancelled, Rescheduled)
--   5. Event-Driven Holiday Notifications (Declared with/without Alt, Cancelled)
--   6. Event-Driven Special Access Notifications (Granted, Revoked)
--   7. Event-Driven Payment Notifications (Submitted, Approved, Rejected)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PART 1: Notification Logs Table & Deduplication Architecture
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    reference_id TEXT NOT NULL,
    cycle_key TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'in_app',
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index to guarantee strict idempotency per user, event type, reference ID and cycle key
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_logs_dedup
    ON public.notification_logs (user_id, event_type, reference_id, cycle_key);

CREATE INDEX IF NOT EXISTS idx_notification_logs_user_event
    ON public.notification_logs (user_id, event_type, created_at DESC);

-- Append-only trigger for notification logs
CREATE OR REPLACE FUNCTION public.prevent_notification_logs_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_setting('kfa.allow_audit_log_cleanup', true) = 'true' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'notification_logs records are strictly append-only and cannot be modified or deleted.'
        USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS trg_notification_logs_immutable ON public.notification_logs;
CREATE TRIGGER trg_notification_logs_immutable
BEFORE UPDATE OR DELETE ON public.notification_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_notification_logs_mutation();

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- Notifications table RLS policies & force RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Staff and owner view notification logs" ON public.notification_logs;
    CREATE POLICY "Staff and owner view notification logs"
        ON public.notification_logs FOR SELECT
        TO authenticated
        USING (
            user_id = auth.uid() OR
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
        );

    DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
    CREATE POLICY "Users view own notifications"
        ON public.notifications FOR SELECT
        TO authenticated
        USING (
            user_id = auth.uid() OR
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
        );

    DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
    CREATE POLICY "Users update own notifications"
        ON public.notifications FOR UPDATE
        TO authenticated
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid());

    DROP POLICY IF EXISTS "Authenticated users insert notifications" ON public.notifications;
    CREATE POLICY "Authenticated users insert notifications"
        ON public.notifications FOR INSERT
        TO authenticated
        WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

GRANT SELECT, INSERT ON public.notification_logs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_special_access_grants TO authenticated, service_role;
GRANT SELECT ON public.users TO authenticated, service_role;


-- Helper Function: Record and send idempotent in-app notification
CREATE OR REPLACE FUNCTION public.send_idempotent_notification(
    p_user_id UUID,
    p_event_type TEXT,
    p_reference_id TEXT,
    p_cycle_key TEXT,
    p_title TEXT,
    p_message TEXT,
    p_type TEXT DEFAULT 'reminder',
    p_metadata JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_status TEXT;
BEGIN
    -- Strict Rule: Filter out paused/inactive or archived students
    SELECT LOWER(COALESCE(status, 'active')) INTO v_user_status
    FROM public.users WHERE id = p_user_id;

    IF NOT FOUND OR v_user_status != 'active' THEN
        RETURN FALSE;
    END IF;

    -- Attempt to insert into notification_logs; if already exists, conflict and do nothing
    BEGIN
        INSERT INTO public.notification_logs (
            user_id,
            event_type,
            reference_id,
            cycle_key,
            channel,
            metadata
        ) VALUES (
            p_user_id,
            p_event_type,
            p_reference_id,
            p_cycle_key,
            'in_app',
            p_metadata
        );
    EXCEPTION WHEN unique_violation THEN
        -- Already dispatched for this reference and cycle; safe idempotent skip
        RETURN FALSE;
    END;

    -- Insert into notifications table for user visibility
    INSERT INTO public.notifications (
        user_id,
        title,
        message,
        type,
        is_read,
        metadata
    ) VALUES (
        p_user_id,
        p_title,
        p_message,
        p_type,
        false,
        p_metadata
    );

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_idempotent_notification(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- PART 2: Task A — Scheduled Makeup Reminders (7-day, 1-day) & Expiries
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.dispatch_makeup_reminders_and_expiry(
    p_reference_date DATE DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_ref_date DATE := COALESCE(p_reference_date, (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE);
    v_leave RECORD;
    v_due_date DATE;
    v_override RECORD;
    v_days_left INTEGER;
    v_reminders_7d INTEGER := 0;
    v_reminders_1d INTEGER := 0;
    v_expiries INTEGER := 0;
    v_sent BOOLEAN;
BEGIN
    -- Scan all approved leaves for active students
    FOR v_leave IN
        SELECT lr.id AS leave_id,
               lr.student_id,
               lr.class_date AS missed_date,
               u.name AS student_name
        FROM public.leave_requests lr
        JOIN public.users u ON u.id = lr.student_id
        WHERE lr.status = 'approved'
          AND LOWER(COALESCE(u.status, 'active')) = 'active'
    LOOP
        -- Calculate canonical student billing due date (Asia/Kolkata)
        v_due_date := public.calculate_student_next_due_date(v_leave.student_id, v_leave.missed_date);
        IF v_due_date IS NULL THEN
            CONTINUE;
        END IF;

        -- Check makeup booking status for this missed date
        SELECT * INTO v_override
        FROM public.session_student_overrides
        WHERE student_id = v_leave.student_id
          AND missed_session_date = v_leave.missed_date
          AND credit_treatment = 'makeup'
        ORDER BY created_at DESC
        LIMIT 1;

        -- Invariant: Completed or Forfeited makeups never receive reminders or expiries
        IF v_override.id IS NOT NULL AND v_override.booking_status IN ('completed', 'forfeited') THEN
            CONTINUE;
        END IF;

        -- Days until expiry
        v_days_left := v_due_date - v_ref_date;

        -- 1. Reminder 7 Days Before Expiry
        IF v_days_left = 7 THEN
            v_sent := public.send_idempotent_notification(
                v_leave.student_id,
                'makeup_expiry_reminder_7d',
                v_leave.missed_date::TEXT,
                v_due_date::TEXT,
                'Makeup Class Expiring in 7 Days',
                'Your makeup class entitlement for missed class on ' || v_leave.missed_date::TEXT ||
                ' will expire on ' || v_due_date::TEXT || '. Please contact your teacher to schedule your makeup slot before it expires.',
                'reminder',
                jsonb_build_object(
                    'event', 'makeup_reminder_7d',
                    'missed_date', v_leave.missed_date,
                    'due_date', v_due_date
                )
            );
            IF v_sent THEN
                v_reminders_7d := v_reminders_7d + 1;
            END IF;
        END IF;

        -- 2. Reminder 1 Day Before Expiry
        IF v_days_left = 1 THEN
            v_sent := public.send_idempotent_notification(
                v_leave.student_id,
                'makeup_expiry_reminder_1d',
                v_leave.missed_date::TEXT,
                v_due_date::TEXT,
                'Urgent: Makeup Class Expiring Tomorrow',
                'Your makeup class entitlement for missed class on ' || v_leave.missed_date::TEXT ||
                ' expires tomorrow on ' || v_due_date::TEXT || '. Please contact your teacher immediately to utilize this credit.',
                'reminder',
                jsonb_build_object(
                    'event', 'makeup_reminder_1d',
                    'missed_date', v_leave.missed_date,
                    'due_date', v_due_date
                )
            );
            IF v_sent THEN
                v_reminders_1d := v_reminders_1d + 1;
            END IF;
        END IF;

        -- 3. Makeup Expiry Notification on or after Expiry Date
        IF v_days_left <= 0 THEN
            -- If scheduled override exists and is not yet completed/forfeited/expired, mark expired
            IF v_override.id IS NOT NULL AND v_override.booking_status = 'scheduled' THEN
                UPDATE public.session_student_overrides
                SET booking_status = 'expired',
                    updated_at = NOW()
                WHERE id = v_override.id;
            END IF;

            -- Invariant: Unbooked makeup entitlement expiry deducts zero additional credits
            v_sent := public.send_idempotent_notification(
                v_leave.student_id,
                'makeup_expired',
                v_leave.missed_date::TEXT,
                v_due_date::TEXT,
                'Makeup Class Entitlement Expired',
                'Your makeup class entitlement for missed class on ' || v_leave.missed_date::TEXT ||
                ' expired on ' || v_due_date::TEXT || '. As per academy policy, unbooked makeup credits expire on your billing due date with zero extra charges.',
                'reminder',
                jsonb_build_object(
                    'event', 'makeup_expired',
                    'missed_date', v_leave.missed_date,
                    'due_date', v_due_date
                )
            );
            IF v_sent THEN
                v_expiries := v_expiries + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'reference_date', v_ref_date,
        'reminders_7d_sent', v_reminders_7d,
        'reminders_1d_sent', v_reminders_1d,
        'expiries_processed', v_expiries
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dispatch_makeup_reminders_and_expiry(DATE) TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- PART 3: Task C — Scheduled Fees & Payment Reminders
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.dispatch_fee_reminders(
    p_reference_date DATE DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_ref_date DATE := COALESCE(p_reference_date, (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE);
    v_cycle_key TEXT := TO_CHAR(v_ref_date, 'YYYY-MM');
    v_student RECORD;
    v_due_day INTEGER;
    v_is_due_today BOOLEAN;
    v_is_overdue BOOLEAN;
    v_due_sent INTEGER := 0;
    v_overdue_sent INTEGER := 0;
    v_sent BOOLEAN;
BEGIN
    FOR v_student IN
        SELECT u.id,
               u.name,
               COALESCE(u.fees_classes_paid, 0) AS balance,
               COALESCE(u.fees_amount, 1500) AS fee_amount,
               u.fees_collection_date,
               u.join_date
        FROM public.users u
        WHERE u.role = 'student'
          AND LOWER(COALESCE(u.status, 'active')) = 'active'
    LOOP
        v_due_day := COALESCE(v_student.fees_collection_date, EXTRACT(DAY FROM COALESCE(v_student.join_date, v_ref_date))::INTEGER);
        v_is_due_today := (EXTRACT(DAY FROM v_ref_date) = v_due_day);
        v_is_overdue := (v_student.balance < 0) OR (EXTRACT(DAY FROM v_ref_date) > v_due_day AND v_student.balance <= 0);

        -- Overdue Notification takes precedence
        IF v_is_overdue THEN
            v_sent := public.send_idempotent_notification(
                v_student.id,
                'fee_overdue',
                v_student.id::TEXT,
                v_cycle_key,
                'Fee Payment Overdue',
                'Your fee payment is overdue. Live class access is currently paused until payment is completed.',
                'fees',
                jsonb_build_object(
                    'event', 'fee_overdue',
                    'balance', v_student.balance,
                    'cycle', v_cycle_key
                )
            );
            IF v_sent THEN
                v_overdue_sent := v_overdue_sent + 1;
            END IF;
        -- Fee Due Notification
        ELSIF v_student.balance = 0 OR v_is_due_today THEN
            v_sent := public.send_idempotent_notification(
                v_student.id,
                'fee_due',
                v_student.id::TEXT,
                v_cycle_key,
                'Monthly Fee Due',
                'Your monthly fee payment of ₹' || v_student.fee_amount || ' is due. Please complete your payment to continue seamless class access.',
                'fees',
                jsonb_build_object(
                    'event', 'fee_due',
                    'balance', v_student.balance,
                    'cycle', v_cycle_key
                )
            );
            IF v_sent THEN
                v_due_sent := v_due_sent + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'reference_date', v_ref_date,
        'cycle_key', v_cycle_key,
        'fee_due_sent', v_due_sent,
        'fee_overdue_sent', v_overdue_sent
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dispatch_fee_reminders(DATE) TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- PART 4: Event-Driven Makeup Notifications (Book, Cancel, Reschedule)
-- ----------------------------------------------------------------------------

-- Update book_makeup_session to dispatch student booking notification
CREATE OR REPLACE FUNCTION public.book_makeup_session(
    p_student_id UUID,
    p_target_classroom_id UUID,
    p_override_date DATE,
    p_missed_session_date DATE,
    p_original_classroom_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS public.session_student_overrides
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_existing_status TEXT;
    v_next_due_date DATE;
    v_leave_id UUID;
    v_leave_classroom_id UUID;
    v_orig_classroom_id UUID := p_original_classroom_id;
    v_target_room_name TEXT;
    v_reason TEXT;
    v_override public.session_student_overrides%ROWTYPE;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or admins can book makeup sessions.' USING ERRCODE = '42501';
    END IF;

    IF p_student_id IS NULL OR p_target_classroom_id IS NULL OR p_override_date IS NULL OR p_missed_session_date IS NULL THEN
        RAISE EXCEPTION 'Missing required parameters for booking makeup session' USING ERRCODE = '22023';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('makeup_' || p_student_id::text || '_' || p_missed_session_date::text)::bigint);

    -- Require approved original leave
    SELECT id, classroom_id INTO v_leave_id, v_leave_classroom_id
    FROM public.leave_requests
    WHERE student_id = p_student_id
      AND class_date = p_missed_session_date
      AND status = 'approved'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cannot book makeup: No approved leave request found for student % on date %',
            p_student_id, p_missed_session_date USING ERRCODE = '22023';
    END IF;

    IF v_orig_classroom_id IS NOT NULL AND v_leave_classroom_id IS NOT NULL AND v_orig_classroom_id <> v_leave_classroom_id THEN
        RAISE EXCEPTION 'Cannot book makeup: original classroom % does not match approved leave classroom %',
            v_orig_classroom_id, v_leave_classroom_id USING ERRCODE = '22023';
    END IF;

    IF v_orig_classroom_id IS NULL THEN
        v_orig_classroom_id := v_leave_classroom_id;
    END IF;

    -- Terminal state check
    SELECT booking_status INTO v_existing_status
    FROM public.session_student_overrides
    WHERE student_id = p_student_id
      AND missed_session_date = p_missed_session_date
      AND (original_classroom_id IS NULL OR v_orig_classroom_id IS NULL OR original_classroom_id = v_orig_classroom_id)
      AND booking_status IN ('completed', 'forfeited', 'expired')
    LIMIT 1;

    IF v_existing_status = 'completed' THEN
        RAISE EXCEPTION 'Cannot book makeup: entitlement for missed session % has already been completed.', p_missed_session_date USING ERRCODE = '23514';
    ELSIF v_existing_status = 'forfeited' THEN
        RAISE EXCEPTION 'Cannot book makeup: entitlement for missed session % has been forfeited.', p_missed_session_date USING ERRCODE = '23514';
    ELSIF v_existing_status = 'expired' THEN
        RAISE EXCEPTION 'Cannot book makeup: entitlement for missed session % has expired.', p_missed_session_date USING ERRCODE = '23514';
    END IF;

    -- Prevent duplicate active booking
    IF EXISTS (
        SELECT 1 FROM public.session_student_overrides
        WHERE student_id = p_student_id
          AND missed_session_date = p_missed_session_date
          AND (original_classroom_id IS NULL OR v_orig_classroom_id IS NULL OR original_classroom_id = v_orig_classroom_id)
          AND credit_treatment = 'makeup'
          AND booking_status = 'scheduled'
    ) THEN
        RAISE EXCEPTION 'Cannot book makeup: an active makeup booking already exists for missed session %.', p_missed_session_date USING ERRCODE = '23505';
    END IF;

    -- Billing cycle due date check (Asia/Kolkata)
    v_next_due_date := public.calculate_student_next_due_date(p_student_id, p_missed_session_date);
    IF v_next_due_date IS NOT NULL AND p_override_date >= v_next_due_date THEN
        RAISE EXCEPTION 'Makeup date % must be strictly before student next billing due date % (Asia/Kolkata)',
            p_override_date, v_next_due_date USING ERRCODE = '22023';
    END IF;

    SELECT name INTO v_target_room_name FROM public.classrooms WHERE id = p_target_classroom_id;

    v_reason := '[MissedDate:' || p_missed_session_date::TEXT || '] ' || COALESCE(p_notes, 'Makeup session');

    INSERT INTO public.session_student_overrides (
        student_id,
        target_classroom_id,
        override_date,
        missed_session_date,
        original_classroom_id,
        credit_treatment,
        booking_status,
        reason
    ) VALUES (
        p_student_id,
        p_target_classroom_id,
        p_override_date,
        p_missed_session_date,
        v_orig_classroom_id,
        'makeup',
        'scheduled',
        v_reason
    )
    RETURNING * INTO v_override;

    -- Dispatch event-driven booking notification
    PERFORM public.send_idempotent_notification(
        p_student_id,
        'makeup_booked',
        v_override.id::TEXT,
        p_override_date::TEXT,
        'Makeup Class Scheduled',
        'You have been scheduled for a makeup class in "' || COALESCE(v_target_room_name, 'Classroom') ||
        '" on ' || p_override_date::TEXT || ' (replacing missed class on ' || p_missed_session_date::TEXT || ').',
        'classroom',
        jsonb_build_object(
            'override_id', v_override.id,
            'makeup_date', p_override_date,
            'missed_date', p_missed_session_date,
            'classroom_id', p_target_classroom_id
        )
    );

    RETURN v_override;
END;
$$;


-- Update cancel_makeup_session to dispatch student cancellation notification & preserve protected entitlement
CREATE OR REPLACE FUNCTION public.cancel_makeup_session(
    p_override_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS public.session_student_overrides
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_override public.session_student_overrides%ROWTYPE;
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_next_due_date DATE;
    v_clean_reason TEXT := TRIM(COALESCE(p_reason, 'Cancelled by teacher'));
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or admins can cancel makeup sessions.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_override
    FROM public.session_student_overrides
    WHERE id = p_override_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Makeup booking not found: %', p_override_id USING ERRCODE = 'P0002';
    END IF;

    IF v_override.booking_status = 'completed' THEN
        RAISE EXCEPTION 'Cannot cancel: makeup session has already been completed.' USING ERRCODE = '22023';
    ELSIF v_override.booking_status = 'forfeited' THEN
        RAISE EXCEPTION 'Cannot cancel: makeup session has been forfeited.' USING ERRCODE = '22023';
    END IF;

    UPDATE public.session_student_overrides
    SET booking_status = 'cancelled',
        reason = COALESCE(reason || E' [Cancelled: ' || v_clean_reason || ']', 'Cancelled: ' || v_clean_reason),
        updated_at = NOW()
    WHERE id = p_override_id
    RETURNING * INTO v_override;

    v_next_due_date := public.calculate_student_next_due_date(v_override.student_id, v_override.missed_session_date);

    -- Dispatch cancellation notification emphasizing protected entitlement
    PERFORM public.send_idempotent_notification(
        v_override.student_id,
        'makeup_cancelled',
        p_override_id::TEXT,
        NOW()::DATE::TEXT,
        'Makeup Class Cancelled',
        'Your makeup class scheduled for ' || v_override.override_date::TEXT ||
        ' has been cancelled (' || v_clean_reason || '). Your makeup entitlement remains valid until ' ||
        COALESCE(v_next_due_date::TEXT, 'your next billing date') || '. Please contact your teacher to reschedule.',
        'classroom',
        jsonb_build_object(
            'override_id', p_override_id,
            'cancelled_date', v_override.override_date,
            'missed_date', v_override.missed_session_date,
            'due_date', v_next_due_date,
            'reason', v_clean_reason
        )
    );

    RETURN v_override;
END;
$$;


-- Update reschedule_makeup_session to dispatch student rescheduling notification
CREATE OR REPLACE FUNCTION public.reschedule_makeup_session(
    p_override_id UUID,
    p_new_target_classroom_id UUID,
    p_new_override_date DATE,
    p_notes TEXT DEFAULT NULL
)
RETURNS public.session_student_overrides
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_override public.session_student_overrides%ROWTYPE;
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_next_due_date DATE;
    v_target_room_name TEXT;
    v_reason TEXT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or admins can reschedule makeup sessions.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_override
    FROM public.session_student_overrides
    WHERE id = p_override_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Makeup booking not found: %', p_override_id USING ERRCODE = 'P0002';
    END IF;

    IF v_override.booking_status = 'completed' THEN
        RAISE EXCEPTION 'Cannot reschedule: makeup session has already been completed.' USING ERRCODE = '22023';
    ELSIF v_override.booking_status = 'forfeited' THEN
        RAISE EXCEPTION 'Cannot reschedule: makeup session has been forfeited.' USING ERRCODE = '22023';
    END IF;

    v_next_due_date := public.calculate_student_next_due_date(v_override.student_id, v_override.missed_session_date);
    IF v_next_due_date IS NOT NULL AND p_new_override_date >= v_next_due_date THEN
        RAISE EXCEPTION 'Makeup date % must be strictly before student next billing due date % (Asia/Kolkata)',
            p_new_override_date, v_next_due_date USING ERRCODE = '22023';
    END IF;

    SELECT name INTO v_target_room_name FROM public.classrooms WHERE id = p_new_target_classroom_id;

    v_reason := '[MissedDate:' || v_override.missed_session_date::TEXT || '] ' || COALESCE(p_notes, 'Rescheduled makeup session');

    UPDATE public.session_student_overrides
    SET target_classroom_id = p_new_target_classroom_id,
        override_date = p_new_override_date,
        reason = v_reason,
        updated_at = NOW()
    WHERE id = p_override_id
    RETURNING * INTO v_override;

    -- Dispatch rescheduling notification
    PERFORM public.send_idempotent_notification(
        v_override.student_id,
        'makeup_rescheduled',
        p_override_id::TEXT,
        p_new_override_date::TEXT,
        'Makeup Class Rescheduled',
        'Your makeup class has been rescheduled to ' || p_new_override_date::TEXT ||
        ' in "' || COALESCE(v_target_room_name, 'Classroom') || '" (replacing missed class on ' ||
        v_override.missed_session_date::TEXT || ').',
        'classroom',
        jsonb_build_object(
            'override_id', p_override_id,
            'new_date', p_new_override_date,
            'missed_date', v_override.missed_session_date,
            'classroom_id', p_new_target_classroom_id
        )
    );

    RETURN v_override;
END;
$$;


-- ----------------------------------------------------------------------------
-- PART 5: Event-Driven Holiday Notifications
-- ----------------------------------------------------------------------------

-- Update declare_classroom_holiday to dispatch classroom notifications
CREATE OR REPLACE FUNCTION public.declare_classroom_holiday(
    p_classroom_id UUID,
    p_holiday_date DATE,
    p_holiday_type TEXT,
    p_reason TEXT,
    p_alternative_date DATE DEFAULT NULL,
    p_alt_start_time TIME DEFAULT NULL,
    p_alt_end_time TIME DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_is_assigned_teacher BOOLEAN := false;
    v_holiday_id UUID;
    v_classroom_name TEXT;
    v_clean_reason TEXT;
    v_existing RECORD;
    v_student_rec RECORD;
    v_notif_title TEXT;
    v_notif_message TEXT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or administrators can declare holidays.'
            USING ERRCODE = '42501';
    END IF;

    IF v_caller_role = 'teacher' THEN
        SELECT (c.teacher_id = v_caller_id) INTO v_is_assigned_teacher
        FROM public.classrooms c
        WHERE c.id = p_classroom_id;

        IF NOT COALESCE(v_is_assigned_teacher, false) THEN
            RAISE EXCEPTION 'Unauthorized: teachers can only declare holidays for their assigned classrooms.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    SELECT name INTO v_classroom_name FROM public.classrooms WHERE id = p_classroom_id;

    IF p_holiday_type NOT IN ('with_alternative', 'no_alternative') THEN
        RAISE EXCEPTION 'Invalid holiday_type: %. Must be ''with_alternative'' or ''no_alternative''.', p_holiday_type
            USING ERRCODE = '22023';
    END IF;

    v_clean_reason := trim(COALESCE(p_reason, ''));
    IF char_length(v_clean_reason) < 3 THEN
        RAISE EXCEPTION 'A valid holiday reason (minimum 3 characters) is required.'
            USING ERRCODE = '22023';
    END IF;

    IF p_holiday_type = 'with_alternative' THEN
        IF p_alternative_date IS NULL THEN
            RAISE EXCEPTION 'Alternative class date is required when holiday type is with_alternative.'
                USING ERRCODE = '22023';
        END IF;
        IF p_alternative_date = p_holiday_date THEN
            RAISE EXCEPTION 'Alternative class date cannot be the same as the holiday date.'
                USING ERRCODE = '22023';
        END IF;
    ELSE
        p_alternative_date := NULL;
        p_alt_start_time := NULL;
        p_alt_end_time := NULL;
    END IF;

    SELECT * INTO v_existing
    FROM public.classroom_holidays
    WHERE classroom_id = p_classroom_id
      AND holiday_date = p_holiday_date
      AND status = 'active';

    IF v_existing.id IS NOT NULL THEN
        IF v_existing.holiday_type = p_holiday_type AND
           v_existing.alternative_date IS NOT DISTINCT FROM p_alternative_date THEN
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'message', 'Holiday is already declared with identical parameters (idempotent).',
                'holiday_id', v_existing.id
            );
        ELSE
            RAISE EXCEPTION 'A holiday is already declared for classroom on date % with different parameters.', p_holiday_date
                USING ERRCODE = '23505';
        END IF;
    END IF;

    IF p_alternative_date IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.classroom_holidays
            WHERE classroom_id = p_classroom_id
              AND holiday_date = p_alternative_date
              AND status = 'active'
        ) THEN
            RAISE EXCEPTION 'Alternative date % is already declared as a holiday for this classroom.', p_alternative_date
                USING ERRCODE = '23514';
        END IF;

        IF EXISTS (
            SELECT 1 FROM public.classroom_holidays
            WHERE classroom_id = p_classroom_id
              AND alternative_date = p_alternative_date
              AND status = 'active'
        ) THEN
            RAISE EXCEPTION 'Alternative date % is already booked as an alternative for another holiday in this classroom.', p_alternative_date
                USING ERRCODE = '23514';
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.attendance
        WHERE classroom_id = p_classroom_id
          AND date = p_holiday_date
          AND status IN ('present', 'late', 'absent', 'excused')
    ) THEN
        RAISE EXCEPTION 'Cannot declare holiday: attendance is already recorded for classroom on date %. Historical attendance must be corrected or unmarked first.', p_holiday_date
            USING ERRCODE = '23514';
    END IF;

    -- Cancel pending leaves on holiday date
    UPDATE public.leave_requests
    SET status = 'cancelled',
        cancellation_reason = 'Cancelled due to declared classroom holiday',
        updated_at = NOW()
    WHERE classroom_id = p_classroom_id
      AND class_date = p_holiday_date
      AND status = 'pending';

    -- Insert Holiday Record
    INSERT INTO public.classroom_holidays (
        classroom_id,
        holiday_date,
        holiday_type,
        reason,
        alternative_date,
        alternative_start_time,
        alternative_end_time,
        status,
        declared_by,
        declared_at
    ) VALUES (
        p_classroom_id,
        p_holiday_date,
        p_holiday_type,
        v_clean_reason,
        p_alternative_date,
        p_alt_start_time,
        p_alt_end_time,
        'active',
        v_caller_id,
        NOW()
    )
    RETURNING id INTO v_holiday_id;

    -- Audit Log
    INSERT INTO public.classroom_holiday_audit_logs (
        holiday_id,
        classroom_id,
        holiday_date,
        action,
        holiday_type,
        alternative_date,
        actor_id,
        actor_role,
        reason
    ) VALUES (
        v_holiday_id,
        p_classroom_id,
        p_holiday_date,
        'declared',
        p_holiday_type,
        p_alternative_date,
        v_caller_id,
        v_caller_role,
        v_clean_reason
    );

    -- Dispatch notifications to active enrolled students in this classroom
    v_notif_title := 'Class Holiday Declared: ' || COALESCE(v_classroom_name, 'Classroom');
    IF p_holiday_type = 'with_alternative' THEN
        v_notif_message := 'Class on ' || p_holiday_date::TEXT || ' is cancelled: ' || v_clean_reason ||
                           '. An alternative replacement class is scheduled on ' || p_alternative_date::TEXT ||
                           ' (On Behalf Of ' || p_holiday_date::TEXT || ').';
    ELSE
        v_notif_message := 'Class on ' || p_holiday_date::TEXT || ' is cancelled: ' || v_clean_reason ||
                           '. No alternative replacement class is scheduled. No credits will be deducted.';
    END IF;

    FOR v_student_rec IN
        SELECT cs.student_id
        FROM public.classroom_students cs
        JOIN public.users u ON u.id = cs.student_id
        WHERE cs.classroom_id = p_classroom_id
          AND LOWER(COALESCE(u.status, 'active')) = 'active'
    LOOP
        PERFORM public.send_idempotent_notification(
            v_student_rec.student_id,
            'holiday_declared',
            v_holiday_id::TEXT,
            p_holiday_date::TEXT,
            v_notif_title,
            v_notif_message,
            'classroom',
            jsonb_build_object(
                'holiday_id', v_holiday_id,
                'holiday_date', p_holiday_date,
                'holiday_type', p_holiday_type,
                'alternative_date', p_alternative_date,
                'classroom_id', p_classroom_id
            )
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'holiday_id', v_holiday_id,
        'classroom_id', p_classroom_id,
        'holiday_date', p_holiday_date,
        'holiday_type', p_holiday_type,
        'alternative_date', p_alternative_date
    );
END;
$$;


-- Update cancel_classroom_holiday to dispatch holiday cancellation notification
CREATE OR REPLACE FUNCTION public.cancel_classroom_holiday(
    p_holiday_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_holiday public.classroom_holidays%ROWTYPE;
    v_classroom_name TEXT;
    v_clean_reason TEXT;
    v_student_rec RECORD;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or administrators can cancel holidays.'
            USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_holiday
    FROM public.classroom_holidays
    WHERE id = p_holiday_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Holiday % not found.', p_holiday_id USING ERRCODE = 'P0002';
    END IF;

    IF v_holiday.status != 'active' THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Holiday is already cancelled',
            'holiday_id', p_holiday_id
        );
    END IF;

    IF v_caller_role = 'teacher' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.classrooms
            WHERE id = v_holiday.classroom_id AND teacher_id = v_caller_id
        ) THEN
            RAISE EXCEPTION 'Unauthorized: teachers can only cancel holidays for their assigned classrooms.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    v_clean_reason := trim(COALESCE(p_reason, ''));
    IF char_length(v_clean_reason) < 3 THEN
        RAISE EXCEPTION 'A valid cancellation reason (minimum 3 characters) is required.'
            USING ERRCODE = '22023';
    END IF;

    UPDATE public.classroom_holidays
    SET status = 'cancelled',
        cancelled_by = v_caller_id,
        cancelled_at = NOW(),
        cancellation_reason = v_clean_reason,
        updated_at = NOW()
    WHERE id = p_holiday_id;

    INSERT INTO public.classroom_holiday_audit_logs (
        holiday_id,
        classroom_id,
        holiday_date,
        action,
        holiday_type,
        alternative_date,
        actor_id,
        actor_role,
        reason
    ) VALUES (
        p_holiday_id,
        v_holiday.classroom_id,
        v_holiday.holiday_date,
        'cancelled',
        v_holiday.holiday_type,
        v_holiday.alternative_date,
        v_caller_id,
        v_caller_role,
        v_clean_reason
    );

    SELECT name INTO v_classroom_name FROM public.classrooms WHERE id = v_holiday.classroom_id;

    -- Dispatch cancellation notifications to enrolled active students
    FOR v_student_rec IN
        SELECT cs.student_id
        FROM public.classroom_students cs
        JOIN public.users u ON u.id = cs.student_id
        WHERE cs.classroom_id = v_holiday.classroom_id
          AND LOWER(COALESCE(u.status, 'active')) = 'active'
    LOOP
        PERFORM public.send_idempotent_notification(
            v_student_rec.student_id,
            'holiday_cancelled',
            p_holiday_id::TEXT,
            v_holiday.holiday_date::TEXT,
            'Holiday Cancelled: ' || COALESCE(v_classroom_name, 'Classroom'),
            'The holiday declared for ' || v_holiday.holiday_date::TEXT ||
            ' has been cancelled. Regular class schedule resumes.',
            'classroom',
            jsonb_build_object(
                'holiday_id', p_holiday_id,
                'holiday_date', v_holiday.holiday_date,
                'classroom_id', v_holiday.classroom_id
            )
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'holiday_id', p_holiday_id,
        'status', 'cancelled'
    );
END;
$$;


-- ----------------------------------------------------------------------------
-- PART 6: Event-Driven Special Access Notifications
-- ----------------------------------------------------------------------------

-- Update grant_student_special_access to dispatch student notification
CREATE OR REPLACE FUNCTION public.grant_student_special_access(
    p_student_id UUID,
    p_classroom_id UUID,
    p_access_type TEXT,
    p_reason TEXT,
    p_min_balance_limit INTEGER DEFAULT -2
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_grant_id UUID;
    v_clean_reason TEXT;
    v_classroom_name TEXT;
    v_existing_id UUID;
    v_notif_title TEXT;
    v_notif_msg TEXT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or administrators can grant special access.'
            USING ERRCODE = '42501';
    END IF;

    IF v_caller_role = 'teacher' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.classrooms WHERE id = p_classroom_id AND teacher_id = v_caller_id
        ) THEN
            RAISE EXCEPTION 'Unauthorized: teachers can only grant special access for their assigned classrooms.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    IF p_access_type NOT IN ('advance_credit', 'overdue_access') THEN
        RAISE EXCEPTION 'Invalid access_type: %. Must be ''advance_credit'' or ''overdue_access''.', p_access_type
            USING ERRCODE = '22023';
    END IF;

    IF p_min_balance_limit < -2 THEN
        RAISE EXCEPTION 'Maximum allowed negative balance is -2. Requested: %', p_min_balance_limit
            USING ERRCODE = '22023';
    END IF;

    v_clean_reason := trim(COALESCE(p_reason, ''));
    IF char_length(v_clean_reason) < 3 THEN
        RAISE EXCEPTION 'A valid reason (minimum 3 characters) is required for special access grant.'
            USING ERRCODE = '22023';
    END IF;

    SELECT name INTO v_classroom_name FROM public.classrooms WHERE id = p_classroom_id;

    SELECT id INTO v_existing_id
    FROM public.student_special_access_grants
    WHERE student_id = p_student_id
      AND classroom_id = p_classroom_id
      AND access_type = p_access_type
      AND status = 'active';

    IF v_existing_id IS NOT NULL THEN
        UPDATE public.student_special_access_grants
        SET min_balance_limit = p_min_balance_limit,
            reason = v_clean_reason,
            granted_by = v_caller_id,
            granted_at = NOW(),
            updated_at = NOW()
        WHERE id = v_existing_id
        RETURNING id INTO v_grant_id;
    ELSE
        INSERT INTO public.student_special_access_grants (
            student_id,
            classroom_id,
            access_type,
            status,
            min_balance_limit,
            granted_by,
            granted_at,
            reason
        ) VALUES (
            p_student_id,
            p_classroom_id,
            p_access_type,
            'active',
            p_min_balance_limit,
            v_caller_id,
            NOW(),
            v_clean_reason
        )
        RETURNING id INTO v_grant_id;
    END IF;

    INSERT INTO public.student_special_access_audit_logs (
        grant_id,
        student_id,
        classroom_id,
        access_type,
        action,
        actor_id,
        actor_role,
        reason,
        min_balance_limit
    ) VALUES (
        v_grant_id,
        p_student_id,
        p_classroom_id,
        p_access_type,
        'granted',
        v_caller_id,
        v_caller_role,
        v_clean_reason,
        p_min_balance_limit
    );

    -- Dispatch student special access notification
    IF p_access_type = 'advance_credit' THEN
        v_notif_title := 'Special Access Granted: Advance Credit';
        v_notif_msg := 'You have been granted advance credit access for "' || COALESCE(v_classroom_name, 'Classroom') ||
                       '" (up to balance ' || p_min_balance_limit || '). You may join upcoming live classes.';
    ELSE
        v_notif_title := 'Special Access Granted: Overdue Class Access';
        v_notif_msg := 'You have been granted temporary class access for "' || COALESCE(v_classroom_name, 'Classroom') ||
                       '" while fee payment is overdue.';
    END IF;

    PERFORM public.send_idempotent_notification(
        p_student_id,
        'special_access_granted',
        v_grant_id::TEXT,
        p_access_type,
        v_notif_title,
        v_notif_msg,
        'fees',
        jsonb_build_object(
            'grant_id', v_grant_id,
            'access_type', p_access_type,
            'classroom_id', p_classroom_id,
            'min_balance_limit', p_min_balance_limit
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'grant_id', v_grant_id,
        'student_id', p_student_id,
        'classroom_id', p_classroom_id,
        'access_type', p_access_type,
        'min_balance_limit', p_min_balance_limit,
        'status', 'active'
    );
END;
$$;


-- Update revoke_student_special_access to dispatch student revocation notification
CREATE OR REPLACE FUNCTION public.revoke_student_special_access(
    p_grant_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_grant public.student_special_access_grants%ROWTYPE;
    v_classroom_name TEXT;
    v_clean_reason TEXT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or administrators can revoke special access.'
            USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_grant
    FROM public.student_special_access_grants
    WHERE id = p_grant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Special access grant % not found.', p_grant_id USING ERRCODE = 'P0002';
    END IF;

    IF v_grant.status != 'active' THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Grant is already inactive',
            'grant_id', p_grant_id,
            'status', v_grant.status
        );
    END IF;

    IF v_caller_role = 'teacher' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.classrooms WHERE id = v_grant.classroom_id AND teacher_id = v_caller_id
        ) THEN
            RAISE EXCEPTION 'Unauthorized: teachers can only revoke special access for their assigned classrooms.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    v_clean_reason := trim(COALESCE(p_reason, ''));
    IF char_length(v_clean_reason) < 3 THEN
        RAISE EXCEPTION 'A valid revocation reason (minimum 3 characters) is required.'
            USING ERRCODE = '22023';
    END IF;

    UPDATE public.student_special_access_grants
    SET status = 'revoked',
        revoked_by = v_caller_id,
        revoked_at = NOW(),
        revocation_reason = v_clean_reason,
        updated_at = NOW()
    WHERE id = p_grant_id;

    INSERT INTO public.student_special_access_audit_logs (
        grant_id,
        student_id,
        classroom_id,
        access_type,
        action,
        actor_id,
        actor_role,
        reason,
        min_balance_limit
    ) VALUES (
        p_grant_id,
        v_grant.student_id,
        v_grant.classroom_id,
        v_grant.access_type,
        'revoked',
        v_caller_id,
        v_caller_role,
        v_clean_reason,
        v_grant.min_balance_limit
    );

    SELECT name INTO v_classroom_name FROM public.classrooms WHERE id = v_grant.classroom_id;

    -- Dispatch student revocation notification
    PERFORM public.send_idempotent_notification(
        v_grant.student_id,
        'special_access_revoked',
        p_grant_id::TEXT,
        NOW()::DATE::TEXT,
        'Special Access Revoked',
        'Your ' || v_grant.access_type || ' permission for "' || COALESCE(v_classroom_name, 'Classroom') ||
        '" has been revoked. Reason: ' || v_clean_reason || '.',
        'fees',
        jsonb_build_object(
            'grant_id', p_grant_id,
            'access_type', v_grant.access_type,
            'classroom_id', v_grant.classroom_id,
            'reason', v_clean_reason
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'grant_id', p_grant_id,
        'status', 'revoked'
    );
END;
$$;


-- ----------------------------------------------------------------------------
-- PART 7: Event-Driven Payment Notifications
-- ----------------------------------------------------------------------------

-- Update approve_fee_payment to dispatch student payment confirmation
CREATE OR REPLACE FUNCTION public.approve_fee_payment(
    p_payment_id UUID,
    p_classes_added INTEGER DEFAULT NULL
)
RETURNS public.fees_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_payment public.fees_payments%ROWTYPE;
    v_classes INTEGER;
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_new_balance INTEGER;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or admins can approve payments.' USING ERRCODE = '42501';
    END IF;

    IF p_classes_added IS NOT NULL AND (p_classes_added <= 0 OR p_classes_added > 50) THEN
        RAISE EXCEPTION 'Classes added must be a positive integer between 1 and 50: %', p_classes_added USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_payment
    FROM public.fees_payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment record not found: %', p_payment_id USING ERRCODE = 'P0002';
    END IF;

    -- Idempotent return if already approved
    IF v_payment.status = 'approved' THEN
        RETURN v_payment;
    END IF;

    IF v_payment.status <> 'pending_approval' THEN
        RAISE EXCEPTION 'Invalid payment status transition: cannot approve payment with status %', v_payment.status
            USING ERRCODE = '22023';
    END IF;

    v_classes := COALESCE(p_classes_added, v_payment.classes_added, 4);

    UPDATE public.fees_payments
    SET status = 'approved',
        classes_added = v_classes
    WHERE id = p_payment_id
    RETURNING * INTO v_payment;

    UPDATE public.users
    SET fees_classes_paid = COALESCE(fees_classes_paid, 0) + v_classes
    WHERE id = v_payment.student_id
    RETURNING fees_classes_paid INTO v_new_balance;

    -- Dismiss existing fee reminders
    UPDATE public.notifications
    SET is_read = true
    WHERE user_id = v_payment.student_id
      AND type IN ('fee_reminder', 'reminder', 'fees');

    INSERT INTO public.fees_payment_audit_logs (
        payment_id,
        actor_id,
        action,
        previous_status,
        new_status,
        credit_delta,
        reason
    ) VALUES (
        p_payment_id,
        v_caller_id,
        'approve',
        'pending_approval',
        'approved',
        v_classes,
        'Payment approved by staff'
    );

    -- Dispatch Payment Approval Confirmation Notification
    PERFORM public.send_idempotent_notification(
        v_payment.student_id,
        'payment_approved',
        p_payment_id::TEXT,
        NOW()::DATE::TEXT,
        'Payment Confirmed',
        'Your fee payment of ₹' || v_payment.amount || ' (' || v_classes ||
        ' classes) has been approved. Your updated credit balance is ' || v_new_balance || '.',
        'fees',
        jsonb_build_object(
            'payment_id', p_payment_id,
            'amount', v_payment.amount,
            'classes_added', v_classes,
            'new_balance', v_new_balance
        )
    );

    RETURN v_payment;
END;
$$;


-- Update reject_fee_payment to dispatch student payment rejection notification
CREATE OR REPLACE FUNCTION public.reject_fee_payment(
    p_payment_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS public.fees_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_payment public.fees_payments%ROWTYPE;
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_clean_reason TEXT := TRIM(COALESCE(p_reason, 'Verification could not be confirmed'));
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or admins can reject fee payments' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_payment
    FROM public.fees_payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment record not found: %', p_payment_id USING ERRCODE = 'P0002';
    END IF;

    IF v_payment.status <> 'pending_approval' THEN
        RAISE EXCEPTION 'Invalid payment transition: only pending_approval payments can be rejected, current status is %', v_payment.status
            USING ERRCODE = '22023';
    END IF;

    UPDATE public.fees_payments
    SET status = 'rejected',
        notes = CASE WHEN v_clean_reason <> ''
                     THEN COALESCE(notes || E'\n[Rejected]: ' || v_clean_reason, '[Rejected]: ' || v_clean_reason)
                     ELSE notes END
    WHERE id = p_payment_id
    RETURNING * INTO v_payment;

    INSERT INTO public.fees_payment_audit_logs (
        payment_id,
        actor_id,
        action,
        previous_status,
        new_status,
        credit_delta,
        reason
    ) VALUES (
        p_payment_id,
        v_caller_id,
        'reject',
        'pending_approval',
        'rejected',
        0,
        v_clean_reason
    );

    -- Dispatch Payment Rejection Notification
    PERFORM public.send_idempotent_notification(
        v_payment.student_id,
        'payment_rejected',
        p_payment_id::TEXT,
        NOW()::DATE::TEXT,
        'Payment Rejected',
        'Your submitted payment of ₹' || v_payment.amount || ' was rejected (' ||
        v_clean_reason || '). Please contact academy administration.',
        'fees',
        jsonb_build_object(
            'payment_id', p_payment_id,
            'amount', v_payment.amount,
            'reason', v_clean_reason
        )
    );

    RETURN v_payment;
END;
$$;


-- Update record_fee_payment_atomic to dispatch payment submission notification
CREATE OR REPLACE FUNCTION public.record_fee_payment_atomic(
    p_student_id UUID,
    p_amount NUMERIC,
    p_payment_date DATE,
    p_payment_method TEXT,
    p_classes_added INTEGER,
    p_notes TEXT,
    p_idempotency_key TEXT,
    p_status TEXT DEFAULT 'approved'
)
RETURNS public.fees_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_payment public.fees_payments%ROWTYPE;
    v_status TEXT := COALESCE(p_status, 'approved');
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_classes INTEGER := COALESCE(p_classes_added, 4);
    v_amount NUMERIC := COALESCE(p_amount, 0);
    v_date DATE := COALESCE(p_payment_date, CURRENT_DATE);
    v_method TEXT := COALESCE(p_payment_method, 'UPI');
    v_new_balance INTEGER;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;

    IF v_status = 'approved' THEN
        IF v_caller_role NOT IN ('admin', 'teacher') THEN
            RAISE EXCEPTION 'Unauthorized: only teachers or admins can record approved payments.' USING ERRCODE = '42501';
        END IF;
    ELSIF v_status = 'pending_approval' THEN
        IF v_caller_role = 'student' AND p_student_id <> v_caller_id THEN
            RAISE EXCEPTION 'Unauthorized: students can only submit payments for themselves' USING ERRCODE = '42501';
        ELSIF v_caller_role NOT IN ('admin', 'teacher', 'student') THEN
            RAISE EXCEPTION 'Unauthorized: caller role not permitted to record payments' USING ERRCODE = '42501';
        END IF;
    ELSE
        RAISE EXCEPTION 'Invalid payment status: %', v_status USING ERRCODE = '22023';
    END IF;

    IF v_amount < 0 THEN
        RAISE EXCEPTION 'Payment amount cannot be negative: %', v_amount USING ERRCODE = '22023';
    END IF;

    IF v_classes <= 0 OR v_classes > 50 THEN
        RAISE EXCEPTION 'Classes added must be a positive integer between 1 and 50: %', v_classes USING ERRCODE = '22023';
    END IF;

    IF p_idempotency_key IS NULL OR TRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'Idempotency key is required for payment requests' USING ERRCODE = '22023';
    END IF;

    -- Existing key check
    SELECT * INTO v_payment
    FROM public.fees_payments
    WHERE idempotency_key = TRIM(p_idempotency_key)
    FOR UPDATE;

    IF FOUND THEN
        IF v_payment.student_id <> p_student_id
           OR v_payment.amount <> v_amount
           OR v_payment.payment_date <> v_date
           OR v_payment.payment_method <> v_method
           OR v_payment.classes_added <> v_classes
           OR (v_payment.status <> v_status AND NOT (v_payment.status = 'approved' AND v_status = 'pending_approval'))
        THEN
            RAISE EXCEPTION 'Conflicting idempotency key reuse: payment payload does not match existing record for key %', p_idempotency_key
                USING ERRCODE = '23505';
        END IF;

        RETURN v_payment;
    END IF;

    BEGIN
        INSERT INTO public.fees_payments (
            student_id,
            amount,
            payment_date,
            payment_method,
            classes_added,
            notes,
            idempotency_key,
            status
        ) VALUES (
            p_student_id,
            v_amount,
            v_date,
            v_method,
            v_classes,
            p_notes,
            TRIM(p_idempotency_key),
            v_status
        )
        RETURNING * INTO v_payment;
    EXCEPTION WHEN unique_violation THEN
        SELECT * INTO v_payment
        FROM public.fees_payments
        WHERE idempotency_key = TRIM(p_idempotency_key);
        RETURN v_payment;
    END;

    IF v_status = 'approved' THEN
        UPDATE public.users
        SET fees_classes_paid = COALESCE(fees_classes_paid, 0) + v_classes
        WHERE id = p_student_id
        RETURNING fees_classes_paid INTO v_new_balance;

        UPDATE public.notifications
        SET is_read = true
        WHERE user_id = p_student_id
          AND type IN ('fee_reminder', 'reminder', 'fees');

        INSERT INTO public.fees_payment_audit_logs (
            payment_id,
            actor_id,
            action,
            previous_status,
            new_status,
            credit_delta,
            reason
        ) VALUES (
            v_payment.id,
            v_caller_id,
            'insert',
            NULL,
            'approved',
            v_classes,
            'Approved fee payment recorded'
        );

        -- Confirmation notification
        PERFORM public.send_idempotent_notification(
            p_student_id,
            'payment_approved',
            v_payment.id::TEXT,
            v_date::TEXT,
            'Payment Confirmed',
            'Your fee payment of ₹' || v_amount || ' (' || v_classes ||
            ' classes) has been approved. Your updated credit balance is ' || v_new_balance || '.',
            'fees',
            jsonb_build_object(
                'payment_id', v_payment.id,
                'amount', v_amount,
                'classes_added', v_classes,
                'new_balance', v_new_balance
            )
        );
    ELSE
        INSERT INTO public.fees_payment_audit_logs (
            payment_id,
            actor_id,
            action,
            previous_status,
            new_status,
            credit_delta,
            reason
        ) VALUES (
            v_payment.id,
            v_caller_id,
            'insert',
            NULL,
            'pending_approval',
            0,
            'Pending payment submitted for verification'
        );

        -- Submission notification for student
        PERFORM public.send_idempotent_notification(
            p_student_id,
            'payment_submitted',
            v_payment.id::TEXT,
            v_date::TEXT,
            'Payment Submitted',
            'Your payment of ₹' || v_amount || ' submitted on ' || v_date::TEXT ||
            ' is pending verification by academy administration.',
            'fees',
            jsonb_build_object(
                'payment_id', v_payment.id,
                'amount', v_amount,
                'status', 'pending_approval'
            )
        );
    END IF;

    RETURN v_payment;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_fee_payment(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_fee_payment(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_fee_payment_atomic(UUID, NUMERIC, DATE, TEXT, INTEGER, TEXT, TEXT, TEXT) TO authenticated, service_role;
