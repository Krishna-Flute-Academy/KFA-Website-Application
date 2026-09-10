import { sendClassroomNotification } from './notifications';

export type SpecialSessionPurpose = 'makeup' | 'extra_class' | 'revision' | 'practice' | 'other';
export type SpecialSessionCreditTreatment = 'complimentary' | 'makeup' | 'consume_credit';
export type SpecialSessionLifecycleStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';

export interface CreateSpecialSessionInput {
    name: string;
    description?: string;
    teacherId: string;
    classDate: string;
    startTime: string;
    endTime: string;
    deliveryFormat?: 'online' | 'offline';
    purpose?: SpecialSessionPurpose;
    creditTreatment?: SpecialSessionCreditTreatment;
    selectedStudents: string[];
    studentMissedDates?: Record<string, string>; // studentId -> YYYY-MM-DD
}

export interface UpdateSpecialSessionInput {
    classroomId: string; // Canonical classroom ID
    name?: string;
    description?: string;
    teacherId?: string;
    classDate?: string;
    startTime?: string;
    endTime?: string;
    deliveryFormat?: 'online' | 'offline';
    purpose?: SpecialSessionPurpose;
    creditTreatment?: SpecialSessionCreditTreatment;
    lifecycleStatus?: SpecialSessionLifecycleStatus;
    selectedStudents?: string[];
    studentMissedDates?: Record<string, string>;
}

export function getDefaultCreditTreatment(purpose: SpecialSessionPurpose): SpecialSessionCreditTreatment {
    return purpose === 'makeup' ? 'makeup' : 'complimentary';
}

export function getSpecialSessionPurposeLabel(purpose?: string): string {
    switch (purpose) {
        case 'makeup': return 'Makeup Session';
        case 'extra_class': return 'Extra Session';
        case 'revision': return 'Revision Session';
        case 'practice': return 'Practice Session';
        case 'other': return 'Special Workshop';
        default: return 'Special Session';
    }
}

function formatTime12hr(time24: string): string {
    if (!time24) return '';
    const [h, m] = time24.split(':');
    let hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${m} ${ampm}`;
}

/**
 * Creates a Special Session using the canonical architecture:
 * 1. Shadow classroom row in `classrooms` (type: 'temporary', canonical ID)
 * 2. Record in `temporary_classes` with purpose, credit_treatment, lifecycle_status
 * 3. Authoritative participant overrides in `session_student_overrides` (no classroom_students mutation)
 * 4. Classroom notifications dispatched to teacher, selected students, and admins
 */
export async function createSpecialSession(
    supabaseClient: any,
    input: CreateSpecialSessionInput
) {
    const {
        name,
        description = '',
        teacherId,
        classDate,
        startTime,
        endTime,
        deliveryFormat = 'offline',
        purpose = 'makeup',
        selectedStudents = [],
        studentMissedDates = {}
    } = input;

    if (!name?.trim()) throw new Error('Session name is required.');
    if (!teacherId) throw new Error('An instructor/teacher must be assigned.');
    if (!classDate) throw new Error('Session date is required.');
    if (!startTime || !endTime) throw new Error('Start and end times are required.');
    if (endTime <= startTime) throw new Error('End time must be after start time.');

    const creditTreatment = input.creditTreatment || getDefaultCreditTreatment(purpose);
    const formatTag = `[delivery_format:${deliveryFormat}]`;
    const finalDescription = `${(description || 'Special session').trim()} ${formatTag}`;

    // 1. Create shadow classroom
    const { data: classroom, error: classError } = await supabaseClient
        .from('classrooms')
        .insert([{
            teacher_id: teacherId,
            name: name.trim(),
            description: finalDescription,
            type: 'temporary',
            status: 'active'
        }])
        .select()
        .single();

    if (classError) throw classError;

    // 2. Create Special Session in temporary_classes
    const tempPayload: any = {
        teacher_id: teacherId,
        classroom_id: classroom.id,
        title: name.trim(),
        class_date: classDate,
        start_time: startTime,
        end_time: endTime,
        purpose,
        lifecycle_status: 'scheduled',
        credit_treatment: creditTreatment
    };

    let { data: tempClass, error: tempError } = await supabaseClient
        .from('temporary_classes')
        .insert([tempPayload])
        .select()
        .single();

    // Graceful fallback if database does not yet have dedicated metadata columns
    if (tempError && (tempError.code === '42703' || tempError.message?.includes('does not exist') || tempError.code === 'PGRST204')) {
        const fallbackPayload = {
            teacher_id: teacherId,
            classroom_id: classroom.id,
            title: name.trim(),
            class_date: classDate,
            start_time: startTime,
            end_time: endTime
        };
        const retryResult = await supabaseClient
            .from('temporary_classes')
            .insert([fallbackPayload])
            .select()
            .single();
        tempClass = retryResult.data;
        tempError = retryResult.error;
    }

    if (tempError) throw tempError;

    // 3. Assign Students to Special Session in session_student_overrides
    if (selectedStudents.length > 0) {
        const studentInserts = selectedStudents.map(studentId => {
            const missedDate = studentMissedDates[studentId] || null;
            const reason = purpose === 'makeup' && missedDate
                ? `Special Session (Makeup for ${missedDate}) [MissedDate:${missedDate}][credit_treatment:${creditTreatment}][purpose:${purpose}]`
                : `Special Session (${purpose.replace('_', ' ')}) [credit_treatment:${creditTreatment}][purpose:${purpose}]`;
            return {
                student_id: studentId,
                target_classroom_id: classroom.id,
                override_date: classDate,
                credit_treatment: creditTreatment,
                missed_session_date: missedDate,
                reason
            };
        });

        let { error: tempAssignmentError } = await supabaseClient
            .from('session_student_overrides')
            .insert(studentInserts);

        // Graceful fallback if credit_treatment / missed_session_date columns do not exist yet
        if (tempAssignmentError && (tempAssignmentError.code === '42703' || tempAssignmentError.message?.includes('does not exist') || tempAssignmentError.code === 'PGRST204')) {
            const fallbackStudentInserts = studentInserts.map(row => ({
                student_id: row.student_id,
                target_classroom_id: row.target_classroom_id,
                override_date: row.override_date,
                reason: row.reason
            }));
            const retryAssign = await supabaseClient
                .from('session_student_overrides')
                .insert(fallbackStudentInserts);
            tempAssignmentError = retryAssign.error;
        }

        if (tempAssignmentError) throw tempAssignmentError;
    }

    // 4. Dispatch Notifications
    try {
        const { data: admins } = await supabaseClient
            .from('users')
            .select('id')
            .eq('role', 'admin')
            .eq('status', 'active');

        const adminIds = (admins || []).map((a: any) => a.id);
        const recipientIds = Array.from(new Set([
            teacherId,
            ...selectedStudents,
            ...adminIds
        ]));

        if (recipientIds.length > 0) {
            const { data: teacherProfile } = await supabaseClient
                .from('users')
                .select('name')
                .eq('id', teacherId)
                .maybeSingle();

            const teacherName = teacherProfile?.name || 'Teacher';
            const purposeLabel = purpose.replace('_', ' ');
            const title = `New Special Session: ${name.trim()}`;
            const message = `A new special session "${name.trim()}" (${purposeLabel}) has been scheduled for ${classDate} from ${formatTime12hr(startTime)} to ${formatTime12hr(endTime)} with teacher ${teacherName}.`;

            await sendClassroomNotification({
                teacherId,
                recipients: [],
                title,
                message,
                studentIds: recipientIds
            });
        }
    } catch (notifyErr) {
        console.error('Error sending creation notifications:', notifyErr);
    }

    return {
        success: true,
        classroom,
        tempClass
    };
}

/**
 * Updates a Special Session's metadata and student overrides using canonical classroomId
 */
export async function updateSpecialSession(
    supabaseClient: any,
    input: UpdateSpecialSessionInput
) {
    const { classroomId } = input;
    if (!classroomId) throw new Error('Classroom ID is required.');

    // 1. Update classroom row if name or description or delivery format changed
    if (input.name !== undefined || input.description !== undefined || input.deliveryFormat !== undefined) {
        const updates: any = {};
        if (input.name !== undefined) updates.name = input.name.trim();

        if (input.description !== undefined || input.deliveryFormat !== undefined) {
            const formatTag = `[delivery_format:${input.deliveryFormat || 'offline'}]`;
            updates.description = `${(input.description || '').replace(/\[delivery_format:(online|offline)\]/g, '').trim()} ${formatTag}`;
        }

        if (Object.keys(updates).length > 0) {
            const { error: classErr } = await supabaseClient
                .from('classrooms')
                .update(updates)
                .eq('id', classroomId);
            if (classErr) throw classErr;
        }
    }

    // 2. Update temporary_classes metadata
    const tempUpdates: any = {};
    if (input.name !== undefined) tempUpdates.title = input.name.trim();
    if (input.teacherId !== undefined) tempUpdates.teacher_id = input.teacherId;
    if (input.classDate !== undefined) tempUpdates.class_date = input.classDate;
    if (input.startTime !== undefined) tempUpdates.start_time = input.startTime;
    if (input.endTime !== undefined) tempUpdates.end_time = input.endTime;
    if (input.purpose !== undefined) tempUpdates.purpose = input.purpose;
    if (input.creditTreatment !== undefined) tempUpdates.credit_treatment = input.creditTreatment;
    if (input.lifecycleStatus !== undefined) tempUpdates.lifecycle_status = input.lifecycleStatus;

    if (Object.keys(tempUpdates).length > 0) {
        let { error: tempErr } = await supabaseClient
            .from('temporary_classes')
            .update(tempUpdates)
            .eq('classroom_id', classroomId);

        // Fallback if missing dedicated columns
        if (tempErr && (tempErr.code === '42703' || tempErr.message?.includes('does not exist') || tempErr.code === 'PGRST204')) {
            const fallbackUpdates: any = {};
            if (tempUpdates.title) fallbackUpdates.title = tempUpdates.title;
            if (tempUpdates.teacher_id) fallbackUpdates.teacher_id = tempUpdates.teacher_id;
            if (tempUpdates.class_date) fallbackUpdates.class_date = tempUpdates.class_date;
            if (tempUpdates.start_time) fallbackUpdates.start_time = tempUpdates.start_time;
            if (tempUpdates.end_time) fallbackUpdates.end_time = tempUpdates.end_time;

            if (Object.keys(fallbackUpdates).length > 0) {
                const retry = await supabaseClient
                    .from('temporary_classes')
                    .update(fallbackUpdates)
                    .eq('classroom_id', classroomId);
                tempErr = retry.error;
            }
        }
        if (tempErr) throw tempErr;
    }

    // 3. Update student overrides if selectedStudents is provided
    if (input.selectedStudents !== undefined) {
        const { error: delErr } = await supabaseClient
            .from('session_student_overrides')
            .delete()
            .eq('target_classroom_id', classroomId);
        if (delErr) throw delErr;

        if (input.selectedStudents.length > 0) {
            const purpose = input.purpose || 'makeup';
            const creditTreatment = input.creditTreatment || getDefaultCreditTreatment(purpose);
            const studentMissedDates = input.studentMissedDates || {};

            const studentInserts = input.selectedStudents.map(studentId => {
                const missedDate = studentMissedDates[studentId] || null;
                const reason = purpose === 'makeup' && missedDate
                    ? `Special Session (Makeup for ${missedDate}) [MissedDate:${missedDate}][credit_treatment:${creditTreatment}][purpose:${purpose}]`
                    : `Special Session (${purpose.replace('_', ' ')}) [credit_treatment:${creditTreatment}][purpose:${purpose}]`;
                return {
                    student_id: studentId,
                    target_classroom_id: classroomId,
                    override_date: input.classDate || new Date().toISOString().split('T')[0],
                    credit_treatment: creditTreatment,
                    missed_session_date: missedDate,
                    reason
                };
            });

            let { error: insErr } = await supabaseClient
                .from('session_student_overrides')
                .insert(studentInserts);

            if (insErr && (insErr.code === '42703' || insErr.message?.includes('does not exist') || insErr.code === 'PGRST204')) {
                const fallbackInserts = studentInserts.map(row => ({
                    student_id: row.student_id,
                    target_classroom_id: row.target_classroom_id,
                    override_date: row.override_date,
                    reason: row.reason
                }));
                const retryIns = await supabaseClient
                    .from('session_student_overrides')
                    .insert(fallbackInserts);
                insErr = retryIns.error;
            }
            if (insErr) throw insErr;
        }
    }

    return { success: true };
}

/**
 * Soft cancels a Special Session without deleting records
 */
export async function cancelSpecialSession(
    supabaseClient: any,
    classroomId: string
) {
    if (!classroomId) throw new Error('Classroom ID is required.');

    let { error: tempErr } = await supabaseClient
        .from('temporary_classes')
        .update({ lifecycle_status: 'cancelled' })
        .eq('classroom_id', classroomId);

    if (tempErr && (tempErr.code === '42703' || tempErr.message?.includes('does not exist'))) {
        tempErr = null; // graceful fallback
    }
    if (tempErr) throw tempErr;

    const { error: classErr } = await supabaseClient
        .from('classrooms')
        .update({ status: 'archived' })
        .eq('id', classroomId);

    if (classErr) throw classErr;

    return { success: true };
}

/**
 * Marks a Special Session as completed
 */
export async function completeSpecialSession(
    supabaseClient: any,
    classroomId: string
) {
    if (!classroomId) throw new Error('Classroom ID is required.');

    let { error: tempErr } = await supabaseClient
        .from('temporary_classes')
        .update({ lifecycle_status: 'completed' })
        .eq('classroom_id', classroomId);

    if (tempErr && (tempErr.code === '42703' || tempErr.message?.includes('does not exist'))) {
        tempErr = null; // graceful fallback
    }
    if (tempErr) throw tempErr;

    const { error: classErr } = await supabaseClient
        .from('classrooms')
        .update({ status: 'archived' })
        .eq('id', classroomId);

    if (classErr) throw classErr;

    return { success: true };
}
