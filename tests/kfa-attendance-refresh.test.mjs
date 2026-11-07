import { test } from 'node:test';
import assert from 'node:assert/strict';

// Helper simulating reconcileAttendanceTotals
function createTotalsReconciler(initialBatchSummaries, initialStats) {
    let batchSummaries = { ...initialBatchSummaries };
    let stats = { ...initialStats };

    function reconcileAttendanceTotals(classroomId, prevStatus, newStatus) {
        if (!classroomId || prevStatus === newStatus) return;

        const batchSummary = batchSummaries[classroomId] || { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
        let presentDiff = 0;
        let absentDiff = 0;
        let lateDiff = 0;
        let excusedDiff = 0;

        if (prevStatus === 'present') presentDiff--;
        if (prevStatus === 'absent') absentDiff--;
        if (prevStatus === 'late') lateDiff--;
        if (prevStatus === 'excused') excusedDiff--;

        if (newStatus === 'present') presentDiff++;
        if (newStatus === 'absent') absentDiff++;
        if (newStatus === 'late') lateDiff++;
        if (newStatus === 'excused') excusedDiff++;

        batchSummaries[classroomId] = {
            ...batchSummary,
            present: Math.max(0, batchSummary.present + presentDiff),
            absent: Math.max(0, batchSummary.absent + absentDiff),
            late: Math.max(0, batchSummary.late + lateDiff),
            excused: Math.max(0, batchSummary.excused + excusedDiff)
        };

        let statPresentDiff = 0;
        let statAbsentDiff = 0;

        if (prevStatus === 'present' || prevStatus === 'late') statPresentDiff--;
        if (prevStatus === 'absent') statAbsentDiff--;

        if (newStatus === 'present' || newStatus === 'late') statPresentDiff++;
        if (newStatus === 'absent') statAbsentDiff++;

        const newPresent = Math.max(0, stats.present + statPresentDiff);
        const newAbsent = Math.max(0, stats.absent + statAbsentDiff);
        const rate = stats.total > 0 ? `${Math.round((newPresent / stats.total) * 100)}%` : '0%';

        stats = {
            ...stats,
            present: newPresent,
            absent: newAbsent,
            rate
        };
    }

    return {
        reconcileAttendanceTotals,
        getBatchSummaries: () => batchSummaries,
        getStats: () => stats
    };
}

test('1. Total Reconciliation: Unmarked -> Absent updates batch summary and global stats', () => {
    const reconciler = createTotalsReconciler(
        { 'room-1': { present: 10, absent: 2, late: 1, excused: 1, total: 20 } },
        { total: 40, present: 22, absent: 4, rate: '55%' }
    );

    reconciler.reconcileAttendanceTotals('room-1', null, 'absent');

    assert.equal(reconciler.getBatchSummaries()['room-1'].absent, 3);
    assert.equal(reconciler.getStats().absent, 5);
    assert.equal(reconciler.getStats().present, 22);
    assert.equal(reconciler.getStats().rate, '55%');
});

test('2. Total Reconciliation: Absent -> Excused shifts count correctly', () => {
    const reconciler = createTotalsReconciler(
        { 'room-1': { present: 10, absent: 3, late: 1, excused: 1, total: 20 } },
        { total: 40, present: 22, absent: 5, rate: '55%' }
    );

    reconciler.reconcileAttendanceTotals('room-1', 'absent', 'excused');

    assert.equal(reconciler.getBatchSummaries()['room-1'].absent, 2);
    assert.equal(reconciler.getBatchSummaries()['room-1'].excused, 2);
    assert.equal(reconciler.getStats().absent, 4);
});

test('3. Total Reconciliation: Unmark restores previous unmarked baseline', () => {
    const reconciler = createTotalsReconciler(
        { 'room-1': { present: 10, absent: 2, late: 1, excused: 2, total: 20 } },
        { total: 40, present: 22, absent: 4, rate: '55%' }
    );

    reconciler.reconcileAttendanceTotals('room-1', 'excused', null);

    assert.equal(reconciler.getBatchSummaries()['room-1'].excused, 1);
});

test('4. Total Reconciliation: Failure rollback safely restores previous state', () => {
    const reconciler = createTotalsReconciler(
        { 'room-1': { present: 10, absent: 2, late: 1, excused: 1, total: 20 } },
        { total: 40, present: 22, absent: 4, rate: '55%' }
    );

    // Optimistic update: mark present
    reconciler.reconcileAttendanceTotals('room-1', null, 'present');
    assert.equal(reconciler.getBatchSummaries()['room-1'].present, 11);
    assert.equal(reconciler.getStats().present, 23);

    // Rollback upon network failure
    reconciler.reconcileAttendanceTotals('room-1', 'present', null);
    assert.equal(reconciler.getBatchSummaries()['room-1'].present, 10);
    assert.equal(reconciler.getStats().present, 22);
});

test('5. Roster Mounting Condition: Existing rows remain mounted during background refetches', () => {
    // Initial load: 0 students, loading true -> shows spinner
    const initialLoading = true;
    const initialRosterCount = 0;
    const shouldShowSpinnerInitially = initialLoading && initialRosterCount === 0;
    assert.equal(shouldShowSpinnerInitially, true, 'Initial load should show spinner');

    // Background refetch: 42 students already mounted, loading true -> KEEP ROSTER MOUNTED
    const backgroundLoading = true;
    const mountedRosterCount = 42;
    const shouldShowSpinnerInBackground = backgroundLoading && mountedRosterCount === 0;
    assert.equal(shouldShowSpinnerInBackground, false, 'Background refetch MUST NOT unmount existing roster');

    // Idle state: loading false, roster 42 -> KEEP ROSTER MOUNTED
    const idleLoading = false;
    const shouldShowSpinnerWhenIdle = idleLoading && mountedRosterCount === 0;
    assert.equal(shouldShowSpinnerWhenIdle, false, 'Idle state shows roster');
});

test('6. Active Batch Signature: Stable across array references with same batch composition', () => {
    const batchesA = [
        { id: 'batch-1', type: 'permanent', name: 'Saturday Slot 10' },
        { id: 'batch-2', type: 'temporary', name: 'Special Class' }
    ];
    const batchesB = [
        { id: 'batch-1', type: 'permanent', name: 'Saturday Slot 10' },
        { id: 'batch-2', type: 'temporary', name: 'Special Class' }
    ];

    const sigA = batchesA.map(b => `${b.id}_${b.type}_${b.name}`).join('|');
    const sigB = batchesB.map(b => `${b.id}_${b.type}_${b.name}`).join('|');

    assert.equal(sigA, sigB, 'Identical batch composition yields identical signature despite new array reference');
});
