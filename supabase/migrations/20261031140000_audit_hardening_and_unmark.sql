-- =====================================================================================
-- Migration: 20261031140000_audit_hardening_and_unmark.sql
-- Description: Batch 1.1 Critical Attendance Audit Hardening Patch
--              1. Defense-in-depth lock: Disallow direct UPDATE / DELETE on attendance.
--              2. RLS policy tightening: Deny direct UPDATE and DELETE for authenticated.
--              3. Authoritative audited unmarking RPC: unmark_historical_attendance().
--              4. Context flag integration into correct_historical_attendance & leave RPCs.
-- =====================================================================================

-- 1. Create Enforce Attendance Audit Lock Trigger Function
CREATE OR REPLACE FUNCTION public.enforce_attendance_audit_lock()
RETURNS TRIGGER AS $$
BEGIN
    -- If transaction context flag indicates an authorized audited workflow or test cleanup, permit the mutation
    IF current_setting('kfa.in_audited_attendance_correction', true) = 'true'
       OR current_setting('kfa.allow_audit_log_cleanup', true) = 'true' THEN
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;

    -- Block any direct DELETE outside of the audited unmarking RPC
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Direct attendance deletion is prohibited. Unmarking attendance must use unmark_historical_attendance().'
            USING ERRCODE = '42501';
    END IF;

    -- Block any direct UPDATE that alters attendance status or core session attributes
    IF TG_OP = 'UPDATE' THEN
        IF OLD.status IS DISTINCT FROM NEW.status 
           OR OLD.student_id IS DISTINCT FROM NEW.student_id 
           OR OLD.classroom_id IS DISTINCT FROM NEW.classroom_id 
           OR OLD.date IS DISTINCT FROM NEW.date THEN
            RAISE EXCEPTION 'Direct attendance modification is prohibited. Historical corrections must use correct_historical_attendance().'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to public.attendance
DROP TRIGGER IF EXISTS trg_enforce_attendance_audit_lock ON public.attendance;
CREATE TRIGGER trg_enforce_attendance_audit_lock
    BEFORE UPDATE OR DELETE ON public.attendance
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_attendance_audit_lock();

-- 2. Update RLS Policies on public.attendance
-- Drop foreign key cascade constraint on attendance_id so deleting attendance rows does not attempt to mutate or delete immutable audit logs
ALTER TABLE public.attendance_correction_audit_logs 
    DROP CONSTRAINT IF EXISTS attendance_correction_audit_logs_attendance_id_fkey;

DROP POLICY IF EXISTS "Admins and teachers manage attendance records" ON public.attendance;
DROP POLICY IF EXISTS "Admins and teachers insert attendance records" ON public.attendance;
DROP POLICY IF EXISTS "Deny direct attendance updates" ON public.attendance;
DROP POLICY IF EXISTS "Deny direct attendance deletes" ON public.attendance;

-- Allowed initial insert
CREATE POLICY "Admins and teachers insert attendance records"
ON public.attendance
FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_teacher());

-- Explicit denial of direct UPDATE
CREATE POLICY "Deny direct attendance updates"
ON public.attendance
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- Explicit denial of direct DELETE
CREATE POLICY "Deny direct attendance deletes"
ON public.attendance
FOR DELETE
TO authenticated
USING (false);

-- 3. Authoritative Audited Unmarking RPC: unmark_historical_attendance
CREATE OR REPLACE FUNCTION public.unmark_historical_attendance(
    p_attendance_id UUID,
    p_reason TEXT
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

    -- 2. Validate mandatory reason (min 3 chars)
    v_clean_reason := TRIM(COALESCE(p_reason, ''));
    IF LENGTH(v_clean_reason) < 3 THEN
        RAISE EXCEPTION 'A valid unmarking reason (minimum 3 characters) is required.' USING ERRCODE = '22023';
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
        'attendance_id', p_attendance_id,
        'student_id', v_attendance.student_id,
        'classroom_id', v_attendance.classroom_id,
        'session_date', v_attendance.date,
        'previous_status', v_attendance.status,
        'new_status', 'unmarked',
        'net_credit_adjustment', v_net_adjustment,
        'balance_before', v_balance_before - v_net_adjustment,
        'balance_after', v_balance_before
    );
END;
$$;

-- 4. Update correct_historical_attendance to set context flag before updating attendance
CREATE OR REPLACE FUNCTION public.correct_historical_attendance(
    p_attendance_id UUID,
    p_new_status TEXT,
    p_reason TEXT,
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

    -- 2. Validate mandatory reason (min 3 chars)
    v_clean_reason := TRIM(COALESCE(p_reason, ''));
    IF LENGTH(v_clean_reason) < 3 THEN
        RAISE EXCEPTION 'A valid correction reason (minimum 3 characters) is required.' USING ERRCODE = '22023';
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

-- 5. Drop obsolete 4-parameter overload if present
DROP FUNCTION IF EXISTS public.execute_leave_correction(UUID, TEXT, TEXT, INTEGER);

-- Update authoritative 5-parameter execute_leave_correction to set context flag before updating/inserting attendance
CREATE OR REPLACE FUNCTION public.execute_leave_correction(
    p_leave_id UUID,
    p_target_status TEXT,
    p_target_attendance_status TEXT,
    p_authorized_credit_delta INTEGER,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_leave public.leave_requests%ROWTYPE;
    v_attendance public.attendance%ROWTYPE;
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT := 'admin';
    v_has_completed_makeup BOOLEAN;
    v_actual_delta INTEGER;
    v_student_balance_before INTEGER;
    v_student_balance_after INTEGER;
BEGIN
    -- Authorization: Admin or Assigned Teacher
    IF v_caller_id IS NOT NULL THEN
        SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
        IF v_caller_role NOT IN ('admin', 'teacher') THEN
            RAISE EXCEPTION 'Unauthorized: only teachers or administrators can execute leave corrections.' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- Non-empty reason required
    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RAISE EXCEPTION 'A valid non-empty reason is required for leave correction' USING ERRCODE = '22023';
    END IF;

    -- Lock leave request row exclusively
    SELECT * INTO v_leave
    FROM public.leave_requests
    WHERE id = p_leave_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Leave request not found: %', p_leave_id USING ERRCODE = 'P0002';
    END IF;

    -- Assigned teacher validation
    IF v_caller_id IS NOT NULL AND v_caller_role = 'teacher' THEN
        IF NOT public.can_manage_classroom_attendance(v_leave.classroom_id, v_caller_id) THEN
            RAISE EXCEPTION 'Unauthorized: teachers can only execute leave corrections for their assigned classrooms.' USING ERRCODE = '42501';
        END IF;
    END IF;

    IF v_leave.status = p_target_status THEN
        RAISE EXCEPTION 'Leave request is already in status %', p_target_status USING ERRCODE = '22023';
    END IF;

    -- Lock attendance record
    SELECT * INTO v_attendance
    FROM public.attendance
    WHERE student_id = v_leave.student_id
      AND classroom_id = v_leave.classroom_id
      AND date = v_leave.class_date
    FOR UPDATE;

    -- Detect completed or forfeited makeup class (BR-13 Option C fail-closed)
    SELECT EXISTS (
        SELECT 1 FROM public.session_student_overrides sso
        JOIN public.attendance a ON a.student_id = sso.student_id 
                                AND a.classroom_id = sso.target_classroom_id 
                                AND a.date = sso.override_date
        WHERE sso.student_id = v_leave.student_id 
          AND sso.missed_session_date = v_leave.class_date
          AND a.status IN ('present', 'late', 'absent')
    ) INTO v_has_completed_makeup;

    IF v_has_completed_makeup THEN
        RAISE EXCEPTION 'Cannot correct leave: student has already attended makeup class for date %', v_leave.class_date
            USING ERRCODE = '23514';
    END IF;

    -- Recalculate actual credit delta under database locks
    v_actual_delta := CASE
        WHEN COALESCE(v_attendance.status, 'excused') = 'excused' AND p_target_attendance_status IN ('absent', 'present', 'late') THEN -1
        WHEN COALESCE(v_attendance.status, 'absent') IN ('absent', 'present', 'late') AND p_target_attendance_status = 'excused' THEN 1
        ELSE 0
    END;

    IF v_actual_delta <> p_authorized_credit_delta THEN
        RAISE EXCEPTION 'Authorized credit delta mismatch: authorized delta % does not match calculated delta %',
            p_authorized_credit_delta, v_actual_delta USING ERRCODE = '22023';
    END IF;

    SELECT fees_classes_paid INTO v_student_balance_before
    FROM public.users WHERE id = v_leave.student_id;

    -- Apply corrections atomically
    UPDATE public.leave_requests
    SET status = p_target_status,
        updated_at = now()
    WHERE id = p_leave_id;

    -- Set context flag for audited attendance update/insert
    PERFORM set_config('kfa.in_audited_attendance_correction', 'true', true);

    IF v_attendance.id IS NOT NULL THEN
        UPDATE public.attendance
        SET status = p_target_attendance_status,
            marked_by = COALESCE(v_caller_id, marked_by)
        WHERE id = v_attendance.id;
    ELSE
        INSERT INTO public.attendance (
            student_id,
            classroom_id,
            date,
            status,
            marked_by,
            is_extra_class
        ) VALUES (
            v_leave.student_id,
            v_leave.classroom_id,
            v_leave.class_date,
            p_target_attendance_status,
            v_caller_id,
            false
        );
    END IF;

    -- Remove any uncompleted scheduled makeup override for this missed date
    DELETE FROM public.session_student_overrides
    WHERE student_id = v_leave.student_id 
      AND missed_session_date = v_leave.class_date
      AND booking_status = 'scheduled';

    SELECT fees_classes_paid INTO v_student_balance_after
    FROM public.users WHERE id = v_leave.student_id;

    -- Persist immutable leave correction audit log
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
        p_leave_id,
        v_leave.student_id,
        COALESCE(v_caller_id, v_leave.student_id),
        v_leave.status,
        p_target_status,
        v_attendance.status,
        p_target_attendance_status,
        v_actual_delta,
        TRIM(p_reason)
    );

    RETURN jsonb_build_object(
        'success', true,
        'leave_id', p_leave_id,
        'student_id', v_leave.student_id,
        'previous_status', v_leave.status,
        'new_status', p_target_status,
        'balance_before', v_student_balance_before,
        'balance_after', v_student_balance_after,
        'credit_delta', v_actual_delta
    );
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.unmark_historical_attendance(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.correct_historical_attendance(UUID, TEXT, TEXT, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.execute_leave_correction(UUID, TEXT, TEXT, INTEGER, TEXT) TO authenticated, service_role;
