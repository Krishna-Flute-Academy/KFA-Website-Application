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

const {
    isQualifyingAlternativeAttendance,
    buildCoveredAttendanceMap
} = jiti('../src/lib/on-behalf-attendance.ts');

test('On-Behalf-Of Lock: Recorded statuses (present, late, absent, excused) lock target date', () => {
    const scheduledDate = '2026-09-12';

    // Present on 29 Aug on behalf of 12 Sept
    assert.equal(
        isQualifyingAlternativeAttendance(
            { date: '2026-08-29', on_behalf_of_date: '2026-09-12', status: 'present' },
            scheduledDate
        ),
        true,
        'Present on alternative date must qualify as covered'
    );

    // Late on 29 Aug on behalf of 12 Sept
    assert.equal(
        isQualifyingAlternativeAttendance(
            { date: '2026-08-29', on_behalf_of_date: '2026-09-12', status: 'late' },
            scheduledDate
        ),
        true,
        'Late on alternative date must qualify as covered'
    );

    // Absent on 29 Aug on behalf of 12 Sept - attendance outcome decided as absent
    assert.equal(
        isQualifyingAlternativeAttendance(
            { date: '2026-08-29', on_behalf_of_date: '2026-09-12', status: 'absent' },
            scheduledDate
        ),
        true,
        'Absent on alternative date represents finalized attendance outcome and must lock student on target date'
    );

    // Excused on 29 Aug on behalf of 12 Sept - attendance outcome decided as excused
    assert.equal(
        isQualifyingAlternativeAttendance(
            { date: '2026-08-29', on_behalf_of_date: '2026-09-12', status: 'excused' },
            scheduledDate
        ),
        true,
        'Excused on alternative date represents finalized attendance outcome and must lock student on target date'
    );
});

test('On-Behalf-Of Lock: Self-matching guard prevents matching current date row as alternative', () => {
    const scheduledDate = '2026-09-12';

    // Row on 12 Sept with on_behalf_of_date = 12 Sept (self-date)
    assert.equal(
        isQualifyingAlternativeAttendance(
            { date: '2026-09-12', on_behalf_of_date: '2026-09-12', status: 'present' },
            scheduledDate
        ),
        false,
        'Attendance row on scheduled date itself must never self-match as an alternative covering attendance'
    );
});

test('On-Behalf-Of Lock: Partial Batch scenario on scheduled date', () => {
    const targetScheduledDate = '2026-09-12';

    const dbRows = [
        // Student A: Present on 29 Aug on behalf of 12 Sept
        { id: 'att-1', student_id: 'student-A', classroom_id: 'cls-1', date: '2026-08-29', status: 'present', on_behalf_of_date: '2026-09-12' },
        // Student B: Late on 29 Aug on behalf of 12 Sept
        { id: 'att-2', student_id: 'student-B', classroom_id: 'cls-1', date: '2026-08-29', status: 'late', on_behalf_of_date: '2026-09-12' },
        // Student C: Absent on 29 Aug on behalf of 12 Sept
        { id: 'att-3', student_id: 'student-C', classroom_id: 'cls-1', date: '2026-08-29', status: 'absent', on_behalf_of_date: '2026-09-12' },
        // Student D: Unmarked on 29 Aug (no row)
    ];

    const coveredMap = buildCoveredAttendanceMap(dbRows, targetScheduledDate);

    // Students A, B, and C received attendance outcomes on 29 Aug, so all 3 must be locked on 12 Sept
    assert.ok(coveredMap['student-A'], 'Student A must be locked on 12 Sept');
    assert.equal(coveredMap['student-A'].actualDate, '2026-08-29');
    assert.equal(coveredMap['student-A'].status, 'present');

    assert.ok(coveredMap['student-B'], 'Student B must be locked on 12 Sept');
    assert.equal(coveredMap['student-B'].actualDate, '2026-08-29');
    assert.equal(coveredMap['student-B'].status, 'late');

    assert.ok(coveredMap['student-C'], 'Student C must be locked on 12 Sept with absent status');
    assert.equal(coveredMap['student-C'].actualDate, '2026-08-29');
    assert.equal(coveredMap['student-C'].status, 'absent');

    // Only Student D was genuinely unmarked on 29 Aug, so must remain editable on 12 Sept
    assert.equal(coveredMap['student-D'], undefined, 'Student D was unmarked on 29 Aug, so must remain editable on 12 Sept');
});

test('On-Behalf-Of Attendance: Real Saturday Slot 1 Acceptance Scenario (29 Aug -> 12 Sept)', () => {
    // 29 Aug 2026 — Saturday Slot 1
    // Class taken on behalf of 12 Sept:
    // Snigdha Dani -> PRESENT
    // Paramasivam Mukherjee -> PRESENT
    // Divya AP -> ABSENT
    const targetScheduledDate = '2026-09-12';
    const dbRows29Aug = [
        { id: 'att-snigdha', student_id: 'snigdha-id', classroom_id: 'slot-1', date: '2026-08-29', status: 'present', on_behalf_of_date: '2026-09-12' },
        { id: 'att-param', student_id: 'param-id', classroom_id: 'slot-1', date: '2026-08-29', status: 'present', on_behalf_of_date: '2026-09-12' },
        { id: 'att-divya', student_id: 'divya-id', classroom_id: 'slot-1', date: '2026-08-29', status: 'absent', on_behalf_of_date: '2026-09-12' }
    ];

    const coveredMap = buildCoveredAttendanceMap(dbRows29Aug, targetScheduledDate);

    // All 3 students are locked and have their exact mapped status
    assert.ok(coveredMap['snigdha-id']);
    assert.equal(coveredMap['snigdha-id'].status, 'present');
    assert.equal(coveredMap['snigdha-id'].actualDate, '2026-08-29');

    assert.ok(coveredMap['param-id']);
    assert.equal(coveredMap['param-id'].status, 'present');
    assert.equal(coveredMap['param-id'].actualDate, '2026-08-29');

    assert.ok(coveredMap['divya-id']);
    assert.equal(coveredMap['divya-id'].status, 'absent');
    assert.equal(coveredMap['divya-id'].actualDate, '2026-08-29');

    // Simulate batch header summary calculation on 12 Sept
    const permRows = [
        { classroom_id: 'slot-1', student_id: 'snigdha-id', users: { status: 'active' } },
        { classroom_id: 'slot-1', student_id: 'param-id', users: { status: 'active' } },
        { classroom_id: 'slot-1', student_id: 'divya-id', users: { status: 'active' } }
    ];
    const physicalAtt12Sept = []; // No physical rows for 12 Sept

    const stats = { present: 0, absent: 0, late: 0, excused: 0 };
    permRows.forEach(r => {
        const cov = coveredMap[r.student_id];
        if (cov) {
            if (cov.status === 'present') stats.present++;
            else if (cov.status === 'late') stats.late++;
            else if (cov.status === 'absent') stats.absent++;
            else if (cov.status === 'excused') stats.excused++;
        }
    });

    const totalMarked = stats.present + stats.late + stats.absent + stats.excused;
    assert.equal(stats.present, 2, '2 students present');
    assert.equal(stats.absent, 1, '1 student absent');
    assert.equal(totalMarked, 3, 'All 3 students are marked');
    assert.equal(permRows.length, 3, 'Total roster is 3');
    // Result on 12 Sept is MARKED 3/3!
});

test('On-Behalf-Of Lock: Clearing mapping immediately unlocks student on scheduled date', () => {
    const targetScheduledDate = '2026-09-12';

    // Admin cleared on_behalf_of_date on 29 Aug
    const dbRowsCleared = [
        { id: 'att-1', student_id: 'student-A', classroom_id: 'cls-1', date: '2026-08-29', status: 'present', on_behalf_of_date: null }
    ];

    const coveredMap = buildCoveredAttendanceMap(dbRowsCleared, targetScheduledDate);
    assert.equal(coveredMap['student-A'], undefined, 'Student A must be immediately unlocked when mapping is cleared');
});

test('On-Behalf-Of Lock: Changing mapping moves lock to the new scheduled date', () => {
    // Admin changes mapping from 12 Sept to 19 Sept
    const dbRowsChanged = [
        { id: 'att-1', student_id: 'student-A', classroom_id: 'cls-1', date: '2026-08-29', status: 'present', on_behalf_of_date: '2026-09-19' }
    ];

    // Check 12 Sept: should NOT be locked
    const covered12Sept = buildCoveredAttendanceMap(dbRowsChanged, '2026-09-12');
    assert.equal(covered12Sept['student-A'], undefined, 'Student A must not be locked on 12 Sept');

    // Check 19 Sept: should BE locked
    const covered19Sept = buildCoveredAttendanceMap(dbRowsChanged, '2026-09-19');
    assert.ok(covered19Sept['student-A'], 'Student A must be locked on 19 Sept');
    assert.equal(covered19Sept['student-A'].actualDate, '2026-08-29');
});

test('On-Behalf-Of Lock: Guest and Makeup students are isolated by student_id', () => {
    const targetScheduledDate = '2026-09-12';

    const dbRows = [
        // Regular student in Class 1
        { id: 'att-1', student_id: 'student-1', classroom_id: 'cls-1', date: '2026-08-29', status: 'present', on_behalf_of_date: '2026-09-12' },
        // Guest/Makeup student attending Class 1 on 29 Aug
        { id: 'att-guest', student_id: 'guest-student', classroom_id: 'cls-1', date: '2026-08-29', status: 'present', on_behalf_of_date: '2026-09-12' },
        // Another student in Class 2 who was NOT marked on behalf of 12 Sept
        { id: 'att-2', student_id: 'student-2', classroom_id: 'cls-2', date: '2026-08-29', status: 'present', on_behalf_of_date: null }
    ];

    const coveredMap = buildCoveredAttendanceMap(dbRows, targetScheduledDate);

    assert.ok(coveredMap['student-1'], 'Student 1 is locked');
    assert.ok(coveredMap['guest-student'], 'Guest student is locked strictly by student_id');
    assert.equal(coveredMap['student-2'], undefined, 'Student 2 is not locked');
});

