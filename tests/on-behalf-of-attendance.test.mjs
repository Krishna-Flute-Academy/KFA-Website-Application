import test from 'node:test';
import assert from 'node:assert/strict';
import createJiti from 'jiti';

const jiti = createJiti(import.meta.url);
const {
    calculateStudentFeeCycleMetrics,
    getStudentFeeCycleLedger
} = jiti('../src/lib/fee-utils.ts');

test('On-Behalf-Of Attendance: Core Saturday Batch Acceptance Scenario (Aug/Sep)', () => {
    // Student enrolled in Saturday batch
    const student = {
        id: 'student-sat-01',
        name: 'Saturday Student',
        fees_basis: 'monthly',
        fees_collection_date: 1, // 1st of month: cycleStart = 2026-08-01, nextDueDate = 2026-09-01
        join_date: '2026-01-01',
        status: 'active'
    };

    const classrooms = [{ id: 'cls-sat', name: 'Saturday Flute Batch' }];
    // Saturday = day_of_week 6
    const batchSchedules = [{ classroom_id: 'cls-sat', day_of_week: 6, start_time: '10:00', end_time: '11:00' }];

    // Physical attendance records:
    // Aug 1 -> Present
    // Aug 8 -> Present
    // Aug 15 -> Present
    // Aug 22 -> Present
    // Aug 29 -> Present, taken on behalf of Sep 5
    const attendance = [
        { id: 'a1', student_id: 'student-sat-01', classroom_id: 'cls-sat', date: '2026-08-01', status: 'present' },
        { id: 'a2', student_id: 'student-sat-01', classroom_id: 'cls-sat', date: '2026-08-08', status: 'present' },
        { id: 'a3', student_id: 'student-sat-01', classroom_id: 'cls-sat', date: '2026-08-15', status: 'present' },
        { id: 'a4', student_id: 'student-sat-01', classroom_id: 'cls-sat', date: '2026-08-22', status: 'present' },
        { id: 'a5', student_id: 'student-sat-01', classroom_id: 'cls-sat', date: '2026-08-29', status: 'present', on_behalf_of_date: '2026-09-05' }
    ];

    // Payments: August fee paid
    const payments = [
        { payment_date: '2026-08-01', amount: 3000, status: 'approved' }
    ];

    // Evaluate August Cycle (as of Aug 30)
    const augLedger = getStudentFeeCycleLedger({
        student,
        classrooms,
        batchSchedules,
        attendance,
        payments,
        today: new Date('2026-08-30T10:00:00Z')
    });

    // 1. August metrics: exactly 4 classes consumed (Aug 1, 8, 15, 22)
    assert.equal(augLedger.summary.entitledClasses, 4, 'August entitlement must be 4 classes');
    assert.equal(augLedger.summary.consumedClasses, 4, 'August consumed must be 4 classes (not 5)');
    assert.equal(augLedger.summary.creditsRemaining, 0, 'August credits remaining must be 0 (cycle complete)');
    assert.equal(augLedger.summary.classesAvailable, 0, 'August classes available must be 0');
    assert.equal(augLedger.summary.unresolvedSessions, 0, 'August must have 0 unresolved sessions');
    assert.equal(augLedger.summary.hasDiscrepancy, false, 'August has no discrepancy');

    // Check August sessions list
    const augSessions = augLedger.sessions;
    assert.equal(augSessions.length, 5, 'August has 5 Saturday occurrences');

    const aug29Session = augSessions.find(s => s.date === '2026-08-29');
    assert.ok(aug29Session, 'Aug 29 session should exist in ledger');
    assert.equal(aug29Session.status, 'attended');
    assert.equal(aug29Session.creditImpact, 'not_consumed', 'Aug 29 must NOT consume credit in August');
    assert.equal(aug29Session.onBehalfOfDate, '2026-09-05');
    assert.equal(aug29Session.isDiscrepancy, false);

    // Now evaluate September Cycle (as of Sep 6, after Sep 5 has passed)
    // September payment made
    const sepPayments = [
        ...payments,
        { payment_date: '2026-09-01', amount: 3000, status: 'approved' }
    ];

    const sepLedger = getStudentFeeCycleLedger({
        student,
        classrooms,
        batchSchedules,
        attendance,
        payments: sepPayments,
        today: new Date('2026-09-06T10:00:00Z')
    });

    // 2. September metrics:
    // Sep 5 was satisfied by Aug 29 attendance!
    // Therefore Sep 5 has 1 consumed class (Class 1)
    // Sep 12, 19, 26 are upcoming
    assert.equal(sepLedger.summary.entitledClasses, 4, 'September entitlement must be 4 classes');
    assert.equal(sepLedger.summary.consumedClasses, 1, 'Sep 5 satisfied by Aug 29 counts as 1 consumed class in September');
    assert.equal(sepLedger.summary.creditsRemaining, 3, 'September credits remaining is 3');
    assert.equal(sepLedger.summary.unresolvedSessions, 0, 'Sep 5 must NOT appear as Attendance Missing');
    assert.equal(sepLedger.summary.hasDiscrepancy, false, 'No discrepancy in September');

    const sep5Session = sepLedger.sessions.find(s => s.date === '2026-09-05');
    assert.ok(sep5Session, 'Sep 5 session must exist in September ledger');
    assert.equal(sep5Session.status, 'attended', 'Sep 5 must be marked attended');
    assert.equal(sep5Session.creditImpact, 'consumed', 'Sep 5 consumes 1 class credit');
    assert.equal(sep5Session.actualDate, '2026-08-29', 'Actual attendance date was Aug 29');
    assert.match(sep5Session.statusLabel, /Satisfied by.*class/, 'Status label notes that Sep 5 was satisfied');

    // 3. Now complete remaining September classes: Sep 12, 19, 26
    const completedAttendance = [
        ...attendance,
        { id: 'a6', student_id: 'student-sat-01', classroom_id: 'cls-sat', date: '2026-09-12', status: 'present' },
        { id: 'a7', student_id: 'student-sat-01', classroom_id: 'cls-sat', date: '2026-09-19', status: 'present' },
        { id: 'a8', student_id: 'student-sat-01', classroom_id: 'cls-sat', date: '2026-09-26', status: 'present' }
    ];

    const sepCompletedLedger = getStudentFeeCycleLedger({
        student,
        classrooms,
        batchSchedules,
        attendance: completedAttendance,
        payments: sepPayments,
        today: new Date('2026-09-27T10:00:00Z')
    });

    assert.equal(sepCompletedLedger.summary.entitledClasses, 4, 'September entitled = 4');
    assert.equal(sepCompletedLedger.summary.consumedClasses, 4, 'September completed exactly 4/4');
    assert.equal(sepCompletedLedger.summary.creditsRemaining, 0, 'September credits remaining = 0');
    assert.equal(sepCompletedLedger.summary.classesAvailable, 0, 'September cycle complete');
    assert.equal(sepCompletedLedger.summary.unresolvedSessions, 0, '0 unresolved sessions');
});

test('On-Behalf-Of Attendance: Absent and Excused on behalf of target date', () => {
    const student = {
        id: 'student-sat-02',
        fees_basis: 'monthly',
        fees_collection_date: 1,
        join_date: '2026-01-01',
        status: 'active'
    };
    const classrooms = [{ id: 'cls-sat', name: 'Saturday Batch' }];
    const batchSchedules = [{ classroom_id: 'cls-sat', day_of_week: 6 }];

    // Physical Aug 29 was marked 'absent' on behalf of Sep 5
    const attendanceAbsent = [
        { id: 'a1', student_id: 'student-sat-02', classroom_id: 'cls-sat', date: '2026-08-29', status: 'absent', on_behalf_of_date: '2026-09-05' }
    ];
    const payments = [{ payment_date: '2026-09-01', amount: 3000, status: 'approved' }];

    const ledger = getStudentFeeCycleLedger({
        student,
        classrooms,
        batchSchedules,
        attendance: attendanceAbsent,
        payments,
        today: new Date('2026-09-06T10:00:00Z')
    });

    // In September, Sep 5 reflects unexcused absence
    const sep5 = ledger.sessions.find(s => s.date === '2026-09-05');
    assert.ok(sep5);
    assert.equal(sep5.status, 'absent');
    assert.equal(sep5.creditImpact, 'consumed', 'Unexcused absence on behalf consumes credit');
    assert.equal(ledger.summary.unresolvedSessions, 0, 'No missing attendance warning');
});
