-- Migration: Preserve Historical Attendance on Classroom Shift
-- Description:
-- Updates transfer_student_history_on_class_shift() to ensure that historical
-- attendance records in public.attendance are IMMUTABLE.
-- When a student is transferred/re-assigned to a new classroom, their past attendance
-- records MUST remain tied to the historical classroom where the class actually occurred.
-- Curriculum progress, assignment submissions, and student-specific allocations continue
-- to follow the student into their new classroom.

CREATE OR REPLACE FUNCTION public.transfer_student_history_on_class_shift()
RETURNS TRIGGER AS $$
DECLARE
  old_classroom_ids UUID[];
  t_id UUID;
  v_target_type TEXT;
BEGIN
  -- Check if destination is a non-operational learning circle
  SELECT type, teacher_id INTO v_target_type, t_id 
  FROM public.classrooms 
  WHERE id = NEW.classroom_id 
  LIMIT 1;

  -- If target is learning circle, DO NOT transfer curriculum progress or allocations
  IF v_target_type = 'learning_circle' THEN
    RETURN NEW;
  END IF;

  -- Collect the student's old classroom IDs from their current progress and student-specific allocations
  SELECT ARRAY_AGG(DISTINCT cid) INTO old_classroom_ids
  FROM (
    SELECT classroom_id AS cid FROM public.student_topic_progress WHERE student_id = NEW.student_id AND classroom_id IS DISTINCT FROM NEW.classroom_id
    UNION
    SELECT classroom_id AS cid FROM public.classroom_inventory_allocation WHERE allocated_to_student_id = NEW.student_id AND classroom_id IS DISTINCT FROM NEW.classroom_id
  ) sub;

  -- 1. Transfer curriculum progress (student_topic_progress)
  UPDATE public.student_topic_progress
  SET classroom_id = NEW.classroom_id
  WHERE student_id = NEW.student_id 
    AND classroom_id IS DISTINCT FROM NEW.classroom_id;

  -- 2. NOTE: Historical attendance records in public.attendance are explicitly PRESERVED and IMMUTABLE.
  -- Past attendance logs MUST remain permanently associated with the classroom where the class occurred.
  -- Therefore, the previous UPDATE on public.attendance has been intentionally removed.

  -- 3. Transfer task submissions (assignment_students)
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

  -- 5. Copy class-wide allocations from the old classrooms to the new classroom as student-specific allocations
  IF old_classroom_ids IS NOT NULL AND ARRAY_LENGTH(old_classroom_ids, 1) > 0 THEN
    INSERT INTO public.classroom_inventory_allocation (
      classroom_id,
      module_id,
      chapter_id,
      lesson_id,
      allocated_by,
      allocated_to_student_id,
      created_at
    )
    SELECT DISTINCT
      NEW.classroom_id,
      a.module_id,
      a.chapter_id,
      a.lesson_id,
      a.allocated_by,
      NEW.student_id,
      now()
    FROM public.classroom_inventory_allocation a
    WHERE a.classroom_id = ANY(old_classroom_ids)
      AND a.allocated_to_student_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.classroom_inventory_allocation sub_a
        WHERE sub_a.classroom_id = NEW.classroom_id
          AND (
            sub_a.allocated_to_student_id = NEW.student_id OR 
            sub_a.allocated_to_student_id IS NULL
          )
          AND (
            (sub_a.module_id IS NOT DISTINCT FROM a.module_id) AND
            (sub_a.chapter_id IS NOT DISTINCT FROM a.chapter_id) AND
            (sub_a.lesson_id IS NOT DISTINCT FROM a.lesson_id)
          )
      );
  END IF;

  -- 6. Create student-specific allocations in the new classroom for the lessons the student has active progress in
  INSERT INTO public.classroom_inventory_allocation (
    classroom_id,
    lesson_id,
    allocated_to_student_id,
    allocated_by,
    created_at
  )
  SELECT DISTINCT
    NEW.classroom_id,
    p.lesson_id,
    NEW.student_id,
    t_id,
    now()
  FROM public.student_topic_progress p
  WHERE p.student_id = NEW.student_id
    AND p.classroom_id = NEW.classroom_id
    AND p.status IN ('unlocked', 'completed')
    AND NOT EXISTS (
      SELECT 1 FROM public.classroom_inventory_allocation a
      WHERE a.classroom_id = NEW.classroom_id
        AND a.lesson_id = p.lesson_id
        AND (a.allocated_to_student_id = NEW.student_id OR a.allocated_to_student_id IS NULL)
    );

  -- 7. Create student-specific allocations in the new classroom for the chapters of the student's active progress lessons
  INSERT INTO public.classroom_inventory_allocation (
    classroom_id,
    chapter_id,
    allocated_to_student_id,
    allocated_by,
    created_at
  )
  SELECT DISTINCT
    NEW.classroom_id,
    l.chapter_id,
    NEW.student_id,
    t_id,
    now()
  FROM public.student_topic_progress p
  JOIN public.course_lessons l ON l.id = p.lesson_id
  WHERE p.student_id = NEW.student_id
    AND p.classroom_id = NEW.classroom_id
    AND p.status IN ('unlocked', 'completed')
    AND NOT EXISTS (
      SELECT 1 FROM public.classroom_inventory_allocation a
      WHERE a.classroom_id = NEW.classroom_id
        AND a.chapter_id = l.chapter_id
        AND (a.allocated_to_student_id = NEW.student_id OR a.allocated_to_student_id IS NULL)
    );

  -- 8. Create student-specific allocations in the new classroom for the modules/levels of the student's active progress lessons
  INSERT INTO public.classroom_inventory_allocation (
    classroom_id,
    module_id,
    allocated_to_student_id,
    allocated_by,
    created_at
  )
  SELECT DISTINCT
    NEW.classroom_id,
    c.module_id,
    NEW.student_id,
    t_id,
    now()
  FROM public.student_topic_progress p
  JOIN public.course_lessons l ON l.id = p.lesson_id
  JOIN public.course_chapters c ON c.id = l.chapter_id
  WHERE p.student_id = NEW.student_id
    AND p.classroom_id = NEW.classroom_id
    AND p.status IN ('unlocked', 'completed')
    AND NOT EXISTS (
      SELECT 1 FROM public.classroom_inventory_allocation a
      WHERE a.classroom_id = NEW.classroom_id
        AND a.module_id = c.module_id
        AND (a.allocated_to_student_id = NEW.student_id OR a.allocated_to_student_id IS NULL)
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
