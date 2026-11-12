import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getEnvVariable(key: string): string {
    return process.env[key] || '';
}

async function authenticateAdmin(req: Request) {
    const supabaseAuthUrl = getEnvVariable('NEXT_PUBLIC_AUTH_SUPABASE_URL');
    const supabaseAuthAnonKey = getEnvVariable('NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY');
    const supabaseServiceKey = getEnvVariable('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseAuthUrl || !supabaseAuthAnonKey || !supabaseServiceKey) {
        return { error: 'Server auth or service role configuration missing', status: 500 as const };
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { error: 'Unauthorized: Missing bearer token', status: 401 as const };
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const authClient = createClient(supabaseAuthUrl, supabaseAuthAnonKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !user) {
        return { error: 'Unauthorized: Invalid token', status: 401 as const };
    }

    const { data: dbUser, error: dbErr } = await authClient
        .from('users')
        .select('id, role')
        .eq('id', user.id)
        .single();

    if (dbErr || !dbUser || dbUser.role !== 'admin') {
        return { error: 'Forbidden: Admin access required', status: 403 as const };
    }

    const serviceClient = createClient(supabaseAuthUrl, supabaseServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    return { adminId: dbUser.id, serviceClient };
}

export async function POST(req: Request) {
    try {
        const authResult = await authenticateAdmin(req);
        if ('error' in authResult) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status });
        }

        const { adminId, serviceClient } = authResult;
        const body = await req.json();
        const rawIds: unknown = body?.studentIds;

        if (!Array.isArray(rawIds) || rawIds.length === 0) {
            return NextResponse.json({ error: 'studentIds must be a non-empty array' }, { status: 400 });
        }

        const studentIds = Array.from(
            new Set(
                rawIds.filter((id): id is string => typeof id === 'string' && UUID_REGEX.test(id))
            )
        );

        if (studentIds.length === 0) {
            return NextResponse.json({ error: 'No valid student UUIDs provided' }, { status: 400 });
        }

        const deletedIds: string[] = [];
        const failed: Array<{ id: string; reason: string }> = [];

        for (const studentId of studentIds) {
            if (studentId === adminId) {
                failed.push({ id: studentId, reason: 'Cannot permanently delete your own account' });
                continue;
            }

            try {
                // Guard against deleting non-student accounts if public.users row still exists
                const { data: existingUser } = await serviceClient
                    .from('users')
                    .select('id, role')
                    .eq('id', studentId)
                    .maybeSingle();

                if (existingUser && (existingUser.role === 'admin' || existingUser.role === 'teacher')) {
                    failed.push({ id: studentId, reason: `Refused to delete ${existingUser.role} account` });
                    continue;
                }

                // 1. Clean up tables with ON DELETE RESTRICT / NO ACTION on student_id
                const restrictCleanupTables = [
                    { table: 'student_credit_ledger', column: 'student_id' },
                    { table: 'payment_reconciliation_requests', column: 'student_id' },
                    { table: 'leave_audit_logs', column: 'student_id' },
                    { table: 'historical_attendance_audit', column: 'student_id' },
                    { table: 'community_profiles', column: 'id' },
                ];

                let cleanupError: string | null = null;
                for (const { table, column } of restrictCleanupTables) {
                    const { error } = await serviceClient.from(table).delete().eq(column, studentId);
                    if (error && !error.message.includes('does not exist')) {
                        cleanupError = `${table}: ${error.message}`;
                        break;
                    }
                }

                if (cleanupError) {
                    failed.push({ id: studentId, reason: cleanupError });
                    continue;
                }

                // 2. Delete public.users row (cascades ON DELETE CASCADE tables)
                if (existingUser) {
                    const { error: userDeleteErr } = await serviceClient
                        .from('users')
                        .delete()
                        .eq('id', studentId);

                    if (userDeleteErr) {
                        failed.push({ id: studentId, reason: userDeleteErr.message });
                        continue;
                    }
                }

                // 3. Delete Supabase Auth user (auth.users) so they can re-register/login freshly
                const { error: authDeleteErr } = await serviceClient.auth.admin.deleteUser(studentId);
                if (
                    authDeleteErr &&
                    authDeleteErr.status !== 404 &&
                    !authDeleteErr.message?.toLowerCase().includes('not found')
                ) {
                    failed.push({ id: studentId, reason: `Auth deletion failed: ${authDeleteErr.message}` });
                    continue;
                }

                deletedIds.push(studentId);
            } catch (err: any) {
                failed.push({ id: studentId, reason: err?.message || 'Unexpected error' });
            }
        }

        const status = deletedIds.length === 0 && failed.length > 0 ? 500 : 200;
        return NextResponse.json({ deletedIds, failed }, { status });
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
