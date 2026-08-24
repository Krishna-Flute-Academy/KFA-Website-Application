-- ============================================================================
-- Migration: Complete RLS Security Remediation & Lock Down (Idempotent)
-- Description: Secures all 46 public tables by enabling RLS, dropping legacy
--              permissive 'ALLOW ALL' / 'USING (true)' policies, and applying
--              strict role-based authorization controls.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: Ensure Core Helper Functions Exist & Are Hardened
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
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
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'teacher')
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_classroom(c_id uuid, t_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classrooms
    WHERE id = c_id AND teacher_id = t_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_of_student(s_id uuid, t_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = s_id AND teacher_id = t_id
  );
$$;

CREATE OR REPLACE FUNCTION public.check_user_self_update(user_id uuid, new_role text, new_status text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = user_id AND role = new_role AND status = new_status
  );
$$;

-- ----------------------------------------------------------------------------
-- STEP 2: Enable RLS Across All 46 Public Tables
-- ----------------------------------------------------------------------------

ALTER TABLE public.assignment_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_inventory_allocation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_session_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_recipient_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fees_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fees_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_student_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_topic_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temporary_class_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temporary_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- STEP 3: Drop ALL Legacy / Unsafe / Duplicate Policies Across All Tables
-- ----------------------------------------------------------------------------

-- Table: public.assignment_students
DROP POLICY IF EXISTS "Admins and teachers manage assignment students" ON public.assignment_students;
DROP POLICY IF EXISTS "Allow all assignment_students" ON public.assignment_students;
DROP POLICY IF EXISTS "Students read own assignments; Admins/Teachers view all" ON public.assignment_students;
DROP POLICY IF EXISTS "Students update own submission details" ON public.assignment_students;

-- Table: public.assignments
DROP POLICY IF EXISTS "Admins and teachers manage assignments" ON public.assignments;
DROP POLICY IF EXISTS "Allow all assignments" ON public.assignments;
DROP POLICY IF EXISTS "Authenticated users can read assignments" ON public.assignments;

-- Table: public.attendance
DROP POLICY IF EXISTS "Admins and teachers manage attendance records" ON public.attendance;
DROP POLICY IF EXISTS "Allow all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Students view own attendance; Admins/Teachers view all" ON public.attendance;
DROP POLICY IF EXISTS "Teachers can manage all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Teachers can view student attendance" ON public.attendance;

-- Table: public.batch_schedules
DROP POLICY IF EXISTS "Admins and teachers manage batch schedules" ON public.batch_schedules;
DROP POLICY IF EXISTS "Allow all batch_schedules" ON public.batch_schedules;
DROP POLICY IF EXISTS "Authenticated users can read schedules" ON public.batch_schedules;
DROP POLICY IF EXISTS "Teacher manages batch schedules" ON public.batch_schedules;
DROP POLICY IF EXISTS "Teachers can manage batch schedules for their classrooms" ON public.batch_schedules;

-- Table: public.blog_posts
DROP POLICY IF EXISTS "Admins and teachers can manage blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Allow all for anon on blog_posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Allow public read for blog_posts" ON public.blog_posts;

-- Table: public.broadcast_reads
DROP POLICY IF EXISTS "Allow authenticated users to insert their own broadcast_reads" ON public.broadcast_reads;
DROP POLICY IF EXISTS "Allow authenticated users to read broadcast_reads" ON public.broadcast_reads;
DROP POLICY IF EXISTS "Allow users to insert own broadcast reads" ON public.broadcast_reads;
DROP POLICY IF EXISTS "Allow users to read own broadcast reads" ON public.broadcast_reads;

-- Table: public.broadcasts
DROP POLICY IF EXISTS "Allow all broadcasts" ON public.broadcasts;

-- Table: public.class_notes
DROP POLICY IF EXISTS "Admins and teachers manage class notes" ON public.class_notes;
DROP POLICY IF EXISTS "Allow all class_notes" ON public.class_notes;
DROP POLICY IF EXISTS "Authenticated users can read class notes" ON public.class_notes;

-- Table: public.class_sessions
DROP POLICY IF EXISTS "Teachers can view class sessions" ON public.class_sessions;

-- Table: public.classroom_inventory_allocation
DROP POLICY IF EXISTS "Admins and teachers manage classroom inventory allocation" ON public.classroom_inventory_allocation;
DROP POLICY IF EXISTS "Allow all classroom_inventory_allocation" ON public.classroom_inventory_allocation;
DROP POLICY IF EXISTS "Students read own inventory allocations; Admins/Teachers view all" ON public.classroom_inventory_allocation;

-- Table: public.classroom_messages
DROP POLICY IF EXISTS "Allow all classroom_messages" ON public.classroom_messages;
DROP POLICY IF EXISTS "Members of classroom and admins/teachers read messages" ON public.classroom_messages;
DROP POLICY IF EXISTS "Users can delete own messages; Admins/Teachers delete any" ON public.classroom_messages;
DROP POLICY IF EXISTS "Users can insert messages as themselves" ON public.classroom_messages;

-- Table: public.classroom_session_logs
DROP POLICY IF EXISTS "Admins and teachers manage classroom session logs" ON public.classroom_session_logs;
DROP POLICY IF EXISTS "Allow all classroom_session_logs" ON public.classroom_session_logs;
DROP POLICY IF EXISTS "Students read classroom logs; Admins/Teachers manage all" ON public.classroom_session_logs;

-- Table: public.classroom_students
DROP POLICY IF EXISTS "Admins and teachers manage classroom students" ON public.classroom_students;
DROP POLICY IF EXISTS "Allow all classroom_students" ON public.classroom_students;
DROP POLICY IF EXISTS "Allow students to read their own classroom mapping" ON public.classroom_students;
DROP POLICY IF EXISTS "Students view own enrollments; Admins/Teachers view all" ON public.classroom_students;
DROP POLICY IF EXISTS "Teachers can manage students in their classrooms" ON public.classroom_students;
DROP POLICY IF EXISTS "Teachers can view classroom members" ON public.classroom_students;

-- Table: public.classrooms
DROP POLICY IF EXISTS "Admins can manage classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Allow all authenticated updates on classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Allow authenticated users to read classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Authenticated users can read classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Students view enrolled classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Teachers and admins can update classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Teachers can delete own classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Teachers can delete their own classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Teachers can insert classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Teachers can manage their own classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Teachers can update classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Teachers can update own classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Teachers can update their own classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Teachers can view their own classrooms" ON public.classrooms;

-- Table: public.course_categories
DROP POLICY IF EXISTS "Admins and teachers manage course categories" ON public.course_categories;
DROP POLICY IF EXISTS "Allow all course_categories" ON public.course_categories;
DROP POLICY IF EXISTS "Authenticated users can read categories" ON public.course_categories;

-- Table: public.course_chapters
DROP POLICY IF EXISTS "Admins and teachers manage course chapters" ON public.course_chapters;
DROP POLICY IF EXISTS "Allow all course_chapters" ON public.course_chapters;
DROP POLICY IF EXISTS "Authenticated users can read chapters" ON public.course_chapters;

-- Table: public.course_lessons
DROP POLICY IF EXISTS "Admins and teachers manage course lessons" ON public.course_lessons;
DROP POLICY IF EXISTS "Allow all course_lessons" ON public.course_lessons;
DROP POLICY IF EXISTS "Authenticated users can read lessons" ON public.course_lessons;

-- Table: public.course_modules
DROP POLICY IF EXISTS "Admins and teachers manage course modules" ON public.course_modules;
DROP POLICY IF EXISTS "Allow all course_modules" ON public.course_modules;
DROP POLICY IF EXISTS "Authenticated users can read modules" ON public.course_modules;

-- Table: public.custom_recipient_groups
DROP POLICY IF EXISTS "Allow all custom_recipient_groups" ON public.custom_recipient_groups;

-- Table: public.events
DROP POLICY IF EXISTS "Admins and teachers can manage events" ON public.events;
DROP POLICY IF EXISTS "Allow all for anon on events" ON public.events;
DROP POLICY IF EXISTS "Allow public read for events" ON public.events;

-- Table: public.fees_notifications
DROP POLICY IF EXISTS "Admins and teachers manage fee notifications" ON public.fees_notifications;
DROP POLICY IF EXISTS "Allow all fees_notifications" ON public.fees_notifications;
DROP POLICY IF EXISTS "Students can view own notifications; Admins/Teachers view all" ON public.fees_notifications;

-- Table: public.fees_payments
DROP POLICY IF EXISTS "Admins and teachers manage fee payments" ON public.fees_payments;
DROP POLICY IF EXISTS "Allow all fees_payments" ON public.fees_payments;
DROP POLICY IF EXISTS "Students can view own payments; Admins/Teachers view all" ON public.fees_payments;

-- Table: public.gallery_items
DROP POLICY IF EXISTS "Admins and teachers can manage gallery items" ON public.gallery_items;
DROP POLICY IF EXISTS "Allow all for anon on gallery_items" ON public.gallery_items;
DROP POLICY IF EXISTS "Allow public read for gallery_items" ON public.gallery_items;

-- Table: public.inquiries
DROP POLICY IF EXISTS "Allow public insert for inquiries" ON public.inquiries;

-- Table: public.leave_requests
DROP POLICY IF EXISTS "Allow all leave_requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Students can cancel own request; Admins/Teachers manage all" ON public.leave_requests;
DROP POLICY IF EXISTS "Students can request leave; Admins/Teachers can submit on behalf" ON public.leave_requests;
DROP POLICY IF EXISTS "Students can update own request; Admins/Teachers manage all" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can view own leave; Admins/Teachers view all" ON public.leave_requests;

-- Table: public.message_templates
DROP POLICY IF EXISTS "Allow all message_templates" ON public.message_templates;

-- Table: public.messages
DROP POLICY IF EXISTS "Authenticated users insert direct messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users select direct messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users update direct messages" ON public.messages;

-- Table: public.notifications
DROP POLICY IF EXISTS "Allow authenticated users to insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Teachers can insert notifications for students" ON public.notifications;
DROP POLICY IF EXISTS "Users can manage their own notifications" ON public.notifications;

-- Table: public.push_subscriptions
DROP POLICY IF EXISTS "Teachers and admins can read push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can manage their own subscriptions" ON public.push_subscriptions;

-- Table: public.session_student_overrides
DROP POLICY IF EXISTS "Admins and teachers manage session overrides" ON public.session_student_overrides;
DROP POLICY IF EXISTS "Allow all session_student_overrides" ON public.session_student_overrides;
DROP POLICY IF EXISTS "Students read own session overrides; Admins/Teachers view all" ON public.session_student_overrides;

-- Table: public.student_mentors
DROP POLICY IF EXISTS "Allow authenticated users to read student_mentors" ON public.student_mentors;
DROP POLICY IF EXISTS "Allow teachers and admins to delete student_mentors" ON public.student_mentors;
DROP POLICY IF EXISTS "Allow teachers and admins to insert student_mentors" ON public.student_mentors;
DROP POLICY IF EXISTS "Allow teachers and admins to update student_mentors" ON public.student_mentors;
DROP POLICY IF EXISTS "Students, mentors, admins, teachers can read mentorships" ON public.student_mentors;

-- Table: public.student_topic_progress
DROP POLICY IF EXISTS "Admins and teachers manage student topic progress" ON public.student_topic_progress;
DROP POLICY IF EXISTS "Allow all student_topic_progress" ON public.student_topic_progress;
DROP POLICY IF EXISTS "Students can insert own progress details" ON public.student_topic_progress;
DROP POLICY IF EXISTS "Students can update own progress details" ON public.student_topic_progress;
DROP POLICY IF EXISTS "Students read/manage own progress; Admins/Teachers view all" ON public.student_topic_progress;

-- Table: public.submissions
DROP POLICY IF EXISTS "Teachers can view task attempts for their students" ON public.submissions;

-- Table: public.task_attempts
DROP POLICY IF EXISTS "Students can submit tasks" ON public.task_attempts;
DROP POLICY IF EXISTS "Students can view their submissions" ON public.task_attempts;
DROP POLICY IF EXISTS "Teachers can view task attempts for their students" ON public.task_attempts;

-- Table: public.tasks
DROP POLICY IF EXISTS "Teachers view their classroom tasks" ON public.tasks;

-- Table: public.temporary_class_students
DROP POLICY IF EXISTS "Allow authenticated access to temporary_class_students" ON public.temporary_class_students;
DROP POLICY IF EXISTS "Teachers can manage students for their temporary classes" ON public.temporary_class_students;

-- Table: public.temporary_classes
DROP POLICY IF EXISTS "Admins and teachers manage temporary classes" ON public.temporary_classes;
DROP POLICY IF EXISTS "Allow all temporary_classes" ON public.temporary_classes;
DROP POLICY IF EXISTS "Authenticated users can read temporary classes" ON public.temporary_classes;
DROP POLICY IF EXISTS "Teacher manages temp classes" ON public.temporary_classes;
DROP POLICY IF EXISTS "Teachers can manage their own temporary classes" ON public.temporary_classes;

-- Table: public.testimonials
DROP POLICY IF EXISTS "Admins and teachers can manage testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "Allow all for anon on testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "Allow public read for testimonials" ON public.testimonials;

-- Table: public.user_sessions
DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can view own sessions, admins and teachers can view all" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can view own sessions, admins can view all" ON public.user_sessions;

-- Table: public.users
DROP POLICY IF EXISTS "Admins and teachers can delete users" ON public.users;
DROP POLICY IF EXISTS "Admins and teachers can insert users" ON public.users;
DROP POLICY IF EXISTS "Admins and teachers can update users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can delete any user row" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can insert any user row" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can read users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can update any user row" ON public.users;
DROP POLICY IF EXISTS "Teachers can view student profile info" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile details" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;

-- ----------------------------------------------------------------------------
-- STEP 4: Define Strict Role-Based Policies Across All Components
-- ----------------------------------------------------------------------------

-- ==========================================
-- COMPONENT 1: Users & Accounts (`users`)
-- ==========================================

DROP POLICY IF EXISTS "Users can read own profile; Admins/Teachers read all" ON public.users;
CREATE POLICY "Users can read own profile; Admins/Teachers read all"
  ON public.users FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = id OR 
    (SELECT public.is_admin_or_teacher()) OR
    id IN (
      SELECT teacher_id FROM public.classrooms 
      WHERE id IN (
        SELECT classroom_id FROM public.classroom_students 
        WHERE student_id = (SELECT auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id AND role = 'student');

DROP POLICY IF EXISTS "Users can update own profile details" ON public.users;
CREATE POLICY "Users can update own profile details"
  ON public.users FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK (
    (SELECT auth.uid()) = id AND (
      (SELECT public.is_admin_or_teacher()) OR 
      public.check_user_self_update(id, role, status)
    )
  );

DROP POLICY IF EXISTS "Admins and teachers can insert users" ON public.users;
CREATE POLICY "Admins and teachers can insert users"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Admins and teachers can update users" ON public.users;
CREATE POLICY "Admins and teachers can update users"
  ON public.users FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Admins and teachers can delete users" ON public.users;
CREATE POLICY "Admins and teachers can delete users"
  ON public.users FOR DELETE TO authenticated
  USING ((SELECT public.is_admin_or_teacher()));


-- ==========================================
-- COMPONENT 2: Financials & Ledger (`fees`, `fees_payments`, `fees_notifications`)
-- ==========================================

-- 1. fees
DROP POLICY IF EXISTS "Students view own fees; Admins/Teachers view all" ON public.fees;
CREATE POLICY "Students view own fees; Admins/Teachers view all"
  ON public.fees FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Admins and teachers manage fees" ON public.fees;
CREATE POLICY "Admins and teachers manage fees"
  ON public.fees FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- 2. fees_payments
DROP POLICY IF EXISTS "Students view own payments; Admins/Teachers view all" ON public.fees_payments;
CREATE POLICY "Students view own payments; Admins/Teachers view all"
  ON public.fees_payments FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Admins and teachers manage fee payments" ON public.fees_payments;
CREATE POLICY "Admins and teachers manage fee payments"
  ON public.fees_payments FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- 3. fees_notifications
DROP POLICY IF EXISTS "Students view own notifications; Admins/Teachers view all" ON public.fees_notifications;
CREATE POLICY "Students view own notifications; Admins/Teachers view all"
  ON public.fees_notifications FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Admins and teachers manage fee notifications" ON public.fees_notifications;
CREATE POLICY "Admins and teachers manage fee notifications"
  ON public.fees_notifications FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));


-- ==========================================
-- COMPONENT 3: Attendance & Leaves (`attendance`, `leave_requests`)
-- ==========================================

-- 1. attendance
DROP POLICY IF EXISTS "Students view own attendance; Admins/Teachers view all" ON public.attendance;
CREATE POLICY "Students view own attendance; Admins/Teachers view all"
  ON public.attendance FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Admins and teachers manage attendance records" ON public.attendance;
CREATE POLICY "Admins and teachers manage attendance records"
  ON public.attendance FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- 2. leave_requests
DROP POLICY IF EXISTS "Users view own leave; Admins/Teachers view all" ON public.leave_requests;
CREATE POLICY "Users view own leave; Admins/Teachers view all"
  ON public.leave_requests FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Students request leave; Admins/Teachers submit on behalf" ON public.leave_requests;
CREATE POLICY "Students request leave; Admins/Teachers submit on behalf"
  ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Students update own request; Admins/Teachers manage all" ON public.leave_requests;
CREATE POLICY "Students update own request; Admins/Teachers manage all"
  ON public.leave_requests FOR UPDATE TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()))
  WITH CHECK (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Students cancel own request; Admins/Teachers manage all" ON public.leave_requests;
CREATE POLICY "Students cancel own request; Admins/Teachers manage all"
  ON public.leave_requests FOR DELETE TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));


-- ==========================================
-- COMPONENT 4: Classrooms & Schedule (`classrooms`, `classroom_students`, `batch_schedules`, `temporary_classes`, `temporary_class_students`, `class_sessions`)
-- ==========================================

-- 1. classrooms
DROP POLICY IF EXISTS "Students view enrolled classrooms; Admins/Teachers view all" ON public.classrooms;
CREATE POLICY "Students view enrolled classrooms; Admins/Teachers view all"
  ON public.classrooms FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin_or_teacher()) OR 
    id IN (SELECT classroom_id FROM public.classroom_students WHERE student_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Teachers and admins manage classrooms" ON public.classrooms;
CREATE POLICY "Teachers and admins manage classrooms"
  ON public.classrooms FOR ALL TO authenticated
  USING (teacher_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  WITH CHECK (teacher_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

-- 2. classroom_students
DROP POLICY IF EXISTS "Students view own enrollments; Admins/Teachers view all" ON public.classroom_students;
CREATE POLICY "Students view own enrollments; Admins/Teachers view all"
  ON public.classroom_students FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Admins and teachers manage classroom students" ON public.classroom_students;
CREATE POLICY "Admins and teachers manage classroom students"
  ON public.classroom_students FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- 3. batch_schedules
DROP POLICY IF EXISTS "Students view classroom schedule; Admins/Teachers view all" ON public.batch_schedules;
CREATE POLICY "Students view classroom schedule; Admins/Teachers view all"
  ON public.batch_schedules FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin_or_teacher()) OR
    classroom_id IN (SELECT classroom_id FROM public.classroom_students WHERE student_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Admins and teachers manage batch schedules" ON public.batch_schedules;
CREATE POLICY "Admins and teachers manage batch schedules"
  ON public.batch_schedules FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- 4. temporary_classes & temporary_class_students
DROP POLICY IF EXISTS "Students view temp classes; Admins/Teachers view all" ON public.temporary_classes;
CREATE POLICY "Students view temp classes; Admins/Teachers view all"
  ON public.temporary_classes FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin_or_teacher()) OR
    id IN (SELECT temporary_class_id FROM public.temporary_class_students WHERE student_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Admins and teachers manage temporary classes" ON public.temporary_classes;
CREATE POLICY "Admins and teachers manage temporary classes"
  ON public.temporary_classes FOR ALL TO authenticated
  USING (teacher_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  WITH CHECK (teacher_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Students view temp class enrollment; Admins/Teachers manage all" ON public.temporary_class_students;
CREATE POLICY "Students view temp class enrollment; Admins/Teachers manage all"
  ON public.temporary_class_students FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Admins and teachers manage temp class students" ON public.temporary_class_students;
CREATE POLICY "Admins and teachers manage temp class students"
  ON public.temporary_class_students FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- 5. class_sessions
DROP POLICY IF EXISTS "Students view class sessions; Admins/Teachers view all" ON public.class_sessions;
CREATE POLICY "Students view class sessions; Admins/Teachers view all"
  ON public.class_sessions FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin_or_teacher()) OR
    classroom_id IN (SELECT classroom_id FROM public.classroom_students WHERE student_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Admins and teachers manage class sessions" ON public.class_sessions;
CREATE POLICY "Admins and teachers manage class sessions"
  ON public.class_sessions FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));


-- ==========================================
-- COMPONENT 5: Assignments & Tasks (`assignments`, `assignment_students`, `tasks`, `task_attempts`, `task_inventory`, `submissions`, `attempt_files`)
-- ==========================================

-- 1. assignments & assignment_students
DROP POLICY IF EXISTS "Students view classroom assignments; Admins/Teachers view all" ON public.assignments;
CREATE POLICY "Students view classroom assignments; Admins/Teachers view all"
  ON public.assignments FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin_or_teacher()) OR
    classroom_id IN (SELECT classroom_id FROM public.classroom_students WHERE student_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Admins and teachers manage assignments" ON public.assignments;
CREATE POLICY "Admins and teachers manage assignments"
  ON public.assignments FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Students view own assignment status; Admins/Teachers view all" ON public.assignment_students;
CREATE POLICY "Students view own assignment status; Admins/Teachers view all"
  ON public.assignment_students FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Students update own submission; Admins/Teachers manage all" ON public.assignment_students;
CREATE POLICY "Students update own submission; Admins/Teachers manage all"
  ON public.assignment_students FOR UPDATE TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()))
  WITH CHECK (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Admins and teachers manage assignment students" ON public.assignment_students;
CREATE POLICY "Admins and teachers manage assignment students"
  ON public.assignment_students FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- 2. tasks & task_attempts & submissions & attempt_files & task_inventory
DROP POLICY IF EXISTS "Students view classroom tasks; Admins/Teachers view all" ON public.tasks;
CREATE POLICY "Students view classroom tasks; Admins/Teachers view all"
  ON public.tasks FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin_or_teacher()) OR
    classroom_id IN (SELECT classroom_id FROM public.classroom_students WHERE student_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Admins and teachers manage tasks" ON public.tasks;
CREATE POLICY "Admins and teachers manage tasks"
  ON public.tasks FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Students view own task attempts; Admins/Teachers view all" ON public.task_attempts;
CREATE POLICY "Students view own task attempts; Admins/Teachers view all"
  ON public.task_attempts FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Students submit tasks" ON public.task_attempts;
CREATE POLICY "Students submit tasks"
  ON public.task_attempts FOR INSERT TO authenticated
  WITH CHECK (student_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins and teachers manage task attempts" ON public.task_attempts;
CREATE POLICY "Admins and teachers manage task attempts"
  ON public.task_attempts FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Students view own submissions; Admins/Teachers view all" ON public.submissions;
CREATE POLICY "Students view own submissions; Admins/Teachers view all"
  ON public.submissions FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Students submit task submissions" ON public.submissions;
CREATE POLICY "Students submit task submissions"
  ON public.submissions FOR INSERT TO authenticated
  WITH CHECK (student_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins and teachers manage submissions" ON public.submissions;
CREATE POLICY "Admins and teachers manage submissions"
  ON public.submissions FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Authenticated users view attempt files" ON public.attempt_files;
CREATE POLICY "Authenticated users view attempt files"
  ON public.attempt_files FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Students insert attempt files" ON public.attempt_files;
CREATE POLICY "Students insert attempt files"
  ON public.attempt_files FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins and teachers manage attempt files" ON public.attempt_files;
CREATE POLICY "Admins and teachers manage attempt files"
  ON public.attempt_files FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Authenticated users view task inventory" ON public.task_inventory;
CREATE POLICY "Authenticated users view task inventory"
  ON public.task_inventory FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins and teachers manage task inventory" ON public.task_inventory;
CREATE POLICY "Admins and teachers manage task inventory"
  ON public.task_inventory FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));


-- ==========================================
-- COMPONENT 6: Curriculum & Progress (`course_*`, `student_topic_progress`, `levels`)
-- ==========================================

-- 1. course_categories, modules, chapters, lessons
DROP POLICY IF EXISTS "Public read for course_categories" ON public.course_categories;
CREATE POLICY "Public read for course_categories"
  ON public.course_categories FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins and teachers manage course_categories" ON public.course_categories;
CREATE POLICY "Admins and teachers manage course_categories"
  ON public.course_categories FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Public read for course_modules" ON public.course_modules;
CREATE POLICY "Public read for course_modules"
  ON public.course_modules FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins and teachers manage course_modules" ON public.course_modules;
CREATE POLICY "Admins and teachers manage course_modules"
  ON public.course_modules FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Public read for course_chapters" ON public.course_chapters;
CREATE POLICY "Public read for course_chapters"
  ON public.course_chapters FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins and teachers manage course_chapters" ON public.course_chapters;
CREATE POLICY "Admins and teachers manage course_chapters"
  ON public.course_chapters FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Public read for course_lessons" ON public.course_lessons;
CREATE POLICY "Public read for course_lessons"
  ON public.course_lessons FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins and teachers manage course_lessons" ON public.course_lessons;
CREATE POLICY "Admins and teachers manage course_lessons"
  ON public.course_lessons FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- 2. student_topic_progress & levels
DROP POLICY IF EXISTS "Students view/manage own progress; Admins/Teachers view all" ON public.student_topic_progress;
CREATE POLICY "Students view/manage own progress; Admins/Teachers view all"
  ON public.student_topic_progress FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Students insert own topic progress" ON public.student_topic_progress;
CREATE POLICY "Students insert own topic progress"
  ON public.student_topic_progress FOR INSERT TO authenticated
  WITH CHECK (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Students update own topic progress" ON public.student_topic_progress;
CREATE POLICY "Students update own topic progress"
  ON public.student_topic_progress FOR UPDATE TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()))
  WITH CHECK (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Admins and teachers manage student topic progress" ON public.student_topic_progress;
CREATE POLICY "Admins and teachers manage student topic progress"
  ON public.student_topic_progress FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Public read for levels" ON public.levels;
CREATE POLICY "Public read for levels"
  ON public.levels FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins and teachers manage levels" ON public.levels;
CREATE POLICY "Admins and teachers manage levels"
  ON public.levels FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));


-- ==========================================
-- COMPONENT 7: Messaging & Notifications (`classroom_messages`, `messages`, `class_notes`, `notifications`, `broadcasts`, `broadcast_reads`, `push_subscriptions`, `message_templates`, `custom_recipient_groups`)
-- ==========================================

-- 1. classroom_messages
DROP POLICY IF EXISTS "Classroom members & admins/teachers read messages" ON public.classroom_messages;
CREATE POLICY "Classroom members & admins/teachers read messages"
  ON public.classroom_messages FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin_or_teacher()) OR
    classroom_id IN (SELECT classroom_id FROM public.classroom_students WHERE student_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Users insert classroom messages as sender" ON public.classroom_messages;
CREATE POLICY "Users insert classroom messages as sender"
  ON public.classroom_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users delete own messages; Admins/Teachers manage all" ON public.classroom_messages;
CREATE POLICY "Users delete own messages; Admins/Teachers manage all"
  ON public.classroom_messages FOR DELETE TO authenticated
  USING (sender_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

-- 2. direct messages
DROP POLICY IF EXISTS "Users view own direct messages; Admins view all" ON public.messages;
CREATE POLICY "Users view own direct messages; Admins view all"
  ON public.messages FOR SELECT TO authenticated
  USING (sender_id = (SELECT auth.uid()) OR receiver_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Users send direct messages" ON public.messages;
CREATE POLICY "Users send direct messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users update own direct messages" ON public.messages;
CREATE POLICY "Users update own direct messages"
  ON public.messages FOR UPDATE TO authenticated
  USING (sender_id = (SELECT auth.uid()) OR receiver_id = (SELECT auth.uid()))
  WITH CHECK (sender_id = (SELECT auth.uid()) OR receiver_id = (SELECT auth.uid()));

-- 3. class_notes
DROP POLICY IF EXISTS "Students view classroom notes; Admins/Teachers view all" ON public.class_notes;
CREATE POLICY "Students view classroom notes; Admins/Teachers view all"
  ON public.class_notes FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin_or_teacher()) OR
    classroom_id IN (SELECT classroom_id FROM public.classroom_students WHERE student_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Admins and teachers manage class notes" ON public.class_notes;
CREATE POLICY "Admins and teachers manage class notes"
  ON public.class_notes FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- 4. notifications & broadcasts & broadcast_reads
DROP POLICY IF EXISTS "Users manage own notifications; Admins/Teachers insert" ON public.notifications;
CREATE POLICY "Users manage own notifications; Admins/Teachers insert"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Authenticated users insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users read broadcasts" ON public.broadcasts;
CREATE POLICY "Authenticated users read broadcasts"
  ON public.broadcasts FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins and teachers manage broadcasts" ON public.broadcasts;
CREATE POLICY "Admins and teachers manage broadcasts"
  ON public.broadcasts FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Users view/insert own broadcast reads" ON public.broadcast_reads;
CREATE POLICY "Users view/insert own broadcast reads"
  ON public.broadcast_reads FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Users insert own broadcast reads" ON public.broadcast_reads;
CREATE POLICY "Users insert own broadcast reads"
  ON public.broadcast_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- 5. push_subscriptions & message_templates & custom_recipient_groups
DROP POLICY IF EXISTS "Users manage own push subscriptions; Admins/Teachers view all" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subscriptions; Admins/Teachers view all"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()))
  WITH CHECK (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Admins and teachers manage message_templates" ON public.message_templates;
CREATE POLICY "Admins and teachers manage message_templates"
  ON public.message_templates FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Admins and teachers manage custom_recipient_groups" ON public.custom_recipient_groups;
CREATE POLICY "Admins and teachers manage custom_recipient_groups"
  ON public.custom_recipient_groups FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));


-- ==========================================
-- COMPONENT 8: Operations & Public Site (`inventory`, `inventory_categories`, `classroom_inventory_allocation`, `student_mentors`, `blog_posts`, `events`, `gallery_items`, `testimonials`, `inquiries`, `user_sessions`, `session_student_overrides`)
-- ==========================================

-- 1. inventory & inventory_categories & classroom_inventory_allocation
DROP POLICY IF EXISTS "Authenticated users view inventory" ON public.inventory;
CREATE POLICY "Authenticated users view inventory"
  ON public.inventory FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins and teachers manage inventory" ON public.inventory;
CREATE POLICY "Admins and teachers manage inventory"
  ON public.inventory FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Authenticated users view inventory categories" ON public.inventory_categories;
CREATE POLICY "Authenticated users view inventory categories"
  ON public.inventory_categories FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins and teachers manage inventory categories" ON public.inventory_categories;
CREATE POLICY "Admins and teachers manage inventory categories"
  ON public.inventory_categories FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Students view allocated inventory; Admins/Teachers view all" ON public.classroom_inventory_allocation;
CREATE POLICY "Students view allocated inventory; Admins/Teachers view all"
  ON public.classroom_inventory_allocation FOR SELECT TO authenticated
  USING (allocated_to_student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Admins and teachers manage classroom inventory allocation" ON public.classroom_inventory_allocation;
CREATE POLICY "Admins and teachers manage classroom inventory allocation"
  ON public.classroom_inventory_allocation FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- 2. student_mentors
DROP POLICY IF EXISTS "Students, mentors, admins, teachers read mentorships" ON public.student_mentors;
CREATE POLICY "Students, mentors, admins, teachers read mentorships"
  ON public.student_mentors FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR mentor_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Admins and teachers manage student mentors" ON public.student_mentors;
CREATE POLICY "Admins and teachers manage student mentors"
  ON public.student_mentors FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- 3. Public site content (blog_posts, events, gallery_items, testimonials, inquiries)
DROP POLICY IF EXISTS "Public read for blog_posts" ON public.blog_posts;
CREATE POLICY "Public read for blog_posts"
  ON public.blog_posts FOR SELECT TO anon, authenticated
  USING (published = true OR (SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Admins and teachers manage blog_posts" ON public.blog_posts;
CREATE POLICY "Admins and teachers manage blog_posts"
  ON public.blog_posts FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Public read for events" ON public.events;
CREATE POLICY "Public read for events"
  ON public.events FOR SELECT TO anon, authenticated
  USING (is_active = true OR (SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Admins and teachers manage events" ON public.events;
CREATE POLICY "Admins and teachers manage events"
  ON public.events FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Public read for gallery_items" ON public.gallery_items;
CREATE POLICY "Public read for gallery_items"
  ON public.gallery_items FOR SELECT TO anon, authenticated
  USING (is_active = true OR (SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Admins and teachers manage gallery_items" ON public.gallery_items;
CREATE POLICY "Admins and teachers manage gallery_items"
  ON public.gallery_items FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Public read for testimonials" ON public.testimonials;
CREATE POLICY "Public read for testimonials"
  ON public.testimonials FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins and teachers manage testimonials" ON public.testimonials;
CREATE POLICY "Admins and teachers manage testimonials"
  ON public.testimonials FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Public insert for inquiries" ON public.inquiries;
CREATE POLICY "Public insert for inquiries"
  ON public.inquiries FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins and teachers manage inquiries" ON public.inquiries;
CREATE POLICY "Admins and teachers manage inquiries"
  ON public.inquiries FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- 4. user_sessions & session_student_overrides & classroom_session_logs
DROP POLICY IF EXISTS "Users view own sessions; Admins/Teachers view all" ON public.user_sessions;
CREATE POLICY "Users view own sessions; Admins/Teachers view all"
  ON public.user_sessions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Users manage own sessions" ON public.user_sessions;
CREATE POLICY "Users manage own sessions"
  ON public.user_sessions FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Students view own session overrides; Admins/Teachers view all" ON public.session_student_overrides;
CREATE POLICY "Students view own session overrides; Admins/Teachers view all"
  ON public.session_student_overrides FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Admins and teachers manage session student overrides" ON public.session_student_overrides;
CREATE POLICY "Admins and teachers manage session student overrides"
  ON public.session_student_overrides FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Students view classroom session logs; Admins/Teachers view all" ON public.classroom_session_logs;
CREATE POLICY "Students view classroom session logs; Admins/Teachers view all"
  ON public.classroom_session_logs FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin_or_teacher()) OR
    classroom_id IN (SELECT classroom_id FROM public.classroom_students WHERE student_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Admins and teachers manage classroom session logs" ON public.classroom_session_logs;
CREATE POLICY "Admins and teachers manage classroom session logs"
  ON public.classroom_session_logs FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));
