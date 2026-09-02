'use client';

import React, { useState, useMemo } from 'react';
import { 
    CheckCircle2, Search, Filter, LayoutGrid, List, Sparkles, 
    Inbox, Users, ArrowUpDown, ChevronRight 
} from 'lucide-react';
import { TaskSubmission, Classroom } from './types';
import StudentSubmissionRow from './StudentSubmissionRow';
import ClassroomSubmissionGroup from './ClassroomSubmissionGroup';

interface TaskReviewQueueProps {
    submissions: TaskSubmission[];
    classrooms: Classroom[];
    onReview: (sub: TaskSubmission) => void;
    searchQuery: string;
}

export default function TaskReviewQueue({
    submissions,
    classrooms,
    onReview,
    searchQuery
}: TaskReviewQueueProps) {
    const [viewMode, setViewMode] = useState<'student' | 'class'>('student');
    const [selectedClassroomId, setSelectedClassroomId] = useState<string>('all');

    // Filter only submissions requiring attention (status === 'submitted')
    const awaitingSubmissions = useMemo(() => {
        return submissions.filter(s => s.status === 'submitted' && s.student_id !== 'draft' && s.student_id !== 'no-students');
    }, [submissions]);

    // Only get classrooms from where submissions have actually arrived
    const activeSubmissionClassrooms = useMemo(() => {
        const classMap = new Map<string, { id: string; name: string; count: number }>();
        
        awaitingSubmissions.forEach(s => {
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
    }, [awaitingSubmissions]);

    // Apply classroom and search query filters
    const filteredSubmissions = useMemo(() => {
        let list = awaitingSubmissions;

        if (selectedClassroomId !== 'all') {
            list = list.filter(s => (s.classroom_id || 'individual') === selectedClassroomId);
        }

        if (searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase().trim();
            list = list.filter(s => 
                s.student_name.toLowerCase().includes(query) ||
                s.task_title.toLowerCase().includes(query) ||
                (s.classroom_name && s.classroom_name.toLowerCase().includes(query))
            );
        }

        // Sort latest submitted first
        return [...list].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
    }, [awaitingSubmissions, selectedClassroomId, searchQuery]);

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
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
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
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                        }`}
                    >
                        <LayoutGrid className="w-4 h-4" />
                        <span>Class View</span>
                    </button>
                </div>

                {/* Classroom Filter Dropdown - Only classes with submissions */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 hidden sm:inline">Classroom:</span>
                    <select
                        value={selectedClassroomId}
                        onChange={(e) => setSelectedClassroomId(e.target.value)}
                        className="min-h-[40px] px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#ecb613]"
                    >
                        <option value="all">All Classrooms ({awaitingSubmissions.length})</option>
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
                                        <th className="px-4 py-3">Submitted Date</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">Review</th>
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
                                <StudentSubmissionRow 
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
                /* Empty Review Inbox */
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-12 text-center shadow-xs flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-4 border border-emerald-500/20">
                        <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                        Inbox Zero! All Submissions Reviewed
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1.5">
                        Great job! There are no student submissions waiting for your feedback right now. New submissions will appear here automatically.
                    </p>
                </div>
            )}
        </div>
    );
}
