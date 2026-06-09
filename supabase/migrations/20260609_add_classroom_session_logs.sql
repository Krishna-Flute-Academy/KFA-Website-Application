-- Migration: Add classroom_session_logs table
-- Persists classroom sessions: start time, end time, duration, and attendance statistics.

CREATE TABLE IF NOT EXISTS public.classroom_session_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  session_type TEXT NOT NULL, -- 'online' | 'offline'
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER NOT NULL,
  present_count INTEGER DEFAULT 0,
  absent_count INTEGER DEFAULT 0,
  late_count INTEGER DEFAULT 0,
  excused_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.classroom_session_logs ENABLE ROW LEVEL SECURITY;

-- Allow all operations for simplicity in development (matching other tables)
DROP POLICY IF EXISTS "Allow all classroom_session_logs" ON public.classroom_session_logs;
CREATE POLICY "Allow all classroom_session_logs" ON public.classroom_session_logs FOR ALL USING (true) WITH CHECK (true);
