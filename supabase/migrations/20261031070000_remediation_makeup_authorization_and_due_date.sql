-- ==============================================================================
-- Migration: 20261031070000_remediation_makeup_authorization_and_due_date.sql
-- Description: 
-- 1. Enforce strict database-level makeup booking authorization (approved leave required,
--    concurrency advisory locking, unexpired entitlement, valid classroom mapping).
-- 2. Enforce canonical billing due date consistency (join-date day alignment, 
--    rejection of inconsistent onboarding values, and fallback synchronization).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Synchronize calculate_student_next_due_date
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_student_next_due_date(
    p_student_id UUID,
    p_missed_date DATE
)
RETURNS DATE
LANGUAGE plpgsql
STABLE
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

    RETURN make_date(v_target_year, v_target_month, v_clamped_day);
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. Harden book_makeup_session RPC
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
    v_orig_classroom_id UUID := p_original_classroom_id;
    v_reason TEXT;
    v_override public.session_student_overrides%ROWTYPE;
BEGIN
    -- 1. Authentication check
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    -- Authorization check
    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or admins can book makeup sessions.' USING ERRCODE = '42501';
    END IF;

    -- 2. Validate input parameters
    IF p_student_id IS NULL OR p_target_classroom_id IS NULL OR p_override_date IS NULL OR p_missed_session_date IS NULL THEN
        RAISE EXCEPTION 'Missing required parameters for booking makeup session' USING ERRCODE = '22023';
    END IF;

    -- 3. Concurrency Lock: Prevent concurrent duplicate bookings for the same student & missed date
    PERFORM pg_advisory_xact_lock(hashtext('makeup_' || p_student_id::text || '_' || p_missed_session_date::text)::bigint);

    -- 4. Require approved original leave
    SELECT id, classroom_id INTO v_leave_id, v_leave_classroom_id
    FROM public.leave_requests
    WHERE student_id = p_student_id
      AND class_date = p_missed_session_date
      AND status = 'approved'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cannot book makeup: No approved leave request found for student % on date %',
            p_student_id, p_missed_session_date USING ERRCODE = '22023';
    END IF;

    -- 5. Classroom mapping validation
    IF v_orig_classroom_id IS NOT NULL AND v_leave_classroom_id IS NOT NULL AND v_orig_classroom_id <> v_leave_classroom_id THEN
        RAISE EXCEPTION 'Cannot book makeup: original classroom % does not match approved leave classroom %',
            v_orig_classroom_id, v_leave_classroom_id USING ERRCODE = '22023';
    END IF;

    IF v_orig_classroom_id IS NULL THEN
        v_orig_classroom_id := v_leave_classroom_id;
    END IF;

    -- 6. Check for completed, forfeited, or expired makeup for this missed session
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

    -- 7. Check if active booking already exists
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

    -- 8. Billing cycle due date check (Asia/Kolkata)
    v_next_due_date := public.calculate_student_next_due_date(p_student_id, p_missed_session_date);
    IF v_next_due_date IS NOT NULL AND p_override_date >= v_next_due_date THEN
        RAISE EXCEPTION 'Makeup date % must be strictly before student next billing due date % (Asia/Kolkata)',
            p_override_date, v_next_due_date USING ERRCODE = '22023';
    END IF;

    -- 9. Construct reason tag
    v_reason := '[MissedDate:' || p_missed_session_date::TEXT || '] ' || COALESCE(p_notes, 'Makeup session');

    -- 10. Insert new override record
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

-- ------------------------------------------------------------------------------
-- 3. Harden enforce_session_student_override_rules trigger function
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

        -- Require approved leave request for any newly inserted makeup override
        IF TG_OP = 'INSERT' THEN
            SELECT classroom_id INTO v_orig_class_id
            FROM public.leave_requests
            WHERE student_id = NEW.student_id
              AND class_date = NEW.missed_session_date
              AND status = 'approved'
            LIMIT 1;

            IF v_orig_class_id IS NULL THEN
                RAISE EXCEPTION 'Cannot create makeup override: No approved leave request found for student % on date %',
                    NEW.student_id, NEW.missed_session_date USING ERRCODE = '22023';
            END IF;

            IF NEW.original_classroom_id IS NULL THEN
                NEW.original_classroom_id := v_orig_class_id;
            ELSIF NEW.original_classroom_id <> v_orig_class_id THEN
                RAISE EXCEPTION 'Original classroom % does not match approved leave classroom %',
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

-- ------------------------------------------------------------------------------
-- 4. Harden onboard_student_atomic (Due date consistency enforcement)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.onboard_student_atomic(
    p_student_id UUID,
    p_name TEXT,
    p_email TEXT,
    p_phone TEXT DEFAULT NULL,
    p_role TEXT DEFAULT 'student',
    p_status TEXT DEFAULT 'active',
    p_teacher_id UUID DEFAULT NULL,
    p_join_date DATE DEFAULT CURRENT_DATE,
    p_level TEXT DEFAULT 'beginner',
    p_learning_mode TEXT DEFAULT 'online',
    p_profile_pic_url TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_fees_basis TEXT DEFAULT 'monthly',
    p_fees_amount NUMERIC DEFAULT 0,
    p_fees_collection_date INTEGER DEFAULT NULL,
    p_initial_credits INTEGER DEFAULT 0,
    p_classroom_id UUID DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL,
    p_credit_type TEXT DEFAULT 'payment_purchase',
    p_payment_method TEXT DEFAULT 'UPI'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_idempotency_key TEXT;
    v_pay_key TEXT;
    v_user public.users%ROWTYPE;
    v_existing_email_user UUID;
    v_payment public.fees_payments%ROWTYPE;
    v_payment_id UUID := NULL;
    v_final_bal INTEGER := 0;
    v_is_enrolled BOOLEAN := false;
    v_join_date DATE := COALESCE(p_join_date, CURRENT_DATE);
    v_join_day INTEGER := EXTRACT(DAY FROM v_join_date)::integer;
    v_final_col_date INTEGER;
BEGIN
    -- 1. Authorization check: caller must be authenticated admin or teacher
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or admins can onboard students.' USING ERRCODE = '42501';
    END IF;

    -- 2. Input validation
    IF p_student_id IS NULL THEN
        RAISE EXCEPTION 'Student ID is required' USING ERRCODE = '22023';
    END IF;

    IF p_name IS NULL OR TRIM(p_name) = '' THEN
        RAISE EXCEPTION 'Student name is required' USING ERRCODE = '22023';
    END IF;

    IF p_email IS NULL OR TRIM(p_email) = '' THEN
        RAISE EXCEPTION 'Student email is required' USING ERRCODE = '22023';
    END IF;

    IF p_initial_credits < 0 THEN
        RAISE EXCEPTION 'Initial credits cannot be negative: %', p_initial_credits USING ERRCODE = '22023';
    END IF;

    IF p_credit_type NOT IN ('payment_purchase', 'legacy_opening_balance') THEN
        RAISE EXCEPTION 'Invalid credit_type: % (must be payment_purchase or legacy_opening_balance)', p_credit_type USING ERRCODE = '22023';
    END IF;

    -- Canonical Due Date Consistency Check:
    -- Monthly billing due day must strictly equal the student's join-date day
    IF COALESCE(p_fees_basis, 'monthly') = 'monthly' THEN
        IF p_fees_collection_date IS NOT NULL AND p_fees_collection_date <> v_join_day THEN
            RAISE EXCEPTION 'Invalid fees_collection_date: Monthly billing due day (%) must equal the student join-date day (%)',
                p_fees_collection_date, v_join_day USING ERRCODE = '22023';
        END IF;
        v_final_col_date := v_join_day;
    ELSE
        v_final_col_date := NULL;
    END IF;

    -- Validate teacher if provided
    IF p_teacher_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_teacher_id AND role IN ('teacher', 'admin')) THEN
            RAISE EXCEPTION 'Invalid teacher: teacher % does not exist', p_teacher_id USING ERRCODE = '22023';
        END IF;
    END IF;

    -- Validate classroom if provided
    IF p_classroom_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.classrooms WHERE id = p_classroom_id) THEN
            RAISE EXCEPTION 'Invalid classroom: classroom % does not exist', p_classroom_id USING ERRCODE = '22023';
        END IF;
    END IF;

    -- 3. Stable idempotency key
    IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
        v_idempotency_key := TRIM(p_idempotency_key);
    ELSE
        v_idempotency_key := 'onboard_' || p_student_id::text;
    END IF;

    -- Acquire transaction advisory lock on idempotency key to serialize concurrent onboarding retries
    PERFORM pg_advisory_xact_lock(hashtext(v_idempotency_key)::bigint);

    -- 4. Idempotency Check: User already exists?
    SELECT * INTO v_user FROM public.users WHERE id = p_student_id FOR UPDATE;
    IF FOUND THEN
        -- Check email match
        IF LOWER(TRIM(v_user.email)) = LOWER(TRIM(p_email)) THEN
            SELECT EXISTS (
                SELECT 1 FROM public.classroom_students 
                WHERE student_id = p_student_id AND classroom_id = p_classroom_id
            ) INTO v_is_enrolled;

            SELECT id INTO v_payment_id 
            FROM public.fees_payments 
            WHERE student_id = p_student_id AND idempotency_key = (v_idempotency_key || '_pay')
            LIMIT 1;

            RETURN jsonb_build_object(
                'success', true,
                'student_id', v_user.id,
                'name', v_user.name,
                'email', v_user.email,
                'fees_classes_paid', v_user.fees_classes_paid,
                'classroom_id', p_classroom_id,
                'payment_id', v_payment_id,
                'credit_type', p_credit_type,
                'is_retry', true
            );
        ELSE
            RAISE EXCEPTION 'Student ID % is already registered with a different email %', p_student_id, v_user.email USING ERRCODE = '23505';
        END IF;
    END IF;

    -- Check if email is already taken by another student
    SELECT id INTO v_existing_email_user FROM public.users WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email)) LIMIT 1;
    IF v_existing_email_user IS NOT NULL THEN
        RAISE EXCEPTION 'A user with email % already exists.', p_email USING ERRCODE = '23505';
    END IF;

    -- 5. Insert into public.users
    INSERT INTO public.users (
        id,
        name,
        email,
        phone,
        role,
        status,
        teacher_id,
        join_date,
        level,
        learning_mode,
        profile_pic_url,
        notes,
        fees_basis,
        fees_amount,
        fees_collection_date,
        fees_classes_paid
    ) VALUES (
        p_student_id,
        TRIM(p_name),
        LOWER(TRIM(p_email)),
        p_phone,
        COALESCE(p_role, 'student'),
        COALESCE(p_status, 'active'),
        p_teacher_id,
        v_join_date,
        COALESCE(p_level, 'beginner'),
        COALESCE(p_learning_mode, 'online'),
        p_profile_pic_url,
        p_notes,
        COALESCE(p_fees_basis, 'monthly'),
        COALESCE(p_fees_amount, 0),
        v_final_col_date,
        0 -- Baseline starting balance before atomic credit treatment
    )
    RETURNING * INTO v_user;

    -- 6. Atomic Credit Application
    IF p_initial_credits > 0 THEN
        IF p_credit_type = 'payment_purchase' THEN
            v_pay_key := v_idempotency_key || '_pay';
            v_payment := public.record_fee_payment(
                p_student_id := p_student_id,
                p_amount := COALESCE(p_fees_amount, 0),
                p_payment_date := v_join_date,
                p_payment_method := COALESCE(p_payment_method, 'UPI'),
                p_classes_added := p_initial_credits,
                p_notes := 'Initial onboarding prepaid classes',
                p_idempotency_key := v_pay_key,
                p_status := 'approved'
            );
            v_payment_id := v_payment.id;
        ELSIF p_credit_type = 'legacy_opening_balance' THEN
            UPDATE public.users
            SET fees_classes_paid = p_initial_credits,
                notes = CASE 
                    WHEN notes IS NOT NULL THEN notes || E'\n[Opening Balance]: ' || p_initial_credits::text || ' credits'
                    ELSE '[Opening Balance]: ' || p_initial_credits::text || ' credits'
                END
            WHERE id = p_student_id;
        END IF;
    END IF;

    -- 7. Classroom Batch Enrollment
    IF p_classroom_id IS NOT NULL THEN
        INSERT INTO public.classroom_students (
            classroom_id,
            student_id,
            joined_at
        ) VALUES (
            p_classroom_id,
            p_student_id,
            NOW()
        )
        ON CONFLICT (classroom_id, student_id) DO NOTHING;
    END IF;

    -- 8. Fetch final confirmed balance
    SELECT fees_classes_paid INTO v_final_bal FROM public.users WHERE id = p_student_id;

    RETURN jsonb_build_object(
        'success', true,
        'student_id', p_student_id,
        'name', v_user.name,
        'email', v_user.email,
        'fees_classes_paid', v_final_bal,
        'classroom_id', p_classroom_id,
        'payment_id', v_payment_id,
        'credit_type', p_credit_type,
        'is_retry', false
    );
END;
$$;
