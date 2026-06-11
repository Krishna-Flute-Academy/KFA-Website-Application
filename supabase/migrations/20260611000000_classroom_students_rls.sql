-- Migration: Enable RLS on classroom_students and other related tables, and update enrollment trigger to support updates

-- 1. Enable Row Level Security (RLS) on tables
ALTER TABLE public.classroom_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temporary_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- 2. Allow all operations for simplicity in development (matching session_student_overrides and others)
DROP POLICY IF EXISTS "Allow all classroom_students" ON public.classroom_students;
CREATE POLICY "Allow all classroom_students" 
  ON public.classroom_students FOR ALL 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all batch_schedules" ON public.batch_schedules;
CREATE POLICY "Allow all batch_schedules" 
  ON public.batch_schedules FOR ALL 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all temporary_classes" ON public.temporary_classes;
CREATE POLICY "Allow all temporary_classes" 
  ON public.temporary_classes FOR ALL 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all attendance" ON public.attendance;
CREATE POLICY "Allow all attendance" 
  ON public.attendance FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 3. Update the enrollment sync trigger function to handle UPDATE when classroom_id changes
CREATE OR REPLACE FUNCTION public.sync_student_teacher_on_enrollment()
RETURNS TRIGGER AS $$
DECLARE
  v_teacher_id UUID;
BEGIN
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND OLD.classroom_id IS DISTINCT FROM NEW.classroom_id) THEN
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

-- 4. Recreate the trigger on classroom_students to support INSERT, UPDATE, and DELETE
DROP TRIGGER IF EXISTS on_student_enrollment_changed ON public.classroom_students;
CREATE TRIGGER on_student_enrollment_changed
  AFTER INSERT OR UPDATE OR DELETE ON public.classroom_students
  FOR EACH ROW EXECUTE PROCEDURE public.sync_student_teacher_on_enrollment();
