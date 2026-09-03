-- ============================================================================
-- Migration: Add featured_updates table and secure Admin-only / Student-only RLS
-- Target: KFA Website Application (Supabase Postgres)
-- Safety: Purely ADDITIVE. Does NOT drop or alter any existing production table.
-- Default State: Featured Updates feature is OFF by default until explicitly enabled by Admin.
-- ============================================================================

-- 1. Helper function: Check if current user is an authenticated student (role = 'student')
CREATE OR REPLACE FUNCTION public.is_featured_updates_student()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid()) AND role = 'student'
  );
$$;

-- 2. Helper function: Check if master Featured Updates feature is enabled
-- SAFE DEFAULT: Returns FALSE if not configured, property missing, or row missing.
-- Must be explicitly enabled by Admin from the dashboard.
CREATE OR REPLACE FUNCTION public.is_featured_updates_feature_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (
      SELECT (content::jsonb->>'featured_updates_enabled')::boolean
      FROM public.message_templates
      WHERE name = 'system_notification_settings'
      LIMIT 1
    ),
    false -- Safe default: OFF after deployment until Admin explicitly enables it
  );
$$;

-- 3. Helper function: Recipient Authorization check for a student
CREATE OR REPLACE FUNCTION public.is_featured_update_recipient(
    p_recipients jsonb, 
    p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_recipients) AS elem
    WHERE
      -- 1. Global: All students
      (elem->>'type' = 'global' OR elem->>'id' = 'global')

      -- 2. Direct Student ID Match
      OR (elem->>'type' = 'student' AND elem->>'id' = p_user_id::text)

      -- 3. Classroom Match (Permanent enrolled class or today's makeup session)
      OR (elem->>'type' = 'class' AND (
        EXISTS (
          SELECT 1 FROM public.classroom_students cs
          WHERE cs.student_id = p_user_id
            AND cs.classroom_id::text = elem->>'id'
        )
        OR EXISTS (
          SELECT 1 FROM public.session_student_overrides sso
          WHERE sso.student_id = p_user_id
            AND sso.target_classroom_id::text = elem->>'id'
            AND sso.override_date = CURRENT_DATE
        )
      ))

      -- 4. Custom Recipient Group Match
      OR (elem->>'type' = 'custom' AND EXISTS (
        SELECT 1
        FROM public.custom_recipient_groups crg
        CROSS JOIN LATERAL jsonb_array_elements(crg.recipients) AS grp_elem
        WHERE crg.id::text = elem->>'id'
          AND (
            grp_elem->>'type' = 'global' OR grp_elem->>'id' = 'global'
            OR (grp_elem->>'type' = 'student' AND grp_elem->>'id' = p_user_id::text)
            OR (grp_elem->>'type' = 'class' AND EXISTS (
              SELECT 1 FROM public.classroom_students cs2
              WHERE cs2.student_id = p_user_id AND cs2.classroom_id::text = grp_elem->>'id'
            ))
          )
      ))
  );
$$;

-- 4. Create featured_updates table
CREATE TABLE IF NOT EXISTS public.featured_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    content_type TEXT NOT NULL DEFAULT 'other', -- 'youtube', 'blog', 'tutorial', 'announcement', 'event', 'resource', 'external', 'other'
    cta_label TEXT NOT NULL DEFAULT 'Learn More',
    recipients JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { id, name, type: 'global' | 'class' | 'student' | 'custom' }
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Indexes for query optimization
CREATE INDEX IF NOT EXISTS idx_featured_updates_status ON public.featured_updates(status);
CREATE INDEX IF NOT EXISTS idx_featured_updates_dates ON public.featured_updates(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_featured_updates_creator ON public.featured_updates(creator_id);
CREATE INDEX IF NOT EXISTS idx_featured_updates_created_at ON public.featured_updates(created_at DESC);

-- 6. Enable Row Level Security
ALTER TABLE public.featured_updates ENABLE ROW LEVEL SECURITY;

-- 7. Row Level Security Policies
-- SELECT:
-- - Admins: can read all featured_updates (draft, active, paused, archived, scheduled).
-- - Students: can ONLY read when (users.id = auth.uid() AND users.role = 'student'),
--             status = 'active', within start/end dates, master feature is ENABLED,
--             and the student is an intended recipient.
-- - Teachers, Pending, and other roles: receive ZERO rows.
DROP POLICY IF EXISTS "Authorized users can read featured updates" ON public.featured_updates;
CREATE POLICY "Authorized users can read featured updates"
  ON public.featured_updates FOR SELECT TO authenticated
  USING (
    -- A. Admin check (can view everything)
    (SELECT public.is_admin())
    OR
    (
      -- B. Explicit student check: user must be authenticated with role = 'student'
      (SELECT public.is_featured_updates_student())
      AND status = 'active'
      AND (start_date IS NULL OR start_date <= now())
      AND (end_date IS NULL OR end_date >= now())
      AND (SELECT public.is_featured_updates_feature_enabled())
      AND public.is_featured_update_recipient(recipients, (SELECT auth.uid()))
    )
  );

-- INSERT: Admin ONLY (Teachers, students, others blocked)
DROP POLICY IF EXISTS "Admins insert featured updates" ON public.featured_updates;
CREATE POLICY "Admins insert featured updates"
  ON public.featured_updates FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

-- UPDATE: Admin ONLY (Teachers, students, others blocked)
DROP POLICY IF EXISTS "Admins update featured updates" ON public.featured_updates;
CREATE POLICY "Admins update featured updates"
  ON public.featured_updates FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

-- DELETE: Admin ONLY (Teachers, students, others blocked)
DROP POLICY IF EXISTS "Admins delete featured updates" ON public.featured_updates;
CREATE POLICY "Admins delete featured updates"
  ON public.featured_updates FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- 8. Grant Data API access
GRANT ALL ON TABLE public.featured_updates TO authenticated;
GRANT ALL ON TABLE public.featured_updates TO service_role;
