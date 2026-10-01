-- ============================================================================
-- Migration: Community Interactions & Notifications Optimization
-- Description:
--   1. Adds optional `link` (TEXT) and `metadata` (JSONB) columns to public.notifications
--      for direct deep-linking to Community discussions and comments.
--   2. Guarantees check constraint on public.notifications includes 'community'.
--   3. Adds targeted index for fast recipient + type notification queries.
-- Target DB: Auth & Application Instance
-- ============================================================================

-- 1. Add optional link and metadata columns for deep navigation
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS link TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 2. Confirm Check Constraint on notifications.type includes 'community'
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN ('reminder', 'live_class', 'messages', 'tasks', 'task', 'classroom', 'curriculum', 'attendance', 'fees', 'community', 'feedback')
);

-- 3. Targeted Index for Fast Deduplication & Notification Feed Queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_type_created
  ON public.notifications (user_id, type, created_at DESC);
