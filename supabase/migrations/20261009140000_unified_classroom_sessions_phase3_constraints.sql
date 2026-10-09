-- ============================================================================
-- KFA Production Migration — Phase 3: Constraint Finalization (Post-Cutover)
-- Migration ID: 20261009140000_unified_classroom_sessions_phase3_constraints.sql
-- Description: Transition from legacy 3-column constraint to 4-column multi-session constraint
-- NOTE: Execute ONLY after Phase 1 and Application Frontend Deployment are verified!
-- ============================================================================

-- 1. Ensure classrooms table has active_session_id column
ALTER TABLE public.classrooms 
ADD COLUMN IF NOT EXISTS active_session_id UUID REFERENCES public.classroom_session_logs(id) ON DELETE SET NULL;

-- 2. Drop legacy 3-column unique constraints safely
ALTER TABLE public.attendance 
DROP CONSTRAINT IF EXISTS attendance_classroom_student_date_key;

ALTER TABLE public.attendance 
DROP CONSTRAINT IF EXISTS unique_student_attendance;

-- 3. Apply single unified 4-column constraint with NULLS NOT DISTINCT
-- In PostgreSQL 15+, NULLS NOT DISTINCT guarantees (classroom_id, student_id, date, NULL)
-- is treated as unique, while permitting multiple distinct session UUIDs on the same date!
ALTER TABLE public.attendance 
ADD CONSTRAINT uq_attendance_session_student 
UNIQUE NULLS NOT DISTINCT (classroom_id, student_id, date, session_id);

CREATE INDEX IF NOT EXISTS idx_attendance_session_lookup 
ON public.attendance(classroom_id, date, session_id);

-- 4. Deploy session-aware save_attendance_record RPC
-- Prioritizes explicit session matching, while gracefully allowing administrative daily edits
-- to update existing daily records without duplicate insertions
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
    -- 1. If explicit session_id provided, match by session_id
    IF p_session_id IS NOT NULL THEN
        SELECT id INTO v_att_id
        FROM public.attendance
        WHERE session_id = p_session_id AND student_id = p_student_id;
        
        -- Fallback: if not found by session_id, check if unlinked daily record exists on same date/room
        IF v_att_id IS NULL THEN
            SELECT id INTO v_att_id
            FROM public.attendance
            WHERE classroom_id = p_classroom_id AND student_id = p_student_id AND date = p_date AND session_id IS NULL
            LIMIT 1;
        END IF;
    ELSE
        -- 2. If session_id is NULL (administrative daily edit):
        -- Target existing record for this classroom, student, and date
        -- Prioritizes record with NULL session_id, but updates existing live session row if one exists on that day
        SELECT id INTO v_att_id
        FROM public.attendance
        WHERE classroom_id = p_classroom_id AND student_id = p_student_id AND date = p_date
        ORDER BY (session_id IS NULL) DESC, created_at ASC
        LIMIT 1;
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
