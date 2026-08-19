-- Part 3: Secondary Tables RLS Policies Optimization
-- Run this block third in Supabase SQL Editor

-- 1. fees_payments & fees_notifications
DROP POLICY IF EXISTS "Students can view own payments; Admins/Teachers view all" ON public.fees_payments;
DROP POLICY IF EXISTS "Admins and teachers manage fee payments" ON public.fees_payments;
CREATE POLICY "Students can view own payments; Admins/Teachers view all"
  ON public.fees_payments FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));
CREATE POLICY "Admins and teachers manage fee payments"
  ON public.fees_payments FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Students can view own notifications; Admins/Teachers view all" ON public.fees_notifications;
DROP POLICY IF EXISTS "Admins and teachers manage fee notifications" ON public.fees_notifications;
CREATE POLICY "Students can view own notifications; Admins/Teachers view all"
  ON public.fees_notifications FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));
CREATE POLICY "Admins and teachers manage fee notifications"
  ON public.fees_notifications FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- 2. session_student_overrides
DROP POLICY IF EXISTS "Students read own session overrides; Admins/Teachers view all" ON public.session_student_overrides;
DROP POLICY IF EXISTS "Admins and teachers manage session overrides" ON public.session_student_overrides;
CREATE POLICY "Students read own session overrides; Admins/Teachers view all"
  ON public.session_student_overrides FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));
CREATE POLICY "Admins and teachers manage session overrides"
  ON public.session_student_overrides FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- 3. assignment_students
DROP POLICY IF EXISTS "Students read own assignments; Admins/Teachers view all" ON public.assignment_students;
DROP POLICY IF EXISTS "Students update own submission details" ON public.assignment_students;
DROP POLICY IF EXISTS "Admins and teachers manage assignment students" ON public.assignment_students;
CREATE POLICY "Students read own assignments; Admins/Teachers view all"
  ON public.assignment_students FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));
CREATE POLICY "Students update own submission details"
  ON public.assignment_students FOR UPDATE TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()))
  WITH CHECK (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));
CREATE POLICY "Admins and teachers manage assignment students"
  ON public.assignment_students FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- 4. classroom_inventory_allocation
DROP POLICY IF EXISTS "Students read own inventory allocations; Admins/Teachers view all" ON public.classroom_inventory_allocation;
DROP POLICY IF EXISTS "Admins and teachers manage classroom inventory allocation" ON public.classroom_inventory_allocation;
CREATE POLICY "Students read own inventory allocations; Admins/Teachers view all"
  ON public.classroom_inventory_allocation FOR SELECT TO authenticated
  USING (allocated_to_student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));
CREATE POLICY "Admins and teachers manage classroom inventory allocation"
  ON public.classroom_inventory_allocation FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- 5. student_topic_progress
DROP POLICY IF EXISTS "Students read/manage own progress; Admins/Teachers view all" ON public.student_topic_progress;
DROP POLICY IF EXISTS "Students can update own progress details" ON public.student_topic_progress;
DROP POLICY IF EXISTS "Students can insert own progress details" ON public.student_topic_progress;
DROP POLICY IF EXISTS "Admins and teachers manage student topic progress" ON public.student_topic_progress;
CREATE POLICY "Students read/manage own progress; Admins/Teachers view all"
  ON public.student_topic_progress FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));
CREATE POLICY "Students can update own progress details"
  ON public.student_topic_progress FOR UPDATE TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()))
  WITH CHECK (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));
CREATE POLICY "Students can insert own progress details"
  ON public.student_topic_progress FOR INSERT TO authenticated
  WITH CHECK (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));
CREATE POLICY "Admins and teachers manage student topic progress"
  ON public.student_topic_progress FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_teacher()))
  WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- 6. push_subscriptions, broadcast_reads, student_mentors
DROP POLICY IF EXISTS "Teachers and admins can read push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Teachers and admins can read push subscriptions"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING ((SELECT public.is_admin_or_teacher()));

DROP POLICY IF EXISTS "Allow users to read own broadcast reads" ON public.broadcast_reads;
DROP POLICY IF EXISTS "Allow users to insert own broadcast reads" ON public.broadcast_reads;
CREATE POLICY "Allow users to read own broadcast reads"
  ON public.broadcast_reads FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_teacher()));
CREATE POLICY "Allow users to insert own broadcast reads"
  ON public.broadcast_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Students, mentors, admins, teachers can read mentorships" ON public.student_mentors;
CREATE POLICY "Students, mentors, admins, teachers can read mentorships"
  ON public.student_mentors FOR SELECT TO authenticated
  USING (
    student_id = (SELECT auth.uid()) OR 
    mentor_id = (SELECT auth.uid()) OR 
    (SELECT public.is_admin_or_teacher())
  );
