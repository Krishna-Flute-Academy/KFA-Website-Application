-- =====================================================================================
-- KFA Migration: Extend Makeup Minimum Window to Subsequent Billing Cycle
-- Version: 20261105113000
-- =====================================================================================
-- Purpose:
-- 1. Update public.calculate_student_next_due_date(UUID, DATE) to ensure that students
--    who miss a class near the end of their billing cycle (within 14 days of due date,
--    such as Oct 31 with due date Nov 1) do not have their makeup entitlement expire in 24 hours.
-- 2. If (v_due_date - p_missed_date) < 14 days, the due date advances to the subsequent
--    billing cycle, ensuring a fair window (at least ~30-45 days) to attend makeup sessions.
-- =====================================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.calculate_student_next_due_date(
    p_student_id UUID,
    p_missed_date DATE
)
RETURNS DATE
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user public.users%ROWTYPE;
    v_col_day INTEGER;
    v_missed_year INTEGER;
    v_missed_month INTEGER;
    v_missed_day INTEGER;
    v_target_year INTEGER;
    v_target_month INTEGER;
    v_clamped_day INTEGER;
    v_days_in_target_month INTEGER;
    v_due_date DATE;
BEGIN
    SELECT * INTO v_user FROM public.users WHERE id = p_student_id;
    IF NOT FOUND THEN
        v_col_day := 1;
    ELSE
        -- Fall back to join-date day, then 1 (never arbitrary default 10)
        v_col_day := COALESCE(
            v_user.fees_collection_date,
            EXTRACT(DAY FROM COALESCE(v_user.join_date, CURRENT_DATE))::integer,
            1
        );
        IF v_col_day < 1 OR v_col_day > 31 THEN
            v_col_day := 1;
        END IF;
    END IF;

    v_missed_year := EXTRACT(YEAR FROM p_missed_date)::integer;
    v_missed_month := EXTRACT(MONTH FROM p_missed_date)::integer;
    v_missed_day := EXTRACT(DAY FROM p_missed_date)::integer;

    -- If missed day is on or after collection day, next due date is in the NEXT month.
    -- If missed day is before collection day, next due date is in the CURRENT month.
    IF v_missed_day >= v_col_day THEN
        v_target_month := v_missed_month + 1;
        v_target_year := v_missed_year;
        IF v_target_month > 12 THEN
            v_target_month := 1;
            v_target_year := v_target_year + 1;
        END IF;
    ELSE
        v_target_month := v_missed_month;
        v_target_year := v_missed_year;
    END IF;

    -- Calculate days in target month to clamp collection day if needed (e.g. Feb 28/29, Apr 30)
    v_days_in_target_month := EXTRACT(DAY FROM (make_date(v_target_year, v_target_month, 1) + interval '1 month - 1 day'))::integer;
    v_clamped_day := LEAST(v_col_day, v_days_in_target_month);
    v_due_date := make_date(v_target_year, v_target_month, v_clamped_day);

    -- Guarantee minimum makeup window:
    -- If the raw calculated next due date is within 14 days of the missed class
    -- (e.g. student missed class near the end of their billing cycle, such as Oct 31 with due date Nov 1),
    -- advance the due date to the subsequent billing cycle so the student has a fair window to attend makeup.
    IF (v_due_date - p_missed_date) < 14 THEN
        v_target_month := v_target_month + 1;
        IF v_target_month > 12 THEN
            v_target_month := 1;
            v_target_year := v_target_year + 1;
        END IF;
        v_days_in_target_month := EXTRACT(DAY FROM (make_date(v_target_year, v_target_month, 1) + interval '1 month - 1 day'))::integer;
        v_clamped_day := LEAST(v_col_day, v_days_in_target_month);
        v_due_date := make_date(v_target_year, v_target_month, v_clamped_day);
    END IF;

    RETURN v_due_date;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_student_next_due_date(UUID, DATE) TO authenticated, service_role, postgres;

COMMIT;
