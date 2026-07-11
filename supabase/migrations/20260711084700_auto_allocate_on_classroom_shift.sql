-- Migration: Automatically transfer student curriculum progress and allocations on classroom shift
-- Description: Enhances the transfer_student_history_on_class_shift trigger function to automatically
-- copy class-wide allocations from old classrooms as student-specific allocations in the new classroom,
-- and auto-allocate lessons/chapters/modules for the student in the new classroom based on active progress.

CREATE OR REPLACE FUNCTION public.transfer_student_history_on_class_shift()
RETURNS TRIGGER AS $$
DECLARE
  old_classroom_ids UUID[];
  t_id UUID;
BEGIN
  -- Get the teacher ID for the new classroom
  SELECT teacher_id INTO t_id FROM public.classrooms WHERE id = NEW.classroom_id LIMIT 1;

  -- Collect the student's old classroom IDs from their current progress and student-specific allocations
  SELECT ARRAY_AGG(DISTINCT cid) INTO old_classroom_ids
  FROM (
    SELECT classroom_id AS cid FROM public.student_topic_progress WHERE student_id = NEW.student_id AND classroom_id IS DISTINCT FROM NEW.classroom_id
    UNION
    SELECT classroom_id AS cid FROM public.classroom_inventory_allocation WHERE allocated_to_student_id = NEW.student_id AND classroom_id IS DISTINCT FROM NEW.classroom_id
  ) sub;

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
