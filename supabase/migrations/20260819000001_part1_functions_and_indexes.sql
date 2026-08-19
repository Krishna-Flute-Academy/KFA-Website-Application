-- Part 1: Security Functions & Database Indexes
-- Run this block first in Supabase SQL Editor

-- 1. Helper Functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid()) AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_teacher()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'teacher')
  );
$$;

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_session_student_overrides_student_id ON public.session_student_overrides(student_id);
CREATE INDEX IF NOT EXISTS idx_session_student_overrides_target_date ON public.session_student_overrides(target_classroom_id, override_date);
CREATE INDEX IF NOT EXISTS idx_student_topic_progress_student_id ON public.student_topic_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_student_topic_progress_student_lesson ON public.student_topic_progress(student_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_classroom_inventory_alloc_student ON public.classroom_inventory_allocation(allocated_to_student_id);
CREATE INDEX IF NOT EXISTS idx_classroom_inventory_alloc_classroom ON public.classroom_inventory_allocation(classroom_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_reads_user_id ON public.broadcast_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_classrooms_teacher_id ON public.classrooms(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classroom_session_logs_classroom_id ON public.classroom_session_logs(classroom_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE (is_read = false);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leave_requests_classroom_status ON public.leave_requests(classroom_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);
CREATE INDEX IF NOT EXISTS idx_attendance_classroom_date ON public.attendance(classroom_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON public.attendance(student_id, date);
CREATE INDEX IF NOT EXISTS idx_student_mentors_mentor ON public.student_mentors(mentor_id);
CREATE INDEX IF NOT EXISTS idx_student_mentors_student ON public.student_mentors(student_id);
