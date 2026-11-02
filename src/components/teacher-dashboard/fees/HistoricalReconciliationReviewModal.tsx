'use client';

import React, { useState, useEffect } from 'react';
import { supabaseAuth } from '../../../lib/supabase-auth';
import { 
    AlertTriangle, CheckCircle2, XCircle, Clock, ShieldAlert, 
    ArrowRight, RefreshCw, Info, FileText, Check, X, Shield 
} from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function HistoricalReconciliationReviewModal({ isOpen, onClose }: Props) {
    const [proposals, setProposals] = useState<any[]>([]);
    const [selectedProposal, setSelectedProposal] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [actionModal, setActionModal] = useState<{ type: 'approve' | 'reject'; proposal: any } | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [reviewNotes, setReviewNotes] = useState('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const isEnabled = process.env.NEXT_PUBLIC_ENABLE_HISTORICAL_RECONCILIATION_UI === 'true';

    const fetchProposals = async () => {
        if (!isEnabled) return;
        setLoading(true);
        setErrorMsg(null);
        try {
            const { data: { session } } = await supabaseAuth.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('Not authenticated');

            const res = await fetch('/api/admin/reconciliations', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch reconciliations');

            setProposals(data.reconciliations || []);
            if (data.reconciliations?.length > 0 && !selectedProposal) {
                setSelectedProposal(data.reconciliations[0]);
            }
        } catch (err: any) {
            setErrorMsg(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && isEnabled) {
            fetchProposals();
        }
    }, [isOpen, isEnabled]);

    if (!isOpen) return null;

    if (!isEnabled) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-md w-full p-6 text-center shadow-2xl">
                    <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-2">Feature Not Enabled</h3>
                    <p className="text-sm text-stone-600 dark:text-stone-400 mb-6">
                        The Historical Reconciliation Review interface is currently disabled in this environment. It is guarded behind a staging feature flag.
                    </p>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-stone-800 dark:bg-stone-700 text-white rounded-lg text-sm font-medium hover:bg-stone-700 transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    const handleActionSubmit = async () => {
        if (!actionModal) return;
        setSubmitting(true);
        setErrorMsg(null);
        setSuccessMsg(null);

        try {
            const { data: { session } } = await supabaseAuth.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('Not authenticated');

            const body: any = {
                proposalId: actionModal.proposal.id,
                action: actionModal.type,
                reviewNotes
            };

            if (actionModal.type === 'approve') {
                body.confirmed = true;
            } else {
                if (!rejectionReason.trim()) {
                    throw new Error('Rejection reason is mandatory.');
                }
                body.rejectionReason = rejectionReason.trim();
            }

            const res = await fetch('/api/admin/reconciliations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Action failed');

            setSuccessMsg(data.message);
            setActionModal(null);
            setRejectionReason('');
            setReviewNotes('');
            await fetchProposals();
        } catch (err: any) {
            setErrorMsg(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-950/50 text-amber-600 rounded-lg">
                            <Shield className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                                    Historical Balance Reconciliation Review
                                </h2>
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                    Phase 2B.2A — Non-Financial
                                </span>
                            </div>
                            <p className="text-xs text-stone-500 dark:text-stone-400">
                                Review authoritative student balances computed from source payment and attendance records.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchProposals}
                            disabled={loading}
                            className="p-2 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition"
                            title="Refresh proposals"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Safety Banner */}
                <div className="px-5 py-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50 flex items-start gap-3">
                    <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div className="text-xs text-amber-900 dark:text-amber-200">
                        <span className="font-semibold">Safety Control Invariant:</span> Approvals in Phase 2B.2A are administrative reviews only. Approving a proposal validates its source evidence and audit calculation, but does <span className="underline font-bold">not</span> alter stored student balances, does not insert opening ledger records, and does not perform a financial cutover.
                    </div>
                </div>

                {/* Messages */}
                {errorMsg && (
                    <div className="mx-5 mt-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{errorMsg}</span>
                    </div>
                )}
                {successMsg && (
                    <div className="mx-5 mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-lg flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{successMsg}</span>
                    </div>
                )}

                {/* Body split */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Proposal List */}
                    <div className="w-1/3 border-r border-stone-200 dark:border-stone-800 overflow-y-auto p-4 space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">
                            Reconciliation Proposals ({proposals.length})
                        </div>
                        {proposals.length === 0 ? (
                            <div className="text-center py-8 text-stone-500 text-xs">
                                No proposals found.
                            </div>
                        ) : (
                            proposals.map(p => {
                                const isSelected = selectedProposal?.id === p.id;
                                const isPending = p.status === 'pending';
                                const isApproved = p.status === 'approved';
                                const isRejected = p.status === 'rejected';
                                const isStale = p.status === 'stale';

                                return (
                                    <div
                                        key={p.id}
                                        onClick={() => setSelectedProposal(p)}
                                        className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                                            isSelected
                                                ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                                                : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/50'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="font-semibold text-sm text-stone-900 dark:text-stone-100 truncate">
                                                {p.student?.name || 'Unknown Student'}
                                            </div>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                                isPending ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                                                isApproved ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                                                isRejected ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' :
                                                'bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-300'
                                            }`}>
                                                {p.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-400">
                                            <span>Current: <strong className="text-stone-800 dark:text-stone-200">{p.previous_balance}</strong></span>
                                            <ArrowRight className="w-3 h-3 text-stone-400" />
                                            <span>Proposed: <strong className="text-stone-800 dark:text-stone-200">{p.proposed_balance}</strong></span>
                                            <span className="ml-auto font-semibold text-emerald-600 dark:text-emerald-400">
                                                {p.difference > 0 ? `+${p.difference}` : p.difference}
                                            </span>
                                        </div>
                                        {p.supporting_evidence?.is_ambiguous && (
                                            <div className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                                <span>Requires Manual Review</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Proposal Details */}
                    <div className="flex-1 overflow-y-auto p-5">
                        {selectedProposal ? (
                            <div className="space-y-6">
                                {/* Top Overview Card */}
                                <div className="p-4 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-800">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                                                {selectedProposal.student?.name}
                                            </h3>
                                            <p className="text-xs text-stone-500">
                                                {selectedProposal.student?.email} • Student ID: {selectedProposal.student_id}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-medium text-stone-500">Proposal ID</span>
                                            <div className="font-mono text-xs text-stone-400">
                                                {selectedProposal.id?.substring(0, 8)}...
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3 pt-3 border-t border-stone-200 dark:border-stone-700 text-center">
                                        <div className="p-2 bg-white dark:bg-stone-800 rounded-lg">
                                            <div className="text-xs text-stone-500 font-medium">Stored Balance</div>
                                            <div className="text-lg font-bold text-stone-800 dark:text-stone-200">
                                                {selectedProposal.previous_balance} credits
                                            </div>
                                        </div>
                                        <div className="p-2 bg-white dark:bg-stone-800 rounded-lg">
                                            <div className="text-xs text-stone-500 font-medium">Authoritative Calculated</div>
                                            <div className="text-lg font-bold text-stone-900 dark:text-stone-100">
                                                {selectedProposal.proposed_balance} credits
                                            </div>
                                        </div>
                                        <div className="p-2 bg-white dark:bg-stone-800 rounded-lg">
                                            <div className="text-xs text-stone-500 font-medium">Proposed Delta</div>
                                            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                                {selectedProposal.difference > 0 ? `+${selectedProposal.difference}` : selectedProposal.difference} credits
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Calculation Explanation */}
                                <div>
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2 flex items-center gap-1.5">
                                        <FileText className="w-3.5 h-3.5" />
                                        Calculation Rationale
                                    </h4>
                                    <div className="p-3 bg-stone-50 dark:bg-stone-800/30 rounded-lg border border-stone-200 dark:border-stone-800 text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
                                        {selectedProposal.reconciliation_reason}
                                    </div>
                                </div>

                                {/* Ambiguity Warning */}
                                {selectedProposal.supporting_evidence?.is_ambiguous && (
                                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-lg text-xs text-amber-900 dark:text-amber-200">
                                        <div className="font-semibold flex items-center gap-1.5 mb-1">
                                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                            Manual Review Consideration (Rule 11)
                                        </div>
                                        <p>{selectedProposal.supporting_evidence.ambiguity_reason}</p>
                                    </div>
                                )}

                                {/* Calculation Breakdown Steps */}
                                <div>
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">
                                        Source Evidence Breakdown ({selectedProposal.supporting_evidence?.calculation_breakdown?.length || 0} events)
                                    </h4>
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto border border-stone-200 dark:border-stone-800 rounded-lg p-2 bg-stone-50/50 dark:bg-stone-900/50">
                                        {selectedProposal.supporting_evidence?.calculation_breakdown?.map((item: string, idx: number) => (
                                            <div key={idx} className="text-xs font-mono text-stone-700 dark:text-stone-300 py-1 px-2 rounded bg-white dark:bg-stone-800/70 border border-stone-200/50 dark:border-stone-700/50">
                                                {item}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Audit Trail */}
                                <div>
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2 flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5" />
                                        Review & Audit History
                                    </h4>
                                    <div className="space-y-2">
                                        {selectedProposal.audit_history?.map((hist: any, idx: number) => (
                                            <div key={idx} className="text-xs text-stone-600 dark:text-stone-400 p-2.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/20 flex items-center justify-between">
                                                <div>
                                                    <span className="font-semibold uppercase text-stone-800 dark:text-stone-200 mr-2">
                                                        [{hist.action}]
                                                    </span>
                                                    <span>{hist.notes || 'No details'}</span>
                                                </div>
                                                <span className="text-[11px] text-stone-400 shrink-0 ml-3">
                                                    {new Date(hist.timestamp).toLocaleString()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Action Buttons for Pending Proposals */}
                                {selectedProposal.status === 'pending' && (
                                    <div className="pt-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end gap-3">
                                        <button
                                            onClick={() => setActionModal({ type: 'reject', proposal: selectedProposal })}
                                            className="px-4 py-2 border border-rose-300 text-rose-600 dark:border-rose-900/60 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg text-sm font-semibold transition flex items-center gap-1.5"
                                        >
                                            <XCircle className="w-4 h-4" />
                                            Reject Proposal
                                        </button>
                                        <button
                                            onClick={() => setActionModal({ type: 'approve', proposal: selectedProposal })}
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition flex items-center gap-1.5 shadow"
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                            Approve Proposal (Administrative)
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-20 text-stone-500 text-xs">
                                Select a proposal to inspect its calculation and evidence.
                            </div>
                        )}
                    </div>
                </div>

                {/* Approve/Reject Confirmation Modal */}
                {actionModal && (
                    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
                            <div className="flex items-center gap-3">
                                {actionModal.type === 'approve' ? (
                                    <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 rounded-lg">
                                        <CheckCircle2 className="w-6 h-6" />
                                    </div>
                                ) : (
                                    <div className="p-2 bg-rose-100 dark:bg-rose-950/60 text-rose-600 rounded-lg">
                                        <XCircle className="w-6 h-6" />
                                    </div>
                                )}
                                <div>
                                    <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                                        {actionModal.type === 'approve' ? 'Confirm Administrative Approval' : 'Reject Reconciliation Proposal'}
                                    </h3>
                                    <p className="text-xs text-stone-500">
                                        Student: {actionModal.proposal.student?.name}
                                    </p>
                                </div>
                            </div>

                            {actionModal.type === 'approve' ? (
                                <div className="space-y-3">
                                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg text-xs text-amber-900 dark:text-amber-200">
                                        <div className="font-semibold mb-1">Administrative Sign-Off Only:</div>
                                        Approving sets the authoritative balance baseline to <strong className="font-bold text-emerald-700 dark:text-emerald-300">{actionModal.proposal.proposed_balance} credits</strong>. This does NOT alter current student balances in Phase 2B.2A.
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                                            Review Notes (Optional)
                                        </label>
                                        <textarea
                                            value={reviewNotes}
                                            onChange={e => setReviewNotes(e.target.value)}
                                            placeholder="Add any verification observations or notes..."
                                            rows={2}
                                            className="w-full text-xs p-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="text-xs text-stone-600 dark:text-stone-400">
                                        Please provide a mandatory reason for rejecting this proposal. Rejected proposals will never be applied to the financial ledger.
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1">
                                            Rejection Reason (Required) *
                                        </label>
                                        <textarea
                                            value={rejectionReason}
                                            onChange={e => setRejectionReason(e.target.value)}
                                            placeholder="Explain why this proposal is rejected (e.g. pending offline cash receipt not recorded)..."
                                            rows={3}
                                            className="w-full text-xs p-2.5 rounded-lg border border-rose-300 dark:border-rose-900/60 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200 dark:border-stone-800">
                                <button
                                    onClick={() => setActionModal(null)}
                                    disabled={submitting}
                                    className="px-4 py-2 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 rounded-lg text-xs font-semibold hover:bg-stone-100 dark:hover:bg-stone-800 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleActionSubmit}
                                    disabled={submitting || (actionModal.type === 'reject' && !rejectionReason.trim())}
                                    className={`px-4 py-2 rounded-lg text-xs font-semibold text-white transition flex items-center gap-1.5 shadow ${
                                        actionModal.type === 'approve'
                                            ? 'bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50'
                                            : 'bg-rose-600 hover:bg-rose-700 disabled:opacity-50'
                                    }`}
                                >
                                    {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                    {actionModal.type === 'approve' ? 'Confirm & Approve' : 'Confirm Rejection'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
