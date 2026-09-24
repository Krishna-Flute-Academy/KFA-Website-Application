-- ============================================================================
-- Migration: KFA Community / Flute Forum Schema & Hardened Authorization Setup
-- Description: Complete, idempotent, production-ready schema, RLS policies,
--              triggers, and security definer RPC functions for KFA Community.
-- Target DB:   Auth & Application Instance (sevtycwrmhzyfxvxkkgc.supabase.co)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper function: Get community role badge safely
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 2. Phase 1 KFA Member Verification Helpers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_kfa_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid())
      AND role IN ('student', 'mentor', 'teacher', 'admin')
      AND status = 'active'
  );
$$;

-- Backwards compatibility wrapper for category & legacy rules
CREATE OR REPLACE FUNCTION public.can_access_student_community()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_kfa_member();
$$;

-- Helper check function for classroom access
CREATE OR REPLACE FUNCTION public.can_access_classroom_community(c_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (SELECT public.is_admin()) 
    OR (SELECT public.owns_classroom(c_id, (SELECT auth.uid())))
    OR (
      (SELECT public.is_kfa_member()) AND EXISTS (
        SELECT 1 FROM public.classroom_students
        WHERE classroom_id = c_id AND student_id = (SELECT auth.uid())
      )
    );
$$;

-- ----------------------------------------------------------------------------
-- 3. Allow 'community' notification type in public.notifications
-- ----------------------------------------------------------------------------
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN ('reminder', 'live_class', 'messages', 'tasks', 'task', 'classroom', 'curriculum', 'attendance', 'fees', 'community', 'feedback')
);

-- ----------------------------------------------------------------------------
-- 4. Community Profiles Table
--    Decoupled from public.users so future external members never touch academy
--    tables (attendance, fees, curriculum, etc.).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  website TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 5. Community Categories Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  access_scope TEXT NOT NULL DEFAULT 'public' CHECK (access_scope IN ('public', 'students', 'classroom')),
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  icon_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 6. Community Posts Table (Discussions & Questions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.community_categories(id) ON DELETE RESTRICT,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'students', 'classroom')),
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE SET NULL,
  post_type TEXT NOT NULL DEFAULT 'question' CHECK (post_type IN ('question', 'discussion')),
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  accepted_reply_id UUID, -- Foreign key constraint added below
  views_count INT NOT NULL DEFAULT 0,
  upvotes_count INT NOT NULL DEFAULT 0,
  replies_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 7. Community Replies Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_reply_id UUID REFERENCES public.community_replies(id) ON DELETE CASCADE,
  is_accepted BOOLEAN NOT NULL DEFAULT false,
  upvotes_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add deferred foreign key for accepted_reply_id on posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_community_posts_accepted_reply'
  ) THEN
    ALTER TABLE public.community_posts 
    ADD CONSTRAINT fk_community_posts_accepted_reply 
    FOREIGN KEY (accepted_reply_id) REFERENCES public.community_replies(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 8. Community Reactions Table (Upvotes)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE,
  reply_id UUID REFERENCES public.community_replies(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL DEFAULT 'upvote',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_post_or_reply CHECK (
    (post_id IS NOT NULL AND reply_id IS NULL) OR
    (reply_id IS NOT NULL AND post_id IS NULL)
  ),
  CONSTRAINT unique_post_user_reaction UNIQUE (user_id, post_id, reaction_type),
  CONSTRAINT unique_reply_user_reaction UNIQUE (user_id, reply_id, reaction_type)
);

-- ----------------------------------------------------------------------------
-- 9. Community Reports Table (Abuse / Spam Reporting)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE,
  reply_id UUID REFERENCES public.community_replies(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  moderator_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_report_target CHECK (
    (post_id IS NOT NULL AND reply_id IS NULL) OR
    (reply_id IS NOT NULL AND post_id IS NULL)
  )
);

-- ----------------------------------------------------------------------------
-- 10. Automatic Sync Trigger for Community Profiles from public.users
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_community_profile_on_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.community_profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.name, 'KFA Member'),
    NEW.profile_pic_url
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.community_profiles.avatar_url),
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_community_profile ON public.users;
CREATE TRIGGER trg_sync_community_profile
AFTER INSERT OR UPDATE OF name, profile_pic_url ON public.users
FOR EACH ROW EXECUTE FUNCTION public.sync_community_profile_on_user();

-- Backfill community_profiles from existing public.users
INSERT INTO public.community_profiles (id, display_name, avatar_url)
SELECT id, COALESCE(name, 'KFA Member'), profile_pic_url
FROM public.users
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 11. Category & Visibility Consistency Trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_community_post_category_visibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_scope TEXT;
BEGIN
  -- Validate category existence & scope
  SELECT access_scope INTO v_scope
  FROM public.community_categories
  WHERE id = NEW.category_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Category not found';
  END IF;

  -- Scope enforcement
  IF v_scope = 'students' THEN
    IF NEW.visibility = 'public' THEN
      RAISE EXCEPTION 'Posts in student-only categories cannot have public visibility';
    END IF;
    IF NOT (SELECT public.is_kfa_member()) THEN
      RAISE EXCEPTION 'Only active KFA members can post to student categories';
    END IF;
  ELSIF v_scope = 'classroom' THEN
    IF NEW.visibility != 'classroom' THEN
      RAISE EXCEPTION 'Posts in classroom categories must have classroom visibility';
    END IF;
  END IF;

  -- If visibility is classroom, classroom_id must be provided and caller must have access
  IF NEW.visibility = 'classroom' THEN
    IF NEW.classroom_id IS NULL THEN
      RAISE EXCEPTION 'Classroom post requires a valid classroom_id';
    END IF;
    IF NOT (SELECT public.can_access_classroom_community(NEW.classroom_id)) THEN
      RAISE EXCEPTION 'Unauthorized: You do not have access to this classroom';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_community_post ON public.community_posts;
CREATE TRIGGER trg_validate_community_post
BEFORE INSERT OR UPDATE OF category_id, visibility, classroom_id ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.validate_community_post_category_visibility();

-- ----------------------------------------------------------------------------
-- 12. Immutability & Moderation Enforcement Triggers (Posts & Replies)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_community_post_update_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Prevent author modification
  IF NEW.author_id IS DISTINCT FROM OLD.author_id THEN
    RAISE EXCEPTION 'Cannot alter post author_id';
  END IF;

  -- Prevent created_at modification
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    NEW.created_at := OLD.created_at;
  END IF;

  -- Protect counters from arbitrary direct client updates
  IF NEW.views_count IS DISTINCT FROM OLD.views_count 
     AND current_setting('kfa.allow_counter_update', true) IS DISTINCT FROM 'true' THEN
    NEW.views_count := OLD.views_count;
  END IF;

  IF NEW.upvotes_count IS DISTINCT FROM OLD.upvotes_count 
     AND current_setting('kfa.allow_counter_update', true) IS DISTINCT FROM 'true' THEN
    NEW.upvotes_count := OLD.upvotes_count;
  END IF;

  IF NEW.replies_count IS DISTINCT FROM OLD.replies_count 
     AND current_setting('kfa.allow_counter_update', true) IS DISTINCT FROM 'true' THEN
    NEW.replies_count := OLD.replies_count;
  END IF;

  -- accepted_reply_id can ONLY be updated via set_community_accepted_answer RPC
  IF NEW.accepted_reply_id IS DISTINCT FROM OLD.accepted_reply_id THEN
    IF current_setting('kfa.allow_accepted_answer_update', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'accepted_reply_id can only be updated through the accepted answer workflow';
    END IF;
  END IF;

  -- Moderation fields: is_pinned and is_locked can only be changed by admin or authorized teacher
  IF (NEW.is_pinned IS DISTINCT FROM OLD.is_pinned OR NEW.is_locked IS DISTINCT FROM OLD.is_locked) THEN
    IF (SELECT public.is_admin()) THEN
      NULL;
    ELSIF EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'teacher' AND status = 'active') THEN
      IF OLD.visibility = 'classroom' THEN
        IF OLD.classroom_id IS NULL OR NOT (SELECT public.owns_classroom(OLD.classroom_id, (SELECT auth.uid()))) THEN
          RAISE EXCEPTION 'Teachers may only moderate discussions in classrooms they teach';
        END IF;
      END IF;
    ELSE
      RAISE EXCEPTION 'Only authorized teachers and admins can modify post moderation flags (is_pinned, is_locked)';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_community_post_update_rules ON public.community_posts;
CREATE TRIGGER trg_enforce_community_post_update_rules
BEFORE UPDATE ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.enforce_community_post_update_rules();

-- Reply immutability trigger
CREATE OR REPLACE FUNCTION public.enforce_community_reply_update_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Prevent author_id or post_id modification
  IF NEW.author_id IS DISTINCT FROM OLD.author_id THEN
    RAISE EXCEPTION 'Cannot alter reply author_id';
  END IF;

  IF NEW.post_id IS DISTINCT FROM OLD.post_id THEN
    RAISE EXCEPTION 'Cannot alter reply post_id';
  END IF;

  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    NEW.created_at := OLD.created_at;
  END IF;

  -- Counter upvotes_count cannot be modified directly
  IF NEW.upvotes_count IS DISTINCT FROM OLD.upvotes_count 
     AND current_setting('kfa.allow_counter_update', true) IS DISTINCT FROM 'true' THEN
    NEW.upvotes_count := OLD.upvotes_count;
  END IF;

  -- is_accepted can ONLY be updated through set_community_accepted_answer RPC
  IF NEW.is_accepted IS DISTINCT FROM OLD.is_accepted THEN
    IF current_setting('kfa.allow_accepted_answer_update', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'is_accepted can only be updated through the accepted answer workflow';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_community_reply_update_rules ON public.community_replies;
CREATE TRIGGER trg_enforce_community_reply_update_rules
BEFORE UPDATE ON public.community_replies
FOR EACH ROW EXECUTE FUNCTION public.enforce_community_reply_update_rules();

-- ----------------------------------------------------------------------------
-- 13. System Triggers: Counter Synchronization (Replies & Upvotes)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_community_post_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM set_config('kfa.allow_counter_update', 'true', true);
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts
    SET replies_count = replies_count + 1, updated_at = now()
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts
    SET replies_count = GREATEST(0, replies_count - 1), updated_at = now()
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_community_post_replies ON public.community_replies;
CREATE TRIGGER trg_update_community_post_replies
AFTER INSERT OR DELETE ON public.community_replies
FOR EACH ROW EXECUTE FUNCTION public.update_community_post_stats();

-- Reaction count trigger
CREATE OR REPLACE FUNCTION public.update_community_reaction_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM set_config('kfa.allow_counter_update', 'true', true);
  IF TG_OP = 'INSERT' THEN
    IF NEW.post_id IS NOT NULL THEN
      UPDATE public.community_posts SET upvotes_count = upvotes_count + 1 WHERE id = NEW.post_id;
    ELSIF NEW.reply_id IS NOT NULL THEN
      UPDATE public.community_replies SET upvotes_count = upvotes_count + 1 WHERE id = NEW.reply_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.post_id IS NOT NULL THEN
      UPDATE public.community_posts SET upvotes_count = GREATEST(0, upvotes_count - 1) WHERE id = OLD.post_id;
    ELSIF OLD.reply_id IS NOT NULL THEN
      UPDATE public.community_replies SET upvotes_count = GREATEST(0, upvotes_count - 1) WHERE id = OLD.reply_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_community_reactions ON public.community_reactions;
CREATE TRIGGER trg_update_community_reactions
AFTER INSERT OR DELETE ON public.community_reactions
FOR EACH ROW EXECUTE FUNCTION public.update_community_reaction_stats();

-- ----------------------------------------------------------------------------
-- 14. Authorized RPC Functions: Views Counter & Accepted Answer Workflow
-- ----------------------------------------------------------------------------

-- Safe view count incrementer (verifies content access before incrementing)
CREATE OR REPLACE FUNCTION public.increment_community_post_view(p_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.community_posts p
    WHERE p.id = p_id
      AND (
        p.visibility = 'public'
        OR (p.visibility = 'students' AND (SELECT public.is_kfa_member()))
        OR (p.visibility = 'classroom' AND p.classroom_id IS NOT NULL AND (SELECT public.can_access_classroom_community(p.classroom_id)))
        OR (SELECT public.is_admin())
      )
  ) THEN
    PERFORM set_config('kfa.allow_counter_update', 'true', true);
    UPDATE public.community_posts
    SET views_count = views_count + 1
    WHERE id = p_id;
  END IF;
END;
$$;

-- Atomic accepted answer coordinator
CREATE OR REPLACE FUNCTION public.set_community_accepted_answer(p_post_id UUID, p_reply_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_post_author_id UUID;
  v_reply_author_id UUID;
  v_post_title TEXT;
  v_post_visibility TEXT;
  v_post_classroom_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Fetch post author, title, visibility, and classroom_id
  SELECT author_id, title, visibility, classroom_id 
  INTO v_post_author_id, v_post_title, v_post_visibility, v_post_classroom_id
  FROM public.community_posts
  WHERE id = p_post_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  -- Explicit Caller Authorization:
  -- 1) Admin: authorized for all posts
  -- 2) Post author: authorized (if classroom post, verify classroom membership)
  -- 3) Teacher: authorized for public/student posts, and classroom posts ONLY if they teach that classroom
  IF (SELECT public.is_admin()) THEN
    NULL;
  ELSIF v_caller_id = v_post_author_id THEN
    IF v_post_visibility = 'classroom' AND v_post_classroom_id IS NOT NULL THEN
      IF NOT (SELECT public.can_access_classroom_community(v_post_classroom_id)) THEN
        RAISE EXCEPTION 'Unauthorized: You do not have access to this classroom post';
      END IF;
    END IF;
  ELSIF EXISTS (SELECT 1 FROM public.users WHERE id = v_caller_id AND role = 'teacher' AND status = 'active') THEN
    IF v_post_visibility = 'classroom' THEN
      IF v_post_classroom_id IS NULL OR NOT (SELECT public.owns_classroom(v_post_classroom_id, v_caller_id)) THEN
        RAISE EXCEPTION 'Unauthorized: Teachers may only moderate discussions in classrooms they teach';
      END IF;
    END IF;
  ELSE
    RAISE EXCEPTION 'Only the post author, assigned teacher, or admin can designate the accepted answer';
  END IF;

  -- Enable accepted answer update flag for this transaction
  PERFORM set_config('kfa.allow_accepted_answer_update', 'true', true);

  IF p_reply_id IS NOT NULL THEN
    -- Ensure reply exists and belongs to this post
    SELECT author_id INTO v_reply_author_id
    FROM public.community_replies
    WHERE id = p_reply_id AND post_id = p_post_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Reply not found or does not belong to this post';
    END IF;

    -- Reset any previous accepted answer for this post
    UPDATE public.community_replies
    SET is_accepted = false, updated_at = now()
    WHERE post_id = p_post_id AND is_accepted = true;

    -- Set new accepted reply
    UPDATE public.community_replies
    SET is_accepted = true, updated_at = now()
    WHERE id = p_reply_id;

    -- Update post accepted_reply_id
    UPDATE public.community_posts
    SET accepted_reply_id = p_reply_id, updated_at = now()
    WHERE id = p_post_id;

    -- Notify reply author if distinct from caller
    IF v_reply_author_id IS DISTINCT FROM v_caller_id THEN
      INSERT INTO public.notifications (user_id, title, message, type, is_read)
      VALUES (
        v_reply_author_id,
        'Answer Accepted! ✓',
        'Your answer was marked as the accepted answer on: "' || SUBSTRING(COALESCE(v_post_title, 'Discussion') FROM 1 FOR 60) || '"',
        'community',
        false
      );
    END IF;
  ELSE
    -- Unset accepted answer
    UPDATE public.community_replies
    SET is_accepted = false, updated_at = now()
    WHERE post_id = p_post_id AND is_accepted = true;

    UPDATE public.community_posts
    SET accepted_reply_id = NULL, updated_at = now()
    WHERE id = p_post_id;
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 15. Performance Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_community_posts_category ON public.community_posts (category_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_visibility ON public.community_posts (visibility);
CREATE INDEX IF NOT EXISTS idx_community_posts_slug ON public.community_posts (slug);
CREATE INDEX IF NOT EXISTS idx_community_posts_author ON public.community_posts (author_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_pinned_created ON public.community_posts (is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_replies_post ON public.community_replies (post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_community_replies_author ON public.community_replies (author_id);
CREATE INDEX IF NOT EXISTS idx_community_reactions_post ON public.community_reactions (post_id);
CREATE INDEX IF NOT EXISTS idx_community_reactions_reply ON public.community_reactions (reply_id);
CREATE INDEX IF NOT EXISTS idx_community_reactions_user ON public.community_reactions (user_id);

-- Full-text search index for discussions
CREATE INDEX IF NOT EXISTS idx_community_posts_search ON public.community_posts 
USING gin(to_tsvector('english', title || ' ' || content));

-- ----------------------------------------------------------------------------
-- 16. Row Level Security (RLS) Policies
-- ----------------------------------------------------------------------------

ALTER TABLE public.community_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;

-- Table: community_profiles
DROP POLICY IF EXISTS "Public can view community profiles" ON public.community_profiles;
CREATE POLICY "Public can view community profiles"
  ON public.community_profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert own community profile" ON public.community_profiles;
CREATE POLICY "Users can insert own community profile"
  ON public.community_profiles FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own community profile" ON public.community_profiles;
CREATE POLICY "Users can update own community profile"
  ON public.community_profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Table: community_categories
DROP POLICY IF EXISTS "Public categories are readable by anyone" ON public.community_categories;
CREATE POLICY "Public categories are readable by anyone"
  ON public.community_categories FOR SELECT
  USING (
    access_scope = 'public' 
    OR (access_scope = 'students' AND (SELECT public.is_kfa_member()))
    OR (SELECT public.is_admin())
    OR (EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'teacher' AND status = 'active'))
  );

DROP POLICY IF EXISTS "Admins can manage categories" ON public.community_categories;
CREATE POLICY "Admins can manage categories"
  ON public.community_categories FOR ALL TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

-- Table: community_posts
DROP POLICY IF EXISTS "Community posts visibility rule" ON public.community_posts;
CREATE POLICY "Community posts visibility rule"
  ON public.community_posts FOR SELECT
  USING (
    visibility = 'public'
    OR (visibility = 'students' AND (SELECT public.is_kfa_member()))
    OR (visibility = 'classroom' AND classroom_id IS NOT NULL AND (SELECT public.can_access_classroom_community(classroom_id)))
    OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "Permitted users can insert posts" ON public.community_posts;
CREATE POLICY "Permitted users can insert posts"
  ON public.community_posts FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = author_id 
    AND (SELECT public.is_kfa_member())
    AND (
      (visibility = 'public') OR
      (visibility = 'students') OR
      (visibility = 'classroom' AND classroom_id IS NOT NULL AND (SELECT public.can_access_classroom_community(classroom_id)))
    )
  );

DROP POLICY IF EXISTS "Authors and staff can update posts" ON public.community_posts;
CREATE POLICY "Authors and staff can update posts"
  ON public.community_posts FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) = author_id 
    OR (SELECT public.is_admin())
    OR (
      EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'teacher' AND status = 'active')
      AND (
        visibility IN ('public', 'students')
        OR (visibility = 'classroom' AND classroom_id IS NOT NULL AND (SELECT public.owns_classroom(classroom_id, (SELECT auth.uid()))))
      )
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = author_id 
    OR (SELECT public.is_admin())
    OR (
      EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'teacher' AND status = 'active')
      AND (
        visibility IN ('public', 'students')
        OR (visibility = 'classroom' AND classroom_id IS NOT NULL AND (SELECT public.owns_classroom(classroom_id, (SELECT auth.uid()))))
      )
    )
  );

DROP POLICY IF EXISTS "Authors and staff can delete posts" ON public.community_posts;
DROP POLICY IF EXISTS "Authors and admins can delete posts" ON public.community_posts;
CREATE POLICY "Authors and admins can delete posts"
  ON public.community_posts FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = author_id OR (SELECT public.is_admin())
  );

-- Table: community_replies
DROP POLICY IF EXISTS "Replies readable if parent post is readable" ON public.community_replies;
CREATE POLICY "Replies readable if parent post is readable"
  ON public.community_replies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.community_posts p
      WHERE p.id = post_id
    )
  );

DROP POLICY IF EXISTS "Permitted users can insert replies" ON public.community_replies;
CREATE POLICY "Permitted users can insert replies"
  ON public.community_replies FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = author_id
    AND (SELECT public.is_kfa_member())
    AND EXISTS (
      SELECT 1 FROM public.community_posts p
      WHERE p.id = post_id AND p.is_locked = false
    )
  );

DROP POLICY IF EXISTS "Authors and staff can update replies" ON public.community_replies;
CREATE POLICY "Authors and staff can update replies"
  ON public.community_replies FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) = author_id 
    OR (SELECT public.is_admin())
    OR (
      EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'teacher' AND status = 'active')
      AND EXISTS (
        SELECT 1 FROM public.community_posts p
        WHERE p.id = post_id
          AND (
            p.visibility IN ('public', 'students')
            OR (p.visibility = 'classroom' AND p.classroom_id IS NOT NULL AND (SELECT public.owns_classroom(p.classroom_id, (SELECT auth.uid()))))
          )
      )
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = author_id 
    OR (SELECT public.is_admin())
    OR (
      EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'teacher' AND status = 'active')
      AND EXISTS (
        SELECT 1 FROM public.community_posts p
        WHERE p.id = post_id
          AND (
            p.visibility IN ('public', 'students')
            OR (p.visibility = 'classroom' AND p.classroom_id IS NOT NULL AND (SELECT public.owns_classroom(p.classroom_id, (SELECT auth.uid()))))
          )
      )
    )
  );

DROP POLICY IF EXISTS "Authors and staff can delete replies" ON public.community_replies;
DROP POLICY IF EXISTS "Authors and admins can delete replies" ON public.community_replies;
CREATE POLICY "Authors and admins can delete replies"
  ON public.community_replies FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = author_id OR (SELECT public.is_admin())
  );

-- Table: community_reactions
DROP POLICY IF EXISTS "Reactions are viewable by all" ON public.community_reactions;
CREATE POLICY "Reactions are viewable by all"
  ON public.community_reactions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert reaction" ON public.community_reactions;
CREATE POLICY "Authenticated users can insert reaction"
  ON public.community_reactions FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (SELECT public.is_kfa_member())
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

DROP POLICY IF EXISTS "Users can remove own reaction" ON public.community_reactions;
CREATE POLICY "Users can remove own reaction"
  ON public.community_reactions FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Table: community_reports
DROP POLICY IF EXISTS "Users can create reports" ON public.community_reports;
CREATE POLICY "Users can create reports"
  ON public.community_reports FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = reporter_id
    AND (SELECT public.is_kfa_member())
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

DROP POLICY IF EXISTS "Admins can view and manage reports" ON public.community_reports;
DROP POLICY IF EXISTS "Admins and teachers can view and manage reports" ON public.community_reports;
CREATE POLICY "Admins and teachers can view and manage reports"
  ON public.community_reports FOR ALL TO authenticated
  USING (
    (SELECT public.is_admin())
    OR (
      EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'teacher' AND status = 'active')
      AND (
        (post_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.community_posts p
          WHERE p.id = post_id
            AND (
              p.visibility IN ('public', 'students')
              OR (p.visibility = 'classroom' AND p.classroom_id IS NOT NULL AND (SELECT public.owns_classroom(p.classroom_id, (SELECT auth.uid()))))
            )
        ))
        OR
        (reply_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.community_replies r
          JOIN public.community_posts p ON p.id = r.post_id
          WHERE r.id = reply_id
            AND (
              p.visibility IN ('public', 'students')
              OR (p.visibility = 'classroom' AND p.classroom_id IS NOT NULL AND (SELECT public.owns_classroom(p.classroom_id, (SELECT auth.uid()))))
            )
        ))
      )
    )
  )
  WITH CHECK (
    (SELECT public.is_admin())
    OR (
      EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'teacher' AND status = 'active')
      AND (
        (post_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.community_posts p
          WHERE p.id = post_id
            AND (
              p.visibility IN ('public', 'students')
              OR (p.visibility = 'classroom' AND p.classroom_id IS NOT NULL AND (SELECT public.owns_classroom(p.classroom_id, (SELECT auth.uid()))))
            )
        ))
        OR
        (reply_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.community_replies r
          JOIN public.community_posts p ON p.id = r.post_id
          WHERE r.id = reply_id
            AND (
              p.visibility IN ('public', 'students')
              OR (p.visibility = 'classroom' AND p.classroom_id IS NOT NULL AND (SELECT public.owns_classroom(p.classroom_id, (SELECT auth.uid()))))
            )
        ))
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 17. Permissions & Grants
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_community_role_badge(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_kfa_member() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_student_community() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_classroom_community(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_community_post_view(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_community_accepted_answer(UUID, UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 18. Seed Initial Categories
-- ----------------------------------------------------------------------------
INSERT INTO public.community_categories (name, slug, description, access_scope, display_order, icon_name)
VALUES
  -- Public Categories
  ('Flute Questions', 'flute-questions', 'General flute and bansuri questions, instrument guidance, maintenance, and acoustics.', 'public', 1, 'HelpCircle'),
  ('Beginner Discussions', 'beginner-discussions', 'Questions about starting flute, posture, blowing, fingering, lip placement, and breath control.', 'public', 2, 'GraduationCap'),
  ('Raag & Music Discussions', 'raag-and-music-discussions', 'Indian classical music, raag concepts, taal, aroha-avaroha, pakad, notation, and theory.', 'public', 3, 'Music'),
  ('General Bansuri Discussion', 'general-bansuri-discussion', 'Open discussion on bansuri artists, recordings, performances, and flute appreciation.', 'public', 4, 'MessageSquare'),

  -- KFA Students Only Categories
  ('Practice Corner', 'practice-corner', 'Practice-related discussions, daily riyaz difficulties, routine building, and personal tips.', 'students', 5, 'Clock'),
  ('Learning Discussions', 'learning-discussions', 'Questions and exchange related to Krishna Flute Academy curriculum and syllabus.', 'students', 6, 'BookOpen'),
  ('Student Performances', 'student-performances', 'KFA students share audio, video clips, progress recordings, and peer encouragement.', 'students', 7, 'PlayCircle'),
  ('Ask Krishna Sir', 'ask-krishna-sir', 'Direct musical and learning questions for Guru Krishna Gopal Bhaumik.', 'students', 8, 'Sparkles')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  access_scope = EXCLUDED.access_scope,
  display_order = EXCLUDED.display_order,
  icon_name = EXCLUDED.icon_name;
