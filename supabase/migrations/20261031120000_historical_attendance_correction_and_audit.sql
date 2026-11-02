-- ==============================================================================
-- Migration: 20261031120000_historical_attendance_correction_and_audit.sql
-- Description: Batch 1 — Historical Attendance Correction & Immutable Audit Engine
-- Conforms to BRS v1.0 BR-10, BR-11, BR-12, and BR-13.
--
-- Features:
-- 1. Create public.attendance_correction_audit_logs (Immutable append-only audit trail)
-- 2. Authorization helper: public.can_manage_classroom_attendance()
-- 3. Read-only preview RPC: public.preview_attendance_correction()
-- 4. Authoritative transactional correction RPC: public.correct_historical_attendance()
-- 5. Update preview_leave_correction & execute_leave_correction to permit assigned Teachers
-- 6. RPC public.get_attendance_correction_history()
-- ==============================================================================

-- 1. Create attendance_correction_audit_logs table
CREATE TABLE IF NOT EXISTS public.attendance_correction_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_id UUID NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.users(id),
    classroom_id UUID NOT NULL REFERENCES public.classrooms(id),
    class_date DATE NOT NULL,
    previous_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    actor_id UUID NOT NULL REFERENCES public.users(id),
    actor_role TEXT NOT NULL,
    correction_reason TEXT NOT NULL,
    previous_credit_deducted INTEGER NOT NULL,
    new_credit_deducted INTEGER NOT NULL,
    net_credit_adjustment INTEGER NOT NULL,
    related_leave_id UUID REFERENCES public.leave_requests(id) ON DELETE SET NULL,
    related_override_id UUID REFERENCES public.session_student_overrides(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance & audit lookups
CREATE INDEX IF NOT EXISTS idx_att_corr_audit_att_id ON public.attendance_correction_audit_logs(attendance_id);
CREATE INDEX IF NOT EXISTS idx_att_corr_audit_student_id ON public.attendance_correction_audit_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_att_corr_audit_classroom_id ON public.attendance_correction_audit_logs(classroom_id);
CREATE INDEX IF NOT EXISTS idx_att_corr_audit_actor_id ON public.attendance_correction_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_att_corr_audit_created ON public.attendance_correction_audit_logs(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.attendance_correction_audit_logs ENABLE ROW LEVEL SECURITY;

-- Immutability Guard: Strictly forbid UPDATE and DELETE on audit log records
CREATE OR REPLACE FUNCTION public.prevent_attendance_correction_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_setting('kfa.allow_audit_log_cleanup', true) = 'true' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'attendance_correction_audit_logs records are strictly append-only and cannot be modified or deleted.'
        USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_correction_audit_immutable ON public.attendance_correction_audit_logs;
CREATE TRIGGER trg_attendance_correction_audit_immutable
BEFORE UPDATE OR DELETE ON public.attendance_correction_audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_attendance_correction_audit_mutation();

-- RLS Policies
DROP POLICY IF EXISTS "Staff can read all attendance correction audit logs" ON public.attendance_correction_audit_logs;
CREATE POLICY "Staff can read all attendance correction audit logs" 
    ON public.attendance_correction_audit_logs 
    FOR SELECT TO authenticated 
    USING ((SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Students can view own attendance correction audit logs" ON public.attendance_correction_audit_logs;
CREATE POLICY "Students can view own attendance correction audit logs" 
    ON public.attendance_correction_audit_logs 
    FOR SELECT TO authenticated 
    USING (student_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Staff can insert attendance correction audit logs" ON public.attendance_correction_audit_logs;
CREATE POLICY "Staff can insert attendance correction audit logs" 
    ON public.attendance_correction_audit_logs 
    FOR INSERT TO authenticated 
    WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- 2. Helper function: Can caller manage classroom attendance?
-- Admin can manage all; Teacher can manage assigned classrooms
CREATE OR REPLACE FUNCTION public.can_manage_classroom_attendance(p_classroom_id UUID, p_caller_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role TEXT;
    v_teacher_id UUID;
BEGIN
    IF p_caller_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT role INTO v_role FROM public.users WHERE id = p_caller_id;

    IF v_role IN ('admin', 'super_admin') THEN
        RETURN TRUE;
    END IF;

    IF v_role = 'teacher' THEN
        SELECT teacher_id INTO v_teacher_id FROM public.classrooms WHERE id = p_classroom_id;
        RETURN (v_teacher_id = p_caller_id);
    END IF;

    RETURN FALSE;
END;
$$;

-- 3. Read-Only Preview RPC: preview_attendance_correction
CREATE OR REPLACE FUNCTION public.preview_attendance_correction(
    p_attendance_id UUID,
    p_new_status TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_attendance public.attendance%ROWTYPE;
    v_student_name TEXT;
    v_classroom_name TEXT;
    v_current_balance INTEGER;
    v_has_completed_makeup BOOLEAN := false;
    v_scheduled_override_id UUID := NULL;
    v_related_leave_id UUID := NULL;
    v_can_execute BOOLEAN := true;
    v_block_reason TEXT := NULL;
    v_projected_delta INTEGER := 0;
    v_clean_target_status TEXT;
BEGIN
    -- 1. Authentication check
    IF v_caller_id IS NOT NULL THEN
        SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
        IF v_caller_role NOT IN ('admin', 'teacher') THEN
            RAISE EXCEPTION 'Unauthorized: only teachers or admins can preview attendance corrections.' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 2. Fetch existing attendance row
    SELECT * INTO v_attendance
    FROM public.attendance
    WHERE id = p_attendance_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Attendance record not found: %', p_attendance_id USING ERRCODE = 'P0002';
    END IF;

    -- Classroom ownership validation for teachers
    IF v_caller_id IS NOT NULL AND v_caller_role = 'teacher' THEN
        IF NOT public.can_manage_classroom_attendance(v_attendance.classroom_id, v_caller_id) THEN
            RAISE EXCEPTION 'Unauthorized: teachers can only preview corrections for their assigned classrooms.' USING ERRCODE = '42501';
        END IF;
    END IF;

    v_clean_target_status := LOWER(TRIM(p_new_status));
    IF v_clean_target_status NOT IN ('present', 'absent', 'late', 'excused') THEN
        RAISE EXCEPTION 'Invalid target attendance status: %', p_new_status USING ERRCODE = '22023';
    END IF;

    -- Fetch student & classroom metadata
    SELECT name, fees_classes_paid INTO v_student_name, v_current_balance
    FROM public.users WHERE id = v_attendance.student_id;

    SELECT name INTO v_classroom_name
    FROM public.classrooms WHERE id = v_attendance.classroom_id;

    -- Check if target status is identical
    IF v_attendance.status = v_clean_target_status THEN
        v_can_execute := false;
        v_block_reason := 'Attendance is already recorded as ' || v_clean_target_status;
    END IF;

    -- Detect completed or forfeited makeup for this missed date
    SELECT EXISTS (
        SELECT 1 FROM public.session_student_overrides sso
        JOIN public.attendance a ON a.student_id = sso.student_id 
                                AND a.classroom_id = sso.target_classroom_id 
                                AND a.date = sso.override_date
        WHERE sso.student_id = v_attendance.student_id 
          AND sso.missed_session_date = v_attendance.date
          AND a.status IN ('present', 'late', 'absent')
    ) INTO v_has_completed_makeup;

    -- If current status is excused and target is credit-consuming (absent/present/late)
    -- but student already completed or forfeited makeup, block correction to preserve financial history!
    IF v_attendance.status = 'excused' AND v_clean_target_status IN ('present', 'late', 'absent') AND v_has_completed_makeup THEN
        v_can_execute := false;
        v_block_reason := 'Student has already attended or forfeited a makeup class for date ' || v_attendance.date::text || '. Reversing excused attendance would cause duplicate credit consumption.';
    END IF;

    -- Check for scheduled makeup override
    SELECT id INTO v_scheduled_override_id
    FROM public.session_student_overrides
    WHERE student_id = v_attendance.student_id
      AND missed_session_date = v_attendance.date
      AND credit_treatment = 'makeup'
      AND booking_status = 'scheduled'
    LIMIT 1;

    -- Check for related leave request
    SELECT id INTO v_related_leave_id
    FROM public.leave_requests
    WHERE student_id = v_attendance.student_id
      AND class_date = v_attendance.date
    LIMIT 1;

    -- Calculate projected financial delta
    IF v_attendance.credit_deducted > 0 AND v_clean_target_status = 'excused' THEN
        v_projected_delta := 1; -- Refund 1 credit
    ELSIF v_attendance.credit_deducted = 0 AND v_clean_target_status IN ('present', 'late', 'absent') THEN
        v_projected_delta := -1; -- Deduct 1 credit
    ELSE
        v_projected_delta := 0; -- No financial change
    END IF;

    RETURN jsonb_build_object(
        'attendance_id', v_attendance.id,
        'student_id', v_attendance.student_id,
        'student_name', v_student_name,
        'classroom_id', v_attendance.classroom_id,
        'classroom_name', v_classroom_name,
        'class_date', v_attendance.date,
        'previous_status', v_attendance.status,
        'new_status', v_clean_target_status,
        'previous_credit_deducted', v_attendance.credit_deducted,
        'projected_credit_delta', v_projected_delta,
        'current_balance', v_current_balance,
        'projected_new_balance', v_current_balance + v_projected_delta,
        'has_completed_makeup', v_has_completed_makeup,
        'has_active_makeup_booking', (v_scheduled_override_id IS NOT NULL),
        'scheduled_override_id', v_scheduled_override_id,
        'related_leave_id', v_related_leave_id,
        'can_execute', v_can_execute,
        'blocking_reason', v_block_reason
    );
END;
$$;

-- 4. Authoritative Transactional Correction RPC: correct_historical_attendance
CREATE OR REPLACE FUNCTION public.correct_historical_attendance(
    p_attendance_id UUID,
    p_new_status TEXT,
    p_reason TEXT,
    p_authorized_credit_delta INTEGER DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT := 'admin';
    v_attendance public.attendance%ROWTYPE;
    v_clean_status TEXT;
    v_has_completed_makeup BOOLEAN := false;
    v_scheduled_override_id UUID := NULL;
    v_cancelled_override_id UUID := NULL;
    v_leave_record public.leave_requests%ROWTYPE;
    v_reconciled_leave_id UUID := NULL;
    v_prev_credit_deducted INTEGER;
    v_new_credit_deducted INTEGER;
    v_actual_delta INTEGER;
    v_balance_before INTEGER;
    v_balance_after INTEGER;
    v_audit_id UUID;
BEGIN
    -- 1. Authentication & Role check
    IF v_caller_id IS NOT NULL THEN
        SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
        IF v_caller_role NOT IN ('admin', 'teacher') THEN
            RAISE EXCEPTION 'Unauthorized: only teachers or administrators can correct attendance.' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 2. Validate mandatory correction reason (minimum 3 non-whitespace characters)
    IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 3 THEN
        RAISE EXCEPTION 'A valid correction reason (minimum 3 characters) is required.' USING ERRCODE = '22023';
    END IF;

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
                updated_at = now(),
                reason = reason || ' [Cancelled due to attendance correction on ' || v_attendance.date::text || ']'
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
                updated_at = now()
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
                'Reconciled via historical attendance correction: ' || TRIM(p_reason)
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
                updated_at = now()
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
                'Approved via historical attendance correction: ' || TRIM(p_reason)
            );
        END IF;
    END IF;

    v_prev_credit_deducted := v_attendance.credit_deducted;

    -- 7. Calculate actual expected credit delta
    IF v_prev_credit_deducted > 0 AND v_clean_status = 'excused' THEN
        v_actual_delta := 1;
    ELSIF v_prev_credit_deducted = 0 AND v_clean_status IN ('present', 'late', 'absent') THEN
        v_actual_delta := -1;
    ELSE
        v_actual_delta := 0;
    END IF;

    -- If authorized credit delta was passed, verify exact match
    IF p_authorized_credit_delta IS NOT NULL AND v_actual_delta <> p_authorized_credit_delta THEN
        RAISE EXCEPTION 'Authorized credit delta mismatch: authorized delta % does not match calculated delta %',
            p_authorized_credit_delta, v_actual_delta USING ERRCODE = '22023';
    END IF;

    -- 8. Apply attendance update (Triggers compute_attendance_credit and sync_attendance_fees handle users.fees_classes_paid)
    UPDATE public.attendance
    SET status = v_clean_status,
        marked_by = COALESCE(v_caller_id, marked_by)
    WHERE id = p_attendance_id
    RETURNING credit_deducted INTO v_new_credit_deducted;

    -- Fetch refreshed balance
    SELECT fees_classes_paid INTO v_balance_after
    FROM public.users
    WHERE id = v_attendance.student_id;

    -- 9. Persist immutable attendance correction audit log (BR-12)
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
        related_override_id,
        metadata
    ) VALUES (
        p_attendance_id,
        v_attendance.student_id,
        v_attendance.classroom_id,
        v_attendance.date,
        v_attendance.status,
        v_clean_status,
        COALESCE(v_caller_id, v_attendance.student_id),
        v_caller_role,
        TRIM(p_reason),
        v_prev_credit_deducted,
        COALESCE(v_new_credit_deducted, 0),
        v_actual_delta,
        v_reconciled_leave_id,
        v_cancelled_override_id,
        jsonb_build_object(
            'balance_before', v_balance_before,
            'balance_after', v_balance_after,
            'has_completed_makeup', v_has_completed_makeup
        )
    ) RETURNING id INTO v_audit_id;

    -- Return comprehensive result
    RETURN jsonb_build_object(
        'success', true,
        'attendance_id', p_attendance_id,
        'student_id', v_attendance.student_id,
        'classroom_id', v_attendance.classroom_id,
        'class_date', v_attendance.date,
        'previous_status', v_attendance.status,
        'new_status', v_clean_status,
        'previous_credit_deducted', v_prev_credit_deducted,
        'new_credit_deducted', v_new_credit_deducted,
        'credit_delta', v_actual_delta,
        'previous_balance', v_balance_before,
        'new_balance', v_balance_after,
        'audit_log_id', v_audit_id,
        'cancelled_override_id', v_cancelled_override_id,
        'reconciled_leave_id', v_reconciled_leave_id
    );
END;
$$;

-- 5. Update preview_leave_correction & execute_leave_correction to allow assigned Teachers (BR-10)
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
    -- Authorization: Admin or Assigned Teacher
    IF v_caller_id IS NOT NULL THEN
        SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
        IF v_caller_role NOT IN ('admin', 'teacher') THEN
            RAISE EXCEPTION 'Unauthorized: only teachers or administrators can preview leave corrections.' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- Fetch leave request
    SELECT * INTO v_leave
    FROM public.leave_requests
    WHERE id = p_leave_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Leave request not found: %', p_leave_id USING ERRCODE = 'P0002';
    END IF;

    -- Assigned teacher validation
    IF v_caller_id IS NOT NULL AND v_caller_role = 'teacher' THEN
        IF NOT public.can_manage_classroom_attendance(v_leave.classroom_id, v_caller_id) THEN
            RAISE EXCEPTION 'Unauthorized: teachers can only preview leave corrections for their assigned classrooms.' USING ERRCODE = '42501';
        END IF;
    END IF;

    SELECT name, fees_classes_paid INTO v_student_name, v_current_balance
    FROM public.users
    WHERE id = v_leave.student_id;

    -- Fetch current attendance record
    SELECT * INTO v_attendance
    FROM public.attendance
    WHERE student_id = v_leave.student_id
      AND classroom_id = v_leave.classroom_id
      AND date = v_leave.class_date;

    -- Check if student already attended or completed makeup for this missed date
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
        v_can_execute := false;
        v_block_reason := 'Student has already attended or completed makeup class for date ' || v_leave.class_date::text;
    ELSIF v_leave.status = p_target_status THEN
        v_can_execute := false;
        v_block_reason := 'Leave request is already in status ' || p_target_status;
    END IF;

    -- Calculate projected financial delta
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

    -- Detect completed or forfeited makeup class
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

-- 6. RPC to fetch attendance correction audit history
CREATE OR REPLACE FUNCTION public.get_attendance_correction_history(
    p_classroom_id UUID DEFAULT NULL,
    p_student_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_results jsonb;
BEGIN
    IF v_caller_id IS NOT NULL THEN
        SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
        IF v_caller_role NOT IN ('admin', 'teacher', 'student') THEN
            RAISE EXCEPTION 'Unauthorized to view audit history' USING ERRCODE = '42501';
        END IF;

        -- If student, restrict to own records only
        IF v_caller_role = 'student' THEN
            p_student_id := v_caller_id;
        END IF;

        -- If teacher and classroom provided, check assignment
        IF v_caller_role = 'teacher' AND p_classroom_id IS NOT NULL THEN
            IF NOT public.can_manage_classroom_attendance(p_classroom_id, v_caller_id) THEN
                RAISE EXCEPTION 'Unauthorized: teachers can only view history for their assigned classrooms.' USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
    INTO v_results
    FROM (
        SELECT 
            al.id,
            al.attendance_id,
            al.student_id,
            u.name as student_name,
            al.classroom_id,
            c.name as classroom_name,
            al.class_date,
            al.previous_status,
            al.new_status,
            al.actor_id,
            actor.name as actor_name,
            al.actor_role,
            al.correction_reason,
            al.previous_credit_deducted,
            al.new_credit_deducted,
            al.net_credit_adjustment,
            al.related_leave_id,
            al.related_override_id,
            al.metadata,
            al.created_at
        FROM public.attendance_correction_audit_logs al
        LEFT JOIN public.users u ON u.id = al.student_id
        LEFT JOIN public.classrooms c ON c.id = al.classroom_id
        LEFT JOIN public.users actor ON actor.id = al.actor_id
        WHERE (p_classroom_id IS NULL OR al.classroom_id = p_classroom_id)
          AND (p_student_id IS NULL OR al.student_id = p_student_id)
        ORDER BY al.created_at DESC
        LIMIT LEAST(p_limit, 200)
    ) item;

    RETURN v_results;
END;
$$;

-- Privileges & Grants
REVOKE ALL ON FUNCTION public.preview_attendance_correction(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.correct_historical_attendance(UUID, TEXT, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_attendance_correction_history(UUID, UUID, INTEGER) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.can_manage_classroom_attendance(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_attendance_correction(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.correct_historical_attendance(UUID, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_leave_correction(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_leave_correction(UUID, TEXT, TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_attendance_correction_history(UUID, UUID, INTEGER) TO authenticated;

GRANT EXECUTE ON FUNCTION public.preview_attendance_correction(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.correct_historical_attendance(UUID, TEXT, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.preview_leave_correction(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_leave_correction(UUID, TEXT, TEXT, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_attendance_correction_history(UUID, UUID, INTEGER) TO service_role;
