-- Migration to automatically sync teacher_id between classrooms and enrolled students
-- (Run this in the Supabase SQL editor for your Auth Supabase project)

-- 1. One-time sync to correct all existing student records
UPDATE public.users u
SET teacher_id = c.teacher_id
FROM public.classroom_students cs
JOIN public.classrooms c ON c.id = cs.classroom_id
WHERE cs.student_id = u.id 
  AND u.role = 'student' 
  AND u.teacher_id IS DISTINCT FROM c.teacher_id;

-- 2. Sync student teacher_id when a classroom's instructor is updated
CREATE OR REPLACE FUNCTION public.sync_classroom_teacher_to_students()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') AND (OLD.teacher_id IS DISTINCT FROM NEW.teacher_id) THEN
    UPDATE public.users
    SET teacher_id = NEW.teacher_id
    WHERE id IN (
      SELECT student_id 
      FROM public.classroom_students 
      WHERE classroom_id = NEW.id
    ) AND role = 'student';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on classrooms table
DROP TRIGGER IF EXISTS on_classroom_teacher_changed ON public.classrooms;
CREATE TRIGGER on_classroom_teacher_changed
  AFTER UPDATE OF teacher_id ON public.classrooms
  FOR EACH ROW EXECUTE PROCEDURE public.sync_classroom_teacher_to_students();


-- 3. Sync teacher_id when a student is enrolled in or removed from a classroom
CREATE OR REPLACE FUNCTION public.sync_student_teacher_on_enrollment()
RETURNS TRIGGER AS $$
DECLARE
  v_teacher_id UUID;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    -- Get the teacher_id of the classroom
    SELECT teacher_id INTO v_teacher_id
    FROM public.classrooms
    WHERE id = NEW.classroom_id;
    
    -- Sync to the student
    UPDATE public.users
    SET teacher_id = v_teacher_id
    WHERE id = NEW.student_id AND role = 'student';
    
  ELSIF (TG_OP = 'DELETE') THEN
    -- Get the teacher_id of the classroom
    SELECT teacher_id INTO v_teacher_id
    FROM public.classrooms
    WHERE id = OLD.classroom_id;
    
    -- Only set to null if it currently matches the teacher of the classroom being removed
    UPDATE public.users
    SET teacher_id = NULL
    WHERE id = OLD.student_id 
      AND teacher_id = v_teacher_id 
      AND role = 'student';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on classroom_students table
DROP TRIGGER IF EXISTS on_student_enrollment_changed ON public.classroom_students;
CREATE TRIGGER on_student_enrollment_changed
  AFTER INSERT OR DELETE ON public.classroom_students
  FOR EACH ROW EXECUTE PROCEDURE public.sync_student_teacher_on_enrollment();
