'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Users, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { TaskSubmission } from './types';
import StudentSubmissionRow, { StudentSubmissionCard } from './StudentSubmissionRow';

interface ClassroomSubmissionGroupProps {
    classroomName: string;
    submissions: TaskSubmission[];
    onReview: (sub: TaskSubmission) => void;
    defaultExpanded?: boolean;
}

export default function ClassroomSubmissionGroup({
    classroomName,
    submissions,
    onReview,
    defaultExpanded = true
}: ClassroomSubmissionGroupProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const awaitingCount = submissions.filter(s => s.status === 'submitted').length;
    const reviewedCount = submissions.filter(s => s.status === 'reviewed').length;
    const approvedCount = submissions.filter(s => s.status === 'approved').length;
    const pendingCount = submissions.filter(s => s.status === 'pending').length;
    const totalCount = submissions.length;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
            {/* Header */}
            <div 
                onClick={() => setIsExpanded(prev => !prev)}
                className="p-4 sm:px-5 sm:py-4 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between cursor-pointer select-none hover:bg-slate-100/50 dark:hover:bg-slate-800/70 transition-colors gap-3"
            >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-300 font-bold shrink-0 border border-amber-500/20">
                        🏫
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                                {classroomName}
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
                                {totalCount} {totalCount === 1 ? 'Submission' : 'Submissions'}
                            </span>
                            {awaitingCount > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#ecb613] text-slate-900 shrink-0 shadow-xs">
                                    📥 {awaitingCount} Awaiting Review
                                </span>
                            )}
                        </div>

                        {/* Progress Status Badges */}
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium flex-wrap">
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                {awaitingCount} Awaiting
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                {reviewedCount} Needs Revision
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                {approvedCount} Approved
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <div className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                </div>
            </div>

            {/* Expanded List / Table */}
            {isExpanded && (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono bg-slate-50/50 dark:bg-slate-800/20">
                                    <th className="px-4 py-2.5">Student</th>
                                    <th className="px-4 py-2.5">Classroom</th>
                                    <th className="px-4 py-2.5">Task</th>
                                    <th className="px-4 py-2.5">Submitted</th>
                                    <th className="px-4 py-2.5">Status</th>
                                    <th className="px-4 py-2.5 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {submissions.map(sub => (
                                    <StudentSubmissionRow 
                                        key={sub.id} 
                                        submission={sub} 
                                        onReview={onReview}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden p-3 space-y-3">
                        {submissions.map(sub => (
                            <StudentSubmissionCard 
                                key={sub.id} 
                                submission={sub} 
                                onReview={onReview}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
