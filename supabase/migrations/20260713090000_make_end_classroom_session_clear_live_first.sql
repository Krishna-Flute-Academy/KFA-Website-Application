-- Ensure ending a class always clears live state before writing optional history.
-- This prevents students from seeing a stale live banner if session-log insertion fails.
CREATE OR REPLACE FUNCTION public.end_classroom_session(
    p_classroom_id UUID,
    p_session_date DATE,
    p_session_type TEXT,
    p_started_at TIMESTAMPTZ,
    p_ended_at TIMESTAMPTZ,
    p_duration_seconds INTEGER,
    p_present_count INTEGER,
    p_absent_count INTEGER,
    p_late_count INTEGER,
    p_excused_count INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_role TEXT;
BEGIN
    SELECT role INTO v_user_role
    FROM public.users
    WHERE id = auth.uid();

    IF v_user_role IS NULL OR v_user_role NOT IN ('teacher', 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only teachers or admins can end classroom sessions.';
    END IF;

    UPDATE public.classrooms
    SET is_live = false,
        live_meeting_link = null,
        live_session_started_at = null
    WHERE id = p_classroom_id;

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
            p_session_date,
            p_session_type,
            p_started_at,
            p_ended_at,
            p_duration_seconds,
            p_present_count,
            p_absent_count,
            p_late_count,
            p_excused_count
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to insert classroom session log for classroom %: %', p_classroom_id, SQLERRM;
    END;
END;
$$;
