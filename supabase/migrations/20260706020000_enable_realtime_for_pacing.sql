-- Migration: Enable Realtime for student_topic_progress

-- 1. Enable realtime for student_topic_progress
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'student_topic_progress'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.student_topic_progress;
    END IF;
END $$;
