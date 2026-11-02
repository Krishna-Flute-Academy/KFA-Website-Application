-- ============================================================================
-- Migration: 20261029100000_enhance_reconciliation_and_attendance_revision.sql
-- Description: Phase 2B.2A — Additive Schema Enhancements for Reconciliation Workflow & Durable Attendance Revision
-- Target: Staging Only (Additive, Safe, Non-Breaking)
-- Conforms to Master Business Requirements v1.1 & Phase 2B.2A Safety Invariants
-- ============================================================================

-- 1. Enhance public.historical_balance_reconciliations
-- Update status check constraint to support 'stale' status
DO $$ 
BEGIN
    ALTER TABLE public.historical_balance_reconciliations 
        DROP CONSTRAINT IF EXISTS historical_balance_reconciliations_status_check;
    
    ALTER TABLE public.historical_balance_reconciliations 
        ADD CONSTRAINT historical_balance_reconciliations_status_check 
        CHECK (status IN ('pending', 'approved', 'rejected', 'stale', 'applied'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Additive review, audit, and evidence tracking columns
ALTER TABLE public.historical_balance_reconciliations
    ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS evidence_hash TEXT,
    ADD COLUMN IF NOT EXISTS review_notes TEXT,
    ADD COLUMN IF NOT EXISTS audit_history JSONB DEFAULT '[]'::jsonb;

-- Invariant: A student must not have multiple simultaneously applicable approved proposals
CREATE UNIQUE INDEX IF NOT EXISTS uq_reconciliations_active_approved 
    ON public.historical_balance_reconciliations(student_id) 
    WHERE status = 'approved';

-- Invariant Workflow Trigger Guard
CREATE OR REPLACE FUNCTION public.check_reconciliation_workflow_invariants()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- 1. Rejected proposals must never be applied
    IF OLD.status = 'rejected' AND NEW.status = 'applied' THEN
        RAISE EXCEPTION 'Safety Violation: Rejected reconciliation proposals cannot be applied.';
    END IF;

    -- 2. Mandatory reason for rejection
    IF NEW.status = 'rejected' THEN
        IF NEW.rejection_reason IS NULL OR TRIM(NEW.rejection_reason) = '' THEN
            RAISE EXCEPTION 'Business Rule Violation: Rejection reason is mandatory when rejecting a reconciliation.';
        END IF;
        IF NEW.rejected_at IS NULL THEN
            NEW.rejected_at := NOW();
        END IF;
    END IF;

    -- 3. Approver required for approval
    IF NEW.status = 'approved' THEN
        IF NEW.approver_id IS NULL THEN
            RAISE EXCEPTION 'Business Rule Violation: Approver ID is required when approving a reconciliation.';
        END IF;
        IF NEW.approved_at IS NULL THEN
            NEW.approved_at := NOW();
        END IF;
    END IF;

    -- 4. Phase 2B.2A Safety Guard: Disallow financial application in this phase
    IF NEW.status = 'applied' THEN
        RAISE EXCEPTION 'Safety Guard Active: Financial application of reconciliations is strictly prohibited during Phase 2B.2A. Awaiting explicit KFA owner approval for Phase 2B.2B.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reconciliation_workflow_invariants ON public.historical_balance_reconciliations;
CREATE TRIGGER trg_reconciliation_workflow_invariants
    BEFORE UPDATE ON public.historical_balance_reconciliations
    FOR EACH ROW EXECUTE FUNCTION public.check_reconciliation_workflow_invariants();


-- 2. Enhance public.attendance with durable revision identity & deduction tracking
ALTER TABLE public.attendance
    ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS active_deduction_tx_id UUID REFERENCES public.credit_ledger_transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_student_revision 
    ON public.attendance(student_id, revision);
