-- ==============================================================================
-- Migration: 20260902163000_remove_legacy_mentor_pairing_system.sql
-- Description: Safely remove legacy student_mentors table, senior mentor pairing
--              logic, and restrict public.users.role CHECK constraint to only
--              active portal roles ('student', 'teacher', 'admin', 'pending').
-- Note: public.mentor_notes and public.can_give_student_guidance are preserved.
-- ==============================================================================

-- 1. Safely drop legacy student_mentors pairing table & related policies/indexes
DROP TABLE IF EXISTS public.student_mentors CASCADE;

-- 2. Update role CHECK constraint on public.users
-- Migrate any accidental 'mentor' role records to 'student' first
UPDATE public.users 
SET role = 'student' 
WHERE role = 'mentor';

-- Re-apply users_role_check with valid portal roles only
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'teacher', 'admin', 'pending'));

-- 3. Document preserved guidance system
-- public.mentor_notes (Admin & Teacher guidance notes)
-- public.can_give_student_guidance (Admin -> All, Teacher -> Genuine Students)
COMMENT ON TABLE public.mentor_notes IS 'KFA Mentor Notes V1: Teacher & Admin guidance/tips for students.';
