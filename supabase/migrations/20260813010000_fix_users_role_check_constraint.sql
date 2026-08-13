-- ============================================================
-- Migration: Update users_role_check constraint to include 'mentor'
-- ============================================================

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'teacher', 'admin', 'pending', 'mentor'));
