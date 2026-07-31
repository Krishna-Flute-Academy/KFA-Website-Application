-- Migration: Secure Row Level Security (RLS) Policies
-- Prevents privilege escalation on users, restricts transactional tables, and removes development-grade 'Allow all' policies.

-- 1. Create secure helper functions to check roles (using SECURITY DEFINER to bypass RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
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
    WHERE id = auth.uid() AND role IN ('admin', 'teacher')
  );
$$;

CREATE OR REPLACE FUNCTION public.check_user_self_update(user_id uuid, new_role text, new_status text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_role text;
  old_status text;
BEGIN
  SELECT role, status INTO old_role, old_status FROM public.users WHERE id = user_id;
  RETURN (new_role IS NOT DISTINCT FROM old_role) AND (new_status IS NOT DISTINCT FROM old_status);
END;
$$;


-- 2. Secure public.users table RLS policies
DROP POLICY IF EXISTS "Authenticated users can update any user row" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can insert any user row" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can delete any user row" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile details" ON public.users;
DROP POLICY IF EXISTS "Admins and teachers can insert users" ON public.users;
DROP POLICY IF EXISTS "Admins and teachers can update users" ON public.users;
DROP POLICY IF EXISTS "Admins and teachers can delete users" ON public.users;

-- A. Allow users to read all profiles (required for teacher/student interactions)
-- Policy already exists as "Authenticated users can read users" TO authenticated USING (true), keeping it.

-- B. Users can update only their own profile details, but CANNOT change their role or status
CREATE POLICY "Users can update own profile details"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND (
      public.is_admin_or_teacher() OR 
      public.check_user_self_update(id, role, status)
    )
  );

-- C. Users can insert their own profile on signup (role must be student)
CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id AND role = 'student');

-- D. Admins and teachers can insert any user (e.g. manual enrollment)
CREATE POLICY "Admins and teachers can insert users"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_teacher());

-- E. Admins and teachers can update any user (e.g. status changes, role assignments)
CREATE POLICY "Admins and teachers can update users"
  ON public.users FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_teacher())
  WITH CHECK (public.is_admin_or_teacher());

-- F. Admins and teachers can delete user profiles
CREATE POLICY "Admins and teachers can delete users"
  ON public.users FOR DELETE
  TO authenticated
  USING (public.is_admin_or_teacher());


-- 3. Secure sensitive financial and attendance tables
-- A. fees_payments
DROP POLICY IF EXISTS "Allow all fees_payments" ON public.fees_payments;
DROP POLICY IF EXISTS "Students can view own payments; Admins/Teachers view all" ON public.fees_payments;
DROP POLICY IF EXISTS "Admins and teachers manage fee payments" ON public.fees_payments;

CREATE POLICY "Students can view own payments; Admins/Teachers view all"
  ON public.fees_payments FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() OR public.is_admin_or_teacher());

CREATE POLICY "Admins and teachers manage fee payments"
  ON public.fees_payments FOR ALL
  TO authenticated
  USING (public.is_admin_or_teacher())
  WITH CHECK (public.is_admin_or_teacher());

-- B. fees_notifications
DROP POLICY IF EXISTS "Allow all fees_notifications" ON public.fees_notifications;
DROP POLICY IF EXISTS "Students can view own notifications; Admins/Teachers view all" ON public.fees_notifications;
DROP POLICY IF EXISTS "Admins and teachers manage fee notifications" ON public.fees_notifications;

CREATE POLICY "Students can view own notifications; Admins/Teachers view all"
  ON public.fees_notifications FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() OR public.is_admin_or_teacher());

CREATE POLICY "Admins and teachers manage fee notifications"
  ON public.fees_notifications FOR ALL
  TO authenticated
  USING (public.is_admin_or_teacher())
  WITH CHECK (public.is_admin_or_teacher());

-- C. attendance
DROP POLICY IF EXISTS "Allow all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Students view own attendance; Admins/Teachers view all" ON public.attendance;
DROP POLICY IF EXISTS "Admins and teachers manage attendance records" ON public.attendance;

CREATE POLICY "Students view own attendance; Admins/Teachers view all"
  ON public.attendance FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() OR public.is_admin_or_teacher());

CREATE POLICY "Admins and teachers manage attendance records"
  ON public.attendance FOR ALL
  TO authenticated
  USING (public.is_admin_or_teacher())
  WITH CHECK (public.is_admin_or_teacher());

-- E. leave_requests
DROP POLICY IF EXISTS "Allow all leave_requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can view own leave; Admins/Teachers view all" ON public.leave_requests;
DROP POLICY IF EXISTS "Students can request leave; Admins/Teachers can submit on behalf" ON public.leave_requests;
DROP POLICY IF EXISTS "Students can update own request; Admins/Teachers manage all" ON public.leave_requests;
DROP POLICY IF EXISTS "Students can cancel own request; Admins/Teachers manage all" ON public.leave_requests;

CREATE POLICY "Users can view own leave; Admins/Teachers view all"
  ON public.leave_requests FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() OR public.is_admin_or_teacher());

CREATE POLICY "Students can request leave; Admins/Teachers can submit on behalf"
  ON public.leave_requests FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid() OR public.is_admin_or_teacher());

CREATE POLICY "Students can update own request; Admins/Teachers manage all"
  ON public.leave_requests FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid() OR public.is_admin_or_teacher())
  WITH CHECK (student_id = auth.uid() OR public.is_admin_or_teacher());

CREATE POLICY "Students can cancel own request; Admins/Teachers manage all"
  ON public.leave_requests FOR DELETE
  TO authenticated
  USING (student_id = auth.uid() OR public.is_admin_or_teacher());


-- 4. Secure class management tables
-- A. classrooms (restrict over-permissive update policy)
DROP POLICY IF EXISTS "Allow all authenticated updates on classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Teachers and admins can update classrooms" ON public.classrooms;

CREATE POLICY "Teachers and admins can update classrooms"
  ON public.classrooms FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid() OR public.is_admin())
  WITH CHECK (teacher_id = auth.uid() OR public.is_admin());

-- B. classroom_students
DROP POLICY IF EXISTS "Allow all classroom_students" ON public.classroom_students;
DROP POLICY IF EXISTS "Students view own enrollments; Admins/Teachers view all" ON public.classroom_students;
DROP POLICY IF EXISTS "Admins and teachers manage classroom students" ON public.classroom_students;

CREATE POLICY "Students view own enrollments; Admins/Teachers view all"
  ON public.classroom_students FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() OR public.is_admin_or_teacher());

CREATE POLICY "Admins and teachers manage classroom students"
  ON public.classroom_students FOR ALL
  TO authenticated
  USING (public.is_admin_or_teacher())
  WITH CHECK (public.is_admin_or_teacher());

-- C. classroom_session_logs
DROP POLICY IF EXISTS "Allow all classroom_session_logs" ON public.classroom_session_logs;
DROP POLICY IF EXISTS "Students read classroom logs; Admins/Teachers manage all" ON public.classroom_session_logs;
DROP POLICY IF EXISTS "Admins and teachers manage classroom session logs" ON public.classroom_session_logs;

CREATE POLICY "Students read classroom logs; Admins/Teachers manage all"
  ON public.classroom_session_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and teachers manage classroom session logs"
  ON public.classroom_session_logs FOR ALL
  TO authenticated
  USING (public.is_admin_or_teacher())
  WITH CHECK (public.is_admin_or_teacher());

-- D. classroom_messages
DROP POLICY IF EXISTS "Allow all classroom_messages" ON public.classroom_messages;
DROP POLICY IF EXISTS "Members of classroom and admins/teachers read messages" ON public.classroom_messages;
DROP POLICY IF EXISTS "Users can insert messages as themselves" ON public.classroom_messages;
DROP POLICY IF EXISTS "Users can delete own messages; Admins/Teachers delete any" ON public.classroom_messages;

CREATE POLICY "Members of classroom and admins/teachers read messages"
  ON public.classroom_messages FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_teacher() OR 
    EXISTS (
      SELECT 1 FROM public.classroom_students cs 
      WHERE cs.classroom_id = classroom_messages.classroom_id 
        AND cs.student_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages as themselves"
  ON public.classroom_messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can delete own messages; Admins/Teachers delete any"
  ON public.classroom_messages FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid() OR public.is_admin_or_teacher());

-- E. batch_schedules
DROP POLICY IF EXISTS "Allow all batch_schedules" ON public.batch_schedules;
DROP POLICY IF EXISTS "Authenticated users can read schedules" ON public.batch_schedules;
DROP POLICY IF EXISTS "Admins and teachers manage batch schedules" ON public.batch_schedules;

CREATE POLICY "Authenticated users can read schedules"
  ON public.batch_schedules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and teachers manage batch schedules"
  ON public.batch_schedules FOR ALL
  TO authenticated
  USING (public.is_admin_or_teacher())
  WITH CHECK (public.is_admin_or_teacher());

-- F. temporary_classes
DROP POLICY IF EXISTS "Allow all temporary_classes" ON public.temporary_classes;
DROP POLICY IF EXISTS "Authenticated users can read temporary classes" ON public.temporary_classes;
DROP POLICY IF EXISTS "Admins and teachers manage temporary classes" ON public.temporary_classes;

CREATE POLICY "Authenticated users can read temporary classes"
  ON public.temporary_classes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and teachers manage temporary classes"
  ON public.temporary_classes FOR ALL
  TO authenticated
  USING (public.is_admin_or_teacher())
  WITH CHECK (public.is_admin_or_teacher());

-- G. session_student_overrides
DROP POLICY IF EXISTS "Allow all session_student_overrides" ON public.session_student_overrides;
DROP POLICY IF EXISTS "Students read own session overrides; Admins/Teachers view all" ON public.session_student_overrides;
DROP POLICY IF EXISTS "Admins and teachers manage session overrides" ON public.session_student_overrides;

CREATE POLICY "Students read own session overrides; Admins/Teachers view all"
  ON public.session_student_overrides FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() OR public.is_admin_or_teacher());

CREATE POLICY "Admins and teachers manage session overrides"
  ON public.session_student_overrides FOR ALL
  TO authenticated
  USING (public.is_admin_or_teacher())
  WITH CHECK (public.is_admin_or_teacher());


-- 5. Secure assignments and learning content
-- A. class_notes
DROP POLICY IF EXISTS "Allow all class_notes" ON public.class_notes;
DROP POLICY IF EXISTS "Authenticated users can read class notes" ON public.class_notes;
DROP POLICY IF EXISTS "Admins and teachers manage class notes" ON public.class_notes;

CREATE POLICY "Authenticated users can read class notes"
  ON public.class_notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and teachers manage class notes"
  ON public.class_notes FOR ALL
  TO authenticated
  USING (public.is_admin_or_teacher())
  WITH CHECK (public.is_admin_or_teacher());

-- B. assignments
DROP POLICY IF EXISTS "Allow all assignments" ON public.assignments;
DROP POLICY IF EXISTS "Authenticated users can read assignments" ON public.assignments;
DROP POLICY IF EXISTS "Admins and teachers manage assignments" ON public.assignments;

CREATE POLICY "Authenticated users can read assignments"
  ON public.assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and teachers manage assignments"
  ON public.assignments FOR ALL
  TO authenticated
  USING (public.is_admin_or_teacher())
  WITH CHECK (public.is_admin_or_teacher());

-- C. assignment_students
DROP POLICY IF EXISTS "Allow all assignment_students" ON public.assignment_students;
DROP POLICY IF EXISTS "Students read own assignments; Admins/Teachers view all" ON public.assignment_students;
DROP POLICY IF EXISTS "Students update own submission details" ON public.assignment_students;
DROP POLICY IF EXISTS "Admins and teachers manage assignment students" ON public.assignment_students;

CREATE POLICY "Students read own assignments; Admins/Teachers view all"
  ON public.assignment_students FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() OR public.is_admin_or_teacher());

CREATE POLICY "Students update own submission details"
  ON public.assignment_students FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid() OR public.is_admin_or_teacher())
  WITH CHECK (student_id = auth.uid() OR public.is_admin_or_teacher());

CREATE POLICY "Admins and teachers manage assignment students"
  ON public.assignment_students FOR ALL
  TO authenticated
  USING (public.is_admin_or_teacher())
  WITH CHECK (public.is_admin_or_teacher());

-- D. classroom_inventory_allocation
DROP POLICY IF EXISTS "Allow all classroom_inventory_allocation" ON public.classroom_inventory_allocation;
DROP POLICY IF EXISTS "Students read own inventory allocations; Admins/Teachers view all" ON public.classroom_inventory_allocation;
DROP POLICY IF EXISTS "Admins and teachers manage classroom inventory allocation" ON public.classroom_inventory_allocation;

CREATE POLICY "Students read own inventory allocations; Admins/Teachers view all"
  ON public.classroom_inventory_allocation FOR SELECT
  TO authenticated
  USING (allocated_to_student_id = auth.uid() OR public.is_admin_or_teacher());

CREATE POLICY "Admins and teachers manage classroom inventory allocation"
  ON public.classroom_inventory_allocation FOR ALL
  TO authenticated
  USING (public.is_admin_or_teacher())
  WITH CHECK (public.is_admin_or_teacher());

-- E. course_modules, course_chapters, course_lessons, course_categories
DROP POLICY IF EXISTS "Allow all course_modules" ON public.course_modules;
DROP POLICY IF EXISTS "Allow all course_chapters" ON public.course_chapters;
DROP POLICY IF EXISTS "Allow all course_lessons" ON public.course_lessons;
DROP POLICY IF EXISTS "Allow all course_categories" ON public.course_categories;
DROP POLICY IF EXISTS "Authenticated users can read modules" ON public.course_modules;
DROP POLICY IF EXISTS "Authenticated users can read chapters" ON public.course_chapters;
DROP POLICY IF EXISTS "Authenticated users can read lessons" ON public.course_lessons;
DROP POLICY IF EXISTS "Authenticated users can read categories" ON public.course_categories;
DROP POLICY IF EXISTS "Admins and teachers manage course modules" ON public.course_modules;
DROP POLICY IF EXISTS "Admins and teachers manage course chapters" ON public.course_chapters;
DROP POLICY IF EXISTS "Admins and teachers manage course lessons" ON public.course_lessons;
DROP POLICY IF EXISTS "Admins and teachers manage course categories" ON public.course_categories;

CREATE POLICY "Authenticated users can read modules" ON public.course_modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read chapters" ON public.course_chapters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read lessons" ON public.course_lessons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read categories" ON public.course_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and teachers manage course modules" ON public.course_modules FOR ALL TO authenticated USING (public.is_admin_or_teacher()) WITH CHECK (public.is_admin_or_teacher());
CREATE POLICY "Admins and teachers manage course chapters" ON public.course_chapters FOR ALL TO authenticated USING (public.is_admin_or_teacher()) WITH CHECK (public.is_admin_or_teacher());
CREATE POLICY "Admins and teachers manage course lessons" ON public.course_lessons FOR ALL TO authenticated USING (public.is_admin_or_teacher()) WITH CHECK (public.is_admin_or_teacher());
CREATE POLICY "Admins and teachers manage course categories" ON public.course_categories FOR ALL TO authenticated USING (public.is_admin_or_teacher()) WITH CHECK (public.is_admin_or_teacher());

-- F. student_topic_progress
DROP POLICY IF EXISTS "Allow all student_topic_progress" ON public.student_topic_progress;
DROP POLICY IF EXISTS "Students read/manage own progress; Admins/Teachers view all" ON public.student_topic_progress;
DROP POLICY IF EXISTS "Students can update own progress details" ON public.student_topic_progress;
DROP POLICY IF EXISTS "Students can insert own progress details" ON public.student_topic_progress;
DROP POLICY IF EXISTS "Admins and teachers manage student topic progress" ON public.student_topic_progress;

CREATE POLICY "Students read/manage own progress; Admins/Teachers view all"
  ON public.student_topic_progress FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() OR public.is_admin_or_teacher());

CREATE POLICY "Students can update own progress details"
  ON public.student_topic_progress FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid() OR public.is_admin_or_teacher())
  WITH CHECK (student_id = auth.uid() OR public.is_admin_or_teacher());

CREATE POLICY "Students can insert own progress details"
  ON public.student_topic_progress FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid() OR public.is_admin_or_teacher());

CREATE POLICY "Admins and teachers manage student topic progress"
  ON public.student_topic_progress FOR ALL
  TO authenticated
  USING (public.is_admin_or_teacher())
  WITH CHECK (public.is_admin_or_teacher());


-- 6. Secure public-facing content write permissions (remove FOR ALL TO anon)
DROP POLICY IF EXISTS "Allow all for anon on blog_posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Allow all for anon on testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "Allow all for anon on gallery_items" ON public.gallery_items;
DROP POLICY IF EXISTS "Allow all for anon on events" ON public.events;
DROP POLICY IF EXISTS "Admins and teachers can manage blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins and teachers can manage testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "Admins and teachers can manage gallery items" ON public.gallery_items;
DROP POLICY IF EXISTS "Admins and teachers can manage events" ON public.events;

-- Allow insert/update/delete only to authenticated admins/teachers
CREATE POLICY "Admins and teachers can manage blog posts"
  ON public.blog_posts FOR ALL TO authenticated
  USING (public.is_admin_or_teacher())
  WITH CHECK (public.is_admin_or_teacher());

CREATE POLICY "Admins and teachers can manage testimonials"
  ON public.testimonials FOR ALL TO authenticated
  USING (public.is_admin_or_teacher())
  WITH CHECK (public.is_admin_or_teacher());

CREATE POLICY "Admins and teachers can manage gallery items"
  ON public.gallery_items FOR ALL TO authenticated
  USING (public.is_admin_or_teacher())
  WITH CHECK (public.is_admin_or_teacher());

CREATE POLICY "Admins and teachers can manage events"
  ON public.events FOR ALL TO authenticated
  USING (public.is_admin_or_teacher())
  WITH CHECK (public.is_admin_or_teacher());


-- 7. Update push_subscriptions policy to use recursion-free role check helper
DROP POLICY IF EXISTS "Teachers and admins can read push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Teachers and admins can read push subscriptions"
  ON public.push_subscriptions FOR SELECT
  TO authenticated
  USING (public.is_admin_or_teacher());
