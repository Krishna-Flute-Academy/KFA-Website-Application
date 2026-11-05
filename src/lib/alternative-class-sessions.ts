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
 * alternative class.
 * (Option 1: Alternative classes map directly to the permanent classroom entity and do not create shadow special classes).
 */
export async function ensureAlternativeSpecialSession(supabaseClient: any, holidayId: string) {
    return null;
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
    return;
}
