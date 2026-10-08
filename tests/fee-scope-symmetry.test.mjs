import test from 'node:test';
import assert from 'node:assert/strict';
import createJiti from 'jiti';

const jiti = createJiti(import.meta.url);
const {
    calculateAuthoritativeFeeStatus,
    calculateStudentFeeCycleMetrics,
    evaluateStudentFeeCycle,
    getStudentBillingCycle,
    buildStudentBillingCycles,
    getStudentFeeStatus
} = jiti('../src/lib/fee-utils.ts');

/**
 * REGRESSION SUITE: DATA-SCOPE INVARIANT & LEDGER SYMMETRY TESTS
 *
 * Verifies that the authoritative class-credit engine requires and enforces
 * symmetrical data scope between payments and attendance consumption.
 */

test('TEST A — Historical Payment + Historical Attendance (Trisha Das Reconciliation)', () => {
    // Trisha Das scenario:
    // Payments:
    // - 01 Aug 2026: +4 classes
    // - 06 Oct 2026: +4 classes
    // Total Purchased = 8
    // Credit-consuming attendance:
    // - 04 Aug: Present (-1)
    // - 11 Aug: Present (-1)
    // - 18 Aug: Absent (-1)
    // - 25 Aug: Absent (-1)
    // - 06 Oct: Present (-1)
    // Total Consumed = 5
    // Authoritative Balance = 8 - 5 = 3

    const payments = [
        { id: 'pay-aug', payment_date: '2026-08-01', amount: 2400, classes_added: 4, status: 'approved' },
        { id: 'pay-oct', payment_date: '2026-10-06', amount: 2400, classes_added: 4, status: 'approved' }
    ];

    const attendance = [
        { id: 'att-1', date: '2026-08-04', status: 'present' },
        { id: 'att-2', date: '2026-08-11', status: 'present' },
        { id: 'att-3', date: '2026-08-18', status: 'absent' },
        { id: 'att-4', date: '2026-08-25', status: 'absent' },
        { id: 'att-5', date: '2026-10-06', status: 'present' }
    ];

    const today = new Date('2026-10-07T08:00:00Z');

    const result = calculateAuthoritativeFeeStatus({
        studentId: 'trisha-id',
        student: {
            id: 'trisha-id',
            fees_basis: 'monthly',
            fees_amount: 2400,
            fees_classes_paid: 3,
            fees_collection_date: 1,
            join_date: '2026-08-01',
            status: 'active'
        },
        payments,
        attendance,
        today
    });

    assert.equal(result.totalPurchasedCredits, 8, 'Total purchased credits must be 8 (4 from Aug + 4 from Oct)');
    assert.equal(result.totalConsumedCredits, 5, 'Total consumed credits must be 5 (4 from Aug + 1 from Oct)');
    assert.equal(result.effectiveBalance, 3, 'Effective balance must equal exactly 3');
    assert.equal(result.financialState, 'GOOD_STANDING', 'Financial state must be GOOD_STANDING');
    assert.equal(result.canJoinLiveClass, true, 'Live class access must be allowed');
    assert.equal(result.needsReconciliation, false, 'No reconciliation discrepancy when stored balance equals 3');
});

test('TEST B — Attendance Older Than 35 Days Must Be Included in Authoritative Balance', () => {
    // If a student made a payment on Aug 1, and classes occurred on Aug 4, 11, 18, 25,
    // on October 7 those August classes are 43-64 days old (> 35 days).
    // The authoritative ledger MUST include them so historical payments are fully consumed.
    const today = new Date('2026-10-07T08:00:00Z');

    const result = calculateStudentFeeCycleMetrics({
        student: {
            id: 'test-student-b',
            fees_basis: 'monthly',
            fees_collection_date: 1,
            join_date: '2026-08-01',
            fees_classes_paid: 3,
            fees_amount: 2400
        },
        classrooms: [{ id: 'cls-1', name: 'Tuesday Slot 3' }],
        batchSchedules: [{ classroom_id: 'cls-1', day_of_week: 2, start_time: '19:30', end_time: '20:30' }],
        payments: [
            { payment_date: '2026-08-01', amount: 2400, classes_added: 4, status: 'approved' },
            { payment_date: '2026-10-06', amount: 2400, classes_added: 4, status: 'approved' }
        ],
        attendance: [
            { date: '2026-08-04', status: 'present', classroom_id: 'cls-1' }, // 64 days old
            { date: '2026-08-11', status: 'present', classroom_id: 'cls-1' }, // 57 days old
            { date: '2026-08-18', status: 'absent', classroom_id: 'cls-1' },  // 50 days old
            { date: '2026-08-25', status: 'absent', classroom_id: 'cls-1' },  // 43 days old
            { date: '2026-10-06', status: 'present', classroom_id: 'cls-1' }  // 1 day old
        ],
        today
    });

    // creditsRemaining must be 3, NEVER 7!
    assert.equal(result.creditsRemaining, 3, 'creditsRemaining must be 3, not 7');
    assert.equal(result.classesAvailable, 3, 'classesAvailable must be 3');
    assert.equal(result.effectiveBalance, 3, 'effectiveBalance must be 3');
    assert.equal(result.formattedDueDate, 'After 3 classes', 'Display due date must read After 3 classes');
});

test('TEST C — Long Pause Between Packages Does Not Affect Replay Balance', () => {
    // Payment May +4
    // 4 May consuming classes
    // Paused for June, July, August, September (4 months)
    // Resume payment Oct +4
    // 1 Oct consuming class
    // Expected: 3
    const today = new Date('2026-10-07T08:00:00Z');

    const result = calculateAuthoritativeFeeStatus({
        studentId: 'paused-student',
        student: {
            id: 'paused-student',
            fees_basis: 'monthly',
            fees_amount: 2400,
            fees_classes_paid: 3,
            fees_collection_date: 1,
            join_date: '2026-05-01',
            status: 'active'
        },
        payments: [
            { payment_date: '2026-05-01', amount: 2400, classes_added: 4, status: 'approved' },
            { payment_date: '2026-10-01', amount: 2400, classes_added: 4, status: 'approved' }
        ],
        attendance: [
            { date: '2026-05-05', status: 'present' },
            { date: '2026-05-12', status: 'present' },
            { date: '2026-05-19', status: 'present' },
            { date: '2026-05-26', status: 'present' },
            { date: '2026-10-06', status: 'present' }
        ],
        today
    });

    assert.equal(result.totalPurchasedCredits, 8);
    assert.equal(result.totalConsumedCredits, 5);
    assert.equal(result.effectiveBalance, 3);
    assert.equal(result.financialState, 'GOOD_STANDING');
});

test('TEST D — Very Old Student (> 1 Year History) Calculates Accurately', () => {
    // 1 year old history: 12 payments of 4 classes = 48 classes purchased
    // 46 classes attended/absent
    // Expected balance = 48 - 46 = 2
    const payments = [];
    const attendance = [];

    for (let m = 0; m < 12; m++) {
        const y = 2025 + Math.floor(m / 12);
        const mo = String((m % 12) + 1).padStart(2, '0');
        payments.push({
            payment_date: `${y}-${mo}-01`,
            amount: 2400,
            classes_added: 4,
            status: 'approved'
        });
        // 4 classes for first 11 months, 2 classes for 12th month
        const count = m === 11 ? 2 : 4;
        for (let c = 1; c <= count; c++) {
            const day = String(c * 7).padStart(2, '0');
            attendance.push({
                date: `${y}-${mo}-${day}`,
                status: 'present'
            });
        }
    }

    const result = calculateAuthoritativeFeeStatus({
        studentId: 'veteran-student',
        student: {
            id: 'veteran-student',
            fees_basis: 'monthly',
            fees_amount: 2400,
            fees_classes_paid: 2,
            join_date: '2025-01-01',
            status: 'active'
        },
        payments,
        attendance,
        today: new Date('2026-01-15')
    });

    assert.equal(result.totalPurchasedCredits, 48);
    assert.equal(result.totalConsumedCredits, 46);
    assert.equal(result.effectiveBalance, 2);
    assert.equal(result.financialState, 'GOOD_STANDING');
});

test('TEST E — Scope Symmetry Invariant Flags Truncated Attendance Window', () => {
    // If an explicit attendance window lower-bound (e.g. 2026-08-27) is declared,
    // but payments precede it (e.g. 2026-08-01), the engine MUST detect and flag the asymmetry.
    const result = calculateAuthoritativeFeeStatus({
        studentId: 'trisha-asymmetric',
        student: {
            id: 'trisha-asymmetric',
            fees_basis: 'monthly',
            fees_amount: 2400,
            fees_classes_paid: 3,
            join_date: '2026-08-01',
            status: 'active'
        },
        payments: [
            { payment_date: '2026-08-01', amount: 2400, classes_added: 4, status: 'approved' },
            { payment_date: '2026-10-06', amount: 2400, classes_added: 4, status: 'approved' }
        ],
        attendance: [
            { date: '2026-10-06', status: 'present' } // Only post-Aug 27 attendance provided
        ],
        attendanceScopeStartDate: '2026-08-27',
        today: new Date('2026-10-07')
    });

    assert.equal(result.needsReconciliation, true, 'Engine must flag needsReconciliation on scope asymmetry');
    assert.match(
        result.reconciliationReason || '',
        /Asymmetric ledger scope/,
        'Reason must explicitly identify the asymmetric ledger scope'
    );
});

test('TEST F — Cross-Dashboard Consistency for Trisha', () => {
    // Both Teacher Dashboard logic and Student Dashboard logic must produce identical results
    const student = {
        id: '9893770a-6806-4a80-ba5d-de6f43e994b3',
        name: 'Trisha Das',
        fees_basis: 'monthly',
        fees_collection_date: 1,
        join_date: '2026-08-01',
        fees_classes_paid: 3,
        fees_amount: 2400,
        status: 'active'
    };

    const payments = [
        { id: 'p1', student_id: student.id, payment_date: '2026-08-01', amount: 2400, classes_added: 4, status: 'approved' },
        { id: 'p2', student_id: student.id, payment_date: '2026-10-06', amount: 2400, classes_added: 4, status: 'approved' }
    ];

    const fullAttendance = [
        { id: 'a1', student_id: student.id, date: '2026-08-04', status: 'present', classroom_id: 'c1' },
        { id: 'a2', student_id: student.id, date: '2026-08-11', status: 'present', classroom_id: 'c1' },
        { id: 'a3', student_id: student.id, date: '2026-08-18', status: 'absent', classroom_id: 'c1' },
        { id: 'a4', student_id: student.id, date: '2026-08-25', status: 'absent', classroom_id: 'c1' },
        { id: 'a5', student_id: student.id, date: '2026-10-06', status: 'present', classroom_id: 'c1' }
    ];

    const today = new Date('2026-10-07T08:00:00Z');

    // 1. Authoritative ledger calculation
    const authStatus = calculateAuthoritativeFeeStatus({
        studentId: student.id,
        student,
        payments,
        attendance: fullAttendance,
        today
    });

    // 2. Teacher Dashboard metrics evaluation (now supplied with full attendance)
    const teacherMetrics = calculateStudentFeeCycleMetrics({
        student,
        classrooms: [{ id: 'c1', name: 'Tuesday Slot 3' }],
        batchSchedules: [{ classroom_id: 'c1', day_of_week: 2, start_time: '19:30', end_time: '20:30' }],
        payments,
        attendance: fullAttendance,
        today
    });

    // 3. Student Dashboard FeesTab calculation
    const studentDashboardCredits = teacherMetrics.creditsRemaining;

    // Assert absolute consistency across all 4 surfaces
    assert.equal(authStatus.effectiveBalance, 3, 'Authoritative ledger balance is 3');
    assert.equal(student.fees_classes_paid, 3, 'Stored users.fees_classes_paid is 3');
    assert.equal(teacherMetrics.classesAvailable, 3, 'Teacher Dashboard classesAvailable is 3');
    assert.equal(teacherMetrics.creditsRemaining, 3, 'Teacher Dashboard creditsRemaining is 3');
    assert.equal(studentDashboardCredits, 3, 'Student Dashboard creditsRemaining is 3');
    assert.equal(teacherMetrics.formattedDueDate, 'After 3 classes', 'Teacher Dashboard Next Collection is After 3 classes');
    assert.equal(authStatus.financialState, 'GOOD_STANDING', 'Financial state is GOOD_STANDING');
    assert.equal(authStatus.canJoinLiveClass, true, 'canJoinLiveClass is true');
});

test('TEST G — Dr. Naveen Kumar. C Reconciliation Scenario (Late Renewal & Due Day Preservation)', () => {
    // Dr. Naveen Kumar. C scenario:
    // Join Date: 22 Aug 2026, Fee Collection Day: 22
    // 1. Initial onboarding payment: 22 Aug +4 credits (settles 22 Aug cycle)
    // 2. 4 scheduled classes consumed (22 Aug, 29 Aug [on-behalf of 12 Sep], 5 Sep, 19 Sep) -> Balance: 0
    // 3. Additional class: 26 Sep -> Balance: -1
    // 4. Late renewal payment: 29 Sep +4 credits (settles 22 Sep cycle late) -> Balance: +3
    // 5. Next class: 3 Oct -> Balance: +2
    //
    // Required Invariants:
    // - Authoritative Balance = 2
    // - Financial State = GOOD_STANDING
    // - canJoinLiveClass = true
    // - 22 Aug Cycle = Settled / Paid on time
    // - 22 Sep Cycle = Settled late (paid_late) by 29 Sep payment
    // - Next Scheduled Due = 22 Oct 2026 (Due day stays 22, NEVER shifts to 29!)

    const student = {
        id: 'naveen-id',
        name: 'Dr. Naveen Kumar. C',
        fees_basis: 'monthly',
        fees_amount: 2400,
        fees_classes_paid: 2,
        fees_collection_date: 22,
        join_date: '2026-08-22',
        status: 'active'
    };

    const payments = [
        { id: 'p-aug', payment_date: '2026-08-22', amount: 2400, classes_added: 4, status: 'approved' },
        { id: 'p-sep', payment_date: '2026-09-29', amount: 2400, classes_added: 4, status: 'approved' }
    ];

    const attendance = [
        { id: 'a1', student_id: student.id, date: '2026-08-22', status: 'present', classroom_id: 'c1' },
        { id: 'a2', student_id: student.id, date: '2026-08-29', status: 'present', on_behalf_of_date: '2026-09-12', classroom_id: 'c1' },
        { id: 'a3', student_id: student.id, date: '2026-09-05', status: 'present', classroom_id: 'c1' },
        { id: 'a4', student_id: student.id, date: '2026-09-19', status: 'present', classroom_id: 'c1' },
        { id: 'a5', student_id: student.id, date: '2026-09-26', status: 'present', classroom_id: 'c1' },
        { id: 'a6', student_id: student.id, date: '2026-10-03', status: 'present', classroom_id: 'c1' }
    ];

    const today = new Date('2026-10-07T10:00:00Z');

    // 1. Authoritative Status
    const authStatus = calculateAuthoritativeFeeStatus({
        studentId: student.id,
        student,
        payments,
        attendance,
        today
    });

    assert.equal(authStatus.totalPurchasedCredits, 8, 'Total purchased credits is 8');
    assert.equal(authStatus.totalConsumedCredits, 6, 'Total consumed credits is 6');
    assert.equal(authStatus.effectiveBalance, 2, 'Authoritative balance is 2');
    assert.equal(authStatus.financialState, 'GOOD_STANDING', 'Financial state is GOOD_STANDING');
    assert.equal(authStatus.canJoinLiveClass, true, 'Live class access is allowed');
    assert.equal(authStatus.needsReconciliation, false, 'Needs reconciliation is false');

    // 2. Billing Cycles & FIFO Late Allocation
    const cycleInfo = buildStudentBillingCycles(student.fees_collection_date, payments, today, student.join_date, student.status);
    const cycles = cycleInfo.cycles;

    // Cycle 0: 22 Aug -> 22 Sep
    assert.equal(cycles[0].dueDate, '2026-08-22');
    assert.equal(cycles[0].isPaid, true, '22 Aug cycle is settled');
    assert.equal(cycles[0].paymentStatus, 'paid_on_time', '22 Aug cycle was paid on time');
    assert.equal(cycles[0].allocatedPayment.payment_date, '2026-08-22');

    // Cycle 1: 22 Sep -> 22 Oct
    assert.equal(cycles[1].dueDate, '2026-09-22');
    assert.equal(cycles[1].isPaid, true, '22 Sep cycle is settled late');
    assert.equal(cycles[1].paymentStatus, 'paid_late', '22 Sep cycle was paid late');
    assert.equal(cycles[1].allocatedPayment.payment_date, '2026-09-29');

    // Cycle 2: 22 Oct -> 22 Nov
    assert.equal(cycles[2].dueDate, '2026-10-22');
    assert.equal(cycles[2].isPaid, false, '22 Oct cycle is future unpaid cycle');

    // Verify Next Scheduled Due date is 22 Oct (collection day 22 is preserved, NOT 29!)
    const feeStatus = getStudentFeeStatus(
        student.fees_basis,
        student.fees_collection_date,
        payments,
        today,
        student.join_date,
        student.status,
        null,
        null,
        authStatus.effectiveBalance
    );

    assert.equal(feeStatus.status, 'good', 'Fee status is good');
    assert.equal(feeStatus.unpaidCyclesCount, 0, 'Zero unpaid overdue cycles');
    assert.equal(cycles[2].dueDate, '2026-10-22', 'Next scheduled due date strictly preserves configured Due Day 22 (never shifts to 29)');
});

