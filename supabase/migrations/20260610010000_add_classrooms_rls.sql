-- Migration to fix Classrooms RLS policies and allow admins to manage all classrooms
-- (Run this in the Supabase SQL editor for your Auth Supabase project)

ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;

-- 1. Read Policy: Allow all authenticated users to read classrooms
DROP POLICY IF EXISTS "Allow read for classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Authenticated users can read classrooms" ON public.classrooms;
CREATE POLICY "Authenticated users can read classrooms"
  ON public.classrooms FOR SELECT
  TO authenticated
  USING (true);

-- 2. Write Policies: Allow admins full access to classrooms
DROP POLICY IF EXISTS "Admins can manage classrooms" ON public.classrooms;
CREATE POLICY "Admins can manage classrooms"
  ON public.classrooms FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- 3. Write Policies: Allow teachers to create classrooms
DROP POLICY IF EXISTS "Teachers can insert classrooms" ON public.classrooms;
CREATE POLICY "Teachers can insert classrooms"
  ON public.classrooms FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'teacher'
    )
  );

-- 4. Write Policies: Allow teachers to update/delete their own classrooms
DROP POLICY IF EXISTS "Teachers can update own classrooms" ON public.classrooms;
CREATE POLICY "Teachers can update own classrooms"
  ON public.classrooms FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Teachers can delete own classrooms" ON public.classrooms;
CREATE POLICY "Teachers can delete own classrooms"
  ON public.classrooms FOR DELETE
  TO authenticated
  USING (teacher_id = auth.uid());
