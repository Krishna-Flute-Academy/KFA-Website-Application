-- ============================================================================
-- Migration: 20261029110000_fix_attendance_fees_trigger_complimentary_and_makeup.sql
-- Description: Fix BUG-01 (Complimentary classes deducting credits) and BUG-02 (Makeup double deduction)
-- Target: Staging Only (Additive, Safe, Non-Breaking)
-- Conforms to Master Business Requirements v1.1 & Attendance Invariants
-- Phase 1D Preflight: Strict Schema Compatibility (INTEGER credit_deducted)
-- & Enforced Makeup Identity Integrity (No Silent Chargeable Fallback)
-- ============================================================================

-- 1. Ensure durable deduction tracking column exists on public.attendance (INTEGER type matching staging schema)
ALTER TABLE public.attendance
    ADD COLUMN IF NOT EXISTS credit_deducted INTEGER NOT NULL DEFAULT 0;

-- Safety: Guarantee no NULL values exist in credit_deducted while preserving authentic historical deductions
UPDATE public.attendance
SET credit_deducted = 0
WHERE credit_deducted IS NULL;

-- Index for high-efficiency querying of deduction state
CREATE INDEX IF NOT EXISTS idx_attendance_student_deducted 
    ON public.attendance(student_id, credit_deducted);

-- 2. Enforce Makeup Identity: every makeup allocation must have an explicit original missed class date
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_makeup_override_has_missed_date'
    ) THEN
        ALTER TABLE public.session_student_overrides
            ADD CONSTRAINT chk_makeup_override_has_missed_date
            CHECK (
                credit_treatment IS DISTINCT FROM 'makeup' 
                OR missed_session_date IS NOT NULL 
                OR (reason IS NOT NULL AND reason ~ '\[MissedDate:[0-9]{4}-[0-9]{2}-[0-9]{2}\]')
                OR COALESCE(created_at, override_date::timestamptz) < '2026-10-28 00:00:00+00'::timestamptz
            );
    END IF;
END $$;


-- 3. Helper function: Determine whether an attendance event consumes credit
CREATE OR REPLACE FUNCTION public.is_attendance_chargeable(
    p_student_id UUID,
    p_classroom_id UUID,
    p_date DATE,
    p_status TEXT,
    p_on_behalf_of_date DATE DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
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
    v_has_approved_leave BOOLEAN;
    v_makeup_attended BOOLEAN;
    v_another_makeup_attended BOOLEAN := false;
BEGIN
    -- Rule 1: Non-credit consuming statuses (excused, unmarked, etc.) never consume credit
    IF p_status IS NULL OR LOWER(TRIM(p_status)) NOT IN ('present', 'late', 'absent') THEN
        RETURN FALSE;
    END IF;

    -- Rule 2: Check if classroom is a Complimentary Special Session / Temporary Class (BUG-01)
    SELECT c.type, tc.credit_treatment, tc.purpose
    INTO v_classroom_type, v_temp_credit_treatment, v_temp_purpose
    FROM public.classrooms c
    LEFT JOIN public.temporary_classes tc 
      ON (tc.classroom_id = c.id OR tc.id = c.id)
    WHERE c.id = p_classroom_id
    LIMIT 1;

    -- If the classroom is complimentary (or non-makeup temporary class with no explicit charge), it consumes 0 credit
    IF v_classroom_type = 'temporary' OR v_temp_credit_treatment IS NOT NULL OR v_temp_purpose IS NOT NULL THEN
        IF v_temp_credit_treatment = 'complimentary' 
           OR (v_temp_credit_treatment IS NULL AND v_temp_purpose IS NOT NULL AND v_temp_purpose NOT IN ('makeup', 'consume_credit')) THEN
            RETURN FALSE;
        END IF;
    END IF;

    -- Rule 3: Check if this session is a Makeup via session_student_overrides (BUG-02)
    SELECT id, credit_treatment, missed_session_date, reason
    INTO v_override
    FROM public.session_student_overrides
    WHERE student_id = p_student_id
      AND target_classroom_id = p_classroom_id
      AND override_date = p_date
    LIMIT 1;

    IF v_override.id IS NOT NULL THEN
        -- If override is explicitly complimentary, 0 credit
        IF v_override.credit_treatment = 'complimentary' THEN
            RETURN FALSE;
        END IF;

        -- If override is a makeup, resolve missed session date explicitly
        IF v_override.credit_treatment = 'makeup' OR v_temp_purpose = 'makeup' OR v_temp_credit_treatment = 'makeup' THEN
            v_missed_date := v_override.missed_session_date;
            
            -- Extract missed date from reason tag if missed_session_date column is null
            IF v_missed_date IS NULL AND v_override.reason IS NOT NULL THEN
                IF v_override.reason ~ '\[MissedDate:[0-9]{4}-[0-9]{2}-[0-9]{2}\]' THEN
                    v_missed_date := (SUBSTRING(v_override.reason FROM '\[MissedDate:([0-9]{4}-[0-9]{2}-[0-9]{2})\]'))::DATE;
                END IF;
            END IF;

            -- Fail-safe guard: A makeup MUST have an identifiable missed session date.
            -- Unmapped makeups must NOT be silently treated as ordinary chargeable sessions.
            IF v_missed_date IS NULL THEN
                RAISE EXCEPTION 'Unmapped makeup attendance: Student override on date % has credit_treatment = ''makeup'' but lacks an identifiable original missed class date. An explicit missed date is required.', p_date;
            END IF;

            -- Check if another makeup was ALREADY attended (present/late) for this same missed date!
            SELECT EXISTS (
                SELECT 1 
                FROM public.session_student_overrides o2
                JOIN public.attendance a2 
                  ON a2.student_id = o2.student_id 
                 AND a2.classroom_id = o2.target_classroom_id 
                 AND a2.date = o2.override_date
                WHERE o2.student_id = p_student_id
                  AND o2.id != v_override.id
                  AND (o2.missed_session_date = v_missed_date OR o2.reason LIKE '%[MissedDate:' || v_missed_date::text || ']%')
                  AND o2.override_date != p_date
                  AND a2.status IN ('present', 'late')
            ) INTO v_another_makeup_attended;

            -- If another makeup already fulfilled this missed date, this subsequent makeup must consume credit!
            IF NOT v_another_makeup_attended THEN
                -- Check whether attendance on the missed date was already credit-consuming
                SELECT status INTO v_missed_att_status
                FROM public.attendance
                WHERE student_id = p_student_id
                  AND date = v_missed_date
                LIMIT 1;

                -- Also check if student had approved leave on that missed date
                SELECT EXISTS (
                    SELECT 1 FROM public.leave_requests
                    WHERE student_id = p_student_id
                      AND class_date = v_missed_date
                      AND status = 'approved'
                ) INTO v_has_approved_leave;

                -- If the student was ALREADY marked absent/present/late on that missed date AND did not have approved leave,
                -- 1 credit was already deducted for that missed slot.
                -- Fulfilling it with this makeup must NOT deduct a second credit!
                IF v_missed_att_status IN ('present', 'late', 'absent') AND NOT COALESCE(v_has_approved_leave, false) THEN
                    RETURN FALSE;
                END IF;
            END IF;
        END IF;
    END IF;

    -- Rule 4: Check if this date is a missed date for which a makeup was ALREADY attended (BUG-02 Symmetrical Guard)
    -- If a student already attended a makeup for this date, marking absent here must NOT double-charge!
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

    -- Rule 5: Check if this date was already fulfilled by an On-Behalf-Of attendance
    -- If another attendance row exists with on_behalf_of_date = p_date for this student,
    -- this scheduled slot has already been fulfilled on that alternative date!
    IF EXISTS (
        SELECT 1 FROM public.attendance
        WHERE student_id = p_student_id
          AND on_behalf_of_date = p_date
          AND date != p_date
          AND status IN ('present', 'late', 'absent')
    ) THEN
        RETURN FALSE;
    END IF;

    -- Default: standard class attendance consumes 1 credit
    RETURN TRUE;
END;
$$;


-- 4. Updated Attendance Fees Synchronization Trigger Function (BEFORE Row Trigger)
CREATE OR REPLACE FUNCTION public.update_prepaid_classes_on_attendance()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_should_charge BOOLEAN := false;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_should_charge := public.is_attendance_chargeable(
            NEW.student_id, 
            NEW.classroom_id, 
            NEW.date, 
            NEW.status, 
            NEW.on_behalf_of_date
        );
        NEW.credit_deducted := CASE WHEN v_should_charge THEN 1 ELSE 0 END;

        IF NEW.credit_deducted > 0 THEN
            UPDATE public.users 
            SET fees_classes_paid = COALESCE(fees_classes_paid, 0) - 1 
            WHERE id = NEW.student_id;
        END IF;
        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        -- If status was already in an attended/absent state and remains in an attended/absent state,
        -- retain the existing credit_deducted flag to avoid phantom deductions/refunds on session reclassification
        IF (OLD.status IN ('present', 'late', 'absent') AND NEW.status IN ('present', 'late', 'absent')) THEN
            NEW.credit_deducted := OLD.credit_deducted;
        ELSE
            -- Status changed across category boundary (e.g. excused <-> present)
            v_should_charge := public.is_attendance_chargeable(
                NEW.student_id, 
                NEW.classroom_id, 
                NEW.date, 
                NEW.status, 
                NEW.on_behalf_of_date
            );
            NEW.credit_deducted := CASE WHEN v_should_charge THEN 1 ELSE 0 END;
        END IF;

        -- Apply balance deltas based strictly on credit_deducted transitions
        IF OLD.credit_deducted > 0 AND NEW.credit_deducted = 0 THEN
            -- Transition from deducted to not-deducted (e.g. excused): refund +1
            UPDATE public.users 
            SET fees_classes_paid = COALESCE(fees_classes_paid, 0) + OLD.credit_deducted 
            WHERE id = NEW.student_id;
        ELSIF OLD.credit_deducted = 0 AND NEW.credit_deducted > 0 THEN
            -- Transition from not-deducted to deducted: deduct -1
            UPDATE public.users 
            SET fees_classes_paid = COALESCE(fees_classes_paid, 0) - 1 
            WHERE id = NEW.student_id;
        END IF;
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        -- Refund ONLY if this record actually deducted a credit!
        IF OLD.credit_deducted > 0 THEN
            UPDATE public.users 
            SET fees_classes_paid = COALESCE(fees_classes_paid, 0) + OLD.credit_deducted 
            WHERE id = OLD.student_id;
        END IF;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

-- 5. Ensure trigger binding on public.attendance (BEFORE INSERT OR UPDATE OR DELETE)
DROP TRIGGER IF EXISTS trg_attendance_fees_sync ON public.attendance;
CREATE TRIGGER trg_attendance_fees_sync
    BEFORE INSERT OR UPDATE OR DELETE ON public.attendance
    FOR EACH ROW EXECUTE FUNCTION public.update_prepaid_classes_on_attendance();
