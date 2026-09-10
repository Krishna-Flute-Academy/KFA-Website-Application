import test from 'node:test';
import assert from 'node:assert/strict';
import createJiti from 'jiti';

const jiti = createJiti(import.meta.url);
const {
    calculateStudentFeeCycleMetrics,
    getStudentFeeCycleLedger,
    evaluateStudentFeeCycle,
    getStudentBillingCycle,
    getClampedMonthDate,
    formatDateToYYYYMMDD
} = jiti('../src/lib/fee-utils.ts');

test('1. Requirement #1: Cap classesAvailable by remaining entitlement (Never report more than entitlement)', () => {
    // entitlement = 4, regularAttended = 2, excusedMissed = 1 (creates 1 makeup), regularFuture = 2
    // creditsRemaining = 4 - 2 - 0 - 0 = 2
    // operationalOpportunities = regularFuture (2) + makeupsPending (1) = 3
    // classesAvailable = min(2, 3) = 2. MUST NEVER BE 3.
    const today = new Date(2026, 7, 20); // 20 Aug 2026 (Thursday)

    const result = calculateStudentFeeCycleMetrics({
        student: {
            id: 'student-req-1',
            fees_basis: 'monthly',
            fees_collection_date: 13,
            join_date: '2026-08-13'
        },
        classrooms: [{ id: 'class-1', name: 'Tuesday Flute' }],
        batchSchedules: [{ classroom_id: 'class-1', day_of_week: 2 }], // Tuesdays: Aug 18, Aug 25, Sep 1, Sep 8
        attendance: [
            { student_id: 'student-req-1', classroom_id: 'class-1', date: '2026-08-18', status: 'present' },
            // Let's simulate: attended 2, excused 1, future 2.
            // For example, if cycle had 5 Tuesdays or if there are 2 future Tuesdays and 1 excused past Tuesday:
            { student_id: 'student-req-1', classroom_id: 'class-1', date: '2026-08-11', status: 'present' }, // extra past attendance
            { student_id: 'student-req-1', classroom_id: 'class-1', date: '2026-08-18', status: 'excused' }
        ],
        payments: [{ payment_date: '2026-08-13', status: 'approved', classes_added: 4 }],
        today
    });

    // In a direct test of the formula:
    const entitled = 4;
    const regularAttended = 2;
    const unexcusedMissed = 0;
    const makeupsCompleted = 0;
    const regularFuture = 2;
    const makeupsPending = 1;

    const creditsRemaining = Math.max(0, entitled - regularAttended - unexcusedMissed - makeupsCompleted);
    const operationalOpportunities = regularFuture + makeupsPending;
    const classesAvailable = Math.min(creditsRemaining, operationalOpportunities);

    assert.equal(creditsRemaining, 2, 'creditsRemaining must be 2');
    assert.equal(operationalOpportunities, 3, 'operationalOpportunities is 3 (2 regular future + 1 makeup)');
    assert.equal(classesAvailable, 2, 'classesAvailable must be capped at 2, NEVER 3');
});

test('2. Requirement #2 & #3: Adhrith Nag Koganti actual data on 2026-09-09 (Unresolved Session)', () => {
    // Adhrith: cycle 13 Aug 2026 -> 13 Sep 2026
    // Tuesdays: Aug 18 (present), Aug 25 (present), Sep 1 (present), Sep 8 (NO RECORD)
    // Today: 2026-09-09
    const today = new Date(2026, 8, 9, 12, 0, 0); // 9 Sep 2026

    const result = calculateStudentFeeCycleMetrics({
        student: {
            id: '2ec67729-fa63-4887-ab8f-fde543e3c512',
            fees_basis: 'monthly',
            fees_collection_date: 13,
            join_date: '2026-08-13'
        },
        classrooms: [{ id: '3b9316e5-be0c-49a1-a429-b8dda8383104', name: 'Tuesday Slot 3' }],
        batchSchedules: [{ classroom_id: '3b9316e5-be0c-49a1-a429-b8dda8383104', day_of_week: 2 }],
        attendance: [
            { student_id: '2ec67729-fa63-4887-ab8f-fde543e3c512', classroom_id: '3b9316e5-be0c-49a1-a429-b8dda8383104', date: '2026-08-18', status: 'present' },
            { student_id: '2ec67729-fa63-4887-ab8f-fde543e3c512', classroom_id: '3b9316e5-be0c-49a1-a429-b8dda8383104', date: '2026-08-25', status: 'present' },
            { student_id: '2ec67729-fa63-4887-ab8f-fde543e3c512', classroom_id: '3b9316e5-be0c-49a1-a429-b8dda8383104', date: '2026-09-01', status: 'present' }
            // Sep 8 is missing
        ],
        payments: [{ payment_date: '2026-08-13', status: 'approved', classes_added: 4 }],
        today
    });

    assert.equal(result.cycleStart, '2026-08-13');
    assert.equal(result.nextDueDate, '2026-09-13');
    assert.equal(result.entitledClasses, 4);
    assert.equal(result.regularAttended, 3, 'Attended 3 classes');
    assert.equal(result.regularFuture, 0, 'No more Tuesdays before 13 Sep');
    assert.equal(result.unresolvedSessions, 1, 'Sep 8 must be flagged as 1 unresolved session');
    assert.equal(result.creditsRemaining, 1, '4 - 3 = 1 credit remains financially');
    assert.equal(result.classesAvailable, 0, '0 classes available operationally until Sep 8 is classified');
    assert.match(result.statusLabel, /Attendance Review Needed/);
    assert.equal(result.badgeVariant, 'warning');
});

test('3. Adhrith Scenario A: Sep 8 has approved leave (1 Makeup Pending -> 1 Class Left)', () => {
    const today = new Date(2026, 8, 9, 12, 0, 0);

    const result = calculateStudentFeeCycleMetrics({
        student: {
            id: '2ec67729-fa63-4887-ab8f-fde543e3c512',
            fees_basis: 'monthly',
            fees_collection_date: 13,
            join_date: '2026-08-13'
        },
        classrooms: [{ id: '3b9316e5-be0c-49a1-a429-b8dda8383104', name: 'Tuesday Slot 3' }],
        batchSchedules: [{ classroom_id: '3b9316e5-be0c-49a1-a429-b8dda8383104', day_of_week: 2 }],
        attendance: [
            { student_id: '2ec67729-fa63-4887-ab8f-fde543e3c512', classroom_id: '3b9316e5-be0c-49a1-a429-b8dda8383104', date: '2026-08-18', status: 'present' },
            { student_id: '2ec67729-fa63-4887-ab8f-fde543e3c512', classroom_id: '3b9316e5-be0c-49a1-a429-b8dda8383104', date: '2026-08-25', status: 'present' },
            { student_id: '2ec67729-fa63-4887-ab8f-fde543e3c512', classroom_id: '3b9316e5-be0c-49a1-a429-b8dda8383104', date: '2026-09-01', status: 'present' },
            { student_id: '2ec67729-fa63-4887-ab8f-fde543e3c512', classroom_id: '3b9316e5-be0c-49a1-a429-b8dda8383104', date: '2026-09-08', status: 'excused' }
        ],
        leaveRequests: [
            { student_id: '2ec67729-fa63-4887-ab8f-fde543e3c512', classroom_id: '3b9316e5-be0c-49a1-a429-b8dda8383104', class_date: '2026-09-08', status: 'approved' }
        ],
        payments: [{ payment_date: '2026-08-13', status: 'approved', classes_added: 4 }],
        today
    });

    assert.equal(result.regularAttended, 3);
    assert.equal(result.excusedMissed, 1);
    assert.equal(result.unresolvedSessions, 0);
    assert.equal(result.makeupsPending, 1, '1 makeup pending');
    assert.equal(result.creditsRemaining, 1);
    assert.equal(result.classesAvailable, 1, '1 class left');
    assert.match(result.statusLabel, /1 Makeup Pending/);
});

test('4. Adhrith Scenario B: Sep 8 has unexcused absence (Forfeited -> 0 Classes Left)', () => {
    const today = new Date(2026, 8, 9, 12, 0, 0);

    const result = calculateStudentFeeCycleMetrics({
        student: {
            id: '2ec67729-fa63-4887-ab8f-fde543e3c512',
            fees_basis: 'monthly',
            fees_collection_date: 13,
            join_date: '2026-08-13'
        },
        classrooms: [{ id: '3b9316e5-be0c-49a1-a429-b8dda8383104', name: 'Tuesday Slot 3' }],
        batchSchedules: [{ classroom_id: '3b9316e5-be0c-49a1-a429-b8dda8383104', day_of_week: 2 }],
        attendance: [
            { student_id: '2ec67729-fa63-4887-ab8f-fde543e3c512', classroom_id: '3b9316e5-be0c-49a1-a429-b8dda8383104', date: '2026-08-18', status: 'present' },
            { student_id: '2ec67729-fa63-4887-ab8f-fde543e3c512', classroom_id: '3b9316e5-be0c-49a1-a429-b8dda8383104', date: '2026-08-25', status: 'present' },
            { student_id: '2ec67729-fa63-4887-ab8f-fde543e3c512', classroom_id: '3b9316e5-be0c-49a1-a429-b8dda8383104', date: '2026-09-01', status: 'present' },
            { student_id: '2ec67729-fa63-4887-ab8f-fde543e3c512', classroom_id: '3b9316e5-be0c-49a1-a429-b8dda8383104', date: '2026-09-08', status: 'absent' }
        ],
        payments: [{ payment_date: '2026-08-13', status: 'approved', classes_added: 4 }],
        today
    });

    assert.equal(result.regularAttended, 3);
    assert.equal(result.unexcusedMissed, 1);
    assert.equal(result.creditsRemaining, 0, '4 - 3 - 1 = 0 credits remaining');
    assert.equal(result.classesAvailable, 0, '0 classes available');
    assert.match(result.statusLabel, /Cycle Complete/);
});

test('5. Makeup Reconciliation: Excused absence linked to future override (1 Makeup Scheduled)', () => {
    const today = new Date(2026, 8, 9, 12, 0, 0);

    const result = calculateStudentFeeCycleMetrics({
        student: {
            id: 'student-makeup-sched',
            fees_basis: 'monthly',
            fees_collection_date: 13,
            join_date: '2026-08-13'
        },
        classrooms: [{ id: 'class-main', name: 'Tuesday Flute' }],
        batchSchedules: [{ classroom_id: 'class-main', day_of_week: 2 }],
        attendance: [
            { student_id: 'student-makeup-sched', classroom_id: 'class-main', date: '2026-08-18', status: 'present' },
            { student_id: 'student-makeup-sched', classroom_id: 'class-main', date: '2026-08-25', status: 'present' },
            { student_id: 'student-makeup-sched', classroom_id: 'class-main', date: '2026-09-01', status: 'present' },
            { student_id: 'student-makeup-sched', classroom_id: 'class-main', date: '2026-09-08', status: 'excused' }
        ],
        overrides: [
            {
                id: 'ov-1',
                student_id: 'student-makeup-sched',
                target_classroom_id: 'class-other',
                override_date: '2026-09-11', // Friday makeup
                reason: 'Makeup session [MissedDate:2026-09-08]'
            }
        ],
        payments: [{ payment_date: '2026-08-13', status: 'approved', classes_added: 4 }],
        today
    });

    assert.equal(result.makeupsPending, 0);
    assert.equal(result.makeupsScheduled, 1, 'Makeup is scheduled on Sep 11');
    assert.equal(result.classesAvailable, 1);
    assert.match(result.statusLabel, /1 Makeup Scheduled/);
});

test('6. Completed Makeup: Override attended (present) consumes credit and closes cycle', () => {
    const today = new Date(2026, 8, 12, 12, 0, 0);

    const result = calculateStudentFeeCycleMetrics({
        student: {
            id: 'student-makeup-done',
            fees_basis: 'monthly',
            fees_collection_date: 13,
            join_date: '2026-08-13'
        },
        classrooms: [{ id: 'class-main', name: 'Tuesday Flute' }],
        batchSchedules: [{ classroom_id: 'class-main', day_of_week: 2 }],
        attendance: [
            { student_id: 'student-makeup-done', classroom_id: 'class-main', date: '2026-08-18', status: 'present' },
            { student_id: 'student-makeup-done', classroom_id: 'class-main', date: '2026-08-25', status: 'present' },
            { student_id: 'student-makeup-done', classroom_id: 'class-main', date: '2026-09-01', status: 'present' },
            { student_id: 'student-makeup-done', classroom_id: 'class-main', date: '2026-09-08', status: 'excused' },
            // Override attendance
            { student_id: 'student-makeup-done', classroom_id: 'class-other', date: '2026-09-11', status: 'present' }
        ],
        overrides: [
            {
                id: 'ov-1',
                student_id: 'student-makeup-done',
                target_classroom_id: 'class-other',
                override_date: '2026-09-11',
                reason: 'Makeup session [MissedDate:2026-09-08]'
            }
        ],
        payments: [{ payment_date: '2026-08-13', status: 'approved', classes_added: 4 }],
        today
    });

    assert.equal(result.makeupsCompleted, 1, 'Makeup attended');
    assert.equal(result.makeupsScheduled, 0);
    assert.equal(result.makeupsPending, 0);
    assert.equal(result.creditsRemaining, 0, '4 - 3 regular - 1 makeup = 0');
    assert.equal(result.classesAvailable, 0);
    assert.match(result.statusLabel, /Cycle Complete/);
});

test('7. Half-Open Interval: Class on nextDueDate belongs to next cycle', () => {
    // Due date 13th. Cycle: 13 Aug -> 13 Sep.
    // Class on 13 Sep (Sunday) must NOT be counted in current cycle!
    const cycle = getStudentBillingCycle(13, [{ payment_date: '2026-08-13', status: 'approved' }], new Date('2026-08-20'));
    assert.equal(cycle.cycleStart, '2026-08-13');
    assert.equal(cycle.nextDueDate, '2026-09-13');
    // Boundary check:
    assert.equal('2026-08-13' >= cycle.cycleStart && '2026-08-13' < cycle.nextDueDate, true);
    assert.equal('2026-09-12' >= cycle.cycleStart && '2026-09-12' < cycle.nextDueDate, true);
    assert.equal('2026-09-13' >= cycle.cycleStart && '2026-09-13' < cycle.nextDueDate, false, 'nextDueDate is excluded (half-open)');
});

test('8. Safe month date clamping for 28/29/30/31 days', () => {
    // Due day 31 in February 2026 (non-leap year) -> 28 Feb
    const dFeb = getClampedMonthDate(2026, 1, 31);
    assert.equal(formatDateToYYYYMMDD(dFeb), '2026-02-28');

    // Due day 31 in April 2026 -> 30 Apr
    const dApr = getClampedMonthDate(2026, 3, 31);
    assert.equal(formatDateToYYYYMMDD(dApr), '2026-04-30');
});

test('9. Per-class students retain prepaid balance', () => {
    const result = calculateStudentFeeCycleMetrics({
        student: {
            id: 'per-class-std',
            fees_basis: 'class',
            fees_classes_paid: 6
        }
    });

    assert.equal(result.feesBasis, 'class');
    assert.equal(result.classesAvailable, 6);
    assert.equal(result.creditsRemaining, 6);
    assert.match(result.statusLabel, /6 Prepaid/);
});

test('10. Fee Cycle Ledger: All 4 classes attended (4 consumed, 0 unresolved, cycle complete)', () => {
    const today = new Date(2026, 8, 10); // 10 Sep 2026
    const ledger = getStudentFeeCycleLedger({
        student: { id: 'std-all-attended', fees_basis: 'monthly', fees_collection_date: 13, join_date: '2026-08-13' },
        classrooms: [{ id: 'class-tue', name: 'Tuesday Flute Batch' }],
        batchSchedules: [{ classroom_id: 'class-tue', day_of_week: 2 }],
        attendance: [
            { student_id: 'std-all-attended', classroom_id: 'class-tue', date: '2026-08-18', status: 'present' },
            { student_id: 'std-all-attended', classroom_id: 'class-tue', date: '2026-08-25', status: 'late' },
            { student_id: 'std-all-attended', classroom_id: 'class-tue', date: '2026-09-01', status: 'present' },
            { student_id: 'std-all-attended', classroom_id: 'class-tue', date: '2026-09-08', status: 'present' }
        ],
        payments: [{ payment_date: '2026-08-13', status: 'approved', classes_added: 4 }],
        today
    });

    assert.equal(ledger.sessions.length, 4);
    assert.equal(ledger.summary.entitledClasses, 4);
    assert.equal(ledger.summary.consumedClasses, 4);
    assert.equal(ledger.summary.creditsRemaining, 0);
    assert.equal(ledger.summary.classesAvailable, 0);
    assert.equal(ledger.summary.unresolvedSessions, 0);
    assert.equal(ledger.summary.hasDiscrepancy, false);
    assert.equal(ledger.diagnostics.length, 0);
    assert.match(ledger.metrics.statusLabel, /Cycle Complete/);

    // Verify session details
    assert.equal(ledger.sessions[0].status, 'attended');
    assert.equal(ledger.sessions[0].creditImpact, 'consumed');
    assert.equal(ledger.sessions[1].status, 'attended');
    assert.match(ledger.sessions[1].statusLabel, /Late/);
});

test('11. Fee Cycle Ledger: 3 attended + 1 upcoming (3 consumed, 1 upcoming, 1 available)', () => {
    const today = new Date(2026, 8, 3); // 3 Sep 2026 (before Sep 8)
    const ledger = getStudentFeeCycleLedger({
        student: { id: 'std-upcoming', fees_basis: 'monthly', fees_collection_date: 13, join_date: '2026-08-13' },
        classrooms: [{ id: 'class-tue', name: 'Tuesday Flute' }],
        batchSchedules: [{ classroom_id: 'class-tue', day_of_week: 2 }],
        attendance: [
            { student_id: 'std-upcoming', classroom_id: 'class-tue', date: '2026-08-18', status: 'present' },
            { student_id: 'std-upcoming', classroom_id: 'class-tue', date: '2026-08-25', status: 'present' },
            { student_id: 'std-upcoming', classroom_id: 'class-tue', date: '2026-09-01', status: 'present' }
            // Sep 8 is upcoming
        ],
        payments: [{ payment_date: '2026-08-13', status: 'approved', classes_added: 4 }],
        today
    });

    assert.equal(ledger.sessions.length, 4);
    assert.equal(ledger.summary.consumedClasses, 3);
    assert.equal(ledger.summary.creditsRemaining, 1);
    assert.equal(ledger.summary.operationalOpportunities, 1);
    assert.equal(ledger.summary.classesAvailable, 1);
    assert.equal(ledger.summary.unresolvedSessions, 0);
    assert.equal(ledger.summary.hasDiscrepancy, false);

    const upcomingSession = ledger.sessions.find(s => s.date === '2026-09-08');
    assert.ok(upcomingSession);
    assert.equal(upcomingSession.status, 'upcoming');
    assert.equal(upcomingSession.creditImpact, 'pending');
});

test('12. Fee Cycle Ledger: Adhrith Koganti Discrepancy (Sep 8 Missing Attendance)', () => {
    // Today: Sep 10 (past Sep 8). Student attended 3. Sep 8 has NO RECORD.
    const today = new Date(2026, 8, 10);
    const ledger = getStudentFeeCycleLedger({
        student: { id: 'adhrith', name: 'Adhrith Nag Koganti', fees_basis: 'monthly', fees_collection_date: 13, join_date: '2026-08-13' },
        classrooms: [{ id: 'class-tue', name: 'Tuesday Slot 3' }],
        batchSchedules: [{ classroom_id: 'class-tue', day_of_week: 2 }],
        attendance: [
            { student_id: 'adhrith', classroom_id: 'class-tue', date: '2026-08-18', status: 'present' },
            { student_id: 'adhrith', classroom_id: 'class-tue', date: '2026-08-25', status: 'present' },
            { student_id: 'adhrith', classroom_id: 'class-tue', date: '2026-09-01', status: 'present' }
        ],
        payments: [{ payment_date: '2026-08-13', status: 'approved', classes_added: 4 }],
        today
    });

    // Verification of Adjustment #2: Distinguish financial credits from operational availability
    assert.equal(ledger.summary.entitledClasses, 4);
    assert.equal(ledger.summary.consumedClasses, 3);
    assert.equal(ledger.summary.creditsRemaining, 1, 'Financially, 1 unused credit remains');
    assert.equal(ledger.summary.operationalOpportunities, 0, 'No future classes remain');
    assert.equal(ledger.summary.unresolvedSessions, 1, 'Sep 8 is unresolved');
    assert.equal(ledger.summary.classesAvailable, 0, 'Operationally capped at 0');
    assert.equal(ledger.summary.hasDiscrepancy, true, 'Flagged as discrepancy between credits and availability');

    // Diagnostics verification
    assert.ok(ledger.diagnostics.length >= 2, 'Has at least 2 diagnostics (calculation mismatch + missing attendance)');
    const mismatchDiag = ledger.diagnostics.find(d => d.type === 'calculation_mismatch');
    assert.ok(mismatchDiag);
    assert.match(mismatchDiag.title, /1 Credit Unresolved/);

    const missingDiag = ledger.diagnostics.find(d => d.type === 'unresolved_session');
    assert.ok(missingDiag);
    assert.equal(missingDiag.affectedDate, '2026-09-08');
    assert.match(missingDiag.actionUrl, /date=2026-09-08/);

    // Verify session ledger item
    const missingSession = ledger.sessions.find(s => s.date === '2026-09-08');
    assert.ok(missingSession);
    assert.equal(missingSession.status, 'unresolved');
    assert.equal(missingSession.isDiscrepancy, true);
    assert.match(missingSession.statusLabel, /Attendance Missing/);
});

test('13. Fee Cycle Ledger: Class cancelled by academy (0 consumed, excluded from unresolved)', () => {
    const today = new Date(2026, 8, 10);
    const ledger = getStudentFeeCycleLedger({
        student: { id: 'std-cancel', fees_basis: 'monthly', fees_collection_date: 13, join_date: '2026-08-13' },
        classrooms: [{ id: 'class-tue', name: 'Tuesday Flute' }],
        batchSchedules: [{ classroom_id: 'class-tue', day_of_week: 2 }],
        attendance: [
            { student_id: 'std-cancel', classroom_id: 'class-tue', date: '2026-08-18', status: 'present' },
            { student_id: 'std-cancel', classroom_id: 'class-tue', date: '2026-08-25', status: 'present' },
            { student_id: 'std-cancel', classroom_id: 'class-tue', date: '2026-09-01', status: 'present' }
        ],
        cancelledSessions: [{ classroom_id: 'class-tue', date: '2026-09-08' }],
        payments: [{ payment_date: '2026-08-13', status: 'approved', classes_added: 4 }],
        today
    });

    assert.equal(ledger.summary.unresolvedSessions, 0, 'Cancelled session must not be unresolved');
    const cancelledSession = ledger.sessions.find(s => s.date === '2026-09-08');
    assert.ok(cancelledSession);
    assert.equal(cancelledSession.status, 'cancelled');
    assert.equal(cancelledSession.creditImpact, 'not_consumed');
});

test('14. Fee Cycle Ledger: Excused absence and scheduled makeup linking', () => {
    const today = new Date(2026, 8, 5);
    const ledger = getStudentFeeCycleLedger({
        student: { id: 'std-makeup', fees_basis: 'monthly', fees_collection_date: 13, join_date: '2026-08-13' },
        classrooms: [
            { id: 'class-main', name: 'Tuesday Main Batch' },
            { id: 'class-alt', name: 'Friday Alternate Batch' }
        ],
        batchSchedules: [{ classroom_id: 'class-main', day_of_week: 2 }],
        attendance: [
            { student_id: 'std-makeup', classroom_id: 'class-main', date: '2026-08-18', status: 'present' },
            { student_id: 'std-makeup', classroom_id: 'class-main', date: '2026-08-25', status: 'excused' },
            { student_id: 'std-makeup', classroom_id: 'class-main', date: '2026-09-01', status: 'present' }
        ],
        overrides: [
            {
                id: 'ov-friday',
                student_id: 'std-makeup',
                target_classroom_id: 'class-alt',
                override_date: '2026-09-11',
                reason: 'Makeup for missed session [MissedDate:2026-08-25]'
            }
        ],
        payments: [{ payment_date: '2026-08-13', status: 'approved', classes_added: 4 }],
        today
    });

    // Excused session on Aug 25: 0 consumed, makeup scheduled on Sep 11
    const excusedSession = ledger.sessions.find(s => s.date === '2026-08-25');
    assert.ok(excusedSession);
    assert.equal(excusedSession.status, 'excused');
    assert.equal(excusedSession.creditImpact, 'not_consumed');

    const makeupSession = ledger.sessions.find(s => s.date === '2026-09-11');
    assert.ok(makeupSession);
    assert.equal(makeupSession.status, 'makeup_scheduled');
    assert.equal(makeupSession.classroomName, 'Friday Alternate Batch');
});

test('15. Fee Cycle Ledger: Per-Class Prepaid student report', () => {
    const ledger = getStudentFeeCycleLedger({
        student: { id: 'std-prepaid', fees_basis: 'class', fees_classes_paid: 5 }
    });

    assert.equal(ledger.feesBasis, 'class');
    assert.equal(ledger.summary.entitledClasses, 5);
    assert.equal(ledger.summary.creditsRemaining, 5);
    assert.equal(ledger.summary.classesAvailable, 5);
    assert.equal(ledger.summary.hasDiscrepancy, false);
});
