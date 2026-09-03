-- ============================================================================
-- Migration: Add assignment_attachments table with role-gated RLS
-- Target: KFA Website Application
-- Safety: Additive. Does NOT alter or drop existing assignments table.
-- ============================================================================

-- 1. Create assignment_attachments table
CREATE TABLE IF NOT EXISTS public.assignment_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    attachment_type TEXT NOT NULL CHECK (attachment_type IN ('inventory', 'document', 'audio', 'video', 'link')),
    title TEXT NOT NULL,
    file_url TEXT,
    file_name TEXT,
    file_size INTEGER,
    duration_seconds INTEGER,
    inventory_ref_type TEXT,
    inventory_ref_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Indexes for fast query lookup
CREATE INDEX IF NOT EXISTS idx_assignment_attachments_asg_id 
    ON public.assignment_attachments(assignment_id);

CREATE INDEX IF NOT EXISTS idx_assignment_attachments_type 
    ON public.assignment_attachments(attachment_type);

-- 3. Prevent duplicate identical attachments on the same assignment
CREATE UNIQUE INDEX IF NOT EXISTS idx_assignment_attachments_unique_file 
    ON public.assignment_attachments(assignment_id, file_url) 
    WHERE file_url IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_assignment_attachments_unique_inventory 
    ON public.assignment_attachments(assignment_id, inventory_ref_id) 
    WHERE inventory_ref_id IS NOT NULL;

-- 4. Enable Row Level Security
ALTER TABLE public.assignment_attachments ENABLE ROW LEVEL SECURITY;

-- ── 5. Row Level Security Policies ──────────────────────────────────────────

-- ── SELECT POLICY ───────────────────────────────────────────────────────────
-- Admin: Reads all attachments.
-- Teacher: Reads attachments ONLY for assignments they created or teach.
-- Student: Explicitly gated by (role = 'student'). Reads attachments ONLY if
--          directly mapped in assignment_students OR via valid legacy whole-class task.
-- Others / Anon: Receive 0 rows.
DROP POLICY IF EXISTS "Students view assigned task attachments; Admins/Teachers view all" 
    ON public.assignment_attachments;
DROP POLICY IF EXISTS "Students view assigned task attachments; Admins/Teachers read authorized" 
    ON public.assignment_attachments;

CREATE POLICY "Students view assigned task attachments; Admins/Teachers read authorized"
ON public.assignment_attachments 
FOR SELECT 
TO authenticated
USING (
    -- 1. ADMIN: Global read access
    (SELECT public.is_admin())

    -- 2. TEACHER: Authorized management of parent assignment or classroom
    OR (
        (SELECT public.is_admin_or_teacher())
        AND EXISTS (
            SELECT 1 FROM public.assignments asg
            WHERE asg.id = public.assignment_attachments.assignment_id
              AND (
                  asg.teacher_id = (SELECT auth.uid())
                  OR EXISTS (
                      SELECT 1 FROM public.classrooms c
                      WHERE c.id = asg.classroom_id 
                        AND c.teacher_id = (SELECT auth.uid())
                  )
              )
        )
    )

    -- 3. STUDENT: Explicitly role-gated to role = 'student'
    OR (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = (SELECT auth.uid()) AND u.role = 'student'
        )
        AND (
            -- 3A. Direct mapping in assignment_students
            EXISTS (
                SELECT 1 FROM public.assignment_students ast
                WHERE ast.assignment_id = public.assignment_attachments.assignment_id
                  AND ast.student_id = (SELECT auth.uid())
            )
            OR
            -- 3B. Legacy whole-class assignment (only if non-individual & no selective rows exist)
            EXISTS (
                SELECT 1 FROM public.assignments asg
                JOIN public.classroom_students cs ON asg.classroom_id = cs.classroom_id
                WHERE asg.id = public.assignment_attachments.assignment_id
                  AND cs.student_id = (SELECT auth.uid())
                  AND asg.target_type != 'individual'
                  AND NOT EXISTS (
                      SELECT 1 FROM public.assignment_students ast2
                      WHERE ast2.assignment_id = asg.id
                  )
            )
        )
    )
);

-- ── INSERT POLICY ───────────────────────────────────────────────────────────
-- Admin: Any assignment.
-- Teacher: Only assignments they teach or own.
-- Student / Others: Blocked (evaluates to false).
DROP POLICY IF EXISTS "Admins and authorized teachers insert attachments" 
    ON public.assignment_attachments;

CREATE POLICY "Admins and authorized teachers insert attachments"
ON public.assignment_attachments 
FOR INSERT 
TO authenticated
WITH CHECK (
    (SELECT public.is_admin())
    OR (
        (SELECT public.is_admin_or_teacher())
        AND EXISTS (
            SELECT 1 FROM public.assignments asg
            WHERE asg.id = assignment_id
              AND (
                  asg.teacher_id = (SELECT auth.uid())
                  OR EXISTS (
                      SELECT 1 FROM public.classrooms c
                      WHERE c.id = asg.classroom_id 
                        AND c.teacher_id = (SELECT auth.uid())
                  )
              )
        )
    )
);

-- ── UPDATE POLICY ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins and authorized teachers update attachments" 
    ON public.assignment_attachments;

CREATE POLICY "Admins and authorized teachers update attachments"
ON public.assignment_attachments 
FOR UPDATE 
TO authenticated
USING (
    (SELECT public.is_admin())
    OR (
        (SELECT public.is_admin_or_teacher())
        AND EXISTS (
            SELECT 1 FROM public.assignments asg
            WHERE asg.id = public.assignment_attachments.assignment_id
              AND (
                  asg.teacher_id = (SELECT auth.uid())
                  OR EXISTS (
                      SELECT 1 FROM public.classrooms c
                      WHERE c.id = asg.classroom_id 
                        AND c.teacher_id = (SELECT auth.uid())
                  )
              )
        )
    )
)
WITH CHECK (
    (SELECT public.is_admin())
    OR (
        (SELECT public.is_admin_or_teacher())
        AND EXISTS (
            SELECT 1 FROM public.assignments asg
            WHERE asg.id = assignment_id
              AND (
                  asg.teacher_id = (SELECT auth.uid())
                  OR EXISTS (
                      SELECT 1 FROM public.classrooms c
                      WHERE c.id = asg.classroom_id 
                        AND c.teacher_id = (SELECT auth.uid())
                  )
              )
        )
    )
);

-- ── DELETE POLICY ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins and authorized teachers delete attachments" 
    ON public.assignment_attachments;

CREATE POLICY "Admins and authorized teachers delete attachments"
ON public.assignment_attachments 
FOR DELETE 
TO authenticated
USING (
    (SELECT public.is_admin())
    OR (
        (SELECT public.is_admin_or_teacher())
        AND EXISTS (
            SELECT 1 FROM public.assignments asg
            WHERE asg.id = public.assignment_attachments.assignment_id
              AND (
                  asg.teacher_id = (SELECT auth.uid())
                  OR EXISTS (
                      SELECT 1 FROM public.classrooms c
                      WHERE c.id = asg.classroom_id 
                        AND c.teacher_id = (SELECT auth.uid())
                  )
              )
        )
    )
);
