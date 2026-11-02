-- ============================================================================
-- Migration: 20261031190000_fix_br04_financial_status_and_dispatcher_security.sql
-- Description: 
--   1. Fix BR-04 financial status alignment in evaluate_student_live_access
--      - Balance > 0: GOOD_STANDING, live access allowed
--      - Balance = 0: FEE_DUE, live access allowed with due notice banner
--      - Balance < 0: PAYMENT_OVERDUE, live access blocked unless special access granted
--      - Billing due date does NOT convert balance = 0 to PAYMENT_OVERDUE
--   2. Fix dispatch_fee_reminders: zero balance never mislabeled as overdue
--   3. Secure dispatcher RPCs against unauthorized caller invocation
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Correct evaluate_student_live_access (BR-04 Alignment)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evaluate_student_live_access(
    p_student_id UUID,
    p_classroom_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user public.users%ROWTYPE;
    v_classroom public.classrooms%ROWTYPE;
    v_is_enrolled BOOLEAN := FALSE;
    v_effective_bal INTEGER := 0;
    v_due_day INTEGER;
    v_today DATE := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;
    v_is_past_due BOOLEAN := FALSE;
    v_has_advance BOOLEAN := FALSE;
    v_has_overdue BOOLEAN := FALSE;
    v_fin_state TEXT;
    v_can_join BOOLEAN := TRUE;
    v_reason TEXT := 'Access granted';
BEGIN
    -- Verify classroom exists and is active
    SELECT * INTO v_classroom FROM public.classrooms WHERE id = p_classroom_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'can_join', false,
            'financial_state', 'RESTRICTED',
            'effective_balance', 0,
            'error', 'Classroom not found.',
            'status', 404
        );
    END IF;

    -- Verify student exists
    SELECT * INTO v_user FROM public.users WHERE id = p_student_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'can_join', false,
            'financial_state', 'RESTRICTED',
            'effective_balance', 0,
            'error', 'Student not found.',
            'status', 404
        );
    END IF;

    -- Staff bypass (admins, teachers, mentors)
    IF v_user.role IN ('admin', 'teacher', 'mentor') THEN
        RETURN jsonb_build_object(
            'can_join', true,
            'financial_state', 'GOOD_STANDING',
            'effective_balance', 999,
            'reason', 'Staff bypass'
        );
    END IF;

    -- Paused / Archived students strictly blocked
    IF LOWER(COALESCE(v_user.status, 'active')) != 'active' THEN
        RETURN jsonb_build_object(
            'can_join', false,
            'financial_state', 'RESTRICTED',
            'effective_balance', COALESCE(v_user.fees_classes_paid, 0),
            'error', 'Student is inactive or archived. Live class participation is not available.',
            'status', 403
        );
    END IF;

    -- Enrollment check (permanent or temporary override)
    SELECT EXISTS (
        SELECT 1 FROM public.classroom_students WHERE student_id = p_student_id AND classroom_id = p_classroom_id
        UNION ALL
        SELECT 1 FROM public.session_student_overrides WHERE student_id = p_student_id AND target_classroom_id = p_classroom_id
    ) INTO v_is_enrolled;

    IF NOT v_is_enrolled THEN
        RETURN jsonb_build_object(
            'can_join', false,
            'financial_state', 'NOT_ENROLLED',
            'effective_balance', COALESCE(v_user.fees_classes_paid, 0),
            'error', 'Student is not enrolled in this classroom.',
            'status', 403
        );
    END IF;

    v_effective_bal := COALESCE(v_user.fees_classes_paid, 0);

    -- Check if billing due date has passed
    v_due_day := COALESCE(v_user.fees_collection_date, EXTRACT(DAY FROM COALESCE(v_user.join_date, v_today))::INTEGER);
    IF EXTRACT(DAY FROM v_today) > v_due_day THEN
        v_is_past_due := TRUE;
    END IF;

    -- Check active special access grants
    SELECT EXISTS (
        SELECT 1 FROM public.student_special_access_grants
        WHERE student_id = p_student_id
          AND classroom_id = p_classroom_id
          AND access_type = 'advance_credit'
          AND status = 'active'
          AND min_balance_limit <= v_effective_bal
    ) INTO v_has_advance;

    SELECT EXISTS (
        SELECT 1 FROM public.student_special_access_grants
        WHERE student_id = p_student_id
          AND classroom_id = p_classroom_id
          AND access_type = 'overdue_access'
          AND status = 'active'
    ) INTO v_has_overdue;

    -- Strict BR-04 Financial Status & Access Rules:
    -- Balance > 0: GOOD_STANDING, class allowed
    IF v_effective_bal > 0 THEN
        v_fin_state := 'GOOD_STANDING';
        v_can_join := TRUE;
        v_reason := 'Access granted: good standing';

    -- Balance = 0: FEE_DUE, class allowed with banner (calendar due date does NOT block access)
    ELSIF v_effective_bal = 0 THEN
        v_fin_state := 'FEE_DUE';
        v_can_join := TRUE;
        IF v_is_past_due THEN
            v_reason := 'Payment due date has arrived. Please settle fees.';
        ELSE
            v_reason := 'Classes consumed. Please recharge balance.';
        END IF;

    -- Balance < 0: PAYMENT_OVERDUE, class blocked unless authorized
    ELSE
        v_fin_state := 'PAYMENT_OVERDUE';

        IF v_effective_bal < -2 THEN
            -- Hard floor: Balance below -2 cannot be authorized
            v_can_join := FALSE;
            v_reason := 'Maximum advance credit limit (-2) exceeded. Current balance is ' || v_effective_bal || '.';
        ELSIF v_is_past_due AND NOT v_has_overdue AND NOT v_has_advance THEN
            -- Both restrictions apply: both permissions required
            v_can_join := FALSE;
            v_reason := 'Both advance credit and overdue access authorizations are required.';
        ELSIF NOT v_has_advance THEN
            v_can_join := FALSE;
            v_reason := 'Negative balance requires advance credit authorization.';
        ELSIF v_is_past_due AND NOT v_has_overdue THEN
            v_can_join := FALSE;
            v_reason := 'Overdue fee requires overdue access authorization.';
        ELSE
            -- Permissions granted
            v_can_join := TRUE;
            v_reason := 'Access granted: authorized special access';
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'can_join', v_can_join,
        'financial_state', v_fin_state,
        'effective_balance', v_effective_bal,
        'reason', v_reason,
        'requires_advance_credit', (v_effective_bal < 0),
        'has_advance_credit', v_has_advance,
        'has_advance_grant', v_has_advance,
        'requires_overdue_access', (v_effective_bal < 0 AND v_is_past_due),
        'has_overdue_access', v_has_overdue,
        'has_overdue_grant', v_has_overdue,
        'is_past_due', v_is_past_due
    );
END;
$$;


-- ----------------------------------------------------------------------------
-- 2. Correct dispatch_fee_reminders (Never Mislable Balance = 0 as Overdue)
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
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
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
    -- Authorization check: Caller must be authenticated staff or internal service role
    IF v_caller_id IS NOT NULL THEN
        SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
        IF v_caller_role NOT IN ('admin', 'teacher', 'service_role') THEN
            RAISE EXCEPTION 'Unauthorized: only staff or scheduler can invoke reminder dispatcher'
                USING ERRCODE = '42501';
        END IF;
    END IF;

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

        -- Strict BR-04 Rule: ONLY negative balance (< 0) is PAYMENT_OVERDUE
        v_is_overdue := (v_student.balance < 0);

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
        -- Fee Due Notification: Balance is 0 OR due date is today
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


-- ----------------------------------------------------------------------------
-- 3. Secure dispatch_makeup_reminders_and_expiry (Staff/Service Role Only)
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
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
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
    -- Authorization check: Caller must be authenticated staff or internal service role
    IF v_caller_id IS NOT NULL THEN
        SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
        IF v_caller_role NOT IN ('admin', 'teacher', 'service_role') THEN
            RAISE EXCEPTION 'Unauthorized: only staff or scheduler can invoke reminder dispatcher'
                USING ERRCODE = '42501';
        END IF;
    END IF;

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
        v_due_date := public.calculate_student_next_due_date(v_leave.student_id, v_leave.missed_date);
        IF v_due_date IS NULL THEN
            CONTINUE;
        END IF;

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

GRANT EXECUTE ON FUNCTION public.evaluate_student_live_access(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dispatch_fee_reminders(DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dispatch_makeup_reminders_and_expiry(DATE) TO authenticated, service_role;
