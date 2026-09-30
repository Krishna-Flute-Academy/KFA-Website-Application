/**
 * Attendance Pending (Missed Classes) Resolution Utility
 * 
 * Derives un-marked / forgotten attendance outcomes for completed past classes
 * based on canonical historical rosters, session end times, and on-behalf-of attendance.
 */

import { isStudentOperationallyActive, isStudentEnrolledOnDate } from './student-lifecycle';
import { parseDayAndStartFromClassroom } from './classroomSort';

export function formatTime12hr(time24: string): string {
    if (!time24) return '';
    const parts = time24.split(':');
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1] || '00';
    if (isNaN(hours)) return time24;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${hours}:${minutes} ${ampm}`;
}

export interface PendingStudentItem {
    studentId: string;
    studentName: string;
    profilePicUrl?: string | null;
    isMakeup?: boolean;
    isGuest?: boolean;
    missedDate?: string | null;
}

export interface PendingClassSession {
    sessionKey: string; // `${classroomId}_${dateStr}`
    classroomId: string;
    classroomName: string;
    date: string; // 'YYYY-MM-DD'
    startTime: string; // '12:00:00'
    endTime: string; // '13:00:00'
    timeFormatted: string; // '12:00 PM – 1:00 PM'
    isTemporary: boolean;
    pendingStudents: PendingStudentItem[];
    markedCount: number;
    totalExpectedCount: number;
}

export interface PendingSummary {
    totalPendingStudents: number;
    affectedClassesCount: number;
    oldestPendingDate: string | null;
}

export type PendingFilterType = 'all' | 'unmarked' | 'partial';

/**
 * Checks whether a session has completely ended based on date and end time.
 */
export function isSessionEnded(
    dateStr: string,
    endTimeStr: string,
    referenceNow: Date = new Date()
): boolean {
    const todayStr = referenceNow.toISOString().split('T')[0];
    if (dateStr < todayStr) return true;
    if (dateStr > todayStr) return false;

    // For today, compare current time against session end time
    const safeEndTime = endTimeStr.length === 5 ? `${endTimeStr}:00` : endTimeStr;
    const [endH, endM] = safeEndTime.split(':').map(Number);
    const sessionEnd = new Date(referenceNow);
    sessionEnd.setHours(endH, endM, 0, 0);

    return referenceNow.getTime() >= sessionEnd.getTime();
}

/**
 * Derives pending attendance sessions across a date range.
 */
export function derivePendingAttendanceSessions(params: {
    fromDate: string;
    toDate: string;
    classrooms: any[];
    batchSchedules: any[];
    temporaryClasses: any[];
    permanentStudents: any[]; // classroom_students rows with joined_at & users
    sessionOverrides: any[];  // session_student_overrides rows
    attendanceRows: any[];    // physical attendance rows in range
    coveredAttendanceRows: any[]; // on_behalf_of_date rows mapped to range
    referenceNow?: Date;
}): PendingClassSession[] {
    const {
        fromDate,
        toDate,
        classrooms,
        batchSchedules,
        temporaryClasses,
        permanentStudents,
        sessionOverrides,
        attendanceRows,
        coveredAttendanceRows,
        referenceNow = new Date()
    } = params;

    const todayStr = referenceNow.toISOString().split('T')[0];
    const effectiveToDate = toDate > todayStr ? todayStr : toDate;
    if (fromDate > effectiveToDate) {
        return [];
    }

    // 1. Build lookup maps for physical and covered attendance
    // Map: `${student_id}_${classroom_id}_${date}` -> status
    const physicalAttMap = new Map<string, string>();
    (attendanceRows || []).forEach(r => {
        if (r.student_id && r.classroom_id && r.date && r.status) {
            const cleanDate = r.date.split('T')[0];
            physicalAttMap.set(`${r.student_id}_${r.classroom_id}_${cleanDate}`, r.status.toLowerCase());
        }
    });

    // Map: `${student_id}_${on_behalf_of_date}` -> status (student was covered on alternative date)
    const coveredAttMap = new Map<string, string>();
    (coveredAttendanceRows || []).forEach(r => {
        if (r.student_id && r.on_behalf_of_date && r.status) {
            const cleanTargetDate = r.on_behalf_of_date.split('T')[0];
            const cleanActualDate = r.date ? r.date.split('T')[0] : '';
            if (cleanTargetDate !== cleanActualDate) {
                coveredAttMap.set(`${r.student_id}_${cleanTargetDate}`, r.status.toLowerCase());
            }
        }
    });

    // 2. Index permanent students by classroom_id
    const permByClass = new Map<string, any[]>();
    (permanentStudents || []).forEach(s => {
        const list = permByClass.get(s.classroom_id) || [];
        list.push(s);
        permByClass.set(s.classroom_id, list);
    });

    // 3. Index overrides by `${target_classroom_id}_${override_date}`
    const overridesByClassDate = new Map<string, any[]>();
    (sessionOverrides || []).forEach(o => {
        if (o.target_classroom_id && o.override_date) {
            const cleanDate = o.override_date.split('T')[0];
            const key = `${o.target_classroom_id}_${cleanDate}`;
            const list = overridesByClassDate.get(key) || [];
            list.push(o);
            overridesByClassDate.set(key, list);
        }
    });

    // 4. Generate all calendar dates in range [fromDate, effectiveToDate]
    const dateList: string[] = [];
    let cur = new Date(fromDate + 'T00:00:00');
    const end = new Date(effectiveToDate + 'T00:00:00');
    while (cur <= end) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        dateList.push(`${y}-${m}-${d}`);
        cur.setDate(cur.getDate() + 1);
    }

    const pendingSessions: PendingClassSession[] = [];

    // 5. Evaluate each date in the range
    for (const dateStr of dateList) {
        const dateObj = new Date(dateStr + 'T00:00:00');
        const dayOfWeek = dateObj.getDay();

        // 5a. Permanent classrooms scheduled for this dayOfWeek
        for (const room of classrooms) {
            if (room.status === 'archived' || room.lifecycle_status === 'cancelled') {
                continue;
            }

            const roomSchedules = (batchSchedules || []).filter(
                s => s.classroom_id === room.id && s.day_of_week === dayOfWeek
            );

            let schedStartTime = '';
            let schedEndTime = '';

            if (roomSchedules.length > 0) {
                schedStartTime = roomSchedules[0].start_time || '00:00:00';
                schedEndTime = roomSchedules[0].end_time || '01:00:00';
            } else {
                // Fallback to title parsing
                const parsed = parseDayAndStartFromClassroom(room);
                if (parsed.dayOfWeek === dayOfWeek) {
                    schedStartTime = parsed.startTimeMinutes < 24 * 60
                        ? `${String(Math.floor(parsed.startTimeMinutes / 60)).padStart(2, '0')}:${String(parsed.startTimeMinutes % 60).padStart(2, '0')}:00`
                        : '00:00:00';
                    const endMin = (parsed.startTimeMinutes + 60) % (24 * 60);
                    schedEndTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}:00`;
                }
            }

            if (!schedStartTime) {
                // Classroom is not scheduled on this day
                continue;
            }

            // Check if class session has completed
            if (!isSessionEnded(dateStr, schedEndTime, referenceNow)) {
                continue;
            }

            // Resolve historical expected roster for this permanent class
            const expectedStudents: {
                studentId: string;
                name: string;
                profilePicUrl?: string | null;
                isMakeup?: boolean;
                isGuest?: boolean;
                missedDate?: string | null;
            }[] = [];

            const enrolledRows = permByClass.get(room.id) || [];
            enrolledRows.forEach(row => {
                const sId = row.student_id;
                const hasAtt = physicalAttMap.has(`${sId}_${room.id}_${dateStr}`) || coveredAttMap.has(`${sId}_${dateStr}`);
                if (isStudentOperationallyActive(row.users?.status) && isStudentEnrolledOnDate(row, dateStr, hasAtt)) {
                    expectedStudents.push({
                        studentId: sId,
                        name: row.users?.name || 'Unknown Student',
                        profilePicUrl: row.users?.profile_pic_url
                    });
                }
            });

            // Add makeup / guest overrides
            const overrides = overridesByClassDate.get(`${room.id}_${dateStr}`) || [];
            overrides.forEach(o => {
                if (isStudentOperationallyActive(o.users?.status)) {
                    expectedStudents.push({
                        studentId: o.student_id,
                        name: o.users?.name || 'Unknown Student',
                        profilePicUrl: o.users?.profile_pic_url,
                        isMakeup: true,
                        isGuest: true,
                        missedDate: o.missed_session_date
                    });
                }
            });

            // Determine who is marked vs pending
            let markedCount = 0;
            const pendingList: PendingStudentItem[] = [];

            for (const st of expectedStudents) {
                const physicalStatus = physicalAttMap.get(`${st.studentId}_${room.id}_${dateStr}`);
                const coveredStatus = coveredAttMap.get(`${st.studentId}_${dateStr}`);

                if (physicalStatus || coveredStatus) {
                    markedCount++;
                } else {
                    pendingList.push({
                        studentId: st.studentId,
                        studentName: st.name,
                        profilePicUrl: st.profilePicUrl,
                        isMakeup: st.isMakeup,
                        isGuest: st.isGuest,
                        missedDate: st.missedDate
                    });
                }
            }

            if (pendingList.length > 0) {
                pendingSessions.push({
                    sessionKey: `${room.id}_${dateStr}`,
                    classroomId: room.id,
                    classroomName: room.name || 'Classroom',
                    date: dateStr,
                    startTime: schedStartTime,
                    endTime: schedEndTime,
                    timeFormatted: `${formatTime12hr(schedStartTime.slice(0, 5))} – ${formatTime12hr(schedEndTime.slice(0, 5))}`,
                    isTemporary: false,
                    pendingStudents: pendingList,
                    markedCount,
                    totalExpectedCount: expectedStudents.length
                });
            }
        }

        // 5b. Temporary classes scheduled on this dateStr
        const tempClassesOnDate = (temporaryClasses || []).filter(
            tc => tc.class_date === dateStr && tc.lifecycle_status !== 'cancelled'
        );

        for (const tc of tempClassesOnDate) {
            const tcRoomId = tc.classroom_id || tc.id;
            const tcEndTime = tc.end_time || '01:00:00';
            const tcStartTime = tc.start_time || '00:00:00';

            if (!isSessionEnded(dateStr, tcEndTime, referenceNow)) {
                continue;
            }

            const expectedStudents: {
                studentId: string;
                name: string;
                profilePicUrl?: string | null;
            }[] = [];

            const overrides = overridesByClassDate.get(`${tcRoomId}_${dateStr}`) || [];
            overrides.forEach(o => {
                if (isStudentOperationallyActive(o.users?.status)) {
                    expectedStudents.push({
                        studentId: o.student_id,
                        name: o.users?.name || 'Unknown Student',
                        profilePicUrl: o.users?.profile_pic_url
                    });
                }
            });

            let markedCount = 0;
            const pendingList: PendingStudentItem[] = [];

            for (const st of expectedStudents) {
                const physicalStatus = physicalAttMap.get(`${st.studentId}_${tcRoomId}_${dateStr}`);
                const coveredStatus = coveredAttMap.get(`${st.studentId}_${dateStr}`);

                if (physicalStatus || coveredStatus) {
                    markedCount++;
                } else {
                    pendingList.push({
                        studentId: st.studentId,
                        studentName: st.name,
                        profilePicUrl: st.profilePicUrl
                    });
                }
            }

            if (pendingList.length > 0) {
                pendingSessions.push({
                    sessionKey: `${tcRoomId}_${dateStr}`,
                    classroomId: tcRoomId,
                    classroomName: tc.title || 'Special Session',
                    date: dateStr,
                    startTime: tcStartTime,
                    endTime: tcEndTime,
                    timeFormatted: `${formatTime12hr(tcStartTime.slice(0, 5))} – ${formatTime12hr(tcEndTime.slice(0, 5))}`,
                    isTemporary: true,
                    pendingStudents: pendingList,
                    markedCount,
                    totalExpectedCount: expectedStudents.length
                });
            }
        }
    }

    // Sort chronologically (oldest date first so the teacher tackles older backlog first)
    pendingSessions.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.startTime.localeCompare(b.startTime);
    });

    return pendingSessions;
}

/**
 * Calculates top summary stats for pending attendance.
 */
export function calculatePendingSummary(sessions: PendingClassSession[]): PendingSummary {
    let totalPendingStudents = 0;
    let oldestPendingDate: string | null = null;

    sessions.forEach(s => {
        totalPendingStudents += s.pendingStudents.length;
        if (!oldestPendingDate || s.date < oldestPendingDate) {
            oldestPendingDate = s.date;
        }
    });

    return {
        totalPendingStudents,
        affectedClassesCount: sessions.length,
        oldestPendingDate
    };
}

/**
 * Filters pending sessions by type and student name search query.
 */
export function filterPendingSessions(
    sessions: PendingClassSession[],
    filterType: PendingFilterType,
    searchQuery: string = ''
): PendingClassSession[] {
    const q = searchQuery.trim().toLowerCase();

    return sessions
        .map(session => {
            // Filter by type
            if (filterType === 'unmarked' && session.markedCount > 0) {
                return null;
            }
            if (filterType === 'partial' && session.markedCount === 0) {
                return null;
            }

            // Filter students by search query
            const matchingStudents = q
                ? session.pendingStudents.filter(st => st.studentName.toLowerCase().includes(q))
                : session.pendingStudents;

            if (matchingStudents.length === 0) {
                return null;
            }

            return {
                ...session,
                pendingStudents: matchingStudents
            };
        })
        .filter((s): s is PendingClassSession => s !== null);
}
