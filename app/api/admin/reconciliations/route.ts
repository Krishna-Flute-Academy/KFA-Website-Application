import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateReconciliationProposal, isProposalStale, computeEvidenceHash } from '../../../../src/lib/reconciliation-engine';

export const dynamic = 'force-dynamic';

function getEnvVariable(key: string): string {
    return process.env[key] || '';
}

const supabaseAuthUrl = getEnvVariable('NEXT_PUBLIC_AUTH_SUPABASE_URL');
const supabaseAuthAnonKey = getEnvVariable('NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY');
const supabaseServiceKey = getEnvVariable('SUPABASE_SERVICE_ROLE_KEY');

// Feature Flag Guard: Disabled by default in production
function isFeatureEnabled(): boolean {
    return process.env.NEXT_PUBLIC_ENABLE_HISTORICAL_RECONCILIATION_UI === 'true';
}

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

/**
 * GET: Lists historical balance reconciliations with fresh evidence staleness evaluation
 */
export async function GET(req: Request) {
    try {
        if (!isFeatureEnabled()) {
            return NextResponse.json({ error: 'Historical reconciliation interface is disabled' }, { status: 404 });
        }

        const authResult = await authenticateStaff(req);
        if ('error' in authResult) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status });
        }

        const { serviceClient } = authResult;
        const { searchParams } = new URL(req.url);
        const statusFilter = searchParams.get('status');

        let query = serviceClient
            .from('historical_balance_reconciliations')
            .select(`
                *,
                student:users!student_id(id, name, email, fees_classes_paid, fees_basis, fees_amount),
                approver:users!approver_id(id, name, email),
                reviewer:users!reviewed_by(id, name, email)
            `)
            .order('requested_at', { ascending: false });

        if (statusFilter) {
            query = query.eq('status', statusFilter);
        }

        const { data: reconciliations, error: fetchErr } = await query;
        if (fetchErr) {
            return NextResponse.json({ error: fetchErr.message }, { status: 500 });
        }

        return NextResponse.json({ reconciliations: reconciliations || [] }, { status: 200 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST: Performs administrative Approve or Reject action on a reconciliation proposal
 */
export async function POST(req: Request) {
    try {
        if (!isFeatureEnabled()) {
            return NextResponse.json({ error: 'Historical reconciliation interface is disabled' }, { status: 404 });
        }

        const authResult = await authenticateStaff(req);
        if ('error' in authResult) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status });
        }

        const { staffUser, serviceClient } = authResult;
        const body = await req.json();
        const { proposalId, action, rejectionReason, reviewNotes, confirmed } = body;

        if (!proposalId || !action) {
            return NextResponse.json({ error: 'Missing required fields: proposalId and action' }, { status: 400 });
        }

        if (action !== 'approve' && action !== 'reject') {
            return NextResponse.json({ error: 'Invalid action. Must be "approve" or "reject".' }, { status: 400 });
        }

        // Fetch the target proposal
        const { data: proposal, error: propErr } = await serviceClient
            .from('historical_balance_reconciliations')
            .select('*')
            .eq('id', proposalId)
            .single();

        if (propErr || !proposal) {
            return NextResponse.json({ error: 'Reconciliation proposal not found' }, { status: 404 });
        }

        if (proposal.status !== 'pending') {
            return NextResponse.json({
                error: `Cannot ${action} proposal in "${proposal.status}" status. Only pending proposals can be reviewed.`
            }, { status: 409 });
        }

        const now = new Date().toISOString();
        const auditHistory = Array.isArray(proposal.audit_history) ? [...proposal.audit_history] : [];

        if (action === 'reject') {
            if (!rejectionReason || typeof rejectionReason !== 'string' || rejectionReason.trim().length === 0) {
                return NextResponse.json({ error: 'Rejection reason is mandatory when rejecting a proposal.' }, { status: 400 });
            }

            auditHistory.push({
                action: 'rejected',
                timestamp: now,
                user_id: staffUser.id,
                notes: rejectionReason.trim()
            });

            const { error: updateErr } = await serviceClient
                .from('historical_balance_reconciliations')
                .update({
                    status: 'rejected',
                    rejection_reason: rejectionReason.trim(),
                    rejected_at: now,
                    reviewed_by: staffUser.id,
                    reviewed_at: now,
                    review_notes: reviewNotes || null,
                    audit_history: auditHistory
                })
                .eq('id', proposalId);

            if (updateErr) {
                return NextResponse.json({ error: updateErr.message }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                message: 'Reconciliation proposal successfully rejected. It will not be applied.',
                proposalId,
                status: 'rejected'
            });
        }

        // Action: APPROVE
        if (!confirmed) {
            return NextResponse.json({
                error: 'Explicit confirmation is required to approve a reconciliation proposal.'
            }, { status: 400 });
        }

        // Check 1: Invariant — A student must not have multiple simultaneously applicable approved proposals
        const { data: existingApproved } = await serviceClient
            .from('historical_balance_reconciliations')
            .select('id')
            .eq('student_id', proposal.student_id)
            .eq('status', 'approved')
            .neq('id', proposalId)
            .maybeSingle();

        if (existingApproved) {
            return NextResponse.json({
                error: 'Conflict: This student already has an active approved reconciliation proposal.'
            }, { status: 409 });
        }

        // Check 2: Staleness check against underlying fresh records
        const { data: student } = await serviceClient.from('users').select('*').eq('id', proposal.student_id).single();
        const { data: payments } = await serviceClient.from('fees_payments').select('*').eq('student_id', proposal.student_id);
        const { data: attendance } = await serviceClient.from('attendance').select('*').eq('student_id', proposal.student_id);
        const { data: leaves } = await serviceClient.from('leave_requests').select('*').eq('student_id', proposal.student_id);
        const { data: overrides } = await serviceClient.from('session_student_overrides').select('*').eq('student_id', proposal.student_id);

        const freshProposal = generateReconciliationProposal({
            student,
            payments: payments || [],
            attendance: attendance || [],
            leaves: leaves || [],
            overrides: overrides || []
        });

        if (proposal.evidence_hash && freshProposal.evidence_hash !== proposal.evidence_hash) {
            // Underlying data changed since proposal creation -> Mark proposal stale!
            auditHistory.push({
                action: 'marked_stale',
                timestamp: now,
                user_id: staffUser.id,
                notes: 'Evidence hash mismatch: Underlying payment or attendance records changed. Marked stale for re-review.'
            });

            await serviceClient
                .from('historical_balance_reconciliations')
                .update({
                    status: 'stale',
                    audit_history: auditHistory
                })
                .eq('id', proposalId);

            return NextResponse.json({
                error: 'Proposal is stale: Underlying attendance or payment evidence has changed since proposal creation. The proposal has been marked STALE and requires re-review.',
                stale: true
            }, { status: 409 });
        }

        // Apply Administrative Approval
        // MANDATORY SAFETY RULE: NO live balance changes in Phase 2B.2A
        // users.fees_classes_paid is NOT touched.
        // credit_ledger_transactions is NOT touched.
        auditHistory.push({
            action: 'approved',
            timestamp: now,
            user_id: staffUser.id,
            notes: `Administrative approval by ${staffUser.name} (${staffUser.email}). Proposed balance: ${proposal.proposed_balance}. No financial cutover performed.`
        });

        const { error: approveErr } = await serviceClient
            .from('historical_balance_reconciliations')
            .update({
                status: 'approved',
                approver_id: staffUser.id,
                approved_at: now,
                reviewed_by: staffUser.id,
                reviewed_at: now,
                review_notes: reviewNotes || null,
                audit_history: auditHistory
            })
            .eq('id', proposalId);

        if (approveErr) {
            return NextResponse.json({ error: approveErr.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Reconciliation proposal approved administratively. Note: Approval is administrative only; live student balance and credit ledger remain unchanged in Phase 2B.2A.',
            proposalId,
            status: 'approved',
            proposed_balance: proposal.proposed_balance,
            live_balance_unmodified: true
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
