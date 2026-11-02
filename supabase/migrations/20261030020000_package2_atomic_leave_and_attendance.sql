-- Migration: Package 2 - Atomic Leave & Attendance Synchronization and Audited Correction
-- Local PostgreSQL 17 Implementation

-- 1. Create append-only leave_correction_audit_logs table
CREATE TABLE IF NOT EXISTS public.leave_correction_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leave_id UUID NOT NULL REFERENCES public.leave_requests(id) ON DELETE RESTRICT,
    student_id UUID NOT NULL REFERENCES public.users(id),
    actor_id UUID NOT NULL REFERENCES public.users(id),
    previous_leave_status TEXT NOT NULL,
    new_leave_status TEXT NOT NULL,
    previous_attendance_status TEXT,
    new_attendance_status TEXT,
    credit_delta INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leave_correction_audit_logs_leave_id ON public.leave_correction_audit_logs(leave_id);
CREATE INDEX IF NOT EXISTS idx_leave_correction_audit_logs_student_id ON public.leave_correction_audit_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_leave_correction_audit_logs_actor_id ON public.leave_correction_audit_logs(actor_id);

-- Enforce strict append-only immutability on leave correction audit logs
CREATE OR REPLACE FUNCTION public.prevent_leave_correction_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_setting('kfa.allow_audit_log_cleanup', true) = 'true' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'leave_correction_audit_logs records are strictly append-only and cannot be modified or deleted.'
        USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_leave_correction_audit_logs_immutable ON public.leave_correction_audit_logs;
CREATE TRIGGER trg_leave_correction_audit_logs_immutable
BEFORE UPDATE OR DELETE ON public.leave_correction_audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_leave_correction_audit_mutation();

-- 2. Partial unique index to prevent duplicate or conflicting active leave requests for same student and date
CREATE UNIQUE INDEX IF NOT EXISTS idx_leave_requests_student_date_active
ON public.leave_requests(student_id, class_date)
WHERE status IN ('pending', 'approved');

-- 3. Validation Trigger for Leave Requests: enforce same-day/past-date rejection, transitions & authorization
CREATE OR REPLACE FUNCTION public.enforce_leave_request_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_today_kolkata DATE;
BEGIN
    -- Check role if caller is authenticated
    IF v_caller_id IS NOT NULL THEN
        SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;

        -- On INSERT, students can only request leave for themselves
        IF TG_OP = 'INSERT' THEN
            IF v_caller_role = 'student' AND NEW.student_id <> v_caller_id THEN
                RAISE EXCEPTION 'Unauthorized: students can only submit leave requests for themselves' USING ERRCODE = '42501';
            ELSIF v_caller_role NOT IN ('admin', 'teacher', 'student') THEN
                RAISE EXCEPTION 'Unauthorized: caller role not permitted to submit leave requests' USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    -- Validate calendar date on INSERT (same-day and past-date requests are rejected in Asia/Kolkata)
    IF TG_OP = 'INSERT' THEN
        IF NEW.status = 'pending' THEN
            v_today_kolkata := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;
            IF NEW.class_date <= v_today_kolkata THEN
                RAISE EXCEPTION 'Same-day and past-date leave requests are prohibited. Leaves must be requested in advance of the scheduled class calendar date.'
                    USING ERRCODE = '22023';
            END IF;
        END IF;

        -- Validate student role
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.student_id AND role = 'student') THEN
            RAISE EXCEPTION 'Invalid student: user % does not exist or is not a student', NEW.student_id USING ERRCODE = '22023';
        END IF;

        -- Validate classroom exists
        IF NOT EXISTS (SELECT 1 FROM public.classrooms WHERE id = NEW.classroom_id) THEN
            RAISE EXCEPTION 'Invalid classroom: classroom % does not exist', NEW.classroom_id USING ERRCODE = '22023';
        END IF;
    END IF;

    -- Validate state transitions on UPDATE
    IF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'approved' AND NEW.status = 'pending' THEN
            RAISE EXCEPTION 'Invalid leave status transition: cannot revert approved leave to pending' USING ERRCODE = '22023';
        END IF;
        IF OLD.status = 'rejected' AND NEW.status = 'pending' THEN
            RAISE EXCEPTION 'Invalid leave status transition: cannot revert rejected leave to pending' USING ERRCODE = '22023';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_leave_request_rules ON public.leave_requests;
CREATE TRIGGER trg_enforce_leave_request_rules
BEFORE INSERT OR UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_leave_request_rules();

-- 4. Atomic Leave Approval RPC
CREATE OR REPLACE FUNCTION public.approve_student_leave(p_leave_id UUID)
RETURNS public.leave_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_leave public.leave_requests%ROWTYPE;
    v_attendance public.attendance%ROWTYPE;
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
BEGIN
    -- 1. Authentication & authorization check
    IF v_caller_id IS NOT NULL THEN
        SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
        IF v_caller_role NOT IN ('admin', 'teacher') THEN
            RAISE EXCEPTION 'Unauthorized: only teachers or admins can approve leave requests.' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 2. Lock leave request row exclusively
    SELECT * INTO v_leave
    FROM public.leave_requests
    WHERE id = p_leave_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Leave request not found: %', p_leave_id USING ERRCODE = 'P0002';
    END IF;

    -- 3. Idempotency guard: if already approved, return without double-processing
    IF v_leave.status = 'approved' THEN
        RETURN v_leave;
    END IF;

    IF v_leave.status <> 'pending' THEN
        RAISE EXCEPTION 'Cannot approve leave request with status: %', v_leave.status USING ERRCODE = '22023';
    END IF;

    -- 4. Check for conflicting attendance record on (student_id, classroom_id, class_date)
    SELECT * INTO v_attendance
    FROM public.attendance
    WHERE student_id = v_leave.student_id
      AND classroom_id = v_leave.classroom_id
      AND date = v_leave.class_date
    FOR UPDATE;

    IF FOUND THEN
        IF v_attendance.status IN ('present', 'late') THEN
            RAISE EXCEPTION 'Cannot approve leave: conflicting % attendance already recorded for student on %',
                v_attendance.status, v_leave.class_date
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- 5. Mark leave request approved
    UPDATE public.leave_requests
    SET status = 'approved',
        updated_at = now()
    WHERE id = p_leave_id
    RETURNING * INTO v_leave;

    -- 6. Synchronize original attendance as 'excused' (which triggers credit_deducted = 0)
    IF v_attendance.id IS NOT NULL THEN
        UPDATE public.attendance
        SET status = 'excused',
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
            'excused',
            v_caller_id,
            false
        );
    END IF;

    RETURN v_leave;
END;
$$;

-- 5. Read-Only Preview of Historical Leave Correction (Admin Only)
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
    -- 1. Authorization: Administrator only
    IF v_caller_id IS NOT NULL THEN
        SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
        IF v_caller_role <> 'admin' THEN
            RAISE EXCEPTION 'Unauthorized: only administrators can preview leave corrections.' USING ERRCODE = '42501';
        END IF;
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
    -- Transitioning attendance from excused (0 credits) to absent/present (1 credit) results in -1 balance delta
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

-- 6. Atomic Execution of Historical Leave Correction (Admin Only, Audited)
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
    -- 1. Authorization: Administrator only
    IF v_caller_id IS NOT NULL THEN
        SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
        IF v_caller_role <> 'admin' THEN
            RAISE EXCEPTION 'Unauthorized: only administrators can execute leave corrections.' USING ERRCODE = '42501';
        END IF;
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

    -- 5. Detect completed or forfeited makeup class (protect historical completion)
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

    -- Remove any uncompleted / pending makeup override for this missed date
    DELETE FROM public.session_student_overrides
    WHERE student_id = v_leave.student_id 
      AND missed_session_date = v_leave.class_date;

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
        'credit_delta', v_actual_delta,
        'balance_before', v_student_balance_before,
        'balance_after', v_student_balance_after,
        'reason', TRIM(p_reason)
    );
END;
$$;

-- 7. Revoke PUBLIC execution and explicitly grant permissions
REVOKE ALL ON FUNCTION public.approve_student_leave(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.preview_leave_correction(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_leave_correction(UUID, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT EXECUTE ON FUNCTION public.approve_student_leave(UUID) TO authenticated;
        GRANT EXECUTE ON FUNCTION public.preview_leave_correction(UUID, TEXT, TEXT) TO authenticated;
        GRANT EXECUTE ON FUNCTION public.execute_leave_correction(UUID, TEXT, TEXT, INTEGER, TEXT) TO authenticated;
        GRANT SELECT ON public.leave_correction_audit_logs TO authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT EXECUTE ON FUNCTION public.approve_student_leave(UUID) TO service_role;
        GRANT EXECUTE ON FUNCTION public.preview_leave_correction(UUID, TEXT, TEXT) TO service_role;
        GRANT EXECUTE ON FUNCTION public.execute_leave_correction(UUID, TEXT, TEXT, INTEGER, TEXT) TO service_role;
        GRANT ALL ON public.leave_correction_audit_logs TO service_role;
    END IF;
END $$;
