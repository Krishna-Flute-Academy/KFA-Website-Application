-- Migration: Controlled Security Definer RPC for System Notification Settings
-- Allows authenticated users (like students) to read system notification status (blog_enabled, video_enabled, featured_updates_enabled)
-- without granting any direct SELECT permissions on public.message_templates.

-- 1. Security Definer RPC for System Notification Settings
CREATE OR REPLACE FUNCTION public.get_system_notification_settings()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_content JSONB;
BEGIN
  -- Reads from message_templates using function owner (postgres) privileges,
  -- bypassing table-level RLS so callers need ZERO direct SELECT access on message_templates.
  SELECT content::jsonb
    INTO v_content
    FROM public.message_templates
   WHERE name = 'system_notification_settings'
   LIMIT 1;

  IF v_content IS NULL THEN
    RETURN jsonb_build_object(
      'blog_enabled', true,
      'video_enabled', true,
      'featured_updates_enabled', false
    );
  END IF;

  RETURN jsonb_build_object(
    'blog_enabled', COALESCE((v_content->>'blog_enabled')::boolean, true),
    'video_enabled', COALESCE((v_content->>'video_enabled')::boolean, true),
    'featured_updates_enabled', COALESCE((v_content->>'featured_updates_enabled')::boolean, false)
  );
END;
$$;

-- Grant EXECUTE only to authenticated users (Students, Teachers, Admins)
REVOKE EXECUTE ON FUNCTION public.get_system_notification_settings() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_system_notification_settings() TO authenticated;

-- 2. Add notify_reset_at column to featured_updates table for re-notifying students on edit
ALTER TABLE public.featured_updates
ADD COLUMN IF NOT EXISTS notify_reset_at TIMESTAMPTZ;
