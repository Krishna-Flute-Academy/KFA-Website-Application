-- Migration: Add live session columns to classrooms, enable RLS for notifications, and enable Supabase Realtime

-- 1. Add live session columns to classrooms
ALTER TABLE public.classrooms ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT false;
ALTER TABLE public.classrooms ADD COLUMN IF NOT EXISTS live_meeting_link TEXT DEFAULT null;
ALTER TABLE public.classrooms ADD COLUMN IF NOT EXISTS live_session_started_at TIMESTAMPTZ DEFAULT null;

-- 2. Enable RLS and add security policies on notifications table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy to allow students to read, update, or delete their own notifications
DROP POLICY IF EXISTS "Users can manage their own notifications" ON public.notifications;
CREATE POLICY "Users can manage their own notifications"
    ON public.notifications
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy to allow teachers and admins to insert notifications for students
DROP POLICY IF EXISTS "Teachers can insert notifications for students" ON public.notifications;
CREATE POLICY "Teachers can insert notifications for students"
    ON public.notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid() AND (users.role = 'teacher' OR users.role = 'admin')
        )
    );

-- 3. Add public.classrooms and public.notifications to supabase_realtime publication
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'classrooms'
    ) THEN
        NULL;
    ELSE
        ALTER PUBLICATION supabase_realtime ADD TABLE public.classrooms;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
    ) THEN
        NULL;
    ELSE
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
END $$;
