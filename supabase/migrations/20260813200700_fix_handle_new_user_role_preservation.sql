-- Migration: Fix handle_new_user trigger to preserve public.users role over auth metadata
-- and clean up pransai.verse@gmail.com metadata role.

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
    -- A profile already exists (e.g. created by a teacher/admin before the user signed up).
    -- Insert the new user profile first to satisfy foreign keys, preserving existing role in public.users
    INSERT INTO public.users (id, name, email, phone, role, status, join_date, teacher_id, level)
    SELECT NEW.id, 
           COALESCE(NEW.raw_user_meta_data->>'full_name', name), 
           email, 
           COALESCE(NEW.raw_user_meta_data->>'phone', phone), 
           COALESCE(role, NEW.raw_user_meta_data->>'role', 'pending'), 
           status, 
           join_date, 
           teacher_id, 
           level
    FROM public.users WHERE id = existing_id
    ON CONFLICT (id) DO NOTHING;

    -- Update all known foreign key references dynamically
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'classroom_students') THEN
      EXECUTE 'UPDATE public.classroom_students SET student_id = $1 WHERE student_id = $2' USING NEW.id, existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'attendance') THEN
      EXECUTE 'UPDATE public.attendance SET student_id = $1 WHERE student_id = $2' USING NEW.id, existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'assignment_students') THEN
      EXECUTE 'UPDATE public.assignment_students SET student_id = $1 WHERE student_id = $2' USING NEW.id, existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fees_payments') THEN
      EXECUTE 'UPDATE public.fees_payments SET student_id = $1 WHERE student_id = $2' USING NEW.id, existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fees_notifications') THEN
      EXECUTE 'UPDATE public.fees_notifications SET student_id = $1 WHERE student_id = $2' USING NEW.id, existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'session_student_overrides') THEN
      EXECUTE 'UPDATE public.session_student_overrides SET student_id = $1 WHERE student_id = $2' USING NEW.id, existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'leave_requests') THEN
      EXECUTE 'UPDATE public.leave_requests SET student_id = $1 WHERE student_id = $2' USING NEW.id, existing_id;
    END IF;

    -- Delete old duplicate row
    DELETE FROM public.users WHERE id = existing_id;
  ELSE
    -- Normal insert for completely new users
    INSERT INTO public.users (id, name, email, phone, role, status, join_date)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      NEW.email,
      NEW.raw_user_meta_data->>'phone',
      COALESCE(NEW.raw_user_meta_data->>'role', 'pending'),
      'active',
      CURRENT_DATE
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Clean up auth metadata for pransai.verse@gmail.com so it no longer contains role = admin
UPDATE auth.users 
SET raw_user_meta_data = raw_user_meta_data - 'role'
WHERE email = 'pransai.verse@gmail.com';

-- Set public.users role for pransai.verse@gmail.com to student
UPDATE public.users 
SET role = 'student'
WHERE email = 'pransai.verse@gmail.com';
