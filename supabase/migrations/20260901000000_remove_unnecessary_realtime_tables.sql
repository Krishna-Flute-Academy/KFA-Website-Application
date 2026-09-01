-- Migration: Remove unnecessary tables from supabase_realtime publication to reduce Supabase Disk I/O & WAL load
-- Tables removed: public.broadcasts, public.classrooms, public.fees_payments, public.messages
-- Tables retained: public.notifications, public.classroom_messages, public.leave_requests, public.student_curriculum_spotlights

DO $$
BEGIN
    -- 1. Remove public.broadcasts from supabase_realtime if present
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'broadcasts'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.broadcasts;
    END IF;

    -- 2. Remove public.classrooms from supabase_realtime if present
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'classrooms'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.classrooms;
    END IF;

    -- 3. Remove public.fees_payments from supabase_realtime if present
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'fees_payments'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.fees_payments;
    END IF;

    -- 4. Remove public.messages from supabase_realtime if present
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.messages;
    END IF;
END $$;
