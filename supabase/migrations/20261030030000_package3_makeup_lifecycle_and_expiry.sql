-- Migration: Package 3 - Makeup Entitlement Lifecycle & Expiry
-- Local PostgreSQL 17 Implementation

-- 1. Add booking_status and original_classroom_id columns to session_student_overrides
ALTER TABLE public.session_student_overrides
ADD COLUMN IF NOT EXISTS booking_status TEXT NOT NULL DEFAULT 'scheduled',
ADD COLUMN IF NOT EXISTS original_classroom_id UUID REFERENCES public.classrooms(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Ensure valid booking_status values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_session_student_overrides_booking_status'
    ) THEN
        ALTER TABLE public.session_student_overrides
        ADD CONSTRAINT chk_session_student_overrides_booking_status
        CHECK (booking_status IN ('scheduled', 'completed', 'forfeited', 'cancelled', 'expired'));
    END IF;
END $$;

-- Classify historical records based on recorded attendance outcome
UPDATE public.session_student_overrides o
SET booking_status = 'completed'
FROM public.attendance a
WHERE a.student_id = o.student_id
  AND a.classroom_id = o.target_classroom_id
  AND a.date = o.override_date
  AND a.status IN ('present', 'late')
  AND o.booking_status = 'scheduled';

UPDATE public.session_student_overrides o
SET booking_status = 'forfeited'
FROM public.attendance a
WHERE a.student_id = o.student_id
  AND a.classroom_id = o.target_classroom_id
  AND a.date = o.override_date
  AND a.status = 'absent'
  AND o.booking_status = 'scheduled';

-- 2. Create partial unique index: exactly one active booking per original missed session
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_student_overrides_single_active_makeup
ON public.session_student_overrides (
    student_id,
    missed_session_date,
    COALESCE(original_classroom_id, '00000000-0000-0000-0000-000000000000'::uuid)
)
WHERE credit_treatment = 'makeup' AND booking_status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_session_student_overrides_booking_status
ON public.session_student_overrides (booking_status);

CREATE INDEX IF NOT EXISTS idx_session_student_overrides_original_classroom
ON public.session_student_overrides (original_classroom_id);

-- 3. Calculate Student Next Billing Due Date in Asia/Kolkata
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
BEGIN
    SELECT * INTO v_user FROM public.users WHERE id = p_student_id;
    IF NOT FOUND THEN
        v_col_day := 10;
    ELSE
        v_col_day := COALESCE(v_user.fees_collection_date, 10);
        IF v_col_day < 1 OR v_col_day > 31 THEN
            v_col_day := 10;
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

    -- Calculate days in target month to clamp collection day if needed (e.g. Feb 28, Apr 30)
    v_days_in_target_month := EXTRACT(DAY FROM (make_date(v_target_year, v_target_month, 1) + interval '1 month - 1 day'))::integer;
    v_clamped_day := LEAST(v_col_day, v_days_in_target_month);

    RETURN make_date(v_target_year, v_target_month, v_clamped_day);
END;
$$;

-- 4. Validation Trigger on session_student_overrides
CREATE OR REPLACE FUNCTION public.enforce_session_student_override_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_next_due_date DATE;
    v_orig_class_id UUID;
BEGIN
    -- Validate credit_treatment
    IF NEW.credit_treatment IS NOT NULL AND NEW.credit_treatment NOT IN ('makeup', 'complimentary', 'consume_credit') THEN
        RAISE EXCEPTION 'Invalid credit_treatment: %', NEW.credit_treatment USING ERRCODE = '22023';
    END IF;

    -- Validate booking_status
    IF NEW.booking_status IS NULL THEN
        NEW.booking_status := 'scheduled';
    ELSIF NEW.booking_status NOT IN ('scheduled', 'completed', 'forfeited', 'cancelled', 'expired') THEN
        RAISE EXCEPTION 'Invalid booking_status: %', NEW.booking_status USING ERRCODE = '22023';
    END IF;

    -- Makeup-specific validations
    IF NEW.credit_treatment = 'makeup' THEN
        -- Extract missed_session_date from reason tag if null
        IF NEW.missed_session_date IS NULL AND NEW.reason IS NOT NULL THEN
            IF NEW.reason ~ '\[MissedDate:[0-9]{4}-[0-9]{2}-[0-9]{2}\]' THEN
                NEW.missed_session_date := (SUBSTRING(NEW.reason FROM '\[MissedDate:([0-9]{4}-[0-9]{2}-[0-9]{2})\]'))::DATE;
            END IF;
        END IF;

        IF NEW.missed_session_date IS NULL THEN
            RAISE EXCEPTION 'Makeup entitlement requires an identifiable missed session date.' USING ERRCODE = '22023';
        END IF;

        -- Auto-populate original_classroom_id if null
        IF NEW.original_classroom_id IS NULL THEN
            SELECT classroom_id INTO v_orig_class_id
            FROM public.attendance
            WHERE student_id = NEW.student_id AND date = NEW.missed_session_date
            LIMIT 1;

            IF v_orig_class_id IS NULL THEN
                SELECT classroom_id INTO v_orig_class_id
                FROM public.leave_requests
                WHERE student_id = NEW.student_id AND class_date = NEW.missed_session_date
                LIMIT 1;
            END IF;

            IF v_orig_class_id IS NOT NULL THEN
                NEW.original_classroom_id := v_orig_class_id;
            END IF;
        END IF;

        -- Validate billing cycle expiry (Asia/Kolkata):
        -- Actual makeup class date must be strictly before that due date
        v_next_due_date := public.calculate_student_next_due_date(NEW.student_id, NEW.missed_session_date);
        IF v_next_due_date IS NOT NULL AND NEW.override_date >= v_next_due_date THEN
            RAISE EXCEPTION 'Makeup date % must be strictly before student next billing due date % (Asia/Kolkata)',
                NEW.override_date, v_next_due_date USING ERRCODE = '22023';
        END IF;

        -- Guard terminal state transitions on direct UPDATE (allow trigger-depth sync if attendance is corrected)
        IF TG_OP = 'UPDATE' AND pg_trigger_depth() <= 1 THEN
            IF OLD.booking_status = 'completed' AND NEW.booking_status NOT IN ('completed') THEN
                RAISE EXCEPTION 'Invalid transition: completed makeup booking cannot be reopened or changed' USING ERRCODE = '22023';
            END IF;
            IF OLD.booking_status = 'forfeited' AND NEW.booking_status NOT IN ('forfeited') THEN
                RAISE EXCEPTION 'Invalid transition: forfeited makeup booking cannot be reopened or changed' USING ERRCODE = '22023';
            END IF;
            IF OLD.booking_status = 'expired' AND NEW.booking_status NOT IN ('expired') THEN
                RAISE EXCEPTION 'Invalid transition: expired makeup booking cannot be reopened or changed' USING ERRCODE = '22023';
            END IF;
        END IF;
    END IF;

    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_session_student_override_rules ON public.session_student_overrides;
CREATE TRIGGER trg_enforce_session_student_override_rules
BEFORE INSERT OR UPDATE ON public.session_student_overrides
FOR EACH ROW EXECUTE FUNCTION public.enforce_session_student_override_rules();

-- 5. Trigger to synchronize attendance outcomes to session_student_overrides booking_status
CREATE OR REPLACE FUNCTION public.sync_attendance_makeup_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.status IN ('present', 'late') THEN
            UPDATE public.session_student_overrides
            SET booking_status = 'completed',
                updated_at = now()
            WHERE target_classroom_id = NEW.classroom_id
              AND student_id = NEW.student_id
              AND override_date = NEW.date
              AND booking_status IN ('scheduled', 'forfeited');
        ELSIF NEW.status = 'absent' THEN
            UPDATE public.session_student_overrides
            SET booking_status = 'forfeited',
                updated_at = now()
            WHERE target_classroom_id = NEW.classroom_id
              AND student_id = NEW.student_id
              AND override_date = NEW.date
              AND booking_status IN ('scheduled', 'completed');
        END IF;
    END IF;
    -- Note: Terminal statuses ('completed', 'forfeited') are strictly non-reopenable.
    -- Deletion of an attendance record NEVER reopens an entitlement automatically.
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_sync_makeup_status ON public.attendance;
CREATE TRIGGER trg_attendance_sync_makeup_status
AFTER INSERT OR UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.sync_attendance_makeup_status();

-- 6. Authoritative Makeup Booking RPC
CREATE OR REPLACE FUNCTION public.book_makeup_session(
    p_student_id UUID,
    p_target_classroom_id UUID,
    p_override_date DATE,
    p_missed_session_date DATE,
    p_original_classroom_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS public.session_student_overrides
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_existing_status TEXT;
    v_next_due_date DATE;
    v_orig_classroom_id UUID := p_original_classroom_id;
    v_reason TEXT;
    v_override public.session_student_overrides%ROWTYPE;
BEGIN
    -- 1. Authorization check
    IF v_caller_id IS NOT NULL THEN
        SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
        IF v_caller_role NOT IN ('admin', 'teacher') THEN
            RAISE EXCEPTION 'Unauthorized: only teachers or admins can book makeup sessions.' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 2. Validate input parameters
    IF p_student_id IS NULL OR p_target_classroom_id IS NULL OR p_override_date IS NULL OR p_missed_session_date IS NULL THEN
        RAISE EXCEPTION 'Missing required parameters for makeup booking' USING ERRCODE = '22023';
    END IF;

    -- 3. Resolve original classroom if omitted
    IF v_orig_classroom_id IS NULL THEN
        SELECT classroom_id INTO v_orig_classroom_id
        FROM public.attendance
        WHERE student_id = p_student_id AND date = p_missed_session_date
        LIMIT 1;

        IF v_orig_classroom_id IS NULL THEN
            SELECT classroom_id INTO v_orig_classroom_id
            FROM public.leave_requests
            WHERE student_id = p_student_id AND class_date = p_missed_session_date
            LIMIT 1;
        END IF;
    END IF;

    -- 4. Check if entitlement was already completed or forfeited
    SELECT booking_status INTO v_existing_status
    FROM public.session_student_overrides
    WHERE student_id = p_student_id
      AND missed_session_date = p_missed_session_date
      AND (v_orig_classroom_id IS NULL OR original_classroom_id IS NULL OR original_classroom_id = v_orig_classroom_id)
      AND booking_status IN ('completed', 'forfeited', 'expired')
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_status = 'completed' THEN
        RAISE EXCEPTION 'Cannot book makeup: entitlement for missed session % has already been completed.', p_missed_session_date
            USING ERRCODE = '23514';
    ELSIF v_existing_status = 'forfeited' THEN
        RAISE EXCEPTION 'Cannot book makeup: entitlement for missed session % has been forfeited.', p_missed_session_date
            USING ERRCODE = '23514';
    ELSIF v_existing_status = 'expired' THEN
        RAISE EXCEPTION 'Cannot book makeup: entitlement for missed session % has expired.', p_missed_session_date
            USING ERRCODE = '23514';
    END IF;

    -- 5. Check if an active booking already exists
    IF EXISTS (
        SELECT 1 FROM public.session_student_overrides
        WHERE student_id = p_student_id
          AND missed_session_date = p_missed_session_date
          AND (v_orig_classroom_id IS NULL OR original_classroom_id IS NULL OR original_classroom_id = v_orig_classroom_id)
          AND booking_status = 'scheduled'
    ) THEN
        RAISE EXCEPTION 'Cannot book makeup: an active makeup booking already exists for missed session %.', p_missed_session_date
            USING ERRCODE = '23505';
    END IF;

    -- 6. Billing-Cycle Expiry check (Asia/Kolkata)
    v_next_due_date := public.calculate_student_next_due_date(p_student_id, p_missed_session_date);
    IF v_next_due_date IS NOT NULL AND p_override_date >= v_next_due_date THEN
        RAISE EXCEPTION 'Makeup date % must be strictly before student next billing due date % (Asia/Kolkata)',
            p_override_date, v_next_due_date USING ERRCODE = '22023';
    END IF;

    -- 7. Construct reason tag
    v_reason := '[MissedDate:' || p_missed_session_date::text || '] ' || COALESCE(p_notes, 'Temporary makeup attendance');

    -- 8. Insert booking record atomically
    INSERT INTO public.session_student_overrides (
        student_id,
        target_classroom_id,
        override_date,
        missed_session_date,
        original_classroom_id,
        credit_treatment,
        booking_status,
        reason
    ) VALUES (
        p_student_id,
        p_target_classroom_id,
        p_override_date,
        p_missed_session_date,
        v_orig_classroom_id,
        'makeup',
        'scheduled',
        v_reason
    )
    RETURNING * INTO v_override;

    RETURN v_override;
END;
$$;

-- 7. Authoritative Rescheduling RPC
CREATE OR REPLACE FUNCTION public.reschedule_makeup_session(
    p_override_id UUID,
    p_new_target_classroom_id UUID,
    p_new_override_date DATE,
    p_notes TEXT DEFAULT NULL
)
RETURNS public.session_student_overrides
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_override public.session_student_overrides%ROWTYPE;
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_next_due_date DATE;
    v_reason TEXT;
BEGIN
    -- 1. Authorization check
    IF v_caller_id IS NOT NULL THEN
        SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
        IF v_caller_role NOT IN ('admin', 'teacher') THEN
            RAISE EXCEPTION 'Unauthorized: only teachers or admins can reschedule makeup sessions.' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 2. Lock override row
    SELECT * INTO v_override
    FROM public.session_student_overrides
    WHERE id = p_override_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Makeup override not found: %', p_override_id USING ERRCODE = 'P0002';
    END IF;

    -- 3. Only scheduled bookings can be rescheduled
    IF v_override.booking_status <> 'scheduled' THEN
        RAISE EXCEPTION 'Cannot reschedule makeup with status: % (only scheduled bookings can be rescheduled)',
            v_override.booking_status USING ERRCODE = '22023';
    END IF;

    -- 4. Expiry check on new date
    v_next_due_date := public.calculate_student_next_due_date(v_override.student_id, v_override.missed_session_date);
    IF v_next_due_date IS NOT NULL AND p_new_override_date >= v_next_due_date THEN
        RAISE EXCEPTION 'Makeup date % must be strictly before student next billing due date % (Asia/Kolkata)',
            p_new_override_date, v_next_due_date USING ERRCODE = '22023';
    END IF;

    v_reason := '[MissedDate:' || v_override.missed_session_date::text || '] ' || COALESCE(p_notes, 'Rescheduled makeup session');

    -- 5. Update in-place atomically
    UPDATE public.session_student_overrides
    SET target_classroom_id = p_new_target_classroom_id,
        override_date = p_new_override_date,
        reason = v_reason,
        updated_at = now()
    WHERE id = p_override_id
    RETURNING * INTO v_override;

    RETURN v_override;
END;
$$;

-- 8. Authoritative Cancellation RPC
CREATE OR REPLACE FUNCTION public.cancel_makeup_session(
    p_override_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS public.session_student_overrides
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_override public.session_student_overrides%ROWTYPE;
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
BEGIN
    -- 1. Authorization check
    IF v_caller_id IS NOT NULL THEN
        SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
        IF v_caller_role NOT IN ('admin', 'teacher') THEN
            RAISE EXCEPTION 'Unauthorized: only teachers or admins can cancel makeup sessions.' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 2. Lock row
    SELECT * INTO v_override
    FROM public.session_student_overrides
    WHERE id = p_override_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Makeup override not found: %', p_override_id USING ERRCODE = 'P0002';
    END IF;

    IF v_override.booking_status <> 'scheduled' THEN
        RAISE EXCEPTION 'Cannot cancel makeup with status: % (only scheduled bookings can be cancelled)',
            v_override.booking_status USING ERRCODE = '22023';
    END IF;

    -- 3. Cancel booking (retains record for audit history, zero credit deducted)
    UPDATE public.session_student_overrides
    SET booking_status = 'cancelled',
        reason = COALESCE(reason, '') || ' [Cancelled: ' || COALESCE(p_reason, 'User cancelled') || ']',
        updated_at = now()
    WHERE id = p_override_id
    RETURNING * INTO v_override;

    RETURN v_override;
END;
$$;

-- 9. Automatic Expiry of Stale Unattended Makeups
CREATE OR REPLACE FUNCTION public.expire_stale_makeup_bookings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    UPDATE public.session_student_overrides o
    SET booking_status = 'expired',
        updated_at = now()
    WHERE o.credit_treatment = 'makeup'
      AND o.booking_status = 'scheduled'
      AND (
          (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE > o.override_date
          OR (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE >= public.calculate_student_next_due_date(o.student_id, o.missed_session_date)
      )
      AND NOT EXISTS (
          SELECT 1 FROM public.attendance a
          WHERE a.student_id = o.student_id
            AND a.classroom_id = o.target_classroom_id
            AND a.date = o.override_date
      );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- 10. Privileges & Grants
REVOKE ALL ON FUNCTION public.book_makeup_session(UUID, UUID, DATE, DATE, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reschedule_makeup_session(UUID, UUID, DATE, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_makeup_session(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_stale_makeup_bookings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calculate_student_next_due_date(UUID, DATE) FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT EXECUTE ON FUNCTION public.book_makeup_session(UUID, UUID, DATE, DATE, UUID, TEXT) TO authenticated;
        GRANT EXECUTE ON FUNCTION public.reschedule_makeup_session(UUID, UUID, DATE, TEXT) TO authenticated;
        GRANT EXECUTE ON FUNCTION public.cancel_makeup_session(UUID, TEXT) TO authenticated;
        GRANT EXECUTE ON FUNCTION public.expire_stale_makeup_bookings() TO authenticated;
        GRANT EXECUTE ON FUNCTION public.calculate_student_next_due_date(UUID, DATE) TO authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT EXECUTE ON FUNCTION public.book_makeup_session(UUID, UUID, DATE, DATE, UUID, TEXT) TO service_role;
        GRANT EXECUTE ON FUNCTION public.reschedule_makeup_session(UUID, UUID, DATE, TEXT) TO service_role;
        GRANT EXECUTE ON FUNCTION public.cancel_makeup_session(UUID, TEXT) TO service_role;
        GRANT EXECUTE ON FUNCTION public.expire_stale_makeup_bookings() TO service_role;
        GRANT EXECUTE ON FUNCTION public.calculate_student_next_due_date(UUID, DATE) TO service_role;
    END IF;
END $$;
