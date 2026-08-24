-- Part 1D: Notifications, Classrooms, Overrides & Mentors
CREATE INDEX IF NOT EXISTS idx_session_student_overrides_student_id ON public.session_student_overrides(student_id);
CREATE INDEX IF NOT EXISTS idx_session_student_overrides_target_date ON public.session_student_overrides(target_classroom_id, override_date);
CREATE INDEX IF NOT EXISTS idx_broadcast_reads_user_id ON public.broadcast_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_classrooms_teacher_id ON public.classrooms(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classroom_session_logs_classroom_id ON public.classroom_session_logs(classroom_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE (is_read = false);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_mentors_mentor ON public.student_mentors(mentor_id);
CREATE INDEX IF NOT EXISTS idx_student_mentors_student ON public.student_mentors(student_id);
