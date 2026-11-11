-- ============================================================================
-- Migration: 20261111111635_fix_community_profile_fk_and_student_onboarding.sql
-- Description:
--   1. Guard public.sync_community_profile_on_user() so pre-registered users
--      not yet in auth.users do not violate community_profiles_id_fkey.
--   2. Enhance public.onboard_student_atomic() so that when an admin registers
--      a student in Supabase Auth first (which triggers handle_new_user() to
--      create a 'pending' row in public.users), onboard_student_atomic promotes
--      that pending row atomically with full fee/credit and batch setup.
--   3. Harden public.handle_new_user() pre-registered profile merge to preserve
--      all fee/credit columns and migrate credit_ledger_transactions.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Guard sync_community_profile_on_user() against missing auth.users row
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_community_profile_on_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only sync to community_profiles if the user ID exists in auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.id) THEN
    INSERT INTO public.community_profiles (id, display_name, avatar_url)
    VALUES (
      NEW.id,
      COALESCE(NEW.name, 'KFA Member'),
      NEW.profile_pic_url
    )
    ON CONFLICT (id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      avatar_url = COALESCE(EXCLUDED.avatar_url, public.community_profiles.avatar_url),
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Harden handle_new_user() for pre-registered student merging
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_id UUID;
  v_existing_role TEXT;
  v_account_type TEXT;
  v_display_name TEXT;
BEGIN
  -- Resolve account type and sanitized display name
  v_account_type := COALESCE(NEW.raw_user_meta_data->>'account_type', '');
  v_display_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    split_part(NEW.email, '@', 1)
  );

  -- ── BRANCH A: External Community Member Registration ──────────────────────
  IF v_account_type = 'community' THEN
    INSERT INTO public.community_profiles (id, display_name, avatar_url, updated_at)
    VALUES (
      NEW.id,
      v_display_name,
      NEW.raw_user_meta_data->>'avatar_url',
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      avatar_url = COALESCE(EXCLUDED.avatar_url, public.community_profiles.avatar_url),
      updated_at = now();

    RETURN NEW;
  END IF;

  -- ── BRANCH B: Academy Registration / Pre-registered Account Merging ───────
  SELECT id, role INTO v_existing_id, v_existing_role
  FROM public.users
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(NEW.email))
  LIMIT 1;

  IF v_existing_id IS NOT NULL AND v_existing_id != NEW.id THEN
    INSERT INTO public.users (
      id, name, email, phone, role, status, join_date, teacher_id, level,
      learning_mode, profile_pic_url, notes, fees_basis, fees_amount,
      fees_collection_date, fees_classes_paid
    )
    SELECT
      NEW.id,
      COALESCE(name, v_display_name),
      email,
      COALESCE(phone, NEW.raw_user_meta_data->>'phone'),
      COALESCE(role, 'pending'),
      status,
      join_date,
      teacher_id,
      level,
      learning_mode,
      profile_pic_url,
      notes,
      fees_basis,
      fees_amount,
      fees_collection_date,
      fees_classes_paid
    FROM public.users
    WHERE id = v_existing_id
    ON CONFLICT (id) DO NOTHING;

    -- Migrate foreign key references to the confirmed Auth UUID
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'classroom_students') THEN
      EXECUTE 'UPDATE public.classroom_students SET student_id = $1 WHERE student_id = $2' USING NEW.id, v_existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance') THEN
      EXECUTE 'UPDATE public.attendance SET student_id = $1 WHERE student_id = $2' USING NEW.id, v_existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assignment_students') THEN
      EXECUTE 'UPDATE public.assignment_students SET student_id = $1 WHERE student_id = $2' USING NEW.id, v_existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fees_payments') THEN
      EXECUTE 'UPDATE public.fees_payments SET student_id = $1 WHERE student_id = $2' USING NEW.id, v_existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'credit_ledger_transactions') THEN
      EXECUTE 'UPDATE public.credit_ledger_transactions SET student_id = $1 WHERE student_id = $2' USING NEW.id, v_existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fees_notifications') THEN
      EXECUTE 'UPDATE public.fees_notifications SET student_id = $1 WHERE student_id = $2' USING NEW.id, v_existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'session_student_overrides') THEN
      EXECUTE 'UPDATE public.session_student_overrides SET student_id = $1 WHERE student_id = $2' USING NEW.id, v_existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leave_requests') THEN
      EXECUTE 'UPDATE public.leave_requests SET student_id = $1 WHERE student_id = $2' USING NEW.id, v_existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_status_history') THEN
      EXECUTE 'UPDATE public.student_status_history SET student_id = $1 WHERE student_id = $2' USING NEW.id, v_existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_lifecycle_audit_logs') THEN
      EXECUTE 'UPDATE public.student_lifecycle_audit_logs SET student_id = $1 WHERE student_id = $2' USING NEW.id, v_existing_id;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_special_access_grants') THEN
      EXECUTE 'UPDATE public.student_special_access_grants SET student_id = $1 WHERE student_id = $2' USING NEW.id, v_existing_id;
    END IF;

    DELETE FROM public.users WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.users (id, name, email, phone, role, status, join_date)
    VALUES (
      NEW.id,
      v_display_name,
      NEW.email,
      NEW.raw_user_meta_data->>'phone',
      'pending',
      'pending',
      CURRENT_DATE
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  INSERT INTO public.community_profiles (id, display_name, avatar_url, updated_at)
  VALUES (
    NEW.id,
    v_display_name,
    NEW.raw_user_meta_data->>'avatar_url',
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(public.community_profiles.display_name, EXCLUDED.display_name),
    avatar_url = COALESCE(public.community_profiles.avatar_url, EXCLUDED.avatar_url),
    updated_at = now();

  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Update onboard_student_atomic() to promote pending Auth-created rows
-- ----------------------------------------------------------------------------
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

    -- 4. Check if user row already exists for p_student_id
    SELECT * INTO v_user FROM public.users WHERE id = p_student_id FOR UPDATE;
    IF FOUND THEN
        IF LOWER(TRIM(v_user.email)) <> LOWER(TRIM(p_email)) THEN
            RAISE EXCEPTION 'Student ID % is already registered with a different email %', p_student_id, v_user.email USING ERRCODE = '23505';
        END IF;

        -- If the row is already an onboarded non-pending user, treat as idempotent retry
        IF COALESCE(v_user.role, '') <> 'pending' THEN
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
        END IF;

        -- Otherwise v_user.role = 'pending' (auto-created by handle_new_user trigger on auth.signUp):
        -- Promote the pending user row in-place
        UPDATE public.users
        SET
            name = TRIM(p_name),
            email = LOWER(TRIM(p_email)),
            phone = COALESCE(p_phone, phone),
            role = COALESCE(p_role, 'student'),
            status = COALESCE(p_status, 'active'),
            teacher_id = p_teacher_id,
            join_date = COALESCE(p_join_date, CURRENT_DATE),
            level = COALESCE(p_level, 'beginner'),
            learning_mode = COALESCE(p_learning_mode, 'online'),
            profile_pic_url = COALESCE(p_profile_pic_url, profile_pic_url),
            notes = p_notes,
            fees_basis = COALESCE(p_fees_basis, 'monthly'),
            fees_amount = COALESCE(p_fees_amount, 0),
            fees_collection_date = p_fees_collection_date,
            fees_classes_paid = 0
        WHERE id = p_student_id
        RETURNING * INTO v_user;
    ELSE
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
            0
        )
        RETURNING * INTO v_user;
    END IF;

    -- 6. Atomic Credit Application
    IF p_initial_credits > 0 THEN
        IF p_credit_type = 'payment_purchase' THEN
            v_pay_key := v_idempotency_key || '_pay';
            v_payment := public.record_fee_payment(
                p_student_id := p_student_id,
                p_amount := COALESCE(p_fees_amount, 0),
                p_payment_method := COALESCE(p_payment_method, 'UPI'),
                p_classes_added := p_initial_credits,
                p_payment_date := COALESCE(p_join_date, CURRENT_DATE),
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
