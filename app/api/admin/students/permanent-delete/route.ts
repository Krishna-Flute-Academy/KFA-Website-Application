import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getEnvVariable(key: string): string {
    return process.env[key] || '';
}

function isMissingTableError(error: any): boolean {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    const code = error.code || '';
    return (
        code === 'PGRST205' ||
        code === '42P01' ||
        msg.includes('does not exist') ||
        msg.includes('schema cache') ||
        msg.includes('could not find the table')
    );
}

async function authenticateAdminOrTeacher(req: Request) {
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

    if (dbErr || !dbUser || (dbUser.role !== 'admin' && dbUser.role !== 'teacher')) {
        return { error: 'Forbidden: Admin or Teacher access required', status: 403 as const };
    }

    const serviceClient = createClient(supabaseAuthUrl, supabaseServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    return { callerId: dbUser.id, callerRole: dbUser.role, serviceClient };
}

export async function POST(req: Request) {
    try {
        const authResult = await authenticateAdminOrTeacher(req);
        if ('error' in authResult) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status });
        }

        const { callerId, serviceClient } = authResult;
        const body = await req.json();
        const rawIds: unknown = body?.studentIds;

        if (!Array.isArray(rawIds) || rawIds.length === 0) {
            return NextResponse.json({ error: 'studentIds must be a non-empty array' }, { status: 400 });
        }

        const validUuids: string[] = [];
        const nonUuidIds: string[] = [];

        for (const item of rawIds) {
            if (typeof item === 'string') {
                if (UUID_REGEX.test(item)) {
                    validUuids.push(item);
                } else {
                    nonUuidIds.push(item);
                }
            }
        }

        const studentIds = Array.from(new Set(validUuids));
        // Non-UUID items cannot exist in Postgres UUID columns; mark them as pruned immediately
        const deletedIds: string[] = Array.from(new Set(nonUuidIds));
        const failed: Array<{ id: string; reason: string }> = [];

        for (const studentId of studentIds) {
            if (studentId === callerId) {
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

                // 1. Try atomic RPC purge first
                const { error: rpcError } = await serviceClient.rpc('purge_student_permanently', {
                    p_student_id: studentId,
                });

                if (rpcError) {
                    console.warn(`RPC purge_student_permanently error for ${studentId}, falling back to manual:`, rpcError.message);

                    // Manual fallback: clean known restrictive tables safely
                    const candidateTables = [
                        { table: 'attendance_correction_audit_logs', column: 'student_id' },
                        { table: 'leave_correction_audit_logs', column: 'student_id' },
                        { table: 'credit_ledger_transactions', column: 'student_id' },
                        { table: 'historical_balance_reconciliations', column: 'student_id' },
                        { table: 'community_profiles', column: 'id' },
                    ];

                    for (const { table, column } of candidateTables) {
                        const { error } = await serviceClient.from(table).delete().eq(column, studentId);
                        if (error && !isMissingTableError(error)) {
                            console.warn(`Warning deleting from ${table}:`, error.message);
                        }
                    }

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
                }

                // 2. Delete Supabase Auth user (auth.users) so they can re-register freshly
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

        return NextResponse.json({ deletedIds, failed }, { status: 200 });
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
