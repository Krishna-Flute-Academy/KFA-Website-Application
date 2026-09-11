'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
    X, 
    PlayCircle, 
    School, 
    Calendar, 
    CreditCard, 
    CheckCircle2, 
    Loader2, 
    Info 
} from 'lucide-react';
import { supabaseAuth } from '../../../lib/supabase-auth';
import { calculateResumedFeeDueDate } from '../../../lib/fee-utils';

export interface ClassroomOption {
    id: string;
    name: string;
    type?: string;
}

export interface ResumeLearningModalProps {
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
        fees_basis?: string;
        fees_collection_date?: number | string;
    } | null;
    classrooms: ClassroomOption[];
    onSuccess?: (updatedStudent: any) => void;
}

export const ResumeLearningModal: React.FC<ResumeLearningModalProps> = ({
    isOpen,
    onClose,
    student,
    classrooms,
    onSuccess
}) => {
    const [mounted, setMounted] = useState(false);
    const [selectedBatchId, setSelectedBatchId] = useState('');
    const [resumeDate, setResumeDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [collectionDay, setCollectionDay] = useState<number>(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Filter out Learning Circle and temporary classrooms
    const eligibleClassrooms = useMemo(() => {
        return (classrooms || []).filter(c => {
            const name = (c.name || '').toLowerCase();
            return c.type !== 'learning_circle' && 
                   c.type !== 'temporary' && 
                   !name.includes('learning circle');
        });
    }, [classrooms]);

    useEffect(() => {
        if (isOpen && student) {
            setResumeDate(new Date().toISOString().slice(0, 10));
            setErrorMessage(null);

            // Default collection day
            const cDay = Number(student.fees_collection_date) || 1;
            setCollectionDay(cDay);

            // Pick initial classroom: if previous classroom was valid and in eligible list, choose it, otherwise first eligible
            const prevId = student.classroom_id;
            const hasPrev = eligibleClassrooms.some(c => c.id === prevId);
            if (hasPrev && prevId) {
                setSelectedBatchId(prevId);
            } else if (eligibleClassrooms.length > 0) {
                setSelectedBatchId(eligibleClassrooms[0].id);
            } else {
                setSelectedBatchId('');
            }
        }
    }, [isOpen, student, eligibleClassrooms]);

    // Live preview of next fee due date
    const previewDueDate = useMemo(() => {
        if (!resumeDate) return null;
        try {
            const nextDue = calculateResumedFeeDueDate(resumeDate, collectionDay);
            const day = nextDue.getDate();
            const monthName = nextDue.toLocaleString('en-US', { month: 'long', year: 'numeric' });
            return `${day} ${monthName}`;
        } catch {
            return null;
        }
    }, [resumeDate, collectionDay]);

    const handleConfirmResume = async () => {
        if (!student?.id) return;
        if (!selectedBatchId) {
            setErrorMessage('Please select a permanent classroom for this student.');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage(null);

        try {
            const selectedRoom = eligibleClassrooms.find(c => c.id === selectedBatchId);
            const selectedRoomName = selectedRoom?.name || 'Assigned Classroom';

            // 1. Update user to active status & save collection day
            const updatedNotes = (student as any).notes
                ? `${(student as any).notes}\n[Resumed ${resumeDate}]`
                : `[Resumed ${resumeDate}]`;

            const { error: userError } = await supabaseAuth
                .from('users')
                .update({ 
                    status: 'active',
                    fees_collection_date: collectionDay,
                    notes: updatedNotes
                })
                .eq('id', student.id);

            if (userError) throw userError;

            // 2. Remove only learning circle enrollments for this student (preserving permanent classroom structure)
            const { data: circleRooms } = await supabaseAuth
                .from('classrooms')
                .select('id')
                .or('type.eq.learning_circle,name.ilike.%learning circle%');

            const circleIds = (circleRooms || []).map(r => r.id);
            if (circleIds.length > 0) {
                await supabaseAuth
                    .from('classroom_students')
                    .delete()
                    .eq('student_id', student.id)
                    .in('classroom_id', circleIds);
            }

            // 3. Upsert / update permanent classroom enrollment
            const { data: existingEnroll } = await supabaseAuth
                .from('classroom_students')
                .select('id')
                .eq('student_id', student.id)
                .eq('classroom_id', selectedBatchId)
                .maybeSingle();

            if (existingEnroll) {
                await supabaseAuth
                    .from('classroom_students')
                    .update({ joined_at: new Date(resumeDate).toISOString() })
                    .eq('id', existingEnroll.id);
            } else {
                const { data: otherPermEnroll } = await supabaseAuth
                    .from('classroom_students')
                    .select('id')
                    .eq('student_id', student.id)
                    .maybeSingle();

                if (otherPermEnroll) {
                    await supabaseAuth
                        .from('classroom_students')
                        .update({
                            classroom_id: selectedBatchId,
                            joined_at: new Date(resumeDate).toISOString()
                        })
                        .eq('id', otherPermEnroll.id);
                } else {
                    const { error: enrollError } = await supabaseAuth
                        .from('classroom_students')
                        .insert([{
                            classroom_id: selectedBatchId,
                            student_id: student.id,
                            joined_at: new Date(resumeDate).toISOString()
                        }]);

                    if (enrollError) throw enrollError;
                }
            }

            if (onSuccess) {
                onSuccess({
                    ...student,
                    status: 'Active',
                    batch: selectedRoomName,
                    classroom_name: selectedRoomName,
                    classroom_id: selectedBatchId,
                    fees_collection_date: collectionDay
                });
            }

            onClose();
        } catch (err: any) {
            console.error('Error resuming student:', err);
            setErrorMessage(err.message || 'Failed to resume student learning. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !mounted || !student) return null;

    return createPortal(
        <div 
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-hidden"
            onClick={(e) => {
                if (e.target === e.currentTarget && !isSubmitting) onClose();
            }}
        >
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg flex flex-col animate-in zoom-in-95 duration-150 overflow-hidden">
                
                {/* Header */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/40 dark:bg-emerald-950/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                            <PlayCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                Resume Learning
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Re-activate student into a permanent classroom
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

                {/* Body */}
                <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                    
                    {/* Student Info Card */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 shrink-0 overflow-hidden">
                            {student.profile_pic_url ? (
                                <img src={student.profile_pic_url} alt={student.name} className="w-full h-full object-cover" />
                            ) : (
                                student.name.charAt(0)
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                    {student.name}
                                </h4>
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                    Currently Paused
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                Learning Circle Archive {student.student_id_formatted && `• ${student.student_id_formatted}`}
                            </p>
                        </div>
                    </div>

                    {/* Permanent Classroom Assignment */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Assign Permanent Classroom <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                            <select
                                value={selectedBatchId}
                                onChange={(e) => setSelectedBatchId(e.target.value)}
                                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 appearance-none cursor-pointer"
                            >
                                {eligibleClassrooms.length === 0 ? (
                                    <option value="">No classrooms available</option>
                                ) : (
                                    eligibleClassrooms.map(room => (
                                        <option key={room.id} value={room.id}>
                                            {room.name}
                                        </option>
                                    ))
                                )}
                            </select>
                            <School className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                            <div className="pointer-events-none absolute right-3 top-2.5 text-slate-400 text-xs">
                                ▼
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                            Student will be enrolled directly into this live batch roster.
                        </p>
                    </div>

                    {/* Resume Effective Date */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Resume Effective Date <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="date"
                                value={resumeDate}
                                onChange={(e) => setResumeDate(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                            />
                            <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                        </div>
                    </div>

                    {/* Fee Due Day & Preview Calculation */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200/70 dark:border-slate-800 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                <CreditCard className="w-3.5 h-3.5 text-[#ecb613]" />
                                Monthly Fee Due Day
                            </label>
                            <div className="flex items-center gap-1">
                                <input
                                    type="number"
                                    min={1}
                                    max={31}
                                    value={collectionDay}
                                    onChange={(e) => setCollectionDay(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
                                    className="w-16 px-2 py-1 text-xs text-center font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                />
                                <span className="text-[11px] text-slate-500">of month</span>
                            </div>
                        </div>

                        {/* Calculated next due */}
                        {previewDueDate && (
                            <div className="p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 text-xs flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                <div className="space-y-0.5">
                                    <div className="font-semibold text-emerald-900 dark:text-emerald-200">
                                        First Fee Due: <strong>{previewDueDate}</strong>
                                    </div>
                                    <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                                        Billing cycle starts fresh from resume date. No back-dated fee debt will be charged for paused months.
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Informational Guidance */}
                    <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/40 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
                        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                        <span className="text-[11px]">
                            Once resumed, the student will immediately appear on the permanent classroom schedule, attendance roster, and live class feeds.
                        </span>
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
                        onClick={handleConfirmResume}
                        disabled={isSubmitting || !selectedBatchId}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Resuming...
                            </>
                        ) : (
                            <>
                                <PlayCircle className="w-3.5 h-3.5" />
                                Confirm Resume Learning
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>,
        document.body
    );
};
