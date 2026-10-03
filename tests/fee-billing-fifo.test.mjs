import test from 'node:test';
import assert from 'node:assert/strict';
import createJiti from 'jiti';

const jiti = createJiti(import.meta.url);
const {
    getStudentFeeStatus,
    getStudentBillingCycle,
    buildStudentBillingCycles,
    getClosestDueDate,
    getCycleContainingDate,
    evaluateStudentFeeCycle,
    getStudentFeeCycleLedger
} = jiti('../src/lib/fee-utils.ts');

test('FIFO Rule 1 & 2: Late payment 25 days after due date settles oldest unpaid cycle (Sudhanva Scenario)', () => {
    // Student: Collection day 8. Joined Aug 10, 2026.
    // Payment 1: Aug 10, 2026 -> settles Aug 8 cycle.
    // Due: Sep 8, 2026.
    // Late Payment made on: Oct 3, 2026 (25 days after Sep 8, but only 5 days before Oct 8).
    const payments = [
        { payment_date: '2026-08-10', amount: 2000, status: 'approved' },
        { payment_date: '2026-10-03', amount: 2000, status: 'approved' }
    ];

    const today = new Date('2026-10-03T12:00:00Z');
    const { cycles } = buildStudentBillingCycles(8, payments, today, '2026-08-10', 'active');

    // Cycle 0: 2026-08-08 -> paid by Aug 10 payment
    const augCycle = cycles.find(c => c.dueDate === '2026-08-08');
    assert.ok(augCycle, 'August cycle exists');
    assert.equal(augCycle.isPaid, true, 'August cycle is paid');
    assert.equal(augCycle.allocatedPayment.payment_date, '2026-08-10');

    // Cycle 1: 2026-09-08 -> MUST be settled by Oct 3 payment (FIFO!), NOT Oct 8!
    const sepCycle = cycles.find(c => c.dueDate === '2026-09-08');
    assert.ok(sepCycle, 'September cycle exists');
    assert.equal(sepCycle.isPaid, true, 'September cycle is settled by FIFO payment');
    assert.equal(sepCycle.allocatedPayment.payment_date, '2026-10-03', 'Oct 3 payment is allocated to Sep 8 cycle');
    assert.equal(sepCycle.isLate, true, 'Marked as paid late');
    assert.equal(sepCycle.paymentStatus, 'paid_late');

    // Cycle 2: 2026-10-08 -> Remains unpaid, next due in 5 days
    const octCycle = cycles.find(c => c.dueDate === '2026-10-08');
    assert.ok(octCycle, 'October cycle exists');
    assert.equal(octCycle.isPaid, false, 'October cycle is NOT yet paid');

    // Overall status on Oct 3 after payment: Good standing, next due 8 Oct
    const status = getStudentFeeStatus('monthly', 8, payments, today, '2026-08-10', 'active');
    assert.equal(status.status, 'good');
    assert.equal(status.formattedDueDate, '8 October');
    assert.equal(status.diffDays, 5);
    assert.equal(status.unpaidCyclesCount, 0);
});

test('FIFO Rule 3 & 6: Overdue status detected across calendar month rollover before payment (Sudhanva Oct 3 before payment)', () => {
    // Sudhanva on Oct 3 BEFORE 3 Oct payment is entered:
    // Only Aug 10 payment exists in DB. Sep 8 was never paid.
    const paymentsBeforeOct3 = [
        { payment_date: '2026-08-10', amount: 2000, status: 'approved' }
    ];

    const today = new Date('2026-10-03T12:00:00Z');
    const status = getStudentFeeStatus('monthly', 8, paymentsBeforeOct3, today, '2026-08-10', 'active');

    // MUST NOT report 'good'! Sep 8 obligation is overdue by 25 days!
    assert.equal(status.status, 'overdue', 'Student must report overdue, NOT good standing');
    assert.equal(status.formattedDueDate, '8 September', 'Overdue date reports 8 September');
    assert.equal(status.diffDays, -25, 'Diff days is -25');
    assert.equal(status.unpaidCyclesCount, 1, '1 unpaid past cycle detected');

    // Active billing cycle check
    const cycle = getStudentBillingCycle(8, paymentsBeforeOct3, today, '2026-08-10', 'active');
    assert.equal(cycle.feeStatus, 'overdue');
    assert.equal(cycle.cycleStart, '2026-09-08');
    assert.equal(cycle.nextDueDate, '2026-10-08');
    assert.equal(cycle.isPaid, false, 'Current cycle is unpaid');
});

test('FIFO Scenario: Multiple unpaid cycles settled strictly oldest first', () => {
    // Student missed Sep 8 and Oct 8.
    // Makes a payment on Nov 2.
    const payments = [
        { payment_date: '2026-08-08', amount: 2000, status: 'approved' },
        { payment_date: '2026-11-02', amount: 2000, status: 'approved' }
    ];

    const today = new Date('2026-11-02T12:00:00Z');
    const { cycles } = buildStudentBillingCycles(8, payments, today, '2026-08-08', 'active');

    const sepCycle = cycles.find(c => c.dueDate === '2026-09-08');
    const octCycle = cycles.find(c => c.dueDate === '2026-10-08');
    const novCycle = cycles.find(c => c.dueDate === '2026-11-08');

    // Nov 2 payment MUST settle Sep 8 (oldest unpaid), NOT Oct 8 or Nov 8!
    assert.equal(sepCycle.isPaid, true);
    assert.equal(sepCycle.allocatedPayment.payment_date, '2026-11-02');
    assert.equal(sepCycle.paymentStatus, 'paid_late');

    // Oct 8 remains unpaid and overdue!
    assert.equal(octCycle.isPaid, false);
    assert.equal(octCycle.paymentStatus, 'overdue');

    // Nov 8 is future/upcoming
    assert.equal(novCycle.isPaid, false);

    // Status on Nov 2: Still overdue because Oct 8 is outstanding
    const status = getStudentFeeStatus('monthly', 8, payments, today, '2026-08-08', 'active');
    assert.equal(status.status, 'overdue');
    assert.equal(status.formattedDueDate, '8 October');
    assert.equal(status.unpaidCyclesCount, 1);
});

test('FIFO Scenario: Explicit payment allocation targets override default FIFO', () => {
    const payments = [
        { payment_date: '2026-08-08', status: 'approved' },
        { payment_date: '2026-10-05', status: 'approved', allocated_due_date: '2026-10-08' }
    ];

    const today = new Date('2026-10-05T12:00:00Z');
    const { cycles } = buildStudentBillingCycles(8, payments, today, '2026-08-08', 'active');

    const sepCycle = cycles.find(c => c.dueDate === '2026-09-08');
    const octCycle = cycles.find(c => c.dueDate === '2026-10-08');

    assert.equal(octCycle.isPaid, true, 'Oct cycle settled via explicit allocation');
    assert.equal(sepCycle.isPaid, false, 'Sep cycle remained unpaid');
});

test('FIFO Scenario: Advance payment for future cycle when current is settled', () => {
    // Both Aug 8 and Sep 8 are paid. On Sep 25, student pays in advance for Oct 8.
    const payments = [
        { payment_date: '2026-08-08', status: 'approved' },
        { payment_date: '2026-09-08', status: 'approved' },
        { payment_date: '2026-09-25', status: 'approved' }
    ];

    const today = new Date('2026-09-26T12:00:00Z');
    const { cycles } = buildStudentBillingCycles(8, payments, today, '2026-08-08', 'active');

    const octCycle = cycles.find(c => c.dueDate === '2026-10-08');
    assert.equal(octCycle.isPaid, true, 'October cycle settled in advance');
    assert.equal(octCycle.isLate, false, 'Not late');

    const novCycle = cycles.find(c => c.dueDate === '2026-11-08');
    assert.equal(novCycle.isPaid, false);

    const status = getStudentFeeStatus('monthly', 8, payments, today, '2026-08-08', 'active');
    assert.equal(status.status, 'good');
    assert.equal(status.formattedDueDate, '8 November', 'Next unpaid due date advances to 8 November');
});

test('Rule 5: Operational classes and attendance ledger are preserved during unpaid cycle', () => {
    // Sudhanva in Sep cycle: attendance marked on Sep 19, Sep 26, Oct 3 while fee was unpaid
    const today = new Date('2026-10-03T12:00:00Z');
    const ledger = getStudentFeeCycleLedger({
        student: {
            id: 'sudhanva-test',
            name: 'Sudhanva',
            fees_basis: 'monthly',
            fees_collection_date: 8,
            join_date: '2026-08-10',
            status: 'active'
        },
        classrooms: [{ id: 'cls-sat', name: 'Saturday Flute Batch' }],
        batchSchedules: [{ classroom_id: 'cls-sat', day_of_week: 6, start_time: '18:00', end_time: '19:00' }],
        attendance: [
            { student_id: 'sudhanva-test', classroom_id: 'cls-sat', date: '2026-09-19', status: 'present' },
            { student_id: 'sudhanva-test', classroom_id: 'cls-sat', date: '2026-09-26', status: 'present' },
            { student_id: 'sudhanva-test', classroom_id: 'cls-sat', date: '2026-10-03', status: 'present' }
        ],
        payments: [{ payment_date: '2026-08-10', status: 'approved' }], // unpaid Sep cycle
        today
    });

    // Operational classes must NOT be 0 simply because payment is late
    assert.equal(ledger.summary.entitledClasses, 4, 'Operational standard entitlement is 4');
    assert.equal(ledger.summary.consumedClasses, 3, '3 classes attended in September cycle');
    assert.equal(ledger.summary.creditsRemaining, 1, '1 credit remaining');

    // Financial metadata reflects unpaid status
    assert.equal(ledger.isPaid, false, 'Cycle financial status is unpaid');
    assert.equal(ledger.paymentStatus, 'overdue', 'Payment status is overdue');
    assert.equal(ledger.unpaidCyclesCount, 1, '1 unpaid cycle');
});
