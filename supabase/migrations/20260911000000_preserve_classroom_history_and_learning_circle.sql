-- Migration: Preserve Permanent Classroom History & Structurally Isolate Learning Circle
-- Description:
-- 1. Updates handle_student_archival() to insert student into KFA Learning Circle without overwriting or deleting permanent classroom history.
-- 2. Guards transfer_student_history_on_class_shift() so moving into learning_circle never hijacks attendance logs or curriculum allocations.
-- 3. Updates can_view_classroom and can_participate_in_classroom RLS functions to ensure inactive/paused students cannot view or participate in active classrooms.

-- 1. Update handle_student_archival trigger function
CREATE OR REPLACE FUNCTION public.handle_student_archival()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_learning_circle_id UUID;
BEGIN
  -- Trigger runs when student status changes to 'archived' or 'inactive'
  IF (NEW.status = 'archived' OR NEW.status = 'inactive') AND (OLD.status IS NULL OR OLD.status = 'active') THEN
    
    -- Fetch KFA Learning Circle classroom ID by structural type or name
    SELECT id INTO v_learning_circle_id 
    FROM public.classrooms 
    WHERE type = 'learning_circle' OR LOWER(TRIM(name)) = LOWER(TRIM('KFA Learning Circle')) 
    ORDER BY (type = 'learning_circle') DESC
    LIMIT 1;

    IF v_learning_circle_id IS NOT NULL THEN
      -- Add student to KFA Learning Circle WITHOUT overwriting existing permanent classroom record
      IF NOT EXISTS (
        SELECT 1 FROM public.classroom_students 
        WHERE student_id = NEW.id AND classroom_id = v_learning_circle_id
      ) THEN
        INSERT INTO public.classroom_students (classroom_id, student_id, joined_at)
        VALUES (v_learning_circle_id, NEW.id, now());
      END IF;

      -- Remove future scheduled temporary overrides/makeups upon pausing/archival
      DELETE FROM public.session_student_overrides 
      WHERE student_id = NEW.id 
        AND override_date >= CURRENT_DATE;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Guard transfer_student_history_on_class_shift against non-operational learning_circle
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

  -- If target is learning circle, DO NOT transfer curriculum progress or attendance
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

  -- 2. Transfer attendance logs (attendance)
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

-- 3. Hardened can_view_classroom checking active status
CREATE OR REPLACE FUNCTION public.can_view_classroom(c_id uuid, u_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (
    (SELECT public.is_admin_or_teacher()) OR
    -- Enrolled student: active student OR non-operational learning circle
    EXISTS (
      SELECT 1 FROM public.classroom_students cs
      JOIN public.users u ON u.id = cs.student_id
      JOIN public.classrooms c ON c.id = cs.classroom_id
      WHERE cs.classroom_id = c_id AND cs.student_id = u_id
        AND (
          u.status = 'active' OR
          c.type = 'learning_circle'
        )
    ) OR
    -- Override student (must be active):
    EXISTS (
      SELECT 1 FROM public.session_student_overrides sso
      JOIN public.users u ON u.id = sso.student_id
      WHERE sso.target_classroom_id = c_id AND sso.student_id = u_id
        AND u.status = 'active'
    ) OR
    -- Temporary classroom student (must be active):
    EXISTS (
      SELECT 1 FROM public.temporary_classes tc
      JOIN public.temporary_class_students tcs ON tcs.temporary_class_id = tc.id
      JOIN public.users u ON u.id = tcs.student_id
      WHERE (tc.classroom_id = c_id OR tc.id = c_id) AND tcs.student_id = u_id
        AND u.status = 'active'
    )
  );
$$;

-- 4. Hardened can_participate_in_classroom checking active status
CREATE OR REPLACE FUNCTION public.can_participate_in_classroom(c_id uuid, u_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (
    (SELECT public.is_admin_or_teacher()) OR
    -- Permanent classroom student participation (MUST be active student):
    (
      EXISTS (
        SELECT 1 FROM public.classroom_students cs
        JOIN public.users u ON u.id = cs.student_id
        JOIN public.classrooms c ON c.id = cs.classroom_id
        WHERE cs.classroom_id = c_id 
          AND cs.student_id = u_id
          AND u.status = 'active'
          AND c.status = 'active'
          AND (c.type IS NULL OR c.type = 'permanent')
      )
    ) OR
    -- Permanent classroom makeup on that date (MUST be active student):
    (
      EXISTS (
        SELECT 1 FROM public.session_student_overrides sso
        JOIN public.users u ON u.id = sso.student_id
        JOIN public.classrooms c ON c.id = sso.target_classroom_id
        WHERE sso.target_classroom_id = c_id 
          AND sso.student_id = u_id
          AND u.status = 'active'
          AND sso.override_date = CURRENT_DATE
          AND c.status = 'active'
          AND (c.type IS NULL OR c.type = 'permanent')
      )
    ) OR
    -- Special Session / Temporary classroom participation (MUST be active student):
    (
      EXISTS (
        SELECT 1 FROM public.session_student_overrides sso
        JOIN public.users u ON u.id = sso.student_id
        JOIN public.classrooms c ON c.id = sso.target_classroom_id
        WHERE sso.target_classroom_id = c_id 
          AND sso.student_id = u_id
          AND u.status = 'active'
          AND c.type = 'temporary'
          -- Must NOT be completed or cancelled:
          AND NOT EXISTS (
            SELECT 1 FROM public.temporary_classes tc
            WHERE tc.classroom_id = c_id 
              AND tc.lifecycle_status IN ('completed', 'cancelled')
          )
      )
    )
  );
$$;
