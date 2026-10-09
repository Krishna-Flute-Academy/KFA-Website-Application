-- ============================================================================
-- KFA Production Migration — Phase 3: Constraint Finalization (Post-Cutover)
-- Migration ID: 20261009140000_unified_classroom_sessions_phase3_constraints.sql
-- Description: Transition from legacy 3-column constraint to 4-column multi-session constraint
-- NOTE: Execute ONLY after Phase 1 and Application Frontend Deployment are verified!
-- ============================================================================

-- 1. Ensure classrooms table has active_session_id column
ALTER TABLE public.classrooms 
ADD COLUMN IF NOT EXISTS active_session_id UUID REFERENCES public.classroom_session_logs(id) ON DELETE SET NULL;

-- 2. Drop legacy 3-column unique constraints safely
ALTER TABLE public.attendance 
DROP CONSTRAINT IF EXISTS attendance_classroom_student_date_key;

ALTER TABLE public.attendance 
DROP CONSTRAINT IF EXISTS unique_student_attendance;

-- 3. Apply single unified 4-column constraint with NULLS NOT DISTINCT
-- In PostgreSQL 15+, NULLS NOT DISTINCT guarantees (classroom_id, student_id, date, NULL)
-- is treated as unique, while permitting multiple distinct session UUIDs on the same date!
ALTER TABLE public.attendance 
ADD CONSTRAINT uq_attendance_session_student 
UNIQUE NULLS NOT DISTINCT (classroom_id, student_id, date, session_id);

CREATE INDEX IF NOT EXISTS idx_attendance_session_lookup 
ON public.attendance(classroom_id, date, session_id);

-- 4. Deploy hardened session-aware save_attendance_record RPC
-- Hardened against concurrent writes (FOR UPDATE & ON CONFLICT), session mismatch, and field erasure
CREATE OR REPLACE FUNCTION public.save_attendance_record(
    p_classroom_id UUID,
    p_student_id UUID,
    p_date DATE,
    p_status TEXT,
    p_session_id UUID DEFAULT NULL,
    p_on_behalf_of_date DATE DEFAULT NULL,
    p_is_extra_class BOOLEAN DEFAULT NULL,
    p_marked_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_att_id UUID;
    v_status TEXT := LOWER(TRIM(p_status));
    v_marker UUID := COALESCE(p_marked_by, auth.uid());
    v_caller_role TEXT;
    v_is_classroom_teacher BOOLEAN := false;
    v_session_found BOOLEAN := false;
    v_sess_classification TEXT;
    v_sess_target_date DATE;
    v_existing RECORD;
    v_effective_on_behalf DATE;
    v_effective_is_extra BOOLEAN;
BEGIN
    -- 1. Authorization boundary
    IF current_user NOT IN ('postgres', 'supabase_admin') AND auth.role() != 'service_role' THEN
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'Unauthorized: Authentication required.';
        END IF;

        SELECT role INTO v_caller_role FROM public.users WHERE id = auth.uid();
        SELECT (teacher_id = auth.uid()) INTO v_is_classroom_teacher FROM public.classrooms WHERE id = p_classroom_id;

        IF (v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'super_admin'))
           AND COALESCE(v_is_classroom_teacher, false) = false THEN
            RAISE EXCEPTION 'Unauthorized: Caller cannot mark attendance for this classroom.';
        END IF;
    END IF;

    -- 2. Validate status
    IF v_status NOT IN ('present', 'absent', 'late', 'excused') THEN
        RAISE EXCEPTION 'Invalid attendance status: %', p_status;
    END IF;

    -- 3. Strict Session ID Validation: Reject mismatches
    IF p_session_id IS NOT NULL THEN
        SELECT true, session_classification, target_scheduled_date
        INTO v_session_found, v_sess_classification, v_sess_target_date
        FROM public.classroom_session_logs
        WHERE id = p_session_id
          AND classroom_id = p_classroom_id
          AND session_date = p_date;

        IF NOT FOUND THEN
            -- Check detailed mismatch reason for clear diagnostic exception
            IF NOT EXISTS (SELECT 1 FROM public.classroom_session_logs WHERE id = p_session_id) THEN
                RAISE EXCEPTION 'Session not found: %', p_session_id;
            ELSIF NOT EXISTS (SELECT 1 FROM public.classroom_session_logs WHERE id = p_session_id AND classroom_id = p_classroom_id) THEN
                RAISE EXCEPTION 'Session % does not belong to classroom %', p_session_id, p_classroom_id;
            ELSE
                RAISE EXCEPTION 'Session date does not match attendance date %', p_date;
            END IF;
        END IF;
    END IF;

    -- 4. Target record identification with Concurrency Lock (FOR UPDATE)
    IF p_session_id IS NOT NULL THEN
        SELECT * INTO v_existing
        FROM public.attendance
        WHERE session_id = p_session_id AND student_id = p_student_id
        FOR UPDATE;
        
        -- Fallback: link existing unlinked daily record on same date ONLY IF NO other session exists
        IF v_existing.id IS NULL THEN
            SELECT * INTO v_existing
            FROM public.attendance
            WHERE classroom_id = p_classroom_id AND student_id = p_student_id AND date = p_date AND session_id IS NULL
            FOR UPDATE;
        END IF;
    ELSE
        -- Administrative daily write (p_session_id IS NULL)
        -- First look for a record that already has session_id IS NULL
        SELECT * INTO v_existing
        FROM public.attendance
        WHERE classroom_id = p_classroom_id AND student_id = p_student_id AND date = p_date AND session_id IS NULL
        FOR UPDATE;

        -- If none, check if there is an existing session record on that date to update
        IF v_existing.id IS NULL THEN
            SELECT * INTO v_existing
            FROM public.attendance
            WHERE classroom_id = p_classroom_id AND student_id = p_student_id AND date = p_date
            ORDER BY created_at ASC
            LIMIT 1
            FOR UPDATE;
        END IF;
    END IF;

    -- 5. Field Preservation & Derivation Logic:
    IF v_existing.id IS NOT NULL THEN
        v_effective_on_behalf := COALESCE(p_on_behalf_of_date, v_existing.on_behalf_of_date);
        v_effective_is_extra := COALESCE(p_is_extra_class, v_existing.is_extra_class, false);

        UPDATE public.attendance
        SET status = v_status,
            session_id = COALESCE(p_session_id, attendance.session_id),
            on_behalf_of_date = v_effective_on_behalf,
            is_extra_class = v_effective_is_extra,
            marked_by = v_marker
        WHERE id = v_existing.id;

        v_att_id := v_existing.id;
    ELSE
        v_effective_on_behalf := p_on_behalf_of_date;
        v_effective_is_extra := COALESCE(p_is_extra_class, false);

        -- Derive classification from session log if caller did not explicitly specify
        IF p_session_id IS NOT NULL AND v_session_found THEN
            IF v_sess_classification = 'extra' AND p_is_extra_class IS NULL THEN
                v_effective_is_extra := true;
            END IF;
            IF v_sess_classification = 'on_behalf_of' AND p_on_behalf_of_date IS NULL THEN
                v_effective_on_behalf := v_sess_target_date;
            END IF;
        END IF;

        INSERT INTO public.attendance (
            classroom_id,
            student_id,
            date,
            session_id,
            status,
            on_behalf_of_date,
            is_extra_class,
            marked_by
        ) VALUES (
            p_classroom_id,
            p_student_id,
            p_date,
            p_session_id,
            v_status,
            v_effective_on_behalf,
            v_effective_is_extra,
            v_marker
        )
        ON CONFLICT (classroom_id, student_id, date, session_id) DO UPDATE
        SET status = EXCLUDED.status,
            on_behalf_of_date = COALESCE(EXCLUDED.on_behalf_of_date, attendance.on_behalf_of_date),
            is_extra_class = COALESCE(EXCLUDED.is_extra_class, attendance.is_extra_class),
            marked_by = EXCLUDED.marked_by
        RETURNING id INTO v_att_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'id', v_att_id, 'status', v_status);
END;
$$;
