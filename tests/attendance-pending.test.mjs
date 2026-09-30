import test from 'node:test';
import assert from 'node:assert/strict';
import createJiti from 'jiti';

const jiti = createJiti(import.meta.url);

const {
    isSessionEnded,
    derivePendingAttendanceSessions,
    calculatePendingSummary,
    filterPendingSessions
} = jiti('../src/lib/attendance-pending.ts');

test('1. Past class — all attendance marked → NOT shown as pending', () => {
    const fixedNow = new Date('2026-09-30T16:00:00Z');
    const result = derivePendingAttendanceSessions({
        fromDate: '2026-09-19',
        toDate: '2026-09-19',
        classrooms: [{ id: 'cls-1', name: 'Saturday Slot 5' }],
        batchSchedules: [{ classroom_id: 'cls-1', day_of_week: 6, start_time: '12:00:00', end_time: '13:00:00' }],
        temporaryClasses: [],
        permanentStudents: [
            { classroom_id: 'cls-1', student_id: 'st-1', joined_at: '2026-08-01', users: { name: 'Rahul', status: 'active', join_date: '2026-08-01' } },
            { classroom_id: 'cls-1', student_id: 'st-2', joined_at: '2026-08-01', users: { name: 'Saransh', status: 'active', join_date: '2026-08-01' } }
        ],
        sessionOverrides: [],
        attendanceRows: [
            { student_id: 'st-1', classroom_id: 'cls-1', date: '2026-09-19', status: 'present' },
            { student_id: 'st-2', classroom_id: 'cls-1', date: '2026-09-19', status: 'present' }
        ],
        coveredAttendanceRows: [],
        referenceNow: fixedNow
    });

    assert.equal(result.length, 0, 'No sessions should be pending when all students are marked');
});

test('2. Past class — one student missing attendance → only that student shown', () => {
    const fixedNow = new Date('2026-09-30T16:00:00Z');
    const result = derivePendingAttendanceSessions({
        fromDate: '2026-09-19',
        toDate: '2026-09-19',
        classrooms: [{ id: 'cls-1', name: 'Saturday Slot 5' }],
        batchSchedules: [{ classroom_id: 'cls-1', day_of_week: 6, start_time: '12:00:00', end_time: '13:00:00' }],
        temporaryClasses: [],
        permanentStudents: [
            { classroom_id: 'cls-1', student_id: 'st-1', joined_at: '2026-08-01', users: { name: 'Rahul', status: 'active', join_date: '2026-08-01' } },
            { classroom_id: 'cls-1', student_id: 'st-2', joined_at: '2026-08-01', users: { name: 'Saransh', status: 'active', join_date: '2026-08-01' } }
        ],
        sessionOverrides: [],
        attendanceRows: [
            { student_id: 'st-1', classroom_id: 'cls-1', date: '2026-09-19', status: 'present' }
            // st-2 Saransh has no attendance status
        ],
        coveredAttendanceRows: [],
        referenceNow: fixedNow
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].classroomId, 'cls-1');
    assert.equal(result[0].pendingStudents.length, 1);
    assert.equal(result[0].pendingStudents[0].studentId, 'st-2');
    assert.equal(result[0].pendingStudents[0].studentName, 'Saransh');
    assert.equal(result[0].markedCount, 1);
    assert.equal(result[0].totalExpectedCount, 2);
});

test('3. Past class — entire attendance forgotten → all expected students shown', () => {
    const fixedNow = new Date('2026-09-30T16:00:00Z');
    const result = derivePendingAttendanceSessions({
        fromDate: '2026-09-19',
        toDate: '2026-09-19',
        classrooms: [{ id: 'cls-1', name: 'Saturday Slot 5' }],
        batchSchedules: [{ classroom_id: 'cls-1', day_of_week: 6, start_time: '12:00:00', end_time: '13:00:00' }],
        temporaryClasses: [],
        permanentStudents: [
            { classroom_id: 'cls-1', student_id: 'st-1', joined_at: '2026-08-01', users: { name: 'Rahul', status: 'active', join_date: '2026-08-01' } },
            { classroom_id: 'cls-1', student_id: 'st-2', joined_at: '2026-08-01', users: { name: 'Saransh', status: 'active', join_date: '2026-08-01' } }
        ],
        sessionOverrides: [],
        attendanceRows: [], // completely forgotten
        coveredAttendanceRows: [],
        referenceNow: fixedNow
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].markedCount, 0);
    assert.equal(result[0].pendingStudents.length, 2);
    assert.deepEqual(result[0].pendingStudents.map(s => s.studentName), ['Rahul', 'Saransh']);
});

test('4. Future class → NOT shown as pending', () => {
    const fixedNow = new Date('2026-09-30T16:00:00Z');
    const result = derivePendingAttendanceSessions({
        fromDate: '2026-10-01',
        toDate: '2026-10-05',
        classrooms: [{ id: 'cls-1', name: 'Saturday Slot 5' }],
        batchSchedules: [{ classroom_id: 'cls-1', day_of_week: 6, start_time: '12:00:00', end_time: '13:00:00' }],
        temporaryClasses: [],
        permanentStudents: [{ classroom_id: 'cls-1', student_id: 'st-1', users: { name: 'Rahul', status: 'active' } }],
        sessionOverrides: [],
        attendanceRows: [],
        coveredAttendanceRows: [],
        referenceNow: fixedNow
    });

    assert.equal(result.length, 0, 'Future classes must never appear in pending attendance');
});

test('5. Today class before end time → NOT shown', () => {
    // Current time is 15:30 (3:30 PM), class is 17:00 - 18:00 (5 PM - 6 PM)
    const fixedNow = new Date('2026-09-30T15:30:00');
    assert.equal(isSessionEnded('2026-09-30', '18:00:00', fixedNow), false);

    const result = derivePendingAttendanceSessions({
        fromDate: '2026-09-30',
        toDate: '2026-09-30',
        classrooms: [{ id: 'cls-today', name: 'Wednesday Slot 1' }],
        batchSchedules: [{ classroom_id: 'cls-today', day_of_week: 3, start_time: '17:00:00', end_time: '18:00:00' }],
        temporaryClasses: [],
        permanentStudents: [{ classroom_id: 'cls-today', student_id: 'st-1', users: { name: 'Rahul', status: 'active' } }],
        sessionOverrides: [],
        attendanceRows: [],
        coveredAttendanceRows: [],
        referenceNow: fixedNow
    });

    assert.equal(result.length, 0, 'Ongoing or upcoming today classes must not appear pending');
});

test('6. Today class after end time → pending students shown', () => {
    // Current time is 18:30 (6:30 PM), class was 17:00 - 18:00 (5 PM - 6 PM)
    const fixedNow = new Date('2026-09-30T18:30:00');
    assert.equal(isSessionEnded('2026-09-30', '18:00:00', fixedNow), true);

    const result = derivePendingAttendanceSessions({
        fromDate: '2026-09-30',
        toDate: '2026-09-30',
        classrooms: [{ id: 'cls-today', name: 'Wednesday Slot 1' }],
        batchSchedules: [{ classroom_id: 'cls-today', day_of_week: 3, start_time: '17:00:00', end_time: '18:00:00' }],
        temporaryClasses: [],
        permanentStudents: [{ classroom_id: 'cls-today', student_id: 'st-1', users: { name: 'Rahul', status: 'active' } }],
        sessionOverrides: [],
        attendanceRows: [],
        coveredAttendanceRows: [],
        referenceNow: fixedNow
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].pendingStudents[0].studentName, 'Rahul');
});

test('7. Student joined after historical class date → NOT shown as pending for earlier class', () => {
    const fixedNow = new Date('2026-09-30T16:00:00Z');
    // Prasanna Prabhu joined on 2026-09-26
    const result = derivePendingAttendanceSessions({
        fromDate: '2026-09-19',
        toDate: '2026-09-19',
        classrooms: [{ id: 'cls-1', name: 'Saturday Slot 5' }],
        batchSchedules: [{ classroom_id: 'cls-1', day_of_week: 6, start_time: '12:00:00', end_time: '13:00:00' }],
        temporaryClasses: [],
        permanentStudents: [
            { classroom_id: 'cls-1', student_id: 'st-1', joined_at: '2026-08-01', users: { name: 'Rahul', status: 'active', join_date: '2026-08-01' } },
            { classroom_id: 'cls-1', student_id: 'st-2', joined_at: '2026-08-01', users: { name: 'Saransh', status: 'active', join_date: '2026-08-01' } },
            { classroom_id: 'cls-1', student_id: 'st-3', joined_at: '2026-09-26', users: { name: 'Prasanna', status: 'active', join_date: '2026-09-26' } }
        ],
        sessionOverrides: [],
        attendanceRows: [
            { student_id: 'st-1', classroom_id: 'cls-1', date: '2026-09-19', status: 'present' },
            { student_id: 'st-2', classroom_id: 'cls-1', date: '2026-09-19', status: 'present' }
        ],
        coveredAttendanceRows: [],
        referenceNow: fixedNow
    });

    assert.equal(result.length, 0, 'Prasanna must not be considered pending on 19 Sept because he joined on 26 Sept');
});

test('8. Attendance covered via on_behalf_of_date → NOT pending on original scheduled date', () => {
    const fixedNow = new Date('2026-09-30T16:00:00Z');
    // 29 Aug class was taken on behalf of 12 Sept
    // Student A & B attended on 29 Aug with on_behalf_of_date = 2026-09-12
    // Student C was not marked on 29 Aug
    const result = derivePendingAttendanceSessions({
        fromDate: '2026-09-12',
        toDate: '2026-09-12',
        classrooms: [{ id: 'cls-sat-1', name: 'Saturday Slot 1' }],
        batchSchedules: [{ classroom_id: 'cls-sat-1', day_of_week: 6, start_time: '08:00:00', end_time: '09:00:00' }],
        temporaryClasses: [],
        permanentStudents: [
            { classroom_id: 'cls-sat-1', student_id: 'st-A', joined_at: '2026-08-01', users: { name: 'Snigdha', status: 'active' } },
            { classroom_id: 'cls-sat-1', student_id: 'st-B', joined_at: '2026-08-01', users: { name: 'Paramasivam', status: 'active' } },
            { classroom_id: 'cls-sat-1', student_id: 'st-C', joined_at: '2026-08-01', users: { name: 'Divya', status: 'active' } }
        ],
        sessionOverrides: [],
        attendanceRows: [], // No physical attendance marked on 12 Sept
        coveredAttendanceRows: [
            // Marked on 29 Aug on behalf of 12 Sept
            { student_id: 'st-A', classroom_id: 'cls-sat-1', date: '2026-08-29', on_behalf_of_date: '2026-09-12', status: 'present' },
            { student_id: 'st-B', classroom_id: 'cls-sat-1', date: '2026-08-29', on_behalf_of_date: '2026-09-12', status: 'present' }
        ],
        referenceNow: fixedNow
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].markedCount, 2, 'Snigdha and Paramasivam were covered on behalf of 12 Sept');
    assert.equal(result[0].pendingStudents.length, 1, 'Only Divya should be pending');
    assert.equal(result[0].pendingStudents[0].studentName, 'Divya');
});

test('9. Mapped ABSENT/LATE/EXCUSED via on_behalf_of_date → considered marked, NOT pending', () => {
    const fixedNow = new Date('2026-09-30T16:00:00Z');
    const result = derivePendingAttendanceSessions({
        fromDate: '2026-09-12',
        toDate: '2026-09-12',
        classrooms: [{ id: 'cls-sat-1', name: 'Saturday Slot 1' }],
        batchSchedules: [{ classroom_id: 'cls-sat-1', day_of_week: 6, start_time: '08:00:00', end_time: '09:00:00' }],
        temporaryClasses: [],
        permanentStudents: [
            { classroom_id: 'cls-sat-1', student_id: 'st-A', joined_at: '2026-08-01', users: { name: 'Snigdha', status: 'active' } },
            { classroom_id: 'cls-sat-1', student_id: 'st-B', joined_at: '2026-08-01', users: { name: 'Paramasivam', status: 'active' } },
            { classroom_id: 'cls-sat-1', student_id: 'st-C', joined_at: '2026-08-01', users: { name: 'Divya', status: 'active' } }
        ],
        sessionOverrides: [],
        attendanceRows: [],
        coveredAttendanceRows: [
            { student_id: 'st-A', classroom_id: 'cls-sat-1', date: '2026-08-29', on_behalf_of_date: '2026-09-12', status: 'present' },
            { student_id: 'st-B', classroom_id: 'cls-sat-1', date: '2026-08-29', on_behalf_of_date: '2026-09-12', status: 'late' },
            { student_id: 'st-C', classroom_id: 'cls-sat-1', date: '2026-08-29', on_behalf_of_date: '2026-09-12', status: 'absent' }
        ],
        referenceNow: fixedNow
    });

    assert.equal(result.length, 0, 'All 3 had finalized status on 29 Aug on behalf of 12 Sept (present, late, absent)');
});

test('10. Guest / makeup / session override → included in expected roster and identified if unmarked', () => {
    const fixedNow = new Date('2026-09-30T16:00:00Z');
    const result = derivePendingAttendanceSessions({
        fromDate: '2026-09-19',
        toDate: '2026-09-19',
        classrooms: [{ id: 'cls-1', name: 'Saturday Slot 5' }],
        batchSchedules: [{ classroom_id: 'cls-1', day_of_week: 6, start_time: '12:00:00', end_time: '13:00:00' }],
        temporaryClasses: [],
        permanentStudents: [
            { classroom_id: 'cls-1', student_id: 'st-1', joined_at: '2026-08-01', users: { name: 'Rahul', status: 'active' } }
        ],
        sessionOverrides: [
            // Guest makeup student
            { target_classroom_id: 'cls-1', student_id: 'st-guest', override_date: '2026-09-19', missed_session_date: '2026-09-12', users: { name: 'Guest Student', status: 'active' } }
        ],
        attendanceRows: [
            { student_id: 'st-1', classroom_id: 'cls-1', date: '2026-09-19', status: 'present' }
        ],
        coveredAttendanceRows: [],
        referenceNow: fixedNow
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].totalExpectedCount, 2);
    assert.equal(result[0].markedCount, 1);
    assert.equal(result[0].pendingStudents.length, 1);
    assert.equal(result[0].pendingStudents[0].studentName, 'Guest Student');
    assert.equal(result[0].pendingStudents[0].isMakeup, true);
});

test('11. Cancelled session → NOT shown', () => {
    const fixedNow = new Date('2026-09-30T16:00:00Z');
    const result = derivePendingAttendanceSessions({
        fromDate: '2026-09-19',
        toDate: '2026-09-19',
        classrooms: [{ id: 'cls-cancelled', name: 'Cancelled Class', lifecycle_status: 'cancelled' }],
        batchSchedules: [{ classroom_id: 'cls-cancelled', day_of_week: 6, start_time: '12:00:00', end_time: '13:00:00' }],
        temporaryClasses: [
            { id: 'tc-cancelled', title: 'Cancelled Special Session', class_date: '2026-09-19', start_time: '14:00:00', end_time: '15:00:00', lifecycle_status: 'cancelled' }
        ],
        permanentStudents: [{ classroom_id: 'cls-cancelled', student_id: 'st-1', users: { name: 'Rahul', status: 'active' } }],
        sessionOverrides: [],
        attendanceRows: [],
        coveredAttendanceRows: [],
        referenceNow: fixedNow
    });

    assert.equal(result.length, 0, 'Cancelled sessions must not appear in pending attendance');
});

test('12. calculatePendingSummary and filtering', () => {
    const sessions = [
        {
            sessionKey: 'cls-1_2026-09-12',
            classroomId: 'cls-1',
            classroomName: 'Batch 1',
            date: '2026-09-12',
            startTime: '10:00:00',
            endTime: '11:00:00',
            timeFormatted: '10:00 AM – 11:00 AM',
            isTemporary: false,
            pendingStudents: [
                { studentId: 'st-1', studentName: 'Alice' },
                { studentId: 'st-2', studentName: 'Bob' }
            ],
            markedCount: 0,
            totalExpectedCount: 2
        },
        {
            sessionKey: 'cls-2_2026-09-19',
            classroomId: 'cls-2',
            classroomName: 'Batch 2',
            date: '2026-09-19',
            startTime: '12:00:00',
            endTime: '13:00:00',
            timeFormatted: '12:00 PM – 1:00 PM',
            isTemporary: false,
            pendingStudents: [
                { studentId: 'st-3', studentName: 'Charlie' }
            ],
            markedCount: 2,
            totalExpectedCount: 3
        }
    ];

    const summary = calculatePendingSummary(sessions);
    assert.equal(summary.totalPendingStudents, 3);
    assert.equal(summary.affectedClassesCount, 2);
    assert.equal(summary.oldestPendingDate, '2026-09-12');

    // Filter 'unmarked' (markedCount === 0)
    const unmarked = filterPendingSessions(sessions, 'unmarked');
    assert.equal(unmarked.length, 1);
    assert.equal(unmarked[0].classroomId, 'cls-1');

    // Filter 'partial' (markedCount > 0)
    const partial = filterPendingSessions(sessions, 'partial');
    assert.equal(partial.length, 1);
    assert.equal(partial[0].classroomId, 'cls-2');

    // Filter by student search query 'bob'
    const bobOnly = filterPendingSessions(sessions, 'all', 'bob');
    assert.equal(bobOnly.length, 1);
    assert.equal(bobOnly[0].pendingStudents.length, 1);
    assert.equal(bobOnly[0].pendingStudents[0].studentName, 'Bob');
});
