-- ============================================================================
-- Migration: KFA Community — Post/Reply Editing, Deletion & Admin Moderation
-- Description:
--   1. Adds soft-deletion columns (is_deleted, deleted_at, deleted_by, deletion_reason)
--      to community_posts and community_replies.
--   2. Enforces database trigger rules:
--      - Only the original author can edit post/reply text content.
--      - Admins can moderate / soft-delete any post or reply with accountability.
--      - Admins CANNOT silently rewrite another user's words.
--      - updated_at is only updated when actual content fields are modified,
--        preventing false "Edited" triggers from counters or moderation flags.
--   3. Updates Row Level Security (RLS) policies for UPDATE and DELETE on
--      community_posts and community_replies.
--   4. Excludes deleted posts from public SELECT while preserving relationships
--      and thread continuity.
-- Target DB: Auth & Application Instance (sevtycwrmhzyfxvxkkgc.supabase.co)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Add Soft Deletion Columns to community_posts
-- ----------------------------------------------------------------------------
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_community_posts_is_deleted 
  ON public.community_posts (is_deleted);

-- ----------------------------------------------------------------------------
-- 2. Add Soft Deletion Columns to community_replies
-- ----------------------------------------------------------------------------
ALTER TABLE public.community_replies
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_community_replies_is_deleted 
  ON public.community_replies (is_deleted);

-- ----------------------------------------------------------------------------
-- 3. Hardened Post Update Trigger: Author Edit vs Admin Moderation
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_community_post_update_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_is_admin BOOLEAN;
  v_content_changed BOOLEAN;
BEGIN
  v_caller_id := auth.uid();
  v_is_admin := (SELECT public.is_admin());

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

  -- Check if actual textual content or category changed
  v_content_changed := (
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.content IS DISTINCT FROM OLD.content OR
    NEW.category_id IS DISTINCT FROM OLD.category_id OR
    NEW.post_type IS DISTINCT FROM OLD.post_type
  );

  -- Role & Content-Editing Security Enforcement
  IF v_caller_id = OLD.author_id THEN
    -- Author is editing their own post or deleting it
    -- Authors cannot alter moderation flags (is_pinned, is_locked)
    IF (NEW.is_pinned IS DISTINCT FROM OLD.is_pinned OR NEW.is_locked IS DISTINCT FROM OLD.is_locked) THEN
      IF NOT v_is_admin THEN
        NEW.is_pinned := OLD.is_pinned;
        NEW.is_locked := OLD.is_locked;
      END IF;
    END IF;
  ELSIF v_is_admin THEN
    -- Admin is moderating someone else's post
    -- CRITICAL RULE: Admin CANNOT alter author's title or content!
    IF v_content_changed THEN
      RAISE EXCEPTION 'Admins may moderate or delete posts, but cannot alter the author''s original content';
    END IF;
  ELSE
    -- Neither author nor admin
    RAISE EXCEPTION 'Unauthorized to modify this post';
  END IF;

  -- Soft-deletion accountability
  IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
    NEW.deleted_at := COALESCE(NEW.deleted_at, now());
    NEW.deleted_by := COALESCE(NEW.deleted_by, v_caller_id);
  ELSIF NEW.is_deleted = false AND OLD.is_deleted = true THEN
    -- Restoration
    NEW.deleted_at := NULL;
    NEW.deleted_by := NULL;
    NEW.deletion_reason := NULL;
  END IF;

  -- Timestamp tracking: updated_at only updates when content actually changes
  IF v_content_changed THEN
    NEW.updated_at := now();
  ELSE
    NEW.updated_at := OLD.updated_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_community_post_update_rules ON public.community_posts;
CREATE TRIGGER trg_enforce_community_post_update_rules
BEFORE UPDATE ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.enforce_community_post_update_rules();

-- ----------------------------------------------------------------------------
-- 4. Hardened Reply Update Trigger: Author Edit vs Admin Moderation
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_community_reply_update_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_is_admin BOOLEAN;
  v_content_changed BOOLEAN;
BEGIN
  v_caller_id := auth.uid();
  v_is_admin := (SELECT public.is_admin());

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

  v_content_changed := (NEW.content IS DISTINCT FROM OLD.content);

  -- Role & Content-Editing Security Enforcement
  IF v_caller_id = OLD.author_id THEN
    -- Author is updating or soft-deleting own reply
    NULL;
  ELSIF v_is_admin THEN
    -- Admin is moderating someone else's reply
    -- CRITICAL RULE: Admin CANNOT alter author's words!
    IF v_content_changed THEN
      RAISE EXCEPTION 'Admins may moderate or delete replies, but cannot alter the author''s original words';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unauthorized to modify this reply';
  END IF;

  -- Soft-deletion accountability
  IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
    NEW.deleted_at := COALESCE(NEW.deleted_at, now());
    NEW.deleted_by := COALESCE(NEW.deleted_by, v_caller_id);
  ELSIF NEW.is_deleted = false AND OLD.is_deleted = true THEN
    NEW.deleted_at := NULL;
    NEW.deleted_by := NULL;
    NEW.deletion_reason := NULL;
  END IF;

  -- Timestamp tracking
  IF v_content_changed THEN
    NEW.updated_at := now();
  ELSE
    NEW.updated_at := OLD.updated_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_community_reply_update_rules ON public.community_replies;
CREATE TRIGGER trg_enforce_community_reply_update_rules
BEFORE UPDATE ON public.community_replies
FOR EACH ROW EXECUTE FUNCTION public.enforce_community_reply_update_rules();

-- ----------------------------------------------------------------------------
-- 5. System Trigger: Counter Sync for Soft-Deleted Replies
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
    IF NEW.is_deleted = false THEN
      UPDATE public.community_posts
      SET replies_count = replies_count + 1
      WHERE id = NEW.post_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.is_deleted = false THEN
      UPDATE public.community_posts
      SET replies_count = GREATEST(0, replies_count - 1)
      WHERE id = OLD.post_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
      -- Reply soft-deleted
      UPDATE public.community_posts
      SET replies_count = GREATEST(0, replies_count - 1)
      WHERE id = NEW.post_id;
    ELSIF NEW.is_deleted = false AND OLD.is_deleted = true THEN
      -- Reply restored
      UPDATE public.community_posts
      SET replies_count = replies_count + 1
      WHERE id = NEW.post_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_community_post_replies ON public.community_replies;
CREATE TRIGGER trg_update_community_post_replies
AFTER INSERT OR UPDATE OF is_deleted OR DELETE ON public.community_replies
FOR EACH ROW EXECUTE FUNCTION public.update_community_post_stats();

-- ----------------------------------------------------------------------------
-- 6. Updated Row Level Security (RLS) Policies
-- ----------------------------------------------------------------------------

-- Table: community_posts (SELECT)
-- Deleted posts are completely hidden from normal community users.
-- Admins can view deleted posts for moderation audit.
-- Authors can view their own deleted post status.
DROP POLICY IF EXISTS "Community posts visibility rule" ON public.community_posts;
CREATE POLICY "Community posts visibility rule"
  ON public.community_posts FOR SELECT
  USING (
    (is_deleted = false OR (SELECT public.is_admin()) OR (SELECT auth.uid()) = author_id)
    AND (
      visibility = 'public'
      OR (visibility = 'students' AND (SELECT public.can_access_student_community()))
      OR (visibility = 'classroom' AND classroom_id IS NOT NULL AND (SELECT public.can_access_classroom_community(classroom_id)))
      OR (SELECT public.is_admin())
    )
  );

-- Table: community_posts (UPDATE)
-- Only author or verified admin can update.
DROP POLICY IF EXISTS "Authors and staff can update posts" ON public.community_posts;
CREATE POLICY "Authors and staff can update posts"
  ON public.community_posts FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) = author_id 
    OR (SELECT public.is_admin())
  )
  WITH CHECK (
    (SELECT auth.uid()) = author_id 
    OR (SELECT public.is_admin())
  );

-- Table: community_posts (DELETE)
-- Hard delete capability restricted to author and admin.
DROP POLICY IF EXISTS "Authors and admins can delete posts" ON public.community_posts;
CREATE POLICY "Authors and admins can delete posts"
  ON public.community_posts FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = author_id OR (SELECT public.is_admin())
  );

-- Table: community_replies (SELECT)
-- Replies are readable if the parent post is readable.
DROP POLICY IF EXISTS "Replies readable if parent post is readable" ON public.community_replies;
CREATE POLICY "Replies readable if parent post is readable"
  ON public.community_replies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.community_posts p
      WHERE p.id = post_id
    )
  );

-- Table: community_replies (UPDATE)
-- Only author or verified admin can update.
DROP POLICY IF EXISTS "Authors and staff can update replies" ON public.community_replies;
CREATE POLICY "Authors and staff can update replies"
  ON public.community_replies FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) = author_id 
    OR (SELECT public.is_admin())
  )
  WITH CHECK (
    (SELECT auth.uid()) = author_id 
    OR (SELECT public.is_admin())
  );

-- Table: community_replies (DELETE)
-- Hard delete capability restricted to author and admin.
DROP POLICY IF EXISTS "Authors and admins can delete replies" ON public.community_replies;
CREATE POLICY "Authors and admins can delete replies"
  ON public.community_replies FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = author_id OR (SELECT public.is_admin())
  );
