import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getEnv(key: string): string {
    return process.env[key] || '';
}

const supabaseAuthUrl = getEnv('NEXT_PUBLIC_AUTH_SUPABASE_URL') || getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getEnv('NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY') || getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const supabaseServiceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

function getExpectedCronSecrets(): string[] {
    return [
        process.env.CRON_SECRET,
        process.env.INTERNAL_SCHEDULER_SECRET,
        // Explicit local-test-only mechanism, disabled by default.
        // Strictly requires ENABLE_LOCAL_TEST_SCHEDULER_SECRET='true' AND non-production environment.
        // In staging and production (NODE_ENV === 'production'), this fallback is never evaluated or accepted under any circumstances.
        process.env.NODE_ENV !== 'production' && process.env.ENABLE_LOCAL_TEST_SCHEDULER_SECRET === 'true'
            ? (process.env.LOCAL_TEST_SCHEDULER_SECRET || 'kfa_local_scheduler_secret_2026')
            : undefined
    ].filter(Boolean) as string[];
}

/**
 * Validates request authorization:
 * 1. Checks if request contains valid CRON_SECRET / INTERNAL_SCHEDULER_SECRET
 * 2. Or checks if request contains a valid Bearer token for an Admin / Teacher
 */
async function authenticateDispatcherRequest(req: Request): Promise<{
    authorized: boolean;
    client: any | null;
    errorStatus?: number;
    errorMessage?: string;
}> {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const cronSecretHeader = req.headers.get('x-cron-secret');

    let bearerToken: string | null = null;
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        bearerToken = authHeader.slice(7).trim();
    }

    // A. Check for Scheduler / Cron Secret
    const expectedSecrets = getExpectedCronSecrets();
    const isSecretAuthorized = (
        (bearerToken && expectedSecrets.includes(bearerToken)) ||
        (cronSecretHeader && expectedSecrets.includes(cronSecretHeader))
    );

    if (isSecretAuthorized) {
        if (!supabaseAuthUrl) {
            return { authorized: false, client: null, errorStatus: 500, errorMessage: 'Missing Supabase Auth URL' };
        }
        const serviceKey = supabaseServiceRoleKey || supabaseAnonKey;
        const client = createClient(supabaseAuthUrl, serviceKey, {
            auth: { persistSession: false },
            global: {
                headers: serviceKey ? { Authorization: `Bearer ${serviceKey}` } : {}
            }
        });
        return { authorized: true, client };
    }

    // B. Check for Admin or Teacher Bearer Token
    if (bearerToken && supabaseAuthUrl && supabaseAnonKey) {
        const client = createClient(supabaseAuthUrl, supabaseAnonKey, {
            auth: { persistSession: false },
            global: {
                headers: { Authorization: `Bearer ${bearerToken}` }
            }
        });

        const { data: { user }, error: userErr } = await client.auth.getUser(bearerToken);
        if (!userErr && user) {
            const role = user.app_metadata?.role || user.user_metadata?.role;
            if (role === 'admin' || role === 'teacher') {
                return { authorized: true, client };
            }

            // Also check users table in case role is stored in table
            const { data: profile } = await client
                .from('users')
                .select('role')
                .eq('id', user.id)
                .maybeSingle();

            if (profile?.role === 'admin' || profile?.role === 'teacher') {
                return { authorized: true, client };
            }

            return {
                authorized: false,
                client: null,
                errorStatus: 403,
                errorMessage: 'Forbidden: Insufficient privileges to dispatch reminders'
            };
        }
    }

    return {
        authorized: false,
        client: null,
        errorStatus: 401,
        errorMessage: 'Unauthorized: Missing or invalid scheduler/staff credentials'
    };
}

/**
 * API route to dispatch scheduled makeup reminders, expiries, and fee reminders.
 * Can be triggered via cron job or internal administrative maintenance.
 */
export async function POST(req: Request) {
    try {
        const authResult = await authenticateDispatcherRequest(req);
        if (!authResult.authorized || !authResult.client) {
            return NextResponse.json(
                { error: authResult.errorMessage || 'Unauthorized' },
                { status: authResult.errorStatus || 401 }
            );
        }

        const supabase = authResult.client;

        let referenceDate: string | null = null;
        try {
            const body = await req.json();
            if (body?.referenceDate) {
                referenceDate = body.referenceDate;
            }
        } catch {
            // Optional body
        }

        const args = referenceDate ? { p_reference_date: referenceDate } : {};

        // 1. Dispatch makeup reminders (7d, 1d) & expiries
        const { data: makeupRes, error: makeupErr } = await supabase.rpc(
            'dispatch_makeup_reminders_and_expiry',
            args
        );

        if (makeupErr) {
            console.error('[dispatch-reminders] Error in makeup dispatcher:', makeupErr);
        }

        // 2. Dispatch fee due & overdue reminders
        const { data: feeRes, error: feeErr } = await supabase.rpc(
            'dispatch_fee_reminders',
            args
        );

        if (feeErr) {
            console.error('[dispatch-reminders] Error in fee dispatcher:', feeErr);
        }

        const hasError = !!makeupErr || !!feeErr;

        return NextResponse.json({
            success: !hasError,
            makeup: makeupRes,
            fee: feeRes,
            errors: {
                makeup: makeupErr?.message || null,
                fee: feeErr?.message || null
            }
        }, { status: hasError ? 500 : 200 });
    } catch (err: any) {
        console.error('[dispatch-reminders] Unhandled error:', err);
        return NextResponse.json(
            { error: 'Internal Server Error', details: err?.message || err },
            { status: 500 }
        );
    }
}

export async function GET(req: Request) {
    return POST(req);
}
