'use client';

import React, { useState, useEffect } from 'react';
import { 
    X, 
    History, 
    Calendar, 
    User, 
    School, 
    Clock, 
    Loader2, 
    Search,
    ShieldCheck,
    ArrowRight
} from 'lucide-react';
import { supabaseAuth } from '../../../lib/supabase-auth';

export interface AttendanceCorrectionHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    classroomId?: string;
    studentId?: string;
    classroomName?: string;
}

export function AttendanceCorrectionHistoryModal({
    isOpen,
    onClose,
    classroomId,
    studentId,
    classroomName
}: AttendanceCorrectionHistoryModalProps) {
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        const fetchHistory = async () => {
            setLoading(true);
            setError(null);
            try {
                const { data, error: rpcErr } = await supabaseAuth.rpc('get_attendance_correction_history', {
                    p_classroom_id: classroomId || null,
                    p_student_id: studentId || null,
                    p_limit: 100
                });

                if (rpcErr) throw rpcErr;
                if (isMounted) {
                    setHistory(Array.isArray(data) ? data : []);
                }
            } catch (err: any) {
                console.error('Error fetching correction audit history:', err);
                if (isMounted) setError(err.message || 'Failed to fetch correction audit history');
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchHistory();
        return () => { isMounted = false; };
    }, [isOpen, classroomId, studentId]);

    if (!isOpen) return null;

    const filtered = history.filter(item => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        return (
            (item.student_name && item.student_name.toLowerCase().includes(term)) ||
            (item.classroom_name && item.classroom_name.toLowerCase().includes(term)) ||
            (item.correction_reason && item.correction_reason.toLowerCase().includes(term)) ||
            (item.actor_name && item.actor_name.toLowerCase().includes(term))
        );
    });

    return (
        <div 
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-hidden"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150 overflow-hidden">
                
                {/* Header */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                Attendance Correction Audit Trail
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Immutable history of past attendance revisions and financial balance adjustments
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Filter by student, reason, or teacher..."
                            className="w-full text-xs pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                        />
                    </div>
                    <span className="text-xs font-semibold text-slate-400 shrink-0">
                        {filtered.length} entries
                    </span>
                </div>

                {/* History List */}
                <div className="p-4 overflow-y-auto space-y-3 flex-1">
                    {loading ? (
                        <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                            <span className="text-xs font-medium">Loading audit history...</span>
                        </div>
                    ) : error ? (
                        <div className="p-4 rounded-xl bg-rose-50 text-rose-700 text-xs font-medium">
                            {error}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 text-xs font-medium">
                            No attendance correction audit records found.
                        </div>
                    ) : (
                        filtered.map((item) => (
                            <div 
                                key={item.id}
                                className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs space-y-2 hover:border-amber-200 dark:hover:border-amber-900/50 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-900 dark:text-white">
                                            {item.student_name || 'Student'}
                                        </span>
                                        <span className="text-slate-400">•</span>
                                        <span className="text-slate-600 dark:text-slate-300 font-medium">
                                            {item.classroom_name || 'Classroom'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 font-bold">
                                        <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                            {item.previous_status}
                                        </span>
                                        <ArrowRight className="w-3 h-3 text-slate-400" />
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide ${
                                            item.new_status === 'present' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' :
                                            item.new_status === 'absent' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300' :
                                            item.new_status === 'late' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' :
                                            'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                                        }`}>
                                            {item.new_status}
                                        </span>
                                    </div>
                                </div>

                                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-normal italic">
                                    &ldquo;{item.correction_reason}&rdquo;
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                                    <div className="flex items-center gap-2">
                                        <span>Class Date: <strong className="text-slate-600 dark:text-slate-300">{item.class_date}</strong></span>
                                        <span>•</span>
                                        <span>By: <strong className="text-slate-600 dark:text-slate-300">{item.actor_name || 'Staff'} ({item.actor_role})</strong></span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`font-bold ${
                                            item.net_credit_adjustment > 0 ? 'text-emerald-600' :
                                            item.net_credit_adjustment < 0 ? 'text-rose-600' :
                                            'text-slate-500'
                                        }`}>
                                            {item.net_credit_adjustment > 0 ? `+${item.net_credit_adjustment}` : item.net_credit_adjustment} credit
                                        </span>
                                        <span>•</span>
                                        <span>{new Date(item.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
