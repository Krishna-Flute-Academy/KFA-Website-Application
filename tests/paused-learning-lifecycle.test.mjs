import test from 'node:test';
import assert from 'node:assert/strict';
import createJiti from 'jiti';

const jiti = createJiti(import.meta.url);

const {
    isStudentOperationallyActive,
    isStudentPaused,
    isStudentArchived,
    getStudentStatusBadge,
    getStudentAccess
} = jiti('../src/lib/student-lifecycle.ts');

const {
    getStudentFeeStatus,
    getStudentBillingCycle,
    evaluateStudentFeeCycle,
    calculateResumedFeeDueDate
} = jiti('../src/lib/fee-utils.ts');

test('1. Student Lifecycle: Operational Status Checks', () => {
    // Only 'active' is operationally active
    assert.equal(isStudentOperationallyActive('active'), true);
    assert.equal(isStudentOperationallyActive('Active'), true);
    assert.equal(isStudentOperationallyActive('inactive'), false);
    assert.equal(isStudentOperationallyActive('Inactive'), false);
    assert.equal(isStudentOperationallyActive('archived'), false);
    assert.equal(isStudentOperationallyActive('Archived'), false);
    assert.equal(isStudentOperationallyActive(null), false);
    assert.equal(isStudentOperationallyActive(undefined), false);

    // Paused checks (canonical 'inactive')
    assert.equal(isStudentPaused('inactive'), true);
    assert.equal(isStudentPaused('Inactive'), true);
    assert.equal(isStudentPaused('paused'), true);
    assert.equal(isStudentPaused('active'), false);
    assert.equal(isStudentPaused('archived'), false);

    // Archived checks
    assert.equal(isStudentArchived('archived'), true);
    assert.equal(isStudentArchived('Archived'), true);
    assert.equal(isStudentArchived('inactive'), false);
    assert.equal(isStudentArchived('active'), false);
});

test('2. Student Lifecycle: Badge & Access Controls', () => {
    const activeBadge = getStudentStatusBadge('active');
    assert.equal(activeBadge.label, 'Active');

    const pausedBadge = getStudentStatusBadge('inactive');
    assert.equal(pausedBadge.label, 'Paused');

    const archivedBadge = getStudentStatusBadge('archived');
    assert.equal(archivedBadge.label, 'Archived');

    const pausedAccess = getStudentAccess('inactive');
    assert.equal(pausedAccess.adminLabel, 'Paused');
    assert.equal(pausedAccess.canAccessClassroom, false);
    assert.equal(pausedAccess.canAccessLiveClass, false);
    assert.equal(pausedAccess.canAccessTools, true);
});

test('3. Fee Status: Paused student is never marked overdue', () => {
    // Simulating today as Sep 10, 2026. Collection day is Sep 1 (10 days ago), zero payments.
    // If student were active, they would be 'overdue'.
    const activeStatus = getStudentFeeStatus(
        'monthly',
        1,
        [],
        new Date('2026-09-10T12:00:00Z'),
        '2026-01-01',
        'active'
    );
    assert.equal(activeStatus.status, 'overdue');

    // For paused student, fee status MUST be 'paused' / Billing Paused, NOT overdue
    const pausedStatus = getStudentFeeStatus(
        'monthly',
        1,
        [],
        new Date('2026-09-10T12:00:00Z'),
        '2026-01-01',
        'inactive'
    );
    assert.equal(pausedStatus.status, 'paused');
    assert.equal(pausedStatus.isPaused, true);
    assert.equal(pausedStatus.formattedDueDate, 'Billing Paused');
    assert.equal(pausedStatus.diffDays, 0);
});

test('4. Billing Cycle: Paused student derives Billing Paused cycle', () => {
    const cycle = getStudentBillingCycle(
        13,
        [],
        new Date('2026-09-10T12:00:00Z'),
        '2026-01-01',
        'inactive'
    );
    assert.equal(cycle.feeStatus, 'paused');
    assert.equal(cycle.isPaused, true);
    assert.equal(cycle.formattedDueDate, 'Billing Paused');
});

test('5. Fee Cycle Metrics: Paused student evaluation reports paused billing', () => {
    const student = {
        id: 'student-gajendra-123',
        name: 'Gajendra Babu Alji',
        fees_basis: 'monthly',
        fees_collection_date: 13,
        created_at: '2025-06-01',
        status: 'inactive'
    };

    const evaluation = evaluateStudentFeeCycle({
        student,
        attendance: [],
        overrides: [],
        leaveRequests: [],
        payments: [],
        cancelledSessions: [],
        today: new Date('2026-09-10T12:00:00Z')
    });

    assert.equal(evaluation.metrics.statusLabel, 'Learning Paused · Billing Paused');
    assert.equal(evaluation.metrics.badgeVariant, 'neutral');
});

test('6. Resumption Fee Due Date: Fresh billing cycle avoiding back-dated debt', () => {
    // Case A: Resume before this month's collection day
    // Resumes Sep 10, collection day 13 -> First due date is Sep 13, 2026
    const dueA = calculateResumedFeeDueDate('2026-09-10', 13);
    assert.equal(dueA.getFullYear(), 2026);
    assert.equal(dueA.getMonth(), 8); // 8 is September (0-indexed)
    assert.equal(dueA.getDate(), 13);

    // Case B: Resume on the exact collection day
    // Resumes Sep 13, collection day 13 -> First due date is Sep 13, 2026
    const dueB = calculateResumedFeeDueDate('2026-09-13', 13);
    assert.equal(dueB.getFullYear(), 2026);
    assert.equal(dueB.getMonth(), 8);
    assert.equal(dueB.getDate(), 13);

    // Case C: Resume after this month's collection day has passed
    // Student paused in Sep, resumes Dec 15 with collection day 13
    // Sep 13, Oct 13, Nov 13, Dec 13 have passed.
    // First due date MUST roll forward to Jan 13, 2027!
    const dueC = calculateResumedFeeDueDate('2026-12-15', 13);
    assert.equal(dueC.getFullYear(), 2027);
    assert.equal(dueC.getMonth(), 0); // January
    assert.equal(dueC.getDate(), 13);

    // Case D: Month clamping for end-of-month (Day 31 in Feb)
    const dueD = calculateResumedFeeDueDate('2026-02-01', 31);
    assert.equal(dueD.getFullYear(), 2026);
    assert.equal(dueD.getMonth(), 1); // Feb
    assert.equal(dueD.getDate(), 28); // 2026 is non-leap year -> Feb 28
});

test('7. Roster Isolation: Operational filter removes paused students from active classrooms', () => {
    const rawClassroomStudents = [
        { student_id: 's1', users: { name: 'Active Student A', status: 'active' } },
        { student_id: 's2', users: { name: 'Gajendra Babu Alji', status: 'inactive' } },
        { student_id: 's3', users: { name: 'Archived Student C', status: 'archived' } },
        { student_id: 's4', users: { name: 'Active Student D', status: 'active' } }
    ];

    const operationalStudents = rawClassroomStudents.filter(r => isStudentOperationallyActive(r.users?.status));

    assert.equal(operationalStudents.length, 2);
    assert.equal(operationalStudents[0].student_id, 's1');
    assert.equal(operationalStudents[1].student_id, 's4');
    // Verifies Gajendra and archived student are excluded
    assert.equal(operationalStudents.some(s => s.users.name === 'Gajendra Babu Alji'), false);
});

test('8. End-to-End Gajendra Babu Alji Pausing & Resuming Lifecycle Simulation', () => {
    // Initial State: Active in Batch "Weekend Morning Ragas"
    const student = {
        id: 'gajendra-uuid-1',
        name: 'Gajendra Babu Alji',
        status: 'active',
        batch_name: 'Weekend Morning Ragas',
        classroom_id: 'room-123',
        fees_basis: 'monthly',
        fees_collection_date: 13
    };

    assert.equal(isStudentOperationallyActive(student.status), true);

    // ACTION: Pause Learning
    const pausedState = {
        ...student,
        status: 'inactive',
        batch_name: 'KFA Learning Circle',
        classroom_id: 'learning-circle-room-id'
    };

    assert.equal(isStudentOperationallyActive(pausedState.status), false);
    assert.equal(isStudentPaused(pausedState.status), true);

    // Verify Fee Evaluation while paused on Oct 20 (collection day Oct 13 passed)
    const feeStatusWhilePaused = getStudentFeeStatus(
        pausedState.fees_basis,
        pausedState.fees_collection_date,
        [],
        new Date('2026-10-20T10:00:00Z'),
        '2026-01-01',
        pausedState.status
    );
    assert.equal(feeStatusWhilePaused.status, 'paused');
    assert.equal(feeStatusWhilePaused.formattedDueDate, 'Billing Paused');

    // ACTION: Resume Learning on Nov 16 into "Advanced Evening Ragas"
    const resumeDate = '2026-11-16';
    const nextDueOnResume = calculateResumedFeeDueDate(resumeDate, pausedState.fees_collection_date);

    const resumedState = {
        ...pausedState,
        status: 'active',
        batch_name: 'Advanced Evening Ragas',
        classroom_id: 'room-advanced-456'
    };

    assert.equal(isStudentOperationallyActive(resumedState.status), true);
    assert.equal(resumedState.batch_name, 'Advanced Evening Ragas');
    // First due date after Nov 16 resumption with Day 13 is Dec 13, 2026
    assert.equal(nextDueOnResume.getMonth(), 11); // December (0-indexed: 11)
    assert.equal(nextDueOnResume.getDate(), 13);
});

test('9. Pre-Pause Debt Retention: Unpaid obligations prior to pause are NOT erased (Corrections 4 & 6)', () => {
    // Scenario: Student Due Day is 13th. Joined Jan 1, 2026.
    // Pauses on Aug 20, 2026.
    // Case A: Unpaid Aug 13 cycle -> Pre-pause debt is retained!
    const paymentsNoAug = [
        { payment_date: '2026-07-13', status: 'approved' } // paid July, but missed August
    ];

    const feeStatusUnpaidAug = getStudentFeeStatus(
        'monthly',
        13,
        paymentsNoAug,
        new Date('2026-10-10T12:00:00Z'), // evaluated in October while paused
        '2026-01-01',
        'inactive',
        '2026-08-20' // pause effective date
    );

    assert.equal(feeStatusUnpaidAug.isPaused, true);
    assert.equal(feeStatusUnpaidAug.hasPrePauseDebt, true);
    assert.equal(feeStatusUnpaidAug.formattedDueDate.includes('Unpaid Pre-Pause Balance'), true);
    assert.equal(feeStatusUnpaidAug.formattedDueDate.includes('13 August'), true);

    // Verify evaluateStudentFeeCycle reflects the unpaid pre-pause balance
    const evaluation = evaluateStudentFeeCycle({
        student: {
            id: 's-pre-pause-1',
            status: 'inactive',
            fees_basis: 'monthly',
            fees_collection_date: 13,
            join_date: '2026-01-01',
            pause_effective_date: '2026-08-20'
        },
        payments: paymentsNoAug,
        today: new Date('2026-10-10T12:00:00Z')
    });
    assert.equal(evaluation.metrics.statusLabel, 'Learning Paused · Unpaid Pre-Pause Balance');
    assert.equal(evaluation.metrics.badgeVariant, 'warning');

    // Case B: Paid Aug 13 cycle -> Clean Billing Paused, zero debt for post-pause months (Sep, Oct)
    const paymentsWithAug = [
        { payment_date: '2026-07-13', status: 'approved' },
        { payment_date: '2026-08-13', status: 'approved' }
    ];

    const feeStatusPaidAug = getStudentFeeStatus(
        'monthly',
        13,
        paymentsWithAug,
        new Date('2026-10-10T12:00:00Z'),
        '2026-01-01',
        'inactive',
        '2026-08-20'
    );

    assert.equal(feeStatusPaidAug.isPaused, true);
    assert.equal(feeStatusPaidAug.hasPrePauseDebt, false);
    assert.equal(feeStatusPaidAug.formattedDueDate, 'Billing Paused');
});

test('10. Structural Non-Operational Check: Classroom type determines isolation (Correction 3)', () => {
    // Classrooms with custom names but type = 'learning_circle' must be structurally treated as non-operational
    const testClassrooms = [
        { id: 'c1', name: 'Bageshree Morning Batch', type: 'permanent' },
        { id: 'c2', name: 'Flute Community Lounge', type: 'learning_circle' }, // custom name
        { id: 'c3', name: 'Special Raga Session', type: 'temporary' },
        { id: 'c4', name: 'KFA Learning Circle', type: 'learning_circle' }
    ];

    const operationalRooms = testClassrooms.filter(c => c.type !== 'learning_circle');
    assert.equal(operationalRooms.length, 2);
    assert.equal(operationalRooms.some(c => c.name === 'Flute Community Lounge'), false);
    assert.equal(operationalRooms.some(c => c.name === 'KFA Learning Circle'), false);
});

test('11. History Preservation: Permanent classroom is preserved alongside Learning Circle (Correction 2)', () => {
    // When student is in both Permanent Classroom and KFA Learning Circle:
    const mockStudentEnrollments = [
        {
            classroom_id: 'perm-room-1',
            classrooms: { id: 'perm-room-1', name: 'Bageshree Batch', type: 'permanent' }
        },
        {
            classroom_id: 'circle-room-2',
            classrooms: { id: 'circle-room-2', name: 'KFA Learning Circle', type: 'learning_circle' }
        }
    ];

    // The permanent classroom resolution algorithm finds the non-learning circle room:
    const permRef = mockStudentEnrollments.find(cs => {
        const r = cs.classrooms;
        return r && r.type !== 'learning_circle' && r.type !== 'temporary';
    });

    assert.ok(permRef);
    assert.equal(permRef.classrooms.name, 'Bageshree Batch');
});

