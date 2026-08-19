-- Migration: Add missing indexes on high-scan tables and foreign keys to eliminate Disk I/O bottlenecks

-- 1. High-Scan Tables (Fixing full table scans)
CREATE INDEX IF NOT EXISTS idx_classrooms_teacher_id ON public.classrooms(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classrooms_status ON public.classrooms(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);

-- 2. Classroom Inventory Allocation
CREATE INDEX IF NOT EXISTS idx_cia_classroom_id ON public.classroom_inventory_allocation(classroom_id);
CREATE INDEX IF NOT EXISTS idx_cia_student_id ON public.classroom_inventory_allocation(allocated_to_student_id);
CREATE INDEX IF NOT EXISTS idx_cia_allocated_by ON public.classroom_inventory_allocation(allocated_by);
CREATE INDEX IF NOT EXISTS idx_cia_chapter_id ON public.classroom_inventory_allocation(chapter_id);
CREATE INDEX IF NOT EXISTS idx_cia_lesson_id ON public.classroom_inventory_allocation(lesson_id);
CREATE INDEX IF NOT EXISTS idx_cia_module_id ON public.classroom_inventory_allocation(module_id);

-- 3. Unindexed Foreign Keys
CREATE INDEX IF NOT EXISTS idx_tasks_classroom_id ON public.tasks(classroom_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);

CREATE INDEX IF NOT EXISTS idx_inventory_category_id ON public.inventory(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_level_id ON public.inventory(level_id);
CREATE INDEX IF NOT EXISTS idx_inventory_uploaded_by ON public.inventory(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_task_inventory_inventory_id ON public.task_inventory(inventory_id);

CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON public.submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_task_id ON public.submissions(task_id);

CREATE INDEX IF NOT EXISTS idx_attendance_marked_by ON public.attendance(marked_by);

CREATE INDEX IF NOT EXISTS idx_task_attempts_student_id ON public.task_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_task_attempts_task_id ON public.task_attempts(task_id);

CREATE INDEX IF NOT EXISTS idx_attempt_files_attempt_id ON public.attempt_files(attempt_id);

CREATE INDEX IF NOT EXISTS idx_temporary_classes_teacher_id ON public.temporary_classes(teacher_id);

CREATE INDEX IF NOT EXISTS idx_temp_class_students_student_id ON public.temporary_class_students(student_id);
CREATE INDEX IF NOT EXISTS idx_temp_class_students_class_id ON public.temporary_class_students(temporary_class_id);

CREATE INDEX IF NOT EXISTS idx_class_notes_classroom_id ON public.class_notes(classroom_id);
CREATE INDEX IF NOT EXISTS idx_class_notes_teacher_id ON public.class_notes(teacher_id);

CREATE INDEX IF NOT EXISTS idx_assignment_students_reviewed_by ON public.assignment_students(reviewed_by);

CREATE INDEX IF NOT EXISTS idx_course_modules_category_id ON public.course_modules(category_id);

CREATE INDEX IF NOT EXISTS idx_student_topic_progress_classroom_id ON public.student_topic_progress(classroom_id);
CREATE INDEX IF NOT EXISTS idx_student_topic_progress_lesson_id ON public.student_topic_progress(lesson_id);

CREATE INDEX IF NOT EXISTS idx_broadcasts_teacher_id ON public.broadcasts(teacher_id);

CREATE INDEX IF NOT EXISTS idx_custom_recipient_groups_teacher_id ON public.custom_recipient_groups(teacher_id);

CREATE INDEX IF NOT EXISTS idx_message_templates_teacher_id ON public.message_templates(teacher_id);

CREATE INDEX IF NOT EXISTS idx_classroom_session_logs_classroom_id ON public.classroom_session_logs(classroom_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_broadcast_reads_user_id ON public.broadcast_reads(user_id);

CREATE INDEX IF NOT EXISTS idx_student_mentors_assigned_by ON public.student_mentors(assigned_by);
