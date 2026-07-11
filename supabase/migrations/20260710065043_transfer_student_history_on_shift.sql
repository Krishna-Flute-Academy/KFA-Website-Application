-- Migration: Automatically transfer student curriculum progress, attendance logs, and tasks when they shift classrooms

CREATE OR REPLACE FUNCTION public.transfer_student_history_on_class_shift()
RETURNS TRIGGER AS $$
BEGIN
  -- This function handles transferring student history from old classrooms to the new classroom.
  -- It executes whenever a student is enrolled in a new classroom (INSERT) or their classroom is changed (UPDATE).

  -- 1. Transfer curriculum progress (student_topic_progress)
  -- student_topic_progress has a UNIQUE constraint on (student_id, lesson_id), so shifting classroom_id is straightforward.
  UPDATE public.student_topic_progress
  SET classroom_id = NEW.classroom_id
  WHERE student_id = NEW.student_id 
    AND classroom_id IS DISTINCT FROM NEW.classroom_id;

  -- 1b. Inherit any lessons that are already unlocked in the new classroom
  -- We find all lessons that are active (unlocked/completed) in the new classroom
  -- and ensure the student has them unlocked as well.
  -- If a student already has a progress record for that lesson (e.g. completed/unlocked from the old class),
  -- we keep their completion status but update the classroom_id. If it is locked, we unlock it.
  INSERT INTO public.student_topic_progress (student_id, classroom_id, lesson_id, status, unlocked_by, unlocked_at)
  SELECT DISTINCT 
    NEW.student_id, 
    NEW.classroom_id, 
    p.lesson_id, 
    'unlocked', 
    'system', 
    now()
  FROM public.student_topic_progress p
  WHERE p.classroom_id = NEW.classroom_id 
    AND p.status IN ('unlocked', 'completed')
    AND p.student_id IS DISTINCT FROM NEW.student_id
  ON CONFLICT (student_id, lesson_id) 
  DO UPDATE SET 
    classroom_id = NEW.classroom_id,
    status = CASE 
      WHEN student_topic_progress.status = 'locked' THEN 'unlocked'
      ELSE student_topic_progress.status 
    END;

  -- 2. Transfer attendance logs (attendance)
  -- attendance has a UNIQUE constraint on (student_id, classroom_id, date).
  -- We transfer all attendance records, ensuring we don't cause conflicts if a record for the new class on the same day already exists.
  UPDATE public.attendance att
  SET classroom_id = NEW.classroom_id
  WHERE student_id = NEW.student_id 
    AND classroom_id IS DISTINCT FROM NEW.classroom_id
    AND NOT EXISTS (
      SELECT 1 FROM public.attendance sub_att
      WHERE sub_att.student_id = NEW.student_id 
        AND sub_att.classroom_id = NEW.classroom_id
        AND sub_att.date = att.date
    );

  -- 3. Transfer task submissions (assignment_students)
  -- We match assignments from other classrooms to the new classroom by:
  --   a) Matching non-null inventory_ref_id (lesson/chapter references)
  --   b) Standard matching of names/titles (case-insensitive) if inventory_ref_id is null
  UPDATE public.assignment_students ast
  SET assignment_id = new_asg.id
  FROM public.assignments old_asg
  JOIN public.assignments new_asg ON (
    new_asg.classroom_id = NEW.classroom_id 
    AND (
      (new_asg.inventory_ref_id IS NOT NULL AND old_asg.inventory_ref_id = new_asg.inventory_ref_id)
      OR (new_asg.inventory_ref_id IS NULL AND old_asg.inventory_ref_id IS NULL AND LOWER(TRIM(old_asg.title)) = LOWER(TRIM(new_asg.title)))
    )
  )
  WHERE ast.student_id = NEW.student_id
    AND ast.assignment_id = old_asg.id
    AND old_asg.classroom_id IS DISTINCT FROM NEW.classroom_id
    AND NOT EXISTS (
      SELECT 1 FROM public.assignment_students sub_ast
      WHERE sub_ast.student_id = NEW.student_id 
        AND sub_ast.assignment_id = new_asg.id
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the trigger to the classroom_students table
DROP TRIGGER IF EXISTS trg_student_classroom_shift ON public.classroom_students;
CREATE TRIGGER trg_student_classroom_shift
  AFTER INSERT OR UPDATE ON public.classroom_students
  FOR EACH ROW EXECUTE FUNCTION public.transfer_student_history_on_class_shift();
