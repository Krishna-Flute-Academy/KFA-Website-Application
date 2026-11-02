-- ============================================================================
-- KFA Package 4.1: Security & Financial Integrity Hardening
-- Closes authentication gaps, hardens audit immutability against bypasses,
-- and introduces transactional reject RPCs for payments and leave requests.
-- ============================================================================

-- 1. Hardened Audit Log Mutation Guards
-- Ensures kfa.allow_audit_log_cleanup can ONLY be used by direct superuser
-- sessions (session_user = 'postgres' and no application JWT claim), completely
-- preventing authenticated or anonymous web users from bypassing audit immutability.

CREATE OR REPLACE FUNCTION public.prevent_fees_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF session_user = 'postgres' 
       AND current_user = 'postgres' 
       AND current_setting('request.jwt.claim.role', true) IS NULL 
       AND current_setting('kfa.allow_audit_log_cleanup', true) = 'true' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'fees_payment_audit_logs records are strictly append-only and cannot be modified or deleted.'
        USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_leave_correction_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF session_user = 'postgres' 
       AND current_user = 'postgres' 
       AND current_setting('request.jwt.claim.role', true) IS NULL 
       AND current_setting('kfa.allow_audit_log_cleanup', true) = 'true' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'leave_correction_audit_logs records are strictly append-only and cannot be modified or deleted.'
        USING ERRCODE = '42501';
END;
$$;

-- 2. Reject Fee Payment Transactional RPC
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
BEGIN
    -- Authentication check: caller must be authenticated
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    -- Authorization check
    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or admins can reject fee payments' USING ERRCODE = '42501';
    END IF;

    -- Lock payment row exclusively
    SELECT * INTO v_payment
    FROM public.fees_payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment record not found: %', p_payment_id USING ERRCODE = 'P0002';
    END IF;

    IF v_payment.status <> 'pending_approval' THEN
        RAISE EXCEPTION 'Invalid payment transition: only pending_approval payments can be rejected, current status is %', v_payment.status USING ERRCODE = '22023';
    END IF;

    UPDATE public.fees_payments
    SET status = 'rejected',
        notes = CASE WHEN p_reason IS NOT NULL AND TRIM(p_reason) <> '' 
                     THEN COALESCE(notes || E'\n[Rejected]: ' || TRIM(p_reason), '[Rejected]: ' || TRIM(p_reason))
                     ELSE notes END
    WHERE id = p_payment_id
    RETURNING * INTO v_payment;

    -- Audit log entry
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
        COALESCE(p_reason, 'Payment marked not received by staff')
    );

    RETURN v_payment;
END;
$$;

-- 3. Reject Student Leave Transactional RPC
CREATE OR REPLACE FUNCTION public.reject_student_leave(
    p_leave_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS public.leave_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_leave public.leave_requests%ROWTYPE;
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
BEGIN
    -- Authentication check: caller must be authenticated
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    -- Authorization check
    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or admins can reject leave requests' USING ERRCODE = '42501';
    END IF;

    -- Lock leave row exclusively
    SELECT * INTO v_leave
    FROM public.leave_requests
    WHERE id = p_leave_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Leave request not found: %', p_leave_id USING ERRCODE = 'P0002';
    END IF;

    IF v_leave.status <> 'pending' THEN
        RAISE EXCEPTION 'Invalid leave transition: only pending leave requests can be rejected via reject_student_leave. Current status: %', v_leave.status USING ERRCODE = '22023';
    END IF;

    UPDATE public.leave_requests
    SET status = 'rejected',
        reason = CASE WHEN p_reason IS NOT NULL AND TRIM(p_reason) <> '' 
                      THEN COALESCE(reason || E' [Staff Rejection: ' || TRIM(p_reason) || ']', '[Staff Rejection: ' || TRIM(p_reason) || ']')
                      ELSE reason END,
        updated_at = now()
    WHERE id = p_leave_id
    RETURNING * INTO v_leave;

    RETURN v_leave;
END;
$$;

-- 4. Hardened Authentication Checks on Leave & Makeup RPCs
-- Reject null auth.uid() explicitly with ERRCODE 28000 (Authentication Required)

CREATE OR REPLACE FUNCTION public.approve_student_leave(
    p_leave_id UUID
)
RETURNS public.leave_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_leave public.leave_requests%ROWTYPE;
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_existing_att public.attendance%ROWTYPE;
BEGIN
    -- 1. Authentication check
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    -- Authorization check
    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or admins can approve leave requests.' USING ERRCODE = '42501';
    END IF;

    -- 2. Lock leave request row
    SELECT * INTO v_leave
    FROM public.leave_requests
    WHERE id = p_leave_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Leave request not found: %', p_leave_id USING ERRCODE = 'P0002';
    END IF;

    -- If already approved, return idempotently
    IF v_leave.status = 'approved' THEN
        RETURN v_leave;
    END IF;

    -- 3. Check for conflicting attendance record
    SELECT * INTO v_existing_att
    FROM public.attendance
    WHERE student_id = v_leave.student_id
      AND classroom_id = v_leave.classroom_id
      AND date = v_leave.class_date;

    IF FOUND AND v_existing_att.status IN ('present', 'late') THEN
        RAISE EXCEPTION 'Cannot approve leave: conflicting present attendance already recorded for student on %', v_leave.class_date
            USING ERRCODE = '23514';
    END IF;

    -- 4. Update leave request status to 'approved'
    UPDATE public.leave_requests
    SET status = 'approved',
        updated_at = now()
    WHERE id = p_leave_id
    RETURNING * INTO v_leave;

    -- 5. Upsert attendance record with status 'excused' (credit deduction = 0)
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
        'excused',
        v_caller_id,
        false
    )
    ON CONFLICT (student_id, classroom_id, date) DO UPDATE
    SET status = 'excused',
        marked_by = EXCLUDED.marked_by;

    RETURN v_leave;
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_leave_correction(
    p_leave_id UUID,
    p_target_status TEXT DEFAULT 'rejected',
    p_target_attendance_status TEXT DEFAULT 'absent'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_leave public.leave_requests%ROWTYPE;
    v_attendance public.attendance%ROWTYPE;
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_student_name TEXT;
    v_current_balance INTEGER;
    v_has_completed_makeup BOOLEAN := false;
    v_can_execute BOOLEAN := true;
    v_block_reason TEXT := NULL;
    v_projected_delta INTEGER := 0;
BEGIN
    -- 1. Authentication check
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    -- Authorization: Administrator only
    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role <> 'admin' THEN
        RAISE EXCEPTION 'Unauthorized: only administrators can preview leave corrections.' USING ERRCODE = '42501';
    END IF;

    -- 2. Fetch leave request
    SELECT * INTO v_leave
    FROM public.leave_requests
    WHERE id = p_leave_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Leave request not found: %', p_leave_id USING ERRCODE = 'P0002';
    END IF;

    SELECT name, fees_classes_paid INTO v_student_name, v_current_balance
    FROM public.users
    WHERE id = v_leave.student_id;

    -- 3. Fetch current attendance record
    SELECT * INTO v_attendance
    FROM public.attendance
    WHERE student_id = v_leave.student_id
      AND classroom_id = v_leave.classroom_id
      AND date = v_leave.class_date;

    -- 4. Check if student already attended or completed makeup for this missed date
    SELECT EXISTS (
        SELECT 1 FROM public.session_student_overrides sso
        JOIN public.attendance a ON a.student_id = sso.student_id 
                                AND a.classroom_id = sso.target_classroom_id 
                                AND a.date = sso.override_date
        WHERE sso.student_id = v_leave.student_id 
          AND sso.missed_session_date = v_leave.class_date
          AND a.status IN ('present', 'late')
    ) INTO v_has_completed_makeup;

    IF v_has_completed_makeup THEN
        v_can_execute := false;
        v_block_reason := 'Student has already attended or completed makeup class for date ' || v_leave.class_date::text;
    ELSIF v_leave.status = p_target_status THEN
        v_can_execute := false;
        v_block_reason := 'Leave request is already in status ' || p_target_status;
    END IF;

    -- 5. Calculate projected financial delta
    IF COALESCE(v_attendance.status, 'excused') = 'excused' AND p_target_attendance_status IN ('absent', 'present', 'late') THEN
        v_projected_delta := -1;
    ELSIF COALESCE(v_attendance.status, 'absent') IN ('absent', 'present', 'late') AND p_target_attendance_status = 'excused' THEN
        v_projected_delta := 1;
    ELSE
        v_projected_delta := 0;
    END IF;

    RETURN jsonb_build_object(
        'leave_id', v_leave.id,
        'student_id', v_leave.student_id,
        'student_name', v_student_name,
        'classroom_id', v_leave.classroom_id,
        'class_date', v_leave.class_date,
        'current_leave_status', v_leave.status,
        'target_leave_status', p_target_status,
        'current_attendance_status', v_attendance.status,
        'target_attendance_status', p_target_attendance_status,
        'current_balance', v_current_balance,
        'projected_credit_delta', v_projected_delta,
        'projected_new_balance', v_current_balance + v_projected_delta,
        'has_completed_makeup', v_has_completed_makeup,
        'can_execute', v_can_execute,
        'blocking_reason', v_block_reason
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.execute_leave_correction(
    p_leave_id UUID,
    p_target_status TEXT,
    p_target_attendance_status TEXT,
    p_authorized_credit_delta INTEGER,
    p_reason TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_leave public.leave_requests%ROWTYPE;
    v_attendance public.attendance%ROWTYPE;
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_has_completed_makeup BOOLEAN;
    v_actual_delta INTEGER;
    v_student_balance_before INTEGER;
    v_student_balance_after INTEGER;
BEGIN
    -- 1. Authentication check
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    -- Authorization: Administrator only
    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role <> 'admin' THEN
        RAISE EXCEPTION 'Unauthorized: only administrators can execute leave corrections.' USING ERRCODE = '42501';
    END IF;

    -- 2. Non-empty reason required
    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RAISE EXCEPTION 'A valid non-empty reason is required for leave correction' USING ERRCODE = '22023';
    END IF;

    -- 3. Lock leave request row exclusively
    SELECT * INTO v_leave
    FROM public.leave_requests
    WHERE id = p_leave_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Leave request not found: %', p_leave_id USING ERRCODE = 'P0002';
    END IF;

    IF v_leave.status = p_target_status THEN
        RAISE EXCEPTION 'Leave request is already in status %', p_target_status USING ERRCODE = '22023';
    END IF;

    -- 4. Lock attendance record
    SELECT * INTO v_attendance
    FROM public.attendance
    WHERE student_id = v_leave.student_id
      AND classroom_id = v_leave.classroom_id
      AND date = v_leave.class_date
    FOR UPDATE;

    -- 5. Detect completed or forfeited makeup class
    SELECT EXISTS (
        SELECT 1 FROM public.session_student_overrides sso
        JOIN public.attendance a ON a.student_id = sso.student_id 
                                AND a.classroom_id = sso.target_classroom_id 
                                AND a.date = sso.override_date
        WHERE sso.student_id = v_leave.student_id 
          AND sso.missed_session_date = v_leave.class_date
          AND a.status IN ('present', 'late')
    ) INTO v_has_completed_makeup;

    IF v_has_completed_makeup THEN
        RAISE EXCEPTION 'Cannot correct leave: student has already attended makeup class for date %', v_leave.class_date
            USING ERRCODE = '23514';
    END IF;

    -- 6. Recalculate actual credit delta under database locks
    v_actual_delta := CASE
        WHEN COALESCE(v_attendance.status, 'excused') = 'excused' AND p_target_attendance_status IN ('absent', 'present', 'late') THEN -1
        WHEN COALESCE(v_attendance.status, 'absent') IN ('absent', 'present', 'late') AND p_target_attendance_status = 'excused' THEN 1
        ELSE 0
    END;

    -- 7. Verify actual delta strictly matches explicitly authorized delta
    IF v_actual_delta <> p_authorized_credit_delta THEN
        RAISE EXCEPTION 'Authorized credit delta mismatch: authorized delta % does not match calculated delta %',
            p_authorized_credit_delta, v_actual_delta USING ERRCODE = '22023';
    END IF;

    SELECT fees_classes_paid INTO v_student_balance_before
    FROM public.users WHERE id = v_leave.student_id;

    -- 8. Apply corrections atomically
    UPDATE public.leave_requests
    SET status = p_target_status,
        updated_at = now()
    WHERE id = p_leave_id;

    IF v_attendance.id IS NOT NULL THEN
        UPDATE public.attendance
        SET status = p_target_attendance_status,
            marked_by = v_caller_id
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

    -- Cancel any uncompleted scheduled makeup override for this missed date
    UPDATE public.session_student_overrides
    SET booking_status = 'cancelled',
        reason = COALESCE(reason || E' [Cancelled by leave correction: ' || TRIM(p_reason) || ']', 'Cancelled by leave correction')
    WHERE student_id = v_leave.student_id 
      AND missed_session_date = v_leave.class_date
      AND booking_status = 'scheduled';

    SELECT fees_classes_paid INTO v_student_balance_after
    FROM public.users WHERE id = v_leave.student_id;

    -- 9. Persist immutable audit record
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
        v_caller_id,
        v_leave.status,
        p_target_status,
        v_attendance.status,
        p_target_attendance_status,
        v_actual_delta,
        p_reason
    );

    RETURN jsonb_build_object(
        'success', true,
        'leave_id', p_leave_id,
        'student_id', v_leave.student_id,
        'previous_leave_status', v_leave.status,
        'new_leave_status', p_target_status,
        'previous_attendance_status', v_attendance.status,
        'new_attendance_status', p_target_attendance_status,
        'credit_delta', v_actual_delta,
        'previous_balance', v_student_balance_before,
        'new_balance', v_student_balance_after,
        'balance_before', v_student_balance_before,
        'balance_after', v_student_balance_after,
        'student_balance_before', v_student_balance_before,
        'student_balance_after', v_student_balance_after
    );
END;
$$;

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
    v_orig_classroom_id UUID := p_original_classroom_id;
    v_reason TEXT;
    v_override public.session_student_overrides%ROWTYPE;
BEGIN
    -- 1. Authentication check
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    -- Authorization check
    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or admins can book makeup sessions.' USING ERRCODE = '42501';
    END IF;

    -- 2. Validate input parameters
    IF p_student_id IS NULL OR p_target_classroom_id IS NULL OR p_override_date IS NULL OR p_missed_session_date IS NULL THEN
        RAISE EXCEPTION 'Missing required parameters for booking makeup session' USING ERRCODE = '22023';
    END IF;

    -- 3. Resolve original classroom if null
    IF v_orig_classroom_id IS NULL THEN
        SELECT classroom_id INTO v_orig_classroom_id
        FROM public.attendance
        WHERE student_id = p_student_id AND date = p_missed_session_date
        LIMIT 1;

        IF v_orig_classroom_id IS NULL THEN
            SELECT classroom_id INTO v_orig_classroom_id
            FROM public.leave_requests
            WHERE student_id = p_student_id AND class_date = p_missed_session_date
            LIMIT 1;
        END IF;
    END IF;

    -- 4. Check for completed or forfeited makeup for this missed session
    SELECT booking_status INTO v_existing_status
    FROM public.session_student_overrides
    WHERE student_id = p_student_id
      AND missed_session_date = p_missed_session_date
      AND (original_classroom_id IS NULL OR v_orig_classroom_id IS NULL OR original_classroom_id = v_orig_classroom_id)
      AND booking_status IN ('completed', 'forfeited')
    LIMIT 1;

    IF v_existing_status = 'completed' THEN
        RAISE EXCEPTION 'Cannot book makeup: entitlement for missed session % has already been completed.', p_missed_session_date USING ERRCODE = '23514';
    ELSIF v_existing_status = 'forfeited' THEN
        RAISE EXCEPTION 'Cannot book makeup: entitlement for missed session % has been forfeited.', p_missed_session_date USING ERRCODE = '23514';
    END IF;

    -- 5. Check if active booking already exists
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

    -- 6. Billing cycle due date check (Asia/Kolkata)
    v_next_due_date := public.calculate_student_next_due_date(p_student_id, p_missed_session_date);
    IF v_next_due_date IS NOT NULL AND p_override_date >= v_next_due_date THEN
        RAISE EXCEPTION 'Makeup date % must be strictly before student next billing due date % (Asia/Kolkata)',
            p_override_date, v_next_due_date USING ERRCODE = '22023';
    END IF;

    -- 7. Construct reason tag
    v_reason := '[MissedDate:' || p_missed_session_date::TEXT || '] ' || COALESCE(p_notes, 'Makeup session');

    -- 8. Insert new override record
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

    RETURN v_override;
END;
$$;

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
    v_reason TEXT;
BEGIN
    -- 1. Authentication check
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    -- Authorization check
    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or admins can reschedule makeup sessions.' USING ERRCODE = '42501';
    END IF;

    -- 2. Lock row
    SELECT * INTO v_override
    FROM public.session_student_overrides
    WHERE id = p_override_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Makeup booking not found: %', p_override_id USING ERRCODE = 'P0002';
    END IF;

    -- Cannot reschedule terminal states
    IF v_override.booking_status = 'completed' THEN
        RAISE EXCEPTION 'Cannot reschedule: makeup session has already been completed.' USING ERRCODE = '22023';
    ELSIF v_override.booking_status = 'forfeited' THEN
        RAISE EXCEPTION 'Cannot reschedule: makeup session has been forfeited.' USING ERRCODE = '22023';
    ELSIF v_override.booking_status = 'expired' THEN
        RAISE EXCEPTION 'Cannot reschedule: makeup session has expired.' USING ERRCODE = '22023';
    ELSIF v_override.booking_status = 'cancelled' THEN
        RAISE EXCEPTION 'Cannot reschedule: makeup session has been cancelled.' USING ERRCODE = '22023';
    END IF;

    -- 3. Billing cycle check
    v_next_due_date := public.calculate_student_next_due_date(v_override.student_id, v_override.missed_session_date);
    IF v_next_due_date IS NOT NULL AND p_new_override_date >= v_next_due_date THEN
        RAISE EXCEPTION 'Makeup date % must be strictly before student next billing due date % (Asia/Kolkata)',
            p_new_override_date, v_next_due_date USING ERRCODE = '22023';
    END IF;

    -- 4. Prepare updated reason tag
    v_reason := '[MissedDate:' || v_override.missed_session_date::TEXT || '] ' || COALESCE(p_notes, 'Rescheduled makeup session');

    -- 5. Update row in-place
    UPDATE public.session_student_overrides
    SET target_classroom_id = p_new_target_classroom_id,
        override_date = p_new_override_date,
        reason = v_reason,
        updated_at = now()
    WHERE id = p_override_id
    RETURNING * INTO v_override;

    RETURN v_override;
END;
$$;

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
BEGIN
    -- 1. Authentication check
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    -- Authorization check
    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or admins can cancel makeup sessions.' USING ERRCODE = '42501';
    END IF;

    -- 2. Lock row
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

    -- 3. Transition to 'cancelled' status
    UPDATE public.session_student_overrides
    SET booking_status = 'cancelled',
        reason = COALESCE(reason || E' [Cancelled: ' || TRIM(p_reason) || ']', 'Cancelled by staff'),
        updated_at = now()
    WHERE id = p_override_id
    RETURNING * INTO v_override;

    RETURN v_override;
END;
$$;

-- 5. Explicit Function Grants
GRANT EXECUTE ON FUNCTION public.reject_fee_payment(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_student_leave(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_student_leave(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.preview_leave_correction(UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.execute_leave_correction(UUID, TEXT, TEXT, INTEGER, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.book_makeup_session(UUID, UUID, DATE, DATE, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reschedule_makeup_session(UUID, UUID, DATE, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_makeup_session(UUID, TEXT) TO authenticated, service_role;
