-- Migration: Package 1.1 - Payment Security & Integrity Hardening
-- Local PostgreSQL 17 Implementation

-- 1. Create append-only fees_payment_audit_logs table
CREATE TABLE IF NOT EXISTS public.fees_payment_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES public.fees_payments(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES public.users(id),
    action TEXT NOT NULL,
    previous_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    credit_delta INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fees_payment_audit_logs_payment_id ON public.fees_payment_audit_logs(payment_id);
CREATE INDEX IF NOT EXISTS idx_fees_payment_audit_logs_actor_id ON public.fees_payment_audit_logs(actor_id);

-- Enforce strict append-only immutability on audit logs
CREATE OR REPLACE FUNCTION public.prevent_fees_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Allow synthetic test data cleanup only when explicitly enabled in local test session
    IF current_setting('kfa.allow_audit_log_cleanup', true) = 'true' THEN
        RETURN OLD;
    END IF;

    RAISE EXCEPTION 'fees_payment_audit_logs records are strictly append-only and cannot be modified or deleted.'
        USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_fees_payment_audit_logs_immutable ON public.fees_payment_audit_logs;
CREATE TRIGGER trg_fees_payment_audit_logs_immutable
BEFORE UPDATE OR DELETE ON public.fees_payment_audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_fees_audit_log_mutation();

-- 2. Hardened record_fee_payment RPC
CREATE OR REPLACE FUNCTION public.record_fee_payment(
    p_student_id UUID,
    p_amount NUMERIC,
    p_payment_date DATE DEFAULT CURRENT_DATE,
    p_payment_method TEXT DEFAULT 'UPI',
    p_classes_added INTEGER DEFAULT 4,
    p_notes TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL,
    p_status TEXT DEFAULT 'approved'
)
RETURNS public.fees_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_payment public.fees_payments%ROWTYPE;
    v_status TEXT := COALESCE(p_status, 'approved');
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_classes INTEGER := COALESCE(p_classes_added, 4);
    v_amount NUMERIC := COALESCE(p_amount, 0);
    v_date DATE := COALESCE(p_payment_date, CURRENT_DATE);
    v_method TEXT := COALESCE(p_payment_method, 'UPI');
BEGIN
    -- 1. Authentication check: caller must be authenticated
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    -- Fetch caller role
    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;

    -- 2. Authorization check based on role and intended status
    IF v_status = 'approved' THEN
        IF v_caller_role NOT IN ('admin', 'teacher') THEN
            RAISE EXCEPTION 'Unauthorized: only teachers or admins can record approved payments.' USING ERRCODE = '42501';
        END IF;
    ELSIF v_status = 'pending_approval' THEN
        IF v_caller_role = 'student' AND p_student_id <> v_caller_id THEN
            RAISE EXCEPTION 'Unauthorized: students can only submit payments for themselves' USING ERRCODE = '42501';
        ELSIF v_caller_role NOT IN ('admin', 'teacher', 'student') THEN
            RAISE EXCEPTION 'Unauthorized: caller role not permitted to record payments' USING ERRCODE = '42501';
        END IF;
    ELSE
        RAISE EXCEPTION 'Invalid payment status: %', v_status USING ERRCODE = '22023';
    END IF;

    -- 3. Validate amounts and credit quantities
    IF v_amount < 0 THEN
        RAISE EXCEPTION 'Payment amount cannot be negative: %', v_amount USING ERRCODE = '22023';
    END IF;

    IF v_classes <= 0 OR v_classes > 50 THEN
        RAISE EXCEPTION 'Classes added must be a positive integer between 1 and 50: %', v_classes USING ERRCODE = '22023';
    END IF;

    -- 4. Idempotency key requirement
    IF p_idempotency_key IS NULL OR TRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'Idempotency key is required for payment requests' USING ERRCODE = '22023';
    END IF;

    -- 5. Existing key lookup
    SELECT * INTO v_payment
    FROM public.fees_payments
    WHERE idempotency_key = TRIM(p_idempotency_key)
    FOR UPDATE;

    IF FOUND THEN
        -- Compare all parameters
        IF v_payment.student_id <> p_student_id
           OR v_payment.amount <> v_amount
           OR v_payment.payment_date <> v_date
           OR v_payment.payment_method <> v_method
           OR v_payment.classes_added <> v_classes
           OR (v_payment.status <> v_status AND NOT (v_payment.status = 'approved' AND v_status = 'pending_approval'))
        THEN
            RAISE EXCEPTION 'Conflicting idempotency key reuse: payment payload does not match existing record for key %', p_idempotency_key
                USING ERRCODE = '23505';
        END IF;

        -- Payload matches: idempotent return
        RETURN v_payment;
    END IF;

    -- 6. Insert new payment record (with unique_violation handling for concurrent requests)
    BEGIN
        INSERT INTO public.fees_payments (
            student_id,
            amount,
            payment_date,
            payment_method,
            classes_added,
            notes,
            idempotency_key,
            status
        ) VALUES (
            p_student_id,
            v_amount,
            v_date,
            v_method,
            v_classes,
            p_notes,
            TRIM(p_idempotency_key),
            v_status
        )
        RETURNING * INTO v_payment;
    EXCEPTION
        WHEN unique_violation THEN
            SELECT * INTO v_payment
            FROM public.fees_payments
            WHERE idempotency_key = TRIM(p_idempotency_key)
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE;
            END IF;

            IF v_payment.student_id <> p_student_id
               OR v_payment.amount <> v_amount
               OR v_payment.payment_date <> v_date
               OR v_payment.payment_method <> v_method
               OR v_payment.classes_added <> v_classes
            THEN
                RAISE EXCEPTION 'Conflicting idempotency key reuse: payment payload does not match existing record for key %', p_idempotency_key
                    USING ERRCODE = '23505';
            END IF;

            RETURN v_payment;
    END;

    -- 7. If approved, credit student balance and log audit record
    IF v_status = 'approved' THEN
        UPDATE public.users
        SET fees_classes_paid = COALESCE(fees_classes_paid, 0) + v_payment.classes_added
        WHERE id = v_payment.student_id;

        UPDATE public.notifications
        SET is_read = true
        WHERE user_id = v_payment.student_id
          AND type IN ('fee_reminder', 'reminder', 'fees');

        INSERT INTO public.fees_payment_audit_logs (
            payment_id,
            actor_id,
            action,
            previous_status,
            new_status,
            credit_delta,
            reason
        ) VALUES (
            v_payment.id,
            v_caller_id,
            'record_approved',
            'none',
            'approved',
            v_payment.classes_added,
            COALESCE(p_notes, 'Initial approved payment recorded')
        );
    END IF;

    RETURN v_payment;
END;
$$;

-- 3. Hardened approve_fee_payment RPC
CREATE OR REPLACE FUNCTION public.approve_fee_payment(
    p_payment_id UUID,
    p_classes_added INTEGER DEFAULT NULL
)
RETURNS public.fees_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_payment public.fees_payments%ROWTYPE;
    v_classes INTEGER;
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
BEGIN
    -- 1. Authentication check
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;

    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or admins can approve payments.' USING ERRCODE = '42501';
    END IF;

    -- 2. Validate classes_added argument if passed
    IF p_classes_added IS NOT NULL AND (p_classes_added <= 0 OR p_classes_added > 50) THEN
        RAISE EXCEPTION 'Classes added must be a positive integer between 1 and 50: %', p_classes_added USING ERRCODE = '22023';
    END IF;

    -- 3. Lock payment record exclusively
    SELECT * INTO v_payment
    FROM public.fees_payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment record not found: %', p_payment_id USING ERRCODE = 'P0002';
    END IF;

    -- 4. Idempotency guard: if already approved, return without double-crediting
    IF v_payment.status = 'approved' THEN
        RETURN v_payment;
    END IF;

    -- 5. Only pending_approval can transition to approved
    IF v_payment.status <> 'pending_approval' THEN
        RAISE EXCEPTION 'Invalid payment status transition: cannot approve payment with status %', v_payment.status
            USING ERRCODE = '22023';
    END IF;

    v_classes := COALESCE(p_classes_added, v_payment.classes_added, 4);

    -- 6. Update payment status to approved
    UPDATE public.fees_payments
    SET status = 'approved',
        classes_added = v_classes
    WHERE id = p_payment_id
    RETURNING * INTO v_payment;

    -- 7. Atomically increment student balance
    UPDATE public.users
    SET fees_classes_paid = COALESCE(fees_classes_paid, 0) + v_classes
    WHERE id = v_payment.student_id;

    -- 8. Dismiss fee reminders
    UPDATE public.notifications
    SET is_read = true
    WHERE user_id = v_payment.student_id
      AND type IN ('fee_reminder', 'reminder', 'fees');

    -- 9. Append-only audit record
    INSERT INTO public.fees_payment_audit_logs (
        payment_id,
        actor_id,
        action,
        previous_status,
        new_status,
        credit_delta,
        reason
    ) VALUES (
        p_payment_id,
        v_caller_id,
        'approve',
        'pending_approval',
        'approved',
        v_classes,
        'Payment approved by staff'
    );

    RETURN v_payment;
END;
$$;

-- 4. Hardened void_fee_payment RPC
DROP FUNCTION IF EXISTS public.void_fee_payment(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.void_fee_payment(
    p_payment_id UUID,
    p_reason TEXT
)
RETURNS public.fees_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_payment public.fees_payments%ROWTYPE;
    v_was_approved BOOLEAN;
    v_credit_delta INTEGER;
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_prev_status TEXT;
BEGIN
    -- 1. Authentication check
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;

    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or admins can void payments.' USING ERRCODE = '42501';
    END IF;

    -- 2. Reason validation: non-empty reason required
    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RAISE EXCEPTION 'A valid non-empty reason is required to void a payment' USING ERRCODE = '22023';
    END IF;

    -- 3. Lock payment record exclusively
    SELECT * INTO v_payment
    FROM public.fees_payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment record not found: %', p_payment_id USING ERRCODE = 'P0002';
    END IF;

    -- 4. Idempotency guard: if already voided, return without re-deducting or re-auditing
    IF v_payment.status = 'voided' THEN
        RETURN v_payment;
    END IF;

    -- 5. Validate status transition: only 'approved' or 'pending_approval' can be voided
    IF v_payment.status NOT IN ('approved', 'pending_approval') THEN
        RAISE EXCEPTION 'Invalid payment status transition: cannot void payment with status %', v_payment.status
            USING ERRCODE = '22023';
    END IF;

    v_prev_status := v_payment.status;
    v_was_approved := (v_prev_status = 'approved');
    v_credit_delta := CASE WHEN v_was_approved THEN -v_payment.classes_added ELSE 0 END;

    -- 6. Transition status to voided
    UPDATE public.fees_payments
    SET status = 'voided',
        notes = COALESCE(notes || E'\n', '') || '[Voided by ' || v_caller_id || ' at ' || now() || ']: ' || TRIM(p_reason)
    WHERE id = p_payment_id
    RETURNING * INTO v_payment;

    -- 7. If previously approved, reverse credits (strict arithmetic subtraction, NEVER CLAMP TO ZERO)
    IF v_was_approved THEN
        UPDATE public.users
        SET fees_classes_paid = COALESCE(fees_classes_paid, 0) - v_payment.classes_added
        WHERE id = v_payment.student_id;
    END IF;

    -- 8. Append-only audit record
    INSERT INTO public.fees_payment_audit_logs (
        payment_id,
        actor_id,
        action,
        previous_status,
        new_status,
        credit_delta,
        reason
    ) VALUES (
        p_payment_id,
        v_caller_id,
        'void',
        v_prev_status,
        'voided',
        v_credit_delta,
        TRIM(p_reason)
    );

    RETURN v_payment;
END;
$$;

-- 5. Revoke PUBLIC execution and explicitly grant permissions
REVOKE ALL ON FUNCTION public.record_fee_payment(UUID, NUMERIC, DATE, TEXT, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_fee_payment(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.void_fee_payment(UUID, TEXT) FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT EXECUTE ON FUNCTION public.record_fee_payment(UUID, NUMERIC, DATE, TEXT, INTEGER, TEXT, TEXT, TEXT) TO authenticated;
        GRANT EXECUTE ON FUNCTION public.approve_fee_payment(UUID, INTEGER) TO authenticated;
        GRANT EXECUTE ON FUNCTION public.void_fee_payment(UUID, TEXT) TO authenticated;
        GRANT SELECT, INSERT ON public.fees_payment_audit_logs TO authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT EXECUTE ON FUNCTION public.record_fee_payment(UUID, NUMERIC, DATE, TEXT, INTEGER, TEXT, TEXT, TEXT) TO service_role;
        GRANT EXECUTE ON FUNCTION public.approve_fee_payment(UUID, INTEGER) TO service_role;
        GRANT EXECUTE ON FUNCTION public.void_fee_payment(UUID, TEXT) TO service_role;
        GRANT ALL ON public.fees_payment_audit_logs TO service_role;
    END IF;
END $$;

-- 6. Local Test Authentication Context Helpers
CREATE OR REPLACE FUNCTION public.set_test_auth_context(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM set_config('request.jwt.claim.sub', p_user_id::text, false);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_test_auth_context()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM set_config('request.jwt.claim.sub', '', false);
    PERFORM set_config('request.jwt.claim.role', 'anon', false);
END;
$$;
