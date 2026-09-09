'use client';

import React from 'react';
import { PlayCircle, RotateCcw, Eye, Clock, CheckCircle2, ChevronRight, Video, Music, Paperclip, MessageSquare } from 'lucide-react';
import { TaskSubmission } from './types';

interface StudentSubmissionRowProps {
    submission: TaskSubmission;
    onReview: (sub: TaskSubmission) => void;
    isSelected?: boolean;
    onToggleSelect?: (id: string) => void;
    showCheckbox?: boolean;
    variant?: 'row' | 'card';
}

export function StudentSubmissionCard({
    submission,
    onReview,
    isSelected = false,
    onToggleSelect,
    showCheckbox = false
}: Omit<StudentSubmissionRowProps, 'variant'>) {
    const isSubmitted = submission.status === 'submitted';
    const isReviewed = submission.status === 'reviewed';
    const isApproved = submission.status === 'approved';

    return (
        <div 
            onClick={() => onReview(submission)}
            className={`p-4 rounded-2xl border shadow-xs space-y-3 cursor-pointer transition-all ${
                isReviewed
                    ? 'bg-blue-50/30 dark:bg-blue-950/10 border-blue-200/70 dark:border-blue-900/40 hover:bg-blue-50/60 dark:hover:bg-blue-950/20'
                    : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80'
            }`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    {showCheckbox && (
                        <div onClick={(e) => e.stopPropagation()}>
                            <input 
                                type="checkbox"
                                className="rounded border-slate-300 dark:border-slate-700 text-[#ecb613] focus:ring-[#ecb613] cursor-pointer w-4 h-4"
                                checked={isSelected}
                                onChange={() => onToggleSelect && onToggleSelect(submission.id)}
                            />
                        </div>
                    )}
                    <div className="w-10 h-10 rounded-full bg-[#ecb613]/20 flex items-center justify-center overflow-hidden border border-[#ecb613]/30 shrink-0">
                        {submission.student_profile_pic_url ? (
                            <img 
                                src={submission.student_profile_pic_url} 
                                alt={submission.student_name} 
                                className="w-full h-full object-cover" 
                            />
                        ) : (
                            <span className="text-xs font-black text-[#ecb613]">{submission.student_name.charAt(0)}</span>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                            {submission.student_name}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                            🏫 {submission.classroom_name || 'Individual'}
                        </p>
                    </div>
                </div>

                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border shrink-0 ${
                    isSubmitted ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300' :
                    isReviewed ? 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300' :
                    isApproved ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300' :
                    'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                    {isSubmitted ? '📥 Awaiting Review' : isReviewed ? '↻ Revision Requested' : isApproved ? '✅ Approved' : submission.status}
                </span>
            </div>

            <div className="p-3 bg-slate-50/80 dark:bg-slate-800/60 rounded-xl space-y-1.5">
                <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block truncate">
                    {submission.task_title}
                </span>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>
                        {isReviewed ? 'Revision requested: ' : 'Submitted: '}
                        {new Date(submission.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                    {submission.due_date && <span>Due: {new Date(submission.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                </div>

                {isReviewed && (
                    <div className="pt-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-blue-500 shrink-0" />
                        <span>Waiting for revision</span>
                    </div>
                )}
            </div>

            {/* Previous Teacher Feedback (if revision requested) */}
            {isReviewed && submission.feedback_text && (
                <div className="p-2.5 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30 text-xs">
                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block mb-0.5">Previous Feedback</span>
                    <p className="text-slate-700 dark:text-slate-300 line-clamp-2 italic">
                        &quot;{submission.feedback_text}&quot;
                    </p>
                </div>
            )}

            <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-bold">
                    {submission.video_url && <PlayCircle className="w-4 h-4" />}
                    {submission.file_url && <Paperclip className="w-3.5 h-3.5" />}
                    <span>{submission.video_url ? (isReviewed ? 'Link attached • Reviewable' : 'Media attached') : 'Ready for review'}</span>
                </div>

                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onReview(submission);
                    }}
                    className={`min-h-[44px] px-4 py-2 font-black text-xs rounded-xl shadow-xs flex items-center gap-1.5 active:scale-95 transition-all ${
                        isSubmitted
                            ? 'bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900'
                            : isReviewed
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                >
                    {isSubmitted ? (
                        <>
                            <PlayCircle className="w-4 h-4" />
                            <span>Review</span>
                        </>
                    ) : isReviewed ? (
                        <>
                            <RotateCcw className="w-4 h-4" />
                            <span>Reopen Review</span>
                        </>
                    ) : (
                        <>
                            <Eye className="w-4 h-4" />
                            <span>View Review</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

export default function StudentSubmissionRow({
    submission,
    onReview,
    isSelected = false,
    onToggleSelect,
    showCheckbox = false,
    variant = 'row'
}: StudentSubmissionRowProps) {
    if (variant === 'card') {
        return (
            <StudentSubmissionCard
                submission={submission}
                onReview={onReview}
                isSelected={isSelected}
                onToggleSelect={onToggleSelect}
                showCheckbox={showCheckbox}
            />
        );
    }

    const isSubmitted = submission.status === 'submitted';
    const isReviewed = submission.status === 'reviewed';
    const isApproved = submission.status === 'approved';

    return (
        <tr 
            onClick={() => onReview(submission)}
            className={`hover:bg-[#ecb613]/10 dark:hover:bg-slate-800/80 cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-800 ${
                isSelected ? 'bg-[#ecb613]/15 font-semibold' : isReviewed ? 'bg-blue-50/20 dark:bg-blue-950/10' : ''
            }`}
        >
            {showCheckbox && (
                <td className="w-10 px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                    <input 
                        type="checkbox"
                        className="rounded border-slate-300 dark:border-slate-700 text-[#ecb613] focus:ring-[#ecb613] cursor-pointer w-4 h-4"
                        checked={isSelected}
                        onChange={() => onToggleSelect && onToggleSelect(submission.id)}
                    />
                </td>
            )}

            {/* Student Info */}
            <td className="px-4 py-3.5">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#ecb613]/20 flex items-center justify-center overflow-hidden border border-[#ecb613]/30 shrink-0">
                        {submission.student_profile_pic_url ? (
                            <img 
                                src={submission.student_profile_pic_url} 
                                alt={submission.student_name} 
                                className="w-full h-full object-cover rounded-full" 
                                loading="lazy"
                            />
                        ) : (
                            <span className="text-[#ecb613] text-xs font-black">
                                {submission.student_name.charAt(0)}
                            </span>
                        )}
                    </div>
                    <div className="min-w-0">
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate block">
                            {submission.student_name}
                        </span>
                        {isReviewed && (
                            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 block mt-0.5">
                                Waiting for revision
                            </span>
                        )}
                    </div>
                </div>
            </td>

            {/* Classroom */}
            <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-400 font-medium truncate max-w-[140px]">
                {submission.classroom_name || 'Individual'}
            </td>

            {/* Task Title & Feedback snippet */}
            <td className="px-4 py-3.5">
                <div className="min-w-0 max-w-[260px]">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate block">
                        {submission.task_title}
                    </span>
                    {isReviewed && submission.feedback_text ? (
                        <span className="text-[11px] text-blue-700/90 dark:text-blue-300/90 truncate block italic mt-0.5">
                            💬 &quot;{submission.feedback_text}&quot;
                        </span>
                    ) : submission.inventory_ref_title ? (
                        <span className="text-[10px] text-amber-700 dark:text-amber-300 truncate block mt-0.5">
                            📖 {submission.inventory_ref_title}
                        </span>
                    ) : null}
                </div>
            </td>

            {/* Submission Date / Revision Date */}
            <td className="px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {new Date(submission.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </td>

            {/* Status Badge */}
            <td className="px-4 py-3.5 whitespace-nowrap">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                    isSubmitted ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300' :
                    isReviewed ? 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300' :
                    isApproved ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300' :
                    'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                    {isSubmitted ? '📥 Awaiting Review' : isReviewed ? '↻ Needs Revision' : isApproved ? '✅ Approved' : submission.status}
                </span>
            </td>

            {/* Action Button */}
            <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                <button 
                    type="button"
                    onClick={() => onReview(submission)}
                    className={`px-3.5 py-1.5 text-xs font-black rounded-xl transition-all shadow-xs flex items-center gap-1.5 ml-auto active:scale-95 ${
                        isSubmitted 
                            ? 'bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900' 
                            : isReviewed
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                >
                    {isSubmitted ? (
                        <>
                            <PlayCircle className="w-3.5 h-3.5" />
                            <span>Review</span>
                        </>
                    ) : isReviewed ? (
                        <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reopen Review</span>
                        </>
                    ) : (
                        <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Review</span>
                        </>
                    )}
                </button>
            </td>
        </tr>
    );
}
