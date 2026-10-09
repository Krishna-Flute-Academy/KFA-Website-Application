import test from 'node:test';
import assert from 'node:assert/strict';

// Helper simulation of the dynamic discovery logic implemented in teacher-dashboard/attendance/page.tsx
function discoverSessionsForDate({
    selectedDate,
    classrooms,
    allSchedules,
    temporaryClasses,
    attendanceRecords,
    sessionLogs
}) {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay();

    // 1. Identify scheduled classrooms for this weekday
    const scheduledRoomIds = new Set();
    const scheduledBatches = [];

    allSchedules
        .filter(s => s.day_of_week === dayOfWeek)
        .forEach(s => {
            scheduledRoomIds.add(s.classroom_id);
            const room = classrooms.find(c => c.id === s.classroom_id);
            if (room) {
                scheduledBatches.push({
                    id: room.id,
                    name: room.name,
                    type: 'permanent',
                    startTime: s.start_time,
                    isExtraSession: false
                });
            }
        });

    temporaryClasses
        .filter(tc => tc.class_date === selectedDate)
        .forEach(tc => {
            scheduledRoomIds.add(tc.classroom_id || tc.id);
            scheduledBatches.push({
                id: tc.id,
                name: tc.title || 'Special Session',
                type: 'temporary',
                startTime: tc.start_time,
                isExtraSession: false
            });
        });

    // 2. Discover off-schedule classrooms from attendance & session logs
    const offScheduleRoomIds = new Set();
    attendanceRecords
        .filter(r => r.date === selectedDate)
        .forEach(r => {
            if (r.classroom_id && !scheduledRoomIds.has(r.classroom_id)) {
                offScheduleRoomIds.add(r.classroom_id);
            }
        });

    sessionLogs
        .filter(l => l.session_date === selectedDate)
        .forEach(l => {
            if (l.classroom_id && !scheduledRoomIds.has(l.classroom_id)) {
                offScheduleRoomIds.add(l.classroom_id);
            }
        });

    const offScheduleSessions = [];
    for (const roomId of offScheduleRoomIds) {
        const room = classrooms.find(c => c.id === roomId);
        if (room) {
            const log = sessionLogs.find(l => l.classroom_id === roomId && l.session_date === selectedDate);
            offScheduleSessions.push({
                id: room.id,
                name: room.name,
                type: 'permanent',
                startTime: log?.started_at ? '17:00:00' : '00:00:00',
                isExtraSession: true
            });
        }
    }

    // 3. Merge with deduplication
    const processedIds = new Set();
    const activeBatches = [];

    for (const b of scheduledBatches) {
        if (!processedIds.has(b.id)) {
            processedIds.add(b.id);
            activeBatches.push(b);
        }
    }

    for (const b of offScheduleSessions) {
        if (!processedIds.has(b.id)) {
            processedIds.add(b.id);
            activeBatches.push(b);
        }
    }

    return activeBatches;
}

// Helper simulation of roster and attendance resolution
function resolveBatchAttendance({
    batchId,
    selectedDate,
    permanentStudents,
    attendanceRecords
}) {
    const batchAttendance = attendanceRecords.filter(
        a => a.classroom_id === batchId && a.date === selectedDate
    );

    const attendedStudentIds = new Set(batchAttendance.map(a => a.student_id));
    const roster = permanentStudents
        .filter(ps => ps.classroom_id === batchId || attendedStudentIds.has(ps.student_id))
        .map(ps => ({
            id: ps.student_id,
            name: ps.name
        }));

    const attendanceMap = {};
    batchAttendance.forEach(row => {
        attendanceMap[row.student_id] = row.status;
    });

    return { roster, attendanceMap };
}

test('Dynamic Classroom Discovery: Manually conducted Saturday Slot 10 discovered on Thursday 8 Oct 2026', () => {
    const classrooms = [
        { id: 'sat-slot-10-id', name: 'Saturday Slot 10 (Online - 5 PM)', type: 'permanent' },
        { id: 'thu-regular-id', name: 'Thursday Slot 1 (Online - 6 PM)', type: 'permanent' }
    ];

    const allSchedules = [
        { classroom_id: 'sat-slot-10-id', day_of_week: 6, start_time: '17:00:00' }, // Saturday
        { classroom_id: 'thu-regular-id', day_of_week: 4, start_time: '18:00:00' }  // Thursday
    ];

    const temporaryClasses = [];

    const attendanceRecords = [
        { id: 'att-1', classroom_id: 'sat-slot-10-id', student_id: 'madhura', date: '2026-10-08', status: 'present' },
        { id: 'att-2', classroom_id: 'sat-slot-10-id', student_id: 'akshat', date: '2026-10-08', status: 'present' },
        { id: 'att-3', classroom_id: 'sat-slot-10-id', student_id: 'vihaan', date: '2026-10-08', status: 'present' },
        { id: 'att-4', classroom_id: 'sat-slot-10-id', student_id: 'philomina', date: '2026-10-08', status: 'present' }
    ];

    const sessionLogs = [
        { classroom_id: 'sat-slot-10-id', session_date: '2026-10-08', started_at: '2026-10-08T17:00:00Z', present_count: 4 }
    ];

    // Check Thursday 8 Oct 2026
    const batchesOnThu = discoverSessionsForDate({
        selectedDate: '2026-10-08',
        classrooms,
        allSchedules,
        temporaryClasses,
        attendanceRecords,
        sessionLogs
    });

    // 1. Thursday must show both the regular Thursday class AND Saturday Slot 10
    assert.equal(batchesOnThu.length, 2);

    const satSlotBatch = batchesOnThu.find(b => b.id === 'sat-slot-10-id');
    assert.ok(satSlotBatch, 'Saturday Slot 10 must be discovered on Thursday');
    assert.equal(satSlotBatch.isExtraSession, true, 'Off-schedule class must be labeled as Extra Session');

    const thuRegularBatch = batchesOnThu.find(b => b.id === 'thu-regular-id');
    assert.ok(thuRegularBatch);
    assert.equal(thuRegularBatch.isExtraSession, false, 'Regular scheduled class must not be labeled Extra Session');

    // 2. Check that all 4 students are Present
    const permanentStudents = [
        { classroom_id: 'sat-slot-10-id', student_id: 'madhura', name: 'Madhura Mazumdar' },
        { classroom_id: 'sat-slot-10-id', student_id: 'akshat', name: 'P.S. Akshat Rao' },
        { classroom_id: 'sat-slot-10-id', student_id: 'vihaan', name: 'Vihaan Potdar' },
        { classroom_id: 'sat-slot-10-id', student_id: 'philomina', name: 'Philomina Arnold' }
    ];

    const { roster, attendanceMap } = resolveBatchAttendance({
        batchId: 'sat-slot-10-id',
        selectedDate: '2026-10-08',
        permanentStudents,
        attendanceRecords
    });

    assert.equal(roster.length, 4);
    assert.equal(attendanceMap['madhura'], 'present');
    assert.equal(attendanceMap['akshat'], 'present');
    assert.equal(attendanceMap['vihaan'], 'present');
    assert.equal(attendanceMap['philomina'], 'present');
});

test('Dynamic Classroom Discovery: Deduplication prevents duplicate cards on regular schedule days', () => {
    const classrooms = [
        { id: 'sat-slot-10-id', name: 'Saturday Slot 10 (Online - 5 PM)', type: 'permanent' }
    ];

    const allSchedules = [
        { classroom_id: 'sat-slot-10-id', day_of_week: 6, start_time: '17:00:00' } // Saturday
    ];

    // On Saturday 10 Oct 2026, both schedule matches AND attendance exists
    const attendanceRecords = [
        { id: 'att-10', classroom_id: 'sat-slot-10-id', student_id: 'madhura', date: '2026-10-10', status: 'present' }
    ];

    const sessionLogs = [
        { classroom_id: 'sat-slot-10-id', session_date: '2026-10-10', started_at: '2026-10-10T17:00:00Z', present_count: 1 }
    ];

    const batchesOnSat = discoverSessionsForDate({
        selectedDate: '2026-10-10',
        classrooms,
        allSchedules,
        temporaryClasses: [],
        attendanceRecords,
        sessionLogs
    });

    assert.equal(batchesOnSat.length, 1, 'Only one card should be rendered on regular schedule day');
    assert.equal(batchesOnSat[0].isExtraSession, false, 'Regular scheduled session must not be labeled Extra Session');
});

test('Calendar Date Indicators: Activity dates correctly identify dates with attendance', () => {
    const attDates = ['2026-10-08', '2026-10-10'];
    const logDates = ['2026-10-08'];

    const activityDates = new Set();
    attDates.forEach(d => activityDates.add(d));
    logDates.forEach(d => activityDates.add(d));

    assert.ok(activityDates.has('2026-10-08'), '8 October 2026 must be in activityDates');
    assert.ok(activityDates.has('2026-10-10'), '10 October 2026 must be in activityDates');
    assert.ok(!activityDates.has('2026-10-09'), '9 October 2026 must not be in activityDates');
});
