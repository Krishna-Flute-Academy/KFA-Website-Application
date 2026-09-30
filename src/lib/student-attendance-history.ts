/**
 * Canonical Student Attendance History Service
 *
 * Provides a single, authoritative student-centric attendance history across ALL
 * classrooms (past, present, temporary, and makeup), ensuring that:
 * 1. Historical attendance remains immutable regardless of later student transfers.
 * 2. Each record clearly displays the actual classroom where the class occurred.
 * 3. On-behalf-of attendance mappings are accurately presented.
 * 4. Can be queried and rendered consistently in Attendance and Fees modules.
 */

export interface StudentAttendanceHistoryItem {
    id: string;
    scheduledDate: string;      // Effective/Scheduled Date (on_behalf_of_date || physical date)
    actualDate: string;         // Physical class date
    classroomId: string;
    classroomName: string;
    isTemporary: boolean;
    sessionType: 'regular' | 'special' | 'guest_makeup';
    status: 'present' | 'absent' | 'late' | 'excused';
    isOnBehalf: boolean;
    onBehalfOfDate?: string | null;
    isMakeup: boolean;
    missedDate?: string | null;
    notes?: string | null;
}

export interface StudentAttendanceHistorySummary {
    totalSessions: number;
    presentCount: number;
    lateCount: number;
    absentCount: number;
    excusedCount: number;
    attendanceRate: number; // Percentage: (present + late) / total * 100
}

export interface StudentAttendanceHistoryResult {
    studentId: string;
    records: StudentAttendanceHistoryItem[];
    summary: StudentAttendanceHistorySummary;
}

function extractMissedDateFromReason(reason?: string | null): string | null {
    if (!reason) return null;
    const match = reason.match(/\[MissedDate:([^\]]+)\]/);
    return match ? match[1] : null;
}

/**
 * Pure function to normalize raw database entities into immutable student history items.
 * Can be tested directly with mock fixtures without requiring database access.
 */
export function normalizeStudentAttendanceHistory(params: {
    studentId: string;
    attendance: any[];
    classrooms?: { id: string; name?: string; type?: string }[];
    temporaryClasses?: { id: string; title?: string }[];
    overrides?: { id?: string; student_id?: string; target_classroom_id?: string; override_date?: string; reason?: string | null }[];
}): StudentAttendanceHistoryResult {
    const { studentId, attendance = [], classrooms = [], temporaryClasses = [], overrides = [] } = params;

    const classroomNameMap = new Map<string, string>();
    const isTempClassMap = new Map<string, boolean>();

    classrooms.forEach(c => {
        if (c.id) {
            classroomNameMap.set(c.id, c.name || 'Classroom');
            if (c.type === 'temporary' || c.type === 'special') {
                isTempClassMap.set(c.id, true);
            }
        }
    });

    temporaryClasses.forEach(t => {
        if (t.id) {
            classroomNameMap.set(t.id, t.title || 'Special Session');
            isTempClassMap.set(t.id, true);
        }
    });

    const studentOverrides = overrides.filter(o => !o.student_id || o.student_id === studentId);

    const studentAtt = attendance.filter(a => !a.student_id || a.student_id === studentId);

    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let excusedCount = 0;

    const records: StudentAttendanceHistoryItem[] = studentAtt.map(att => {
        const physicalDate = (att.date || att.session_date || '').split('T')[0];
        const onBehalfOf = att.on_behalf_of_date ? att.on_behalf_of_date.split('T')[0] : null;
        const scheduledDate = onBehalfOf || physicalDate;
        const isOnBehalf = Boolean(onBehalfOf && onBehalfOf !== physicalDate);

        const classId = att.classroom_id;
        const cName = att.classroom_name || classroomNameMap.get(classId) || 'Classroom';
        const isTemp = Boolean(att.is_temporary || isTempClassMap.get(classId));

        // Match against override for guest / makeup session
        const matchingOverride = studentOverrides.find(o => {
            const oDate = (o.override_date || '').split('T')[0];
            return oDate === physicalDate && o.target_classroom_id === classId;
        });

        const isMakeup = Boolean(matchingOverride);
        const missedDate = matchingOverride ? extractMissedDateFromReason(matchingOverride.reason) : null;

        const sessionType: 'regular' | 'special' | 'guest_makeup' = isMakeup
            ? 'guest_makeup'
            : isTemp
            ? 'special'
            : 'regular';

        const status = (att.status || 'present').toLowerCase() as 'present' | 'absent' | 'late' | 'excused';

        if (status === 'present') presentCount++;
        else if (status === 'late') lateCount++;
        else if (status === 'absent') absentCount++;
        else if (status === 'excused') excusedCount++;

        return {
            id: att.id || `att-${physicalDate}-${classId}`,
            scheduledDate,
            actualDate: physicalDate,
            classroomId: classId,
            classroomName: cName,
            isTemporary: isTemp,
            sessionType,
            status,
            isOnBehalf,
            onBehalfOfDate: onBehalfOf,
            isMakeup,
            missedDate,
            notes: att.notes || null
        };
    });

    // Sort descending by scheduled date, then actual date
    records.sort((a, b) => {
        if (b.scheduledDate !== a.scheduledDate) {
            return b.scheduledDate.localeCompare(a.scheduledDate);
        }
        return b.actualDate.localeCompare(a.actualDate);
    });

    const totalSessions = records.length;
    const attendedSessions = presentCount + lateCount;
    const attendanceRate = totalSessions > 0 ? Math.round((attendedSessions / totalSessions) * 100) : 0;

    return {
        studentId,
        records,
        summary: {
            totalSessions,
            presentCount,
            lateCount,
            absentCount,
            excusedCount,
            attendanceRate
        }
    };
}

/**
 * Fetch full attendance history directly from Supabase for a student across all classrooms.
 */
export async function fetchStudentFullAttendanceHistory(
    supabaseClient: any,
    studentId: string,
    options?: {
        fromDate?: string;
        toDate?: string;
    }
): Promise<StudentAttendanceHistoryResult> {
    const { fromDate, toDate } = options || {};

    let attQuery = supabaseClient
        .from('attendance')
        .select('*')
        .eq('student_id', studentId);

    if (fromDate && toDate) {
        // Capture records where either physical date or on_behalf_of_date falls within range
        attQuery = attQuery.or(`and(date.gte.${fromDate},date.lte.${toDate}),and(on_behalf_of_date.gte.${fromDate},on_behalf_of_date.lte.${toDate})`);
    } else if (fromDate) {
        attQuery = attQuery.or(`date.gte.${fromDate},on_behalf_of_date.gte.${fromDate}`);
    } else if (toDate) {
        attQuery = attQuery.or(`date.lte.${toDate},on_behalf_of_date.lte.${toDate}`);
    }

    const [attRes, classroomsRes, tempRes, overridesRes] = await Promise.all([
        attQuery.order('date', { ascending: false }),
        supabaseClient.from('classrooms').select('id, name, type'),
        supabaseClient.from('temporary_classes').select('id, title, session_date'),
        supabaseClient.from('session_student_overrides').select('id, student_id, target_classroom_id, override_date, reason').eq('student_id', studentId)
    ]);

    return normalizeStudentAttendanceHistory({
        studentId,
        attendance: attRes.data || [],
        classrooms: classroomsRes.data || [],
        temporaryClasses: tempRes.data || [],
        overrides: overridesRes.data || []
    });
}
