'use client';

import React, { useEffect, useState } from 'react';
import { supabaseAuth } from '../../../lib/supabase-auth';
import { History, X, AlertCircle, Calendar, Clock, User, Shield } from 'lucide-react';

interface HolidayAuditHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    classroomId: string;
    classroomName: string;
}

interface HolidayAuditLog {
    id: string;
    holiday_id: string;
    classroom_id: string;
    holiday_date: string;
    action: 'declared' | 'modified' | 'cancelled';
    holiday_type: 'with_alternative' | 'no_alternative';
    alternative_date: string | null;
    actor_id: string;
    actor_role: string;
    reason: string;
    created_at: string;
    users?: {
        name: string;
        email: string;
    };
}

export default function HolidayAuditHistoryModal({
    isOpen,
    onClose,
    classroomId,
    classroomName
}: HolidayAuditHistoryModalProps) {
    const [logs, setLogs] = useState<HolidayAuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        async function fetchLogs() {
            setLoading(true);
            setError(null);
            try {
                const { data, error: fetchErr } = await supabaseAuth
                    .from('classroom_holiday_audit_logs')
                    .select(`
                        id,
                        holiday_id,
                        classroom_id,
                        holiday_date,
                        action,
                        holiday_type,
                        alternative_date,
                        actor_id,
                        actor_role,
                        reason,
                        created_at,
                        users!actor_id(name, email)
                    `)
                    .eq('classroom_id', classroomId)
                    .order('created_at', { ascending: false });

                if (fetchErr) throw fetchErr;
                setLogs((data as any) || []);
            } catch (err: any) {
                console.error('Error fetching holiday audit logs:', err);
                setError(err?.message || 'Failed to load holiday audit history.');
            } finally {
                setLoading(false);
            }
        }

        fetchLogs();
    }, [isOpen, classroomId]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-slate-800 to-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                            <History className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg leading-tight">Holiday Audit Trail (BR-24)</h3>
                            <p className="text-xs text-slate-300 mt-0.5">{classroomName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-4">
                    {loading && (
                        <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
                            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm">Loading audit records...</p>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-3 text-rose-700 dark:text-rose-300 text-sm">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {!loading && !error && logs.length === 0 && (
                        <div className="py-12 text-center text-slate-400">
                            <Shield className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                            <p className="text-sm font-medium">No holiday audit records found for this classroom.</p>
                            <p className="text-xs text-slate-500 mt-1">Audit logs are recorded automatically when holidays are declared or cancelled.</p>
                        </div>
                    )}

                    {!loading && !error && logs.length > 0 && (
                        <div className="space-y-3">
                            {logs.map((log) => {
                                const isDeclared = log.action === 'declared';
                                return (
                                    <div
                                        key={log.id}
                                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2.5 transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                                                        isDeclared
                                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                                    }`}
                                                >
                                                    {log.action}
                                                </span>
                                                <span className="text-sm font-bold text-slate-900 dark:text-white">
                                                    Holiday Date: {log.holiday_date}
                                                </span>
                                            </div>
                                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                                <Clock className="w-3.5 h-3.5" />
                                                {new Date(log.created_at).toLocaleString()}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
                                            <div>
                                                <span className="font-semibold text-slate-700 dark:text-slate-300">Type: </span>
                                                {log.holiday_type === 'with_alternative' ? 'With Alternative Class' : 'No Alternative'}
                                            </div>
                                            {log.alternative_date && (
                                                <div>
                                                    <span className="font-semibold text-slate-700 dark:text-slate-300">Alternative Date: </span>
                                                    {log.alternative_date}
                                                </div>
                                            )}
                                        </div>

                                        <div className="text-xs bg-white dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800/60">
                                            <span className="font-semibold text-slate-700 dark:text-slate-300">Reason: </span>
                                            <span className="text-slate-600 dark:text-slate-400">{log.reason}</span>
                                        </div>

                                        <div className="flex items-center gap-2 text-xs text-slate-500 pt-0.5">
                                            <User className="w-3.5 h-3.5" />
                                            <span>
                                                Actor: {log.users?.name || 'Authorized Staff'} ({log.actor_role})
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                    <span>Audit trail records are strictly immutable and append-only.</span>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
