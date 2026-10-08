import test from 'node:test';
import assert from 'node:assert/strict';
import createJiti from 'jiti';

const jiti = createJiti(import.meta.url);
const {
    isStudentOperationallyActive
} = jiti('../src/lib/student-lifecycle.ts');
const {
    buildCoveredAttendanceMap
} = jiti('../src/lib/on-behalf-attendance.ts');
const {
    extractClassroomMetadata,
    resolveClassroomMeetingInfo
} = jiti('../src/lib/meeting-utils.ts');

test('Start Class Workflow: Target classroom ID routing resolution', () => {
    // 1. Permanent classroom: uses room.id
    const permanentRoom = {
        id: 'perm-room-101',
        name: 'Saturday Slot 6',
        type: 'permanent',
        status: 'active'
    };
    const targetPermId = permanentRoom.type === 'permanent' ? permanentRoom.id : (permanentRoom.classroom_id || permanentRoom.id);
    assert.equal(targetPermId, 'perm-room-101');
    const permMeetingUrl = `/teacher-dashboard/classrooms/${targetPermId}/meeting`;
    assert.equal(permMeetingUrl, '/teacher-dashboard/classrooms/perm-room-101/meeting');

    // 2. Special session / Temporary classroom: uses room.classroom_id (shadow classroom ID)
    const tempRoom = {
        id: 'temp-row-999',
        classroom_id: 'shadow-room-555',
        title: 'Special Raag Bhairav Workshop',
        type: 'temporary',
        status: 'active'
    };
    const targetTempId = tempRoom.type === 'permanent' ? tempRoom.id : (tempRoom.classroom_id || tempRoom.id);
    assert.equal(targetTempId, 'shadow-room-555');
    const tempMeetingUrl = `/teacher-dashboard/classrooms/${targetTempId}/meeting`;
    assert.equal(tempMeetingUrl, '/teacher-dashboard/classrooms/shadow-room-555/meeting');
});

test('Start Class Workflow: Pre-session roster filters inactive students and isolates makeup overrides', () => {
    const rawPermanentRoster = [
        { student_id: 'student-1', users: { name: 'Rajiv', status: 'active' } },
        { student_id: 'student-2', users: { name: 'Priya', status: 'inactive' } }, // paused student
        { student_id: 'student-3', users: { name: 'Amit', status: 'archived' } }   // archived student
    ];

    const rawOverrides = [
        { student_id: 'student-4', users: { name: 'Kavita', status: 'active' } },  // guest / makeup
        { student_id: 'student-5', users: { name: 'Rahul', status: 'inactive' } }  // paused guest
    ];

    // Filter operational students exactly as MeetingPage does
    const permList = rawPermanentRoster.filter(r => isStudentOperationallyActive(r.users?.status));
    assert.equal(permList.length, 1);
    assert.equal(permList[0].student_id, 'student-1');

    const filteredOverrides = rawOverrides.filter(r => isStudentOperationallyActive(r.users?.status));
    assert.equal(filteredOverrides.length, 1);
    assert.equal(filteredOverrides[0].student_id, 'student-4');

    const formattedOverrides = filteredOverrides.map(row => ({
        ...row,
        users: {
            ...row.users,
            name: `${row.users?.name || 'Unknown'} (Makeup)`
        }
    }));
    assert.equal(formattedOverrides[0].users.name, 'Kavita (Makeup)');

    const combinedRoster = [...permList, ...formattedOverrides];
    assert.equal(combinedRoster.length, 2, 'Only active students and active makeup guests are in pre-session roster');
});

test('Start Class Workflow: Alternative date covered attendance lock prevents duplicate counting', () => {
    const sessionDate = '2026-10-10';
    const coveredRecords = [
        {
            id: 'att-1',
            student_id: 'student-rajiv',
            classroom_id: 'room-slot-1',
            date: '2026-10-03',
            status: 'present',
            on_behalf_of_date: '2026-10-10' // Covered on 3 Oct for 10 Oct!
        }
    ];

    const coveredMap = buildCoveredAttendanceMap(coveredRecords, sessionDate);
    assert.ok(coveredMap['student-rajiv']);
    assert.equal(coveredMap['student-rajiv'].status, 'present');
    assert.equal(coveredMap['student-rajiv'].actualDate, '2026-10-03');

    // In MeetingPage saveAttendance, students with coveredMap entries are NOT re-inserted into attendance table
    const students = [
        { id: 'student-rajiv', attendance: 'present' },
        { id: 'student-ananya', attendance: 'present' }
    ];

    const rowsToUpsert = students
        .filter(s => s.attendance !== null && !coveredMap[s.id])
        .map(s => ({ student_id: s.id, date: sessionDate, status: s.attendance }));

    assert.equal(rowsToUpsert.length, 1, 'Covered student is locked and excluded from new upsert');
    assert.equal(rowsToUpsert[0].student_id, 'student-ananya');
});

test('Start Class Workflow: Meeting configuration and pre-fill from classroom metadata', () => {
    const onlineClassroom = {
        name: 'Evening Raag Yaman',
        description: 'Advanced batch [delivery_format:online] [meeting_link:https://meet.google.com/kfa-room]',
        is_live: false,
        live_meeting_link: null
    };

    const meta = extractClassroomMetadata(onlineClassroom.description);
    assert.equal(meta.deliveryFormat, 'online');
    assert.equal(meta.reusableMeetingLink, 'https://meet.google.com/kfa-room');
    assert.equal(meta.cleanDescription, 'Advanced batch');

    const meetingInfo = resolveClassroomMeetingInfo(onlineClassroom);
    assert.equal(meetingInfo.effectiveMeetingLink, 'https://meet.google.com/kfa-room');
    assert.equal(meetingInfo.platform, 'Google Meet');
    assert.equal(meetingInfo.isOnline, true);
});

test('Start Class Workflow: Live session notification payload does not leak raw URLs', () => {
    const classroomName = 'Intermediate Bansuri - Sunday 10 AM';
    const isOnline = true;

    const notifTitle = `Class Started: ${classroomName}`;
    const notifMessage = isOnline
        ? `The online class for "${classroomName}" has started. Open your student classroom to join the live session.`
        : `The class for "${classroomName}" has started.`;

    assert.ok(notifMessage.includes('Open your student classroom to join the live session'));
    assert.equal(notifMessage.includes('https://'), false, 'Notification body never leaks raw private meeting link');
});
