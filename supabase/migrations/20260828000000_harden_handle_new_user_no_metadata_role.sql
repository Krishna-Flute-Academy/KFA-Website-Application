-- ============================================================================
-- Migration: Harden handle_new_user trigger against metadata role spoofing
-- Description: New users are ALWAYS inserted with role='pending', regardless
--              of what raw_user_meta_data contains. role is user-editable via
--              the Supabase API, so trusting it for privilege assignment is a
--              privilege-escalation vector. Only admins may elevate a user's
--              role via public.users UPDATE (protected by RLS).
--
--              The existing-user merge path (email match) still preserves the
--              role already stored in public.users — that path is safe because
--              the role is read from the DB row, not from metadata.
-- ============================================================================

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
    -- Insert the new auth user row, preserving the role already stored in public.users.
    -- NOTE: role comes from the DB row (safe), NOT from raw_user_meta_data.
    INSERT INTO public.users (id, name, email, phone, role, status, join_date, teacher_id, level)
    SELECT NEW.id,
           COALESCE(NEW.raw_user_meta_data->>'full_name', name),
           email,
           COALESCE(NEW.raw_user_meta_data->>'phone', phone),
           COALESCE(role, 'pending'),   -- role from DB only, never from metadata
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
    -- SECURITY FIX: Brand new users always start as 'pending'.
    -- raw_user_meta_data is user-editable — a crafted signup with
    -- role='admin' in metadata would previously have created an admin user.
    -- Admins must explicitly elevate users via public.users UPDATE (RLS-protected).
    INSERT INTO public.users (id, name, email, phone, role, status, join_date)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      NEW.email,
      NEW.raw_user_meta_data->>'phone',
      'pending',   -- always 'pending', never from metadata
      'active',
      CURRENT_DATE
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
