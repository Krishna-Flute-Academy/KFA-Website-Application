-- SQL Script to create permanent Saturday classrooms and batch schedules for Krishna Flute Academy.
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

  -- 2. Insert Saturday Slot 1 (Online - 8:00 AM)
  INSERT INTO public.classrooms (name, type, teacher_id, description, status)
  VALUES ('Saturday Slot 1 (Online - 8 AM)', 'permanent', v_teacher_id, 'Saturday morning online flute session. [delivery_format:online]', 'active')
  RETURNING id INTO v_class_id;

  INSERT INTO public.batch_schedules (classroom_id, day_of_week, start_time, end_time)
  VALUES (v_class_id, 6, '08:00:00', '09:00:00');

  -- 3. Insert Saturday Slot 2 (Online - 9:00 AM)
  INSERT INTO public.classrooms (name, type, teacher_id, description, status)
  VALUES ('Saturday Slot 2 (Online - 9 AM)', 'permanent', v_teacher_id, 'Saturday morning online flute session. [delivery_format:online]', 'active')
  RETURNING id INTO v_class_id;

  INSERT INTO public.batch_schedules (classroom_id, day_of_week, start_time, end_time)
  VALUES (v_class_id, 6, '09:00:00', '10:00:00');

  -- 4. Insert Saturday Slot 3 (Offline - 10:00 AM)
  INSERT INTO public.classrooms (name, type, teacher_id, description, status)
  VALUES ('Saturday Slot 3 (Offline - 10 AM)', 'permanent', v_teacher_id, 'Saturday offline flute session. [delivery_format:offline]', 'active')
  RETURNING id INTO v_class_id;

  INSERT INTO public.batch_schedules (classroom_id, day_of_week, start_time, end_time)
  VALUES (v_class_id, 6, '10:00:00', '11:00:00');

  -- 5. Insert Saturday Slot 4 (Offline - 11:00 AM)
  INSERT INTO public.classrooms (name, type, teacher_id, description, status)
  VALUES ('Saturday Slot 4 (Offline - 11 AM)', 'permanent', v_teacher_id, 'Saturday offline flute session. [delivery_format:offline]', 'active')
  RETURNING id INTO v_class_id;

  INSERT INTO public.batch_schedules (classroom_id, day_of_week, start_time, end_time)
  VALUES (v_class_id, 6, '11:00:00', '12:00:00');

  -- 6. Insert Saturday Slot 5 (Offline - 12:00 PM)
  INSERT INTO public.classrooms (name, type, teacher_id, description, status)
  VALUES ('Saturday Slot 5 (Offline - 12 PM)', 'permanent', v_teacher_id, 'Saturday afternoon offline flute session. [delivery_format:offline]', 'active')
  RETURNING id INTO v_class_id;

  INSERT INTO public.batch_schedules (classroom_id, day_of_week, start_time, end_time)
  VALUES (v_class_id, 6, '12:00:00', '13:00:00');

  -- 7. Insert Saturday Slot 6 (Offline - 1:00 PM)
  INSERT INTO public.classrooms (name, type, teacher_id, description, status)
  VALUES ('Saturday Slot 6 (Offline - 1 PM)', 'permanent', v_teacher_id, 'Saturday afternoon offline flute session. [delivery_format:offline]', 'active')
  RETURNING id INTO v_class_id;

  INSERT INTO public.batch_schedules (classroom_id, day_of_week, start_time, end_time)
  VALUES (v_class_id, 6, '13:00:00', '14:00:00');

  -- 8. Insert Saturday Slot 7 (Offline - 2:00 PM)
  INSERT INTO public.classrooms (name, type, teacher_id, description, status)
  VALUES ('Saturday Slot 7 (Offline - 2 PM)', 'permanent', v_teacher_id, 'Saturday afternoon offline flute session. [delivery_format:offline]', 'active')
  RETURNING id INTO v_class_id;

  INSERT INTO public.batch_schedules (classroom_id, day_of_week, start_time, end_time)
  VALUES (v_class_id, 6, '14:00:00', '15:00:00');

  -- 9. Insert Saturday Slot 8 (Online - 3:00 PM)
  INSERT INTO public.classrooms (name, type, teacher_id, description, status)
  VALUES ('Saturday Slot 8 (Online - 3 PM)', 'permanent', v_teacher_id, 'Saturday afternoon online flute session. [delivery_format:online]', 'active')
  RETURNING id INTO v_class_id;

  INSERT INTO public.batch_schedules (classroom_id, day_of_week, start_time, end_time)
  VALUES (v_class_id, 6, '15:00:00', '16:00:00');

  -- 10. Insert Saturday Slot 9 (Online - 4:00 PM)
  INSERT INTO public.classrooms (name, type, teacher_id, description, status)
  VALUES ('Saturday Slot 9 (Online - 4 PM)', 'permanent', v_teacher_id, 'Saturday afternoon online flute session. [delivery_format:online]', 'active')
  RETURNING id INTO v_class_id;

  INSERT INTO public.batch_schedules (classroom_id, day_of_week, start_time, end_time)
  VALUES (v_class_id, 6, '16:00:00', '17:00:00');

  -- 11. Insert Saturday Slot 10 (Online - 5:00 PM)
  INSERT INTO public.classrooms (name, type, teacher_id, description, status)
  VALUES ('Saturday Slot 10 (Online - 5 PM)', 'permanent', v_teacher_id, 'Saturday evening online flute session. [delivery_format:online]', 'active')
  RETURNING id INTO v_class_id;

  INSERT INTO public.batch_schedules (classroom_id, day_of_week, start_time, end_time)
  VALUES (v_class_id, 6, '17:00:00', '18:00:00');

  -- 12. Insert Saturday Slot 11 (Online - 6:30 PM)
  INSERT INTO public.classrooms (name, type, teacher_id, description, status)
  VALUES ('Saturday Slot 11 (Online - 6:30 PM)', 'permanent', v_teacher_id, 'Saturday evening online flute session. [delivery_format:online]', 'active')
  RETURNING id INTO v_class_id;

  INSERT INTO public.batch_schedules (classroom_id, day_of_week, start_time, end_time)
  VALUES (v_class_id, 6, '18:30:00', '19:30:00');

  -- 13. Insert Saturday Slot 12 (Online - 7:30 PM)
  INSERT INTO public.classrooms (name, type, teacher_id, description, status)
  VALUES ('Saturday Slot 12 (Online - 7:30 PM)', 'permanent', v_teacher_id, 'Saturday evening online flute session. [delivery_format:online]', 'active')
  RETURNING id INTO v_class_id;

  INSERT INTO public.batch_schedules (classroom_id, day_of_week, start_time, end_time)
  VALUES (v_class_id, 6, '19:30:00', '20:30:00');

  RAISE NOTICE 'Successfully created all Saturday classrooms assigned to Krishna Gopal Bhaumik!';
END $$;
