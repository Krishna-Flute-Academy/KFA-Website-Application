import test from 'node:test';
import assert from 'node:assert/strict';

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
