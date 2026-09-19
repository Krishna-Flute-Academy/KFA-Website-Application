import test from 'node:test';
import assert from 'node:assert/strict';
import createJiti from 'jiti';

const jiti = createJiti(import.meta.url);

const {
    isAssignmentApplicableToStudent,
    isAssignmentInDateRange,
    filterClassroomAssignments
} = jiti('../src/lib/assignment-service.ts');

test('Classroom Assignments Filtering Suite', async (t) => {

    const studentNeha = { id: 'cs_1', student_id: 'user_neha', name: 'Neha Sharma' };
    const studentRohan = { id: 'cs_2', student_id: 'user_rohan', name: 'Rohan Gupta' };
    const studentAarav = { id: 'cs_3', student_id: 'user_aarav', name: 'Aarav Patel' };

    const assignmentA = {
        id: 'asg_A',
        title: 'Alankar Practice 1-5',
        description: 'Practice morning alankars',
        target_type: 'all',
        created_at: '2026-09-01T08:00:00.000Z',
        assignment_students: []
    };

    const assignmentB = {
        id: 'asg_B',
        title: 'Bhairav Bandish - Neha Special',
        description: 'Focus on Komal Re and Dha',
        target_type: 'individual',
        created_at: '2026-09-10T10:30:00.000Z',
        assignment_students: [
            { id: 'as_1', student_id: 'user_neha', student_name: 'Neha Sharma' }
        ]
    };

    const assignmentC = {
        id: 'asg_C',
        title: 'Yaman Taan Practice - Rohan',
        description: 'Fast taans at 120 bpm',
        target_type: 'individual',
        created_at: '2026-09-15T12:00:00.000Z',
        assignment_students: [
            { id: 'as_2', student_id: 'user_rohan', student_name: 'Rohan Gupta' }
        ]
    };

    const assignmentD = {
        id: 'asg_D',
        title: 'Bhairavi Meend - Neha',
        description: 'Glides between Pa and Dha',
        target_type: 'individual',
        created_at: '2026-09-25T14:00:00.000Z',
        assignment_students: [
            { id: 'as_3', student_id: 'user_neha', student_name: 'Neha Sharma' }
        ]
    };

    const autoCurriculumAssignment = {
        id: 'asg_auto',
        title: 'Module 1 - Flute Basics',
        inventory_ref_type: 'lesson',
        inventory_ref_title: 'Module 1 - Flute Basics',
        target_type: 'all',
        created_at: '2026-09-05T00:00:00.000Z'
    };

    const mockClassroomAssignments = [
        assignmentA,
        assignmentB,
        assignmentC,
        assignmentD,
        autoCurriculumAssignment
    ];

    await t.test('Scenario 1: Default View (Unfiltered) shows all assignments applicable to classroom', () => {
        const results = filterClassroomAssignments(mockClassroomAssignments, {
            studentId: 'all',
            fromDate: '',
            toDate: '',
            searchQuery: ''
        });

        // Should include all non-auto assignments (A, B, C, D)
        assert.equal(results.length, 4);
        assert.deepEqual(results.map(r => r.id), ['asg_A', 'asg_B', 'asg_C', 'asg_D']);
    });

    await t.test('Scenario 2: Student Filter = Neha shows whole-classroom assignments + Neha individual assignments only', () => {
        const results = filterClassroomAssignments(mockClassroomAssignments, {
            studentId: 'user_neha'
        });

        // Should show A (whole-classroom) and B, D (Neha's individual assignments)
        // Must NOT show C (Rohan's individual assignment)
        assert.equal(results.length, 3);
        const ids = results.map(r => r.id);
        assert.ok(ids.includes('asg_A'), 'Includes whole-classroom assignment A');
        assert.ok(ids.includes('asg_B'), 'Includes Neha individual assignment B');
        assert.ok(ids.includes('asg_D'), 'Includes Neha individual assignment D');
        assert.ok(!ids.includes('asg_C'), 'Does NOT include Rohan individual assignment C');
    });

    await t.test('Scenario 3: Student Filter = Rohan shows whole-classroom assignments + Rohan individual assignments only', () => {
        const results = filterClassroomAssignments(mockClassroomAssignments, {
            studentId: 'user_rohan'
        });

        // Should show A (whole-classroom) and C (Rohan's individual assignment)
        // Must NOT show B or D (Neha's individual assignments)
        assert.equal(results.length, 2);
        const ids = results.map(r => r.id);
        assert.ok(ids.includes('asg_A'), 'Includes whole-classroom assignment A');
        assert.ok(ids.includes('asg_C'), 'Includes Rohan individual assignment C');
        assert.ok(!ids.includes('asg_B'), 'Does NOT include Neha individual assignment B');
        assert.ok(!ids.includes('asg_D'), 'Does NOT include Neha individual assignment D');
    });

    await t.test('Scenario 4: Student Filter = Aarav (no individual assignments) shows whole-classroom assignments only', () => {
        const results = filterClassroomAssignments(mockClassroomAssignments, {
            studentId: 'user_aarav'
        });

        assert.equal(results.length, 1);
        assert.equal(results[0].id, 'asg_A');
    });

    await t.test('Scenario 5: Date Range Filter - Inclusive boundaries and one-sided filters', () => {
        // Both dates specified: Sep 10 to Sep 20 inclusive -> should include B (Sep 10) and C (Sep 15)
        const midRange = filterClassroomAssignments(mockClassroomAssignments, {
            fromDate: '2026-09-10',
            toDate: '2026-09-20'
        });
        assert.deepEqual(midRange.map(r => r.id), ['asg_B', 'asg_C']);

        // Only fromDate specified: on or after Sep 15 -> should include C (Sep 15) and D (Sep 25)
        const fromOnly = filterClassroomAssignments(mockClassroomAssignments, {
            fromDate: '2026-09-15'
        });
        assert.deepEqual(fromOnly.map(r => r.id), ['asg_C', 'asg_D']);

        // Only toDate specified: on or before Sep 10 -> should include A (Sep 01) and B (Sep 10)
        const toOnly = filterClassroomAssignments(mockClassroomAssignments, {
            toDate: '2026-09-10'
        });
        assert.deepEqual(toOnly.map(r => r.id), ['asg_A', 'asg_B']);

        // Exact single date range: Sep 10 to Sep 10 -> includes only B
        const exactDay = filterClassroomAssignments(mockClassroomAssignments, {
            fromDate: '2026-09-10',
            toDate: '2026-09-10'
        });
        assert.deepEqual(exactDay.map(r => r.id), ['asg_B']);
    });

    await t.test('Scenario 6: Combined Filtering (Student + Date Range)', () => {
        // Neha + Sep 05 to Sep 20
        // A (Sep 01) is outside date range
        // B (Sep 10) is Neha and inside range -> YES
        // C (Sep 15) is Rohan -> NO
        // D (Sep 25) is outside date range -> NO
        const combined = filterClassroomAssignments(mockClassroomAssignments, {
            studentId: 'user_neha',
            fromDate: '2026-09-05',
            toDate: '2026-09-20'
        });
        assert.equal(combined.length, 1);
        assert.equal(combined[0].id, 'asg_B');
    });

    await t.test('Scenario 7: Empty Results and Clearing Filters', () => {
        // Range with no matches
        const emptyResults = filterClassroomAssignments(mockClassroomAssignments, {
            fromDate: '2026-01-01',
            toDate: '2026-01-31'
        });
        assert.equal(emptyResults.length, 0);

        // Reset/clear filters back to default restores all non-auto assignments
        const clearedResults = filterClassroomAssignments(mockClassroomAssignments, {
            studentId: 'all',
            fromDate: '',
            toDate: ''
        });
        assert.equal(clearedResults.length, 4);
    });

    await t.test('Scenario 8: Optional token search query works alongside filters', () => {
        const searchResult = filterClassroomAssignments(mockClassroomAssignments, {
            studentId: 'user_neha',
            searchQuery: 'meend'
        });
        assert.equal(searchResult.length, 1);
        assert.equal(searchResult[0].id, 'asg_D');
    });
});
