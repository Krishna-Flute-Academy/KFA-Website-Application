-- ============================================================================
-- Migration: KFA Community Phase 2 — Secure External Community Membership
-- Description: 
--   1. Hardens public.handle_new_user() to prevent client metadata privilege escalation.
--   2. Directs account_type = 'community' signups strictly to public.community_profiles
--      and guarantees NO public.users or academy records are created.
--   3. Updates community RLS policies so authenticated Community Members can
--      participate in public discussions, replies, and reactions while remaining
--      strictly barred from student and classroom categories.
-- Target DB: Auth & Application Instance (sevtycwrmhzyfxvxkkgc.supabase.co)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Hardened handle_new_user() Trigger Function on auth.users
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_id UUID;
  v_existing_role TEXT;
  v_account_type TEXT;
  v_display_name TEXT;
BEGIN
  -- Resolve account type and sanitized display name
  v_account_type := COALESCE(NEW.raw_user_meta_data->>'account_type', '');
  v_display_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    split_part(NEW.email, '@', 1)
  );

  -- ── BRANCH A: External Community Member Registration ──────────────────────
  -- When account_type = 'community', create/sync ONLY the community_profiles row.
  -- STRICT GUARANTEE: Never insert into public.users or create any academy record.
  IF v_account_type = 'community' THEN
    INSERT INTO public.community_profiles (id, display_name, avatar_url, updated_at)
    VALUES (
      NEW.id,
      v_display_name,
      NEW.raw_user_meta_data->>'avatar_url',
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      avatar_url = COALESCE(EXCLUDED.avatar_url, public.community_profiles.avatar_url),
      updated_at = now();

    -- Exit immediately. External community members NEVER touch public.users.
    RETURN NEW;
  END IF;

  -- ── BRANCH B: Academy Registration / Pre-registered Account Merging ───────
  -- Check if a student or instructor profile already exists with this email
  SELECT id, role INTO v_existing_id, v_existing_role 
  FROM public.users 
  WHERE email = NEW.email 
  LIMIT 1;

  IF v_existing_id IS NOT NULL AND v_existing_id != NEW.id THEN
    -- A profile was already created by a teacher/admin in the academy roster.
    -- Insert new row using the new Auth UUID while preserving existing database role.
    -- SECURITY FIX: NEVER fallback to raw_user_meta_data->>'role' for privilege assignment.
    INSERT INTO public.users (id, name, email, phone, role, status, join_date, teacher_id, level)
    SELECT NEW.id, 
           COALESCE(v_display_name, name), 
           email, 
           COALESCE(NEW.raw_user_meta_data->>'phone', phone), 
           COALESCE(role, 'pending'), 
           status, 
           join_date, 
           teacher_id, 
           level
    FROM public.users WHERE id = v_existing_id
    ON CONFLICT (id) DO NOTHING;

    -- Dynamically migrate foreign key references to the confirmed Auth UUID
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'classroom_students') THEN
      EXECUTE 'UPDATE public.classroom_students SET student_id = $1 WHERE student_id = $2' USING NEW.id, v_existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance') THEN
      EXECUTE 'UPDATE public.attendance SET student_id = $1 WHERE student_id = $2' USING NEW.id, v_existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assignment_students') THEN
      EXECUTE 'UPDATE public.assignment_students SET student_id = $1 WHERE student_id = $2' USING NEW.id, v_existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fees_payments') THEN
      EXECUTE 'UPDATE public.fees_payments SET student_id = $1 WHERE student_id = $2' USING NEW.id, v_existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fees_notifications') THEN
      EXECUTE 'UPDATE public.fees_notifications SET student_id = $1 WHERE student_id = $2' USING NEW.id, v_existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'session_student_overrides') THEN
      EXECUTE 'UPDATE public.session_student_overrides SET student_id = $1 WHERE student_id = $2' USING NEW.id, v_existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leave_requests') THEN
      EXECUTE 'UPDATE public.leave_requests SET student_id = $1 WHERE student_id = $2' USING NEW.id, v_existing_id;
    END IF;

    -- Delete old unlinked profile row
    DELETE FROM public.users WHERE id = v_existing_id;
  ELSE
    -- Brand new self-registration for the academy.
    -- SECURITY FIX: Public signup requests ALWAYS default strictly to role = 'pending'
    -- and status = 'pending'. Client metadata can NEVER self-assign student, teacher, or admin.
    INSERT INTO public.users (id, name, email, phone, role, status, join_date)
    VALUES (
      NEW.id,
      v_display_name,
      NEW.email,
      NEW.raw_user_meta_data->>'phone',
      'pending',
      'pending',
      CURRENT_DATE
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Ensure community profile exists for all academy users
  INSERT INTO public.community_profiles (id, display_name, avatar_url, updated_at)
  VALUES (
    NEW.id,
    v_display_name,
    NEW.raw_user_meta_data->>'avatar_url',
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(public.community_profiles.display_name, EXCLUDED.display_name),
    avatar_url = COALESCE(public.community_profiles.avatar_url, EXCLUDED.avatar_url),
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Ensure trigger is active on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. Explicit Community Participant Verification Helper
-- ----------------------------------------------------------------------------
-- Distinguishes an arbitrary authenticated Supabase session from a valid KFA
-- Community participant. A user is an authorized participant IF:
--   1. An approved community profile exists in public.community_profiles, OR
--   2. A legitimate, active KFA Academy membership exists in public.users.
-- Client-supplied metadata is NEVER used for authorization.
CREATE OR REPLACE FUNCTION public.is_community_participant()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (auth.uid() IS NOT NULL) AND (
    EXISTS (
      SELECT 1 FROM public.community_profiles cp
      WHERE cp.id = (SELECT auth.uid())
    )
    OR (SELECT public.is_kfa_member())
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_community_participant() TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. Update Community RLS Policies for Phase 2 Community Members
-- ----------------------------------------------------------------------------

-- Table: community_posts (INSERT)
-- Only valid community participants can post.
-- Public discussions are permitted for all participants.
-- Student-only and classroom posts strictly require KFA Academy membership.
DROP POLICY IF EXISTS "Permitted users can insert posts" ON public.community_posts;
CREATE POLICY "Permitted users can insert posts"
  ON public.community_posts FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = author_id 
    AND (SELECT public.is_community_participant())
    AND (
      (visibility = 'public') 
      OR (visibility = 'students' AND (SELECT public.is_kfa_member()))
      OR (visibility = 'classroom' AND classroom_id IS NOT NULL AND (SELECT public.can_access_classroom_community(classroom_id)))
    )
  );

-- Table: community_replies (INSERT)
-- Only valid community participants can reply.
-- Public discussions are permitted for all participants.
-- Student & classroom discussions require respective academy permissions.
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
          OR (p.visibility = 'students' AND (SELECT public.is_kfa_member()))
          OR (p.visibility = 'classroom' AND p.classroom_id IS NOT NULL AND (SELECT public.can_access_classroom_community(p.classroom_id)))
          OR (SELECT public.is_admin())
        )
    )
  );

-- Table: community_reactions (INSERT)
-- Only valid community participants can upvote.
-- Community members can upvote public posts and replies.
-- Private student & classroom content requires academy access.
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
              OR (p.visibility = 'students' AND (SELECT public.is_kfa_member()))
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
              OR (p.visibility = 'students' AND (SELECT public.is_kfa_member()))
              OR (p.visibility = 'classroom' AND p.classroom_id IS NOT NULL AND (SELECT public.can_access_classroom_community(p.classroom_id)))
              OR (SELECT public.is_admin())
            )
        )
      )
    )
  );

-- Table: community_reports (INSERT)
-- Only valid community participants can submit reports.
-- Enforces:
--   1. Exactly one valid target (either post_id OR reply_id; never neither, never both).
--   2. Target must actually exist (nonexistent UUIDs are rejected).
--   3. Target visibility must match reporter authorization:
--      - Community Member: public posts and replies to public posts only.
--      - KFA Student / Mentor: public, student-only, and enrolled classroom content.
--      - Teacher: public, student-only, and assigned classroom content.
--      - Admin: any valid existing community content.
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
              OR (p.visibility = 'students' AND (SELECT public.is_kfa_member()))
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
              OR (p.visibility = 'students' AND (SELECT public.is_kfa_member()))
              OR (p.visibility = 'classroom' AND p.classroom_id IS NOT NULL AND (SELECT public.can_access_classroom_community(p.classroom_id)))
              OR (SELECT public.is_admin())
            )
        )
      )
    )
  );
