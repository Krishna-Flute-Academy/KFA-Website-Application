'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
    CheckCircle2, Search, Filter, LayoutGrid, List, Sparkles, 
    Inbox, Users, ArrowUpDown, ChevronRight, RotateCcw, Award
} from 'lucide-react';
import { TaskSubmission, Classroom } from './types';
import StudentSubmissionRow, { StudentSubmissionCard } from './StudentSubmissionRow';
import ClassroomSubmissionGroup from './ClassroomSubmissionGroup';

export type ReviewSubTab = 'awaiting' | 'revision' | 'approved';

interface TaskReviewQueueProps {
    submissions: TaskSubmission[];
    classrooms: Classroom[];
    onReview: (sub: TaskSubmission) => void;
    searchQuery: string;
    activeSubTab?: ReviewSubTab;
    onSubTabChange?: (tab: ReviewSubTab) => void;
}

export default function TaskReviewQueue({
    submissions,
    classrooms,
    onReview,
    searchQuery,
    activeSubTab,
    onSubTabChange
}: TaskReviewQueueProps) {
    const [internalSubTab, setInternalSubTab] = useState<ReviewSubTab>('awaiting');
    const subTab = activeSubTab !== undefined ? activeSubTab : internalSubTab;
    const setSubTab = (tab: ReviewSubTab) => {
        setInternalSubTab(tab);
        if (onSubTabChange) onSubTabChange(tab);
    };

    const [viewMode, setViewMode] = useState<'student' | 'class'>('student');
    const [selectedClassroomId, setSelectedClassroomId] = useState<string>('all');

    // 1. Separate actual statuses from valid students
    const validSubmissions = useMemo(() => {
        return submissions.filter(s => s.student_id !== 'draft' && s.student_id !== 'no-students');
    }, [submissions]);

    const awaitingSubmissions = useMemo(() => {
        return validSubmissions.filter(s => s.status === 'submitted');
    }, [validSubmissions]);

    const revisionSubmissions = useMemo(() => {
        return validSubmissions.filter(s => s.status === 'reviewed');
    }, [validSubmissions]);

    const approvedSubmissions = useMemo(() => {
        return validSubmissions.filter(s => s.status === 'approved');
    }, [validSubmissions]);

    // Active sub-tab list
    const activeSubmissionsList = useMemo(() => {
        if (subTab === 'revision') return revisionSubmissions;
        if (subTab === 'approved') return approvedSubmissions;
        return awaitingSubmissions;
    }, [subTab, awaitingSubmissions, revisionSubmissions, approvedSubmissions]);

    // Only get classrooms from where submissions exist in the active sub-tab
    const activeSubmissionClassrooms = useMemo(() => {
        const classMap = new Map<string, { id: string; name: string; count: number }>();
        
        activeSubmissionsList.forEach(s => {
            const id = s.classroom_id || 'individual';
            const name = s.classroom_name || 'Individual / Cross-Class';
            const current = classMap.get(id);
            if (current) {
                current.count += 1;
            } else {
                classMap.set(id, { id, name, count: 1 });
            }
        });

        return Array.from(classMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [activeSubmissionsList]);

    // Apply classroom and search query filters
    const filteredSubmissions = useMemo(() => {
        let list = activeSubmissionsList;

        if (selectedClassroomId !== 'all') {
            list = list.filter(s => (s.classroom_id || 'individual') === selectedClassroomId);
        }

        if (searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase().trim();
            list = list.filter(s => 
                s.student_name.toLowerCase().includes(query) ||
                s.task_title.toLowerCase().includes(query) ||
                (s.classroom_name && s.classroom_name.toLowerCase().includes(query)) ||
                (s.feedback_text && s.feedback_text.toLowerCase().includes(query))
            );
        }

        // Sort latest submitted first
        return [...list].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
    }, [activeSubmissionsList, selectedClassroomId, searchQuery]);

    // Group by classroom for Class View
    const groupedByClassroom = useMemo(() => {
        const map: Record<string, TaskSubmission[]> = {};

        filteredSubmissions.forEach(sub => {
            const groupKey = sub.classroom_name || 'Individual Students';
            if (!map[groupKey]) {
                map[groupKey] = [];
            }
            map[groupKey].push(sub);
        });

        return Object.entries(map).map(([className, subs]) => ({
            className,
            submissions: subs
        }));
    }, [filteredSubmissions]);

    return (
        <div className="space-y-4">
            {/* 3 Clear Review Filter Tabs */}
            <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/70 rounded-2xl overflow-x-auto scrollbar-none">
                <button
                    type="button"
                    onClick={() => {
                        setSubTab('awaiting');
                        setSelectedClassroomId('all');
                    }}
                    className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center gap-2 shrink-0 ${
                        subTab === 'awaiting'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/40'
                    }`}
                >
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    <span>Awaiting Review</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        subTab === 'awaiting' 
                            ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300' 
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                        {awaitingSubmissions.length}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => {
                        setSubTab('revision');
                        setSelectedClassroomId('all');
                    }}
                    className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center gap-2 shrink-0 ${
                        subTab === 'revision'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/40'
                    }`}
                >
                    <RotateCcw className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span>Revision Requested</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        subTab === 'revision' 
                            ? 'bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-300' 
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                        {revisionSubmissions.length}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => {
                        setSubTab('approved');
                        setSelectedClassroomId('all');
                    }}
                    className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center gap-2 shrink-0 ${
                        subTab === 'approved'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/40'
                    }`}
                >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Approved</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        subTab === 'approved' 
                            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300' 
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                        {approvedSubmissions.length}
                    </span>
                </button>
            </div>

            {/* Explanatory Banner for Revision Requested */}
            {subTab === 'revision' && (
                <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 rounded-2xl flex items-start gap-3 text-left">
                    <RotateCcw className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-blue-900 dark:text-blue-200">
                        <p className="font-extrabold text-sm">Revision Requested Queue ({revisionSubmissions.length})</p>
                        <p className="text-blue-700 dark:text-blue-300 mt-0.5 leading-relaxed">
                            Submissions where revision or resubmission was requested. Submissions remain accessible here. If the student has since resolved access (e.g. granted Google Drive permissions) on their existing link, click <strong>Reopen Review</strong> to inspect the link and approve it.
                        </p>
                    </div>
                </div>
            )}

            {/* View Controls & Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 shadow-xs">
                {/* View Mode Toggle: Student View vs. Class View */}
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                        type="button"
                        onClick={() => setViewMode('student')}
                        className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            viewMode === 'student'
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <List className="w-4 h-4" />
                        <span>Student View</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('class')}
                        className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            viewMode === 'class'
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <LayoutGrid className="w-4 h-4" />
                        <span>Class View</span>
                    </button>
                </div>

                {/* Classroom Filter Dropdown */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 hidden sm:inline">Classroom:</span>
                    <select
                        value={selectedClassroomId}
                        onChange={(e) => setSelectedClassroomId(e.target.value)}
                        className="min-h-[40px] px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#ecb613]"
                    >
                        <option value="all">All Classrooms ({activeSubmissionsList.length})</option>
                        {activeSubmissionClassrooms.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.name} ({c.count})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Submissions List / Groups */}
            {filteredSubmissions.length > 0 ? (
                viewMode === 'student' ? (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono bg-slate-50/70 dark:bg-slate-800/40">
                                        <th className="px-4 py-3">Student</th>
                                        <th className="px-4 py-3">Classroom</th>
                                        <th className="px-4 py-3">Task Title</th>
                                        <th className="px-4 py-3">
                                            {subTab === 'revision' ? 'Revision Date' : 'Submitted Date'}
                                        </th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSubmissions.map(sub => (
                                        <StudentSubmissionRow 
                                            key={sub.id} 
                                            submission={sub} 
                                            onReview={onReview}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards View */}
                        <div className="md:hidden p-3 space-y-3">
                            {filteredSubmissions.map(sub => (
                                <StudentSubmissionCard 
                                    key={sub.id} 
                                    submission={sub} 
                                    onReview={onReview}
                                />
                            ))}
                        </div>
                    </div>
                ) : (
                    /* Class View */
                    <div className="space-y-4">
                        {groupedByClassroom.map(group => (
                            <ClassroomSubmissionGroup 
                                key={group.className}
                                classroomName={group.className}
                                submissions={group.submissions}
                                onReview={onReview}
                            />
                        ))}
                    </div>
                )
            ) : (
                /* Empty States per sub-tab */
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-12 text-center shadow-xs flex flex-col items-center justify-center">
                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-4 border ${
                        subTab === 'revision' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                        subTab === 'approved' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                        'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    }`}>
                        {subTab === 'revision' ? <RotateCcw className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}
                    </div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                        {subTab === 'awaiting' ? 'Inbox Zero! All Submissions Reviewed' :
                         subTab === 'revision' ? 'No Submissions Waiting for Revision' :
                         'No Approved Submissions Yet'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1.5">
                        {subTab === 'awaiting' ? 'There are no student submissions waiting for your feedback right now. New submissions will appear here automatically.' :
                         subTab === 'revision' ? 'When you request revision or resubmission for any task, it will appear here so you can re-inspect or approve it.' :
                         'Submissions that you approve will be listed here for record and scoring.'}
                    </p>
                </div>
            )}
        </div>
    );
}
