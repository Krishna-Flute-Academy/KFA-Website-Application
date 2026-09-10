-- ============================================================================
-- Migration: Harden Guest Makeup RLS & Classroom Chat Security
-- ============================================================================
-- Ensures students temporarily attending a permanent classroom for a 1-day
-- makeup session do NOT gain access to historical or future chat messages
-- of that permanent classroom.
-- ============================================================================

-- 1. Create specialized function: can_view_classroom_chat
-- Permitted:
--   - Teachers and Admins (always)
--   - Enrolled students in permanent classrooms (classroom_students)
--   - Special Session / Temporary classroom students (session_student_overrides or temporary_class_students)
-- RESTRICTED:
--   - Session student overrides on PERMANENT classrooms do NOT grant chat access.
CREATE OR REPLACE FUNCTION public.can_view_classroom_chat(c_id uuid, u_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (
    (SELECT public.is_admin_or_teacher()) OR
    -- Permanent classroom: strictly enrolled students (classroom_students)
    EXISTS (
      SELECT 1 FROM public.classroom_students cs
      JOIN public.classrooms c ON c.id = cs.classroom_id
      WHERE cs.classroom_id = c_id 
        AND cs.student_id = u_id
        AND (c.type IS NULL OR c.type = 'permanent')
    ) OR
    -- Special Session / Temporary classroom: students assigned via overrides
    EXISTS (
      SELECT 1 FROM public.session_student_overrides sso
      JOIN public.classrooms c ON c.id = sso.target_classroom_id
      WHERE sso.target_classroom_id = c_id 
        AND sso.student_id = u_id
        AND c.type = 'temporary'
    ) OR
    -- Special Session / Temporary classroom: students assigned via temporary_class_students
    EXISTS (
      SELECT 1 FROM public.temporary_classes tc
      JOIN public.temporary_class_students tcs ON tcs.temporary_class_id = tc.id
      WHERE (tc.classroom_id = c_id OR tc.id = c_id) 
        AND tcs.student_id = u_id
    )
  );
$$;

-- 2. Update can_participate_in_classroom
-- Ensure guest overrides on permanent classrooms cannot post messages or participate in chat.
CREATE OR REPLACE FUNCTION public.can_participate_in_classroom(c_id uuid, u_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (
    (SELECT public.is_admin_or_teacher()) OR
    -- Permanent classroom: strictly enrolled students, active classroom
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
    -- Special Session / Temporary classroom participation:
    (
      EXISTS (
        SELECT 1 FROM public.session_student_overrides sso
        JOIN public.classrooms c ON c.id = sso.target_classroom_id
        WHERE sso.target_classroom_id = c_id 
          AND sso.student_id = u_id
          AND c.type = 'temporary'
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
GRANT EXECUTE ON FUNCTION public.can_view_classroom_chat(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_participate_in_classroom(uuid, uuid) TO authenticated, service_role;

-- 3. Update public.classroom_messages (Chat) RLS Policies
DROP POLICY IF EXISTS "Classroom members & admins/teachers read messages" ON public.classroom_messages;
CREATE POLICY "Classroom members & admins/teachers read messages"
  ON public.classroom_messages FOR SELECT TO authenticated
  USING (
    public.can_view_classroom_chat(classroom_id, (SELECT auth.uid()))
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
