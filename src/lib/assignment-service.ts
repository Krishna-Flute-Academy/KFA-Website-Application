/**
 * KFA Canonical Assignment & Recipient Service
 * Centralizes recipient resolution, student-centric assignment mapping,
 * status calculation, and recipient display formatting.
 */

export interface RecipientInfo {
    id: string;
    name: string;
    profile_pic_url?: string | null;
    status?: string;
    submission_status?: 'pending' | 'submitted' | 'reviewed' | 'approved';
    is_past_due?: boolean;
    submitted_at?: string | null;
    score?: number | null;
    feedback_text?: string | null;
    video_url?: string | null;
    classroom_id?: string | null;
    classroom_name?: string | null;
}

export type AssignmentStatusKey = 'approved' | 'awaiting_review' | 'needs_revision' | 'past_due' | 'pending';

export interface DerivedAssignmentStatus {
    statusKey: AssignmentStatusKey;
    label: string;
    isPastDue: boolean;
    isCompleted: boolean;
    isActive: boolean;
}

export interface StudentEffectiveAssignment {
    assignmentId: string;
    taskTitle: string;
    taskDescription?: string | null;
    classroomId: string;
    classroomName: string;
    dueDate?: string | null;
    createdAt?: string | null;
    targetType: 'all' | 'individual' | 'classroom';
    isIndividual: boolean;
    status: 'pending' | 'submitted' | 'reviewed' | 'approved' | 'draft';
    effectiveStatus: AssignmentStatusKey;
    statusLabel: string;
    isPastDue: boolean;
    isCompleted: boolean;
    isActive: boolean;
    score?: number | null;
    proficiencyLevel?: string | null;
    feedbackText?: string | null;
    videoUrl?: string | null;
    submittedAt?: string | null;
    fileUrl?: string | null;
    fileName?: string | null;
    fileSize?: number | string | null;
    inventoryRefId?: string | null;
    inventoryRefTitle?: string | null;
    inventoryRefType?: string | null;
    submissionId?: string;
}

export interface StudentAssignmentMetrics {
    totalCount: number;
    activeCount: number;
    awaitingSubmissionCount: number;
    awaitingReviewCount: number;
    needsRevisionCount: number;
    completedCount: number;
    pastDueCount: number;
}

/**
 * Safely determines if a due date has passed.
 * Considers an assignment overdue strictly AFTER the due date has elapsed.
 */
export function isDueDatePassed(dueDate?: string | null, referenceDate: Date = new Date()): boolean {
    if (!dueDate) return false;
    const str = String(dueDate).trim();
    const datePart = str.includes('T') ? str.split('T')[0] : str;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return false;

    const y = referenceDate.getFullYear();
    const m = String(referenceDate.getMonth() + 1).padStart(2, '0');
    const d = String(referenceDate.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    return datePart < todayStr;
}

/**
 * Canonical derivation of an individual student's status for an assignment.
 */
export function deriveStudentAssignmentStatus(
    submissionStatus?: string | null,
    dueDate?: string | null,
    referenceDate: Date = new Date()
): DerivedAssignmentStatus {
    const raw = (submissionStatus || 'pending').toLowerCase().trim();

    if (raw === 'approved') {
        return {
            statusKey: 'approved',
            label: 'Completed · Approved',
            isPastDue: false,
            isCompleted: true,
            isActive: false
        };
    }

    if (raw === 'reviewed') {
        return {
            statusKey: 'needs_revision',
            label: 'Revision Requested',
            isPastDue: false,
            isCompleted: false,
            isActive: true
        };
    }

    if (raw === 'submitted') {
        return {
            statusKey: 'awaiting_review',
            label: 'Submitted · Awaiting Review',
            isPastDue: false,
            isCompleted: false,
            isActive: true
        };
    }

    // Pending / Not submitted
    const overdue = isDueDatePassed(dueDate, referenceDate);
    if (overdue) {
        return {
            statusKey: 'past_due',
            label: 'Past Due · Not Submitted',
            isPastDue: true,
            isCompleted: false,
            isActive: true
        };
    }

    return {
        statusKey: 'pending',
        label: 'Awaiting Submission',
        isPastDue: false,
        isCompleted: false,
        isActive: true
    };
}

/**
 * Formats recipient chips / summaries for individual assignment cards.
 * Rules:
 * - 0 students: "No students"
 * - 1 student: "Kruthika"
 * - 2-3 students: "Kruthika, Adhrith"
 * - 4+ students: "Kruthika, Adhrith +N more"
 */
export function formatRecipientSummary(recipients: Array<{ name?: string; student_name?: string } | string>): {
    mode: 'empty' | 'single' | 'few' | 'many';
    primaryNames: string[];
    remainingCount: number;
    displayText: string;
} {
    const names = recipients
        .map(r => (typeof r === 'string' ? r : r.student_name || r.name || 'Unknown'))
        .filter(Boolean);

    if (names.length === 0) {
        return {
            mode: 'empty',
            primaryNames: [],
            remainingCount: 0,
            displayText: 'No students'
        };
    }

    if (names.length === 1) {
        return {
            mode: 'single',
            primaryNames: [names[0]],
            remainingCount: 0,
            displayText: names[0]
        };
    }

    if (names.length <= 3) {
        return {
            mode: 'few',
            primaryNames: names,
            remainingCount: 0,
            displayText: names.join(', ')
        };
    }

    const primary = names.slice(0, 2);
    const remaining = names.length - 2;
    return {
        mode: 'many',
        primaryNames: primary,
        remainingCount: remaining,
        displayText: `${primary.join(', ')} +${remaining} more`
    };
}

/**
 * Calculates student assignment metrics for the By Student view.
 */
export function computeStudentAssignmentMetrics(assignments: StudentEffectiveAssignment[]): StudentAssignmentMetrics {
    let activeCount = 0;
    let awaitingSubmissionCount = 0;
    let awaitingReviewCount = 0;
    let needsRevisionCount = 0;
    let completedCount = 0;
    let pastDueCount = 0;

    assignments.forEach(asg => {
        if (asg.isCompleted) {
            completedCount++;
        } else {
            activeCount++;
            if (asg.effectiveStatus === 'awaiting_review') {
                awaitingReviewCount++;
            } else if (asg.effectiveStatus === 'needs_revision') {
                needsRevisionCount++;
            } else if (asg.effectiveStatus === 'past_due') {
                awaitingSubmissionCount++;
                pastDueCount++;
            } else if (asg.effectiveStatus === 'pending') {
                awaitingSubmissionCount++;
            }
        }
    });

    return {
        totalCount: assignments.length,
        activeCount,
        awaitingSubmissionCount,
        awaitingReviewCount,
        needsRevisionCount,
        completedCount,
        pastDueCount
    };
}

/**
 * Resolves all effective assignments for a specific student.
 * Combines:
 * 1. Explicit individual assignments mapped in assignment_students
 * 2. Class-wide assignments (target_type !== 'individual') for classrooms the student belongs to
 * 3. All-student assignments (target_type === 'all')
 */
export function resolveEffectiveAssignmentsForStudent(
    paramsOrStudentId: {
        studentId: string;
        studentClassroomIds: string[];
        assignments: Array<{
            id: string;
            title: string;
            description?: string | null;
            classroom_id: string;
            classroom_name?: string | null;
            due_date?: string | null;
            created_at?: string | null;
            target_type?: string | null;
            status?: string | null;
            file_url?: string | null;
            file_name?: string | null;
            file_size?: number | string | null;
            inventory_ref_id?: string | null;
            inventory_ref_title?: string | null;
            inventory_ref_type?: string | null;
            assignment_students?: any[];
        }>;
        assignmentStudents?: Array<{
            id?: string;
            assignment_id: string;
            student_id: string;
            status?: string | null;
            submitted_at?: string | null;
            score?: number | null;
            proficiency_level?: string | null;
            feedback_text?: string | null;
            video_url?: string | null;
        }>;
        classroomsMap?: Record<string, string>; // classroom_id -> classroom_name
        referenceDate?: Date;
    } | string,
    maybeStudentClassroomIds?: string[],
    maybeAssignments?: any[],
    maybeAssignmentStudents?: any[],
    maybeClassroomsMap?: Record<string, string>,
    maybeReferenceDate?: Date
): StudentEffectiveAssignment[] {
    let studentId: string;
    let studentClassroomIds: string[];
    let assignments: any[];
    let assignmentStudents: any[];
    let classroomsMap: Record<string, string>;
    let referenceDate: Date;

    if (typeof paramsOrStudentId === 'object' && paramsOrStudentId !== null && !Array.isArray(paramsOrStudentId) && 'studentId' in paramsOrStudentId) {
        studentId = paramsOrStudentId.studentId;
        studentClassroomIds = paramsOrStudentId.studentClassroomIds || [];
        assignments = paramsOrStudentId.assignments || [];
        assignmentStudents = paramsOrStudentId.assignmentStudents || [];
        classroomsMap = paramsOrStudentId.classroomsMap || {};
        referenceDate = paramsOrStudentId.referenceDate || new Date();
    } else {
        studentId = paramsOrStudentId as string;
        studentClassroomIds = maybeStudentClassroomIds || [];
        assignments = maybeAssignments || [];
        assignmentStudents = maybeAssignmentStudents || [];
        classroomsMap = maybeClassroomsMap || {};
        referenceDate = maybeReferenceDate || new Date();
    }

    const studentClassroomSet = new Set(studentClassroomIds || []);

    // Build quick lookup of student's assignment_students rows
    const studentSubmissionMap = new Map<string, any>();
    (assignmentStudents || []).forEach(row => {
        if (row && row.student_id === studentId) {
            studentSubmissionMap.set(row.assignment_id, row);
        }
    });

    const effectiveList: StudentEffectiveAssignment[] = [];
    const seenAssignmentIds = new Set<string>();

    (assignments || []).forEach(asg => {
        if (!asg || !asg.id || asg.status === 'draft') return;
        if (seenAssignmentIds.has(asg.id)) return;

        const isAutoCurriculum = asg.inventory_ref_type && asg.title === asg.inventory_ref_title;
        if (isAutoCurriculum) return;

        // Check if asg already has embedded assignment_students
        let submissionRow = studentSubmissionMap.get(asg.id);
        if (!submissionRow && Array.isArray(asg.assignment_students)) {
            const embedded = asg.assignment_students.find((s: any) => s.student_id === studentId);
            if (embedded) {
                submissionRow = embedded;
                studentSubmissionMap.set(asg.id, embedded);
            }
        }

        const isIndividual = asg.target_type === 'individual';
        let isAssignedToStudent = false;

        if (isIndividual) {
            // Must have an explicit row in assignment_students
            if (submissionRow) {
                isAssignedToStudent = true;
            }
        } else {
            // Whole-class assignment:
            // Assigned if the student is enrolled in that classroom OR has an explicit submission row
            if (asg.classroom_id && studentClassroomSet.has(asg.classroom_id)) {
                isAssignedToStudent = true;
            } else if (!asg.classroom_id && asg.target_type === 'all') {
                isAssignedToStudent = true;
            } else if (submissionRow) {
                isAssignedToStudent = true;
            }
        }

        if (!isAssignedToStudent) return;

        seenAssignmentIds.add(asg.id);

        const rawStatus = submissionRow?.status || 'pending';
        const derived = deriveStudentAssignmentStatus(rawStatus, asg.due_date, referenceDate);

        effectiveList.push({
            assignmentId: asg.id,
            taskTitle: asg.title || 'Untitled Task',
            taskDescription: asg.description,
            classroomId: asg.classroom_id,
            classroomName: asg.classroom_name || classroomsMap[asg.classroom_id] || (isIndividual ? 'Individual Assignment' : 'Class Assignment'),
            dueDate: asg.due_date,
            createdAt: asg.created_at,
            targetType: (asg.target_type as any) || 'classroom',
            isIndividual,
            status: rawStatus as any,
            effectiveStatus: derived.statusKey,
            statusLabel: derived.label,
            isPastDue: derived.isPastDue,
            isCompleted: derived.isCompleted,
            isActive: derived.isActive,
            score: submissionRow?.score,
            proficiencyLevel: submissionRow?.proficiency_level,
            feedbackText: submissionRow?.feedback_text,
            videoUrl: submissionRow?.video_url,
            submittedAt: submissionRow?.submitted_at,
            fileUrl: asg.file_url,
            fileName: asg.file_name,
            fileSize: asg.file_size,
            inventoryRefId: asg.inventory_ref_id,
            inventoryRefTitle: asg.inventory_ref_title,
            inventoryRefType: asg.inventory_ref_type,
            submissionId: submissionRow?.id
        });
    });

    // Sort by latest created/assigned
    return effectiveList.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}
