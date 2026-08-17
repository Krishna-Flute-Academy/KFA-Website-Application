/**
 * Utility functions for parsing classroom schedules and sorting classroom lists
 * chronologically by Day of Week (Sun -> Mon -> Tue -> Wed -> Thu -> Fri -> Sat)
 * and Start Time (AM -> PM ascending).
 */

export interface ClassroomSortable {
    id?: string;
    name?: string;
    title?: string;
    day_of_week?: number | null;
    start_time?: string | null;
    [key: string]: any;
}

export function parseDayAndStartFromClassroom(
    classroom: ClassroomSortable,
    batchSchedulesMap?: Record<string, { day_of_week: number; start_time: string }>
): { dayOfWeek: number; startTimeMinutes: number; nameStr: string } {
    const nameStr = (classroom.name || classroom.title || '').trim();
    let dayOfWeek = 99;
    let startTimeMinutes = 24 * 60; // Default to end of day

    const classId = classroom.id;

    // 1. Try parsing day of week from classroom name first if explicit (e.g. "Tuesday Slot 1")
    if (nameStr) {
        const nameLower = nameStr.toLowerCase();
        if (nameLower.includes('sunday') || nameLower.includes('sun')) dayOfWeek = 0;
        else if (nameLower.includes('monday') || nameLower.includes('mon')) dayOfWeek = 1;
        else if (nameLower.includes('tuesday') || nameLower.includes('tue')) dayOfWeek = 2;
        else if (nameLower.includes('wednesday') || nameLower.includes('wed')) dayOfWeek = 3;
        else if (nameLower.includes('thursday') || nameLower.includes('thu')) dayOfWeek = 4;
        else if (nameLower.includes('friday') || nameLower.includes('fri')) dayOfWeek = 5;
        else if (nameLower.includes('saturday') || nameLower.includes('sat')) dayOfWeek = 6;
    }

    // 2. Check batchSchedulesMap lookup if provided
    if (dayOfWeek === 99 && classId && batchSchedulesMap && batchSchedulesMap[classId]) {
        const sched = batchSchedulesMap[classId];
        if (sched.day_of_week !== undefined && sched.day_of_week !== null) {
            dayOfWeek = sched.day_of_week;
        }
    }

    // 3. Check directly attached properties on classroom object
    if (dayOfWeek === 99 && classroom.day_of_week !== undefined && classroom.day_of_week !== null) {
        dayOfWeek = Number(classroom.day_of_week);
    }

    // 4. Try parsing start time from classroom name first if explicit (e.g. "5:30 PM")
    if (nameStr) {
        const timeMatch = nameStr.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
        if (timeMatch) {
            let hours = parseInt(timeMatch[1], 10);
            const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
            const ampm = timeMatch[3].toUpperCase();
            if (ampm === 'PM' && hours < 12) hours += 12;
            if (ampm === 'AM' && hours === 12) hours = 0;
            startTimeMinutes = hours * 60 + minutes;
        }
    }

    if (startTimeMinutes === 24 * 60 && classId && batchSchedulesMap && batchSchedulesMap[classId]) {
        const sched = batchSchedulesMap[classId];
        if (sched.start_time) {
            const [h, m] = sched.start_time.split(':').map(Number);
            startTimeMinutes = (h || 0) * 60 + (m || 0);
        }
    }

    if (startTimeMinutes === 24 * 60 && classroom.start_time) {
        const [h, m] = String(classroom.start_time).split(':').map(Number);
        startTimeMinutes = (h || 0) * 60 + (m || 0);
    }

    if (startTimeMinutes === 24 * 60 && nameStr) {
        const slotMatch = nameStr.match(/Slot\s*(\d+)/i);
        if (slotMatch) {
            startTimeMinutes = parseInt(slotMatch[1], 10) * 10;
        }
    }

    return { dayOfWeek, startTimeMinutes, nameStr };
}

export function sortClassroomsByDayAndTime<T extends ClassroomSortable>(
    classrooms: T[],
    batchSchedulesMap?: Record<string, { day_of_week: number; start_time: string }>
): T[] {
    if (!classrooms || classrooms.length === 0) return [];

    return [...classrooms].sort((a, b) => {
        const infoA = parseDayAndStartFromClassroom(a, batchSchedulesMap);
        const infoB = parseDayAndStartFromClassroom(b, batchSchedulesMap);

        // First sort by Day of Week (0 = Sun, 1 = Mon, ..., 6 = Sat, 99 = Unknown/Temp)
        if (infoA.dayOfWeek !== infoB.dayOfWeek) {
            return infoA.dayOfWeek - infoB.dayOfWeek;
        }

        // Next sort by Start Time in minutes ascending
        if (infoA.startTimeMinutes !== infoB.startTimeMinutes) {
            return infoA.startTimeMinutes - infoB.startTimeMinutes;
        }

        // Final tie-breaker: Name string comparison
        return infoA.nameStr.localeCompare(infoB.nameStr, undefined, { numeric: true, sensitivity: 'base' });
    });
}
