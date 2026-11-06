import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateAuthoritativeFeeStatus } from '../../../../../src/lib/fee-utils';

export const dynamic = 'force-dynamic';

function getEnvVariable(key: string): string {
    return process.env[key] || '';
}

const supabaseAuthUrl = getEnvVariable('NEXT_PUBLIC_AUTH_SUPABASE_URL');
const supabaseAuthAnonKey = getEnvVariable('NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY');
const supabaseServiceKey = getEnvVariable('SUPABASE_SERVICE_ROLE_KEY');

async function authenticateStaff(req: Request) {
    if (!supabaseAuthUrl || !supabaseAuthAnonKey) {
        throw new Error('Server auth configuration missing');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { error: 'Unauthorized: Missing bearer token', status: 401 };
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const authClient = createClient(supabaseAuthUrl, supabaseAuthAnonKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !user) {
        return { error: 'Unauthorized: Invalid token', status: 401 };
    }

    // Always fetch profile with authClient so RLS evaluates in caller's authenticated context
    const { data: dbUser, error: dbErr } = await authClient
        .from('users')
        .select('id, name, email, role')
        .eq('id', user.id)
        .single();

    if (dbErr || !dbUser || (dbUser.role !== 'admin' && dbUser.role !== 'teacher')) {
        const userEmail = dbUser?.email || user.email || 'unknown';
        const userRole = dbUser?.role || 'none';
        return { 
            error: `Forbidden: Insufficient privileges. Teacher or Admin access required. (Logged in as: ${userEmail}, detected role: '${userRole}')`, 
            status: 403 
        };
    }

    // Prefer serviceClient if service key is configured; otherwise fall back to authenticated staff client
    const serviceClient = supabaseServiceKey
        ? createClient(supabaseAuthUrl, supabaseServiceKey)
        : authClient;

    return { staffUser: dbUser, serviceClient };
}

export async function POST(req: Request) {
    try {
        const authResult = await authenticateStaff(req);
        if ('error' in authResult) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status });
        }

        const { staffUser, serviceClient } = authResult;
        const body = await req.json();
        const { studentId, type, classesCount, reason } = body;

        if (!studentId || !type || classesCount === undefined) {
            return NextResponse.json({ error: 'Missing required parameters: studentId, type, classesCount' }, { status: 400 });
        }

        if (type !== 'credit' && type !== 'debit') {
            return NextResponse.json({ error: 'Invalid adjustment type: must be "credit" or "debit"' }, { status: 400 });
        }

        const count = Math.abs(parseInt(classesCount, 10));
        if (isNaN(count) || count <= 0 || count > 50) {
            return NextResponse.json({ error: 'Invalid class count. Must be between 1 and 50.' }, { status: 400 });
        }

        const delta = type === 'credit' ? count : -count;

        // Fetch student
        const { data: student, error: studentErr } = await serviceClient
            .from('users')
            .select('id, name, email, fees_classes_paid, fees_basis, fees_amount')
            .eq('id', studentId)
            .single();

        if (studentErr || !student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        // Fetch student data for authoritative calculation
        const [
            { data: payments },
            { data: attendance },
            { data: overrides },
            { data: leaveRequests }
        ] = await Promise.all([
            serviceClient.from('fees_payments').select('*').eq('student_id', studentId),
            serviceClient.from('attendance').select('*').eq('student_id', studentId),
            serviceClient.from('session_student_overrides').select('*').eq('student_id', studentId),
            serviceClient.from('leave_requests').select('*').eq('student_id', studentId)
        ]);

        const currentStatus = calculateAuthoritativeFeeStatus({
            studentId,
            student,
            payments: payments || [],
            attendance: attendance || [],
            overrides: overrides || [],
            leaveRequests: leaveRequests || [],
            today: new Date()
        });

        const newEffectiveBalance = Math.max(0, currentStatus.effectiveBalance + delta);
        const todayStr = new Date().toISOString().split('T')[0];
        const idempotencyKey = `adj-${studentId}-${Date.now()}`;
        const noteText = reason?.trim() 
            ? `Manual adjustment (${delta > 0 ? `+${delta}` : delta} classes): ${reason.trim()}` 
            : `Manual adjustment (${delta > 0 ? `+${delta}` : delta} classes)`;

        // 1. Insert adjustment payment record into fees_payments
        const { data: newPayment, error: payErr } = await serviceClient
            .from('fees_payments')
            .insert({
                student_id: studentId,
                amount: 0,
                payment_date: todayStr,
                payment_method: 'Adjustment',
                classes_added: delta,
                notes: noteText,
                idempotency_key: idempotencyKey,
                status: 'approved'
            })
            .select()
            .single();

        if (payErr) {
            return NextResponse.json({ error: `Failed to record adjustment payment: ${payErr.message}` }, { status: 500 });
        }

        // 2. Update users.fees_classes_paid so stored balance perfectly matches the authoritative balance
        const { error: userUpdateErr } = await serviceClient
            .from('users')
            .update({ fees_classes_paid: newEffectiveBalance })
            .eq('id', studentId);

        if (userUpdateErr) {
            return NextResponse.json({ error: `Failed to update student balance: ${userUpdateErr.message}` }, { status: 500 });
        }

        // 3. Insert into credit_ledger_transactions for immutable audit trail
        try {
            await serviceClient
                .from('credit_ledger_transactions')
                .insert({
                    student_id: studentId,
                    transaction_type: 'manual_reconciliation',
                    amount: delta,
                    balance_after: newEffectiveBalance,
                    reference_type: 'fees_payments',
                    reference_id: newPayment.id,
                    idempotency_key: idempotencyKey,
                    notes: noteText,
                    created_by: staffUser.id
                });
        } catch (ledgerErr) {
            console.warn('Could not write to credit_ledger_transactions:', ledgerErr);
        }

        return NextResponse.json({
            success: true,
            newBalance: newEffectiveBalance,
            delta,
            message: `Successfully adjusted balance for ${student.name} by ${delta > 0 ? `+${delta}` : delta} class(es). New balance: ${newEffectiveBalance}.`
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
