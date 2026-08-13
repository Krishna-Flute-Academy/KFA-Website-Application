-- Migration: Update notifications_type_check to allow fee_reminder notification type

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN ('reminder', 'live_class', 'messages', 'tasks', 'task', 'classroom', 'curriculum', 'attendance', 'fees', 'fee_reminder')
);
