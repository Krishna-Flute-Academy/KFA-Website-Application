-- Part 2: Core Table RLS Policies Optimization
-- Run this block second in Supabase SQL Editor

-- 1. public.users
DROP POLICY IF EXISTS "Users can update own profile details" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Admins and teachers can insert users" ON public.users;
DROP POLICY IF EXISTS "Admins and teachers can update users" ON public.users;
DROP POLICY IF EXISTS "Admins and teachers can delete users" ON public.users;

CREATE POLICY "Users can update own profile details"
  ON public.users FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK (
    (SELECT auth.uid()) = id AND (
      (SELECT public.is_admin_or_teacher()) OR 
      public.check_user_self_update(id, role, status)
    )
  );

CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id AND role = 'student');

CREATE POLICY "Admins and teachers can insert users"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

CREATE POLICY "Admins and teachers can update users"
  ON public.users FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

CREATE POLICY "Admins and teachers can delete users"
  ON public.users FOR DELETE TO authenticated
  USING ((SELECT public.is_admin_or_teacher()));

-- 2. public.attendance
DROP POLICY IF EXISTS "Students view own attendance; Admins/Teachers view all" ON public.attendance;
DROP POLICY IF EXISTS "Admins and teachers manage attendance records" ON public.attendance;

CREATE POLICY "Students view own attendance; Admins/Teachers view all"
  ON public.attendance FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

CREATE POLICY "Admins and teachers manage attendance records"
  ON public.attendance FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- 3. public.leave_requests
DROP POLICY IF EXISTS "Users can view own leave; Admins/Teachers view all" ON public.leave_requests;
DROP POLICY IF EXISTS "Students can request leave; Admins/Teachers can submit on behalf" ON public.leave_requests;
DROP POLICY IF EXISTS "Students can update own request; Admins/Teachers manage all" ON public.leave_requests;
DROP POLICY IF EXISTS "Students can cancel own request; Admins/Teachers manage all" ON public.leave_requests;

CREATE POLICY "Users can view own leave; Admins/Teachers view all"
  ON public.leave_requests FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

CREATE POLICY "Students can request leave; Admins/Teachers can submit on behalf"
  ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

CREATE POLICY "Students can update own request; Admins/Teachers manage all"
  ON public.leave_requests FOR UPDATE TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()))
  WITH CHECK (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

CREATE POLICY "Students can cancel own request; Admins/Teachers manage all"
  ON public.leave_requests FOR DELETE TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

-- 4. public.classrooms & classroom_students
DROP POLICY IF EXISTS "Teachers and admins can update classrooms" ON public.classrooms;
CREATE POLICY "Teachers and admins can update classrooms"
  ON public.classrooms FOR UPDATE TO authenticated
  USING (teacher_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  WITH CHECK (teacher_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Students view own enrollments; Admins/Teachers view all" ON public.classroom_students;
DROP POLICY IF EXISTS "Admins and teachers manage classroom students" ON public.classroom_students;

CREATE POLICY "Students view own enrollments; Admins/Teachers view all"
  ON public.classroom_students FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

CREATE POLICY "Admins and teachers manage classroom students"
  ON public.classroom_students FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- 5. public.classroom_messages
DROP POLICY IF EXISTS "Members of classroom and admins/teachers read messages" ON public.classroom_messages;
DROP POLICY IF EXISTS "Users can insert messages as themselves" ON public.classroom_messages;
DROP POLICY IF EXISTS "Users can delete own messages; Admins/Teachers delete any" ON public.classroom_messages;

CREATE POLICY "Members of classroom and admins/teachers read messages"
  ON public.classroom_messages FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin_or_teacher()) OR 
    EXISTS (
      SELECT 1 FROM public.classroom_students cs 
      WHERE cs.classroom_id = classroom_messages.classroom_id 
        AND cs.student_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert messages as themselves"
  ON public.classroom_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own messages; Admins/Teachers delete any"
  ON public.classroom_messages FOR DELETE TO authenticated
  USING (sender_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));

-- 6. public.user_sessions
DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can view own sessions, admins can view all" ON public.user_sessions;

CREATE POLICY "Users can insert their own sessions"
  ON public.user_sessions FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own sessions"
  ON public.user_sessions FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can view own sessions, admins can view all"
  ON public.user_sessions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));
