-- ============================================================
-- Migration: Update is_role_student function to support mentors, students, and enrolled learners
-- Fixes constraint error: "new row for relation 'attendance' violates check constraint 'attendance_role_check'"
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_role_student("u_id" UUID) 
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT LOWER(COALESCE(role, 'student')) IN ('student', 'mentor', 'pending', 'teacher') 
  FROM public.users 
  WHERE id = u_id;
$$;

ALTER FUNCTION public.is_role_student("u_id" UUID) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.is_role_student("u_id" UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.is_role_student("u_id" UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_role_student("u_id" UUID) TO service_role;
