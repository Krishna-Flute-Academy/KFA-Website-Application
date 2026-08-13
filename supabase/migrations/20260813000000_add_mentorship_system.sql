-- ============================================================
-- Migration: Add Mentorship System & Task Evaluation Extensions
-- Target: AUTH Supabase Project
-- ============================================================

-- 0. Update public.users role check constraint to include 'mentor'
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'teacher', 'admin', 'pending', 'mentor'));

-- 1. Create student_mentors Table
CREATE TABLE IF NOT EXISTS public.student_mentors (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id  UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mentor_id   UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_by UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_student_mentor UNIQUE (student_id)
);

-- Index for fast lookup by mentor or student
CREATE INDEX IF NOT EXISTS student_mentors_mentor_idx ON public.student_mentors(mentor_id);
CREATE INDEX IF NOT EXISTS student_mentors_student_idx ON public.student_mentors(student_id);

-- 2. Add columns to assignment_students for Mentor/Teacher evaluations
ALTER TABLE public.assignment_students
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewer_role TEXT DEFAULT 'teacher';

-- 3. Enable RLS on student_mentors
ALTER TABLE public.student_mentors ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists and create permissive/authenticated access policies
DROP POLICY IF EXISTS "Allow authenticated users to read student_mentors" ON public.student_mentors;
CREATE POLICY "Allow authenticated users to read student_mentors"
  ON public.student_mentors FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow teachers and admins to insert student_mentors" ON public.student_mentors;
CREATE POLICY "Allow teachers and admins to insert student_mentors"
  ON public.student_mentors FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow teachers and admins to update student_mentors" ON public.student_mentors;
CREATE POLICY "Allow teachers and admins to update student_mentors"
  ON public.student_mentors FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow teachers and admins to delete student_mentors" ON public.student_mentors;
CREATE POLICY "Allow teachers and admins to delete student_mentors"
  ON public.student_mentors FOR DELETE
  TO authenticated
  USING (true);

-- 4. Enable Supabase Realtime for student_mentors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'student_mentors'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.student_mentors;
  END IF;
END $$;
