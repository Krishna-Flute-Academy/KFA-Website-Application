-- Migration: Add Admin Notification Trigger on Auth Email Confirmation
-- This function runs when a user's auth profile is updated (specifically when email_confirmed_at changes from NULL to a timestamp).
-- It inserts a notification for all admins and teachers to review the pending user registration.

CREATE OR REPLACE FUNCTION public.handle_auth_user_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_rec RECORD;
  v_user_name TEXT;
BEGIN
  -- Check if the email was just confirmed (transitioned from NULL to a value)
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    
    -- Get user name from metadata or email
    v_user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

    -- Find all users with role 'admin' or 'teacher' to notify them
    FOR admin_rec IN 
      SELECT id FROM public.users WHERE role = 'admin' OR role = 'teacher'
    LOOP
      -- Check if we already created a notification for this admin regarding this email recently to prevent duplicate inserts
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications 
        WHERE user_id = admin_rec.id 
          AND title = 'New User Registration'
          AND message LIKE '%' || NEW.email || '%'
      ) THEN
        INSERT INTO public.notifications (user_id, title, message, type, is_read)
        VALUES (
          admin_rec.id,
          'New User Registration',
          v_user_name || ' (' || NEW.email || ') has verified their email and is pending approval.',
          'reminder',
          false
        );
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach the trigger to auth.users for updates
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_auth_user_update();
