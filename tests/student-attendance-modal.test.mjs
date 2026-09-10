import test from 'node:test';
import assert from 'node:assert/strict';
import createJiti from 'jiti';

const jiti = createJiti(import.meta.url);
const { getStudentFeeStatus } = jiti('../src/lib/fee-utils.ts');

// Helper replication to test modal business logic
function getOrdinalSuffix(day) {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
        case 1:  return "st";
        case 2:  return "nd";
        case 3:  return "rd";
        default: return "th";
    }
}

function extractMissedDate(reason) {
    if (!reason) return null;
    const match = reason.match(/\[MissedDate:([^\]]+)\]/);
    return match ? match[1] : null;
}

test('1. Ordinal suffix calculation', () => {
    assert.strictEqual(getOrdinalSuffix(1), 'st');
    assert.strictEqual(getOrdinalSuffix(2), 'nd');
    assert.strictEqual(getOrdinalSuffix(3), 'rd');
    assert.strictEqual(getOrdinalSuffix(4), 'th');
    assert.strictEqual(getOrdinalSuffix(11), 'th');
    assert.strictEqual(getOrdinalSuffix(12), 'th');
    assert.strictEqual(getOrdinalSuffix(13), 'th');
    assert.strictEqual(getOrdinalSuffix(21), 'st');
    assert.strictEqual(getOrdinalSuffix(22), 'nd');
    assert.strictEqual(getOrdinalSuffix(23), 'rd');
    assert.strictEqual(getOrdinalSuffix(31), 'st');
});

test('2. Missed date extraction from override reason', () => {
    const reasonWithTag = "Makeup for Tuesday Slot 3 [MissedDate:2026-09-08]";
    assert.strictEqual(extractMissedDate(reasonWithTag), '2026-09-08');

    const reasonWithoutTag = "Regular makeup class arranged";
    assert.strictEqual(extractMissedDate(reasonWithoutTag), null);

    assert.strictEqual(extractMissedDate(undefined), null);
});

test('3. Modal Date presets computation', () => {
    const now = new Date(2026, 8, 10); // Sep 10, 2026

    // This Month
    const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDayThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const thisMonthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${lastDayThisMonth}`;
    assert.strictEqual(thisMonthStart, '2026-09-01');
    assert.strictEqual(thisMonthEnd, '2026-09-30');

    // Last Month
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStart = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDayPrevMonth = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0).getDate();
    const lastMonthEnd = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-${lastDayPrevMonth}`;
    assert.strictEqual(lastMonthStart, '2026-08-01');
    assert.strictEqual(lastMonthEnd, '2026-08-31');

    // Last 3 Months
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const last3Start = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;
    assert.strictEqual(last3Start, '2026-07-01');
    assert.strictEqual(thisMonthEnd, '2026-09-30');
});

test('4. Attendance summary rate calculation', () => {
    const records = [
        { status: 'present' },
        { status: 'present' },
        { status: 'late' },
        { status: 'absent' },
        { status: 'excused' }
    ];

    const total = records.length;
    const present = records.filter(r => r.status === 'present').length;
    const late = records.filter(r => r.status === 'late').length;
    const rate = Math.round(((present + late) / total) * 100);

    assert.strictEqual(total, 5);
    assert.strictEqual(present, 2);
    assert.strictEqual(late, 1);
    assert.strictEqual(rate, 60); // 3 out of 5 = 60%
});

test('5. Fee status resolution for student with approved current cycle payment (e.g. Uddeepta Bandyopadhyay)', () => {
    // Scenario: Today is Sep 10, 2026. Student due day is 1st of every month.
    // Student paid for September cycle (payment_date: 2026-09-01, status: 'approved')
    const today = new Date('2026-09-10T12:00:00Z');
    const payments = [
        {
            id: 'pay-1',
            student_id: 'uddeepta-id',
            amount: 2500,
            payment_date: '2026-09-01T10:00:00Z',
            status: 'approved',
            created_at: '2026-09-01T10:00:00Z'
        }
    ];

    const feeStatus = getStudentFeeStatus('monthly', 1, payments, today);
    assert.ok(feeStatus);
    assert.strictEqual(feeStatus.status, 'good', 'Status should be good/paid, NOT overdue');
    assert.strictEqual(feeStatus.dueDate.getDate(), 1);
    assert.strictEqual(feeStatus.dueDate.getMonth(), 9); // Month 9 is October (0-indexed: 0=Jan..9=Oct)
    assert.strictEqual(feeStatus.dueDate.getFullYear(), 2026);
    assert.strictEqual(feeStatus.formattedDueDate, '1 October');
});

test('6. Fee status resolution when payment is empty/unpaid vs pending_approval', () => {
    const today = new Date('2026-09-10T12:00:00Z');

    // Case A: Unpaid student on Sep 10 whose due day is 1st
    const unpaidStatus = getStudentFeeStatus('monthly', 1, [], today);
    assert.strictEqual(unpaidStatus.status, 'overdue');
    assert.strictEqual(unpaidStatus.hasPendingPayment, false);

    // Case B: Student has pending approval payment
    const pendingPayments = [
        {
            id: 'pay-2',
            student_id: 'student-2',
            amount: 2500,
            payment_date: '2026-09-02T10:00:00Z',
            status: 'pending_approval'
        }
    ];
    const pendingStatus = getStudentFeeStatus('monthly', 1, pendingPayments, today);
    assert.strictEqual(pendingStatus.hasPendingPayment, true);
});

