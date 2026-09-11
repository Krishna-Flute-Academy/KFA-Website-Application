import test from 'node:test';
import assert from 'node:assert/strict';
import createJiti from 'jiti';

const jiti = createJiti(import.meta.url);

const {
    isDueDatePassed,
    deriveStudentAssignmentStatus,
    formatRecipientSummary,
    computeStudentAssignmentMetrics,
    resolveEffectiveAssignmentsForStudent
} = jiti('../src/lib/assignment-service.ts');

const {
    isStudentOperationallyActive,
    isStudentPaused
} = jiti('../src/lib/student-lifecycle.ts');

test('1. Due Date Passed Evaluation', () => {
    const fixedNow = new Date('2026-09-11T12:00:00Z');

    // Due in the past (yesterday)
    assert.equal(isDueDatePassed('2026-09-10', fixedNow), true);
    assert.equal(isDueDatePassed('2026-09-10T23:59:59Z', fixedNow), true);

    // Due in the future (tomorrow)
    assert.equal(isDueDatePassed('2026-09-12', fixedNow), false);
    assert.equal(isDueDatePassed('2026-09-15T00:00:00Z', fixedNow), false);

    // Due today: date-only '2026-09-11' end-of-day is not yet passed at noon
    assert.equal(isDueDatePassed('2026-09-11', fixedNow), false);

    // Missing / null due date is never passed
    assert.equal(isDueDatePassed(null, fixedNow), false);
    assert.equal(isDueDatePassed(undefined, fixedNow), false);
    assert.equal(isDueDatePassed('', fixedNow), false);
});

test('2. Derived Assignment Status (approved, awaiting review, needs revision, past due, pending)', () => {
    const fixedNow = new Date('2026-09-11T12:00:00Z');

    // Approved -> Completed
    const approved = deriveStudentAssignmentStatus('approved', '2026-09-01', fixedNow);
    assert.equal(approved.statusKey, 'approved');
    assert.equal(approved.isCompleted, true);
    assert.equal(approved.isActive, false);
    assert.equal(approved.isPastDue, false);

    // Needs revision / reviewed -> Active
    const reviewed = deriveStudentAssignmentStatus('reviewed', '2026-09-01', fixedNow);
    assert.equal(reviewed.statusKey, 'needs_revision');
    assert.equal(reviewed.isActive, true);
    assert.equal(reviewed.isCompleted, false);

    // Awaiting review / submitted -> Active
    const submitted = deriveStudentAssignmentStatus('submitted', '2026-09-01', fixedNow);
    assert.equal(submitted.statusKey, 'awaiting_review');
    assert.equal(submitted.isActive, true);
    assert.equal(submitted.isCompleted, false);

    // Pending - Overdue -> Past due
    const pastDue = deriveStudentAssignmentStatus('pending', '2026-09-05', fixedNow);
    assert.equal(pastDue.statusKey, 'past_due');
    assert.equal(pastDue.isPastDue, true);
    assert.equal(pastDue.isActive, true);
    assert.equal(pastDue.isCompleted, false);

    // Pending - Future -> Pending
    const pendingFuture = deriveStudentAssignmentStatus('pending', '2026-09-20', fixedNow);
    assert.equal(pendingFuture.statusKey, 'pending');
    assert.equal(pendingFuture.isPastDue, false);
    assert.equal(pendingFuture.isActive, true);
    assert.equal(pendingFuture.isCompleted, false);
});

test('3. Recipient Summary Formatting (Empty, 1 student, 2-3 students, 5 students)', () => {
    // 0 students
    const empty = formatRecipientSummary([]);
    assert.equal(empty.mode, 'empty');
    assert.equal(empty.displayText, 'No students');
    assert.equal(empty.primaryNames.length, 0);

    // 1 student shows that student's name
    const single = formatRecipientSummary([{ name: 'Kruthika' }]);
    assert.equal(single.mode, 'single');
    assert.equal(single.displayText, 'Kruthika');
    assert.deepEqual(single.primaryNames, ['Kruthika']);
    assert.equal(single.remainingCount, 0);

    // 2 students shows both names
    const two = formatRecipientSummary([{ name: 'Kruthika' }, { name: 'Adhrith' }]);
    assert.equal(two.mode, 'few');
    assert.equal(two.displayText, 'Kruthika, Adhrith');
    assert.deepEqual(two.primaryNames, ['Kruthika', 'Adhrith']);
    assert.equal(two.remainingCount, 0);

    // 3 students shows all three names
    const three = formatRecipientSummary([
        { student_name: 'Kruthika' },
        { student_name: 'Adhrith' },
        { student_name: 'Rohini' }
    ]);
    assert.equal(three.mode, 'few');
    assert.equal(three.displayText, 'Kruthika, Adhrith, Rohini');
    assert.deepEqual(three.primaryNames, ['Kruthika', 'Adhrith', 'Rohini']);
    assert.equal(three.remainingCount, 0);

    // 5 students shows 2 names + "+3 more"
    const five = formatRecipientSummary([
        'Kruthika', 'Adhrith', 'Rohini', 'Ramesh', 'Suresh'
    ]);
    assert.equal(five.mode, 'many');
    assert.equal(five.displayText, 'Kruthika, Adhrith +3 more');
    assert.deepEqual(five.primaryNames, ['Kruthika', 'Adhrith']);
    assert.equal(five.remainingCount, 3);
});

test('4. Resolve Effective Assignments for a Student (Individual + Class-wide)', () => {
    const studentId = 'student-kruthika';
    const classroomA = 'class-sat-slot-4';
    const classroomB = 'class-weekday-adv';

    const mockAssignments = [
        // Individual assignment 1 for Kruthika
        {
            id: 'asg-moonlit-path',
            title: 'Moonlit Path - GmP PmG - 3/4',
            description: 'Practice phrasing',
            classroom_id: classroomA,
            classroom_name: 'Saturday Slot 4',
            target_type: 'individual',
            due_date: '2026-09-08',
            created_at: '2026-09-01',
            assignment_students: [
                { student_id: studentId, status: 'submitted' },
                { student_id: 'student-other', status: 'pending' }
            ]
        },
        // Individual assignment 2 for another student only
        {
            id: 'asg-other-student',
            title: 'Bhairav Morning Practice',
            classroom_id: classroomA,
            classroom_name: 'Saturday Slot 4',
            target_type: 'individual',
            due_date: '2026-09-15',
            assignment_students: [
                { student_id: 'student-other', status: 'pending' }
            ]
        },
        // Class-wide assignment for Classroom A (Saturday Slot 4)
        {
            id: 'asg-classwide-alankar',
            title: 'Saptak Alankars 1-5',
            description: 'Class-wide scale practice',
            classroom_id: classroomA,
            classroom_name: 'Saturday Slot 4',
            target_type: 'all',
            due_date: '2026-09-20',
            created_at: '2026-09-02'
        },
        // Class-wide assignment for Classroom B (Weekday Advanced)
        {
            id: 'asg-weekday-raag',
            title: 'Yaman Gat Speed Drill',
            description: 'Teentaal drut gat',
            classroom_id: classroomB,
            classroom_name: 'Weekday Advanced',
            target_type: 'all',
            due_date: '2026-09-25',
            created_at: '2026-09-03'
        },
        // Class-wide assignment for a classroom Kruthika is NOT enrolled in
        {
            id: 'asg-unrelated-class',
            title: 'Beginner Flute Hold',
            classroom_id: 'class-unrelated',
            classroom_name: 'Beginner Sunday',
            target_type: 'all',
            due_date: '2026-09-30'
        }
    ];

    const mockSubmissions = [
        {
            id: 'sub-1',
            assignment_id: 'asg-moonlit-path',
            student_id: studentId,
            status: 'submitted',
            video_url: 'https://storage.kfa/video1.webm',
            feedback_text: 'Good tone',
            score: 85
        }
    ];

    const enrolledClassroomIds = [classroomA, classroomB];

    const effective = resolveEffectiveAssignmentsForStudent(
        studentId,
        enrolledClassroomIds,
        mockAssignments,
        mockSubmissions
    );

    // Kruthika should have 3 assignments:
    // 1) Moonlit Path (individual)
    // 2) Saptak Alankars (class-wide classroom A)
    // 3) Yaman Gat (class-wide classroom B)
    assert.equal(effective.length, 3);

    const titles = effective.map(e => e.taskTitle);
    assert.ok(titles.includes('Moonlit Path - GmP PmG - 3/4'));
    assert.ok(titles.includes('Saptak Alankars 1-5'));
    assert.ok(titles.includes('Yaman Gat Speed Drill'));
    assert.ok(!titles.includes('Bhairav Morning Practice'));
    assert.ok(!titles.includes('Beginner Flute Hold'));

    const moonlit = effective.find(e => e.taskTitle.startsWith('Moonlit'));
    assert.equal(moonlit.isIndividual, true);
    assert.equal(moonlit.status, 'submitted');
    assert.equal(moonlit.effectiveStatus, 'awaiting_review');
    assert.equal(moonlit.score, 85);

    const alankar = effective.find(e => e.taskTitle.startsWith('Saptak'));
    assert.equal(alankar.isIndividual, false);
    assert.equal(alankar.classroomName, 'Saturday Slot 4');
});

test('5. Student Assignment Metrics Computation (active, awaiting submission, awaiting review, completed)', () => {
    const mockAssignments = [
        // Approved / Completed
        {
            assignmentId: '1',
            status: 'approved',
            effectiveStatus: 'approved',
            isCompleted: true,
            isActive: false,
            isPastDue: false
        },
        // Submitted / Awaiting review
        {
            assignmentId: '2',
            status: 'submitted',
            effectiveStatus: 'awaiting_review',
            isCompleted: false,
            isActive: true,
            isPastDue: false
        },
        // Needs revision
        {
            assignmentId: '3',
            status: 'reviewed',
            effectiveStatus: 'needs_revision',
            isCompleted: false,
            isActive: true,
            isPastDue: false
        },
        // Overdue pending
        {
            assignmentId: '4',
            status: 'pending',
            effectiveStatus: 'past_due',
            isCompleted: false,
            isActive: true,
            isPastDue: true
        },
        // Pending future
        {
            assignmentId: '5',
            status: 'pending',
            effectiveStatus: 'pending',
            isCompleted: false,
            isActive: true,
            isPastDue: false
        }
    ];

    const metrics = computeStudentAssignmentMetrics(mockAssignments);
    assert.equal(metrics.totalCount, 5);
    assert.equal(metrics.completedCount, 1);
    assert.equal(metrics.awaitingReviewCount, 1);
    assert.equal(metrics.needsRevisionCount, 1);
    assert.equal(metrics.pastDueCount, 1);
    assert.equal(metrics.awaitingSubmissionCount, 2); // past_due + pending
    assert.equal(metrics.activeCount, 4); // awaitingReview + needsRevision + past_due + pending
});

test('6. Reverse Lookup: Given Kruthika student ID, returns Moonlit Path + Saturday Slot 4 class-wide assignments', () => {
    const studentId = 'kruthika-id-123';
    const enrolledClassrooms = ['sat-slot-4'];

    const assignments = [
        {
            id: 'asg-indiv-moonlit',
            title: 'Moonlit Path - GmP PmG - 3/4',
            classroom_id: 'sat-slot-4',
            classroom_name: 'Saturday Slot 4',
            target_type: 'individual',
            assignment_students: [{ student_id: studentId, status: 'pending' }]
        },
        {
            id: 'asg-classwide-sat',
            title: 'Saturday Slot 4 Classwide Warmup',
            classroom_id: 'sat-slot-4',
            classroom_name: 'Saturday Slot 4',
            target_type: 'all'
        },
        {
            id: 'asg-other',
            title: 'Other Student Solo',
            classroom_id: 'sat-slot-4',
            target_type: 'individual',
            assignment_students: [{ student_id: 'other-student-id', status: 'pending' }]
        }
    ];

    const effective = resolveEffectiveAssignmentsForStudent(
        studentId,
        enrolledClassrooms,
        assignments,
        []
    );

    assert.equal(effective.length, 2);
    const names = effective.map(e => e.taskTitle);
    assert.deepEqual(names.sort(), ['Moonlit Path - GmP PmG - 3/4', 'Saturday Slot 4 Classwide Warmup']);
});

test('7. Edge Cases: Student with only Individual or only Class-wide assignments', () => {
    const studentOnlyIndiv = 'student-only-indiv';
    const assignmentsIndivOnly = [
        {
            id: 'asg-1',
            title: 'Solo Drill',
            target_type: 'individual',
            assignment_students: [{ student_id: studentOnlyIndiv, status: 'pending' }]
        }
    ];

    const resultIndivOnly = resolveEffectiveAssignmentsForStudent(
        studentOnlyIndiv,
        [], // not enrolled in classrooms with active class-wide tasks
        assignmentsIndivOnly,
        []
    );
    assert.equal(resultIndivOnly.length, 1);
    assert.equal(resultIndivOnly[0].taskTitle, 'Solo Drill');

    const studentOnlyClass = 'student-only-class';
    const assignmentsClassOnly = [
        {
            id: 'asg-2',
            title: 'Group Chorus',
            classroom_id: 'class-1',
            target_type: 'all'
        }
    ];

    const resultClassOnly = resolveEffectiveAssignmentsForStudent(
        studentOnlyClass,
        ['class-1'],
        assignmentsClassOnly,
        []
    );
    assert.equal(resultClassOnly.length, 1);
    assert.equal(resultClassOnly[0].taskTitle, 'Group Chorus');
});

test('8. Multi-field Search Filter Validation (Student Name, Task Title, Classroom, Topic)', () => {
    const batches = [
        {
            assignmentId: 'b-1',
            taskTitle: 'Moonlit Path - GmP PmG - 3/4',
            classroomName: 'Saturday Slot 4',
            inventoryRefTitle: 'Raag Yaman Alap',
            submissions: [
                { student_id: 's-1', student_name: 'Kruthika Gopal' },
                { student_id: 's-2', student_name: 'Adhrith V' }
            ]
        },
        {
            assignmentId: 'b-2',
            taskTitle: 'Bhairav Drill',
            classroomName: 'Morning Ragas',
            inventoryRefTitle: 'Komal Rishabh Sadhana',
            submissions: [
                { student_id: 's-3', student_name: 'Rohini Sharma' }
            ]
        }
    ];

    const search = (query) => {
        const q = query.toLowerCase().trim();
        return batches.filter(b => {
            const titleMatch = b.taskTitle.toLowerCase().includes(q);
            const classMatch = b.classroomName.toLowerCase().includes(q);
            const topicMatch = (b.inventoryRefTitle || '').toLowerCase().includes(q);
            const studentMatch = b.submissions.some(s => s.student_name.toLowerCase().includes(q));
            return titleMatch || classMatch || topicMatch || studentMatch;
        });
    };

    // Search by student name
    const byStudent = search('kruthika');
    assert.equal(byStudent.length, 1);
    assert.equal(byStudent[0].assignmentId, 'b-1');

    // Search by task title
    const byTitle = search('bhairav');
    assert.equal(byTitle.length, 1);
    assert.equal(byTitle[0].assignmentId, 'b-2');

    // Search by classroom name
    const byClassroom = search('saturday slot');
    assert.equal(byClassroom.length, 1);
    assert.equal(byClassroom[0].assignmentId, 'b-1');

    // Search by topic name
    const byTopic = search('komal rishabh');
    assert.equal(byTopic.length, 1);
    assert.equal(byTopic[0].assignmentId, 'b-2');

    // Cross-classroom search across student names
    const allMatchingV = search('v'); // Matches Adhrith V and Bhairav
    assert.equal(allMatchingV.length, 2);
});

test('9. Inactive / Paused Student Assignment Preservation', () => {
    // Student marked 'inactive' (canonical Paused Learning)
    const pausedStudent = {
        id: 'student-paused-1',
        name: 'Suresh Kumar',
        status: 'inactive',
        classroom_ids: ['class-learning-circle']
    };

    // Check lifecycle predicates
    assert.equal(isStudentOperationallyActive(pausedStudent.status), false);
    assert.equal(isStudentPaused(pausedStudent.status), true);

    // Filter toggle logic: Active only vs All Learners (Active + Paused)
    const filterActiveOnly = (students) => students.filter(s => isStudentOperationallyActive(s.status));
    const filterAllLearners = (students) => students;

    const studentList = [
        { id: 's1', status: 'active' },
        pausedStudent
    ];

    assert.equal(filterActiveOnly(studentList).length, 1);
    assert.equal(filterAllLearners(studentList).length, 2);

    // Historic assignments for paused student remain accessible
    const historicAssignments = [
        {
            id: 'past-asg-1',
            title: 'Past Yaman Lesson',
            classroom_id: 'class-old-sat',
            target_type: 'individual',
            assignment_students: [{ student_id: pausedStudent.id, status: 'approved' }]
        }
    ];

    const effective = resolveEffectiveAssignmentsForStudent(
        pausedStudent.id,
        pausedStudent.classroom_ids,
        historicAssignments,
        []
    );

    assert.equal(effective.length, 1);
    assert.equal(effective[0].taskTitle, 'Past Yaman Lesson');
    assert.equal(effective[0].effectiveStatus, 'approved');
});

test('10. Accurate Per-Student Counters (Zero count, non-leak across classrooms)', () => {
    const studentA = 'student-classroom-A';
    const studentB = 'student-classroom-B';
    const studentC = 'student-empty';

    const assignments = [
        // Classroom A assignment (target_type = 'all' for this classroom)
        {
            id: 'asg-class-A-1',
            title: 'Class A Song',
            classroom_id: 'class-A',
            target_type: 'all',
            due_date: '2026-09-20'
        },
        // Classroom A assignment 2
        {
            id: 'asg-class-A-2',
            title: 'Class A Alankars',
            classroom_id: 'class-A',
            target_type: 'all',
            due_date: '2026-09-01' // overdue
        },
        // Classroom B assignment
        {
            id: 'asg-class-B-1',
            title: 'Class B Raag Yaman',
            classroom_id: 'class-B',
            target_type: 'all',
            due_date: '2026-09-25'
        },
        // Individual assignment targeted ONLY to Student B
        {
            id: 'asg-indiv-B',
            title: 'Student B Special Drill',
            classroom_id: 'class-B',
            target_type: 'individual',
            due_date: '2026-09-30',
            assignment_students: [{ student_id: studentB, status: 'submitted' }]
        }
    ];

    const refDate = new Date('2026-09-11T12:00:00Z');

    // Student A (enrolled only in Class A):
    const effectiveA = resolveEffectiveAssignmentsForStudent({
        studentId: studentA,
        studentClassroomIds: ['class-A'],
        assignments,
        referenceDate: refDate
    });
    const metricsA = computeStudentAssignmentMetrics(effectiveA);
    // Should have 2 assignments total: 1 pending future, 1 overdue past_due. None from class B or individual B!
    assert.equal(metricsA.totalCount, 2);
    assert.equal(metricsA.activeCount, 2);
    assert.equal(metricsA.awaitingSubmissionCount, 2); // 1 pending + 1 past_due
    assert.equal(metricsA.pastDueCount, 1);
    assert.equal(metricsA.awaitingReviewCount, 0);
    assert.equal(metricsA.completedCount, 0);

    // Student B (enrolled only in Class B):
    const effectiveB = resolveEffectiveAssignmentsForStudent({
        studentId: studentB,
        studentClassroomIds: ['class-B'],
        assignments,
        referenceDate: refDate
    });
    const metricsB = computeStudentAssignmentMetrics(effectiveB);
    // Should have 2 assignments: Class B Raag Yaman (pending) + Special Drill (submitted / awaiting review)
    assert.equal(metricsB.totalCount, 2);
    assert.equal(metricsB.activeCount, 2);
    assert.equal(metricsB.awaitingSubmissionCount, 1);
    assert.equal(metricsB.awaitingReviewCount, 1);
    assert.equal(metricsB.completedCount, 0);

    // Student C (no enrollments, no individual assignments):
    const effectiveC = resolveEffectiveAssignmentsForStudent({
        studentId: studentC,
        studentClassroomIds: [],
        assignments,
        referenceDate: refDate
    });
    const metricsC = computeStudentAssignmentMetrics(effectiveC);
    // Must NOT inherit 34 or any other assignments! Exactly 0!
    assert.equal(metricsC.totalCount, 0);
    assert.equal(metricsC.activeCount, 0);
    assert.equal(metricsC.awaitingSubmissionCount, 0);
    assert.equal(metricsC.awaitingReviewCount, 0);
    assert.equal(metricsC.completedCount, 0);
});

test('11. Single-Session Makeup Guest Attendees Do Not Inherit Host Classroom Assignments', () => {
    // Student belongs to Classroom 101
    // Attended Classroom 202 once as makeup guest
    const guestStudentId = 'student-guest-1';
    const permanentClassrooms = ['class-101'];

    const hostAssignments = [
        {
            id: 'asg-host-class-202',
            title: 'Class 202 Master Drill',
            classroom_id: 'class-202',
            target_type: 'all',
            due_date: '2026-09-20'
        }
    ];

    // Using permanent classrooms:
    const effectiveGuest = resolveEffectiveAssignmentsForStudent({
        studentId: guestStudentId,
        studentClassroomIds: permanentClassrooms,
        assignments: hostAssignments
    });
    const metricsGuest = computeStudentAssignmentMetrics(effectiveGuest);

    assert.equal(effectiveGuest.length, 0);
    assert.equal(metricsGuest.totalCount, 0);
    assert.equal(metricsGuest.activeCount, 0);
});

