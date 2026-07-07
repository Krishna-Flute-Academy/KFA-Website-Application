-- Migration: Add shared classroom chat messages
-- Enables teacher-to-class and student-to-class discussion threads per classroom.

CREATE TABLE IF NOT EXISTS public.classroom_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL CHECK (char_length(trim(message_text)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS classroom_messages_classroom_created_idx
  ON public.classroom_messages (classroom_id, created_at);

CREATE INDEX IF NOT EXISTS classroom_messages_sender_idx
  ON public.classroom_messages (sender_id);

ALTER TABLE public.classroom_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all classroom_messages" ON public.classroom_messages;
CREATE POLICY "Allow all classroom_messages"
  ON public.classroom_messages FOR ALL
  USING (true)
  WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'classroom_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.classroom_messages;
  END IF;
END $$;
