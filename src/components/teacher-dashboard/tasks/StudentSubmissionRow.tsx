'use client';

import React from 'react';
import { PlayCircle, Clock, CheckCircle, ChevronRight, Video, Music, Paperclip } from 'lucide-react';
import { TaskSubmission } from './types';

interface StudentSubmissionRowProps {
    submission: TaskSubmission;
    onReview: (sub: TaskSubmission) => void;
    isSelected?: boolean;
    onToggleSelect?: (id: string) => void;
    showCheckbox?: boolean;
}

export default function StudentSubmissionRow({
    submission,
    onReview,
    isSelected = false,
    onToggleSelect,
    showCheckbox = false
}: StudentSubmissionRowProps) {
    const isSubmitted = submission.status === 'submitted';

    return (
        <>
            {/* Desktop Table Row (md and above) */}
            <tr 
                onClick={() => onReview(submission)}
                className={`hidden md:table-row hover:bg-[#ecb613]/10 dark:hover:bg-slate-800 cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-800 ${
                    isSelected ? 'bg-[#ecb613]/15 font-semibold' : ''
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
                        </div>
                    </div>
                </td>

                {/* Classroom */}
                <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-400 font-medium truncate max-w-[140px]">
                    {submission.classroom_name || 'Individual'}
                </td>

                {/* Task Title */}
                <td className="px-4 py-3.5">
                    <div className="min-w-0 max-w-[240px]">
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate block">
                            {submission.task_title}
                        </span>
                        {submission.inventory_ref_title && (
                            <span className="text-[10px] text-amber-700 dark:text-amber-300 truncate block">
                                📖 {submission.inventory_ref_title}
                            </span>
                        )}
                    </div>
                </td>

                {/* Submission Date */}
                <td className="px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {new Date(submission.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </td>

                {/* Status Badge */}
                <td className="px-4 py-3.5 whitespace-nowrap">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                        submission.status === 'submitted' ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300' :
                        submission.status === 'reviewed' ? 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300' :
                        submission.status === 'approved' ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300' :
                        'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                        {submission.status === 'submitted' ? '📥 Awaiting Review' : submission.status}
                    </span>
                </td>

                {/* Review Action */}
                <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <button 
                        type="button"
                        onClick={() => onReview(submission)}
                        className={`px-3.5 py-1.5 text-xs font-black rounded-xl transition-all shadow-xs flex items-center gap-1.5 ml-auto active:scale-95 ${
                            isSubmitted 
                                ? 'bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-[#ecb613] hover:text-slate-900'
                        }`}
                    >
                        <PlayCircle className="w-3.5 h-3.5" />
                        <span>Review</span>
                    </button>
                </td>
            </tr>

            {/* Mobile Card (hidden on md and above) */}
            <div 
                onClick={() => onReview(submission)}
                className="md:hidden bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3 cursor-pointer active:bg-slate-50 dark:active:bg-slate-800/80 transition-all"
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

                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border shrink-0 ${
                        submission.status === 'submitted' ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300' :
                        submission.status === 'reviewed' ? 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300' :
                        submission.status === 'approved' ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                        {submission.status === 'submitted' ? 'Awaiting' : submission.status}
                    </span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block truncate">
                        {submission.task_title}
                    </span>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span>Submitted: {new Date(submission.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                        {submission.due_date && <span>Due: {new Date(submission.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                    </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 font-bold">
                        {submission.video_url && <PlayCircle className="w-4 h-4" />}
                        {submission.file_url && <Paperclip className="w-3.5 h-3.5" />}
                        <span>{submission.video_url ? 'Media attached' : 'Ready for review'}</span>
                    </div>

                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onReview(submission);
                        }}
                        className="min-h-[44px] px-4 py-2 bg-[#ecb613] text-slate-900 font-black text-xs rounded-xl shadow-xs flex items-center gap-1.5 active:scale-95"
                    >
                        <span>Review</span>
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </>
    );
}
