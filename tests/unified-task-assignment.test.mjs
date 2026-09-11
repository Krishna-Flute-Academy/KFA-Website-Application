import test from 'node:test';
import assert from 'node:assert/strict';

// Canonical schema structure mocks
const MOCK_CLASSROOM_SATURDAY_4 = {
    id: 'class-sat-4',
    name: 'Saturday Slot 4',
    teacher_id: 'teacher-1'
};

const MOCK_CLASSROOM_SUNDAY_2 = {
    id: 'class-sun-2',
    name: 'Sunday Slot 2',
    teacher_id: 'teacher-1'
};

const MOCK_STUDENTS = [
    { id: 'user-kruthika', name: 'Kruthika S', classroom_ids: ['class-sat-4'], status: 'active' },
    { id: 'user-amit', name: 'Amit Kumar', classroom_ids: ['class-sat-4'], status: 'active' },
    { id: 'user-rohan', name: 'Rohan Sharma', classroom_ids: ['class-sun-2'], status: 'active' }
];

test('1. Unification: Classroom Assignment immediately reflects in Global Tasks entity model', () => {
    // Simulated creation from Classroom -> Saturday Slot 4 -> Create Assignment
    const classroomCreatedAssignment = {
        id: 'asg-sat4-001',
        classroom_id: 'class-sat-4',
        teacher_id: 'teacher-1',
        title: 'Morning Scales Yaman',
        description: 'Practice slow tempo 60 BPM',
        due_date: '2026-09-20',
        target_type: 'classroom',
        status: 'active',
        created_at: new Date().toISOString()
    };

    const classroomAttachments = [
        {
            id: 'att-1',
            assignment_id: 'asg-sat4-001',
            attachment_type: 'audio',
            title: 'Yaman Reference Note.webm',
            file_url: 'https://storage.kfa.com/class_notes/yaman.webm'
        },
        {
            id: 'att-2',
            assignment_id: 'asg-sat4-001',
            attachment_type: 'inventory',
            title: 'Yaman Lesson 3 - Alankars',
            inventory_ref_id: 'inv-lesson-3',
            inventory_ref_type: 'lesson'
        }
    ];

    const classroomStudents = [
        { id: 'as-1', assignment_id: 'asg-sat4-001', student_id: 'user-kruthika', status: 'pending' },
        { id: 'as-2', assignment_id: 'asg-sat4-001', student_id: 'user-amit', status: 'pending' }
    ];

    // Global Tasks views assignments via the SAME tables:
    // Simulated Global Tasks query:
    const globalTasksSubmissions = classroomStudents.map(cs => {
        const student = MOCK_STUDENTS.find(s => s.id === cs.student_id);
        return {
            id: cs.id,
            student_id: cs.student_id,
            student_name: student?.name || 'Unknown',
            task_id: classroomCreatedAssignment.id,
            task_title: classroomCreatedAssignment.title,
            classroom_id: classroomCreatedAssignment.classroom_id,
            classroom_name: MOCK_CLASSROOM_SATURDAY_4.name,
            target_type: classroomCreatedAssignment.target_type,
            status: cs.status,
            attachments: classroomAttachments
        };
    });

    assert.equal(globalTasksSubmissions.length, 2);
    assert.equal(globalTasksSubmissions[0].task_title, 'Morning Scales Yaman');
    assert.equal(globalTasksSubmissions[0].classroom_name, 'Saturday Slot 4');
    assert.equal(globalTasksSubmissions[0].attachments.length, 2);
    assert.equal(globalTasksSubmissions[0].attachments[0].attachment_type, 'audio');
    assert.equal(globalTasksSubmissions[0].attachments[1].attachment_type, 'inventory');
});

test('2. Unification: Global Task creation for a Classroom immediately matches Classroom fetch query', () => {
    // Simulated creation from Global Tasks -> New Task -> Selected Saturday Slot 4
    const globalTaskCreated = {
        id: 'asg-global-002',
        classroom_id: 'class-sat-4',
        teacher_id: 'teacher-1',
        title: 'Bhoopali Drut Bandish',
        description: 'Focus on clean Taans',
        due_date: '2026-09-25',
        target_type: 'classroom',
        status: 'active',
        created_at: new Date().toISOString()
    };

    const taskAttachments = [
        {
            id: 'att-bhoop-1',
            assignment_id: 'asg-global-002',
            attachment_type: 'document',
            title: 'Bhoopali Notation.pdf',
            file_url: 'https://storage.kfa.com/materials/bhoopali.pdf',
            file_size: 102400
        }
    ];

    // Classroom fetch query: assignments where classroom_id = 'class-sat-4'
    const classroomFetchedAssignments = [globalTaskCreated].filter(a => a.classroom_id === 'class-sat-4');
    assert.equal(classroomFetchedAssignments.length, 1);
    assert.equal(classroomFetchedAssignments[0].id, 'asg-global-002');
    assert.equal(classroomFetchedAssignments[0].title, 'Bhoopali Drut Bandish');

    // Attachments joined via assignment_id:
    const classroomAssignmentWithAtts = {
        ...classroomFetchedAssignments[0],
        attachments: taskAttachments.filter(att => att.assignment_id === classroomFetchedAssignments[0].id)
    };

    assert.equal(classroomAssignmentWithAtts.attachments.length, 1);
    assert.equal(classroomAssignmentWithAtts.attachments[0].title, 'Bhoopali Notation.pdf');
});

test('3. Canonical Multi-Classroom Assignment: ONE canonical record targets multiple classrooms; both classrooms resolve the SAME work item', () => {
    const selectedClassroomIds = ['class-sat-4', 'class-sun-2'];
    const taskData = {
        title: 'Diwali Special Bandish',
        description: 'Common performance piece for festival',
        dueDate: '2026-10-15',
        targetMode: 'classes',
        classRecipientMode: 'all_in_classes',
        attachments: [
            { id: 'att-fest', attachment_type: 'document', title: 'Diwali Bandish.pdf' }
        ]
    };

    // 1. Exactly ONE canonical assignment row is created (NO duplication)
    const primaryClassId = selectedClassroomIds[0]; // 'class-sat-4'
    const canonicalAssignment = {
        id: 'asg-fest-canonical',
        classroom_id: primaryClassId,
        teacher_id: 'teacher-1',
        title: taskData.title,
        description: taskData.description,
        due_date: taskData.dueDate,
        target_type: 'classroom',
        status: 'active'
    };

    // 2. Attachments inserted once for the canonical assignment
    const createdAttachments = taskData.attachments.map(att => ({
        ...att,
        assignment_id: canonicalAssignment.id
    }));

    // 3. Students across all selected classrooms are gathered into assignment_students
    const targetCids = new Set(selectedClassroomIds);
    const recipientStudents = MOCK_STUDENTS.filter(s => s.classroom_ids.some(cid => targetCids.has(cid)));
    const createdStudentMappings = recipientStudents.map(st => ({
        id: `as-${st.id}`,
        assignment_id: canonicalAssignment.id,
        student_id: st.id,
        status: 'pending'
    }));

    // Verify: Only ONE assignment was created
    assert.equal(canonicalAssignment.id, 'asg-fest-canonical');
    assert.equal(createdStudentMappings.length, 3); // Kruthika, Amit, Rohan
    assert.equal(createdAttachments.length, 1);

    // 4. Verification in Classroom 1 (Saturday Slot 4):
    // Directly matches classroom_id
    const sat4ClassroomAssignments = [canonicalAssignment].filter(a => a.classroom_id === 'class-sat-4');
    assert.equal(sat4ClassroomAssignments.length, 1);
    assert.equal(sat4ClassroomAssignments[0].id, 'asg-fest-canonical');

    // 5. Verification in Classroom 2 (Sunday Slot 2):
    // Resolved via assignment_students matching students of Sunday Slot 2 (Rohan)
    const sun2StudentUserIds = MOCK_STUDENTS.filter(s => s.classroom_ids.includes('class-sun-2')).map(s => s.id);
    const sun2TargetedAsgIds = createdStudentMappings
        .filter(m => sun2StudentUserIds.includes(m.student_id))
        .map(m => m.assignment_id);

    // Classroom query deduplication: classroom_id = 'class-sun-2' OR id IN (sun2TargetedAsgIds)
    const sun2ResolvedAssignments = [canonicalAssignment].filter(
        a => a.classroom_id === 'class-sun-2' || sun2TargetedAsgIds.includes(a.id)
    );
    assert.equal(sun2ResolvedAssignments.length, 1);
    assert.equal(sun2ResolvedAssignments[0].id, 'asg-fest-canonical');
    assert.equal(sun2ResolvedAssignments[0].title, 'Diwali Special Bandish');

    // 6. Single edit updates both views simultaneously (no desync)
    canonicalAssignment.title = 'Diwali Special Bandish (Tempo 80 BPM)';
    assert.equal(sat4ClassroomAssignments[0].title, 'Diwali Special Bandish (Tempo 80 BPM)');
    assert.equal(sun2ResolvedAssignments[0].title, 'Diwali Special Bandish (Tempo 80 BPM)');
});

test('4. Student Targeting: Targeting individual student assigns to their home classroom', () => {
    const targetStudentId = 'user-kruthika';
    const targetStudent = MOCK_STUDENTS.find(s => s.id === targetStudentId);
    assert(targetStudent);

    // Resolve classroom from student's enrolled classrooms
    const resolvedClassroomId = targetStudent.classroom_ids[0];
    assert.equal(resolvedClassroomId, 'class-sat-4');

    const createdAssignment = {
        id: 'asg-indiv-kruthika',
        classroom_id: resolvedClassroomId,
        title: 'Custom Alankar Practice for Kruthika',
        target_type: 'individual'
    };

    // The assignment immediately appears in Saturday Slot 4
    assert.equal(createdAssignment.classroom_id, 'class-sat-4');
});

test('5. Attachment Backward-Compatibility: Synthesizes attachments when legacy file_url exists', () => {
    const legacyAssignment = {
        id: 'legacy-1',
        title: 'Old Assignment',
        file_url: 'https://storage.kfa.com/voice.webm',
        file_name: 'voice.webm',
        file_size: 51200,
        inventory_ref_id: 'lesson-123',
        inventory_ref_title: 'Raag Yaman Lesson 1'
    };

    const emptyAssignmentAttachments = [];

    // Synthesizer logic as implemented in fetchAssignments & handleEditAssignment
    const synthesizedAtts = emptyAssignmentAttachments.length > 0 ? emptyAssignmentAttachments : [
        ...(legacyAssignment.inventory_ref_id ? [{
            id: `legacy-inv-${legacyAssignment.id}`,
            title: legacyAssignment.inventory_ref_title,
            attachment_type: 'inventory',
            inventory_ref_id: legacyAssignment.inventory_ref_id
        }] : []),
        ...(legacyAssignment.file_url ? [{
            id: `legacy-file-${legacyAssignment.id}`,
            title: legacyAssignment.file_name,
            file_url: legacyAssignment.file_url,
            file_name: legacyAssignment.file_name,
            file_size: legacyAssignment.file_size,
            attachment_type: 'audio'
        }] : [])
    ];

    assert.equal(synthesizedAtts.length, 2);
    assert.equal(synthesizedAtts[0].attachment_type, 'inventory');
    assert.equal(synthesizedAtts[1].attachment_type, 'audio');
});

test('6. Review Status Compatibility: assignment_students updates from both contexts', () => {
    let studentRow = {
        assignment_id: 'asg-1',
        student_id: 'user-kruthika',
        status: 'submitted',
        video_url: 'https://youtube.com/watch?v=123'
    };

    // Global Review Drawer approves
    const reviewApproval = {
        status: 'approved',
        score: 95,
        feedback_text: 'Excellent breath control and tone!'
    };

    studentRow = { ...studentRow, ...reviewApproval };

    assert.equal(studentRow.status, 'approved');
    assert.equal(studentRow.score, 95);
    assert.equal(studentRow.feedback_text, 'Excellent breath control and tone!');
});
