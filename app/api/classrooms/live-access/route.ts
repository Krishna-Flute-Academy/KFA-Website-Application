import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateAuthoritativeFeeStatus } from '../../../../src/lib/fee-utils';

export const dynamic = 'force-dynamic';

function getEnvVariable(key: string): string {
    return process.env[key] || '';
}

const supabaseAuthUrl = getEnvVariable('NEXT_PUBLIC_AUTH_SUPABASE_URL');
const supabaseAuthAnonKey = getEnvVariable('NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY');

/**
 * Centralized Server-Side Live Class Access Authorization
 * Verifies student token and checks authoritative financial ledger balance.
 * Balance >= 0 -> 200 OK with live meeting link.
 * Balance < 0 -> 403 Forbidden with live meeting link redacted.
 */
export async function POST(req: Request) {
    try {
        if (!supabaseAuthUrl || !supabaseAuthAnonKey) {
            return NextResponse.json({ error: 'Server auth configuration missing' }, { status: 500 });
        }

        const authHeader = req.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '').trim();
        const supabase = createClient(supabaseAuthUrl, supabaseAuthAnonKey, {
            auth: { persistSession: false },
            global: {
                headers: { Authorization: `Bearer ${token}` }
            }
        });

        // 1. Verify user authentication
        const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !user) {
            return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const { classroomId } = body;

        if (!classroomId) {
            return NextResponse.json({ error: 'Missing classroomId' }, { status: 400 });
        }

        // 2. Fetch classroom details (server-side query)
        const { data: classroom, error: classErr } = await supabase
            .from('classrooms')
            .select('id, name, type, is_live, live_meeting_link, live_session_started_at, status, description')
            .eq('id', classroomId)
            .maybeSingle();

        if (classErr || !classroom) {
            return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
        }

        // 3. Fetch student profile
        const { data: student, error: studentErr } = await supabase
            .from('users')
            .select('id, role, status, fees_basis, fees_classes_paid, fees_amount, fees_collection_date, join_date')
            .eq('id', user.id)
            .maybeSingle();

        if (studentErr || !student) {
            return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
        }

        // Resolve effective meeting link: session-specific link takes precedence over reusable classroom link
        let reusableLink: string | null = null;
        if (classroom.description) {
            const meetMatch = classroom.description.match(/\[meeting_link:(https?:\/\/[^\s\]]+)\]/i);
            if (meetMatch) {
                reusableLink = meetMatch[1].trim();
            }
        }
        const effectiveLink = classroom.live_meeting_link || reusableLink || null;

        // Teachers, admins, and mentors bypass student lifecycle and fee checks
        if (student.role === 'admin' || student.role === 'teacher' || student.role === 'mentor') {
            return NextResponse.json({
                canJoinLiveClass: true,
                liveMeetingLink: effectiveLink,
                classroomName: classroom.name,
                financialState: 'GOOD_STANDING',
                effectiveBalance: 999
            });
        }

        // 4. Lifecycle security check: Paused (inactive) and archived students cannot access live classes
        const studentStatus = (student.status || 'active').toLowerCase().trim();
        if (studentStatus !== 'active') {
            return NextResponse.json({
                canJoinLiveClass: false,
                error: studentStatus === 'inactive'
                    ? 'Your learning is currently paused. Please contact academy administration to resume live class participation.'
                    : 'Your account is archived. Live class participation is not available.',
                liveMeetingLink: null,
                classroomName: classroom.name,
                financialState: 'RESTRICTED',
                effectiveBalance: 0
            }, { status: 403 });
        }

        // 5. Enrollment security check: Ensure the student is enrolled in this classroom or has an active override
        const [enrollmentRes, overrideRes] = await Promise.all([
            supabase
                .from('classroom_students')
                .select('id')
                .eq('classroom_id', classroomId)
                .eq('student_id', user.id)
                .maybeSingle(),
            supabase
                .from('session_student_overrides')
                .select('id')
                .eq('target_classroom_id', classroomId)
                .eq('student_id', user.id)
                .limit(1)
        ]);

        const isEnrolled = Boolean(enrollmentRes.data || (overrideRes.data && overrideRes.data.length > 0));
        if (!isEnrolled) {
            return NextResponse.json({
                canJoinLiveClass: false,
                error: 'You are not enrolled in this classroom.',
                liveMeetingLink: null,
                classroomName: classroom.name,
                financialState: 'NOT_ENROLLED',
                effectiveBalance: 0
            }, { status: 403 });
        }

        // 6. Concurrently fetch student's payments, attendance, overrides, and leaves for authoritative status
        const [paymentsRes, attendanceRes, overridesRes, leavesRes] = await Promise.all([
            supabase.from('fees_payments').select('*').eq('student_id', user.id),
            supabase.from('attendance').select('*').eq('student_id', user.id),
            supabase.from('session_student_overrides').select('*').eq('student_id', user.id),
            supabase.from('leave_requests').select('*').eq('student_id', user.id).eq('status', 'approved')
        ]);

        const authStatus = calculateAuthoritativeFeeStatus({
            studentId: user.id,
            student,
            payments: paymentsRes.data || [],
            attendance: attendanceRes.data || [],
            overrides: overridesRes.data || [],
            leaveRequests: leavesRes.data || [],
            today: new Date()
        });

        // 7. Check live class access eligibility based on financial standing
        if (!authStatus.canJoinLiveClass) {
            // Balance < 0: Restrict access with HTTP 403 and redact meeting link
            return NextResponse.json({
                canJoinLiveClass: false,
                error: 'Your fee payment is pending. Please complete your fee payment to continue attending live classes.',
                liveMeetingLink: null,
                classroomName: classroom.name,
                financialState: authStatus.financialState,
                effectiveBalance: authStatus.effectiveBalance
            }, { status: 403 });
        }

        // Balance >= 0: Authorized to join live class
        return NextResponse.json({
            canJoinLiveClass: true,
            liveMeetingLink: effectiveLink,
            classroomName: classroom.name,
            financialState: authStatus.financialState,
            effectiveBalance: authStatus.effectiveBalance
        });
    } catch (err: any) {
        console.error('[live-access API] Error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
