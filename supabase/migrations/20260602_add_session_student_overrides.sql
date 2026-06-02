-- Migration: Add session_student_overrides table
-- Allows temporary, date-specific allocation of a student to a target classroom.

CREATE TABLE IF NOT EXISTS public.session_student_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, target_classroom_id, override_date)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.session_student_overrides ENABLE ROW LEVEL SECURITY;

-- Allow all operations for simplicity in development (matching other tables)
DROP POLICY IF EXISTS "Allow all session_student_overrides" ON public.session_student_overrides;
CREATE POLICY "Allow all session_student_overrides" ON public.session_student_overrides FOR ALL USING (true) WITH CHECK (true);
