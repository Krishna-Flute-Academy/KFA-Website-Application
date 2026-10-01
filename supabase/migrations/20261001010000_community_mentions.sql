-- ============================================================================
-- Migration: Community Mentions & Tagging System
-- Description:
--   1. Creates `public.community_mentions` table for normalized mention relationships.
--   2. Enforces unique constraints so a user cannot be mentioned redundantly in the same post/reply.
--   3. Adds RLS policies for secure insertion, deletion, and reading.
--   4. Creates targeted indexes for fast recipient mention lookups.
-- Target DB: Auth & Application Instance
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.community_mentions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE,
    reply_id UUID REFERENCES public.community_replies(id) ON DELETE CASCADE,
    mentioned_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mentioned_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT check_mention_target CHECK (
        ((post_id IS NOT NULL AND reply_id IS NULL) OR (reply_id IS NOT NULL AND post_id IS NULL))
    )
);

-- Unique indexes to prevent duplicate mention rows for the same user on the same post or reply
CREATE UNIQUE INDEX IF NOT EXISTS unique_post_user_mention 
  ON public.community_mentions (post_id, mentioned_user_id) 
  WHERE post_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_reply_user_mention 
  ON public.community_mentions (reply_id, mentioned_user_id) 
  WHERE reply_id IS NOT NULL;

-- Fast index for user notification and mention feeds
CREATE INDEX IF NOT EXISTS idx_community_mentions_mentioned_user 
  ON public.community_mentions (mentioned_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_mentions_post_id 
  ON public.community_mentions (post_id) WHERE post_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_community_mentions_reply_id 
  ON public.community_mentions (reply_id) WHERE reply_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE public.community_mentions ENABLE ROW LEVEL SECURITY;

-- 1. Mentions are viewable by authenticated users
DROP POLICY IF EXISTS "Mentions are viewable by authenticated users" ON public.community_mentions;
CREATE POLICY "Mentions are viewable by authenticated users" 
  ON public.community_mentions FOR SELECT 
  TO authenticated 
  USING (true);

-- 2. Authenticated users can insert their own mentions
DROP POLICY IF EXISTS "Authenticated users can insert mentions" ON public.community_mentions;
CREATE POLICY "Authenticated users can insert mentions" 
  ON public.community_mentions FOR INSERT 
  TO authenticated 
  WITH CHECK (
    (auth.uid() = mentioned_by_user_id)
  );

-- 3. Users can delete their own created mentions (e.g. on post/reply edit or delete)
DROP POLICY IF EXISTS "Users can delete own mentions" ON public.community_mentions;
CREATE POLICY "Users can delete own mentions" 
  ON public.community_mentions FOR DELETE 
  TO authenticated 
  USING (
    (auth.uid() = mentioned_by_user_id)
  );
