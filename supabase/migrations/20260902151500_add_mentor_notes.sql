-- ============================================================
-- Migration: KFA Simplified Mentor Notes & Guidance System (V1)
-- Target: AUTH Supabase Project
-- ============================================================

-- 1. Create public.mentor_notes table
CREATE TABLE IF NOT EXISTS public.mentor_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    mentor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    classroom_id UUID REFERENCES public.classrooms(id) ON DELETE SET NULL,
    title TEXT,
    note TEXT NOT NULL,
    note_type TEXT NOT NULL DEFAULT 'general' CHECK (note_type IN ('focus', 'practice', 'improvement', 'strength', 'general')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Indexes for fast retrieval
CREATE INDEX IF NOT EXISTS idx_mentor_notes_student_active 
  ON public.mentor_notes(student_id, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mentor_notes_student_all 
  ON public.mentor_notes(student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mentor_notes_mentor 
  ON public.mentor_notes(mentor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mentor_notes_classroom 
  ON public.mentor_notes(classroom_id);

-- 3. Centralized Authorization Helper (No recursion, Security Definer)
CREATE OR REPLACE FUNCTION public.can_give_student_guidance(
    p_mentor_id uuid,
    p_student_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT (
    -- 1. Admin can guide any student
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = p_mentor_id AND role = 'admin'
    )
    OR
    -- 2. Teacher teaches the student (classroom enrollment or synced users.teacher_id)
    (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = p_mentor_id AND role = 'teacher'
      )
      AND (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE id = p_student_id AND teacher_id = p_mentor_id
        )
        OR
        EXISTS (
          SELECT 1 FROM public.classroom_students cs
          JOIN public.classrooms c ON c.id = cs.classroom_id
          WHERE c.teacher_id = p_mentor_id AND cs.student_id = p_student_id
        )
      )
    )
  );
$$;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.mentor_notes ENABLE ROW LEVEL SECURITY;

-- 5. Strict & Simple RLS Policies
DROP POLICY IF EXISTS "Students read own notes; Teachers read taught students; Admins read all" ON public.mentor_notes;
DROP POLICY IF EXISTS "Allow teachers and admins to insert mentor notes" ON public.mentor_notes;
DROP POLICY IF EXISTS "Allow author or admin to update mentor notes" ON public.mentor_notes;
DROP POLICY IF EXISTS "Allow author or admin to delete mentor notes" ON public.mentor_notes;
DROP POLICY IF EXISTS "Read mentor notes" ON public.mentor_notes;
DROP POLICY IF EXISTS "Insert mentor notes" ON public.mentor_notes;
DROP POLICY IF EXISTS "Update mentor notes" ON public.mentor_notes;
DROP POLICY IF EXISTS "Delete mentor notes" ON public.mentor_notes;

-- Read Policy
CREATE POLICY "Read mentor notes"
  ON public.mentor_notes FOR SELECT TO authenticated
  USING (
    student_id = (SELECT auth.uid()) OR
    mentor_id = (SELECT auth.uid()) OR
    public.can_give_student_guidance((SELECT auth.uid()), student_id)
  );

-- Insert Policy
CREATE POLICY "Insert mentor notes"
  ON public.mentor_notes FOR INSERT TO authenticated
  WITH CHECK (
    mentor_id = (SELECT auth.uid()) AND
    public.can_give_student_guidance((SELECT auth.uid()), student_id)
  );

-- Update Policy
CREATE POLICY "Update mentor notes"
  ON public.mentor_notes FOR UPDATE TO authenticated
  USING (
    mentor_id = (SELECT auth.uid()) OR (SELECT public.is_admin())
  )
  WITH CHECK (
    mentor_id = (SELECT auth.uid()) OR (SELECT public.is_admin())
  );

-- Delete Policy
CREATE POLICY "Delete mentor notes"
  ON public.mentor_notes FOR DELETE TO authenticated
  USING (
    mentor_id = (SELECT auth.uid()) OR (SELECT public.is_admin())
  );
