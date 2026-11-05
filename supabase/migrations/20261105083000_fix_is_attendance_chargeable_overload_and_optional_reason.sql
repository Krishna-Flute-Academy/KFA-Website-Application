-- =====================================================================================
-- KFA Migration: Overload is_attendance_chargeable & Make Correction Reason Optional
-- Version: 20261105083000
-- =====================================================================================
-- Purpose:
-- 1. Redefine canonical public.is_attendance_chargeable(UUID, UUID, DATE, TEXT, DATE)
--    to ensure regular and temporary classes debit 1 prepaid credit on Present/Absent,
--    and alternative classes on behalf of an already-debited missed date deduct 0 credits (no double debit).
-- 2. Create an overload for public.is_attendance_chargeable(TEXT, UUID, UUID, DATE, DATE)
--    that maps to canonical (UUID, UUID, DATE, TEXT, DATE).
-- 3. Ensure compute_attendance_credit() trigger calls canonical signature on INSERT & UPDATE.
-- 4. Make p_reason optional in correct_historical_attendance() and unmark_historical_attendance(),
--    defaulting to sensible system messages rather than throwing a validation exception.
-- =====================================================================================

BEGIN;

-- 1. Canonical is_attendance_chargeable(UUID, UUID, DATE, TEXT, DATE)
CREATE OR REPLACE FUNCTION public.is_attendance_chargeable(
    p_student_id UUID,
    p_classroom_id UUID,
    p_date DATE,
    p_status TEXT,
    p_on_behalf_of_date DATE DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_classroom_type TEXT;
    v_temp_credit_treatment TEXT;
    v_temp_purpose TEXT;
    v_override RECORD;
    v_missed_date DATE;
    v_missed_att_status TEXT;
    v_missed_credit_deducted INTEGER;
    v_has_approved_leave BOOLEAN;
    v_makeup_attended BOOLEAN;
BEGIN
    -- Rule 1: Excused attendance NEVER consumes prepaid credits
    IF LOWER(TRIM(COALESCE(p_status, ''))) = 'excused' THEN
        RETURN FALSE;
    END IF;

    -- Only present, late, and absent can potentially consume credits
    IF LOWER(TRIM(COALESCE(p_status, ''))) NOT IN ('present', 'late', 'absent') THEN
        RETURN FALSE;
    END IF;

    -- Rule 2: Check if classroom is explicitly Complimentary
    SELECT c.type, tc.credit_treatment, tc.purpose
    INTO v_classroom_type, v_temp_credit_treatment, v_temp_purpose
    FROM public.classrooms c
    LEFT JOIN public.temporary_classes tc
      ON (tc.classroom_id = c.id OR tc.id = c.id)
    WHERE c.id = p_classroom_id
    LIMIT 1;

    -- Only complimentary classes are free (0 deduction). All other classes (regular or temporary/alternative/extra) are chargeable.
    IF v_temp_credit_treatment = 'complimentary' THEN
        RETURN FALSE;
    END IF;

    -- Rule 3: Check student override for this specific session
    SELECT id, credit_treatment, missed_session_date, reason
    INTO v_override
    FROM public.session_student_overrides
    WHERE student_id = p_student_id
      AND target_classroom_id = p_classroom_id
      AND override_date = p_date
    LIMIT 1;

    IF v_override.id IS NOT NULL THEN
        -- If student-level override says complimentary, zero deduction
        IF v_override.credit_treatment = 'complimentary' THEN
            RETURN FALSE;
        END IF;
    END IF;

    -- Rule 4: Handle alternative class / makeup class on behalf of a missed/holiday date
    v_missed_date := COALESCE(p_on_behalf_of_date, v_override.missed_session_date);
    IF v_missed_date IS NULL AND v_override.reason IS NOT NULL THEN
        v_missed_date := substring(v_override.reason FROM '\[MissedDate:([0-9]{4}-[0-9]{2}-[0-9]{2})\]')::DATE;
    END IF;

    IF v_missed_date IS NOT NULL THEN
        -- Look up the attendance and leave status for the missed date
        SELECT status, credit_deducted INTO v_missed_att_status, v_missed_credit_deducted
        FROM public.attendance
        WHERE student_id = p_student_id
          AND date = v_missed_date
        LIMIT 1;

        SELECT EXISTS (
            SELECT 1 FROM public.leave_requests
            WHERE student_id = p_student_id
              AND class_date = v_missed_date
              AND status = 'approved'
        ) INTO v_has_approved_leave;

        -- If student had approved leave or was marked excused on the missed date (credit_deducted = 0),
        -- or if no attendance record existed for the missed date (e.g. cancelled holiday):
        -- this alternative class is their attended class, so it MUST consume 1 credit.
        IF v_has_approved_leave OR LOWER(v_missed_att_status) = 'excused' OR v_missed_att_status IS NULL THEN
            RETURN TRUE;
        END IF;

        -- If the missed date was already marked absent/present and 1 credit was already deducted:
        -- attending this alternative class must NOT debit an additional credit (0 deduction, keep record only).
        IF LOWER(v_missed_att_status) IN ('absent', 'present', 'late') 
           AND COALESCE(v_missed_credit_deducted, 0) = 1 THEN
            RETURN FALSE;
        END IF;

        RETURN TRUE;
    END IF;

    -- Rule 5: Symmetrical guard: check if makeup/alternative was already attended for this date
    SELECT EXISTS (
        SELECT 1
        FROM public.session_student_overrides o
        JOIN public.attendance a
          ON a.student_id = o.student_id
         AND a.classroom_id = o.target_classroom_id
         AND a.date = o.override_date
        WHERE o.student_id = p_student_id
          AND (o.missed_session_date = p_date OR o.reason LIKE '%[MissedDate:' || p_date::text || ']%')
          AND o.override_date != p_date
          AND a.status IN ('present', 'late')
          AND a.credit_deducted = 1
    ) INTO v_makeup_attended;

    IF v_makeup_attended THEN
        RETURN FALSE;
    END IF;

    -- Rule 6: On-Behalf-Of attendance duplicate guard:
    -- If another attendance record exists on behalf of p_date and was charged 1 credit
    IF EXISTS (
        SELECT 1 FROM public.attendance
        WHERE student_id = p_student_id
          AND on_behalf_of_date = p_date
          AND date != p_date
          AND status IN ('present', 'late')
          AND credit_deducted = 1
    ) THEN
        RETURN FALSE;
    END IF;

    -- Standard regular attendance consumes 1 credit
    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_attendance_chargeable(UUID, UUID, DATE, TEXT, DATE) TO authenticated, service_role, postgres;

-- 2. Overload is_attendance_chargeable to accept (TEXT, UUID, UUID, DATE, DATE)
CREATE OR REPLACE FUNCTION public.is_attendance_chargeable(
    p_status TEXT,
    p_classroom_id UUID,
    p_student_id UUID,
    p_date DATE,
    p_on_behalf_of_date DATE DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT public.is_attendance_chargeable(
        p_student_id,
        p_classroom_id,
        p_date,
        p_status,
        p_on_behalf_of_date
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_attendance_chargeable(TEXT, UUID, UUID, DATE, DATE) TO authenticated, service_role, postgres;

-- 3. Update compute_attendance_credit trigger to guarantee canonical argument order and idempotency
CREATE OR REPLACE FUNCTION public.compute_attendance_credit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Auto-populate on_behalf_of_date if inserting on an active scheduled alternative date for this classroom
        IF NEW.on_behalf_of_date IS NULL AND NEW.classroom_id IS NOT NULL AND NEW.date IS NOT NULL THEN
            SELECT ch.holiday_date INTO NEW.on_behalf_of_date
            FROM public.classroom_holidays ch
            WHERE ch.classroom_id = NEW.classroom_id
              AND ch.alternative_date = NEW.date
              AND ch.status = 'active'
              AND ch.holiday_type IN ('with_alternative', 'alternative_scheduled')
            LIMIT 1;
        END IF;

        NEW.credit_deducted := CASE
            WHEN public.is_attendance_chargeable(
                NEW.student_id,
                NEW.classroom_id,
                NEW.date,
                NEW.status,
                NEW.on_behalf_of_date
            ) THEN 1
            ELSE 0
        END;
        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        -- If status was already in an attended/absent state and remains in an attended/absent state,
        -- retain the persisted credit_deducted flag only if it was already 1.
        -- If it was 0, recheck whether it should now be chargeable (healing previously uncharged records).
        IF (OLD.status IN ('present', 'late', 'absent') AND NEW.status IN ('present', 'late', 'absent') AND OLD.credit_deducted = 1) THEN
            NEW.credit_deducted := 1;
        ELSE
            NEW.credit_deducted := CASE
                WHEN public.is_attendance_chargeable(
                    NEW.student_id,
                    NEW.classroom_id,
                    NEW.date,
                    NEW.status,
                    NEW.on_behalf_of_date
                ) THEN 1
                ELSE 0
            END;
        END IF;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

-- 3. Update correct_historical_attendance to make reason optional (defaults to 'Attendance updated by teacher')
CREATE OR REPLACE FUNCTION public.correct_historical_attendance(
    p_attendance_id UUID,
    p_new_status TEXT,
    p_reason TEXT DEFAULT NULL,
    p_authorized_credit_delta INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT := 'admin';
    v_attendance public.attendance%ROWTYPE;
    v_clean_status TEXT;
    v_clean_reason TEXT;
    v_balance_before INTEGER;
    v_balance_after INTEGER;
    v_credit_delta INTEGER := 0;
    v_has_completed_makeup BOOLEAN := false;
    v_scheduled_override_id UUID := NULL;
    v_cancelled_override_id UUID := NULL;
    v_leave_record public.leave_requests%ROWTYPE;
    v_reconciled_leave_id UUID := NULL;
    v_prev_credit_deducted INTEGER;
    v_new_credit_deducted INTEGER;
    v_audit_id UUID;
BEGIN
    -- 1. Authentication & Role Check
    IF v_caller_id IS NOT NULL THEN
        SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
        IF v_caller_role NOT IN ('admin', 'teacher') THEN
            RAISE EXCEPTION 'Unauthorized: only teachers or administrators can correct attendance.' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 2. Reason is optional, default if empty
    v_clean_reason := TRIM(COALESCE(p_reason, ''));
    IF v_clean_reason = '' THEN
        v_clean_reason := 'Attendance updated by teacher';
    END IF;

    -- Validate target status
    v_clean_status := LOWER(TRIM(p_new_status));
    IF v_clean_status NOT IN ('present', 'absent', 'late', 'excused') THEN
        RAISE EXCEPTION 'Invalid target attendance status: %', p_new_status USING ERRCODE = '22023';
    END IF;

    -- 3. Lock attendance record exclusively FOR UPDATE
    SELECT * INTO v_attendance
    FROM public.attendance
    WHERE id = p_attendance_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Attendance record not found: %', p_attendance_id USING ERRCODE = 'P0002';
    END IF;

    -- Classroom ownership validation for teachers (BR-10)
    IF v_caller_id IS NOT NULL AND v_caller_role = 'teacher' THEN
        IF NOT public.can_manage_classroom_attendance(v_attendance.classroom_id, v_caller_id) THEN
            RAISE EXCEPTION 'Unauthorized: teachers can only correct attendance for their assigned classrooms.' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- Check if status is unchanged
    IF v_attendance.status = v_clean_status THEN
        RAISE EXCEPTION 'Attendance record is already marked as %', v_clean_status USING ERRCODE = '22023';
    END IF;

    -- 4. Lock student record exclusively FOR UPDATE to prevent race conditions on balance
    SELECT fees_classes_paid INTO v_balance_before
    FROM public.users
    WHERE id = v_attendance.student_id
    FOR UPDATE;

    -- 5. Detect completed or forfeited makeup for this missed session (BR-13)
    SELECT EXISTS (
        SELECT 1 FROM public.session_student_overrides sso
        JOIN public.attendance a ON a.student_id = sso.student_id 
                                AND a.classroom_id = sso.target_classroom_id 
                                AND a.date = sso.override_date
        WHERE sso.student_id = v_attendance.student_id 
          AND sso.missed_session_date = v_attendance.date
          AND a.status IN ('present', 'late', 'absent')
    ) INTO v_has_completed_makeup;

    -- Fail-closed protection: changing excused to absent/present when makeup already consumed is prohibited
    IF v_attendance.status = 'excused' AND v_clean_status IN ('present', 'late', 'absent') AND v_has_completed_makeup THEN
        RAISE EXCEPTION 'Cannot correct attendance: student has already attended or completed makeup class for date %', v_attendance.date
            USING ERRCODE = '23514';
    END IF;

    -- 6. Reconcile active scheduled makeup booking if reverting excused absence
    IF v_attendance.status = 'excused' AND v_clean_status IN ('present', 'late', 'absent') THEN
        SELECT id INTO v_scheduled_override_id
        FROM public.session_student_overrides
        WHERE student_id = v_attendance.student_id
          AND missed_session_date = v_attendance.date
          AND credit_treatment = 'makeup'
          AND booking_status = 'scheduled'
        LIMIT 1;

        IF v_scheduled_override_id IS NOT NULL THEN
            UPDATE public.session_student_overrides
            SET booking_status = 'cancelled',
                updated_at = NOW(),
                reason = COALESCE(reason, '') || ' [Auto-cancelled: Original attendance corrected to ' || v_clean_status || ' with reason: ' || v_clean_reason || ']'
            WHERE id = v_scheduled_override_id;
            v_cancelled_override_id := v_scheduled_override_id;
        END IF;

        -- Reconcile related approved leave request to rejected
        SELECT * INTO v_leave_record
        FROM public.leave_requests
        WHERE student_id = v_attendance.student_id
          AND class_date = v_attendance.date
          AND status = 'approved'
        FOR UPDATE;

        IF v_leave_record.id IS NOT NULL THEN
            UPDATE public.leave_requests
            SET status = 'rejected',
                updated_at = NOW()
            WHERE id = v_leave_record.id;
            v_reconciled_leave_id := v_leave_record.id;

            -- Audit leave correction
            INSERT INTO public.leave_correction_audit_logs (
                leave_id,
                student_id,
                actor_id,
                previous_leave_status,
                new_leave_status,
                previous_attendance_status,
                new_attendance_status,
                credit_delta,
                reason
            ) VALUES (
                v_leave_record.id,
                v_attendance.student_id,
                COALESCE(v_caller_id, v_attendance.student_id),
                'approved',
                'rejected',
                v_attendance.status,
                v_clean_status,
                -1,
                'Reconciled via historical attendance correction: ' || v_clean_reason
            );
        END IF;

    ELSIF v_clean_status = 'excused' AND v_attendance.status IN ('present', 'late', 'absent') THEN
        -- Reconcile pending leave request if present
        SELECT * INTO v_leave_record
        FROM public.leave_requests
        WHERE student_id = v_attendance.student_id
          AND class_date = v_attendance.date
          AND status = 'pending'
        FOR UPDATE;

        IF v_leave_record.id IS NOT NULL THEN
            UPDATE public.leave_requests
            SET status = 'approved',
                updated_at = NOW()
            WHERE id = v_leave_record.id;
            v_reconciled_leave_id := v_leave_record.id;

            INSERT INTO public.leave_correction_audit_logs (
                leave_id,
                student_id,
                actor_id,
                previous_leave_status,
                new_leave_status,
                previous_attendance_status,
                new_attendance_status,
                credit_delta,
                reason
            ) VALUES (
                v_leave_record.id,
                v_attendance.student_id,
                COALESCE(v_caller_id, v_attendance.student_id),
                'pending',
                'approved',
                v_attendance.status,
                v_clean_status,
                1,
                'Approved via historical attendance correction: ' || v_clean_reason
            );
        END IF;
    END IF;

    v_prev_credit_deducted := v_attendance.credit_deducted;

    -- 7. Compute Financial Impact (BR-11)
    IF v_prev_credit_deducted > 0 AND v_clean_status = 'excused' THEN
        v_credit_delta := 1; -- Refund 1 credit
    ELSIF v_prev_credit_deducted = 0 AND v_clean_status IN ('present', 'late', 'absent') THEN
        v_credit_delta := -1; -- Deduct 1 credit
    ELSE
        v_credit_delta := 0; -- Net zero change
    END IF;

    -- Validate authorized credit delta if passed
    IF p_authorized_credit_delta IS NOT NULL AND p_authorized_credit_delta <> v_credit_delta THEN
        RAISE EXCEPTION 'Authorized credit delta mismatch: authorized delta % does not match calculated delta %',
            p_authorized_credit_delta, v_credit_delta USING ERRCODE = '22023';
    END IF;

    -- 8. Set transaction context flag so the lock trigger permits this audited update
    PERFORM set_config('kfa.in_audited_attendance_correction', 'true', true);

    -- 9. Update Attendance Record (Triggers compute_attendance_credit and sync_attendance_fees handle users.fees_classes_paid)
    UPDATE public.attendance
    SET status = v_clean_status,
        marked_by = COALESCE(v_caller_id, marked_by)
    WHERE id = p_attendance_id
    RETURNING credit_deducted INTO v_new_credit_deducted;

    -- Fetch refreshed balance (trigger sync_attendance_fees handled it)
    SELECT fees_classes_paid INTO v_balance_after
    FROM public.users
    WHERE id = v_attendance.student_id;

    -- 10. Write Immutable Audit Log (BR-12)
    INSERT INTO public.attendance_correction_audit_logs (
        attendance_id,
        student_id,
        classroom_id,
        class_date,
        previous_status,
        new_status,
        actor_id,
        actor_role,
        correction_reason,
        previous_credit_deducted,
        new_credit_deducted,
        net_credit_adjustment,
        related_leave_id,
        related_override_id
    ) VALUES (
        v_attendance.id,
        v_attendance.student_id,
        v_attendance.classroom_id,
        v_attendance.date,
        v_attendance.status,
        v_clean_status,
        v_caller_id,
        v_caller_role,
        v_clean_reason,
        v_prev_credit_deducted,
        COALESCE(v_new_credit_deducted, 0),
        v_credit_delta,
        v_reconciled_leave_id,
        v_cancelled_override_id
    )
    RETURNING id INTO v_audit_id;

    RETURN jsonb_build_object(
        'success', true,
        'audit_id', v_audit_id,
        'audit_log_id', v_audit_id,
        'attendance_id', p_attendance_id,
        'student_id', v_attendance.student_id,
        'classroom_id', v_attendance.classroom_id,
        'session_date', v_attendance.date,
        'class_date', v_attendance.date,
        'previous_status', v_attendance.status,
        'new_status', v_clean_status,
        'previous_credit_deducted', v_prev_credit_deducted,
        'new_credit_deducted', v_new_credit_deducted,
        'credit_delta', v_credit_delta,
        'net_credit_adjustment', v_credit_delta,
        'previous_balance', v_balance_before,
        'new_balance', v_balance_after,
        'balance_before', v_balance_before,
        'balance_after', v_balance_after,
        'cancelled_override_id', v_cancelled_override_id,
        'reconciled_leave_id', v_reconciled_leave_id,
        'makeup_cancelled', (v_cancelled_override_id IS NOT NULL),
        'leave_reconciled', (v_reconciled_leave_id IS NOT NULL)
    );
END;
$$;

-- 4. Update unmark_historical_attendance to make reason optional (defaults to 'Attendance unmarked by teacher')
CREATE OR REPLACE FUNCTION public.unmark_historical_attendance(
    p_attendance_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT := 'admin';
    v_attendance public.attendance%ROWTYPE;
    v_has_completed_makeup BOOLEAN := false;
    v_scheduled_override_id UUID := NULL;
    v_related_leave_id UUID := NULL;
    v_balance_before INTEGER;
    v_net_adjustment INTEGER := 0;
    v_clean_reason TEXT;
    v_audit_id UUID;
BEGIN
    -- 1. Authorization check
    IF v_caller_id IS NOT NULL THEN
        SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
        IF v_caller_role NOT IN ('admin', 'teacher') THEN
            RAISE EXCEPTION 'Unauthorized: only teachers or administrators can unmark attendance.' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 2. Reason is optional, default if empty
    v_clean_reason := TRIM(COALESCE(p_reason, ''));
    IF v_clean_reason = '' THEN
        v_clean_reason := 'Attendance unmarked by teacher';
    END IF;

    -- 3. Lock attendance record exclusively FOR UPDATE
    SELECT * INTO v_attendance
    FROM public.attendance
    WHERE id = p_attendance_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Attendance record not found: %', p_attendance_id USING ERRCODE = 'P0002';
    END IF;

    -- Classroom ownership validation for teachers
    IF v_caller_id IS NOT NULL AND v_caller_role = 'teacher' THEN
        IF NOT public.can_manage_classroom_attendance(v_attendance.classroom_id, v_caller_id) THEN
            RAISE EXCEPTION 'Unauthorized: teachers can only unmark attendance for their assigned classrooms.' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 4. Lock student record for balance recalculation
    SELECT fees_classes_paid INTO v_balance_before
    FROM public.users
    WHERE id = v_attendance.student_id
    FOR UPDATE;

    -- 5. Detect completed or forfeited makeup (fail-closed protection)
    SELECT EXISTS (
        SELECT 1 FROM public.session_student_overrides sso
        JOIN public.attendance a ON a.student_id = sso.student_id 
                                AND a.classroom_id = sso.target_classroom_id 
                                AND a.date = sso.override_date
        WHERE sso.student_id = v_attendance.student_id 
          AND sso.missed_session_date = v_attendance.date
          AND a.status IN ('present', 'late', 'absent')
    ) INTO v_has_completed_makeup;

    IF v_attendance.status = 'excused' AND v_has_completed_makeup THEN
        RAISE EXCEPTION 'Cannot unmark attendance: student has already attended or completed makeup class for date %', v_attendance.date
            USING ERRCODE = '23514';
    END IF;

    -- 6. Cancel active scheduled makeup booking if unmarking an excused absence
    IF v_attendance.status = 'excused' THEN
        SELECT id INTO v_scheduled_override_id
        FROM public.session_student_overrides
        WHERE student_id = v_attendance.student_id
          AND missed_session_date = v_attendance.date
          AND credit_treatment = 'makeup'
          AND booking_status = 'scheduled'
        LIMIT 1;

        IF v_scheduled_override_id IS NOT NULL THEN
            UPDATE public.session_student_overrides
            SET booking_status = 'cancelled',
                reason = COALESCE(reason, '') || ' [Auto-cancelled: Original attendance unmarked with reason: ' || v_clean_reason || ']'
            WHERE id = v_scheduled_override_id;
        END IF;

        -- Reconcile related leave request to rejected
        SELECT id INTO v_related_leave_id
        FROM public.leave_requests
        WHERE student_id = v_attendance.student_id
          AND class_date = v_attendance.date
        LIMIT 1;

        IF v_related_leave_id IS NOT NULL THEN
            UPDATE public.leave_requests
            SET status = 'rejected',
                updated_at = NOW()
            WHERE id = v_related_leave_id;
        END IF;
    END IF;

    -- 7. Calculate financial effect: refund 1 credit if it had deducted a credit
    IF v_attendance.credit_deducted > 0 THEN
        v_net_adjustment := 1;
    ELSE
        v_net_adjustment := 0;
    END IF;

    -- 8. Write immutable audit log
    INSERT INTO public.attendance_correction_audit_logs (
        attendance_id,
        student_id,
        classroom_id,
        class_date,
        previous_status,
        new_status,
        actor_id,
        actor_role,
        correction_reason,
        previous_credit_deducted,
        new_credit_deducted,
        net_credit_adjustment,
        related_leave_id,
        related_override_id
    ) VALUES (
        v_attendance.id,
        v_attendance.student_id,
        v_attendance.classroom_id,
        v_attendance.date,
        v_attendance.status,
        'unmarked',
        v_caller_id,
        v_caller_role,
        v_clean_reason,
        v_attendance.credit_deducted,
        0,
        v_net_adjustment,
        v_related_leave_id,
        v_scheduled_override_id
    )
    RETURNING id INTO v_audit_id;

    -- 9. Delete attendance record with transaction context flag set
    PERFORM set_config('kfa.in_audited_attendance_correction', 'true', true);

    DELETE FROM public.attendance
    WHERE id = p_attendance_id;

    -- Trigger sync_attendance_fees handles fees_classes_paid refund on delete
    SELECT fees_classes_paid INTO v_balance_before
    FROM public.users
    WHERE id = v_attendance.student_id;

    RETURN jsonb_build_object(
        'success', true,
        'audit_id', v_audit_id,
        'audit_log_id', v_audit_id,
        'attendance_id', p_attendance_id,
        'student_id', v_attendance.student_id,
        'classroom_id', v_attendance.classroom_id,
        'session_date', v_attendance.date,
        'class_date', v_attendance.date,
        'previous_status', v_attendance.status,
        'new_status', 'unmarked',
        'previous_credit_deducted', v_attendance.credit_deducted,
        'new_credit_deducted', 0,
        'credit_delta', v_net_adjustment,
        'net_credit_adjustment', v_net_adjustment,
        'balance_before', v_balance_before,
        'balance_after', v_balance_before
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.correct_historical_attendance(UUID, TEXT, TEXT, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unmark_historical_attendance(UUID, TEXT) TO authenticated, service_role;

-- 5. Ensure notifications INSERT policy and type check constraint permit classroom notifications
DROP POLICY IF EXISTS "Authenticated users insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (true);

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN ('reminder', 'live_class', 'messages', 'tasks', 'task', 'classroom', 'curriculum', 'attendance', 'fees', 'community', 'feedback', 'other')
);

COMMIT;
