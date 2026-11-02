-- Migration: Package 4.2 - Atomic Student Onboarding RPC
-- Local PostgreSQL 17 Implementation

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
    p_fees_collection_date INTEGER DEFAULT 10,
    p_initial_credits INTEGER DEFAULT 0,
    p_classroom_id UUID DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL,
    p_credit_type TEXT DEFAULT 'payment_purchase',
    p_payment_method TEXT DEFAULT 'UPI'
)
RETURNS jsonb
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
            -- Idempotent retry: return existing record without duplicate insertion or double crediting
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
        COALESCE(p_join_date, CURRENT_DATE),
        COALESCE(p_level, 'beginner'),
        COALESCE(p_learning_mode, 'online'),
        p_profile_pic_url,
        p_notes,
        COALESCE(p_fees_basis, 'monthly'),
        COALESCE(p_fees_amount, 0),
        p_fees_collection_date,
        0 -- Baseline starting balance before atomic credit treatment
    )
    RETURNING * INTO v_user;

    -- 6. Atomic Credit Application (Preserve distinction between payment and opening balance)
    IF p_initial_credits > 0 THEN
        IF p_credit_type = 'payment_purchase' THEN
            v_pay_key := v_idempotency_key || '_pay';
            v_payment := public.record_fee_payment(
                p_student_id := p_student_id,
                p_amount := COALESCE(p_fees_amount, 0),
                p_payment_date := COALESCE(p_join_date, CURRENT_DATE),
                p_payment_method := COALESCE(p_payment_method, 'UPI'),
                p_classes_added := p_initial_credits,
                p_notes := 'Initial onboarding prepaid classes',
                p_idempotency_key := v_pay_key,
                p_status := 'approved'
            );
            v_payment_id := v_payment.id;
        ELSIF p_credit_type = 'legacy_opening_balance' THEN
            -- Strictly update users.fees_classes_paid with zero fees_payments record created
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

-- Explicit Function Grants
REVOKE ALL ON FUNCTION public.onboard_student_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, INTEGER, INTEGER, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT EXECUTE ON FUNCTION public.onboard_student_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, INTEGER, INTEGER, UUID, TEXT, TEXT, TEXT) TO authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT EXECUTE ON FUNCTION public.onboard_student_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, INTEGER, INTEGER, UUID, TEXT, TEXT, TEXT) TO service_role;
    END IF;
END $$;
