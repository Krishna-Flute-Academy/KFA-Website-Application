-- Migration: Update transfer_student_history_on_class_shift trigger function
-- Description: Removes the section that automatically copies other students' active topic progress
-- when a student shifts/enrolls in a new classroom, keeping student progress independent.
-- Also transfers student-specific curriculum allocations to the new classroom.

CREATE OR REPLACE FUNCTION public.transfer_student_history_on_class_shift()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Transfer curriculum progress (student_topic_progress)
  -- student_topic_progress has a UNIQUE constraint on (student_id, lesson_id), so shifting classroom_id is straightforward.
  UPDATE public.student_topic_progress
  SET classroom_id = NEW.classroom_id
  WHERE student_id = NEW.student_id 
    AND classroom_id IS DISTINCT FROM NEW.classroom_id;

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

  -- 4. Transfer student-specific curriculum allocations
  UPDATE public.classroom_inventory_allocation
  SET classroom_id = NEW.classroom_id
  WHERE allocated_to_student_id = NEW.student_id
    AND classroom_id IS DISTINCT FROM NEW.classroom_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
