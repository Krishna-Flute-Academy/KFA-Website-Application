import test from "node:test";
import assert from "node:assert/strict";

function getMonthRangeForDate(d) {
    const year = d.getFullYear();
    const month = d.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const fmt = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    };
    return { from: fmt(firstDay), to: fmt(lastDay) };
}

function getPresets(d) {
    const fmt = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    };

    const thisMonth = {
        from: fmt(new Date(d.getFullYear(), d.getMonth(), 1)),
        to: fmt(new Date(d.getFullYear(), d.getMonth() + 1, 0))
    };

    const lastMonth = {
        from: fmt(new Date(d.getFullYear(), d.getMonth() - 1, 1)),
        to: fmt(new Date(d.getFullYear(), d.getMonth(), 0))
    };

    const last3Months = {
        from: fmt(new Date(d.getFullYear(), d.getMonth() - 2, 1)),
        to: fmt(new Date(d.getFullYear(), d.getMonth() + 1, 0))
    };

    return { thisMonth, lastMonth, last3Months };
}

test("1. Default Current Month for September 2026", () => {
    const sepDate = new Date(2026, 8, 10);
    const range = getMonthRangeForDate(sepDate);
    assert.equal(range.from, "2026-09-01");
    assert.equal(range.to, "2026-09-30");
});

test("2. February in Leap Year (2024)", () => {
    const febLeap = new Date(2024, 1, 15);
    const range = getMonthRangeForDate(febLeap);
    assert.equal(range.from, "2024-02-01");
    assert.equal(range.to, "2024-02-29");
});

test("3. February in Non-Leap Year (2025)", () => {
    const febNonLeap = new Date(2025, 1, 15);
    const range = getMonthRangeForDate(febNonLeap);
    assert.equal(range.from, "2025-02-01");
    assert.equal(range.to, "2025-02-28");
});

test("4. Year rollover from January to Last Month (December)", () => {
    const janDate = new Date(2027, 0, 15);
    const presets = getPresets(janDate);
    assert.equal(presets.thisMonth.from, "2027-01-01");
    assert.equal(presets.thisMonth.to, "2027-01-31");
    assert.equal(presets.lastMonth.from, "2026-12-01");
    assert.equal(presets.lastMonth.to, "2026-12-31");
    assert.equal(presets.last3Months.from, "2026-11-01");
    assert.equal(presets.last3Months.to, "2027-01-31");
});

test("5. Inclusive Date Filtering logic for logs", () => {
    const logs = [
        { id: "1", date: "2026-08-31", status: "absent" },
        { id: "2", date: "2026-09-01", status: "present" },
        { id: "3", date: "2026-09-15", status: "late" },
        { id: "4", date: "2026-09-30", status: "excused" },
        { id: "5", date: "2026-10-01", status: "present" }
    ];

    const fromDate = "2026-09-01";
    const toDate = "2026-09-30";

    const filtered = logs.filter(l => l.date >= fromDate && l.date <= toDate);
    assert.equal(filtered.length, 3);
    assert.deepEqual(filtered.map(l => l.id), ["2", "3", "4"]);
});

test("6. Individual student status filter within date range", () => {
    const studentLogs = [
        { id: "1", date: "2026-09-05", status: "present" },
        { id: "2", date: "2026-09-12", status: "absent" },
        { id: "3", date: "2026-09-19", status: "excused" },
        { id: "4", date: "2026-09-26", status: "present" },
        { id: "5", date: "2026-08-28", status: "excused" }
    ];

    const fromDate = "2026-09-01";
    const toDate = "2026-09-30";
    const inRange = studentLogs.filter(l => l.date >= fromDate && l.date <= toDate);

    const excusedOnly = inRange.filter(l => l.status === "excused");
    assert.equal(excusedOnly.length, 1);
    assert.equal(excusedOnly[0].id, "3");

    const presentOnly = inRange.filter(l => l.status === "present");
    assert.equal(presentOnly.length, 2);
    assert.deepEqual(presentOnly.map(l => l.id), ["1", "4"]);
});

test("7. Leave requests: Actionable pending retained regardless of date range", () => {
    const allLeaves = [
        { id: "p1", class_date: "2026-10-15", status: "pending" },
        { id: "p2", class_date: "2026-08-20", status: "pending" },
        { id: "a1", class_date: "2026-09-10", status: "approved" },
        { id: "a2", class_date: "2026-08-10", status: "approved" },
        { id: "r1", class_date: "2026-09-05", status: "rejected" }
    ];

    const fromDate = "2026-09-01";
    const toDate = "2026-09-30";

    const pending = allLeaves.filter(l => l.status === "pending");
    assert.equal(pending.length, 2);

    const historical = allLeaves.filter(l => l.status !== "pending" && l.class_date >= fromDate && l.class_date <= toDate);
    assert.equal(historical.length, 2);
    assert.deepEqual(historical.map(l => l.id), ["a1", "r1"]);
});

test("8. Makeup cross-month linking: Missed Aug 28, makeup Sep 05", () => {
    const missedLogAug = { id: "m1", date: "2026-08-28", status: "excused", student_id: "s1" };
    const overrides = [
        { id: "o1", student_id: "s1", override_date: "2026-09-05", reason: "[MissedDate:2026-08-28] Makeup" }
    ];

    const fromDateAug = "2026-08-01";
    const toDateAug = "2026-08-31";

    const isMissedInAug = missedLogAug.date >= fromDateAug && missedLogAug.date <= toDateAug;
    assert.equal(isMissedInAug, true);

    const matchedOverride = overrides.find(o => o.student_id === missedLogAug.student_id && o.reason.includes("[MissedDate:" + missedLogAug.date + "]"));
    assert.ok(matchedOverride);
    assert.equal(matchedOverride.override_date, "2026-09-05");
});
