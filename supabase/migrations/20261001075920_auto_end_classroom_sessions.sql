-- Migration: Canonical Class Ending Everywhere & Automatic 1-Hour Class Timeout
-- 1. Enable pg_cron extension
-- 2. Audit columns on classroom_session_logs (ended_by, end_reason)
-- 3. Robust, idempotent start_classroom_session & end_classroom_session RPCs
-- 4. auto_end_stale_classroom_sessions() function
-- 5. pg_cron schedule running every minute (* * * * *)

-- 1. Enable pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- 2. Audit columns on classroom_session_logs
ALTER TABLE public.classroom_session_logs 
ADD COLUMN IF NOT EXISTS ended_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.classroom_session_logs 
ADD COLUMN IF NOT EXISTS end_reason TEXT DEFAULT 'manual';

-- 3. Update start_classroom_session RPC
CREATE OR REPLACE FUNCTION public.start_classroom_session(
    p_classroom_id UUID,
    p_meeting_link TEXT,
    p_started_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
        -- Preserve existing start time if classroom was already marked live
        live_session_started_at = COALESCE(live_session_started_at, p_started_at, NOW())
    WHERE id = p_classroom_id;

    -- If temporary classroom, update lifecycle_status to active
    UPDATE public.temporary_classes
    SET lifecycle_status = 'active'
    WHERE classroom_id = p_classroom_id
      AND lifecycle_status = 'scheduled';
END;
$$;

-- 4. Canonical end_classroom_session RPC
DROP FUNCTION IF EXISTS public.end_classroom_session(UUID, DATE, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.end_classroom_session(
    p_classroom_id UUID,
    p_session_date DATE DEFAULT NULL,
    p_session_type TEXT DEFAULT NULL,
    p_started_at TIMESTAMPTZ DEFAULT NULL,
    p_ended_at TIMESTAMPTZ DEFAULT NULL,
    p_duration_seconds INTEGER DEFAULT NULL,
    p_present_count INTEGER DEFAULT 0,
    p_absent_count INTEGER DEFAULT 0,
    p_late_count INTEGER DEFAULT 0,
    p_excused_count INTEGER DEFAULT 0,
    p_end_reason TEXT DEFAULT 'manual'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_role TEXT;
    v_is_assigned_teacher BOOLEAN := false;
    v_classroom RECORD;
    v_started_at TIMESTAMPTZ;
    v_ended_at TIMESTAMPTZ;
    v_duration_seconds INTEGER;
    v_session_date DATE;
    v_session_type TEXT;
    v_present INTEGER := COALESCE(p_present_count, 0);
    v_absent INTEGER := COALESCE(p_absent_count, 0);
    v_late INTEGER := COALESCE(p_late_count, 0);
    v_excused INTEGER := COALESCE(p_excused_count, 0);
    v_log_id UUID;
    v_is_system_caller BOOLEAN := false;
BEGIN
    -- 1. Security / Authentication check
    IF auth.uid() IS NULL THEN
        -- Allow internal scheduler, postgres superuser, or service_role
        IF CURRENT_USER IN ('postgres', 'supabase_admin') 
           OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
            v_is_system_caller := true;
        ELSE
            RAISE EXCEPTION 'Unauthorized: Only authenticated teachers or admins can end classroom sessions.';
        END IF;
    ELSE
        -- Authenticated caller: must be teacher, admin, instructor, or classroom assigned teacher
        SELECT role INTO v_user_role 
        FROM public.users 
        WHERE id = auth.uid();

        SELECT (teacher_id = auth.uid()) INTO v_is_assigned_teacher
        FROM public.classrooms
        WHERE id = p_classroom_id;

        IF (v_user_role IS NULL OR LOWER(v_user_role) NOT IN ('teacher', 'admin', 'super_admin', 'instructor'))
           AND COALESCE(v_is_assigned_teacher, false) = false THEN
            RAISE EXCEPTION 'Unauthorized: Only teachers or admins can end classroom sessions.';
        END IF;
    END IF;

    -- 2. Lock classroom row to guarantee atomic transaction across concurrent calls
    SELECT id, name, type, teacher_id, is_live, live_meeting_link, live_session_started_at
    INTO v_classroom
    FROM public.classrooms
    WHERE id = p_classroom_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Classroom not found',
            'classroom_id', p_classroom_id
        );
    END IF;

    -- 3. Idempotency check: If already not live, return cleanly without duplicate logging
    IF COALESCE(v_classroom.is_live, false) = false AND v_classroom.live_session_started_at IS NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_ended', true,
            'classroom_id', p_classroom_id,
            'message', 'Classroom session is already ended.'
        );
    END IF;

    -- 4. Authoritative timing resolution
    -- The started_at is authoritatively taken from classrooms.live_session_started_at
    v_started_at := COALESCE(v_classroom.live_session_started_at, p_started_at, NOW());

    -- For auto_timeout: ended_at is strictly started_at + 1 hour
    IF p_end_reason = 'auto_timeout' THEN
        v_ended_at := COALESCE(p_ended_at, v_started_at + INTERVAL '1 hour');
    ELSE
        v_ended_at := COALESCE(p_ended_at, NOW());
    END IF;

    IF v_ended_at < v_started_at THEN
        v_ended_at := v_started_at;
    END IF;

    v_duration_seconds := COALESCE(p_duration_seconds, GREATEST(1, EXTRACT(EPOCH FROM (v_ended_at - v_started_at))::INTEGER));

    -- Session date: use passed date, or date of started_at in IST (Asia/Kolkata), or CURRENT_DATE
    v_session_date := COALESCE(p_session_date, (v_started_at AT TIME ZONE 'Asia/Kolkata')::DATE, CURRENT_DATE);

    -- Session type: 'online' if meeting link present, else 'offline'
    v_session_type := COALESCE(p_session_type, CASE WHEN v_classroom.live_meeting_link IS NOT NULL THEN 'online' ELSE 'offline' END);

    -- 5. Calculate attendance counts if not provided or all zero
    IF (v_present = 0 AND v_absent = 0 AND v_late = 0 AND v_excused = 0) THEN
        SELECT 
            COALESCE(COUNT(*) FILTER (WHERE status = 'present'), 0),
            COALESCE(COUNT(*) FILTER (WHERE status = 'absent'), 0),
            COALESCE(COUNT(*) FILTER (WHERE status = 'late'), 0),
            COALESCE(COUNT(*) FILTER (WHERE status = 'excused'), 0)
        INTO v_present, v_absent, v_late, v_excused
        FROM public.attendance
        WHERE classroom_id = p_classroom_id AND date = v_session_date;
    END IF;

    -- 6. Atomically clear live state in classrooms
    UPDATE public.classrooms
    SET is_live = false,
        live_meeting_link = NULL,
        live_session_started_at = NULL
    WHERE id = p_classroom_id;

    -- 7. Update temporary_classes lifecycle_status if applicable
    IF v_classroom.type = 'temporary' THEN
        UPDATE public.temporary_classes
        SET lifecycle_status = 'completed'
        WHERE classroom_id = p_classroom_id
          AND lifecycle_status != 'cancelled';
    END IF;

    -- 8. Write immutable session log
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
            excused_count,
            ended_by,
            end_reason
        ) VALUES (
            p_classroom_id,
            v_session_date,
            v_session_type,
            v_started_at,
            v_ended_at,
            v_duration_seconds,
            v_present,
            v_absent,
            v_late,
            v_excused,
            auth.uid(),
            COALESCE(p_end_reason, 'manual')
        )
        RETURNING id INTO v_log_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to insert classroom session log for classroom %: %', p_classroom_id, SQLERRM;
    END;

    -- 9. Return authoritative result
    RETURN jsonb_build_object(
        'success', true,
        'already_ended', false,
        'classroom_id', p_classroom_id,
        'log_id', v_log_id,
        'started_at', v_started_at,
        'ended_at', v_ended_at,
        'duration_seconds', v_duration_seconds,
        'session_date', v_session_date,
        'session_type', v_session_type,
        'end_reason', COALESCE(p_end_reason, 'manual'),
        'ended_by', auth.uid()
    );
END;
$$;

-- 5. Auto-end stale sessions function
CREATE OR REPLACE FUNCTION public.auto_end_stale_classroom_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec RECORD;
    v_ended_count INTEGER := 0;
    v_timeout_interval INTERVAL := INTERVAL '1 hour';
BEGIN
    -- Select all classrooms currently marked live that started at least 1 hour ago
    FOR v_rec IN 
        SELECT id, live_session_started_at
        FROM public.classrooms
        WHERE is_live = true 
          AND live_session_started_at IS NOT NULL
          AND live_session_started_at <= (NOW() - v_timeout_interval)
        FOR UPDATE SKIP LOCKED
    LOOP
        PERFORM public.end_classroom_session(
            p_classroom_id := v_rec.id,
            p_session_date := (v_rec.live_session_started_at AT TIME ZONE 'Asia/Kolkata')::DATE,
            p_session_type := NULL,
            p_started_at := v_rec.live_session_started_at,
            p_ended_at := v_rec.live_session_started_at + v_timeout_interval,
            p_duration_seconds := 3600,
            p_end_reason := 'auto_timeout'
        );
        v_ended_count := v_ended_count + 1;
    END LOOP;

    RETURN v_ended_count;
END;
$$;

-- 6. Permissions and Execution Grants
REVOKE ALL ON FUNCTION public.auto_end_stale_classroom_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_end_stale_classroom_sessions() TO postgres, service_role, authenticated;

GRANT EXECUTE ON FUNCTION public.start_classroom_session(UUID, TEXT, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.end_classroom_session(UUID, DATE, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TEXT) TO authenticated, service_role;

-- 7. Schedule pg_cron job to run every minute (* * * * *)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-end-classroom-sessions') THEN
        PERFORM cron.unschedule('auto-end-classroom-sessions');
    END IF;

    PERFORM cron.schedule(
        'auto-end-classroom-sessions',
        '* * * * *',
        'SELECT public.auto_end_stale_classroom_sessions();'
    );
END $$;
