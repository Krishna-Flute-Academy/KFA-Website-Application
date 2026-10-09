-- ============================================================================
-- KFA Production Migration — Phase 1: Additive Schema & Atomic RPC Deployment
-- Migration ID: 20261009130000_unified_classroom_sessions_phase1_additive.sql
-- Description: Non-breaking schema additions, schedule exceptions, and atomic attendance RPC
-- Note: Does NOT drop legacy unique constraints or alter existing application queries
-- ============================================================================

-- 1. Table schema adjustments (Additive columns with backward-compatible defaults)
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS is_extra_class BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS credit_deducted INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.classroom_session_logs(id) ON DELETE SET NULL;

ALTER TABLE public.classroom_session_logs
ADD COLUMN IF NOT EXISTS session_classification TEXT DEFAULT 'normal' 
    CHECK (session_classification IN ('normal', 'extra', 'on_behalf_of')),
ADD COLUMN IF NOT EXISTS target_scheduled_date DATE;

-- 2. Create classroom schedule exceptions table
CREATE TABLE IF NOT EXISTS public.classroom_schedule_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
    original_date DATE NOT NULL,
    rescheduled_date DATE NOT NULL,
    new_start_time TIME,
    new_end_time TIME,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'rescheduled' CHECK (status IN ('rescheduled', 'cancelled')),
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exceptions_classroom_dates 
ON public.classroom_schedule_exceptions(classroom_id, original_date, rescheduled_date);

-- Enable RLS on exceptions with role-based policies
ALTER TABLE public.classroom_schedule_exceptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enrolled students, assigned teachers, and admins view schedule exceptions" ON public.classroom_schedule_exceptions;
CREATE POLICY "Enrolled students, assigned teachers, and admins view schedule exceptions"
ON public.classroom_schedule_exceptions
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin'))
  OR
  EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_schedule_exceptions.classroom_id AND c.teacher_id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.classroom_students cs WHERE cs.classroom_id = classroom_schedule_exceptions.classroom_id AND cs.student_id = auth.uid())
);

DROP POLICY IF EXISTS "Assigned teachers and admins create schedule exceptions" ON public.classroom_schedule_exceptions;
CREATE POLICY "Assigned teachers and admins create schedule exceptions"
ON public.classroom_schedule_exceptions
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin'))
  OR
  EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_schedule_exceptions.classroom_id AND c.teacher_id = auth.uid())
);

DROP POLICY IF EXISTS "Assigned teachers and admins update schedule exceptions" ON public.classroom_schedule_exceptions;
CREATE POLICY "Assigned teachers and admins update schedule exceptions"
ON public.classroom_schedule_exceptions
FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin'))
  OR
  EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_schedule_exceptions.classroom_id AND c.teacher_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin'))
  OR
  EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_schedule_exceptions.classroom_id AND c.teacher_id = auth.uid())
);

DROP POLICY IF EXISTS "Assigned teachers and admins delete schedule exceptions" ON public.classroom_schedule_exceptions;
CREATE POLICY "Assigned teachers and admins delete schedule exceptions"
ON public.classroom_schedule_exceptions
FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin'))
  OR
  EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_schedule_exceptions.classroom_id AND c.teacher_id = auth.uid())
);

-- 3. Auditable Fee Trigger Function (Row-level lock, zero unearned credits, exact refunds)
CREATE OR REPLACE FUNCTION public.update_prepaid_classes_on_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_current_credits INTEGER;
    v_should_deduct BOOLEAN := false;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_should_deduct := (COALESCE(NEW.is_extra_class, false) = false) 
                           AND (NEW.status IN ('present', 'late', 'absent'));

        IF v_should_deduct THEN
            SELECT COALESCE(fees_classes_paid, 0) INTO v_current_credits
            FROM public.users
            WHERE id = NEW.student_id
            FOR UPDATE;

            IF v_current_credits > 0 THEN
                UPDATE public.users
                SET fees_classes_paid = v_current_credits - 1
                WHERE id = NEW.student_id;
                NEW.credit_deducted := 1;
            ELSE
                NEW.credit_deducted := 0;
            END IF;
        ELSE
            NEW.credit_deducted := 0;
        END IF;
        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        NEW.credit_deducted := OLD.credit_deducted;
        v_should_deduct := (COALESCE(NEW.is_extra_class, false) = false) 
                           AND (NEW.status IN ('present', 'late', 'absent'));

        -- Transition 1: Was deducted, now does not consume credit (e.g. converted to Extra Class or Excused)
        IF OLD.credit_deducted > 0 AND NOT v_should_deduct THEN
            UPDATE public.users
            SET fees_classes_paid = COALESCE(fees_classes_paid, 0) + OLD.credit_deducted
            WHERE id = NEW.student_id;
            NEW.credit_deducted := 0;

        -- Transition 2: Was NOT deducted, now SHOULD consume credit (e.g. converted to Normal Class)
        ELSIF OLD.credit_deducted = 0 AND v_should_deduct THEN
            SELECT COALESCE(fees_classes_paid, 0) INTO v_current_credits
            FROM public.users
            WHERE id = NEW.student_id
            FOR UPDATE;

            IF v_current_credits > 0 THEN
                UPDATE public.users
                SET fees_classes_paid = v_current_credits - 1
                WHERE id = NEW.student_id;
                NEW.credit_deducted := 1;
            ELSE
                NEW.credit_deducted := 0;
            END IF;
        END IF;
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        -- Refund ONLY if credit was actually deducted
        IF OLD.credit_deducted > 0 THEN
            UPDATE public.users
            SET fees_classes_paid = COALESCE(fees_classes_paid, 0) + OLD.credit_deducted
            WHERE id = OLD.student_id;
        END IF;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

-- Drop and recreate trigger as BEFORE trigger so NEW.credit_deducted is recorded
DROP TRIGGER IF EXISTS trg_attendance_fees_sync ON public.attendance;

CREATE TRIGGER trg_attendance_fees_sync
BEFORE INSERT OR UPDATE OR DELETE ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION public.update_prepaid_classes_on_attendance();

-- 4. Session Initialization RPC (Captures classification & target scheduled date)
CREATE OR REPLACE FUNCTION public.init_classroom_session(
    p_classroom_id UUID,
    p_session_date DATE,
    p_session_type TEXT DEFAULT 'online',
    p_meeting_link TEXT DEFAULT NULL,
    p_session_classification TEXT DEFAULT 'normal',
    p_target_scheduled_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_classroom RECORD;
    v_log_id UUID;
    v_started_at TIMESTAMPTZ := clock_timestamp();
    v_caller_role TEXT;
    v_is_classroom_teacher BOOLEAN := false;
BEGIN
    IF current_user NOT IN ('postgres', 'supabase_admin') AND auth.role() != 'service_role' THEN
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'Unauthorized: Authentication required.';
        END IF;

        SELECT role INTO v_caller_role FROM public.users WHERE id = auth.uid();
        SELECT (teacher_id = auth.uid()) INTO v_is_classroom_teacher FROM public.classrooms WHERE id = p_classroom_id;

        IF (v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'super_admin'))
           AND COALESCE(v_is_classroom_teacher, false) = false THEN
            RAISE EXCEPTION 'Unauthorized: Caller cannot start session for this classroom.';
        END IF;
    END IF;

    SELECT id, name, type, teacher_id, is_live, live_meeting_link, live_session_started_at
    INTO v_classroom
    FROM public.classrooms
    WHERE id = p_classroom_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Classroom not found: %', p_classroom_id;
    END IF;

    INSERT INTO public.classroom_session_logs (
        classroom_id,
        session_date,
        session_type,
        started_at,
        ended_at,
        duration_seconds,
        session_classification,
        target_scheduled_date,
        end_reason
    ) VALUES (
        p_classroom_id,
        p_session_date,
        p_session_type,
        v_started_at,
        v_started_at,
        0,
        COALESCE(p_session_classification, 'normal'),
        p_target_scheduled_date,
        'in_progress'
    )
    RETURNING id INTO v_log_id;

    UPDATE public.classrooms
    SET is_live = true,
        live_meeting_link = COALESCE(p_meeting_link, v_classroom.live_meeting_link),
        live_session_started_at = v_started_at
    WHERE id = p_classroom_id;

    RETURN jsonb_build_object(
        'success', true,
        'session_id', v_log_id,
        'started_at', v_started_at,
        'classification', p_session_classification,
        'target_date', p_target_scheduled_date
    );
END;
$$;

-- 5. Atomic Attendance Record Saver RPC (Supports both legacy and session-aware writes)
CREATE OR REPLACE FUNCTION public.save_attendance_record(
    p_classroom_id UUID,
    p_student_id UUID,
    p_date DATE,
    p_status TEXT,
    p_session_id UUID DEFAULT NULL,
    p_on_behalf_of_date DATE DEFAULT NULL,
    p_is_extra_class BOOLEAN DEFAULT FALSE,
    p_marked_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_att_id UUID;
    v_status TEXT := LOWER(TRIM(p_status));
    v_marker UUID := COALESCE(p_marked_by, auth.uid());
    v_caller_role TEXT;
    v_is_classroom_teacher BOOLEAN := false;
BEGIN
    IF current_user NOT IN ('postgres', 'supabase_admin') AND auth.role() != 'service_role' THEN
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'Unauthorized: Authentication required.';
        END IF;

        SELECT role INTO v_caller_role FROM public.users WHERE id = auth.uid();
        SELECT (teacher_id = auth.uid()) INTO v_is_classroom_teacher FROM public.classrooms WHERE id = p_classroom_id;

        IF (v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'super_admin'))
           AND COALESCE(v_is_classroom_teacher, false) = false THEN
            RAISE EXCEPTION 'Unauthorized: Caller cannot mark attendance for this classroom.';
        END IF;
    END IF;

    IF v_status NOT IN ('present', 'absent', 'late', 'excused') THEN
        RAISE EXCEPTION 'Invalid attendance status: %', p_status;
    END IF;

    -- Concurrency-safe atomic insert/update:
    -- If p_session_id is provided, match by session_id; if NULL, match by daily record
    IF p_session_id IS NOT NULL THEN
        SELECT id INTO v_att_id
        FROM public.attendance
        WHERE session_id = p_session_id AND student_id = p_student_id;
    ELSE
        SELECT id INTO v_att_id
        FROM public.attendance
        WHERE classroom_id = p_classroom_id AND student_id = p_student_id AND date = p_date AND session_id IS NULL;
    END IF;

    IF v_att_id IS NOT NULL THEN
        UPDATE public.attendance
        SET status = v_status,
            session_id = COALESCE(p_session_id, attendance.session_id),
            on_behalf_of_date = p_on_behalf_of_date,
            is_extra_class = p_is_extra_class,
            marked_by = v_marker
        WHERE id = v_att_id;
    ELSE
        INSERT INTO public.attendance (
            classroom_id,
            student_id,
            date,
            session_id,
            status,
            on_behalf_of_date,
            is_extra_class,
            marked_by
        ) VALUES (
            p_classroom_id,
            p_student_id,
            p_date,
            p_session_id,
            v_status,
            p_on_behalf_of_date,
            p_is_extra_class,
            v_marker
        )
        RETURNING id INTO v_att_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'id', v_att_id, 'status', v_status);
END;
$$;
