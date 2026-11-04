-- =====================================================================================
-- KFA Migration: Fix compute_attendance_credit() Signature & Idempotency
-- Version: 20261104181800
-- =====================================================================================
-- Purpose:
-- Fixes a regression in 20261104170000 where compute_attendance_credit() passed
-- arguments to public.is_attendance_chargeable() in the wrong order
-- (text, uuid, uuid, date, date instead of uuid, uuid, date, text, date) and
-- referenced a non-existent NEW.is_makeup column.
-- Restores the canonical (p_student_id, p_classroom_id, p_date, p_status, p_on_behalf_of_date)
-- call signature and UPDATE idempotency guard while preserving holiday alternative
-- auto-linkage on INSERT.
-- =====================================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.compute_attendance_credit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Auto-populate on_behalf_of_date if inserting on an active scheduled alternative date for this classroom
        IF NEW.on_behalf_of_date IS NULL AND NEW.classroom_id IS NOT NULL AND NEW.date IS NOT NULL THEN
            SELECT ch.holiday_date INTO NEW.on_behalf_of_date
            FROM public.classroom_holidays ch
            WHERE ch.classroom_id = NEW.classroom_id
              AND ch.alternative_date = NEW.date
              AND ch.status = 'active'
              AND ch.holiday_type IN ('with_alternative', 'alternative_scheduled')
            LIMIT 1;
        END IF;

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

COMMIT;
