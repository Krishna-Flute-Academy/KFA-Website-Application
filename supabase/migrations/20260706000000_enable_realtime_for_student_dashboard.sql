-- Migration: Enable Postgres Realtime for student dashboard tables (classroom_students, messages, broadcasts, class_notes, assignments, assignment_students, classroom_session_logs, session_student_overrides)

DO $$
BEGIN
    -- 1. Enable realtime for classroom_students
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'classroom_students'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.classroom_students;
    END IF;

    -- 2. Enable realtime for messages
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;

    -- 3. Enable realtime for broadcasts
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'broadcasts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcasts;
    END IF;

    -- 4. Enable realtime for class_notes
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'class_notes'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.class_notes;
    END IF;

    -- 5. Enable realtime for assignments
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'assignments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.assignments;
    END IF;

    -- 6. Enable realtime for assignment_students
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'assignment_students'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.assignment_students;
    END IF;

    -- 7. Enable realtime for classroom_session_logs
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'classroom_session_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.classroom_session_logs;
    END IF;

    -- 8. Enable realtime for session_student_overrides
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'session_student_overrides'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.session_student_overrides;
    END IF;
END $$;
