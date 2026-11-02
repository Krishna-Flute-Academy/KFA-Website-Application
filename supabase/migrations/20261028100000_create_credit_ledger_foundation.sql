-- ============================================================================
-- Migration: 20261028100000_create_credit_ledger_foundation.sql
-- Description: Phase 2B.1 — Safe Credit Ledger Foundation & Historical Reconciliation Preparation
-- Target: Staging Only (Additive, Isolated, Non-Breaking)
-- ============================================================================

-- 1. Create public.credit_ledger_transactions (Append-Only Financial Ledger)
CREATE TABLE IF NOT EXISTS public.credit_ledger_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
        'payment_purchase',
        'class_attendance',
        'makeup_completion',
        'makeup_expiry',
        'makeup_forfeiture',
        'attendance_reversal',
        'payment_refund',
        'legacy_opening_balance',
        'manual_reconciliation',
        'pause_forfeiture'
    )),
    amount INTEGER NOT NULL, -- e.g. +4, -1, +1
    balance_after INTEGER NOT NULL,
    reference_type TEXT CHECK (reference_type IN (
        'fees_payments',
        'attendance',
        'makeup_entitlements',
        'leave_requests',
        'reconciliation_batch',
        'manual'
    )),
    reference_id UUID,
    idempotency_key TEXT NOT NULL UNIQUE,
    reversal_of_transaction_id UUID REFERENCES public.credit_ledger_transactions(id) ON DELETE RESTRICT,
    notes TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance & audit queries
CREATE INDEX IF NOT EXISTS idx_credit_ledger_student_created 
    ON public.credit_ledger_transactions(student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_reference 
    ON public.credit_ledger_transactions(reference_type, reference_id);

-- Partial Unique Indexes for Single-Outcome Guarantees
-- A payment record can only be credited once
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_payment_purchase 
    ON public.credit_ledger_transactions(reference_id) 
    WHERE transaction_type = 'payment_purchase';

-- A makeup entitlement can have at most one terminal consumption outcome
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_makeup_terminal 
    ON public.credit_ledger_transactions(reference_id) 
    WHERE transaction_type IN ('makeup_completion', 'makeup_expiry', 'makeup_forfeiture');

-- Enable Row Level Security (RLS)
ALTER TABLE public.credit_ledger_transactions ENABLE ROW LEVEL SECURITY;

-- Staff (Admin & Teacher) can view all ledger transactions
DROP POLICY IF EXISTS "Staff can read all credit ledger transactions" ON public.credit_ledger_transactions;
CREATE POLICY "Staff can read all credit ledger transactions" 
    ON public.credit_ledger_transactions 
    FOR SELECT TO authenticated 
    USING ((SELECT public.is_admin_or_teacher()));

-- Students can read only their own ledger transactions
DROP POLICY IF EXISTS "Students can view own credit ledger transactions" ON public.credit_ledger_transactions;
CREATE POLICY "Students can view own credit ledger transactions" 
    ON public.credit_ledger_transactions 
    FOR SELECT TO authenticated 
    USING (student_id = (SELECT auth.uid()));

-- Staff can insert new ledger entries (mutations happen via controlled functions/RPCs)
DROP POLICY IF EXISTS "Staff can insert credit ledger transactions" ON public.credit_ledger_transactions;
CREATE POLICY "Staff can insert credit ledger transactions" 
    ON public.credit_ledger_transactions 
    FOR INSERT TO authenticated 
    WITH CHECK ((SELECT public.is_admin_or_teacher()));

-- Immutability Guard: Strictly forbid UPDATE and DELETE on ledger records
CREATE OR REPLACE FUNCTION public.prevent_credit_ledger_mutation()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'Financial credit ledger transactions are strictly immutable and cannot be updated or deleted.';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_credit_ledger_immutable ON public.credit_ledger_transactions;
CREATE TRIGGER trg_protect_credit_ledger_immutable
    BEFORE UPDATE OR DELETE ON public.credit_ledger_transactions
    FOR EACH ROW EXECUTE FUNCTION public.prevent_credit_ledger_mutation();


-- 2. Create public.historical_balance_reconciliations (BR-55 Approval Workflow Foundation)
CREATE TABLE IF NOT EXISTS public.historical_balance_reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    previous_balance INTEGER NOT NULL,
    proposed_balance INTEGER NOT NULL,
    difference INTEGER NOT NULL,
    reconciliation_reason TEXT NOT NULL,
    supporting_evidence JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'applied')) DEFAULT 'pending',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approver_id UUID REFERENCES public.users(id) ON DELETE RESTRICT,
    approved_at TIMESTAMPTZ,
    applied_at TIMESTAMPTZ,
    associated_transaction_id UUID REFERENCES public.credit_ledger_transactions(id) ON DELETE RESTRICT,
    batch_reference TEXT
);

CREATE INDEX IF NOT EXISTS idx_reconciliations_student_status 
    ON public.historical_balance_reconciliations(student_id, status);

ALTER TABLE public.historical_balance_reconciliations ENABLE ROW LEVEL SECURITY;

-- Staff can manage reconciliation proposals
DROP POLICY IF EXISTS "Staff can manage historical reconciliations" ON public.historical_balance_reconciliations;
CREATE POLICY "Staff can manage historical reconciliations" 
    ON public.historical_balance_reconciliations 
    FOR ALL TO authenticated 
    USING ((SELECT public.is_admin_or_teacher()))
    WITH CHECK ((SELECT public.is_admin_or_teacher()));
