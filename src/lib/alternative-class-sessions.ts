/**
 * Alternative Class (BR-22) ⇄ Special Session linkage.
 *
 * Every scheduled alternative (replacement) class for a declared holiday is materialised as a
 * canonical Special Session (shadow `classrooms` row of type 'temporary' + `temporary_classes`
 * + `session_student_overrides` roster), so it is visible in the Classrooms section and is the
 * room in which attendance is recorded on behalf of the holiday date.
 *
 * Linkage is persisted with description tags understood by the attendance page:
 *   [OnBehalfOfHoliday:YYYY-MM-DD][HolidayClassroom:<uuid>][HolidayId:<uuid>]
 */
import { createSpecialSession, cancelSpecialSession } from './special-sessions';
import { extractClassroomMetadata } from './meeting-utils';
import { isStudentOperationallyActive } from './student-lifecycle';

export const ALTERNATIVE_CLASS_PREFIX = 'Alternative class for';

export function buildAlternativeClassName(classroomName?: string | null): string {
    return `${ALTERNATIVE_CLASS_PREFIX} ${(classroomName || 'Classroom').trim()}`;
}

export function buildHolidayLinkTags(holiday: { id: string; classroom_id: string; holiday_date: string }): string {
    const holDate = String(holiday.holiday_date).split('T')[0];
    return `[OnBehalfOfHoliday:${holDate}][HolidayClassroom:${holiday.classroom_id}][HolidayId:${holiday.id}]`;
}

/** Returns active (non-cancelled) Special Sessions linked to the given holiday. */
async function findLinkedSessions(supabaseClient: any, holidayId: string) {
    const { data: rooms, error } = await supabaseClient
        .from('classrooms')
        .select('id, status')
        .eq('type', 'temporary')
        .ilike('description', `%[HolidayId:${holidayId}]%`);
    if (error) throw error;

    const roomIds = (rooms || [])
        .filter((r: any) => (r.status || 'active').toLowerCase() !== 'archived')
        .map((r: any) => r.id);
    if (roomIds.length === 0) return [];

    const { data: temps, error: tErr } = await supabaseClient
        .from('temporary_classes')
        .select('id, classroom_id, class_date, start_time, end_time, lifecycle_status')
        .in('classroom_id', roomIds);
    if (tErr) throw tErr;

    return (temps || []).filter((t: any) => (t.lifecycle_status || 'scheduled').toLowerCase() !== 'cancelled');
}

const toHHMM = (t?: string | null) => (t ? String(t).slice(0, 5) : '');

/**
 * Idempotently creates (or re-dates) the Special Session representing a holiday's scheduled
 * alternative class. No-op if the holiday is not active/scheduled.
 */
export async function ensureAlternativeSpecialSession(supabaseClient: any, holidayId: string) {
    if (!holidayId) return null;

    const { data: holiday, error: holErr } = await supabaseClient
        .from('classroom_holidays')
        .select('*')
        .eq('id', holidayId)
        .maybeSingle();
    if (holErr) throw holErr;
    if (!holiday || holiday.status !== 'active') return null;
    if (!['alternative_scheduled', 'with_alternative'].includes(holiday.holiday_type) || !holiday.alternative_date) return null;

    const altDate = String(holiday.alternative_date).split('T')[0];

    const { data: room, error: roomErr } = await supabaseClient
        .from('classrooms')
        .select('id, name, teacher_id, description')
        .eq('id', holiday.classroom_id)
        .maybeSingle();
    if (roomErr) throw roomErr;
    if (!room) return null;

    // Resolve timing: explicit alternative time → regular schedule of the holiday weekday → any schedule
    let startTime = toHHMM(holiday.alternative_start_time);
    let endTime = toHHMM(holiday.alternative_end_time);
    if (!startTime || !endTime) {
        const [y, m, d] = String(holiday.holiday_date).split('T')[0].split('-').map(Number);
        const dow = new Date(y, m - 1, d).getDay();
        const { data: scheds } = await supabaseClient
            .from('batch_schedules')
            .select('day_of_week, start_time, end_time')
            .eq('classroom_id', room.id);
        const sched = (scheds || []).find((s: any) => s.day_of_week === dow) || (scheds || [])[0];
        startTime = startTime || toHHMM(sched?.start_time) || '10:00';
        endTime = endTime || toHHMM(sched?.end_time) || '';
        if (!endTime || endTime <= startTime) {
            const [h, min] = startTime.split(':').map(Number);
            endTime = `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        }
    }

    // Already linked → keep date/time in sync (reschedule case)
    const existing = await findLinkedSessions(supabaseClient, holiday.id);
    if (existing.length > 0) {
        const tc = existing[0];
        if (tc.class_date !== altDate || toHHMM(tc.start_time) !== startTime || toHHMM(tc.end_time) !== endTime) {
            const { error: upErr } = await supabaseClient
                .from('temporary_classes')
                .update({ class_date: altDate, start_time: startTime, end_time: endTime })
                .eq('id', tc.id);
            if (upErr) throw upErr;
            if (tc.class_date !== altDate) {
                await supabaseClient
                    .from('session_student_overrides')
                    .update({ override_date: altDate })
                    .eq('target_classroom_id', tc.classroom_id)
                    .eq('override_date', tc.class_date);
            }
        }
        return tc;
    }

    // Roster: operationally active permanent students of the holiday classroom
    const { data: roster } = await supabaseClient
        .from('classroom_students')
        .select('student_id, users!student_id(status)')
        .eq('classroom_id', room.id);
    const studentIds: string[] = (roster || [])
        .filter((r: any) => isStudentOperationallyActive(r.users?.status))
        .map((r: any) => r.student_id);

    const meta = extractClassroomMetadata(room.description || '');
    const holDate = String(holiday.holiday_date).split('T')[0];

    const result = await createSpecialSession(supabaseClient, {
        name: buildAlternativeClassName(room.name),
        description: `Alternative class on behalf of holiday ${holDate}. ${buildHolidayLinkTags(holiday)}`,
        teacherId: room.teacher_id,
        classDate: altDate,
        startTime,
        endTime,
        deliveryFormat: meta.deliveryFormat,
        meetingLink: meta.reusableMeetingLink || undefined,
        purpose: 'other',
        creditTreatment: 'consume_credit',
        selectedStudents: studentIds
    });
    return result?.tempClass || null;
}

/** Cancels (soft) any Special Session linked to the holiday's alternative class. */
export async function cancelAlternativeSpecialSession(supabaseClient: any, holidayId: string) {
    if (!holidayId) return;
    const linked = await findLinkedSessions(supabaseClient, holidayId);
    for (const tc of linked) {
        await cancelSpecialSession(supabaseClient, tc.classroom_id);
    }
}

/** Ensures alternative Special Sessions for all active scheduled holidays matching a date (bulk declaration). */
export async function ensureAlternativeSessionsForHolidayDate(
    supabaseClient: any,
    holidayDate: string,
    classroomIds?: string[]
) {
    let q = supabaseClient
        .from('classroom_holidays')
        .select('id')
        .eq('holiday_date', holidayDate)
        .eq('status', 'active')
        .in('holiday_type', ['alternative_scheduled', 'with_alternative']);
    if (classroomIds && classroomIds.length > 0) q = q.in('classroom_id', classroomIds);
    const { data, error } = await q;
    if (error) throw error;
    for (const h of data || []) {
        await ensureAlternativeSpecialSession(supabaseClient, h.id);
    }
}
