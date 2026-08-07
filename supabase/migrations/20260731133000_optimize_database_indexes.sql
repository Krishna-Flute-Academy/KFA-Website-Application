-- Migration: Optimize Database Indexes to reduce Disk IO usage
-- Target: public.user_sessions, public.notifications, public.fees_payments, public.leave_requests, public.classroom_students, public.assignment_students

-- 1. Index notifications(user_id) for dashboard queries and real-time filters
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

-- 2. Index user_sessions for user association and active sessions polling query
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON public.user_sessions(last_activity_at) WHERE (logout_at IS NULL);

-- 3. Index fees tables foreign keys
CREATE INDEX IF NOT EXISTS idx_fees_payments_student_id ON public.fees_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_fees_notifications_student_id ON public.fees_notifications(student_id);

-- 4. Index secondary column for composite keys on join tables
CREATE INDEX IF NOT EXISTS idx_classroom_students_student_id ON public.classroom_students(student_id);
CREATE INDEX IF NOT EXISTS idx_assignment_students_student_id ON public.assignment_students(student_id);

-- 5. Index leave_requests foreign keys
CREATE INDEX IF NOT EXISTS idx_leave_requests_student_id ON public.leave_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_classroom_id ON public.leave_requests(classroom_id);
