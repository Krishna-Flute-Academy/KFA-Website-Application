'use client';

import React, { useState, useEffect } from 'react';
import { supabaseAuth } from '../../../lib/supabase-auth';
import { cancelAlternativeSpecialSession } from '../../../lib/alternative-class-sessions';
import { Calendar, AlertCircle, X, Clock, HelpCircle, RotateCcw } from 'lucide-react';

interface ScheduleAlternativeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    holiday: {
        id: string;
        classroom_id: string;
        holiday_date: string;
        holiday_type: string;
        alternative_date?: string | null;
        alternative_start_time?: string | null;
        alternative_end_time?: string | null;
        reason?: string;
    } | null;
    classroomName?: string;
}

export default function ScheduleAlternativeModal({
    isOpen,
    onClose,
    onSuccess,
    holiday,
    classroomName = 'Classroom'
}: ScheduleAlternativeModalProps) {
    const isRescheduling = holiday?.holiday_type === 'alternative_scheduled' || holiday?.holiday_type === 'with_alternative';

    const [altDate, setAltDate] = useState(holiday?.alternative_date || '');
    const [altStart, setAltStart] = useState(holiday?.alternative_start_time?.slice(0, 5) || '');
    const [altEnd, setAltEnd] = useState(holiday?.alternative_end_time?.slice(0, 5) || '');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [reverting, setReverting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (holiday) {
            setAltDate(holiday.alternative_date || '');
            setAltStart(holiday.alternative_start_time ? holiday.alternative_start_time.slice(0, 5) : '');
            setAltEnd(holiday.alternative_end_time ? holiday.alternative_end_time.slice(0, 5) : '');
            setReason(isRescheduling ? 'Rescheduled replacement session' : 'Confirmed replacement class date');
        }
    }, [holiday, isRescheduling]);

    if (!isOpen || !holiday) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!altDate) {
            setError('Please select an alternative class date.');
            return;
        }

        if (altDate === holiday.holiday_date) {
            setError('Alternative class date cannot be the same as the original class off date.');
            return;
        }

        const cleanReason = reason.trim();
        if (cleanReason.length < 3) {
            setError('Please provide a valid scheduling reason (minimum 3 characters).');
            return;
        }

        setLoading(true);
        try {
            const { error: rpcError } = await supabaseAuth.rpc('schedule_holiday_alternative', {
                p_holiday_id: holiday.id,
                p_alternative_date: altDate,
                p_alt_start_time: altStart ? `${altStart}:00` : null,
                p_alt_end_time: altEnd ? `${altEnd}:00` : null,
                p_reason: cleanReason
            });

            if (rpcError) throw rpcError;

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error scheduling alternative:', err);
            setError(err?.message || 'Failed to schedule alternative class.');
        } finally {
            setLoading(false);
        }
    };

    const handleRevertToPending = async () => {
        const cleanReason = reason.trim() || 'Postponed replacement class; replacement date to be decided';
        setReverting(true);
        setError(null);
        try {
            const { error: rpcError } = await supabaseAuth.rpc('revert_holiday_alternative_to_pending', {
                p_holiday_id: holiday.id,
                p_reason: cleanReason
            });

            if (rpcError) throw rpcError;

            try {
                await cancelAlternativeSpecialSession(supabaseAuth, holiday.id);
            } catch (sessErr) {
                console.error('Error cancelling alternative class special session:', sessErr);
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error reverting alternative to pending:', err);
            setError(err?.message || 'Failed to revert alternative to pending.');
        } finally {
            setReverting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col">
                {/* Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                            <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg leading-tight">
                                {isRescheduling ? 'Reschedule Alternative Class' : 'Schedule Alternative Class'}
                            </h3>
                            <p className="text-xs text-blue-100 mt-0.5">{classroomName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                        disabled={loading || reverting}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 text-left overflow-y-auto max-h-[80vh]">
                    {error && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-xs">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                        <div className="text-slate-500 dark:text-slate-400 font-medium">Class Off Context:</div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                            Original Missed Class: <span className="text-amber-600 dark:text-amber-400">{holiday.holiday_date}</span>
                        </div>
                        {holiday.reason && (
                            <div className="text-slate-600 dark:text-slate-300 text-[11px]">
                                Reason: {holiday.reason}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                            Replacement Class Date *
                        </label>
                        <input
                            id="schedAltDate"
                            type="date"
                            value={altDate}
                            onChange={(e) => setAltDate(e.target.value)}
                            required
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                Start Time (Optional)
                            </label>
                            <input
                                id="schedAltStart"
                                type="time"
                                value={altStart}
                                onChange={(e) => setAltStart(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                End Time (Optional)
                            </label>
                            <input
                                id="schedAltEnd"
                                type="time"
                                value={altEnd}
                                onChange={(e) => setAltEnd(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                            Scheduling Note / Reason *
                        </label>
                        <textarea
                            id="schedReason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. Confirmed hall booking for replacement class on Friday evening"
                            rows={2}
                            required
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                        />
                    </div>

                    <div className="p-3 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl text-xs text-blue-900 dark:text-blue-200 space-y-1">
                        <div className="font-semibold flex items-center gap-1.5">
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>BR-22 Linkage Rules</span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                            The replacement session will run <strong>On Behalf Of {holiday.holiday_date}</strong>. When attendance is marked on {altDate || '[date]'}, exactly 1 credit will be deducted for attending students.
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between pt-2">
                        {isRescheduling ? (
                            <button
                                type="button"
                                onClick={handleRevertToPending}
                                disabled={loading || reverting}
                                className="px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>{reverting ? 'Reverting...' : 'Revert to Pending'}</span>
                            </button>
                        ) : <div />}

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={loading || reverting}
                                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading || reverting}
                                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                            >
                                {loading ? 'Saving...' : isRescheduling ? 'Update Alternative' : 'Confirm Alternative'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
