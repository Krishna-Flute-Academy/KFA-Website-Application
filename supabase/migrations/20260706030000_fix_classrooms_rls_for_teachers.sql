-- Migration: Allow all teachers and admins to update classrooms (to avoid RLS blocks on ending/starting classes)

DROP POLICY IF EXISTS "Teachers can update own classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Teachers can update classrooms" ON public.classrooms;

CREATE POLICY "Teachers can update classrooms"
  ON public.classrooms FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND (users.role = 'teacher' OR users.role = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND (users.role = 'teacher' OR users.role = 'admin')
    )
  );
