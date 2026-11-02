-- Migration: 20261031170000_batch3_financial_lifecycle_and_session_controls.sql
-- KFA Batch 3: Financial Access, Extra Class & Student Lifecycle Completion
-- Covers:
-- 1. Task A: Negative Balance Special Access (Advance credit up to -2, Overdue access, Audited & Revocable)
-- 2. Task B: Teacher-Controlled End Class (Disable auto-end timeout safely)
-- 3. Task C: Paused Student Resume (Forfeit on pause, Mandatory payment on resume, New billing cycle)
-- 4. Task D: Extra Class Charging Policy (Free Extra Class = 0 credits, Chargeable Extra Class = 1 credit)
-- 5. Task E: Holiday-Related Leave Resolution (Distinguishable cancellation, No makeup entitlement)

-- ============================================================================
-- PART 1: Task A — Negative Balance & Overdue Special Access
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.student_special_access_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
    access_type TEXT NOT NULL CHECK (access_type IN ('advance_credit', 'overdue_access')),
    min_balance_limit INTEGER NOT NULL DEFAULT -2 CHECK (min_balance_limit >= -2 AND min_balance_limit <= 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
    granted_by UUID NOT NULL REFERENCES public.users(id),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT NOT NULL CHECK (char_length(trim(reason)) >= 3),
    revoked_by UUID REFERENCES public.users(id),
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index: At most one active grant per student, classroom, and access_type
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_special_access_active
    ON public.student_special_access_grants (student_id, classroom_id, access_type)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_student_special_access_student
    ON public.student_special_access_grants (student_id);

CREATE INDEX IF NOT EXISTS idx_student_special_access_classroom
    ON public.student_special_access_grants (classroom_id);

-- Immutable audit log for special access
CREATE TABLE IF NOT EXISTS public.student_special_access_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grant_id UUID NOT NULL REFERENCES public.student_special_access_grants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
    access_type TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('granted', 'revoked')),
    actor_id UUID NOT NULL REFERENCES public.users(id),
    actor_role TEXT NOT NULL,
    reason TEXT NOT NULL,
    min_balance_limit INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Immutable audit trigger
CREATE OR REPLACE FUNCTION public.prevent_special_access_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_setting('kfa.allow_audit_log_cleanup', true) = 'true' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'student_special_access_audit_logs records are strictly append-only and cannot be modified or deleted.'
        USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS trg_special_access_audit_immutable ON public.student_special_access_audit_logs;
CREATE TRIGGER trg_special_access_audit_immutable
BEFORE UPDATE OR DELETE ON public.student_special_access_audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_special_access_audit_mutation();

-- RLS on grants and audit logs
ALTER TABLE public.student_special_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_special_access_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Authenticated users view grants" ON public.student_special_access_grants;
    CREATE POLICY "Authenticated users view grants"
        ON public.student_special_access_grants FOR SELECT
        TO authenticated
        USING (
            student_id = auth.uid() OR 
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
        );

    DROP POLICY IF EXISTS "Staff view special access audit logs" ON public.student_special_access_audit_logs;
    CREATE POLICY "Staff view special access audit logs"
        ON public.student_special_access_audit_logs FOR SELECT
        TO authenticated
        USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
        );
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- RPC: Grant Special Access
CREATE OR REPLACE FUNCTION public.grant_student_special_access(
    p_student_id UUID,
    p_classroom_id UUID,
    p_access_type TEXT,
    p_reason TEXT,
    p_min_balance_limit INTEGER DEFAULT -2
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_is_assigned_teacher BOOLEAN := false;
    v_clean_reason TEXT;
    v_grant_id UUID;
    v_existing RECORD;
BEGIN
    -- 1. Authentication
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;

    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or administrators can grant special access.'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Authorization
    IF v_caller_role = 'teacher' THEN
        SELECT (c.teacher_id = v_caller_id) INTO v_is_assigned_teacher
        FROM public.classrooms c
        WHERE c.id = p_classroom_id;

        IF NOT COALESCE(v_is_assigned_teacher, false) THEN
            RAISE EXCEPTION 'Unauthorized: teachers can only grant special access for their assigned classrooms.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 3. Parameter Validation
    IF p_access_type NOT IN ('advance_credit', 'overdue_access') THEN
        RAISE EXCEPTION 'Invalid access_type: %. Must be advance_credit or overdue_access.', p_access_type
            USING ERRCODE = '22023';
    END IF;

    IF p_min_balance_limit < -2 OR p_min_balance_limit > 0 THEN
        RAISE EXCEPTION 'Invalid min_balance_limit: %. Must be between -2 and 0.', p_min_balance_limit
            USING ERRCODE = '22023';
    END IF;

    v_clean_reason := trim(COALESCE(p_reason, ''));
    IF char_length(v_clean_reason) < 3 THEN
        RAISE EXCEPTION 'A valid reason (minimum 3 characters) is required.'
            USING ERRCODE = '22023';
    END IF;

    -- 4. Check for existing active grant
    SELECT * INTO v_existing
    FROM public.student_special_access_grants
    WHERE student_id = p_student_id
      AND classroom_id = p_classroom_id
      AND access_type = p_access_type
      AND status = 'active';

    IF v_existing.id IS NOT NULL THEN
        -- Safely idempotent: update reason/min_balance if changed
        UPDATE public.student_special_access_grants
        SET min_balance_limit = p_min_balance_limit,
            reason = v_clean_reason,
            updated_at = NOW()
        WHERE id = v_existing.id;

        v_grant_id := v_existing.id;
    ELSE
        INSERT INTO public.student_special_access_grants (
            student_id,
            classroom_id,
            access_type,
            min_balance_limit,
            status,
            granted_by,
            granted_at,
            reason
        ) VALUES (
            p_student_id,
            p_classroom_id,
            p_access_type,
            p_min_balance_limit,
            'active',
            v_caller_id,
            NOW(),
            v_clean_reason
        )
        RETURNING id INTO v_grant_id;
    END IF;

    -- 5. Audit Log
    INSERT INTO public.student_special_access_audit_logs (
        grant_id,
        student_id,
        classroom_id,
        access_type,
        action,
        actor_id,
        actor_role,
        reason,
        min_balance_limit
    ) VALUES (
        v_grant_id,
        p_student_id,
        p_classroom_id,
        p_access_type,
        'granted',
        v_caller_id,
        v_caller_role,
        v_clean_reason,
        p_min_balance_limit
    );

    RETURN jsonb_build_object(
        'success', true,
        'grant_id', v_grant_id,
        'student_id', p_student_id,
        'classroom_id', p_classroom_id,
        'access_type', p_access_type,
        'min_balance_limit', p_min_balance_limit,
        'status', 'active'
    );
END;
$$;

-- RPC: Revoke Special Access
CREATE OR REPLACE FUNCTION public.revoke_student_special_access(
    p_grant_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_grant public.student_special_access_grants%ROWTYPE;
    v_clean_reason TEXT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or administrators can revoke special access.'
            USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_grant
    FROM public.student_special_access_grants
    WHERE id = p_grant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Special access grant % not found.', p_grant_id USING ERRCODE = 'P0002';
    END IF;

    IF v_grant.status != 'active' THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Grant is already inactive',
            'grant_id', p_grant_id,
            'status', v_grant.status
        );
    END IF;

    v_clean_reason := trim(COALESCE(p_reason, ''));
    IF char_length(v_clean_reason) < 3 THEN
        RAISE EXCEPTION 'A valid revocation reason (minimum 3 characters) is required.'
            USING ERRCODE = '22023';
    END IF;

    UPDATE public.student_special_access_grants
    SET status = 'revoked',
        revoked_by = v_caller_id,
        revoked_at = NOW(),
        revocation_reason = v_clean_reason,
        updated_at = NOW()
    WHERE id = p_grant_id;

    INSERT INTO public.student_special_access_audit_logs (
        grant_id,
        student_id,
        classroom_id,
        access_type,
        action,
        actor_id,
        actor_role,
        reason,
        min_balance_limit
    ) VALUES (
        p_grant_id,
        v_grant.student_id,
        v_grant.classroom_id,
        v_grant.access_type,
        'revoked',
        v_caller_id,
        v_caller_role,
        v_clean_reason,
        v_grant.min_balance_limit
    );

    RETURN jsonb_build_object(
        'success', true,
        'grant_id', p_grant_id,
        'status', 'revoked'
    );
END;
$$;

-- Authoritative Live Access Evaluation Function (Postgres)
CREATE OR REPLACE FUNCTION public.evaluate_student_live_access(
    p_student_id UUID,
    p_classroom_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user RECORD;
    v_classroom RECORD;
    v_effective_bal INTEGER;
    v_is_enrolled BOOLEAN;
    v_due_day INTEGER;
    v_today DATE := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;
    v_is_past_due BOOLEAN := FALSE;
    v_req_advance BOOLEAN := FALSE;
    v_has_advance BOOLEAN := FALSE;
    v_req_overdue BOOLEAN := FALSE;
    v_has_overdue BOOLEAN := FALSE;
    v_can_join BOOLEAN := FALSE;
    v_reason TEXT := '';
    v_fin_state TEXT := 'GOOD_STANDING';
BEGIN
    SELECT * INTO v_user FROM public.users WHERE id = p_student_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('can_join', false, 'error', 'User not found', 'status', 404);
    END IF;

    -- Staff bypass
    IF v_user.role IN ('admin', 'teacher', 'mentor') THEN
        RETURN jsonb_build_object(
            'can_join', true,
            'financial_state', 'GOOD_STANDING',
            'effective_balance', 999,
            'reason', 'Staff bypass'
        );
    END IF;

    -- Paused / Archived students strictly blocked
    IF LOWER(COALESCE(v_user.status, 'active')) != 'active' THEN
        RETURN jsonb_build_object(
            'can_join', false,
            'financial_state', 'RESTRICTED',
            'effective_balance', COALESCE(v_user.fees_classes_paid, 0),
            'error', 'Student is inactive or archived. Live class participation is not available.',
            'status', 403
        );
    END IF;

    -- Enrollment check
    SELECT EXISTS (
        SELECT 1 FROM public.classroom_students WHERE student_id = p_student_id AND classroom_id = p_classroom_id
        UNION ALL
        SELECT 1 FROM public.session_student_overrides WHERE student_id = p_student_id AND target_classroom_id = p_classroom_id
    ) INTO v_is_enrolled;

    IF NOT v_is_enrolled THEN
        RETURN jsonb_build_object(
            'can_join', false,
            'financial_state', 'NOT_ENROLLED',
            'effective_balance', COALESCE(v_user.fees_classes_paid, 0),
            'error', 'Student is not enrolled in this classroom.',
            'status', 403
        );
    END IF;

    v_effective_bal := COALESCE(v_user.fees_classes_paid, 0);

    -- Check if billing due date has passed
    v_due_day := COALESCE(v_user.fees_collection_date, EXTRACT(DAY FROM COALESCE(v_user.join_date, v_today))::INTEGER);
    IF EXTRACT(DAY FROM v_today) > v_due_day AND v_effective_bal <= 0 THEN
        v_is_past_due := TRUE;
    END IF;

    -- Determine financial state
    IF v_effective_bal > 0 THEN
        v_fin_state := 'GOOD_STANDING';
    ELSIF v_effective_bal = 0 THEN
        v_fin_state := CASE WHEN v_is_past_due THEN 'PAYMENT_OVERDUE' ELSE 'FEE_DUE' END;
    ELSE
        v_fin_state := 'PAYMENT_OVERDUE';
    END IF;

    -- Determine required permissions
    IF v_effective_bal < 0 THEN
        v_req_advance := TRUE;
    END IF;

    IF v_is_past_due THEN
        v_req_overdue := TRUE;
    END IF;

    -- Check active grants
    SELECT EXISTS (
        SELECT 1 FROM public.student_special_access_grants
        WHERE student_id = p_student_id
          AND classroom_id = p_classroom_id
          AND access_type = 'advance_credit'
          AND status = 'active'
          AND min_balance_limit <= v_effective_bal
    ) INTO v_has_advance;

    SELECT EXISTS (
        SELECT 1 FROM public.student_special_access_grants
        WHERE student_id = p_student_id
          AND classroom_id = p_classroom_id
          AND access_type = 'overdue_access'
          AND status = 'active'
    ) INTO v_has_overdue;

    -- Enforce access decision
    IF v_effective_bal < -2 THEN
        -- Maximum allowed negative balance is -2. No override can allow < -2
        v_can_join := FALSE;
        v_reason := 'Maximum advance credit limit (-2) exceeded. Balance is ' || v_effective_bal || '.';
    ELSIF v_req_advance AND NOT v_has_advance AND v_req_overdue AND NOT v_has_overdue THEN
        v_can_join := FALSE;
        v_reason := 'Both advance credit and overdue access authorizations are required.';
    ELSIF v_req_advance AND NOT v_has_advance THEN
        v_can_join := FALSE;
        v_reason := 'Negative balance requires advance credit authorization.';
    ELSIF v_req_overdue AND NOT v_has_overdue THEN
        v_can_join := FALSE;
        v_reason := 'Overdue fee requires overdue access authorization.';
    ELSE
        v_can_join := TRUE;
        v_reason := 'Access granted';
    END IF;

    RETURN jsonb_build_object(
        'can_join', v_can_join,
        'financial_state', v_fin_state,
        'effective_balance', v_effective_bal,
        'reason', v_reason,
        'requires_advance_credit', v_req_advance,
        'has_advance_credit', v_has_advance,
        'requires_overdue_access', v_req_overdue,
        'has_overdue_access', v_has_overdue
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_student_special_access(UUID, UUID, TEXT, TEXT, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_student_special_access(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.evaluate_student_live_access(UUID, UUID) TO authenticated, service_role;


-- ============================================================================
-- PART 2: Task B — Teacher-Controlled End Class (Disable auto-end timeout)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_end_stale_classroom_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Owner Policy (Batch 3 Task B):
    -- Automatic termination of classroom sessions is permanently disabled.
    -- Teachers must manually end classes via the meeting UI.
    -- Stale session check returns 0 and does not mutate any classroom or session logs.
    RETURN 0;
END;
$$;

-- Safely unschedule pg_cron job if pg_cron is enabled
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-end-classroom-sessions') THEN
            PERFORM cron.unschedule('auto-end-classroom-sessions');
        END IF;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if cron schema is unavailable
    NULL;
END $$;


-- ============================================================================
-- PART 3: Task C — Paused Student Resume
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.student_lifecycle_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('pause', 'resume', 'archive', 'unarchive', 'transfer')),
    effective_date DATE NOT NULL,
    actor_id UUID NOT NULL REFERENCES public.users(id),
    actor_role TEXT NOT NULL,
    reason TEXT,
    previous_status TEXT,
    new_status TEXT,
    credits_forfeited INTEGER DEFAULT 0,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.prevent_lifecycle_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_setting('kfa.allow_audit_log_cleanup', true) = 'true' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'student_lifecycle_audit_logs records are strictly append-only and cannot be modified or deleted.'
        USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS trg_lifecycle_audit_immutable ON public.student_lifecycle_audit_logs;
CREATE TRIGGER trg_lifecycle_audit_immutable
BEFORE UPDATE OR DELETE ON public.student_lifecycle_audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_lifecycle_audit_mutation();

ALTER TABLE public.student_lifecycle_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Staff view lifecycle audit logs" ON public.student_lifecycle_audit_logs;
    CREATE POLICY "Staff view lifecycle audit logs"
        ON public.student_lifecycle_audit_logs FOR SELECT
        TO authenticated
        USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
        );
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Atomic RPC: Pause Student Learning
CREATE OR REPLACE FUNCTION public.pause_student_learning_atomic(
    p_student_id UUID,
    p_effective_date DATE,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_student public.users%ROWTYPE;
    v_clean_reason TEXT;
    v_forfeited_credits INTEGER := 0;
    v_cancelled_makeups INTEGER := 0;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or administrators can pause learning.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_student FROM public.users WHERE id = p_student_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student % not found', p_student_id USING ERRCODE = 'P0002';
    END IF;

    IF LOWER(COALESCE(v_student.status, 'active')) != 'active' THEN
        RAISE EXCEPTION 'Student is already in % status. Cannot pause non-active student.', v_student.status USING ERRCODE = '22023';
    END IF;

    v_clean_reason := trim(COALESCE(p_reason, ''));
    IF char_length(v_clean_reason) < 3 THEN
        RAISE EXCEPTION 'A valid reason (minimum 3 characters) is required for pausing learning.' USING ERRCODE = '22023';
    END IF;

    -- 1. Forfeit remaining credits
    v_forfeited_credits := GREATEST(0, COALESCE(v_student.fees_classes_paid, 0));

    -- 2. Cancel future scheduled makeup sessions
    WITH cancelled AS (
        UPDATE public.session_student_overrides
        SET booking_status = 'cancelled',
            reason = COALESCE(reason, '') || ' [Cancelled due to pause effective ' || p_effective_date::TEXT || ']',
            updated_at = NOW()
        WHERE student_id = p_student_id
          AND override_date >= p_effective_date
          AND booking_status = 'scheduled'
        RETURNING id
    )
    SELECT COUNT(*) INTO v_cancelled_makeups FROM cancelled;

    -- 3. Revoke any active special access grants
    UPDATE public.student_special_access_grants
    SET status = 'revoked',
        revoked_by = v_caller_id,
        revoked_at = NOW(),
        revocation_reason = 'Student paused effective ' || p_effective_date::TEXT,
        updated_at = NOW()
    WHERE student_id = p_student_id
      AND status = 'active';

    -- 4. Update student record
    UPDATE public.users
    SET status = 'inactive',
        fees_classes_paid = 0,
        notes = COALESCE(notes, '') || E'\n[Paused ' || p_effective_date::TEXT || ' - Forfeited ' || v_forfeited_credits || ' credits]: ' || v_clean_reason,
        updated_at = NOW()
    WHERE id = p_student_id;

    -- 5. Audit Log
    INSERT INTO public.student_lifecycle_audit_logs (
        student_id,
        action,
        effective_date,
        actor_id,
        actor_role,
        reason,
        previous_status,
        new_status,
        credits_forfeited,
        details
    ) VALUES (
        p_student_id,
        'pause',
        p_effective_date,
        v_caller_id,
        v_caller_role,
        v_clean_reason,
        'active',
        'inactive',
        v_forfeited_credits,
        jsonb_build_object(
            'cancelled_makeups', v_cancelled_makeups,
            'previous_credits', v_forfeited_credits
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'student_id', p_student_id,
        'effective_date', p_effective_date,
        'credits_forfeited', v_forfeited_credits,
        'cancelled_makeups', v_cancelled_makeups,
        'status', 'inactive'
    );
END;
$$;

-- Atomic RPC: Resume Student Learning
CREATE OR REPLACE FUNCTION public.resume_student_learning_atomic(
    p_student_id UUID,
    p_classroom_id UUID,
    p_resume_date DATE,
    p_payment_amount NUMERIC,
    p_payment_method TEXT DEFAULT 'cash',
    p_payment_reference TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_student public.users%ROWTYPE;
    v_classroom public.classrooms%ROWTYPE;
    v_new_due_day INTEGER;
    v_payment_id UUID;
    v_classes_added INTEGER := 4;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or administrators can resume learning.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_student FROM public.users WHERE id = p_student_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student % not found', p_student_id USING ERRCODE = 'P0002';
    END IF;

    -- Invariant: Must be inactive/paused
    IF LOWER(COALESCE(v_student.status, 'inactive')) != 'inactive' THEN
        RAISE EXCEPTION 'Student is already %; cannot perform repeated resume operation.', v_student.status
            USING ERRCODE = '22023';
    END IF;

    -- Validate permanent classroom
    SELECT * INTO v_classroom FROM public.classrooms WHERE id = p_classroom_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Classroom % not found', p_classroom_id USING ERRCODE = 'P0002';
    END IF;

    IF v_classroom.type NOT IN ('permanent', 'regular') THEN
        RAISE EXCEPTION 'Student must be assigned to a permanent classroom upon resume (type is %).', v_classroom.type
            USING ERRCODE = '22023';
    END IF;

    -- Invariant: Advance payment is strictly mandatory to resume
    IF p_payment_amount IS NULL OR p_payment_amount <= 0 THEN
        RAISE EXCEPTION 'Resume requires an approved advance payment. Live class access cannot be restored without payment.'
            USING ERRCODE = '22023';
    END IF;

    -- 1. New billing cycle day matches resume date (BR-32)
    v_new_due_day := EXTRACT(DAY FROM p_resume_date)::INTEGER;

    -- 2. Update classroom enrollment (remove circle rooms, assign permanent)
    DELETE FROM public.classroom_students
    WHERE student_id = p_student_id
      AND classroom_id IN (
          SELECT id FROM public.classrooms 
          WHERE type = 'learning_circle' OR name ILIKE '%learning circle%'
      );

    INSERT INTO public.classroom_students (classroom_id, student_id, joined_at)
    VALUES (p_classroom_id, p_student_id, p_resume_date::TIMESTAMPTZ)
    ON CONFLICT (classroom_id, student_id) 
    DO UPDATE SET joined_at = p_resume_date::TIMESTAMPTZ;

    -- 3. Calculate classes for payment
    IF v_student.fees_basis = 'class' AND v_student.fees_amount > 0 THEN
        v_classes_added := GREATEST(1, FLOOR(p_payment_amount / v_student.fees_amount)::INTEGER);
    ELSE
        v_classes_added := 4;
    END IF;

    -- 4. Record and approve fee payment atomically
    INSERT INTO public.fees_payments (
        student_id,
        amount,
        payment_date,
        payment_method,
        status,
        classes_added,
        notes
    ) VALUES (
        p_student_id,
        p_payment_amount,
        p_resume_date,
        COALESCE(p_payment_method, 'cash'),
        'approved',
        v_classes_added,
        COALESCE(p_payment_reference, '') || ' ' || COALESCE(p_notes, 'Advance payment for learning resumption effective ' || p_resume_date::TEXT)
    )
    RETURNING id INTO v_payment_id;

    -- Audit log for payment
    INSERT INTO public.fees_payment_audit_logs (
        payment_id,
        actor_id,
        action,
        previous_status,
        new_status,
        credit_delta,
        reason
    ) VALUES (
        v_payment_id,
        v_caller_id,
        'approve',
        'pending_approval',
        'approved',
        v_classes_added,
        'Resumption advance payment approved'
    );

    -- 5. Update student status, billing due day, and credits
    UPDATE public.users
    SET status = 'active',
        fees_collection_date = v_new_due_day,
        fees_classes_paid = v_classes_added,
        notes = COALESCE(notes, '') || E'\n[Resumed ' || p_resume_date::TEXT || ' - Due Day: ' || v_new_due_day || ']: ' || COALESCE(p_notes, 'Learning resumed with approved payment'),
        updated_at = NOW()
    WHERE id = p_student_id;

    -- 6. Audit Log for lifecycle
    INSERT INTO public.student_lifecycle_audit_logs (
        student_id,
        action,
        effective_date,
        actor_id,
        actor_role,
        reason,
        previous_status,
        new_status,
        credits_forfeited,
        details
    ) VALUES (
        p_student_id,
        'resume',
        p_resume_date,
        v_caller_id,
        v_caller_role,
        COALESCE(p_notes, 'Resumed learning with advance payment'),
        'inactive',
        'active',
        0,
        jsonb_build_object(
            'classroom_id', p_classroom_id,
            'new_due_day', v_new_due_day,
            'payment_id', v_payment_id,
            'payment_amount', p_payment_amount,
            'classes_added', v_classes_added
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'student_id', p_student_id,
        'status', 'active',
        'classroom_id', p_classroom_id,
        'resume_date', p_resume_date,
        'new_due_day', v_new_due_day,
        'payment_id', v_payment_id,
        'credits_added', v_classes_added,
        'effective_balance', v_classes_added
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pause_student_learning_atomic(UUID, DATE, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resume_student_learning_atomic(UUID, UUID, DATE, NUMERIC, TEXT, TEXT, TEXT) TO authenticated, service_role;


-- ============================================================================
-- PART 4: Task D — Extra Class Charging Policy
-- ============================================================================

-- Ensure temporary_classes credit_treatment check constraint
DO $$
BEGIN
    ALTER TABLE public.temporary_classes DROP CONSTRAINT IF EXISTS chk_temporary_classes_credit_treatment;
    ALTER TABLE public.temporary_classes ADD CONSTRAINT chk_temporary_classes_credit_treatment
        CHECK (credit_treatment IS NULL OR credit_treatment IN ('complimentary', 'makeup', 'consume_credit'));
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Update is_attendance_chargeable() to recognize complimentary vs consume_credit robustly
DROP FUNCTION IF EXISTS public.is_attendance_chargeable(uuid, uuid, date, text);

CREATE OR REPLACE FUNCTION public.is_attendance_chargeable(
    p_student_id UUID,
    p_classroom_id UUID,
    p_date DATE,
    p_status TEXT,
    p_on_behalf_of_date DATE DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_classroom_type TEXT;
    v_temp_credit_treatment TEXT;
    v_temp_purpose TEXT;
    v_override RECORD;
    v_missed_date DATE;
    v_missed_att_status TEXT;
    v_missed_credit_deducted INTEGER;
    v_has_approved_leave BOOLEAN;
    v_makeup_attended BOOLEAN;
    v_another_makeup_attended BOOLEAN;
BEGIN
    -- Rule 1: Excused attendance NEVER consumes prepaid credits
    IF LOWER(p_status) = 'excused' THEN
        RETURN FALSE;
    END IF;

    -- Only present, late, and absent can potentially consume credits
    IF LOWER(p_status) NOT IN ('present', 'late', 'absent') THEN
        RETURN FALSE;
    END IF;

    -- Rule 2: Check if classroom is a Complimentary Special Session / Temporary Class
    SELECT c.type, tc.credit_treatment, tc.purpose
    INTO v_classroom_type, v_temp_credit_treatment, v_temp_purpose
    FROM public.classrooms c
    LEFT JOIN public.temporary_classes tc
      ON (tc.classroom_id = c.id OR tc.id = c.id)
    WHERE c.id = p_classroom_id
    LIMIT 1;

    IF v_classroom_type = 'temporary' OR v_temp_credit_treatment IS NOT NULL OR v_temp_purpose IS NOT NULL THEN
        -- Complimentary (Free Extra Class) = 0 deduction
        IF v_temp_credit_treatment = 'complimentary' 
           OR (v_temp_credit_treatment IS NULL AND v_temp_purpose IS NOT NULL AND v_temp_purpose NOT IN ('makeup', 'consume_credit')) THEN
            RETURN FALSE;
        END IF;
    END IF;

    -- Rule 3: Check student override for this specific session
    SELECT id, credit_treatment, missed_session_date, reason
    INTO v_override
    FROM public.session_student_overrides
    WHERE student_id = p_student_id
      AND target_classroom_id = p_classroom_id
      AND override_date = p_date
    LIMIT 1;

    IF v_override.id IS NOT NULL THEN
        -- If student-level override says complimentary, zero deduction
        IF v_override.credit_treatment = 'complimentary' THEN
            RETURN FALSE;
        END IF;

        -- If makeup, apply makeup deduction symmetry
        IF v_override.credit_treatment = 'makeup' 
           OR v_temp_purpose = 'makeup' 
           OR v_temp_credit_treatment = 'makeup' THEN

            v_missed_date := v_override.missed_session_date;
            IF v_missed_date IS NULL AND v_override.reason IS NOT NULL THEN
                v_missed_date := substring(v_override.reason FROM '\[MissedDate:([0-9]{4}-[0-9]{2}-[0-9]{2})\]')::DATE;
            END IF;

            IF v_missed_date IS NULL THEN
                RAISE EXCEPTION 'Unmapped makeup attendance: Student override on date % has credit_treatment = ''makeup'' but lacks an identifiable original missed class date.', p_date;
            END IF;

            SELECT status, credit_deducted INTO v_missed_att_status, v_missed_credit_deducted
            FROM public.attendance
            WHERE student_id = p_student_id
              AND date = v_missed_date
            LIMIT 1;

            SELECT EXISTS (
                SELECT 1 FROM public.leave_requests
                WHERE student_id = p_student_id
                  AND class_date = v_missed_date
                  AND status = 'approved'
            ) INTO v_has_approved_leave;

            IF v_has_approved_leave OR LOWER(v_missed_att_status) = 'excused' THEN
                RETURN TRUE;
            END IF;

            IF LOWER(v_missed_att_status) IN ('absent', 'present', 'late') 
               AND COALESCE(v_missed_credit_deducted, 1) = 1 THEN
                RETURN FALSE;
            END IF;

            RETURN TRUE;
        END IF;
    END IF;

    -- Rule 4: Symmetrical guard: check if makeup was already attended for this date
    SELECT EXISTS (
        SELECT 1
        FROM public.session_student_overrides o
        JOIN public.attendance a
          ON a.student_id = o.student_id
         AND a.classroom_id = o.target_classroom_id
         AND a.date = o.override_date
        WHERE o.student_id = p_student_id
          AND (o.missed_session_date = p_date OR o.reason LIKE '%[MissedDate:' || p_date::text || ']%')
          AND o.override_date != p_date
          AND a.status IN ('present', 'late')
    ) INTO v_makeup_attended;

    IF v_makeup_attended THEN
        RETURN FALSE;
    END IF;

    -- Rule 5: On-Behalf-Of attendance duplicate guard
    IF EXISTS (
        SELECT 1 FROM public.attendance
        WHERE student_id = p_student_id
          AND on_behalf_of_date = p_date
          AND date != p_date
          AND status IN ('present', 'late', 'absent')
    ) THEN
        RETURN FALSE;
    END IF;

    -- Standard regular attendance consumes 1 credit
    RETURN TRUE;
END;
$$;


-- ============================================================================
-- PART 5: Task E — Holiday-Related Leave Resolution
-- ============================================================================

-- 1. Update check constraint on leave_requests to include 'cancelled'
ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS leave_requests_status_check;
ALTER TABLE public.leave_requests ADD CONSTRAINT leave_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'));

-- 2. Add cancellation_reason column if not exists
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- 3. Update enforce_leave_request_rules trigger function
CREATE OR REPLACE FUNCTION public.enforce_leave_request_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_today_kolkata DATE;
BEGIN
    IF v_caller_id IS NOT NULL THEN
        SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;

        IF TG_OP = 'INSERT' THEN
            IF v_caller_role = 'student' AND NEW.student_id <> v_caller_id THEN
                RAISE EXCEPTION 'Unauthorized: students can only submit leave requests for themselves' USING ERRCODE = '42501';
            ELSIF v_caller_role NOT IN ('admin', 'teacher', 'student') THEN
                RAISE EXCEPTION 'Unauthorized: caller role not permitted to submit leave requests' USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.status = 'pending' THEN
            v_today_kolkata := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;
            IF NEW.class_date <= v_today_kolkata THEN
                RAISE EXCEPTION 'Same-day and past-date leave requests are prohibited. Leaves must be requested in advance of the scheduled class calendar date.'
                    USING ERRCODE = '22023';
            END IF;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.student_id AND role = 'student') THEN
            RAISE EXCEPTION 'Invalid student: user % does not exist or is not a student', NEW.student_id USING ERRCODE = '22023';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.classrooms WHERE id = NEW.classroom_id) THEN
            RAISE EXCEPTION 'Invalid classroom: classroom % does not exist', NEW.classroom_id USING ERRCODE = '22023';
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'approved' AND NEW.status = 'pending' THEN
            RAISE EXCEPTION 'Invalid leave status transition: cannot revert approved leave to pending' USING ERRCODE = '22023';
        END IF;
        IF OLD.status = 'rejected' AND NEW.status = 'pending' THEN
            RAISE EXCEPTION 'Invalid leave status transition: cannot revert rejected leave to pending' USING ERRCODE = '22023';
        END IF;
        IF OLD.status = 'cancelled' AND NEW.status = 'pending' THEN
            RAISE EXCEPTION 'Invalid leave status transition: cannot revert cancelled leave to pending' USING ERRCODE = '22023';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 4. Update declare_classroom_holiday to set status = 'cancelled' with explicit reason
CREATE OR REPLACE FUNCTION public.declare_classroom_holiday(
    p_classroom_id UUID,
    p_holiday_date DATE,
    p_holiday_type TEXT,
    p_reason TEXT,
    p_alternative_date DATE DEFAULT NULL,
    p_alt_start_time TIME DEFAULT NULL,
    p_alt_end_time TIME DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_is_assigned_teacher BOOLEAN := false;
    v_holiday_id UUID;
    v_clean_reason TEXT;
    v_existing RECORD;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or administrators can declare holidays.'
            USING ERRCODE = '42501';
    END IF;

    IF v_caller_role = 'teacher' THEN
        SELECT (c.teacher_id = v_caller_id) INTO v_is_assigned_teacher
        FROM public.classrooms c
        WHERE c.id = p_classroom_id;

        IF NOT COALESCE(v_is_assigned_teacher, false) THEN
            RAISE EXCEPTION 'Unauthorized: teachers can only declare holidays for their assigned classrooms.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    IF p_holiday_type NOT IN ('with_alternative', 'no_alternative') THEN
        RAISE EXCEPTION 'Invalid holiday_type: %. Must be ''with_alternative'' or ''no_alternative''.', p_holiday_type
            USING ERRCODE = '22023';
    END IF;

    v_clean_reason := trim(COALESCE(p_reason, ''));
    IF char_length(v_clean_reason) < 3 THEN
        RAISE EXCEPTION 'A valid holiday reason (minimum 3 characters) is required.'
            USING ERRCODE = '22023';
    END IF;

    IF p_holiday_type = 'with_alternative' THEN
        IF p_alternative_date IS NULL THEN
            RAISE EXCEPTION 'Alternative class date is required when holiday type is with_alternative.'
                USING ERRCODE = '22023';
        END IF;
        IF p_alternative_date = p_holiday_date THEN
            RAISE EXCEPTION 'Alternative class date cannot be the same as the holiday date.'
                USING ERRCODE = '22023';
        END IF;
    ELSE
        p_alternative_date := NULL;
        p_alt_start_time := NULL;
        p_alt_end_time := NULL;
    END IF;

    SELECT * INTO v_existing
    FROM public.classroom_holidays
    WHERE classroom_id = p_classroom_id
      AND holiday_date = p_holiday_date
      AND status = 'active';

    IF v_existing.id IS NOT NULL THEN
        IF v_existing.holiday_type = p_holiday_type AND
           v_existing.alternative_date IS NOT DISTINCT FROM p_alternative_date THEN
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'message', 'Holiday is already declared with identical parameters (idempotent).',
                'holiday_id', v_existing.id
            );
        ELSE
            RAISE EXCEPTION 'A holiday is already declared for classroom on date % with different parameters.', p_holiday_date
                USING ERRCODE = '23505';
        END IF;
    END IF;

    IF p_alternative_date IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.classroom_holidays
            WHERE classroom_id = p_classroom_id
              AND holiday_date = p_alternative_date
              AND status = 'active'
        ) THEN
            RAISE EXCEPTION 'Alternative date % is already declared as a holiday for this classroom.', p_alternative_date
                USING ERRCODE = '23514';
        END IF;

        IF EXISTS (
            SELECT 1 FROM public.classroom_holidays
            WHERE classroom_id = p_classroom_id
              AND alternative_date = p_alternative_date
              AND status = 'active'
        ) THEN
            RAISE EXCEPTION 'Alternative date % is already booked as an alternative for another holiday in this classroom.', p_alternative_date
                USING ERRCODE = '23514';
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.attendance
        WHERE classroom_id = p_classroom_id
          AND date = p_holiday_date
          AND status IN ('present', 'late', 'absent', 'excused')
    ) THEN
        RAISE EXCEPTION 'Cannot declare holiday: attendance is already recorded for classroom on date %. Historical attendance must be corrected or unmarked first.', p_holiday_date
            USING ERRCODE = '23514';
    END IF;

    -- Task E: Distinguishable cancellation of pending leave requests
    UPDATE public.leave_requests
    SET status = 'cancelled',
        cancellation_reason = 'Cancelled due to declared classroom holiday',
        updated_at = NOW()
    WHERE classroom_id = p_classroom_id
      AND class_date = p_holiday_date
      AND status = 'pending';

    INSERT INTO public.classroom_holidays (
        classroom_id,
        holiday_date,
        holiday_type,
        alternative_date,
        alternative_start_time,
        alternative_end_time,
        status,
        reason,
        declared_by,
        declared_at
    ) VALUES (
        p_classroom_id,
        p_holiday_date,
        p_holiday_type,
        p_alternative_date,
        p_alt_start_time,
        p_alt_end_time,
        'active',
        v_clean_reason,
        v_caller_id,
        NOW()
    )
    RETURNING id INTO v_holiday_id;

    INSERT INTO public.classroom_holiday_audit_logs (
        holiday_id,
        classroom_id,
        holiday_date,
        action,
        holiday_type,
        alternative_date,
        actor_id,
        actor_role,
        reason
    ) VALUES (
        v_holiday_id,
        p_classroom_id,
        p_holiday_date,
        'declared',
        p_holiday_type,
        p_alternative_date,
        v_caller_id,
        v_caller_role,
        v_clean_reason
    );

    RETURN jsonb_build_object(
        'success', true,
        'holiday_id', v_holiday_id,
        'classroom_id', p_classroom_id,
        'holiday_date', p_holiday_date,
        'holiday_type', p_holiday_type,
        'alternative_date', p_alternative_date
    );
END;
$$;
