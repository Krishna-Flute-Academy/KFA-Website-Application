/**
 * Helpers for resolving on-behalf-of attendance coverage and student-level locks.
 * 
 * Business Rule:
 * If an alternative class is taken on another date on behalf of a target scheduled date,
 * any student with qualifying attendance ('present' | 'late') in that alternative class
 * is locked (read-only) on the target scheduled date to prevent double attendance.
 */

export interface CoveredAttendanceRecord {
    attendanceId: string;
    studentId: string;
    classroomId: string;
    actualDate: string; // The physical date the class took place (e.g. '2026-08-29')
    targetDate: string; // The scheduled date covered (e.g. '2026-09-12')
    status: 'present' | 'late' | 'absent' | 'excused' | string;
}

export const QUALIFYING_COVERED_STATUSES = ['present', 'late', 'absent', 'excused'] as const;

/**
 * Checks whether an attendance record represents a qualifying alternative class
 * taken on behalf of scheduledDate, avoiding self-matching.
 */
export function isQualifyingAlternativeAttendance(
    record: { date: string; on_behalf_of_date?: string | null; status: string },
    scheduledDate: string
): boolean {
    if (!record || !record.on_behalf_of_date) return false;
    // Self-matching guard: alternative class must have taken place on a different physical date
    if (record.date === scheduledDate) return false;
    if (record.on_behalf_of_date !== scheduledDate) return false;
    return QUALIFYING_COVERED_STATUSES.includes(record.status.toLowerCase() as any);
}

/**
 * Builds a student-to-covered-record dictionary from raw attendance rows for a given scheduledDate.
 */
export function buildCoveredAttendanceMap(
    rows: any[],
    scheduledDate: string
): Record<string, CoveredAttendanceRecord> {
    const map: Record<string, CoveredAttendanceRecord> = {};
    if (!Array.isArray(rows)) return map;

    for (const r of rows) {
        if (isQualifyingAlternativeAttendance(r, scheduledDate)) {
            map[r.student_id] = {
                attendanceId: r.id,
                studentId: r.student_id,
                classroomId: r.classroom_id,
                actualDate: r.date,
                targetDate: r.on_behalf_of_date,
                status: r.status.toLowerCase()
            };
        }
    }
    return map;
}

export function formatLocalDateStr(dateStr: string, includeYear = false, locale = 'en-IN'): string {
    if (!dateStr) return '';
    const cleanDate = dateStr.split('T')[0].split(' ')[0];
    const parts = cleanDate.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    return d.toLocaleDateString(locale, { 
        day: 'numeric', 
        month: 'short', 
        ...(includeYear ? { year: 'numeric' } : {}) 
    });
}

/**
 * Checks if a scheduled date has already been fulfilled by an alternative class taken on another date.
 * Returns the matching attendance record that fulfilled it, or null.
 */
export function getFulfillmentForTargetDate(
    attendanceRecords: any[],
    targetScheduledDate: string
): { actualDate: string; status: string; id: string } | null {
    if (!Array.isArray(attendanceRecords) || !targetScheduledDate) return null;
    const targetClean = targetScheduledDate.split('T')[0].split(' ')[0];

    for (const att of attendanceRecords) {
        if (!att || !att.on_behalf_of_date) continue;
        const behalfClean = att.on_behalf_of_date.split('T')[0].split(' ')[0];
        const actualClean = (att.date || '').split('T')[0].split(' ')[0];
        // Guard against self-matching
        if (actualClean === targetClean) continue;
        if (behalfClean === targetClean && QUALIFYING_COVERED_STATUSES.includes((att.status || '').toLowerCase() as any)) {
            return {
                actualDate: actualClean,
                status: (att.status || '').toLowerCase(),
                id: att.id
            };
        }
    }
    return null;
}

/**
 * Checks if an attendance record on a given physical date was taken as an alternative class for another date.
 * Returns the target scheduled date string, or null.
 */
export function getAlternativeClassTargetDate(
    att: { date?: string; on_behalf_of_date?: string | null; status?: string }
): string | null {
    if (!att || !att.on_behalf_of_date) return null;
    const actualClean = (att.date || '').split('T')[0].split(' ')[0];
    const behalfClean = att.on_behalf_of_date.split('T')[0].split(' ')[0];
    if (actualClean !== behalfClean) {
        return behalfClean;
    }
    return null;
}
