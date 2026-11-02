-- =====================================================================================
-- Migration: 20261031150000_complete_holiday_management.sql
-- Description: Batch 2: Complete Holiday Management Implementation
--              1. Schema for classroom_holidays (with_alternative and no_alternative)
--              2. Append-only immutable classroom_holiday_audit_logs table and trigger
--              3. Attendance prevention trigger on declared active holidays
--              4. Authoritative transactional RPC: declare_classroom_holiday()
--              5. Authoritative transactional RPC: cancel_classroom_holiday()
--              6. Strict RLS policies and grants (defense-in-depth protection)
-- =====================================================================================

-- 1. Create classroom_holidays Table
CREATE TABLE IF NOT EXISTS public.classroom_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
    holiday_date DATE NOT NULL,
    holiday_type TEXT NOT NULL CHECK (holiday_type IN ('with_alternative', 'no_alternative')),
    alternative_date DATE,
    alternative_start_time TIME WITHOUT TIME ZONE,
    alternative_end_time TIME WITHOUT TIME ZONE,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
    declared_by UUID NOT NULL REFERENCES public.users(id),
    declared_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    cancelled_by UUID REFERENCES public.users(id),
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_classroom_holidays_alt_type CHECK (
        (holiday_type = 'with_alternative' AND alternative_date IS NOT NULL AND alternative_date <> holiday_date) OR
        (holiday_type = 'no_alternative' AND alternative_date IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_classroom_holidays_classroom_date 
    ON public.classroom_holidays(classroom_id, holiday_date);

CREATE UNIQUE INDEX IF NOT EXISTS idx_classroom_holidays_active_unique 
    ON public.classroom_holidays(classroom_id, holiday_date) 
    WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_classroom_holidays_active_alt_unique 
    ON public.classroom_holidays(classroom_id, alternative_date) 
    WHERE status = 'active' AND alternative_date IS NOT NULL;

-- 2. Create classroom_holiday_audit_logs Table
CREATE TABLE IF NOT EXISTS public.classroom_holiday_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    holiday_id UUID NOT NULL REFERENCES public.classroom_holidays(id) ON DELETE RESTRICT,
    classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE RESTRICT,
    holiday_date DATE NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('declared', 'modified', 'cancelled')),
    holiday_type TEXT NOT NULL,
    alternative_date DATE,
    actor_id UUID NOT NULL REFERENCES public.users(id),
    actor_role TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_holiday_audit_classroom 
    ON public.classroom_holiday_audit_logs(classroom_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_holiday_audit_holiday_id 
    ON public.classroom_holiday_audit_logs(holiday_id);

-- 3. Immutability Trigger for Audit Logs
CREATE OR REPLACE FUNCTION public.prevent_holiday_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('kfa.allow_audit_log_cleanup', true) = 'true' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'classroom_holiday_audit_logs records are strictly append-only and cannot be modified or deleted.'
        USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_holiday_audit_logs_immutable ON public.classroom_holiday_audit_logs;
CREATE TRIGGER trg_holiday_audit_logs_immutable
    BEFORE UPDATE OR DELETE ON public.classroom_holiday_audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_holiday_audit_mutation();

-- 4. Attendance Prevention Trigger on Declared Holiday
CREATE OR REPLACE FUNCTION public.prevent_attendance_on_holiday()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.date IS DISTINCT FROM NEW.date) THEN
        IF EXISTS (
            SELECT 1 FROM public.classroom_holidays
            WHERE classroom_id = NEW.classroom_id
              AND holiday_date = NEW.date
              AND status = 'active'
        ) THEN
            RAISE EXCEPTION 'Cannot record attendance: % is declared as a holiday for this classroom.', NEW.date
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_attendance_on_holiday ON public.attendance;
CREATE TRIGGER trg_prevent_attendance_on_holiday
    BEFORE INSERT OR UPDATE ON public.attendance
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_attendance_on_holiday();

-- 5. Transactional RPC: declare_classroom_holiday
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
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT := 'admin';
    v_clean_type TEXT;
    v_clean_reason TEXT;
    v_existing_id UUID;
    v_existing_type TEXT;
    v_existing_alt_date DATE;
    v_holiday_id UUID;
    v_audit_id UUID;
BEGIN
    -- 1. Authorization Check: Admin or Assigned Teacher (BR-24)
    IF v_caller_id IS NOT NULL THEN
        SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
        IF v_caller_role NOT IN ('admin', 'teacher') THEN
            RAISE EXCEPTION 'Unauthorized: only teachers or administrators can declare holidays.' USING ERRCODE = '42501';
        END IF;
    END IF;

    IF v_caller_id IS NOT NULL AND v_caller_role = 'teacher' THEN
        IF NOT public.can_manage_classroom_attendance(p_classroom_id, v_caller_id) THEN
            RAISE EXCEPTION 'Unauthorized: teachers can only declare holidays for their assigned classrooms.' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 2. Input Validation
    v_clean_type := LOWER(TRIM(COALESCE(p_holiday_type, '')));
    IF v_clean_type NOT IN ('with_alternative', 'no_alternative') THEN
        RAISE EXCEPTION 'Invalid holiday type: %. Must be "with_alternative" or "no_alternative".', p_holiday_type USING ERRCODE = '22023';
    END IF;

    v_clean_reason := TRIM(COALESCE(p_reason, ''));
    IF LENGTH(v_clean_reason) < 3 THEN
        RAISE EXCEPTION 'A valid holiday reason (minimum 3 characters) is required.' USING ERRCODE = '22023';
    END IF;

    IF v_clean_type = 'with_alternative' THEN
        IF p_alternative_date IS NULL THEN
            RAISE EXCEPTION 'Alternative date is required for holiday with alternative.' USING ERRCODE = '22023';
        END IF;
        IF p_alternative_date = p_holiday_date THEN
            RAISE EXCEPTION 'Alternative date cannot be the same as the holiday date.' USING ERRCODE = '22023';
        END IF;
    ELSE
        p_alternative_date := NULL;
        p_alt_start_time := NULL;
        p_alt_end_time := NULL;
    END IF;

    -- 3. Check for existing active holiday on holiday_date (Idempotency)
    SELECT id, holiday_type, alternative_date INTO v_existing_id, v_existing_type, v_existing_alt_date
    FROM public.classroom_holidays
    WHERE classroom_id = p_classroom_id
      AND holiday_date = p_holiday_date
      AND status = 'active'
    FOR UPDATE;

    IF v_existing_id IS NOT NULL THEN
        -- If already declared with identical parameters, return idempotently
        IF v_existing_type = v_clean_type AND (
            (v_clean_type = 'no_alternative' AND v_existing_alt_date IS NULL) OR
            (v_clean_type = 'with_alternative' AND v_existing_alt_date = p_alternative_date)
        ) THEN
            RETURN jsonb_build_object(
                'success', true,
                'holiday_id', v_existing_id,
                'classroom_id', p_classroom_id,
                'holiday_date', p_holiday_date,
                'holiday_type', v_clean_type,
                'alternative_date', v_existing_alt_date,
                'idempotent', true,
                'message', 'Holiday already active with matching parameters.'
            );
        ELSE
            RAISE EXCEPTION 'A holiday is already declared for classroom on date % with different parameters.', p_holiday_date
                USING ERRCODE = '23505';
        END IF;
    END IF;

    -- 4. Alternative Date Validation & Conflict Checks
    IF v_clean_type = 'with_alternative' THEN
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
            RAISE EXCEPTION 'Alternative date % is already assigned as an alternative class for another holiday.', p_alternative_date
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- 5. Fail-Closed Finalized Attendance Protection
    IF EXISTS (
        SELECT 1 FROM public.attendance
        WHERE classroom_id = p_classroom_id
          AND date = p_holiday_date
          AND status IN ('present', 'late', 'absent', 'excused')
    ) THEN
        RAISE EXCEPTION 'Cannot declare holiday: attendance is already recorded for classroom on date %. Historical attendance must be corrected or unmarked first.', p_holiday_date
            USING ERRCODE = '23514';
    END IF;

    -- 6. Clean up pending leave requests for this cancelled session (BR-22 / BR-23)
    UPDATE public.leave_requests
    SET status = 'rejected',
        updated_at = NOW()
    WHERE classroom_id = p_classroom_id
      AND class_date = p_holiday_date
      AND status = 'pending';

    -- 7. Insert Holiday Record
    INSERT INTO public.classroom_holidays (
        classroom_id,
        holiday_date,
        holiday_type,
        alternative_date,
        alternative_start_time,
        alternative_end_time,
        reason,
        declared_by,
        declared_at,
        status
    ) VALUES (
        p_classroom_id,
        p_holiday_date,
        v_clean_type,
        p_alternative_date,
        p_alt_start_time,
        p_alt_end_time,
        v_clean_reason,
        COALESCE(v_caller_id, (SELECT teacher_id FROM public.classrooms WHERE id = p_classroom_id)),
        NOW(),
        'active'
    )
    RETURNING id INTO v_holiday_id;

    -- 8. Write Immutable Audit Log (BR-24)
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
        v_clean_type,
        p_alternative_date,
        COALESCE(v_caller_id, (SELECT teacher_id FROM public.classrooms WHERE id = p_classroom_id)),
        v_caller_role,
        v_clean_reason
    )
    RETURNING id INTO v_audit_id;

    RETURN jsonb_build_object(
        'success', true,
        'holiday_id', v_holiday_id,
        'audit_id', v_audit_id,
        'classroom_id', p_classroom_id,
        'holiday_date', p_holiday_date,
        'holiday_type', v_clean_type,
        'alternative_date', p_alternative_date,
        'reason', v_clean_reason
    );
END;
$$;

-- 6. Transactional RPC: cancel_classroom_holiday
CREATE OR REPLACE FUNCTION public.cancel_classroom_holiday(
    p_holiday_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT := 'admin';
    v_holiday public.classroom_holidays%ROWTYPE;
    v_clean_reason TEXT;
    v_audit_id UUID;
BEGIN
    -- 1. Authorization Check: Admin or Assigned Teacher (BR-24)
    IF v_caller_id IS NOT NULL THEN
        SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
        IF v_caller_role NOT IN ('admin', 'teacher') THEN
            RAISE EXCEPTION 'Unauthorized: only teachers or administrators can cancel holidays.' USING ERRCODE = '42501';
        END IF;
    END IF;

    v_clean_reason := TRIM(COALESCE(p_reason, ''));
    IF LENGTH(v_clean_reason) < 3 THEN
        RAISE EXCEPTION 'A valid cancellation reason (minimum 3 characters) is required.' USING ERRCODE = '22023';
    END IF;

    -- 2. Lock holiday row FOR UPDATE
    SELECT * INTO v_holiday
    FROM public.classroom_holidays
    WHERE id = p_holiday_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Holiday not found: %', p_holiday_id USING ERRCODE = 'P0002';
    END IF;

    IF v_holiday.status = 'cancelled' THEN
        RAISE EXCEPTION 'Holiday is already cancelled.' USING ERRCODE = '22023';
    END IF;

    IF v_caller_id IS NOT NULL AND v_caller_role = 'teacher' THEN
        IF NOT public.can_manage_classroom_attendance(v_holiday.classroom_id, v_caller_id) THEN
            RAISE EXCEPTION 'Unauthorized: teachers can only cancel holidays for their assigned classrooms.' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 3. Fail-Closed Check: If alternative class attendance was already recorded, fail closed
    IF v_holiday.holiday_type = 'with_alternative' AND v_holiday.alternative_date IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.attendance
            WHERE classroom_id = v_holiday.classroom_id
              AND date = v_holiday.alternative_date
              AND on_behalf_of_date = v_holiday.holiday_date
              AND status IN ('present', 'late', 'absent', 'excused')
        ) THEN
            RAISE EXCEPTION 'Cannot cancel holiday: attendance has already been recorded for the alternative class on %. Alternative class attendance must be corrected or unmarked first.', v_holiday.alternative_date
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- 4. Cancel Holiday Record
    UPDATE public.classroom_holidays
    SET status = 'cancelled',
        cancelled_by = COALESCE(v_caller_id, v_holiday.declared_by),
        cancelled_at = NOW(),
        cancellation_reason = v_clean_reason,
        updated_at = NOW()
    WHERE id = p_holiday_id;

    -- 5. Write Immutable Audit Log (BR-24)
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
        p_holiday_id,
        v_holiday.classroom_id,
        v_holiday.holiday_date,
        'cancelled',
        v_holiday.holiday_type,
        v_holiday.alternative_date,
        COALESCE(v_caller_id, v_holiday.declared_by),
        v_caller_role,
        v_clean_reason
    )
    RETURNING id INTO v_audit_id;

    RETURN jsonb_build_object(
        'success', true,
        'holiday_id', p_holiday_id,
        'audit_id', v_audit_id,
        'classroom_id', v_holiday.classroom_id,
        'holiday_date', v_holiday.holiday_date,
        'status', 'cancelled',
        'cancellation_reason', v_clean_reason
    );
END;
$$;

-- 7. RLS Policies (Defense-in-depth)
ALTER TABLE public.classroom_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_holiday_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read classroom holidays" ON public.classroom_holidays;
DROP POLICY IF EXISTS "Deny direct insert on classroom holidays" ON public.classroom_holidays;
DROP POLICY IF EXISTS "Deny direct update on classroom holidays" ON public.classroom_holidays;
DROP POLICY IF EXISTS "Deny direct delete on classroom holidays" ON public.classroom_holidays;

CREATE POLICY "Read classroom holidays"
    ON public.classroom_holidays
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Deny direct insert on classroom holidays"
    ON public.classroom_holidays
    FOR INSERT
    TO authenticated
    WITH CHECK (false);

CREATE POLICY "Deny direct update on classroom holidays"
    ON public.classroom_holidays
    FOR UPDATE
    TO authenticated
    USING (false);

CREATE POLICY "Deny direct delete on classroom holidays"
    ON public.classroom_holidays
    FOR DELETE
    TO authenticated
    USING (false);

DROP POLICY IF EXISTS "Staff read holiday audit logs" ON public.classroom_holiday_audit_logs;
DROP POLICY IF EXISTS "Deny direct mutation on holiday audit logs" ON public.classroom_holiday_audit_logs;

CREATE POLICY "Staff read holiday audit logs"
    ON public.classroom_holiday_audit_logs
    FOR SELECT
    TO authenticated
    USING (is_admin_or_teacher());

CREATE POLICY "Deny direct mutation on holiday audit logs"
    ON public.classroom_holiday_audit_logs
    FOR ALL
    TO authenticated
    USING (false)
    WITH CHECK (false);

-- 8. Grants
GRANT EXECUTE ON FUNCTION public.declare_classroom_holiday(UUID, DATE, TEXT, TEXT, DATE, TIME, TIME) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_classroom_holiday(UUID, TEXT) TO authenticated, service_role;
GRANT SELECT ON public.classroom_holidays TO authenticated, service_role;
GRANT SELECT ON public.classroom_holiday_audit_logs TO authenticated, service_role;
