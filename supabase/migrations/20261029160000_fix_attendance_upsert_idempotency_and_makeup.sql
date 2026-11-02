-- ==============================================================================
-- KFA Migration: 20261029160000_fix_attendance_upsert_idempotency_and_makeup.sql
-- Description: Phase 1E.1 Targeted Financial Defect Correction
--
-- 1. Fixes DEFECT-01 (Upsert Idempotency):
--    Splits attendance trigger into:
--    a) trg_attendance_compute_credit (BEFORE INSERT OR UPDATE): Computes and sets
--       NEW.credit_deducted (0 or 1). Zero DML against external tables.
--    b) trg_attendance_sync_fees (AFTER INSERT OR UPDATE OR DELETE): Synchronizes
--       public.users.fees_classes_paid. Because it is an AFTER trigger, PostgreSQL
--       never fires AFTER INSERT on conflicting rows that branch to DO UPDATE.
--       This completely resolves the duplicate credit deduction on repeat upserts.
--
-- 2. Fixes DEFECT-02 (Makeup Classification Guard):
--    Hardens public.is_attendance_chargeable() Rule 3 to evaluate makeup identity
--    robustly, matching credit_treatment = 'makeup' and explicit reason tags
--    '[MissedDate:YYYY-MM-DD]', ensuring an already charged unexcused absence
--    followed by a mapped makeup consumes 0 additional credits.
--
-- Preserves all existing historical attendance records and student balances.
-- Non-destructive, additive, idempotent migration.
-- ==============================================================================

-- 1. Hardened is_attendance_chargeable function
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

    -- Rule 2: Check if classroom is a Complimentary Special Session / Temporary Class (BUG-01)
    SELECT c.type, tc.credit_treatment, tc.purpose
    INTO v_classroom_type, v_temp_credit_treatment, v_temp_purpose
    FROM public.classrooms c
    LEFT JOIN public.temporary_classes tc 
      ON (tc.classroom_id = c.id OR tc.id = c.id)
    WHERE c.id = p_classroom_id
    LIMIT 1;

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

        -- Check if override is identified as a makeup (via credit_treatment, purpose, or reason tag)
        IF v_override.credit_treatment = 'makeup' 
           OR (v_override.reason IS NOT NULL AND v_override.reason ~ '\[MissedDate:[0-9]{4}-[0-9]{2}-[0-9]{2}\]')
           OR v_temp_purpose = 'makeup' 
           OR v_temp_credit_treatment = 'makeup' THEN
           
            v_missed_date := v_override.missed_session_date;
            
            -- Extract missed date from reason tag if missed_session_date column is null
            IF v_missed_date IS NULL AND v_override.reason IS NOT NULL THEN
                IF v_override.reason ~ '\[MissedDate:[0-9]{4}-[0-9]{2}-[0-9]{2}\]' THEN
                    v_missed_date := (SUBSTRING(v_override.reason FROM '\[MissedDate:([0-9]{4}-[0-9]{2}-[0-9]{2})\]'))::DATE;
                END IF;
            END IF;

            -- Fail-safe guard: A makeup MUST have an identifiable missed session date.
            IF v_missed_date IS NULL THEN
                RAISE EXCEPTION 'Unmapped makeup attendance: Student override on date % lacks an identifiable original missed class date.', p_date;
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
                SELECT status, credit_deducted 
                INTO v_missed_att_status, v_missed_credit_deducted
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

                -- If the student was ALREADY charged on that missed date (or marked unexcused absent without approved leave),
                -- 1 credit was already deducted for that missed slot.
                -- Fulfilling it with this makeup must NOT deduct a second credit!
                IF (COALESCE(v_missed_credit_deducted, 0) > 0) 
                   OR (v_missed_att_status IN ('present', 'late', 'absent') AND NOT COALESCE(v_has_approved_leave, false)) THEN
                    RETURN FALSE;
                END IF;
            END IF;
        END IF;
    END IF;

    -- Rule 4: Check if this date is a missed date for which a makeup was ALREADY attended (BUG-02 Symmetrical Guard)
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


-- 2. BEFORE Trigger Function: Computes and sets NEW.credit_deducted only
CREATE OR REPLACE FUNCTION public.compute_attendance_credit()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.credit_deducted := CASE 
            WHEN public.is_attendance_chargeable(
                NEW.student_id, 
                NEW.classroom_id, 
                NEW.date, 
                NEW.status, 
                NEW.on_behalf_of_date
            ) THEN 1 
            ELSE 0 
        END;
        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        -- If status was already in an attended/absent state and remains in an attended/absent state,
        -- retain the persisted credit_deducted flag to avoid phantom deductions/refunds
        IF (OLD.status IN ('present', 'late', 'absent') AND NEW.status IN ('present', 'late', 'absent')) THEN
            NEW.credit_deducted := OLD.credit_deducted;
        ELSE
            -- Status changed across category boundary (e.g. excused <-> present)
            NEW.credit_deducted := CASE 
                WHEN public.is_attendance_chargeable(
                    NEW.student_id, 
                    NEW.classroom_id, 
                    NEW.date, 
                    NEW.status, 
                    NEW.on_behalf_of_date
                ) THEN 1 
                ELSE 0 
            END;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$;


-- 3. AFTER Trigger Function: Synchronizes users.fees_classes_paid balance deltas
CREATE OR REPLACE FUNCTION public.sync_attendance_fees()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Only fires if the row was ACTUALLY inserted (never fires on conflicting rows)
        IF NEW.credit_deducted > 0 THEN
            UPDATE public.users 
            SET fees_classes_paid = COALESCE(fees_classes_paid, 0) - NEW.credit_deducted 
            WHERE id = NEW.student_id;
        END IF;
        RETURN NULL;

    ELSIF TG_OP = 'UPDATE' THEN
        -- Apply balance deltas based strictly on persisted credit_deducted transitions
        IF OLD.credit_deducted > 0 AND NEW.credit_deducted = 0 THEN
            -- Transition from deducted to not-deducted (e.g. present -> excused): refund
            UPDATE public.users 
            SET fees_classes_paid = COALESCE(fees_classes_paid, 0) + OLD.credit_deducted 
            WHERE id = NEW.student_id;
        ELSIF OLD.credit_deducted = 0 AND NEW.credit_deducted > 0 THEN
            -- Transition from not-deducted to deducted (e.g. excused -> present): deduct
            UPDATE public.users 
            SET fees_classes_paid = COALESCE(fees_classes_paid, 0) - NEW.credit_deducted 
            WHERE id = NEW.student_id;
        END IF;
        RETURN NULL;

    ELSIF TG_OP = 'DELETE' THEN
        -- Refund ONLY if this record actually deducted a credit!
        IF OLD.credit_deducted > 0 THEN
            UPDATE public.users 
            SET fees_classes_paid = COALESCE(fees_classes_paid, 0) + OLD.credit_deducted 
            WHERE id = OLD.student_id;
        END IF;
        RETURN NULL;
    END IF;
    RETURN NULL;
END;
$$;


-- 4. Replace single BEFORE trigger with separated BEFORE & AFTER triggers
DROP TRIGGER IF EXISTS trg_attendance_fees_sync ON public.attendance;
DROP TRIGGER IF EXISTS trg_attendance_compute_credit ON public.attendance;
DROP TRIGGER IF EXISTS trg_attendance_sync_fees ON public.attendance;

-- Trigger A: BEFORE INSERT OR UPDATE computes NEW.credit_deducted
CREATE TRIGGER trg_attendance_compute_credit
BEFORE INSERT OR UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.compute_attendance_credit();

-- Trigger B: AFTER INSERT OR UPDATE OR DELETE syncs users.fees_classes_paid
CREATE TRIGGER trg_attendance_sync_fees
AFTER INSERT OR UPDATE OR DELETE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.sync_attendance_fees();
