-- ============================================================================
-- Migration: Fix Community Notifications Foreign Key, Realtime Replica Identity & Secure RPC
-- Target: Live Production Database
-- Rationale:
--   1. Fixes foreign key constraint on `notifications.user_id` so it references `auth.users(id)`
--      rather than `public.users(id)`. This allows external Community members (who exist in
--      `auth.users` and `community_profiles` but not `public.users`) to receive notifications.
--   2. Enables `REPLICA IDENTITY FULL` on `notifications` so Supabase Realtime row-level filters
--      (`user_id=eq...`) work reliably for INSERT, UPDATE (mark read), and DELETE without drops.
--   3. Provides a secure `SECURITY DEFINER` RPC `create_community_notification` with strict validation:
--      - Caller must be authenticated (`auth.uid()`).
--      - Disallows self-notifications.
--      - Validates recipient exists in `auth.users`.
--      - Prevents spamming on toggled likes/reactions.
--   4. Removes the permissive direct INSERT policy so untrusted users cannot forge arbitrary notifications.
-- ============================================================================

-- 1. Update Foreign Key Constraint to reference auth.users(id)
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE public.notifications 
  ADD CONSTRAINT notifications_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Enable REPLICA IDENTITY FULL for reliable Supabase Realtime row-level filtered broadcasts
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- 3. Create Trusted SECURITY DEFINER RPC for Community Notifications
CREATE OR REPLACE FUNCTION public.create_community_notification(
    p_recipient_id UUID,
    p_title TEXT,
    p_message TEXT,
    p_link TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL,
    p_is_reaction BOOLEAN DEFAULT FALSE,
    p_post_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_notif_id UUID;
    v_recent_exists BOOLEAN;
BEGIN
    -- Ensure caller is authenticated
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;

    -- Never notify user about their own action
    IF p_recipient_id = v_caller_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Self-notification excluded');
    END IF;

    -- Verify recipient exists in auth.users
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_recipient_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Recipient not found');
    END IF;

    -- Anti-spam deduplication specifically for reactions (likes) on the same post/reply
    IF p_is_reaction AND p_post_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.notifications
            WHERE user_id = p_recipient_id
              AND type = 'community'
              AND (metadata->>'type' LIKE '%reaction%' OR title LIKE '%Reaction%')
              AND (
                  (is_read = false AND created_at > now() - interval '24 hours')
                  OR
                  (is_read = true AND created_at > now() - interval '2 hours')
              )
              AND (
                  (metadata->>'post_id' = p_post_id::text)
              )
        ) INTO v_recent_exists;

        IF v_recent_exists THEN
            RETURN jsonb_build_object('success', false, 'error', 'Reaction notification deduplicated');
        END IF;
    END IF;

    -- Insert notification securely
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        link,
        metadata,
        is_read
    ) VALUES (
        p_recipient_id,
        'community',
        p_title,
        p_message,
        p_link,
        p_metadata,
        false
    ) RETURNING id INTO v_notif_id;

    RETURN jsonb_build_object('success', true, 'id', v_notif_id);
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.create_community_notification TO authenticated;

-- 4. Remove open direct INSERT policy to prevent forging arbitrary notifications
DROP POLICY IF EXISTS "Authenticated users insert notifications" ON public.notifications;
