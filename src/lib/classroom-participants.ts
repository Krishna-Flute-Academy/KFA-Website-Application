/**
 * Authoritative participant resolution utility for Krishna Flute Academy.
 * Resolves effective participants (teachers and students) across both
 * Permanent Classrooms and Special Sessions (Temporary Classes).
 */

export interface ClassroomParticipant {
    id: string;
    student_id: string;
    name: string;
    email?: string;
    role: 'student' | 'teacher' | 'admin' | 'mentor';
    profile_pic_url?: string | null;
    level?: string;
    is_override?: boolean;
    override_date?: string | null;
    reason?: string | null;
    missed_session_date?: string | null;
    credit_treatment?: string | null;
}

export interface SpecialSessionMetadata {
    id: string;
    classroom_id: string;
    title: string;
    class_date: string;
    start_time: string;
    end_time: string;
    purpose: 'makeup' | 'extra_class' | 'revision' | 'practice' | 'other';
    lifecycle_status: 'scheduled' | 'active' | 'completed' | 'cancelled';
    credit_treatment: 'complimentary' | 'makeup' | 'consume_credit';
    notes?: string | null;
    teacher_id: string;
}

export interface EffectiveClassroomResult {
    classroomId: string;
    classroomType: 'permanent' | 'temporary';
    classroomStatus: string;
    teacher: { id: string; name: string; email?: string; role?: string; profile_pic_url?: string | null } | null;
    students: ClassroomParticipant[];
    regularStudents: ClassroomParticipant[];
    guestStudents: ClassroomParticipant[];
    studentIds: string[];
    specialSession?: SpecialSessionMetadata | null;
}

export async function fetchEffectiveClassroomParticipants(
    supabaseClient: any,
    classroomId: string,
    options?: { date?: string; fallbackTeacher?: any }
): Promise<EffectiveClassroomResult> {
    if (!classroomId) {
        return {
            classroomId: '',
            classroomType: 'permanent',
            classroomStatus: 'active',
            teacher: null,
            students: [],
            regularStudents: [],
            guestStudents: [],
            studentIds: [],
            specialSession: null
        };
    }

    try {
        // 1. Fetch classroom base entity and special session metadata in parallel
        const [classroomRes, tempClassRes] = await Promise.all([
            supabaseClient
                .from('classrooms')
                .select('id, name, type, status, teacher_id, is_live, live_meeting_link, live_session_started_at, users!classrooms_teacher_id_fkey(id, name, email, role, profile_pic_url)')
                .eq('id', classroomId)
                .single(),
            supabaseClient
                .from('temporary_classes')
                .select('*')
                .eq('classroom_id', classroomId)
                .maybeSingle()
        ]);

        const classroom = classroomRes.data;
        const tempClass = tempClassRes.data as SpecialSessionMetadata | null;
        const isTemporary = classroom?.type === 'temporary' || !!tempClass;

        // 2. Fetch student rosters based on canonical classroom type
        let permStudents: any[] = [];
        let overrideStudents: any[] = [];

        if (isTemporary) {
            // Special Session: session_student_overrides is the authoritative source
            const { data: ssoData } = await supabaseClient
                .from('session_student_overrides')
                .select('id, student_id, override_date, reason, credit_treatment, missed_session_date, users!student_id(id, name, email, role, level, profile_pic_url)')
                .eq('target_classroom_id', classroomId);

            overrideStudents = ssoData || [];
        } else {
            // Permanent Classroom: classroom_students + session_student_overrides for date if provided
            const permQuery = supabaseClient
                .from('classroom_students')
                .select('id, student_id, joined_at, users!student_id(id, name, email, role, level, profile_pic_url)')
                .eq('classroom_id', classroomId);

            if (options?.date) {
                const overrideQuery = supabaseClient
                    .from('session_student_overrides')
                    .select('id, student_id, override_date, reason, credit_treatment, missed_session_date, users!student_id(id, name, email, role, level, profile_pic_url)')
                    .eq('target_classroom_id', classroomId)
                    .eq('override_date', options.date);

                const [csRes, ssoRes] = await Promise.all([permQuery, overrideQuery]);
                permStudents = csRes.data || [];
                overrideStudents = ssoRes.data || [];
            } else {
                const csRes = await permQuery;
                permStudents = csRes.data || [];
                overrideStudents = [];
            }
        }

        // 3. Resolve Teacher Profile
        let teacherInfo = options?.fallbackTeacher || null;
        if (classroom?.users) {
            const rawU = Array.isArray(classroom.users) ? classroom.users[0] : classroom.users;
            if (rawU) {
                teacherInfo = {
                    id: rawU.id || classroom.teacher_id,
                    name: rawU.name || 'Academy Instructor',
                    email: rawU.email || '',
                    role: rawU.role || 'teacher',
                    profile_pic_url: rawU.profile_pic_url || null
                };
            }
        }

        // 4. Build unified deduped student list
        const studentMap = new Map<string, ClassroomParticipant>();

        permStudents.forEach((row: any) => {
            const u = row.users || {};
            const sid = row.student_id || u.id;
            if (sid) {
                studentMap.set(sid, {
                    id: sid,
                    student_id: sid,
                    name: u.name || 'Student',
                    email: u.email,
                    role: 'student',
                    profile_pic_url: u.profile_pic_url || null,
                    level: u.level || 'Level 1',
                    is_override: false,
                    override_date: null,
                    reason: null,
                    missed_session_date: null,
                    credit_treatment: null
                });
            }
        });

        overrideStudents.forEach((row: any) => {
            const u = row.users || {};
            const sid = row.student_id || u.id;
            if (sid) {
                const existing = studentMap.get(sid);
                studentMap.set(sid, {
                    id: sid,
                    student_id: sid,
                    name: u.name || existing?.name || 'Student',
                    email: u.email || existing?.email,
                    role: 'student',
                    profile_pic_url: u.profile_pic_url || existing?.profile_pic_url || null,
                    level: u.level || existing?.level || 'Level 1',
                    is_override: true,
                    override_date: row.override_date,
                    reason: row.reason,
                    missed_session_date: row.missed_session_date,
                    credit_treatment: row.credit_treatment || tempClass?.credit_treatment || 'makeup'
                });
            }
        });

        const studentsList = Array.from(studentMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        const regularStudents = studentsList.filter(s => !s.is_override);
        const guestStudents = studentsList.filter(s => s.is_override);
        const studentIds = studentsList.map(s => s.student_id);

        return {
            classroomId,
            classroomType: isTemporary ? 'temporary' : 'permanent',
            classroomStatus: classroom?.status || 'active',
            teacher: teacherInfo,
            students: studentsList,
            regularStudents,
            guestStudents,
            studentIds,
            specialSession: tempClass ? {
                ...tempClass,
                purpose: tempClass.purpose || 'makeup',
                lifecycle_status: tempClass.lifecycle_status || (tempClass.class_date < new Date().toISOString().split('T')[0] ? 'completed' : 'scheduled'),
                credit_treatment: tempClass.credit_treatment || 'makeup'
            } : null
        };

    } catch (err) {
        console.error('[ParticipantResolver] Error fetching effective participants for classroom:', classroomId, err);
        return {
            classroomId,
            classroomType: 'permanent',
            classroomStatus: 'active',
            teacher: options?.fallbackTeacher || null,
            students: [],
            regularStudents: [],
            guestStudents: [],
            studentIds: [],
            specialSession: null
        };
    }
}
