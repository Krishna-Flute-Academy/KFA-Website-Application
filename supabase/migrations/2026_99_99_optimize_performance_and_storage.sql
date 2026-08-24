-- ============================================================================
-- Migration: Complete Performance & Storage Security Remediation Patch (Idempotent)
-- Description: Adds missing B-Tree FK indexes, marks RLS helper functions STABLE,
--              sets search_path on SECURITY DEFINER RPCs, and locks down Storage.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: Add Missing B-Tree Indexes for Foreign Keys & High-Frequency Queries
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_classroom_students_classroom_id ON public.classroom_students(classroom_id);
CREATE INDEX IF NOT EXISTS idx_assignments_classroom_id ON public.assignments(classroom_id);
CREATE INDEX IF NOT EXISTS idx_users_teacher_id ON public.users(teacher_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_course_lessons_chapter_id ON public.course_lessons(chapter_id);
CREATE INDEX IF NOT EXISTS idx_course_chapters_module_id ON public.course_chapters(module_id);
CREATE INDEX IF NOT EXISTS idx_fees_student_id ON public.fees(student_id);
CREATE INDEX IF NOT EXISTS idx_batch_schedules_classroom_id ON public.batch_schedules(classroom_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_classroom_id ON public.class_sessions(classroom_id);
CREATE INDEX IF NOT EXISTS idx_temporary_classes_classroom_id ON public.temporary_classes(classroom_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_reads_broadcast_id ON public.broadcast_reads(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_task_inventory_task_id ON public.task_inventory(task_id);

-- Composite Indexes for Filter + Sort Performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_classroom_messages_classroom_date ON public.classroom_messages(classroom_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON public.attendance(student_id, date DESC);


-- ----------------------------------------------------------------------------
-- STEP 2: Mark RLS Helper Functions STABLE & Set Hardened Search Path
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
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
STABLE
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
STABLE
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
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = s_id AND teacher_id = t_id
  );
$$;

-- ----------------------------------------------------------------------------
-- STEP 3: Lock Down Storage Bucket RLS Policies (`storage.objects`)
-- ----------------------------------------------------------------------------

-- 1. class_notes bucket
DROP POLICY IF EXISTS "Allow all inserts on class_notes bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow all deletes on class_notes bucket" ON storage.objects;
DROP POLICY IF EXISTS "Admins and teachers insert class_notes files" ON storage.objects;
DROP POLICY IF EXISTS "Admins and teachers delete class_notes files" ON storage.objects;

CREATE POLICY "Admins and teachers insert class_notes files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'class_notes' AND (SELECT public.is_admin_or_teacher()));

CREATE POLICY "Admins and teachers delete class_notes files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'class_notes' AND (SELECT public.is_admin_or_teacher()));

-- 2. inventory_materials bucket
DROP POLICY IF EXISTS "Allow all inserts on inventory_materials bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow all deletes on inventory_materials bucket" ON storage.objects;
DROP POLICY IF EXISTS "Admins and teachers insert inventory_materials files" ON storage.objects;
DROP POLICY IF EXISTS "Admins and teachers delete inventory_materials files" ON storage.objects;

CREATE POLICY "Admins and teachers insert inventory_materials files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'inventory_materials' AND (SELECT public.is_admin_or_teacher()));

CREATE POLICY "Admins and teachers delete inventory_materials files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'inventory_materials' AND (SELECT public.is_admin_or_teacher()));

-- 3. gallery & blog_images bucket
DROP POLICY IF EXISTS "Anon users can upload to gallery" ON storage.objects;
DROP POLICY IF EXISTS "Anon users can upload to blog_images" ON storage.objects;
DROP POLICY IF EXISTS "Admins and teachers insert gallery files" ON storage.objects;
DROP POLICY IF EXISTS "Admins and teachers insert blog_images files" ON storage.objects;

CREATE POLICY "Admins and teachers insert gallery files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gallery' AND (SELECT public.is_admin_or_teacher()));

CREATE POLICY "Admins and teachers insert blog_images files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'blog_images' AND (SELECT public.is_admin_or_teacher()));
