/**
 * KFA Student Lifecycle Access Model & Capabilities
 * Centralizes lifecycle rules across Active, Inactive ("Learning Paused"), and Archived ("Former Student") states.
 */

export type StudentStatus = 'active' | 'inactive' | 'archived';

export interface StudentAccessRules {
    /** Whether the student has access to an active classroom tab/roster */
    canAccessClassroom: boolean;
    /** Whether the student can see live classes, Join Class modals, and meeting links */
    canAccessLiveClass: boolean;
    /** Whether the student can submit practice recordings or tasks */
    canSubmitTasks: boolean;
    /** Whether the student can apply for leaves */
    canRequestLeave: boolean;
    /** Whether the student can update syllabus progress (check/uncheck lessons) */
    canModifyCurriculum: boolean;
    /** Whether the student has access to the Fees & Payments tab */
    canViewFees: boolean;
    /** Whether the student receives operational alerts (class start, task due, attendance) */
    canReceiveOperationalNotifications: boolean;
    /** Whether practice tools (tuner, metronome, tanpura, drum sequencer) are accessible */
    canAccessTools: boolean;
    /** Mode for curriculum view */
    curriculumMode: 'full' | 'readonly_paused' | 'readonly_frozen';
    /** Dashboard presentation mode */
    dashboardMode: 'active' | 'learning_paused' | 'former_student';
    /** Human-readable student-facing label */
    studentFacingLabel: string;
    /** Admin/Teacher portal label */
    adminLabel: string;
}

/**
 * Authoritative lifecycle access rules resolver.
 * Defaults to 'active' if status is missing or unrecognized.
 */
export function getStudentAccess(status?: string | null): StudentAccessRules {
    const normalized = (status || 'active').toLowerCase().trim() as StudentStatus;

    switch (normalized) {
        case 'inactive':
            return {
                canAccessClassroom: false,
                canAccessLiveClass: false,
                canSubmitTasks: false,
                canRequestLeave: false,
                canModifyCurriculum: false,
                canViewFees: false,
                canReceiveOperationalNotifications: false,
                canAccessTools: true,
                curriculumMode: 'readonly_paused',
                dashboardMode: 'learning_paused',
                studentFacingLabel: 'Learning Paused',
                adminLabel: 'Paused'
            };

        case 'archived':
            return {
                canAccessClassroom: false,
                canAccessLiveClass: false,
                canSubmitTasks: false,
                canRequestLeave: false,
                canModifyCurriculum: false,
                canViewFees: false,
                canReceiveOperationalNotifications: false,
                canAccessTools: true,
                curriculumMode: 'readonly_frozen',
                dashboardMode: 'former_student',
                studentFacingLabel: 'Former Student',
                adminLabel: 'Archived'
            };

        case 'active':
        default:
            return {
                canAccessClassroom: true,
                canAccessLiveClass: true,
                canSubmitTasks: true,
                canRequestLeave: true,
                canModifyCurriculum: true,
                canViewFees: true,
                canReceiveOperationalNotifications: true,
                canAccessTools: true,
                curriculumMode: 'full',
                dashboardMode: 'active',
                studentFacingLabel: 'Active Student',
                adminLabel: 'Active'
            };
    }
}

/**
 * Returns true if student is operationally active (eligible for live classroom rosters,
 * attendance tracking, active fee cycles, operational notifications, and assignments).
 */
export function isStudentOperationallyActive(status?: string | null): boolean {
    const normalized = (status || '').toLowerCase().trim();
    return normalized === 'active';
}

export function isStudentPaused(status?: string | null): boolean {
    const normalized = (status || '').toLowerCase().trim();
    return normalized === 'inactive' || normalized === 'paused';
}

export function isStudentArchived(status?: string | null): boolean {
    const normalized = (status || '').toLowerCase().trim();
    return normalized === 'archived';
}

/**
 * Returns badge styling and label for teacher/admin dashboard tables.
 */
export function getStudentStatusBadge(status?: string | null): {
    label: 'Active' | 'Paused' | 'Archived';
    badgeClass: string;
    dotClass: string;
} {
    const normalized = (status || 'active').toLowerCase().trim();

    if (normalized === 'inactive' || normalized === 'paused') {
        return {
            label: 'Paused',
            badgeClass: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-700/60 font-black',
            dotClass: 'bg-amber-500'
        };
    }

    if (normalized === 'archived') {
        return {
            label: 'Archived',
            badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700 font-bold',
            dotClass: 'bg-slate-400'
        };
    }

    return {
        label: 'Active',
        badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-700/40 font-bold',
        dotClass: 'bg-emerald-500'
    };
}

