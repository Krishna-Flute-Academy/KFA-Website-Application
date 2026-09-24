-- ============================================================================
-- Migration: KFA Community — Community-Level Student Personas (Option B)
-- Description: 
--   1. Adds internal authorization column `community_role` to public.community_profiles
--      ('member' | 'student_persona', default 'member').
--   2. Enforces database trigger to prevent non-admins from escalating `community_role`.
--   3. Updates public.can_access_student_community() so Student Personas can access
--      and participate in student-only Community discussions.
--   4. Reaffirms public.get_community_role_badge(u_id) strictly returns 'Community Member'
--      for Student Personas, preserving public anonymity.
--   5. Updates Community RLS policies on categories, posts, replies, reactions,
--      and reports to use can_access_student_community().
--   6. CRITICAL GUARANTEES:
--      - public.is_kfa_member() is UNTOUCHED (remains genuine active public.users).
--      - public.can_access_classroom_community() is UNTOUCHED (Personas CANNOT access classrooms).
--      - Zero contamination of public.users, attendance, fees, curriculum, or dashboards.
-- Target DB: Auth & Application Instance (sevtycwrmhzyfxvxkkgc.supabase.co)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Add internal authorization column to public.community_profiles
-- ----------------------------------------------------------------------------
ALTER TABLE public.community_profiles
  ADD COLUMN IF NOT EXISTS community_role TEXT NOT NULL DEFAULT 'member';

-- Add check constraint ensuring only allowed role values
ALTER TABLE public.community_profiles DROP CONSTRAINT IF EXISTS community_profiles_community_role_check;
ALTER TABLE public.community_profiles ADD CONSTRAINT community_profiles_community_role_check
  CHECK (community_role IN ('member', 'student_persona'));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_community_profiles_community_role
  ON public.community_profiles(community_role);

-- ----------------------------------------------------------------------------
-- 2. Trigger: Protect community_role against unauthorized client modification
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_community_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- If community_role is being modified and the session user is not admin, preserve old value
    IF NEW.community_role IS DISTINCT FROM OLD.community_role THEN
      IF NOT (SELECT public.is_admin()) THEN
        NEW.community_role := OLD.community_role;
      END IF;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    -- On insert, only admins may set community_role to anything other than default 'member'
    IF NEW.community_role IS NOT NULL AND NEW.community_role != 'member' THEN
      IF NOT (SELECT public.is_admin()) THEN
        NEW.community_role := 'member';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_community_profile_role ON public.community_profiles;
CREATE TRIGGER trg_protect_community_profile_role
  BEFORE INSERT OR UPDATE ON public.community_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_community_profile_role();

-- ----------------------------------------------------------------------------
-- 3. Update can_access_student_community() Helper
-- ----------------------------------------------------------------------------
-- Permits genuine KFA Academy members OR designated student personas.
CREATE OR REPLACE FUNCTION public.can_access_student_community()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (SELECT public.is_kfa_member())
  OR EXISTS (
    SELECT 1 FROM public.community_profiles cp
    WHERE cp.id = (SELECT auth.uid())
      AND cp.community_role = 'student_persona'
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_access_student_community() TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- 4. Reaffirm public.get_community_role_badge(u_id)
-- ----------------------------------------------------------------------------
-- Guarantees that student personas publicly display 'Community Member'
-- and NEVER leak internal authorization status ('KFA Student', 'student_persona', etc.)
CREATE OR REPLACE FUNCTION public.get_community_role_badge(u_id UUID)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.users WHERE id = u_id AND role = 'admin') THEN 'Admin'
    WHEN EXISTS (SELECT 1 FROM public.users WHERE id = u_id AND role = 'teacher') THEN 'Teacher'
    WHEN EXISTS (SELECT 1 FROM public.users WHERE id = u_id AND role IN ('student', 'mentor')) THEN 'KFA Student'
    ELSE 'Community Member'
  END;
$$;

GRANT EXECUTE ON FUNCTION public.get_community_role_badge(UUID) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. Update Community RLS Policies for Student Persona Access
-- ----------------------------------------------------------------------------

-- Table: community_categories (SELECT)
DROP POLICY IF EXISTS "Public categories are readable by anyone" ON public.community_categories;
CREATE POLICY "Public categories are readable by anyone"
  ON public.community_categories FOR SELECT
  USING (
    access_scope = 'public' 
    OR (access_scope = 'students' AND (SELECT public.can_access_student_community()))
    OR (SELECT public.is_admin())
    OR (EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'teacher' AND status = 'active'))
  );

-- Table: community_posts (SELECT)
DROP POLICY IF EXISTS "Community posts visibility rule" ON public.community_posts;
CREATE POLICY "Community posts visibility rule"
  ON public.community_posts FOR SELECT
  USING (
    visibility = 'public'
    OR (visibility = 'students' AND (SELECT public.can_access_student_community()))
    OR (visibility = 'classroom' AND classroom_id IS NOT NULL AND (SELECT public.can_access_classroom_community(classroom_id)))
    OR (SELECT public.is_admin())
  );

-- Table: community_posts (INSERT)
DROP POLICY IF EXISTS "Permitted users can insert posts" ON public.community_posts;
CREATE POLICY "Permitted users can insert posts"
  ON public.community_posts FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = author_id 
    AND (SELECT public.is_community_participant())
    AND (
      (visibility = 'public') 
      OR (visibility = 'students' AND (SELECT public.can_access_student_community()))
      OR (visibility = 'classroom' AND classroom_id IS NOT NULL AND (SELECT public.can_access_classroom_community(classroom_id)))
    )
  );

-- Table: community_replies (INSERT)
DROP POLICY IF EXISTS "Permitted users can insert replies" ON public.community_replies;
CREATE POLICY "Permitted users can insert replies"
  ON public.community_replies FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = author_id
    AND (SELECT public.is_community_participant())
    AND EXISTS (
      SELECT 1 FROM public.community_posts p
      WHERE p.id = post_id 
        AND p.is_locked = false
        AND (
          p.visibility = 'public'
          OR (p.visibility = 'students' AND (SELECT public.can_access_student_community()))
          OR (p.visibility = 'classroom' AND p.classroom_id IS NOT NULL AND (SELECT public.can_access_classroom_community(p.classroom_id)))
          OR (SELECT public.is_admin())
        )
    )
  );

-- Table: community_reactions (INSERT)
DROP POLICY IF EXISTS "Authenticated users can insert reaction" ON public.community_reactions;
CREATE POLICY "Authenticated users can insert reaction"
  ON public.community_reactions FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (SELECT public.is_community_participant())
    AND (
      (
        post_id IS NOT NULL AND reply_id IS NULL AND EXISTS (
          SELECT 1 FROM public.community_posts p
          WHERE p.id = post_id
            AND (
              p.visibility = 'public'
              OR (p.visibility = 'students' AND (SELECT public.can_access_student_community()))
              OR (p.visibility = 'classroom' AND p.classroom_id IS NOT NULL AND (SELECT public.can_access_classroom_community(p.classroom_id)))
              OR (SELECT public.is_admin())
            )
        )
      ) OR (
        reply_id IS NOT NULL AND post_id IS NULL AND EXISTS (
          SELECT 1 FROM public.community_replies r
          JOIN public.community_posts p ON p.id = r.post_id
          WHERE r.id = reply_id
            AND (
              p.visibility = 'public'
              OR (p.visibility = 'students' AND (SELECT public.can_access_student_community()))
              OR (p.visibility = 'classroom' AND p.classroom_id IS NOT NULL AND (SELECT public.can_access_classroom_community(p.classroom_id)))
              OR (SELECT public.is_admin())
            )
        )
      )
    )
  );

-- Table: community_reports (INSERT)
DROP POLICY IF EXISTS "Users can create reports" ON public.community_reports;
CREATE POLICY "Users can create reports"
  ON public.community_reports FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = reporter_id
    AND (SELECT public.is_community_participant())
    AND (
      (
        post_id IS NOT NULL AND reply_id IS NULL AND EXISTS (
          SELECT 1 FROM public.community_posts p
          WHERE p.id = post_id
            AND (
              p.visibility = 'public'
              OR (p.visibility = 'students' AND (SELECT public.can_access_student_community()))
              OR (p.visibility = 'classroom' AND p.classroom_id IS NOT NULL AND (SELECT public.can_access_classroom_community(p.classroom_id)))
              OR (SELECT public.is_admin())
            )
        )
      )
      OR
      (
        reply_id IS NOT NULL AND post_id IS NULL AND EXISTS (
          SELECT 1 FROM public.community_replies r
          JOIN public.community_posts p ON p.id = r.post_id
          WHERE r.id = reply_id
            AND (
              p.visibility = 'public'
              OR (p.visibility = 'students' AND (SELECT public.can_access_student_community()))
              OR (p.visibility = 'classroom' AND p.classroom_id IS NOT NULL AND (SELECT public.can_access_classroom_community(p.classroom_id)))
              OR (SELECT public.is_admin())
            )
        )
      )
    )
  );
