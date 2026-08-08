/*
  # Users Table: RLS Policies + Auto-Profile Trigger

  ## Purpose
  When a new student signs up via the /signup page:
    1. Supabase Auth creates an auth.users row.
    2. The signup page tries to insert into public.users.

  This migration ensures:
    a) Authenticated users can insert/select/update their OWN row (auth.uid() = id).
    b) A TRIGGER on auth.users auto-creates the public.users row as a fallback,
       which is especially needed when email confirmation is enabled (session is null
       right after signup, so the client-side insert cannot run as the user yet).

  Run this in the Supabase SQL editor for the AUTH Supabase project
  (NEXT_PUBLIC_AUTH_SUPABASE_URL = https://sevtycwrmhzyfxvxkkgc.supabase.co).
*/

-- =====================================================
-- 1. Enable RLS on public.users (if not already done)
-- =====================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. RLS Policies for public.users
-- =====================================================

-- Allow any authenticated user to read all rows
-- (teachers need to read students, students need to read their own row)
DROP POLICY IF EXISTS "Authenticated users can read users" ON public.users;
CREATE POLICY "Authenticated users can read users"
  ON public.users FOR SELECT
  TO authenticated
  USING (true);

-- Allow a user to insert only their own row (id must match their auth UID)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Allow a user to update only their own row
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow teachers to insert student rows (teachers insert without matching UID)
-- This is needed by the /teacher-dashboard/students/add page which inserts
-- student rows that have no matching auth user (manual enrollment).
DROP POLICY IF EXISTS "Authenticated users can insert any user row" ON public.users;
CREATE POLICY "Authenticated users can insert any user row"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow teachers to update student rows
DROP POLICY IF EXISTS "Authenticated users can update any user row" ON public.users;
CREATE POLICY "Authenticated users can update any user row"
  ON public.users FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow teachers to delete student rows
DROP POLICY IF EXISTS "Authenticated users can delete any user row" ON public.users;
CREATE POLICY "Authenticated users can delete any user row"
  ON public.users FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- 3. Auto-Profile Trigger (Fallback for email confirm)
--    Creates the public.users row automatically when
--    a new auth user is created (e.g. after email confirm).
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only insert if a row doesn't already exist (avoid duplicate from client-side insert)
  INSERT INTO public.users (id, name, email, phone, role, status, join_date)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'pending'),
    'pending',
    CURRENT_DATE
  )
  ON CONFLICT (id) DO NOTHING; -- Safe: client-side insert already ran if session was available
  RETURN NEW;
END;
$$;

-- Attach the trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
