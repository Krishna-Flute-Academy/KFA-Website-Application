-- Migration: Optimize KFA Notification System
-- Drops noisy automated notification triggers (curriculum, attendance, classroom enrollment)
-- Performs targeted historical data cleanup without touching tasks, fees, messages, announcements, or admin alerts.

-- 1. Drop unwanted automatic notification triggers and their isolated functions
DROP TRIGGER IF EXISTS trg_chapter_unlocked_notification ON public.student_topic_progress;
DROP FUNCTION IF EXISTS public.notify_chapter_unlocked();

DROP TRIGGER IF EXISTS trg_attendance_marked_notification ON public.attendance;
DROP FUNCTION IF EXISTS public.notify_attendance_marked();

DROP TRIGGER IF EXISTS trg_student_enrolled_notification ON public.classroom_students;
DROP FUNCTION IF EXISTS public.notify_student_enrolled();

-- 2. Targeted Historical Cleanup of Unwanted Routine Notification Rows
-- A. Task Due Reminders
DELETE FROM public.notifications 
WHERE title ILIKE '⏰ Task Due Reminder:%';

-- B. Curriculum / Chapter Unlocked
DELETE FROM public.notifications 
WHERE type = 'curriculum' OR title IN ('Chapter Unlocked', 'Lesson Unlocked');

-- C. Attendance Marked
DELETE FROM public.notifications 
WHERE type = 'attendance' OR title ILIKE 'Attendance Marked:%';

-- D. Added to Classroom
DELETE FROM public.notifications 
WHERE title = 'Added to Classroom';

-- 3. Confirm Check Constraint on notifications.type includes 'live_class'
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN ('reminder', 'live_class', 'messages', 'tasks', 'task', 'classroom', 'curriculum', 'attendance', 'fees')
);
