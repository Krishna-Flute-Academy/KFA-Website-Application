-- Migration: Improve speed and robustness of start_classroom_session and end_classroom_session RPC functions.
-- Calculates attendance counts directly inside PostgreSQL in a single database transaction,
-- avoiding multiple client-side roundtrips and drastically speeding up class termination.

CREATE OR REPLACE FUNCTION public.start_classroom_session(
    p_classroom_id UUID,
    p_meeting_link TEXT,
    p_started_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_role TEXT;
    v_is_assigned_teacher BOOLEAN := false;
BEGIN
    SELECT role INTO v_user_role 
    FROM public.users 
    WHERE id = auth.uid();

    SELECT (teacher_id = auth.uid()) INTO v_is_assigned_teacher
    FROM public.classrooms
    WHERE id = p_classroom_id;

    IF (v_user_role IS NULL OR LOWER(v_user_role) NOT IN ('teacher', 'admin', 'super_admin', 'instructor')) 
       AND COALESCE(v_is_assigned_teacher, false) = false THEN
        RAISE EXCEPTION 'Unauthorized: Only teachers or admins can start classroom sessions.';
    END IF;

    UPDATE public.classrooms
    SET is_live = true,
        live_meeting_link = p_meeting_link,
        live_session_started_at = COALESCE(p_started_at, NOW())
    WHERE id = p_classroom_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.end_classroom_session(
    p_classroom_id UUID,
    p_session_date DATE DEFAULT CURRENT_DATE,
    p_session_type TEXT DEFAULT 'online',
    p_started_at TIMESTAMPTZ DEFAULT NOW(),
    p_ended_at TIMESTAMPTZ DEFAULT NOW(),
    p_duration_seconds INTEGER DEFAULT 0,
    p_present_count INTEGER DEFAULT 0,
    p_absent_count INTEGER DEFAULT 0,
    p_late_count INTEGER DEFAULT 0,
    p_excused_count INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_role TEXT;
    v_is_assigned_teacher BOOLEAN := false;
    v_present INTEGER := p_present_count;
    v_absent INTEGER := p_absent_count;
    v_late INTEGER := p_late_count;
    v_excused INTEGER := p_excused_count;
BEGIN
    SELECT role INTO v_user_role 
    FROM public.users 
    WHERE id = auth.uid();

    SELECT (teacher_id = auth.uid()) INTO v_is_assigned_teacher
    FROM public.classrooms
    WHERE id = p_classroom_id;

    -- 1. Always clear live state first to ensure live flag is removed immediately
    UPDATE public.classrooms
    SET is_live = false,
        live_meeting_link = null,
        live_session_started_at = null
    WHERE id = p_classroom_id;

    IF (v_user_role IS NULL OR LOWER(v_user_role) NOT IN ('teacher', 'admin', 'super_admin', 'instructor'))
       AND COALESCE(v_is_assigned_teacher, false) = false THEN
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'Unauthorized: Only authenticated teachers or admins can end classroom sessions.';
        END IF;
    END IF;

    -- 2. If attendance counts were not passed, calculate them inside PostgreSQL
    IF (v_present = 0 AND v_absent = 0 AND v_late = 0 AND v_excused = 0) THEN
        SELECT 
            COALESCE(COUNT(*) FILTER (WHERE status = 'present'), 0),
            COALESCE(COUNT(*) FILTER (WHERE status = 'absent'), 0),
            COALESCE(COUNT(*) FILTER (WHERE status = 'late'), 0),
            COALESCE(COUNT(*) FILTER (WHERE status = 'excused'), 0)
        INTO v_present, v_absent, v_late, v_excused
        FROM public.attendance
        WHERE classroom_id = p_classroom_id AND date = COALESCE(p_session_date, CURRENT_DATE);
    END IF;

    -- 3. Insert log into session history (wrapped in block to prevent log failure from blocking ending)
    BEGIN
        INSERT INTO public.classroom_session_logs (
            classroom_id,
            session_date,
            session_type,
            started_at,
            ended_at,
            duration_seconds,
            present_count,
            absent_count,
            late_count,
            excused_count
        ) VALUES (
            p_classroom_id,
            COALESCE(p_session_date, CURRENT_DATE),
            COALESCE(p_session_type, 'online'),
            COALESCE(p_started_at, NOW()),
            COALESCE(p_ended_at, NOW()),
            COALESCE(p_duration_seconds, 0),
            v_present,
            v_absent,
            v_late,
            v_excused
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to insert classroom session log for classroom %: %', p_classroom_id, SQLERRM;
    END;
END;
$$;
