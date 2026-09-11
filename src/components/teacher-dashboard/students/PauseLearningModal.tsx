'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
    X, 
    PauseCircle, 
    AlertTriangle, 
    Calendar, 
    Loader2, 
    Info, 
    CalendarX 
} from 'lucide-react';
import { supabaseAuth } from '../../../lib/supabase-auth';

export interface PauseLearningModalProps {
    isOpen: boolean;
    onClose: () => void;
    student: {
        id: string;
        name: string;
        email?: string;
        student_id_formatted?: string;
        classroom_name?: string;
        classroom_id?: string;
        batch?: string;
        profile_pic_url?: string;
    } | null;
    onSuccess?: (updatedStudent: any) => void;
}

interface FutureMakeup {
    id: string;
    override_date: string;
    formatted_date?: string;
    classroom_name: string;
    time_slot?: string;
    reason?: string;
    missed_session_date?: string | null;
    credit_treatment?: string | null;
}

export const PauseLearningModal: React.FC<PauseLearningModalProps> = ({
    isOpen,
    onClose,
    student,
    onSuccess
}) => {
    const [mounted, setMounted] = useState(false);
    const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [reason, setReason] = useState('');
    const [futureMakeups, setFutureMakeups] = useState<FutureMakeup[]>([]);
    const [cancelFutureMakeups, setCancelFutureMakeups] = useState(true);
    const [isLoadingMakeups, setIsLoadingMakeups] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Load upcoming makeup/override sessions with full schedule and classroom details
    const fetchFutureMakeups = useCallback(async () => {
        if (!student?.id || !isOpen) return;
        setIsLoadingMakeups(true);
        setErrorMessage(null);
        try {
            const todayStr = new Date().toISOString().slice(0, 10);
            const { data, error } = await supabaseAuth
                .from('session_student_overrides')
                .select(`
                    id, 
                    override_date, 
                    reason, 
                    missed_session_date,
                    credit_treatment,
                    target_classroom_id,
                    classrooms:target_classroom_id(
                        id,
                        name,
                        type,
                        batch_schedules(day_of_week, start_time, end_time)
                    )
                `)
                .eq('student_id', student.id)
                .gte('override_date', todayStr)
                .order('override_date', { ascending: true });

            if (error) {
                console.warn('Could not query future makeups:', error);
                return;
            }

            const targetIds = (data || []).map((r: any) => r.target_classroom_id).filter(Boolean);
            const tempClassesMap = new Map<string, any>();
            if (targetIds.length > 0) {
                const { data: tcData } = await supabaseAuth
                    .from('temporary_classes')
                    .select('id, classroom_id, title, start_time, end_time')
                    .in('classroom_id', targetIds);
                (tcData || []).forEach((tc: any) => tempClassesMap.set(tc.classroom_id, tc));
            }

            const formatTime = (t?: string) => {
                if (!t) return '';
                const [h, min] = t.split(':');
                const hour = parseInt(h, 10);
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const h12 = hour % 12 || 12;
                return `${h12}:${min} ${ampm}`;
            };

            const parsed: FutureMakeup[] = (data || []).map((row: any) => {
                const overrideDate = row.override_date;
                const dObj = new Date(overrideDate);
                const dayOfWeek = dObj.getDay();
                const formattedDate = !isNaN(dObj.getTime())
                    ? dObj.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                    : overrideDate;

                let timeSlot = '';
                const tc = tempClassesMap.get(row.target_classroom_id);
                if (tc?.start_time) {
                    timeSlot = `${formatTime(tc.start_time)}${tc.end_time ? ` - ${formatTime(tc.end_time)}` : ''}`;
                } else if (row.classrooms?.batch_schedules) {
                    const schedules = Array.isArray(row.classrooms.batch_schedules) 
                        ? row.classrooms.batch_schedules 
                        : [row.classrooms.batch_schedules];
                    const matchingSchedule = schedules.find((s: any) => s.day_of_week === dayOfWeek) || schedules[0];
                    if (matchingSchedule?.start_time) {
                        timeSlot = `${formatTime(matchingSchedule.start_time)}${matchingSchedule.end_time ? ` - ${formatTime(matchingSchedule.end_time)}` : ''}`;
                    }
                }

                const classroomName = tc?.title || row.classrooms?.name || 'Assigned Classroom';

                return {
                    id: row.id,
                    override_date: overrideDate,
                    formatted_date: formattedDate,
                    classroom_name: classroomName,
                    time_slot: timeSlot,
                    reason: row.reason,
                    missed_session_date: row.missed_session_date,
                    credit_treatment: row.credit_treatment
                };
            });
            setFutureMakeups(parsed);
        } catch (err: any) {
            console.error('Error fetching future makeups:', err);
        } finally {
            setIsLoadingMakeups(false);
        }
    }, [student?.id, isOpen]);

    useEffect(() => {
        if (isOpen) {
            setEffectiveDate(new Date().toISOString().slice(0, 10));
            setReason('');
            setCancelFutureMakeups(true);
            setErrorMessage(null);
            fetchFutureMakeups();
        }
    }, [isOpen, fetchFutureMakeups]);

    const handleConfirmPause = async () => {
        if (!student?.id) return;
        setIsSubmitting(true);
        setErrorMessage(null);

        try {
            // 1. If student has future makeups and cancel is checked, remove them
            if (cancelFutureMakeups && futureMakeups.length > 0) {
                const makeupIds = futureMakeups.map(m => m.id);
                const { error: delError } = await supabaseAuth
                    .from('session_student_overrides')
                    .delete()
                    .in('id', makeupIds);

                if (delError) {
                    console.warn('Could not delete scheduled makeups:', delError);
                }
            }

            // 2. Update users status to inactive (Paused) with effective pause date & reason
            const updatedNotes = reason 
                ? ((student as any).notes ? `${(student as any).notes}\n[Paused ${effectiveDate}]: ${reason}` : `[Paused ${effectiveDate}]: ${reason}`)
                : (student as any).notes;

            const { error: userError } = await supabaseAuth
                .from('users')
                .update({ 
                    status: 'inactive',
                    notes: updatedNotes
                })
                .eq('id', student.id);

            if (userError) throw userError;

            // Trigger will automatically associate student with KFA Learning Circle without overwriting permanent classroom
            if (onSuccess) {
                onSuccess({
                    ...student,
                    status: 'Inactive',
                    batch: currentBatch,
                    classroom_name: currentBatch,
                    notes: updatedNotes
                });
            }

            onClose();
        } catch (err: any) {
            console.error('Error pausing student learning:', err);
            setErrorMessage(err.message || 'Failed to pause student learning. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !mounted || !student) return null;

    const currentBatch = (student.classroom_name || student.batch || 'Unassigned').trim();

    return createPortal(
        <div 
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-hidden"
            onClick={(e) => {
                if (e.target === e.currentTarget && !isSubmitting) onClose();
            }}
        >
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg flex flex-col animate-in zoom-in-95 duration-150 overflow-hidden">
                
                {/* Header */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-amber-50/40 dark:bg-amber-950/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                            <PauseCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                Pause Learning
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Temporarily suspend classroom participation & billing
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                    
                    {/* Target Student Details */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 shrink-0 overflow-hidden">
                            {student.profile_pic_url ? (
                                <img src={student.profile_pic_url} alt={student.name} className="w-full h-full object-cover" />
                            ) : (
                                student.name.charAt(0)
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {student.name}
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                Current Batch: <strong className="text-slate-700 dark:text-slate-300">{currentBatch}</strong>
                                {student.student_id_formatted && ` • ${student.student_id_formatted}`}
                            </p>
                        </div>
                    </div>

                    {/* What happens notice */}
                    <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/40 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-400">
                            <Info className="w-3.5 h-3.5" />
                            <span>What happens when learning is paused:</span>
                        </div>
                        <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-slate-600 dark:text-slate-400">
                            <li>Student is moved to <strong>KFA Learning Circle</strong> (community archive).</li>
                            <li>Excluded from operational attendance rosters, active fee cycles & reminders.</li>
                            <li>Excluded from upcoming class schedules and active task notifications.</li>
                            <li><strong>100% of historical data</strong> (attendance, notes, payments) remains safely preserved.</li>
                        </ul>
                    </div>

                    {/* Future Makeups Warning if any */}
                    {isLoadingMakeups ? (
                        <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                            <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                            Checking scheduled makeup sessions...
                        </div>
                    ) : futureMakeups.length > 0 ? (
                        <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs space-y-3">
                            <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span>Upcoming Scheduled Makeup Session(s) Detected ({futureMakeups.length})</span>
                            </div>
                            <div className="space-y-2">
                                {futureMakeups.map(m => (
                                    <div key={m.id} className="p-2.5 rounded-lg bg-white dark:bg-slate-850 border border-amber-200/80 dark:border-amber-900/60 shadow-xs space-y-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                                                <CalendarX className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                                <span>{m.formatted_date || m.override_date}</span>
                                            </div>
                                            {m.time_slot && (
                                                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                                    {m.time_slot}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                            <span>Classroom:</span>
                                            <strong className="text-slate-700 dark:text-slate-300 font-semibold">{m.classroom_name}</strong>
                                        </div>
                                        {m.reason && (
                                            <div className="text-[11px] text-slate-500 italic">
                                                Reason: &ldquo;{m.reason}&rdquo;
                                            </div>
                                        )}
                                        {m.missed_session_date && (
                                            <div className="text-[10px] text-amber-700/90 dark:text-amber-400/90 font-medium">
                                                Makeup for missed class on: <strong>{m.missed_session_date}</strong>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <label className="flex items-center gap-2 pt-1 cursor-pointer font-semibold text-amber-900 dark:text-amber-200 select-none">
                                <input
                                    type="checkbox"
                                    checked={cancelFutureMakeups}
                                    onChange={(e) => setCancelFutureMakeups(e.target.checked)}
                                    className="rounded border-amber-400 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                                />
                                <span>Cancel and remove future scheduled makeup session(s)</span>
                            </label>
                        </div>
                    ) : null}

                    {/* Effective Date Input */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Effective Pause Date
                        </label>
                        <div className="relative">
                            <input
                                type="date"
                                value={effectiveDate}
                                onChange={(e) => setEffectiveDate(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                            />
                            <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                        </div>
                    </div>

                    {/* Optional Reason */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Reason / Notes <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={2}
                            placeholder="e.g., Academic exams, travel, temporary hiatus..."
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                        />
                    </div>

                    {/* Error Message */}
                    {errorMessage && (
                        <div className="p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs">
                            {errorMessage}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirmPause}
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Pausing...
                            </>
                        ) : (
                            <>
                                <PauseCircle className="w-3.5 h-3.5" />
                                Confirm Pause Learning
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>,
        document.body
    );
};
