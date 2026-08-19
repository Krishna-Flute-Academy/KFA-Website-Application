-- ============================================================
-- Migration: Allocate bhaumikg1986@gmail.com and pranshudev757@gmail.com as Students
-- Description: Ensures Bhaumik and Pranshu exist as active students in public.users and auth.users
-- ============================================================

-- 1. Upsert public.users for bhaumikg1986@gmail.com
INSERT INTO public.users (
  id, name, email, role, status, join_date, level, fees_basis, fees_amount, fees_classes_paid, fees_collection_date
)
VALUES (
  gen_random_uuid(), 'Bhaumik', 'bhaumikg1986@gmail.com', 'student', 'active', CURRENT_DATE, 'beginner', 'monthly', 2400, 4, 1
)
ON CONFLICT (email) DO UPDATE 
SET role = 'student',
    status = 'active',
    level = COALESCE(public.users.level, 'beginner');

-- 2. Upsert public.users for pranshudev757@gmail.com
INSERT INTO public.users (
  id, name, email, role, status, join_date, level, fees_basis, fees_amount, fees_classes_paid, fees_collection_date
)
VALUES (
  gen_random_uuid(), 'Pranshu Dev', 'pranshudev757@gmail.com', 'student', 'active', CURRENT_DATE, 'beginner', 'monthly', 2400, 4, 1
)
ON CONFLICT (email) DO UPDATE 
SET role = 'student',
    status = 'active',
    level = COALESCE(public.users.level, 'beginner');

-- 3. Update any related emails/aliases matching bhaumik or pranshu in public.users
UPDATE public.users
SET role = 'student',
    status = 'active'
WHERE LOWER(email) LIKE '%bhaumik%'
   OR LOWER(email) LIKE '%pranshu%'
   OR LOWER(email) LIKE '%pransai%';

-- 4. Update auth.users metadata for registered users matching these emails
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{role}', '"student"')
    WHERE LOWER(email) LIKE '%bhaumik%'
       OR LOWER(email) LIKE '%pranshu%'
       OR LOWER(email) LIKE '%pransai%';
  END IF;
END $$;
