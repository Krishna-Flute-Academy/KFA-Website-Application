'use client';

import React, { useState, useEffect } from 'react';
import { 
    X, 
    AlertTriangle, 
    Loader2, 
    ShieldAlert, 
    Info,
    Calendar,
    User,
    CheckCircle2,
    ArrowRight,
    History,
    AlertCircle
} from 'lucide-react';
import { supabaseAuth } from '../../../lib/supabase-auth';

export interface HistoricalAttendanceCorrectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    record: {
        attendanceId: string;
        studentId: string;
        studentName: string;
        classroomId: string;
        classroomName: string;
        classDate: string;
        currentStatus: string;
        currentBalance?: number;
    } | null;
    onSuccess: (result: any) => void;
}

export function HistoricalAttendanceCorrectionModal({
    isOpen,
    onClose,
    record,
    onSuccess
}: HistoricalAttendanceCorrectionModalProps) {
    const [targetStatus, setTargetStatus] = useState<string>('present');
    const [reason, setReason] = useState<string>('');
    const [previewLoading, setPreviewLoading] = useState<boolean>(false);
    const [executeLoading, setExecuteLoading] = useState<boolean>(false);
    const [previewData, setPreviewData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Initialize defaults when record opens
    useEffect(() => {
        if (record) {
            // Suggest alternate status
            let defaultTarget = 'present';
            if (record.currentStatus === 'present') defaultTarget = 'absent';
            else if (record.currentStatus === 'absent') defaultTarget = 'excused';
            else if (record.currentStatus === 'excused') defaultTarget = 'present';
            
            setTargetStatus(defaultTarget);
            setReason('');
            setError(null);
        }
    }, [record]);

    // Fetch preview whenever targetStatus changes
    useEffect(() => {
        if (!isOpen || !record?.attendanceId) return;

        let isMounted = true;
        const fetchPreview = async () => {
            setPreviewLoading(true);
            setError(null);
            try {
                const { data, error: rpcError } = await supabaseAuth.rpc('preview_attendance_correction', {
                    p_attendance_id: record.attendanceId,
                    p_new_status: targetStatus
                });

                if (rpcError) throw rpcError;
                if (isMounted) {
                    setPreviewData(data);
                }
            } catch (err: any) {
                if (isMounted) {
                    console.error('Error fetching preview:', err);
                    setError(err?.message || 'Failed to preview attendance correction.');
                }
            } finally {
                if (isMounted) setPreviewLoading(false);
            }
        };

        fetchPreview();
        return () => { isMounted = false; };
    }, [isOpen, record?.attendanceId, targetStatus]);

    if (!isOpen || !record) return null;

    const handleExecute = async () => {
        const finalReason = reason.trim() || 'Attendance updated by teacher';

        if (previewData && !previewData.can_execute) {
            setError(previewData.blocking_reason || 'Correction is blocked by financial/makeup rules.');
            return;
        }

        setExecuteLoading(true);
        setError(null);

        try {
            const { data, error: execError } = await supabaseAuth.rpc('correct_historical_attendance', {
                p_attendance_id: record.attendanceId,
                p_new_status: targetStatus,
                p_reason: finalReason,
                p_authorized_credit_delta: previewData ? previewData.projected_credit_delta : null
            });

            if (execError) throw execError;

            onSuccess(data);
            onClose();
        } catch (err: any) {
            console.error('Error executing attendance correction:', err);
            setError(err?.message || 'Failed to execute historical attendance correction.');
        } finally {
            setExecuteLoading(false);
        }
    };

    const delta = previewData?.projected_credit_delta ?? 0;
    const canExecute = previewData ? previewData.can_execute : true;

    return (
        <div 
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-hidden"
            onClick={(e) => {
                if (e.target === e.currentTarget && !executeLoading) onClose();
            }}
        >
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg flex flex-col animate-in zoom-in-95 duration-150 overflow-hidden">
                
                {/* Header */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-amber-50/50 dark:bg-amber-950/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                            <History className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                Historical Attendance Correction
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Audited revision with automatic credit balance recalculation
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={executeLoading}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                    {/* Error Banner */}
                    {error && (
                        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-rose-800 dark:text-rose-200 text-xs">
                            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                            <div className="flex-1 font-medium leading-relaxed">{error}</div>
                        </div>
                    )}

                    {/* Record Context Card */}
                    <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/80 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5" /> Student:
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white">
                                {record.studentName}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" /> Class Date:
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white">
                                {record.classDate}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-500 dark:text-slate-400">Classroom:</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                                {record.classroomName}
                            </span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                            <span className="font-semibold text-slate-500 dark:text-slate-400">Current Status:</span>
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                                record.currentStatus === 'present' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' :
                                record.currentStatus === 'absent' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300' :
                                record.currentStatus === 'late' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' :
                                'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                            }`}>
                                {record.currentStatus}
                            </span>
                        </div>
                    </div>

                    {/* Correction Target Status */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                            Corrected Attendance Status:
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                            {(['present', 'absent', 'late', 'excused'] as const).map(st => (
                                <button
                                    key={st}
                                    type="button"
                                    onClick={() => setTargetStatus(st)}
                                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold capitalize transition-all cursor-pointer text-center ${
                                        targetStatus === st
                                            ? 'border-amber-500 bg-amber-500 text-slate-950 shadow-sm'
                                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                    }`}
                                >
                                    {st}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Reason (Optional) */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                            Correction Reason (Optional):
                        </label>
                        <textarea
                            rows={3}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Optional notes or reason for updating attendance..."
                            className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:focus:ring-amber-400/30 text-slate-900 dark:text-white"
                        />
                    </div>

                    {/* Financial Recalculation Impact Preview */}
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                            <span>Automatic Financial Recalculation</span>
                            {previewLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />}
                        </div>

                        {previewData && (
                            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Current Balance</div>
                                    <div className="text-sm font-black text-slate-900 dark:text-white">
                                        {previewData.current_balance} cr
                                    </div>
                                </div>
                                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Adjustment</div>
                                    <div className={`text-sm font-black ${
                                        delta > 0 ? 'text-emerald-600 dark:text-emerald-400' :
                                        delta < 0 ? 'text-rose-600 dark:text-rose-400' :
                                        'text-slate-500'
                                    }`}>
                                        {delta > 0 ? `+${delta}` : delta} cr
                                    </div>
                                </div>
                                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                    <div className="text-[10px] text-slate-400 font-semibold uppercase">New Balance</div>
                                    <div className="text-sm font-black text-slate-900 dark:text-white">
                                        {previewData.projected_new_balance} cr
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Warnings / Blocking reasons */}
                        {previewData?.blocking_reason && (
                            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-[11px] text-rose-700 dark:text-rose-300 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                                <div>{previewData.blocking_reason}</div>
                            </div>
                        )}

                        {previewData?.has_active_makeup_booking && !previewData?.blocking_reason && targetStatus !== 'excused' && (
                            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                                <div>
                                    An active scheduled makeup booking exists for this missed session and will be automatically cancelled to prevent orphan entitlements.
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={executeLoading}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleExecute}
                        disabled={executeLoading || !canExecute || targetStatus === record.currentStatus}
                        className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                    >
                        {executeLoading ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Applying...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Confirm & Apply</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
