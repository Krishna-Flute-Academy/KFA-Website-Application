-- SQL Script to create permanent Friday classrooms and batch schedules for Krishna Flute Academy.
-- This script finds the instructor "Krishna Gopal Bhaumik" in the users table to assign the classrooms.

DO $$
DECLARE
  v_teacher_id UUID;
  v_class_id UUID;
BEGIN
  -- 1. Find the teacher ID for Krishna Gopal Bhaumik (case-insensitive, matching full or partial name)
  SELECT id INTO v_teacher_id FROM public.users WHERE name ILIKE '%Krishna Gopal Bhaumik%' LIMIT 1;
  
  -- Fallback check for just "Bhaumik" if the full name isn't found
  IF v_teacher_id IS NULL THEN
    SELECT id INTO v_teacher_id FROM public.users WHERE name ILIKE '%Bhaumik%' LIMIT 1;
  END IF;
  
  -- Final general fallback to prevent failure, but raising warning/notice
  IF v_teacher_id IS NULL THEN
    SELECT id INTO v_teacher_id FROM public.users WHERE role IN ('teacher', 'admin') AND status = 'active' LIMIT 1;
    RAISE WARNING 'Teacher "Krishna Gopal Bhaumik" not found. Falling back to default ID: %', v_teacher_id;
  END IF;
  
  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'No teacher or admin user found in public.users table. Please create a user first.';
  END IF;

  RAISE NOTICE 'Using Teacher ID: %', v_teacher_id;

  -- 2. Insert Friday Slot 1 (Online - 7:00 AM)
  INSERT INTO public.classrooms (name, type, teacher_id, description, status)
  VALUES ('Friday Slot 1 (Online - 7 AM)', 'permanent', v_teacher_id, 'Friday morning online flute session. [delivery_format:online]', 'active')
  RETURNING id INTO v_class_id;

  INSERT INTO public.batch_schedules (classroom_id, day_of_week, start_time, end_time)
  VALUES (v_class_id, 5, '07:00:00', '08:00:00');

  -- 3. Insert Friday Slot 2 (Online - 8:00 AM)
  INSERT INTO public.classrooms (name, type, teacher_id, description, status)
  VALUES ('Friday Slot 2 (Online - 8 AM)', 'permanent', v_teacher_id, 'Friday morning online flute session. [delivery_format:online]', 'active')
  RETURNING id INTO v_class_id;

  INSERT INTO public.batch_schedules (classroom_id, day_of_week, start_time, end_time)
  VALUES (v_class_id, 5, '08:00:00', '09:00:00');

  -- 4. Insert Friday Slot 3 (Offline - 9:00 AM)
  INSERT INTO public.classrooms (name, type, teacher_id, description, status)
  VALUES ('Friday Slot 3 (Offline - 9 AM)', 'permanent', v_teacher_id, 'Friday morning offline flute session. [delivery_format:offline]', 'active')
  RETURNING id INTO v_class_id;

  INSERT INTO public.batch_schedules (classroom_id, day_of_week, start_time, end_time)
  VALUES (v_class_id, 5, '09:00:00', '10:00:00');

  -- 5. Insert Friday Slot 4 (Online - 4:30 PM)
  INSERT INTO public.classrooms (name, type, teacher_id, description, status)
  VALUES ('Friday Slot 4 (Online - 4:30 PM)', 'permanent', v_teacher_id, 'Friday afternoon online flute session. [delivery_format:online]', 'active')
  RETURNING id INTO v_class_id;

  INSERT INTO public.batch_schedules (classroom_id, day_of_week, start_time, end_time)
  VALUES (v_class_id, 5, '16:30:00', '17:30:00');

  -- 6. Insert Friday Slot 5 (Online - 5:30 PM)
  INSERT INTO public.classrooms (name, type, teacher_id, description, status)
  VALUES ('Friday Slot 5 (Online - 5:30 PM)', 'permanent', v_teacher_id, 'Friday afternoon online flute session. [delivery_format:online]', 'active')
  RETURNING id INTO v_class_id;

  INSERT INTO public.batch_schedules (classroom_id, day_of_week, start_time, end_time)
  VALUES (v_class_id, 5, '17:30:00', '18:30:00');

  RAISE NOTICE 'Successfully created all Friday classrooms assigned to Krishna Gopal Bhaumik!';
END $$;
