/**
 * Historical Balance Reconciliation Engine (BR-55)
 * Phase 2B.2A — Non-Breaking Historical Discrepancy Preparation & Review Engine
 * 
 * Master Business Requirements Baseline v1.1
 * Enforces Safety Closure Invariants & Rules 1-15.
 */

import crypto from 'crypto';

export type ReconciliationStatus = 'pending' | 'approved' | 'rejected' | 'stale' | 'applied';

export interface PaymentEvidence {
    id: string;
    payment_date: string;
    amount: number;
    classes_added: number;
    status: string;
    notes?: string | null;
}

export interface AttendanceEvidence {
    id: string;
    date: string;
    status: string;
    on_behalf_of_date?: string | null;
    is_extra_class: boolean;
    classroom_id: string;
    credit_impact: 'consumed' | 'zero_leave' | 'zero_extra_class' | 'non_consuming' | 'covered_by_on_behalf';
    notes?: string | null;
}

export interface LeaveEvidence {
    id: string;
    class_date: string;
    reason: string;
    status: string;
}

export interface OverrideEvidence {
    id: string;
    override_date: string;
    missed_session_date?: string | null;
    credit_treatment?: string | null;
    reason?: string | null;
}

export interface SupportingEvidence {
    payments: PaymentEvidence[];
    attendance: AttendanceEvidence[];
    leaves: LeaveEvidence[];
    overrides: OverrideEvidence[];
    total_purchased_credits: number;
    total_consumed_credits: number;
    approved_leave_count: number;
    on_behalf_of_count: number;
    free_extra_class_count: number;
    credit_deductible_extra_count: number;
    is_ambiguous: boolean;
    ambiguity_reason?: string | null;
    calculation_breakdown: string[];
}

export interface ReconciliationProposal {
    id?: string;
    student_id: string;
    student_name: string;
    previous_balance: number;
    proposed_balance: number;
    difference: number;
    reconciliation_reason: string;
    supporting_evidence: SupportingEvidence;
    status: ReconciliationStatus;
    requested_at?: string;
    approver_id?: string | null;
    approved_at?: string | null;
    reviewed_by?: string | null;
    reviewed_at?: string | null;
    rejection_reason?: string | null;
    rejected_at?: string | null;
    evidence_hash: string;
    review_notes?: string | null;
    audit_history: {
        action: 'created' | 'reviewed' | 'approved' | 'rejected' | 'marked_stale';
        timestamp: string;
        user_id?: string | null;
        notes?: string;
    }[];
}

/**
 * Computes a deterministic SHA-256 hash of the evidence records.
 * Used to detect if underlying payments or attendance change after a review.
 */
export function computeEvidenceHash(evidence: SupportingEvidence): string {
    const raw = JSON.stringify({
        payments: evidence.payments.map(p => ({ id: p.id, d: p.payment_date, c: p.classes_added, s: p.status, a: p.amount })),
        attendance: evidence.attendance.map(a => ({ id: a.id, d: a.date, s: a.status, ob: a.on_behalf_of_date, x: a.is_extra_class })),
        leaves: evidence.leaves.map(l => ({ id: l.id, d: l.class_date, s: l.status })),
        overrides: evidence.overrides.map(o => ({ id: o.id, d: o.override_date, m: o.missed_session_date, ct: o.credit_treatment }))
    });
    return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Evaluates raw student source records and computes authoritative historical balance proposal.
 */
export function generateReconciliationProposal(params: {
    student: {
        id: string;
        name: string;
        fees_classes_paid?: number | null;
        fees_basis?: string | null;
        fees_amount?: number | null;
    };
    payments: any[];
    attendance: any[];
    leaves?: any[];
    overrides?: any[];
}): ReconciliationProposal {
    const { student, payments, attendance, leaves = [], overrides = [] } = params;

    const previous_balance = typeof student.fees_classes_paid === 'number' ? student.fees_classes_paid : 0;
    const breakdown: string[] = [];

    // 1. Evaluate Approved Payments
    let total_purchased_credits = 0;
    const paymentEvidence: PaymentEvidence[] = [];

    for (const p of payments) {
        const isApproved = p.status === 'approved';
        const classes = typeof p.classes_added === 'number' && p.classes_added > 0
            ? p.classes_added
            : (student.fees_basis === 'class' ? 1 : 4);

        if (isApproved) {
            total_purchased_credits += classes;
            breakdown.push(`Payment [${p.payment_date}]: Approved, +${classes} credits (Amount: ₹${p.amount || 0})`);
        } else {
            breakdown.push(`Payment [${p.payment_date}]: Excluded (Status: ${p.status}, Amount: ₹${p.amount || 0})`);
        }

        paymentEvidence.push({
            id: p.id,
            payment_date: p.payment_date,
            amount: p.amount,
            classes_added: classes,
            status: p.status,
            notes: p.notes
        });
    }

    // 2. Evaluate Leaves
    const approvedLeaveDates = new Set<string>();
    const leaveEvidence: LeaveEvidence[] = [];
    for (const l of leaves) {
        if (l.status === 'approved') {
            const dateStr = (l.class_date || '').split('T')[0];
            approvedLeaveDates.add(dateStr);
            breakdown.push(`Approved Leave [${dateStr}]: Protected zero deduction at original session (${l.reason || 'No reason'})`);
        }
        leaveEvidence.push({
            id: l.id,
            class_date: l.class_date,
            reason: l.reason,
            status: l.status
        });
    }

    // 3. Evaluate Overrides
    const overrideByDate = new Map<string, any>();
    const overrideEvidence: OverrideEvidence[] = [];
    for (const o of overrides) {
        const oDate = (o.override_date || '').split('T')[0];
        overrideByDate.set(oDate, o);
        overrideEvidence.push({
            id: o.id,
            override_date: o.override_date,
            missed_session_date: o.missed_session_date,
            credit_treatment: o.credit_treatment,
            reason: o.reason
        });
    }

    // 4. Evaluate Attendance & On-Behalf-Of
    let total_consumed_credits = 0;
    let free_extra_class_count = 0;
    let credit_deductible_extra_count = 0;
    let on_behalf_of_count = 0;
    let is_ambiguous = false;
    let ambiguity_reason: string | null = null;

    const attendanceEvidence: AttendanceEvidence[] = [];
    const consumedSlots = new Set<string>();

    // Sort attendance chronologically
    const sortedAtt = [...attendance].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    for (const att of sortedAtt) {
        const physicalDate = (att.date || '').split('T')[0];
        const onBehalfOf = att.on_behalf_of_date ? att.on_behalf_of_date.split('T')[0] : null;
        const status = (att.status || '').toLowerCase().trim();

        // Rule: Free Extra Class
        if (att.is_extra_class) {
            free_extra_class_count++;
            breakdown.push(`Attendance [${physicalDate}]: Free Extra Class -> 0 credit consumed`);
            attendanceEvidence.push({
                id: att.id,
                date: physicalDate,
                status: att.status,
                on_behalf_of_date: att.on_behalf_of_date,
                is_extra_class: true,
                classroom_id: att.classroom_id,
                credit_impact: 'zero_extra_class',
                notes: 'Free Extra Class'
            });
            continue;
        }

        // Rule: Excused absence or Approved Leave at original session
        if (status === 'excused' || approvedLeaveDates.has(physicalDate)) {
            breakdown.push(`Attendance [${physicalDate}]: Status=${status}, Leave=${approvedLeaveDates.has(physicalDate)} -> 0 credit consumed`);
            attendanceEvidence.push({
                id: att.id,
                date: physicalDate,
                status: att.status,
                on_behalf_of_date: att.on_behalf_of_date,
                is_extra_class: false,
                classroom_id: att.classroom_id,
                credit_impact: 'zero_leave',
                notes: 'Approved leave / excused session'
            });
            continue;
        }

        // Rule: Credit consuming statuses (present, late, absent)
        if (status === 'present' || status === 'late' || status === 'absent') {
            const ov = overrideByDate.get(physicalDate);
            const missedDate = ov?.missed_session_date;
            const effectiveDate = onBehalfOf || missedDate || physicalDate;

            if (onBehalfOf || missedDate) {
                on_behalf_of_count++;
            }

            if (consumedSlots.has(effectiveDate)) {
                // Already consumed for this target date (e.g. absent on date + attended on-behalf-of)
                // Enforce Rule 6: On-behalf-of attendance is not double-counted
                breakdown.push(`Attendance [${physicalDate}]: On behalf of [${effectiveDate}], status=${status} -> ALREADY ACCOUNTED (non-double-counted)`);
                attendanceEvidence.push({
                    id: att.id,
                    date: physicalDate,
                    status: att.status,
                    on_behalf_of_date: att.on_behalf_of_date,
                    is_extra_class: false,
                    classroom_id: att.classroom_id,
                    credit_impact: 'covered_by_on_behalf',
                    notes: `On-behalf-of attendance for ${effectiveDate}; slot already accounted for`
                });

                is_ambiguous = true;
                ambiguity_reason = `Student has both an absent/scheduled record and an on-behalf-of replacement attendance for slot ${effectiveDate}. Rule 6 non-double-counting applied (1 credit consumed total for the slot). Requires administrative review.`;
            } else {
                consumedSlots.add(effectiveDate);
                total_consumed_credits++;
                breakdown.push(`Attendance [${physicalDate}]: Status=${status}, EffectiveDate=${effectiveDate} -> -1 credit consumed`);
                attendanceEvidence.push({
                    id: att.id,
                    date: physicalDate,
                    status: att.status,
                    on_behalf_of_date: att.on_behalf_of_date,
                    is_extra_class: false,
                    classroom_id: att.classroom_id,
                    credit_impact: 'consumed',
                    notes: `Effective date ${effectiveDate}`
                });
            }
        } else {
            attendanceEvidence.push({
                id: att.id,
                date: physicalDate,
                status: att.status,
                on_behalf_of_date: att.on_behalf_of_date,
                is_extra_class: false,
                classroom_id: att.classroom_id,
                credit_impact: 'non_consuming',
                notes: `Non-consuming status: ${status}`
            });
        }
    }

    const proposed_balance = total_purchased_credits - total_consumed_credits;
    const difference = proposed_balance - previous_balance;

    const supporting_evidence: SupportingEvidence = {
        payments: paymentEvidence,
        attendance: attendanceEvidence,
        leaves: leaveEvidence,
        overrides: overrideEvidence,
        total_purchased_credits,
        total_consumed_credits,
        approved_leave_count: approvedLeaveDates.size,
        on_behalf_of_count,
        free_extra_class_count,
        credit_deductible_extra_count,
        is_ambiguous,
        ambiguity_reason,
        calculation_breakdown: breakdown
    };

    const evidence_hash = computeEvidenceHash(supporting_evidence);

    const reconciliation_reason = `Authoritative historical balance calculation: ${total_purchased_credits} purchased credits from ${paymentEvidence.filter(p => p.status === 'approved').length} approved payments minus ${total_consumed_credits} consumed credits from ${total_consumed_credits} attended/scheduled sessions. Difference from stored balance (${previous_balance}) is ${difference > 0 ? '+' : ''}${difference}.${is_ambiguous ? ' [NOTE: Ambiguous historical session flagged for manual review]' : ''}`;

    return {
        student_id: student.id,
        student_name: student.name,
        previous_balance,
        proposed_balance,
        difference,
        reconciliation_reason,
        supporting_evidence,
        status: 'pending',
        evidence_hash,
        audit_history: [
            {
                action: 'created',
                timestamp: new Date().toISOString(),
                notes: `Proposal generated. Previous: ${previous_balance}, Proposed: ${proposed_balance}, Diff: ${difference}.`
            }
        ]
    };
}

/**
 * Validates whether an existing proposal is stale compared to fresh database evidence.
 */
export function isProposalStale(proposal: ReconciliationProposal, freshEvidence: SupportingEvidence): boolean {
    const currentHash = computeEvidenceHash(freshEvidence);
    return proposal.evidence_hash !== currentHash;
}
