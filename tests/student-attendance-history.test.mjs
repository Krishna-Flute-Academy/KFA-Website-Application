import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import createJiti from 'jiti';

const jiti = createJiti(import.meta.url);
const {
    getStudentFeeCycleLedger,
    calculateStudentFeeCycleMetrics
} = jiti('../src/lib/fee-utils.ts');
const {
    normalizeStudentAttendanceHistory
} = jiti('../src/lib/student-attendance-history.ts');

test('Selva Kumar Scenario: Classroom Transfer preserves historical Saturday attendance and avoids fake Tuesday sessions', () => {
    // Selva Kumar billing cycle: 1st of month (Sept 1 to Oct 1)
    const student = {
        id: 'student-selva-kumar',
        name: 'Selva Kumar',
        fees_basis: 'monthly',
        fees_collection_date: 1,
        join_date: '2026-01-01',
        status: 'active'
    };

    // Classrooms:
    // 1. Previous: Saturday 11 AM Batch
    // 2. Current: Tuesday Slot 3 (joined 29 Sep 2026)
    const classrooms = [
        {
            id: 'cls-tuesday-slot3',
            name: 'Tuesday Slot 3 (Online – 7:30 PM)',
            type: 'regular',
            joined_at: '2026-09-29T00:00:00.000Z'
        },
        {
            id: 'cls-saturday-11am',
            name: 'Saturday 11:00 AM (Online)',
            type: 'regular'
        }
    ];

    // Current schedule is Tuesday (dow 2)
    const batchSchedules = [
        {
            classroom_id: 'cls-tuesday-slot3',
            day_of_week: 2,
            start_time: '19:30',
            end_time: '20:30'
        }
    ];

    // Selva's real September attendance recorded under the Saturday classroom:
    // - 05 Sep — Saturday 11 AM — Present
    // - 12 Sep — Saturday 11 AM — Present
    // - 19 Sep — Saturday 11 AM — Absent
    // - 26 Sep — Saturday 11 AM — Present
    const attendance = [
        {
            id: 'att-sep-05',
            student_id: 'student-selva-kumar',
            classroom_id: 'cls-saturday-11am',
            classroom_name: 'Saturday 11:00 AM (Online)',
            date: '2026-09-05',
            status: 'present'
        },
        {
            id: 'att-sep-12',
            student_id: 'student-selva-kumar',
            classroom_id: 'cls-saturday-11am',
            classroom_name: 'Saturday 11:00 AM (Online)',
            date: '2026-09-12',
            status: 'present'
        },
        {
            id: 'att-sep-19',
            student_id: 'student-selva-kumar',
            classroom_id: 'cls-saturday-11am',
            classroom_name: 'Saturday 11:00 AM (Online)',
            date: '2026-09-19',
            status: 'absent'
        },
        {
            id: 'att-sep-26',
            student_id: 'student-selva-kumar',
            classroom_id: 'cls-saturday-11am',
            classroom_name: 'Saturday 11:00 AM (Online)',
            date: '2026-09-26',
            status: 'present'
        }
    ];

    const payments = [
        { payment_date: '2026-09-01', amount: 3000, status: 'approved' }
    ];

    // Evaluate fee cycle ledger as of 29 September 2026
    const report = getStudentFeeCycleLedger({
        student,
        classrooms,
        batchSchedules,
        attendance,
        payments,
        today: new Date('2026-09-29T12:00:00Z')
    });

    // 1. Verify that NO fake Tuesday sessions exist on 1, 8, 15, or 22 September
    const fakeTuesdaySessions = report.sessions.filter(s =>
        ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22'].includes(s.date)
    );
    assert.equal(fakeTuesdaySessions.length, 0, 'Must NOT generate fake Tuesday sessions prior to 29 Sep transfer date');

    // 2. Verify that all 4 Saturday sessions are present under their original Saturday classroom
    const satSessions = report.sessions.filter(s =>
        ['2026-09-05', '2026-09-12', '2026-09-19', '2026-09-26'].includes(s.date)
    );
    assert.equal(satSessions.length, 4, 'All 4 September Saturday classes must be present in the ledger');

    satSessions.forEach(sess => {
        assert.equal(sess.classroomId, 'cls-saturday-11am', `Session ${sess.date} must belong to Saturday classroom`);
        assert.equal(sess.classroomName, 'Saturday 11:00 AM (Online)', `Session ${sess.date} must have Saturday classroom name`);
    });

    // Verify individual status outcomes
    const sep05 = satSessions.find(s => s.date === '2026-09-05');
    const sep12 = satSessions.find(s => s.date === '2026-09-12');
    const sep19 = satSessions.find(s => s.date === '2026-09-19');
    const sep26 = satSessions.find(s => s.date === '2026-09-26');

    assert.equal(sep05.status, 'attended');
    assert.equal(sep12.status, 'attended');
    assert.equal(sep19.status, 'absent');
    assert.equal(sep26.status, 'attended');

    // 3. Verify that Tuesday 29 Sep is recognized (since today is 29 Sep and joined_at is 29 Sep)
    const sep29 = report.sessions.find(s => s.date === '2026-09-29');
    assert.ok(sep29, 'Tuesday 29 Sep session should be recognized on or after the transfer date');
    assert.equal(sep29.classroomId, 'cls-tuesday-slot3', 'Tuesday 29 Sep session must belong to Tuesday classroom');

    // 4. Accounting summary checks
    assert.equal(report.summary.entitledClasses, 4, 'Selva has 4 entitled classes');
    assert.equal(report.summary.consumedClasses, 4, 'Selva consumed 4 classes (3 present + 1 unexcused absent)');
    assert.equal(report.summary.creditsRemaining, 0, 'Credits remaining is 0');
    assert.equal(report.summary.unresolvedSessions, 0, 'Zero unresolved sessions (no fake missing attendance)');
    assert.equal(report.summary.hasDiscrepancy, false, 'No discrepancy flag');
});

test('Canonical Student Attendance History: normalizeStudentAttendanceHistory across classroom transfers', () => {
    const studentId = 'student-selva-kumar';

    const attendance = [
        {
            id: 'a1',
            student_id: studentId,
            classroom_id: 'cls-sat',
            date: '2026-09-05',
            status: 'present'
        },
        {
            id: 'a2',
            student_id: studentId,
            classroom_id: 'cls-sat',
            date: '2026-09-12',
            status: 'present'
        },
        {
            id: 'a3',
            student_id: studentId,
            classroom_id: 'cls-sat',
            date: '2026-09-19',
            status: 'absent'
        },
        {
            id: 'a4',
            student_id: studentId,
            classroom_id: 'cls-sat',
            date: '2026-09-26',
            status: 'present'
        },
        // Attended early on 29 Aug on behalf of 12 Sept
        {
            id: 'a0',
            student_id: studentId,
            classroom_id: 'cls-sat',
            date: '2026-08-29',
            on_behalf_of_date: '2026-09-12',
            status: 'present'
        },
        // Transferred to Tuesday batch in October
        {
            id: 'a5',
            student_id: studentId,
            classroom_id: 'cls-tue',
            date: '2026-10-06',
            status: 'late'
        },
        // Guest makeup class in a Sunday batch
        {
            id: 'a6',
            student_id: studentId,
            classroom_id: 'cls-sun',
            date: '2026-10-11',
            status: 'present'
        }
    ];

    const classrooms = [
        { id: 'cls-sat', name: 'Saturday 11 AM' },
        { id: 'cls-tue', name: 'Tuesday 7:30 PM' },
        { id: 'cls-sun', name: 'Sunday 10 AM (Guest)' }
    ];

    const overrides = [
        {
            id: 'ov-1',
            student_id: studentId,
            target_classroom_id: 'cls-sun',
            override_date: '2026-10-11',
            reason: 'Makeup for missed class [MissedDate:2026-09-19]'
        }
    ];

    const result = normalizeStudentAttendanceHistory({
        studentId,
        attendance,
        classrooms,
        overrides
    });

    assert.equal(result.studentId, studentId);
    assert.equal(result.records.length, 7, 'Must normalize all 7 attendance records');

    // 1. Verify On-Behalf-Of record
    const onBehalfRecord = result.records.find(r => r.id === 'a0');
    assert.ok(onBehalfRecord);
    assert.equal(onBehalfRecord.actualDate, '2026-08-29');
    assert.equal(onBehalfRecord.scheduledDate, '2026-09-12');
    assert.equal(onBehalfRecord.isOnBehalf, true);
    assert.equal(onBehalfRecord.onBehalfOfDate, '2026-09-12');

    // 2. Verify Guest Makeup record
    const makeupRecord = result.records.find(r => r.id === 'a6');
    assert.ok(makeupRecord);
    assert.equal(makeupRecord.sessionType, 'guest_makeup');
    assert.equal(makeupRecord.isMakeup, true);
    assert.equal(makeupRecord.missedDate, '2026-09-19');
    assert.equal(makeupRecord.classroomName, 'Sunday 10 AM (Guest)');

    // 3. Verify classroom names remain accurate and immutable
    const satRecords = result.records.filter(r => r.classroomId === 'cls-sat');
    assert.equal(satRecords.length, 5);
    satRecords.forEach(r => assert.equal(r.classroomName, 'Saturday 11 AM'));

    const tueRecord = result.records.find(r => r.classroomId === 'cls-tue');
    assert.ok(tueRecord);
    assert.equal(tueRecord.classroomName, 'Tuesday 7:30 PM');
    assert.equal(tueRecord.status, 'late');

    // 4. Verify Summary counts
    assert.equal(result.summary.totalSessions, 7);
    assert.equal(result.summary.presentCount, 5);
    assert.equal(result.summary.lateCount, 1);
    assert.equal(result.summary.absentCount, 1);
    assert.equal(result.summary.excusedCount, 0);
    // Attended = 5 + 1 = 6 / 7 = 86%
    assert.equal(result.summary.attendanceRate, 86);
});

test('Database Trigger Migration: verifies attendance update is removed from transfer trigger', () => {
    const migrationPath = path.resolve(
        process.cwd(),
        'supabase/migrations/20260930120000_preserve_historical_attendance_on_classroom_shift.sql'
    );
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');

    // Assert that the migration does NOT update public.attendance
    assert.equal(
        /UPDATE\s+public\.attendance/i.test(sqlContent),
        false,
        'Migration must NOT contain any UPDATE public.attendance statement'
    );

    // Assert that it DOES retain curriculum and assignment transfers
    assert.ok(
        sqlContent.includes('UPDATE public.student_topic_progress'),
        'Must retain student_topic_progress transfer'
    );
    assert.ok(
        sqlContent.includes('UPDATE public.assignment_students'),
        'Must retain assignment_students transfer'
    );
    assert.ok(
        sqlContent.includes('UPDATE public.classroom_inventory_allocation'),
        'Must retain classroom_inventory_allocation transfer'
    );
});

test('Requirement 13: A -> B Transfer maintains A history and B future', () => {
    const studentId = 'student-ab';
    const attendance = [
        { id: '1', student_id: studentId, classroom_id: 'cls-A', date: '2026-08-01', status: 'present' },
        { id: '2', student_id: studentId, classroom_id: 'cls-A', date: '2026-08-08', status: 'present' },
        { id: '3', student_id: studentId, classroom_id: 'cls-B', date: '2026-09-01', status: 'present' }
    ];
    const classrooms = [
        { id: 'cls-A', name: 'Classroom A' },
        { id: 'cls-B', name: 'Classroom B' }
    ];
    const res = normalizeStudentAttendanceHistory({ studentId, attendance, classrooms });
    assert.equal(res.records.find(r => r.actualDate === '2026-08-01').classroomName, 'Classroom A');
    assert.equal(res.records.find(r => r.actualDate === '2026-08-08').classroomName, 'Classroom A');
    assert.equal(res.records.find(r => r.actualDate === '2026-09-01').classroomName, 'Classroom B');
});

test('Requirement 13: A -> B -> C Multi-Transfer preserves each historical phase', () => {
    const studentId = 'student-abc';
    const attendance = [
        { id: '1', student_id: studentId, classroom_id: 'cls-A', date: '2026-07-01', status: 'present' },
        { id: '2', student_id: studentId, classroom_id: 'cls-B', date: '2026-08-01', status: 'present' },
        { id: '3', student_id: studentId, classroom_id: 'cls-C', date: '2026-09-01', status: 'present' }
    ];
    const classrooms = [
        { id: 'cls-A', name: 'Room Alpha' },
        { id: 'cls-B', name: 'Room Beta' },
        { id: 'cls-C', name: 'Room Gamma' }
    ];
    const res = normalizeStudentAttendanceHistory({ studentId, attendance, classrooms });
    assert.equal(res.records.find(r => r.actualDate === '2026-07-01').classroomName, 'Room Alpha');
    assert.equal(res.records.find(r => r.actualDate === '2026-08-01').classroomName, 'Room Beta');
    assert.equal(res.records.find(r => r.actualDate === '2026-09-01').classroomName, 'Room Gamma');
});

test('Requirement 13: on_behalf_of retains physical classroom while tracking target scheduled date', () => {
    const studentId = 'student-obo';
    const attendance = [
        { 
            id: '1', 
            student_id: studentId, 
            classroom_id: 'cls-sat-4', 
            date: '2026-08-29', 
            status: 'present',
            on_behalf_of_date: '2026-09-12'
        }
    ];
    const classrooms = [
        { id: 'cls-sat-4', name: 'Saturday Slot 4 (Offline - 11 AM)' }
    ];
    const res = normalizeStudentAttendanceHistory({ studentId, attendance, classrooms });
    const item = res.records[0];
    assert.equal(item.classroomName, 'Saturday Slot 4 (Offline - 11 AM)');
    assert.equal(item.actualDate, '2026-08-29');
    assert.equal(item.scheduledDate, '2026-09-12');
    assert.equal(item.isOnBehalf, true);
});

test('Requirement 13: Non-transferred student history is completely preserved without regression', () => {
    const studentId = 'student-stable';
    const attendance = [
        { id: '1', student_id: studentId, classroom_id: 'cls-main', date: '2026-08-05', status: 'present' },
        { id: '2', student_id: studentId, classroom_id: 'cls-main', date: '2026-08-12', status: 'absent' }
    ];
    const classrooms = [{ id: 'cls-main', name: 'Main Classroom' }];
    const res = normalizeStudentAttendanceHistory({ studentId, attendance, classrooms });
    assert.equal(res.records.length, 2);
    assert.equal(res.records[0].classroomName, 'Main Classroom');
    assert.equal(res.records[1].classroomName, 'Main Classroom');
});

test('Requirement 13: Transfer to Learning Circle preserves original classroom attendance', () => {
    const studentId = 'student-learning-circle';
    const attendance = [
        { id: '1', student_id: studentId, classroom_id: 'cls-tue-3', date: '2026-08-04', status: 'present' },
        { id: '2', student_id: studentId, classroom_id: 'cls-tue-3', date: '2026-08-11', status: 'present' }
    ];
    const classrooms = [
        { id: 'cls-tue-3', name: 'Tuesday Slot 3 (Online - 7:30 PM)' },
        { id: 'cls-learning-circle', name: 'KFA Learning Circle' }
    ];
    const res = normalizeStudentAttendanceHistory({ studentId, attendance, classrooms });
    assert.equal(res.records[0].classroomName, 'Tuesday Slot 3 (Online - 7:30 PM)');
    assert.equal(res.records[1].classroomName, 'Tuesday Slot 3 (Online - 7:30 PM)');
});

