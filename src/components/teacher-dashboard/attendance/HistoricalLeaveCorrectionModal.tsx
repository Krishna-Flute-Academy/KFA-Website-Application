'use client';

import React, { useState, useEffect } from 'react';
import { 
    X, 
    AlertTriangle, 
    Loader2, 
    ShieldAlert, 
    Info,
    Calendar,
    User
} from 'lucide-react';
import { supabaseAuth } from '../../../lib/supabase-auth';

export interface HistoricalLeaveCorrectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    leaveRequest: {
        id: string;
        student_id: string;
        classroom_id: string;
        class_date: string;
        reason?: string;
        status: string;
        users?: {
            name?: string;
            profile_pic_url?: string;
        };
        classrooms?: {
            name?: string;
        };
    } | null;
    onSuccess: () => void;
}

export function HistoricalLeaveCorrectionModal({
    isOpen,
    onClose,
    leaveRequest,
    onSuccess
}: HistoricalLeaveCorrectionModalProps) {
    const [targetStatus, setTargetStatus] = useState<string>('rejected');
    const [targetAttendanceStatus, setTargetAttendanceStatus] = useState<string>('absent');
    const [reason, setReason] = useState<string>('');
    const [previewLoading, setPreviewLoading] = useState<boolean>(false);
    const [executeLoading, setExecuteLoading] = useState<boolean>(false);
    const [previewData, setPreviewData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Initialize defaults when leaveRequest opens
    useEffect(() => {
        if (leaveRequest) {
            const nextTarget = leaveRequest.status === 'approved' ? 'rejected' : 'approved';
            setTargetStatus(nextTarget);
            setTargetAttendanceStatus(nextTarget === 'approved' ? 'excused' : 'absent');
            setReason('');
            setError(null);
        }
    }, [leaveRequest]);

    // Fetch preview whenever targetStatus or targetAttendanceStatus changes
    useEffect(() => {
        if (!isOpen || !leaveRequest?.id) return;

        let isMounted = true;
        const fetchPreview = async () => {
            setPreviewLoading(true);
            setError(null);
            try {
                const { data, error: rpcError } = await supabaseAuth.rpc('preview_leave_correction', {
                    p_leave_id: leaveRequest.id,
                    p_target_status: targetStatus,
                    p_target_attendance_status: targetAttendanceStatus
                });

                if (rpcError) throw rpcError;
                if (isMounted) {
                    setPreviewData(data);
                }
            } catch (err: any) {
                if (isMounted) {
                    console.error('Error fetching preview:', err);
                    setError(err?.message || 'Failed to preview leave correction.');
                }
            } finally {
                if (isMounted) setPreviewLoading(false);
            }
        };

        fetchPreview();
        return () => { isMounted = false; };
    }, [isOpen, leaveRequest?.id, targetStatus, targetAttendanceStatus]);

    if (!isOpen || !leaveRequest) return null;

    const handleExecute = async () => {
        if (!reason.trim()) {
            setError('An administrative correction reason is required.');
            return;
        }

        if (!previewData?.can_execute) {
            setError(previewData?.blocking_reason || 'Correction is blocked.');
            return;
        }

        setExecuteLoading(true);
        setError(null);

        try {
            const { error: rpcError } = await supabaseAuth.rpc('execute_leave_correction', {
                p_leave_id: leaveRequest.id,
                p_target_status: targetStatus,
                p_target_attendance_status: targetAttendanceStatus,
                p_authorized_credit_delta: previewData.projected_credit_delta,
                p_reason: reason.trim()
            });

            if (rpcError) throw rpcError;

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error executing leave correction:', err);
            setError(err?.message || 'Failed to execute leave correction.');
        } finally {
            setExecuteLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 flex flex-col">
                {/* Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-xl">
                            <ShieldAlert className="w-5 h-5 text-amber-100" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">Admin Leave Correction</h2>
                            <p className="text-xs text-amber-100/90">Audit-backed retroactive leave status modification</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
                    {/* Student & Class Info */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500 font-medium flex items-center gap-1.5">
                                <User className="w-4 h-4 text-slate-400" /> Student
                            </span>
                            <span className="font-semibold text-slate-800">{leaveRequest.users?.name || 'Student'}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500 font-medium flex items-center gap-1.5">
                                <Calendar className="w-4 h-4 text-slate-400" /> Class Date
                            </span>
                            <span className="font-semibold text-slate-800">{leaveRequest.class_date}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500 font-medium">Classroom</span>
                            <span className="font-medium text-slate-700">{leaveRequest.classrooms?.name || 'Classroom'}</span>
                        </div>
                        {leaveRequest.reason && (
                            <div className="pt-2 border-t border-slate-200 text-xs text-slate-600">
                                <span className="font-semibold text-slate-700">Original Student Reason: </span>
                                {leaveRequest.reason}
                            </div>
                        )}
                    </div>

                    {/* Correction Settings */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                Target Leave Status
                            </label>
                            <select
                                value={targetStatus}
                                onChange={(e) => {
                                    const next = e.target.value;
                                    setTargetStatus(next);
                                    if (next === 'approved') setTargetAttendanceStatus('excused');
                                    else if (next === 'rejected') setTargetAttendanceStatus('absent');
                                }}
                                className="w-full text-sm border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                            >
                                <option value="rejected">rejected</option>
                                <option value="approved">approved</option>
                                <option value="pending">pending</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                Target Attendance
                            </label>
                            <select
                                value={targetAttendanceStatus}
                                onChange={(e) => setTargetAttendanceStatus(e.target.value)}
                                className="w-full text-sm border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                            >
                                <option value="absent">absent (charge 1)</option>
                                <option value="excused">excused (charge 0)</option>
                                <option value="present">present (charge 1)</option>
                                <option value="late">late (charge 1)</option>
                            </select>
                        </div>
                    </div>

                    {/* Financial & Status Projection Preview */}
                    <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between text-xs font-semibold text-amber-900 border-b border-amber-200/60 pb-2">
                            <span>Correction Financial Preview</span>
                            {previewLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />}
                        </div>

                        {previewData && (
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between items-center text-slate-700">
                                    <span>Status Transition:</span>
                                    <span className="font-semibold text-slate-900">
                                        {previewData.current_leave_status} → {previewData.target_leave_status}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-slate-700">
                                    <span>Attendance Transition:</span>
                                    <span className="font-semibold text-slate-900">
                                        {previewData.current_attendance_status || 'none'} → {previewData.target_attendance_status}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-slate-700">
                                    <span>Current Prepaid Credits:</span>
                                    <span className="font-semibold text-slate-900">{previewData.current_balance}</span>
                                </div>
                                <div className="flex justify-between items-center text-slate-700">
                                    <span>Projected Financial Delta:</span>
                                    <span className={`font-bold ${
                                        previewData.projected_credit_delta > 0 
                                            ? 'text-emerald-600' 
                                            : previewData.projected_credit_delta < 0 
                                                ? 'text-red-600' 
                                                : 'text-slate-600'
                                    }`}>
                                        {previewData.projected_credit_delta > 0 ? `+${previewData.projected_credit_delta}` : previewData.projected_credit_delta} credit(s)
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pt-1 border-t border-amber-200 text-slate-800">
                                    <span className="font-semibold">Projected New Balance:</span>
                                    <span className="font-bold text-amber-900">{previewData.projected_new_balance} credit(s)</span>
                                </div>
                            </div>
                        )}

                        {previewData?.has_completed_makeup && (
                            <div className="flex items-start gap-2 bg-red-100/80 border border-red-200 text-red-800 p-2.5 rounded-lg text-xs">
                                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                                <div>
                                    <span className="font-bold">Blocked: </span>
                                    Student has already attended or completed a makeup class for this missed session. Leave cannot be retroactively modified without invalidating completed makeup.
                                </div>
                            </div>
                        )}

                        {previewData?.blocking_reason && !previewData.has_completed_makeup && (
                            <div className="flex items-start gap-2 bg-amber-100 border border-amber-300 text-amber-800 p-2.5 rounded-lg text-xs">
                                <Info className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
                                <div>{previewData.blocking_reason}</div>
                            </div>
                        )}
                    </div>

                    {/* Mandatory Reason */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Audit Reason (Required) <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. Leave was applied after deadline or student attended makeup"
                            rows={3}
                            className="w-full text-sm border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={executeLoading}
                        className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-200/60 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleExecute}
                        disabled={executeLoading || previewLoading || !previewData?.can_execute || !reason.trim()}
                        className="px-5 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all flex items-center gap-2"
                    >
                        {executeLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Executing...
                            </>
                        ) : (
                            'Confirm & Execute Correction'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
