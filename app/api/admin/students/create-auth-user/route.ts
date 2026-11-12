import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getEnvVariable(key: string): string {
    return process.env[key] || '';
}

async function authenticateStaff(req: Request) {
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
        return { error: 'Forbidden: Teacher or Admin access required', status: 403 as const };
    }

    const serviceClient = createClient(supabaseAuthUrl, supabaseServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    return { staffId: dbUser.id, serviceClient };
}

export async function POST(req: Request) {
    try {
        const authResult = await authenticateStaff(req);
        if ('error' in authResult) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status });
        }

        const { serviceClient } = authResult;
        const body = await req.json();
        const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
        const password = typeof body?.password === 'string' ? body.password : '';
        const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';
        const phone = typeof body?.phone === 'string' && body.phone.trim() ? body.phone.trim() : null;

        if (!email || !password || !fullName) {
            return NextResponse.json(
                { error: 'Missing required fields: email, password, fullName' },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return NextResponse.json(
                { error: 'Temporary password must be at least 6 characters.' },
                { status: 400 }
            );
        }

        // Pre-confirm email so there is no 1-hour verification link expiry;
        // student logs in directly with the temporary password and is forced to change it.
        const { data, error } = await serviceClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: fullName,
                phone,
                must_change_password: true,
            },
        });

        if (error) {
            const msg = error.message || 'Failed to create authentication account';
            const isDuplicate =
                error.status === 422 ||
                msg.toLowerCase().includes('already') ||
                msg.toLowerCase().includes('registered');
            return NextResponse.json(
                { error: isDuplicate ? `An authentication account with ${email} already exists.` : msg },
                { status: isDuplicate ? 409 : 400 }
            );
        }

        if (!data?.user?.id) {
            return NextResponse.json({ error: 'Auth user creation returned no user ID' }, { status: 500 });
        }

        return NextResponse.json({ userId: data.user.id });
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function DELETE(req: Request) {
    try {
        const authResult = await authenticateStaff(req);
        if ('error' in authResult) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status });
        }

        const { serviceClient } = authResult;
        const body = await req.json();
        const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        // Only allow rollback deletion if no public.users profile exists yet
        const { data: existingProfile } = await serviceClient
            .from('users')
            .select('id')
            .eq('id', userId)
            .maybeSingle();

        if (existingProfile) {
            return NextResponse.json(
                { error: 'Cannot roll back an auth user that already has a profile' },
                { status: 409 }
            );
        }

        const { error } = await serviceClient.auth.admin.deleteUser(userId);
        if (error && error.status !== 404) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ rolledBack: true });
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
