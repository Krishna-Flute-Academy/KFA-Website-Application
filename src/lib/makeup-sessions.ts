/**
 * Authoritative Makeup Session domain service for Krishna Flute Academy.
 *
 * Supports two distinct makeup execution pathways:
 * 1. JOIN AN EXISTING CLASS:
 *    Temporary single-date attendance in an existing permanent classroom.
 *    - Validates target classroom is permanent and active.
 *    - Validates target date matches the permanent classroom's scheduled day of week.
 *    - Inserts into `session_student_overrides` with `credit_treatment: 'makeup'` and `missed_session_date`.
 *    - NEVER inserts into `classroom_students` (no permanent membership).
 *    - NEVER gives permanent classroom chat permissions.
 *
 * 2. CREATE A SPECIAL SESSION:
 *    One-off dedicated Special Session (via canonical `createSpecialSession`).
 *    - Purpose: 'makeup', Credit Treatment: 'makeup'.
 *    - Links student's missed class date.
 */

import { createSpecialSession } from './special-sessions';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface PermanentClassroomSchedule {
    id: string;
    day_of_week: number; // 0=Sun, 1=Mon, ..., 6=Sat
    start_time: string;
    end_time: string;
    dayName: string;
    timings: string;
}

export interface PermanentClassroomOption {
    id: string;
    name: string;
    teacherId: string;
    teacherName: string;
    teacherProfilePic?: string | null;
    schedules: PermanentClassroomSchedule[];
    daysOfWeek: number[];
    scheduleSummary: string;
    enrolledCount: number;
}

export interface ScheduleMakeupInExistingClassInput {
    studentId: string;
    targetClassroomId: string;
    makeupDate: string; // YYYY-MM-DD
    missedSessionDate: string; // YYYY-MM-DD
    notes?: string;
    teacherId?: string;
    studentName?: string;
}

export interface ScheduleMakeupAsSpecialSessionInput {
    studentId: string;
    missedSessionDate: string; // YYYY-MM-DD
    sessionDate: string; // YYYY-MM-DD
    startTime: string; // HH:mm
    endTime: string; // HH:mm
    teacherId: string;
    title?: string;
    notes?: string;
    deliveryFormat?: 'online' | 'offline';
}

export interface RescheduleMakeupInput {
    overrideId: string;
    newTargetClassroomId: string;
    newMakeupDate: string; // YYYY-MM-DD
    missedSessionDate: string; // YYYY-MM-DD
    notes?: string;
}

export function formatTime12hr(time24: string): string {
    if (!time24) return '';
    const [h, m] = time24.split(':');
    let hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${m.padStart(2, '0')} ${ampm}`;
}

export function getDayOfWeekFromDateStr(dateStr: string): number {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).getDay();
}

export function getDayName(dayOfWeek: number): string {
    return DAY_NAMES[dayOfWeek] || 'Unknown';
}

export function isDateMatchingSchedules(dateStr: string, daysOfWeek: number[]): boolean {
    if (!daysOfWeek || daysOfWeek.length === 0) return true; // fallback if no schedule recorded
    const day = getDayOfWeekFromDateStr(dateStr);
    return daysOfWeek.includes(day);
}

/**
 * Returns the next N upcoming occurrences of a classroom schedule starting from a base date.
 */
export function getNextScheduleOccurrences(daysOfWeek: number[], fromDateStr: string, count = 5): Array<{ date: string; dayName: string; formatted: string }> {
    if (!daysOfWeek || daysOfWeek.length === 0) return [];
    const occurrences: Array<{ date: string; dayName: string; formatted: string }> = [];
    const [y, m, d] = fromDateStr.split('-').map(Number);
    const current = new Date(y, m - 1, d);

    for (let i = 0; occurrences.length < count && i < 60; i++) {
        const testDay = current.getDay();
        if (daysOfWeek.includes(testDay)) {
            const yr = current.getFullYear();
            const mo = String(current.getMonth() + 1).padStart(2, '0');
            const da = String(current.getDate()).padStart(2, '0');
            const dateStr = `${yr}-${mo}-${da}`;
            const formatted = current.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
            occurrences.push({
                date: dateStr,
                dayName: DAY_NAMES[testDay],
                formatted
            });
        }
        current.setDate(current.getDate() + 1);
    }
    return occurrences;
}

/**
 * Fetches all active permanent classrooms with their schedules and current roster count.
 */
export async function fetchAvailablePermanentClassrooms(
    supabaseClient: any,
    currentTeacherId?: string,
    isAdmin = false
): Promise<PermanentClassroomOption[]> {
    let query = supabaseClient
        .from('classrooms')
        .select(`
            id,
            name,
            type,
            status,
            teacher_id,
            users!classrooms_teacher_id_fkey(id, name, email, role, profile_pic_url),
            batch_schedules(id, day_of_week, start_time, end_time),
            classroom_students(id)
        `)
        .or('type.eq.permanent,type.is.null')
        .eq('status', 'active');

    if (!isAdmin && currentTeacherId) {
        query = query.eq('teacher_id', currentTeacherId);
    }

    const { data, error } = await query.order('name', { ascending: true });
    if (error) {
        console.error('[MakeupSessions] Error fetching permanent classrooms:', error);
        throw error;
    }

    return (data || []).map((row: any) => {
        const schedules: PermanentClassroomSchedule[] = (row.batch_schedules || []).map((s: any) => ({
            id: s.id,
            day_of_week: s.day_of_week,
            start_time: s.start_time,
            end_time: s.end_time,
            dayName: DAY_NAMES[s.day_of_week] || 'Day',
            timings: `${formatTime12hr(s.start_time)} - ${formatTime12hr(s.end_time)}`
        })).sort((a: PermanentClassroomSchedule, b: PermanentClassroomSchedule) => a.day_of_week - b.day_of_week);

        const daysOfWeek = Array.from(new Set(schedules.map(s => s.day_of_week)));
        const scheduleSummary = schedules.length > 0
            ? schedules.map(s => `${s.dayName.slice(0, 3)} ${s.timings}`).join(', ')
            : 'No scheduled timings';

        const teacherUser = Array.isArray(row.users) ? row.users[0] : row.users;

        return {
            id: row.id,
            name: row.name || 'Permanent Classroom',
            teacherId: row.teacher_id,
            teacherName: teacherUser?.name || 'Academy Instructor',
            teacherProfilePic: teacherUser?.profile_pic_url || null,
            schedules,
            daysOfWeek,
            scheduleSummary,
            enrolledCount: (row.classroom_students || []).length
        };
    });
}

/**
 * PATHWAY 1: Schedule Makeup in an Existing Permanent Classroom
 */
export async function scheduleMakeupInExistingClass(
    supabaseClient: any,
    input: ScheduleMakeupInExistingClassInput
): Promise<{ success: boolean; override: any }> {
    const { studentId, targetClassroomId, makeupDate, missedSessionDate, notes, studentName } = input;

    if (!studentId) throw new Error('Student ID is required.');
    if (!targetClassroomId) throw new Error('Target permanent classroom is required.');
    if (!makeupDate) throw new Error('Makeup class date is required.');
    if (!missedSessionDate) throw new Error('Original missed session date is required.');

    // 1. Verify target classroom is permanent
    const { data: classroom, error: classError } = await supabaseClient
        .from('classrooms')
        .select('id, name, type, status, teacher_id, batch_schedules(day_of_week)')
        .eq('id', targetClassroomId)
        .single();

    if (classError || !classroom) {
        throw new Error('Target classroom not found.');
    }

    if (classroom.type && classroom.type !== 'permanent') {
        throw new Error('Target classroom must be a permanent classroom. For one-off sessions, choose "Create a Special Session".');
    }

    // 2. Validate day of week matching
    const daysOfWeek: number[] = (classroom.batch_schedules || []).map((s: any) => s.day_of_week);
    if (daysOfWeek.length > 0) {
        const makeupDay = getDayOfWeekFromDateStr(makeupDate);
        if (!daysOfWeek.includes(makeupDay)) {
            const expectedDays = daysOfWeek.map(d => DAY_NAMES[d]).join(' or ');
            const actualDay = DAY_NAMES[makeupDay];
            throw new Error(`Invalid date! ${classroom.name} only runs on ${expectedDays} (selected date is a ${actualDay}).`);
        }
    }

    // 3. Construct canonical reason tag
    const reasonTag = `[MissedDate:${missedSessionDate}]`;
    const cleanReason = `${reasonTag} ${notes || 'Temporary makeup attendance'}`.trim();

    // 4. Insert into session_student_overrides
    const { data: override, error: insertError } = await supabaseClient
        .from('session_student_overrides')
        .insert([{
            student_id: studentId,
            target_classroom_id: targetClassroomId,
            override_date: makeupDate,
            missed_session_date: missedSessionDate,
            credit_treatment: 'makeup',
            reason: cleanReason
        }])
        .select(`
            id,
            student_id,
            target_classroom_id,
            override_date,
            missed_session_date,
            credit_treatment,
            reason,
            users!student_id(name, profile_pic_url, level)
        `)
        .single();

    if (insertError) {
        if (insertError.code === '23505' || insertError.message?.includes('unique constraint')) {
            throw new Error(`This student is already scheduled to attend ${classroom.name} on ${makeupDate}. Please choose a different date or classroom.`);
        }
        throw insertError;
    }

    // 5. Send notification to student
    try {
        await supabaseClient.from('notifications').insert([{
            user_id: studentId,
            type: 'classroom',
            title: 'Makeup Class Scheduled',
            message: `You have been scheduled for a makeup class in "${classroom.name}" on ${makeupDate} (replacing missed class on ${missedSessionDate}).`,
            is_read: false
        }]);
    } catch (notifErr) {
        console.warn('[MakeupSessions] Could not send student notification:', notifErr);
    }

    return { success: true, override };
}

/**
 * PATHWAY 2: Schedule Makeup by Creating a Dedicated Special Session
 */
export async function scheduleMakeupAsSpecialSession(
    supabaseClient: any,
    input: ScheduleMakeupAsSpecialSessionInput
): Promise<{ success: boolean; classroomId: string; specialSessionId: string }> {
    const {
        studentId,
        missedSessionDate,
        sessionDate,
        startTime,
        endTime,
        teacherId,
        title,
        notes = '',
        deliveryFormat = 'online'
    } = input;

    if (!studentId) throw new Error('Student ID is required.');
    if (!missedSessionDate) throw new Error('Missed session date is required.');
    if (!sessionDate) throw new Error('Session date is required.');
    if (!startTime || !endTime) throw new Error('Start and end times are required.');
    if (!teacherId) throw new Error('Teacher is required.');

    const sessionName = title?.trim() || `Makeup Session (${missedSessionDate})`;

    const result = await createSpecialSession(supabaseClient, {
        name: sessionName,
        description: notes,
        teacherId,
        classDate: sessionDate,
        startTime,
        endTime,
        deliveryFormat,
        purpose: 'makeup',
        creditTreatment: 'makeup',
        selectedStudents: [studentId],
        studentMissedDates: {
            [studentId]: missedSessionDate
        }
    });

    return {
        success: true,
        classroomId: result.classroom?.id,
        specialSessionId: result.tempClass?.id
    };
}

/**
 * Reschedule an existing makeup allocation
 */
export async function rescheduleMakeup(
    supabaseClient: any,
    input: RescheduleMakeupInput
): Promise<{ success: boolean; override: any }> {
    const { overrideId, newTargetClassroomId, newMakeupDate, missedSessionDate, notes } = input;

    if (!overrideId) throw new Error('Override ID is required.');
    if (!newTargetClassroomId) throw new Error('Target classroom is required.');
    if (!newMakeupDate) throw new Error('Makeup date is required.');

    // 1. Verify classroom and day of week
    const { data: classroom, error: classError } = await supabaseClient
        .from('classrooms')
        .select('id, name, type, batch_schedules(day_of_week)')
        .eq('id', newTargetClassroomId)
        .single();

    if (classError || !classroom) throw new Error('Classroom not found.');

    if (classroom.type === 'permanent' || !classroom.type) {
        const daysOfWeek: number[] = (classroom.batch_schedules || []).map((s: any) => s.day_of_week);
        if (daysOfWeek.length > 0) {
            const makeupDay = getDayOfWeekFromDateStr(newMakeupDate);
            if (!daysOfWeek.includes(makeupDay)) {
                const expectedDays = daysOfWeek.map(d => DAY_NAMES[d]).join(' or ');
                const actualDay = DAY_NAMES[makeupDay];
                throw new Error(`Invalid date! ${classroom.name} runs on ${expectedDays} (selected date is ${actualDay}).`);
            }
        }
    }

    const reasonTag = missedSessionDate ? `[MissedDate:${missedSessionDate}]` : '';
    const cleanReason = `${reasonTag} ${notes || 'Rescheduled makeup session'}`.trim();

    const { data: updated, error: updateError } = await supabaseClient
        .from('session_student_overrides')
        .update({
            target_classroom_id: newTargetClassroomId,
            override_date: newMakeupDate,
            missed_session_date: missedSessionDate || null,
            reason: cleanReason
        })
        .eq('id', overrideId)
        .select(`
            id,
            student_id,
            target_classroom_id,
            override_date,
            missed_session_date,
            credit_treatment,
            reason,
            users!student_id(name, profile_pic_url, level)
        `)
        .single();

    if (updateError) throw updateError;

    return { success: true, override: updated };
}

/**
 * Cancel a makeup allocation
 */
export async function cancelMakeup(
    supabaseClient: any,
    overrideId: string
): Promise<{ success: boolean }> {
    if (!overrideId) throw new Error('Override ID is required.');

    const { error } = await supabaseClient
        .from('session_student_overrides')
        .delete()
        .eq('id', overrideId);

    if (error) throw error;
    return { success: true };
}
