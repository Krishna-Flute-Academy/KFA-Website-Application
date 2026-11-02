/**
 * Attendance Ledger Idempotency & Revision Engine
 * Phase 2B.1 Correction — Deterministic, Durable Idempotency Keys for Attendance Transitions
 * 
 * Conforms to Master Business Requirements v1.1 and Safety Closure Invariants 1-12.
 */

export type AttendanceStatus = 'unmarked' | 'present' | 'absent' | 'late' | 'excused';

export type AccountingAction = 'deduct' | 'reverse' | 'noop';

export interface AttendanceTransitionContext {
    attendanceId: string;
    studentId: string;
    oldStatus: AttendanceStatus;
    newStatus: AttendanceStatus;
    revision: number;
    isExtraClass?: boolean;
    hasApprovedLeave?: boolean;
    activeDeductionTxId?: string | null;
    isMakeupForAlreadyChargedSession?: boolean;
}

export interface TransitionEvaluationResult {
    accountingAction: AccountingAction;
    creditChange: number; // -1, 0, or +1
    transactionType: 'class_attendance' | 'attendance_reversal' | null;
    idempotencyKey: string | null;
    reversalOfTransactionId: string | null;
    reason: string;
}

/**
 * Generates a stable, deterministic, non-random idempotency key for an attendance accounting event.
 * Format: attendance:<attendance_id>:rev:<revision_id>:<action>
 */
export function generateAttendanceIdempotencyKey(
    attendanceId: string,
    revision: number | string,
    action: 'deduct' | 'reverse'
): string {
    if (!attendanceId || !revision || !action) {
        throw new Error('generateAttendanceIdempotencyKey requires attendanceId, revision, and action.');
    }
    return `attendance:${attendanceId}:rev:${revision}:${action}`;
}

/**
 * Determines whether a given attendance status consumes 1 class credit under normal conditions.
 * - 'present', 'absent', 'late' consume 1 credit.
 * - 'unmarked', 'excused' do NOT consume credit.
 */
export function isCreditConsumingStatus(status: AttendanceStatus): boolean {
    return status === 'present' || status === 'absent' || status === 'late';
}

/**
 * Evaluates the financial effect of an attendance status transition according to KFA rules:
 * Invariant 1: Same logical operation retried -> stable idempotency key.
 * Invariant 2: New legitimate attendance correction -> new revision and event.
 * Invariant 3: Present -> Absent consumes 1 credit each -> net 0 change (noop).
 * Invariant 4: Present/Absent -> Excused -> restore 1 credit (+1 reverse).
 * Invariant 5: Excused -> Present/Absent -> deduct 1 credit (-1 deduct).
 * Invariant 6: Free Extra Class -> zero deduction (noop).
 * Invariant 7: Approved Leave -> zero deduction at original session (noop).
 * Invariant 12: Reversals reference relevant active deduction transaction ID.
 */
export function evaluateAttendanceTransition(
    ctx: AttendanceTransitionContext
): TransitionEvaluationResult {
    const {
        attendanceId,
        oldStatus,
        newStatus,
        revision,
        isExtraClass = false,
        hasApprovedLeave = false,
        activeDeductionTxId = null,
        isMakeupForAlreadyChargedSession = false
    } = ctx;

    // Rule 1: Free Extra Class consumes 0 credit regardless of status
    if (isExtraClass) {
        return {
            accountingAction: 'noop',
            creditChange: 0,
            transactionType: null,
            idempotencyKey: null,
            reversalOfTransactionId: null,
            reason: 'Free extra class: zero credit deduction required.'
        };
    }

    // Rule 1B: Makeup fulfilling an already-charged session consumes 0 additional credit (BUG-02)
    if (isMakeupForAlreadyChargedSession) {
        return {
            accountingAction: 'noop',
            creditChange: 0,
            transactionType: null,
            idempotencyKey: null,
            reversalOfTransactionId: null,
            reason: 'Makeup class fulfilling already-charged missed session: zero additional credit deduction required.'
        };
    }

    // Rule 2: Approved Leave at original session consumes 0 credit
    if (hasApprovedLeave) {
        // If prior status was mistakenly marked credit-consuming, it must be reversed
        if (isCreditConsumingStatus(oldStatus)) {
            const idempotencyKey = generateAttendanceIdempotencyKey(attendanceId, revision, 'reverse');
            return {
                accountingAction: 'reverse',
                creditChange: 1,
                transactionType: 'attendance_reversal',
                idempotencyKey,
                reversalOfTransactionId: activeDeductionTxId,
                reason: 'Approved leave: reversing prior accidental deduction.'
            };
        }
        return {
            accountingAction: 'noop',
            creditChange: 0,
            transactionType: null,
            idempotencyKey: null,
            reversalOfTransactionId: null,
            reason: 'Approved leave: protected zero deduction.'
        };
    }

    const wasConsuming = isCreditConsumingStatus(oldStatus);
    const isNowConsuming = isCreditConsumingStatus(newStatus);

    // Case A: Consuming -> Consuming (e.g. Present -> Absent or Late -> Present)
    // Both states consume 1 credit. Net delta = 0.
    if (wasConsuming && isNowConsuming) {
        return {
            accountingAction: 'noop',
            creditChange: 0,
            transactionType: null,
            idempotencyKey: null,
            reversalOfTransactionId: null,
            reason: `Status changed from ${oldStatus} to ${newStatus}, but both consume 1 credit. Net delta: 0.`
        };
    }

    // Case B: Non-Consuming -> Non-Consuming (e.g. unmarked -> excused, or excused -> unmarked)
    if (!wasConsuming && !isNowConsuming) {
        return {
            accountingAction: 'noop',
            creditChange: 0,
            transactionType: null,
            idempotencyKey: null,
            reversalOfTransactionId: null,
            reason: `Status changed from ${oldStatus} to ${newStatus}. Neither status consumes credit. Net delta: 0.`
        };
    }

    // Case C: Non-Consuming -> Consuming (e.g. unmarked -> Present, or Excused -> Present)
    // Deduct 1 credit (-1)
    if (!wasConsuming && isNowConsuming) {
        const idempotencyKey = generateAttendanceIdempotencyKey(attendanceId, revision, 'deduct');
        return {
            accountingAction: 'deduct',
            creditChange: -1,
            transactionType: 'class_attendance',
            idempotencyKey,
            reversalOfTransactionId: null,
            reason: `Status changed from ${oldStatus} to ${newStatus}. Consumes 1 class credit.`
        };
    }

    // Case D: Consuming -> Non-Consuming (e.g. Present -> Excused, or Absent -> Excused)
    // Reverse 1 credit (+1)
    const idempotencyKey = generateAttendanceIdempotencyKey(attendanceId, revision, 'reverse');
    return {
        accountingAction: 'reverse',
        creditChange: 1,
        transactionType: 'attendance_reversal',
        idempotencyKey,
        reversalOfTransactionId: activeDeductionTxId,
        reason: `Status changed from ${oldStatus} to ${newStatus}. Reversing previous credit deduction.`
    };
}

/**
 * Error thrown when a client provides a stale revision number.
 * Conforms to Invariant 10: "A stale client update must not silently reverse a newer attendance decision."
 */
export class StaleAttendanceRevisionError extends Error {
    constructor(attendanceId: string, currentRevision: number, expectedRevision: number) {
        super(
            `Stale attendance update rejected for record "${attendanceId}". Current revision is ${currentRevision}, but client expected ${expectedRevision}.`
        );
        this.name = 'StaleAttendanceRevisionError';
    }
}
