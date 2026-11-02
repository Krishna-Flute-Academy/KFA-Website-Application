'use client';

import React, { useState } from 'react';
import { 
    X, 
    AlertTriangle, 
    Loader2, 
    RotateCcw, 
    Info, 
    User, 
    Calendar, 
    School,
    CheckCircle2
} from 'lucide-react';
import { supabaseAuth } from '../../../lib/supabase-auth';

export interface UnmarkAttendanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (result: any) => void;
    record: {
        attendanceId: string;
        studentId: string;
        studentName: string;
        classroomId: string;
        classroomName: string;
        classDate: string;
        currentStatus: string;
    } | null;
}

export function UnmarkAttendanceModal({
    isOpen,
    onClose,
    onSuccess,
    record
}: UnmarkAttendanceModalProps) {
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen || !record) return null;

    const isCreditRestored = record.currentStatus !== 'excused';

    const handleConfirm = async () => {
        const cleanReason = reason.trim();
        if (cleanReason.length < 3) {
            setError('Please provide a mandatory reason with at least 3 characters.');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const { data, error: rpcErr } = await supabaseAuth.rpc('unmark_historical_attendance', {
                p_attendance_id: record.attendanceId,
                p_reason: cleanReason
            });

            if (rpcErr) throw rpcErr;

            onSuccess(data);
            onClose();
        } catch (err: any) {
            console.error('Error unmarking attendance:', err);
            setError(err.message || 'Failed to unmark attendance. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md flex flex-col p-6 animate-in zoom-in-95 duration-200 text-left">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-[#ecb613] flex items-center justify-center shrink-0">
                            <RotateCcw className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                                Unmark Attendance Record
                            </h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                Audited Removal & Reversal
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Session Information */}
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2 mb-4 text-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" /> Student
                        </span>
                        <span className="font-extrabold text-slate-900 dark:text-white">
                            {record.studentName}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                            <School className="w-3.5 h-3.5 text-slate-400" /> Classroom
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                            {record.classroomName}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" /> Date
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                            {record.classDate}
                        </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-slate-700/60 pt-2">
                        <span className="text-slate-400 font-semibold">Current Recorded Status</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                            {record.currentStatus}
                        </span>
                    </div>
                </div>

                {/* Financial Reversal Preview */}
                <div className={`p-3.5 rounded-2xl border mb-4 text-xs ${
                    isCreditRestored 
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50' 
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                }`}>
                    <div className="flex items-start gap-2">
                        <Info className={`w-4 h-4 shrink-0 mt-0.5 ${isCreditRestored ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                        <div>
                            <p className="font-bold text-slate-900 dark:text-white">
                                {isCreditRestored ? 'Automatic Credit Restoration (+1 Credit)' : 'Net Zero Financial Change (0 Credits)'}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {isCreditRestored 
                                    ? `This student was previously deducted for this session. Unmarking will restore +1 class credit to their prepaid balance.` 
                                    : `This student was marked Excused (no deduction). Unmarking will revert their record with zero net balance change.`}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl mb-4 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Mandatory Reason Input */}
                <div className="space-y-1.5 mb-5">
                    <div className="flex items-center justify-between text-xs">
                        <label className="font-bold text-slate-700 dark:text-slate-300">
                            Mandatory Reason for Unmarking <span className="text-rose-500">*</span>
                        </label>
                        <span className={`text-[10px] font-bold ${reason.trim().length >= 3 ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {reason.trim().length} / 3 min chars
                        </span>
                    </div>
                    <textarea
                        rows={2}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. Marked in error, student was not present in this session..."
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-[#ecb613]/50 outline-none transition-all resize-none font-medium"
                    />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={loading || reason.trim().length < 3}
                        className={`px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-md ${
                            loading || reason.trim().length < 3
                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'
                                : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20 cursor-pointer active:scale-95'
                        }`}
                    >
                        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Confirm Unmark</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
