-- Migration: Package 1 - Atomic and Idempotent Fee Payment Processing
-- Local PostgreSQL 17 Implementation

-- 1. Add idempotency_key to fees_payments with unique index
ALTER TABLE public.fees_payments 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fees_payments_idempotency_key 
ON public.fees_payments(idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- 2. Create or replace record_fee_payment RPC
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
BEGIN
    -- Authorization check: if called via client session, enforce role permissions
    IF auth.uid() IS NOT NULL THEN
        IF v_status = 'approved' AND NOT public.is_admin_or_teacher() THEN
            RAISE EXCEPTION 'Unauthorized: only teachers or admins can record approved payments.';
        END IF;
    END IF;

    -- Validate status
    IF v_status NOT IN ('approved', 'pending_approval') THEN
        RAISE EXCEPTION 'Invalid payment status: %', v_status;
    END IF;

    -- Idempotency check: if an idempotency_key is provided and already exists, return existing record
    IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
        SELECT * INTO v_payment
        FROM public.fees_payments
        WHERE idempotency_key = TRIM(p_idempotency_key)
        FOR UPDATE;

        IF FOUND THEN
            -- Idempotent retry: return existing record without duplicate insertion or balance re-crediting
            RETURN v_payment;
        END IF;
    END IF;

    -- Insert payment record
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
        COALESCE(p_amount, 0),
        COALESCE(p_payment_date, CURRENT_DATE),
        COALESCE(p_payment_method, 'UPI'),
        COALESCE(p_classes_added, 4),
        p_notes,
        NULLIF(TRIM(p_idempotency_key), ''),
        v_status
    )
    RETURNING * INTO v_payment;

    -- If approved, credit student balance (strict arithmetic addition, never clamped)
    IF v_status = 'approved' THEN
        UPDATE public.users
        SET fees_classes_paid = COALESCE(fees_classes_paid, 0) + v_payment.classes_added
        WHERE id = v_payment.student_id;

        UPDATE public.notifications
        SET is_read = true
        WHERE user_id = v_payment.student_id
          AND type IN ('fee_reminder', 'fees');
    END IF;

    RETURN v_payment;
END;
$$;

-- 3. Create or replace approve_fee_payment RPC
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
BEGIN
    -- Authorization check
    IF auth.uid() IS NOT NULL THEN
        IF NOT public.is_admin_or_teacher() THEN
            RAISE EXCEPTION 'Unauthorized: only teachers or admins can approve payments.';
        END IF;
    END IF;

    -- Lock the payment record exclusively to serialize concurrent approval attempts
    SELECT * INTO v_payment
    FROM public.fees_payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment record not found: %', p_payment_id;
    END IF;

    -- Idempotency check: if already approved, return without double-crediting
    IF v_payment.status = 'approved' THEN
        RETURN v_payment;
    END IF;

    IF v_payment.status = 'voided' THEN
        RAISE EXCEPTION 'Cannot approve a voided payment: %', p_payment_id;
    END IF;

    -- Determine classes to add
    v_classes := COALESCE(p_classes_added, v_payment.classes_added, 4);

    -- Update payment status to approved
    UPDATE public.fees_payments
    SET status = 'approved',
        classes_added = v_classes
    WHERE id = p_payment_id
    RETURNING * INTO v_payment;

    -- Atomically credit student balance (strict arithmetic addition, never clamped)
    UPDATE public.users
    SET fees_classes_paid = COALESCE(fees_classes_paid, 0) + v_classes
    WHERE id = v_payment.student_id;

    -- Auto-dismiss fee notifications
    UPDATE public.notifications
    SET is_read = true
    WHERE user_id = v_payment.student_id
      AND type IN ('fee_reminder', 'fees');

    RETURN v_payment;
END;
$$;

-- 4. Create or replace void_fee_payment RPC
CREATE OR REPLACE FUNCTION public.void_fee_payment(
    p_payment_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS public.fees_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_payment public.fees_payments%ROWTYPE;
    v_was_approved BOOLEAN;
BEGIN
    -- Authorization check
    IF auth.uid() IS NOT NULL THEN
        IF NOT public.is_admin_or_teacher() THEN
            RAISE EXCEPTION 'Unauthorized: only teachers or admins can void payments.';
        END IF;
    END IF;

    -- Lock the payment record exclusively
    SELECT * INTO v_payment
    FROM public.fees_payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment record not found: %', p_payment_id;
    END IF;

    -- Idempotency check: if already voided, return without re-deducting
    IF v_payment.status = 'voided' THEN
        RETURN v_payment;
    END IF;

    v_was_approved := (v_payment.status = 'approved');

    -- Transition status to voided and record audit notes
    UPDATE public.fees_payments
    SET status = 'voided',
        notes = CASE 
            WHEN p_reason IS NOT NULL AND TRIM(p_reason) <> '' THEN 
                COALESCE(notes || E'\n[Voided]: ' || TRIM(p_reason), '[Voided]: ' || TRIM(p_reason))
            ELSE 
                COALESCE(notes || E'\n[Voided]', '[Voided]')
        END
    WHERE id = p_payment_id
    RETURNING * INTO v_payment;

    -- If payment was approved, reverse granted credits exactly once
    -- CRITICAL: Strict arithmetic subtraction, NEVER CLAMP TO ZERO
    IF v_was_approved THEN
        UPDATE public.users
        SET fees_classes_paid = COALESCE(fees_classes_paid, 0) - v_payment.classes_added
        WHERE id = v_payment.student_id;
    END IF;

    RETURN v_payment;
END;
$$;

-- 5. Grant execution permissions safely if roles exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT EXECUTE ON FUNCTION public.record_fee_payment(UUID, NUMERIC, DATE, TEXT, INTEGER, TEXT, TEXT, TEXT) TO authenticated;
        GRANT EXECUTE ON FUNCTION public.approve_fee_payment(UUID, INTEGER) TO authenticated;
        GRANT EXECUTE ON FUNCTION public.void_fee_payment(UUID, TEXT) TO authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT EXECUTE ON FUNCTION public.record_fee_payment(UUID, NUMERIC, DATE, TEXT, INTEGER, TEXT, TEXT, TEXT) TO service_role;
        GRANT EXECUTE ON FUNCTION public.approve_fee_payment(UUID, INTEGER) TO service_role;
        GRANT EXECUTE ON FUNCTION public.void_fee_payment(UUID, TEXT) TO service_role;
    END IF;
END $$;
