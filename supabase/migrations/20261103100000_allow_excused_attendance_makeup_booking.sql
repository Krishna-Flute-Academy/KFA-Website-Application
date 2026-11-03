-- Migration: Allow Excused Attendance -> Makeup Booking & Display Student Name in Errors
-- Date: 2026-11-03
-- Purpose:
--   1. Allow teachers/admins to book a makeup session when original attendance is 'excused', even without an approved leave request.
--   2. Preserve existing approved leave pathway.
--   3. Backend authorization & eligibility checks preserved in both RPC (book_makeup_session) and trigger (enforce_session_student_override_rules).
--   4. Prevent duplicate bookings (advisory lock + active/terminal check preserved).
--   5. Credit consumption, due-date expiry, and ledger symmetry preserved.
--   6. Replace student UUID with student display name in user-facing error messages.

-- ------------------------------------------------------------------------------
-- 1. Update book_makeup_session RPC
-- ------------------------------------------------------------------------------
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
    v_leave_id UUID;
    v_leave_classroom_id UUID;
    v_att_classroom_id UUID;
    v_orig_classroom_id UUID := p_original_classroom_id;
    v_target_room_name TEXT;
    v_student_name TEXT;
    v_reason TEXT;
    v_override public.session_student_overrides%ROWTYPE;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or admins can book makeup sessions.' USING ERRCODE = '42501';
    END IF;

    IF p_student_id IS NULL OR p_target_classroom_id IS NULL OR p_override_date IS NULL OR p_missed_session_date IS NULL THEN
        RAISE EXCEPTION 'Missing required parameters for booking makeup session' USING ERRCODE = '22023';
    END IF;

    -- Concurrency control: Lock on (student_id, missed_session_date)
    PERFORM pg_advisory_xact_lock(hashtext('makeup_' || p_student_id::text || '_' || p_missed_session_date::text)::bigint);

    -- Fetch student display name for clear user-facing error reporting
    SELECT name INTO v_student_name FROM public.users WHERE id = p_student_id;

    -- Check for approved original leave
    SELECT id, classroom_id INTO v_leave_id, v_leave_classroom_id
    FROM public.leave_requests
    WHERE student_id = p_student_id
      AND class_date = p_missed_session_date
      AND status = 'approved'
    FOR UPDATE;

    -- Check for excused attendance (supporting both direct date and on_behalf_of_date)
    SELECT classroom_id INTO v_att_classroom_id
    FROM public.attendance
    WHERE student_id = p_student_id
      AND COALESCE(on_behalf_of_date, date) = p_missed_session_date
      AND status = 'excused'
    LIMIT 1;

    -- Eligibility check: Must have approved leave request OR excused attendance
    IF v_leave_id IS NULL AND v_att_classroom_id IS NULL THEN
        RAISE EXCEPTION 'Cannot book makeup: No approved leave request found for student % on date %',
            COALESCE(v_student_name, p_student_id::text), p_missed_session_date USING ERRCODE = '22023';
    END IF;

    -- Resolve and validate original classroom
    IF v_leave_id IS NOT NULL THEN
        IF v_orig_classroom_id IS NOT NULL AND v_leave_classroom_id IS NOT NULL AND v_orig_classroom_id <> v_leave_classroom_id THEN
            RAISE EXCEPTION 'Cannot book makeup: original classroom % does not match approved leave classroom %',
                v_orig_classroom_id, v_leave_classroom_id USING ERRCODE = '22023';
        END IF;

        IF v_orig_classroom_id IS NULL THEN
            v_orig_classroom_id := v_leave_classroom_id;
        END IF;
    ELSE
        -- Excused attendance pathway
        IF v_orig_classroom_id IS NOT NULL AND v_att_classroom_id IS NOT NULL AND v_orig_classroom_id <> v_att_classroom_id THEN
            RAISE EXCEPTION 'Cannot book makeup: original classroom % does not match excused attendance classroom %',
                v_orig_classroom_id, v_att_classroom_id USING ERRCODE = '22023';
        END IF;

        IF v_orig_classroom_id IS NULL THEN
            v_orig_classroom_id := v_att_classroom_id;
        END IF;
    END IF;

    -- Terminal state check
    SELECT booking_status INTO v_existing_status
    FROM public.session_student_overrides
    WHERE student_id = p_student_id
      AND missed_session_date = p_missed_session_date
      AND (original_classroom_id IS NULL OR v_orig_classroom_id IS NULL OR original_classroom_id = v_orig_classroom_id)
      AND booking_status IN ('completed', 'forfeited', 'expired')
    LIMIT 1;

    IF v_existing_status = 'completed' THEN
        RAISE EXCEPTION 'Cannot book makeup: entitlement for missed session % has already been completed.', p_missed_session_date USING ERRCODE = '23514';
    ELSIF v_existing_status = 'forfeited' THEN
        RAISE EXCEPTION 'Cannot book makeup: entitlement for missed session % has been forfeited.', p_missed_session_date USING ERRCODE = '23514';
    ELSIF v_existing_status = 'expired' THEN
        RAISE EXCEPTION 'Cannot book makeup: entitlement for missed session % has expired.', p_missed_session_date USING ERRCODE = '23514';
    END IF;

    -- Prevent duplicate active booking
    IF EXISTS (
        SELECT 1 FROM public.session_student_overrides
        WHERE student_id = p_student_id
          AND missed_session_date = p_missed_session_date
          AND (original_classroom_id IS NULL OR v_orig_classroom_id IS NULL OR original_classroom_id = v_orig_classroom_id)
          AND credit_treatment = 'makeup'
          AND booking_status = 'scheduled'
    ) THEN
        RAISE EXCEPTION 'Cannot book makeup: an active makeup booking already exists for missed session %.', p_missed_session_date USING ERRCODE = '23505';
    END IF;

    -- Billing cycle due date check (Asia/Kolkata)
    v_next_due_date := public.calculate_student_next_due_date(p_student_id, p_missed_session_date);
    IF v_next_due_date IS NOT NULL AND p_override_date >= v_next_due_date THEN
        RAISE EXCEPTION 'Makeup date % must be strictly before student next billing due date % (Asia/Kolkata)',
            p_override_date, v_next_due_date USING ERRCODE = '22023';
    END IF;

    SELECT name INTO v_target_room_name FROM public.classrooms WHERE id = p_target_classroom_id;

    v_reason := '[MissedDate:' || p_missed_session_date::TEXT || '] ' || COALESCE(p_notes, 'Makeup session');

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

    -- Dispatch event-driven booking notification
    PERFORM public.send_idempotent_notification(
        p_student_id,
        'makeup_booked',
        v_override.id::TEXT,
        p_override_date::TEXT,
        'Makeup Class Scheduled',
        'You have been scheduled for a makeup class in "' || COALESCE(v_target_room_name, 'Classroom') ||
        '" on ' || p_override_date::TEXT || ' (replacing missed class on ' || p_missed_session_date::TEXT || ').',
        'classroom',
        jsonb_build_object(
            'override_id', v_override.id,
            'makeup_date', p_override_date,
            'missed_date', p_missed_session_date,
            'classroom_id', p_target_classroom_id
        )
    );

    RETURN v_override;
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_makeup_session(UUID, UUID, DATE, DATE, UUID, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. Update enforce_session_student_override_rules Trigger Function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_session_student_override_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_next_due_date DATE;
    v_orig_class_id UUID;
    v_student_name TEXT;
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

        -- Require approved leave request OR excused attendance for any newly inserted makeup override
        IF TG_OP = 'INSERT' THEN
            SELECT classroom_id INTO v_orig_class_id
            FROM public.leave_requests
            WHERE student_id = NEW.student_id
              AND class_date = NEW.missed_session_date
              AND status = 'approved'
            LIMIT 1;

            IF v_orig_class_id IS NULL THEN
                SELECT classroom_id INTO v_orig_class_id
                FROM public.attendance
                WHERE student_id = NEW.student_id
                  AND COALESCE(on_behalf_of_date, date) = NEW.missed_session_date
                  AND status = 'excused'
                LIMIT 1;
            END IF;

            IF v_orig_class_id IS NULL THEN
                SELECT name INTO v_student_name FROM public.users WHERE id = NEW.student_id;
                RAISE EXCEPTION 'Cannot create makeup override: No approved leave request found for student % on date %',
                    COALESCE(v_student_name, NEW.student_id::text), NEW.missed_session_date USING ERRCODE = '22023';
            END IF;

            IF NEW.original_classroom_id IS NULL THEN
                NEW.original_classroom_id := v_orig_class_id;
            ELSIF NEW.original_classroom_id <> v_orig_class_id THEN
                RAISE EXCEPTION 'Original classroom % does not match missed session classroom %',
                    NEW.original_classroom_id, v_orig_class_id USING ERRCODE = '22023';
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
            IF OLD.booking_status = 'cancelled' AND NEW.booking_status NOT IN ('cancelled') THEN
                RAISE EXCEPTION 'Invalid transition: cancelled makeup booking cannot be reopened or changed' USING ERRCODE = '22023';
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
