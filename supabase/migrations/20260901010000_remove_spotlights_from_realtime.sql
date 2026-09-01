-- Migration: Remove public.student_curriculum_spotlights from supabase_realtime publication
-- Only removes the table if it is currently present in supabase_realtime
-- Retains: public.classroom_messages, public.leave_requests, public.notifications

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'student_curriculum_spotlights'
    ) THEN
        ALTER PUBLICATION supabase_realtime
        DROP TABLE public.student_curriculum_spotlights;
    END IF;
END $$;
