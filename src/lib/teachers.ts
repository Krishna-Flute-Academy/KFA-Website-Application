/**
 * Shared utility for fetching all academy instructors, teachers, and admins.
 * Ensures robust inclusion across case variations, roles, and classroom assignments.
 */

export interface AcademyTeacher {
    id: string;
    name: string;
    email?: string;
    role?: string;
}

export async function fetchAcademyTeachers(
    supabaseClient: any,
    currentUserId?: string,
    existingClassrooms?: any[]
): Promise<AcademyTeacher[]> {
    try {
        // 1. Fetch users with explicit teacher/admin/mentor roles (case-insensitive)
        const roleUsersQuery = supabaseClient
            .from('users')
            .select('id, name, email, role')
            .or('role.ilike.teacher,role.ilike.admin,role.ilike.mentor')
            .order('name');

        // 2. Classroom teachers (use existingClassrooms if provided to save a roundtrip)
        const classroomsQuery = existingClassrooms && existingClassrooms.length > 0
            ? Promise.resolve({ data: existingClassrooms })
            : supabaseClient.from('classrooms').select('teacher_id');

        // 3. Temporary class teachers
        const tempClassQuery = supabaseClient
            .from('temporary_classes')
            .select('teacher_id');

        // 4. Student-assigned teachers
        const studentTeachersQuery = supabaseClient
            .from('users')
            .select('teacher_id')
            .not('teacher_id', 'is', null);

        const [
            { data: roleUsers },
            { data: classroomsData },
            { data: tempClassData },
            { data: studentTeachersData }
        ] = await Promise.all([
            roleUsersQuery,
            classroomsQuery,
            tempClassQuery,
            studentTeachersQuery
        ]);

        const teacherMap = new Map<string, AcademyTeacher>();

        // Populate from explicit role users
        (roleUsers || []).forEach((u: any) => {
            if (u?.id) {
                const cleanName = u.name?.trim() || u.email?.split('@')[0]?.trim() || 'Instructor';
                teacherMap.set(u.id, {
                    id: u.id,
                    name: cleanName,
                    email: u.email,
                    role: u.role
                });
            }
        });

        // Collect all referenced instructor IDs
        const referencedIds = new Set<string>();
        if (currentUserId) referencedIds.add(currentUserId);
        (classroomsData || []).forEach((c: any) => { if (c?.teacher_id) referencedIds.add(c.teacher_id); });
        (tempClassData || []).forEach((t: any) => { if (t?.teacher_id) referencedIds.add(t.teacher_id); });
        (studentTeachersData || []).forEach((s: any) => { if (s?.teacher_id) referencedIds.add(s.teacher_id); });

        // Fetch any referenced IDs that weren't captured by the role filter
        const missingIds = Array.from(referencedIds).filter(id => !teacherMap.has(id));

        if (missingIds.length > 0) {
            const { data: extraUsers } = await supabaseClient
                .from('users')
                .select('id, name, email, role')
                .in('id', missingIds);

            (extraUsers || []).forEach((u: any) => {
                if (u?.id) {
                    const cleanName = u.name?.trim() || u.email?.split('@')[0]?.trim() || 'Instructor';
                    teacherMap.set(u.id, {
                        id: u.id,
                        name: cleanName,
                        email: u.email,
                        role: u.role
                    });
                }
            });
        }

        return Array.from(teacherMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
        console.error('Error in fetchAcademyTeachers:', err);
        return [];
    }
}
