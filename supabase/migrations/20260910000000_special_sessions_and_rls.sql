-- ============================================================================
-- Migration: Special Sessions Architecture, Lifecycle & Hardened RLS
-- ============================================================================

-- 1. Add Special Session Lifecycle & Metadata Columns to temporary_classes
ALTER TABLE public.temporary_classes
  ADD COLUMN IF NOT EXISTS purpose TEXT DEFAULT 'makeup',
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS credit_treatment TEXT DEFAULT 'makeup';

-- 2. Add Credit Treatment & Missed Session Date to session_student_overrides
ALTER TABLE public.session_student_overrides
  ADD COLUMN IF NOT EXISTS credit_treatment TEXT DEFAULT 'makeup',
  ADD COLUMN IF NOT EXISTS missed_session_date DATE;

-- 3. Backfill historical temporary_classes lifecycle status
UPDATE public.temporary_classes
SET lifecycle_status = 'completed'
WHERE class_date < CURRENT_DATE
  AND (lifecycle_status IS NULL OR lifecycle_status = 'scheduled');

UPDATE public.temporary_classes
SET lifecycle_status = 'scheduled'
WHERE class_date >= CURRENT_DATE
  AND lifecycle_status IS NULL;

-- 4. High-Performance Indexes for Participant Resolution
CREATE INDEX IF NOT EXISTS idx_temporary_classes_classroom_id 
  ON public.temporary_classes(classroom_id);

CREATE INDEX IF NOT EXISTS idx_temporary_classes_lifecycle 
  ON public.temporary_classes(classroom_id, lifecycle_status);

CREATE INDEX IF NOT EXISTS idx_session_student_overrides_target_student 
  ON public.session_student_overrides(target_classroom_id, student_id);

-- 5. Hardened Security Definer Functions

-- Function 5A: can_view_classroom
-- Determines whether a user has read access to a classroom and its child modules.
-- Permitted:
--   - Teachers and Admins (via is_admin_or_teacher())
--   - Enrolled students in permanent classrooms (via classroom_students)
--   - Assigned students in Special Sessions / Overrides (via session_student_overrides)
CREATE OR REPLACE FUNCTION public.can_view_classroom(c_id uuid, u_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (
    (SELECT public.is_admin_or_teacher()) OR
    EXISTS (
      SELECT 1 FROM public.classroom_students
      WHERE classroom_id = c_id AND student_id = u_id
    ) OR
    EXISTS (
      SELECT 1 FROM public.session_student_overrides
      WHERE target_classroom_id = c_id AND student_id = u_id
    ) OR
    EXISTS (
      SELECT 1 FROM public.temporary_classes tc
      JOIN public.temporary_class_students tcs ON tcs.temporary_class_id = tc.id
      WHERE (tc.classroom_id = c_id OR tc.id = c_id) AND tcs.student_id = u_id
    )
  );
$$;

-- Function 5B: can_participate_in_classroom
-- Determines whether a user can actively send chat messages or modify live participation.
-- Permitted:
--   - Teachers and Admins (always)
--   - Permanent students in permanent classrooms (provided classroom is active)
--   - Students in Special Sessions ONLY if the session is scheduled or active (NOT completed or cancelled)
--   - Students with session overrides on a permanent classroom only on the override_date
CREATE OR REPLACE FUNCTION public.can_participate_in_classroom(c_id uuid, u_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (
    (SELECT public.is_admin_or_teacher()) OR
    -- Permanent classroom student participation:
    (
      EXISTS (
        SELECT 1 FROM public.classroom_students cs
        JOIN public.classrooms c ON c.id = cs.classroom_id
        WHERE cs.classroom_id = c_id 
          AND cs.student_id = u_id
          AND c.status = 'active'
          AND (c.type IS NULL OR c.type = 'permanent')
      )
    ) OR
    -- Permanent classroom makeup on that date:
    (
      EXISTS (
        SELECT 1 FROM public.session_student_overrides sso
        JOIN public.classrooms c ON c.id = sso.target_classroom_id
        WHERE sso.target_classroom_id = c_id 
          AND sso.student_id = u_id
          AND sso.override_date = CURRENT_DATE
          AND c.status = 'active'
          AND (c.type IS NULL OR c.type = 'permanent')
      )
    ) OR
    -- Special Session / Temporary classroom participation:
    (
      EXISTS (
        SELECT 1 FROM public.session_student_overrides sso
        JOIN public.classrooms c ON c.id = sso.target_classroom_id
        WHERE sso.target_classroom_id = c_id 
          AND sso.student_id = u_id
          AND c.type = 'temporary'
          -- Must NOT be completed or cancelled:
          AND NOT EXISTS (
            SELECT 1 FROM public.temporary_classes tc
            WHERE tc.classroom_id = c_id 
              AND tc.lifecycle_status IN ('completed', 'cancelled')
          )
      )
    )
  );
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.can_view_classroom(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_participate_in_classroom(uuid, uuid) TO authenticated, service_role;

-- 6. Apply Hardened RLS Policies Across Tables

-- 6.1 public.classrooms
DROP POLICY IF EXISTS "Students view enrolled classrooms; Admins/Teachers view all" ON public.classrooms;
CREATE POLICY "Students view enrolled classrooms; Admins/Teachers view all"
  ON public.classrooms FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin_or_teacher()) OR 
    public.can_view_classroom(id, (SELECT auth.uid()))
  );

-- 6.2 public.classroom_messages (Chat)
DROP POLICY IF EXISTS "Classroom members & admins/teachers read messages" ON public.classroom_messages;
CREATE POLICY "Classroom members & admins/teachers read messages"
  ON public.classroom_messages FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin_or_teacher()) OR
    public.can_view_classroom(classroom_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Users insert classroom messages as sender" ON public.classroom_messages;
CREATE POLICY "Users insert classroom messages as sender"
  ON public.classroom_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = (SELECT auth.uid()) AND
    public.can_participate_in_classroom(classroom_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Users delete own messages; Admins/Teachers manage all" ON public.classroom_messages;
CREATE POLICY "Users delete own messages; Admins/Teachers manage all"
  ON public.classroom_messages FOR DELETE TO authenticated
  USING (
    (sender_id = (SELECT auth.uid()) AND public.can_participate_in_classroom(classroom_id, (SELECT auth.uid()))) OR 
    (SELECT public.is_admin_or_teacher())
  );

-- 6.3 public.assignments
DROP POLICY IF EXISTS "Students view classroom assignments; Admins/Teachers view all" ON public.assignments;
CREATE POLICY "Students view classroom assignments; Admins/Teachers view all"
  ON public.assignments FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin_or_teacher()) OR
    public.can_view_classroom(classroom_id, (SELECT auth.uid())) OR
    id IN (SELECT assignment_id FROM public.assignment_students WHERE student_id = (SELECT auth.uid()))
  );

-- 6.4 public.classroom_session_logs
DROP POLICY IF EXISTS "Students view classroom session logs; Admins/Teachers view all" ON public.classroom_session_logs;
CREATE POLICY "Students view classroom session logs; Admins/Teachers view all"
  ON public.classroom_session_logs FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin_or_teacher()) OR
    public.can_view_classroom(classroom_id, (SELECT auth.uid()))
  );

-- 6.5 public.class_notes
DROP POLICY IF EXISTS "Classroom members & admins/teachers read class notes" ON public.class_notes;
CREATE POLICY "Classroom members & admins/teachers read class notes"
  ON public.class_notes FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin_or_teacher()) OR
    public.can_view_classroom(classroom_id, (SELECT auth.uid()))
  );

-- 6.6 public.batch_schedules
DROP POLICY IF EXISTS "Students view classroom schedule; Admins/Teachers view all" ON public.batch_schedules;
CREATE POLICY "Students view classroom schedule; Admins/Teachers view all"
  ON public.batch_schedules FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin_or_teacher()) OR
    public.can_view_classroom(classroom_id, (SELECT auth.uid()))
  );

-- 6.7 public.temporary_classes
DROP POLICY IF EXISTS "Students view temp classes; Admins/Teachers view all" ON public.temporary_classes;
CREATE POLICY "Students view temp classes; Admins/Teachers view all"
  ON public.temporary_classes FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin_or_teacher()) OR
    public.can_view_classroom(classroom_id, (SELECT auth.uid()))
  );
