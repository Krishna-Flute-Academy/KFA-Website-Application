/*
  # Users Table: Auto-Profile Trigger Update for Merging

  ## Purpose
  When a student is manually added by a teacher, a row is created in `public.users` with a random UUID.
  When the student later signs up using the same email, Supabase Auth creates a new `auth.users` row with a new UUID.
  
  This updated trigger checks if an existing profile with the same email already exists.
  If it does, it dynamically updates all foreign-key references from the old ID to the new ID,
  preserves the teacher's configured data (like `teacher_id` and `level`), and deletes the old profile.
  
  This seamlessly links the Teacher Dashboard enrollments with the Student Portal signups.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_id UUID;
BEGIN
  -- Check if a user with this email already exists in public.users
  SELECT id INTO existing_id FROM public.users WHERE email = NEW.email LIMIT 1;

  IF existing_id IS NOT NULL AND existing_id != NEW.id THEN
    -- A profile already exists (e.g. created by a teacher before the student signed up).
    -- Insert the new user profile first to satisfy foreign keys
    INSERT INTO public.users (id, name, email, phone, role, status, join_date, teacher_id, level)
    SELECT NEW.id, 
           COALESCE(NEW.raw_user_meta_data->>'full_name', name), 
           email, 
           COALESCE(NEW.raw_user_meta_data->>'phone', phone), 
           role, 
           status, 
           join_date, 
           teacher_id, 
           level
    FROM public.users WHERE id = existing_id
    ON CONFLICT (id) DO NOTHING;

    -- Update all known foreign key references dynamically (avoids failure if table doesn't exist)
    -- Student references
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'classroom_students') THEN
      EXECUTE 'UPDATE public.classroom_students SET student_id = $1 WHERE student_id = $2' USING NEW.id, existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'attendance') THEN
      EXECUTE 'UPDATE public.attendance SET student_id = $1 WHERE student_id = $2' USING NEW.id, existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'assignment_students') THEN
      EXECUTE 'UPDATE public.assignment_students SET student_id = $1 WHERE student_id = $2' USING NEW.id, existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'student_topic_progress') THEN
      EXECUTE 'UPDATE public.student_topic_progress SET student_id = $1 WHERE student_id = $2' USING NEW.id, existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'session_student_overrides') THEN
      EXECUTE 'UPDATE public.session_student_overrides SET student_id = $1 WHERE student_id = $2' USING NEW.id, existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fees_payments') THEN
      EXECUTE 'UPDATE public.fees_payments SET student_id = $1 WHERE student_id = $2' USING NEW.id, existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fees_notifications') THEN
      EXECUTE 'UPDATE public.fees_notifications SET student_id = $1 WHERE student_id = $2' USING NEW.id, existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'classroom_inventory_allocation') THEN
      EXECUTE 'UPDATE public.classroom_inventory_allocation SET allocated_to_student_id = $1 WHERE allocated_to_student_id = $2' USING NEW.id, existing_id;
    END IF;

    -- Teacher references (if a teacher was added manually and then signed up)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'classrooms') THEN
      EXECUTE 'UPDATE public.classrooms SET teacher_id = $1 WHERE teacher_id = $2' USING NEW.id, existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'class_notes') THEN
      EXECUTE 'UPDATE public.class_notes SET teacher_id = $1 WHERE teacher_id = $2' USING NEW.id, existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'assignments') THEN
      EXECUTE 'UPDATE public.assignments SET teacher_id = $1 WHERE teacher_id = $2' USING NEW.id, existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'course_modules') THEN
      EXECUTE 'UPDATE public.course_modules SET teacher_id = $1 WHERE teacher_id = $2' USING NEW.id, existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
      EXECUTE 'UPDATE public.users SET teacher_id = $1 WHERE teacher_id = $2' USING NEW.id, existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'attendance') THEN
      EXECUTE 'UPDATE public.attendance SET teacher_id = $1 WHERE teacher_id = $2' USING NEW.id, existing_id;
    END IF;

    -- Finally, delete the old unauthenticated profile
    DELETE FROM public.users WHERE id = existing_id;
  ELSE
    -- Normal insert for completely new users
    INSERT INTO public.users (id, name, email, phone, role, status, join_date)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      NEW.email,
      NEW.raw_user_meta_data->>'phone',
      COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
      'active',
      CURRENT_DATE
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
