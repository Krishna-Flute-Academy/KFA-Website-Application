-- Migration: Optimize Database Disk IO & RLS Performance
-- Purpose: Resolve Disk IO budget depletion by caching auth.uid() & role checks in RLS policies, and adding missing indexes on foreign keys & frequent query filters.

-- ============================================================================
-- 1. OPTIMIZED SECURITY HELPER FUNCTIONS
-- ============================================================================

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

-- ============================================================================
-- 2. HIGH-IMPACT MISSING INDEXES FOR DISK IO REDUCTION
-- ============================================================================

-- A. Push Subscriptions
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- B. Session Student Overrides
CREATE INDEX IF NOT EXISTS idx_session_student_overrides_student_id ON public.session_student_overrides(student_id);
CREATE INDEX IF NOT EXISTS idx_session_student_overrides_target_date ON public.session_student_overrides(target_classroom_id, override_date);

-- C. Student Topic Progress
CREATE INDEX IF NOT EXISTS idx_student_topic_progress_student_id ON public.student_topic_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_student_topic_progress_student_lesson ON public.student_topic_progress(student_id, lesson_id);

-- D. Inventory Allocation
CREATE INDEX IF NOT EXISTS idx_classroom_inventory_alloc_student ON public.classroom_inventory_allocation(allocated_to_student_id);
CREATE INDEX IF NOT EXISTS idx_classroom_inventory_alloc_classroom ON public.classroom_inventory_allocation(classroom_id);

-- E. Broadcast Reads
CREATE INDEX IF NOT EXISTS idx_broadcast_reads_user_id ON public.broadcast_reads(user_id);

-- F. Classrooms & Session Logs
CREATE INDEX IF NOT EXISTS idx_classrooms_teacher_id ON public.classrooms(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classroom_session_logs_classroom_id ON public.classroom_session_logs(classroom_id);

-- G. Notifications (Composite for feed queries and unread badge count polling)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE (is_read = false);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

-- H. Leave Requests (Composite for teacher sidebar pending leaves count)
CREATE INDEX IF NOT EXISTS idx_leave_requests_classroom_status ON public.leave_requests(classroom_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);

-- I. Users Table Filters
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);

-- J. Attendance Composites
CREATE INDEX IF NOT EXISTS idx_attendance_classroom_date ON public.attendance(classroom_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON public.attendance(student_id, date);

-- K. Mentorship System
CREATE INDEX IF NOT EXISTS idx_student_mentors_mentor ON public.student_mentors(mentor_id);
CREATE INDEX IF NOT EXISTS idx_student_mentors_student ON public.student_mentors(student_id);


-- ============================================================================
-- 3. CACHED & OPTIMIZED RLS POLICIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. public.users
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own profile details" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Admins and teachers can insert users" ON public.users;
DROP POLICY IF EXISTS "Admins and teachers can update users" ON public.users;
DROP POLICY IF EXISTS "Admins and teachers can delete users" ON public.users;

CREATE POLICY "Users can update own profile details"
  ON public.users FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK (
    (SELECT auth.uid()) = id AND (
      (SELECT public.is_admin_or_teacher()) OR 
      public.check_user_self_update(id, role, status)
    )
  );

CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id AND role = 'student');

CREATE POLICY "Admins and teachers can insert users"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

CREATE POLICY "Admins and teachers can update users"
  ON public.users FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

CREATE POLICY "Admins and teachers can delete users"
  ON public.users FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin_or_teacher()));

-- ----------------------------------------------------------------------------
-- B. public.fees_payments
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students can view own payments; Admins/Teachers view all" ON public.fees_payments;
DROP POLICY IF EXISTS "Admins and teachers manage fee payments" ON public.fees_payments;

CREATE POLICY "Students can view own payments; Admins/Teachers view all"
  ON public.fees_payments FOR SELECT
  TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

CREATE POLICY "Admins and teachers manage fee payments"
  ON public.fees_payments FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- ----------------------------------------------------------------------------
-- C. public.fees_notifications
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students can view own notifications; Admins/Teachers view all" ON public.fees_notifications;
DROP POLICY IF EXISTS "Admins and teachers manage fee notifications" ON public.fees_notifications;

CREATE POLICY "Students can view own notifications; Admins/Teachers view all"
  ON public.fees_notifications FOR SELECT
  TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

CREATE POLICY "Admins and teachers manage fee notifications"
  ON public.fees_notifications FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- ----------------------------------------------------------------------------
-- D. public.attendance
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students view own attendance; Admins/Teachers view all" ON public.attendance;
DROP POLICY IF EXISTS "Admins and teachers manage attendance records" ON public.attendance;

CREATE POLICY "Students view own attendance; Admins/Teachers view all"
  ON public.attendance FOR SELECT
  TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

CREATE POLICY "Admins and teachers manage attendance records"
  ON public.attendance FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- ----------------------------------------------------------------------------
-- E. public.leave_requests
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own leave; Admins/Teachers view all" ON public.leave_requests;
DROP POLICY IF EXISTS "Students can request leave; Admins/Teachers can submit on behalf" ON public.leave_requests;
DROP POLICY IF EXISTS "Students can update own request; Admins/Teachers manage all" ON public.leave_requests;
DROP POLICY IF EXISTS "Students can cancel own request; Admins/Teachers manage all" ON public.leave_requests;

CREATE POLICY "Users can view own leave; Admins/Teachers view all"
  ON public.leave_requests FOR SELECT
  TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

CREATE POLICY "Students can request leave; Admins/Teachers can submit on behalf"
  ON public.leave_requests FOR INSERT
  TO authenticated
  WITH CHECK (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

CREATE POLICY "Students can update own request; Admins/Teachers manage all"
  ON public.leave_requests FOR UPDATE
  TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()))
  WITH CHECK (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

CREATE POLICY "Students can cancel own request; Admins/Teachers manage all"
  ON public.leave_requests FOR DELETE
  TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

-- ----------------------------------------------------------------------------
-- F. public.classrooms
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Teachers and admins can update classrooms" ON public.classrooms;

CREATE POLICY "Teachers and admins can update classrooms"
  ON public.classrooms FOR UPDATE
  TO authenticated
  USING (teacher_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  WITH CHECK (teacher_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

-- ----------------------------------------------------------------------------
-- G. public.classroom_students
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students view own enrollments; Admins/Teachers view all" ON public.classroom_students;
DROP POLICY IF EXISTS "Admins and teachers manage classroom students" ON public.classroom_students;

CREATE POLICY "Students view own enrollments; Admins/Teachers view all"
  ON public.classroom_students FOR SELECT
  TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

CREATE POLICY "Admins and teachers manage classroom students"
  ON public.classroom_students FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- ----------------------------------------------------------------------------
-- H. public.classroom_messages
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members of classroom and admins/teachers read messages" ON public.classroom_messages;
DROP POLICY IF EXISTS "Users can insert messages as themselves" ON public.classroom_messages;
DROP POLICY IF EXISTS "Users can delete own messages; Admins/Teachers delete any" ON public.classroom_messages;

CREATE POLICY "Members of classroom and admins/teachers read messages"
  ON public.classroom_messages FOR SELECT
  TO authenticated
  USING (
    (SELECT public.is_admin_or_teacher()) OR 
    EXISTS (
      SELECT 1 FROM public.classroom_students cs 
      WHERE cs.classroom_id = classroom_messages.classroom_id 
        AND cs.student_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert messages as themselves"
  ON public.classroom_messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own messages; Admins/Teachers delete any"
  ON public.classroom_messages FOR DELETE
  TO authenticated
  USING (sender_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

-- ----------------------------------------------------------------------------
-- I. public.session_student_overrides
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students read own session overrides; Admins/Teachers view all" ON public.session_student_overrides;
DROP POLICY IF EXISTS "Admins and teachers manage session overrides" ON public.session_student_overrides;

CREATE POLICY "Students read own session overrides; Admins/Teachers view all"
  ON public.session_student_overrides FOR SELECT
  TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

CREATE POLICY "Admins and teachers manage session overrides"
  ON public.session_student_overrides FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- ----------------------------------------------------------------------------
-- J. public.assignment_students
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students read own assignments; Admins/Teachers view all" ON public.assignment_students;
DROP POLICY IF EXISTS "Students update own submission details" ON public.assignment_students;
DROP POLICY IF EXISTS "Admins and teachers manage assignment students" ON public.assignment_students;

CREATE POLICY "Students read own assignments; Admins/Teachers view all"
  ON public.assignment_students FOR SELECT
  TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

CREATE POLICY "Students update own submission details"
  ON public.assignment_students FOR UPDATE
  TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()))
  WITH CHECK (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

CREATE POLICY "Admins and teachers manage assignment students"
  ON public.assignment_students FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- ----------------------------------------------------------------------------
-- K. public.classroom_inventory_allocation
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students read own inventory allocations; Admins/Teachers view all" ON public.classroom_inventory_allocation;
DROP POLICY IF EXISTS "Admins and teachers manage classroom inventory allocation" ON public.classroom_inventory_allocation;

CREATE POLICY "Students read own inventory allocations; Admins/Teachers view all"
  ON public.classroom_inventory_allocation FOR SELECT
  TO authenticated
  USING (allocated_to_student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

CREATE POLICY "Admins and teachers manage classroom inventory allocation"
  ON public.classroom_inventory_allocation FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- ----------------------------------------------------------------------------
-- L. public.student_topic_progress
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students read/manage own progress; Admins/Teachers view all" ON public.student_topic_progress;
DROP POLICY IF EXISTS "Students can update own progress details" ON public.student_topic_progress;
DROP POLICY IF EXISTS "Students can insert own progress details" ON public.student_topic_progress;
DROP POLICY IF EXISTS "Admins and teachers manage student topic progress" ON public.student_topic_progress;

CREATE POLICY "Students read/manage own progress; Admins/Teachers view all"
  ON public.student_topic_progress FOR SELECT
  TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

CREATE POLICY "Students can update own progress details"
  ON public.student_topic_progress FOR UPDATE
  TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()))
  WITH CHECK (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

CREATE POLICY "Students can insert own progress details"
  ON public.student_topic_progress FOR INSERT
  TO authenticated
  WITH CHECK (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

CREATE POLICY "Admins and teachers manage student topic progress"
  ON public.student_topic_progress FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- ----------------------------------------------------------------------------
-- M. public.user_sessions
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can view own sessions, admins can view all" ON public.user_sessions;

CREATE POLICY "Users can insert their own sessions"
  ON public.user_sessions FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own sessions"
  ON public.user_sessions FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can view own sessions, admins can view all"
  ON public.user_sessions FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

-- ----------------------------------------------------------------------------
-- N. public.push_subscriptions
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Teachers and admins can read push subscriptions" ON public.push_subscriptions;

CREATE POLICY "Teachers and admins can read push subscriptions"
  ON public.push_subscriptions FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin_or_teacher()));

-- ----------------------------------------------------------------------------
-- O. public.broadcast_reads
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow users to read own broadcast reads" ON public.broadcast_reads;
DROP POLICY IF EXISTS "Allow users to insert own broadcast reads" ON public.broadcast_reads;

CREATE POLICY "Allow users to read own broadcast reads"
  ON public.broadcast_reads FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

CREATE POLICY "Allow users to insert own broadcast reads"
  ON public.broadcast_reads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ----------------------------------------------------------------------------
-- P. public.student_mentors
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students, mentors, admins, teachers can read mentorships" ON public.student_mentors;

CREATE POLICY "Students, mentors, admins, teachers can read mentorships"
  ON public.student_mentors FOR SELECT
  TO authenticated
  USING (
    student_id = (SELECT auth.uid()) OR 
    mentor_id = (SELECT auth.uid()) OR 
    (SELECT public.is_admin_or_teacher())
  );
