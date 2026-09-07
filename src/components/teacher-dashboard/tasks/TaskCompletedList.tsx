'use client';

import React, { useState, useMemo } from 'react';
import { 
    CheckCircle, Search, Filter, Calendar, Award, MessageSquare, 
    ArrowUpDown, PlayCircle, ExternalLink 
} from 'lucide-react';
import { TaskSubmission, Classroom } from './types';

interface TaskCompletedListProps {
    submissions: TaskSubmission[];
    classrooms: Classroom[];
    onReview: (sub: TaskSubmission) => void;
    searchQuery: string;
}

export default function TaskCompletedList({
    submissions,
    classrooms,
    onReview,
    searchQuery
}: TaskCompletedListProps) {
    const [selectedClassroomId, setSelectedClassroomId] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<'all' | 'approved' | 'reviewed'>('all');
    const [dateSort, setDateSort] = useState<'newest' | 'oldest'>('newest');

    // Only show completed (approved or reviewed) submissions
    const completedSubmissions = useMemo(() => {
        return submissions.filter(s => 
            (s.status === 'approved' || s.status === 'reviewed') &&
            s.student_id !== 'draft' && 
            s.student_id !== 'no-students'
        );
    }, [submissions]);

    const activeCompletedClassrooms = useMemo(() => {
        const classMap = new Map<string, { id: string; name: string; count: number }>();
        
        completedSubmissions.forEach(s => {
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
    }, [completedSubmissions]);

    // Apply filters
    const filteredSubmissions = useMemo(() => {
        let list = completedSubmissions;

        if (selectedClassroomId !== 'all') {
            list = list.filter(s => (s.classroom_id || 'individual') === selectedClassroomId);
        }

        if (selectedStatus !== 'all') {
            list = list.filter(s => s.status === selectedStatus);
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

        return [...list].sort((a, b) => {
            const timeA = new Date(a.submitted_at).getTime();
            const timeB = new Date(b.submitted_at).getTime();
            return dateSort === 'newest' ? timeB - timeA : timeA - timeB;
        });
    }, [completedSubmissions, selectedClassroomId, selectedStatus, searchQuery, dateSort]);

    return (
        <div className="space-y-4">
            {/* Filter Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 shadow-xs">
                {/* Status Toggle (All / Approved / Needs Revision) */}
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                        type="button"
                        onClick={() => setSelectedStatus('all')}
                        className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            selectedStatus === 'all'
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                        }`}
                    >
                        All Completed ({completedSubmissions.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedStatus('approved')}
                        className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            selectedStatus === 'approved'
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                        }`}
                    >
                        ✅ Approved ({completedSubmissions.filter(s => s.status === 'approved').length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedStatus('reviewed')}
                        className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            selectedStatus === 'reviewed'
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                        }`}
                    >
                        📝 Needs Revision ({completedSubmissions.filter(s => s.status === 'reviewed').length})
                    </button>
                </div>

                {/* Filters Right: Classroom & Date Sort */}
                <div className="flex items-center gap-2 flex-wrap">
                    <select
                        value={selectedClassroomId}
                        onChange={(e) => setSelectedClassroomId(e.target.value)}
                        className="min-h-[38px] px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#ecb613]"
                    >
                        <option value="all">All Classrooms ({completedSubmissions.length})</option>
                        {activeCompletedClassrooms.map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.count})</option>
                        ))}
                    </select>

                    <button
                        type="button"
                        onClick={() => setDateSort(prev => prev === 'newest' ? 'oldest' : 'newest')}
                        className="min-h-[38px] px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                    >
                        <ArrowUpDown className="w-3.5 h-3.5 text-[#ecb613]" />
                        <span>{dateSort === 'newest' ? 'Newest' : 'Oldest'}</span>
                    </button>
                </div>
            </div>

            {/* List Table */}
            {filteredSubmissions.length > 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono bg-slate-50/70 dark:bg-slate-800/40">
                                    <th className="px-4 py-3">Student</th>
                                    <th className="px-4 py-3">Classroom</th>
                                    <th className="px-4 py-3">Task</th>
                                    <th className="px-4 py-3">Score & Level</th>
                                    <th className="px-4 py-3">Feedback Summary</th>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3 text-right">Review</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredSubmissions.map(sub => (
                                    <tr 
                                        key={sub.id}
                                        onClick={() => onReview(sub)}
                                        className="hover:bg-[#ecb613]/10 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                                    >
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-[#ecb613]/20 flex items-center justify-center overflow-hidden shrink-0 border border-[#ecb613]/30">
                                                    {sub.student_profile_pic_url ? (
                                                        <img src={sub.student_profile_pic_url} alt={sub.student_name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-xs font-black text-[#ecb613]">{sub.student_name.charAt(0)}</span>
                                                    )}
                                                </div>
                                                <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate block">
                                                    {sub.student_name}
                                                </span>
                                            </div>
                                        </td>

                                        <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-400 font-medium truncate max-w-[130px]">
                                            {sub.classroom_name || 'Individual'}
                                        </td>

                                        <td className="px-4 py-3.5">
                                            <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate block max-w-[200px]">
                                                {sub.task_title}
                                            </span>
                                        </td>

                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5">
                                                {sub.score !== undefined && sub.score !== null ? (
                                                    <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200">
                                                        {sub.score}/10
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-400 font-mono">—</span>
                                                )}
                                                {sub.proficiency_level && (
                                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                                        {sub.proficiency_level}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        <td className="px-4 py-3.5">
                                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                                                {sub.feedback_text || <span className="italic text-slate-400">No written feedback</span>}
                                            </p>
                                        </td>

                                        <td className="px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                            {new Date(sub.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                        </td>

                                        <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                type="button"
                                                onClick={() => onReview(sub)}
                                                className="px-3 py-1 text-xs font-bold bg-slate-100 hover:bg-[#ecb613] text-slate-800 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-[#ecb613] dark:hover:text-slate-900 rounded-xl transition-all shadow-xs"
                                            >
                                                View Review
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden p-3 space-y-3">
                        {filteredSubmissions.map(sub => (
                            <div 
                                key={sub.id}
                                onClick={() => onReview(sub)}
                                className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3 cursor-pointer"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-full bg-[#ecb613]/20 flex items-center justify-center overflow-hidden shrink-0 border border-[#ecb613]/30">
                                            {sub.student_profile_pic_url ? (
                                                <img src={sub.student_profile_pic_url} alt={sub.student_name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-xs font-black text-[#ecb613]">{sub.student_name.charAt(0)}</span>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                                                {sub.student_name}
                                            </h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                                🏫 {sub.classroom_name || 'Individual'}
                                            </p>
                                        </div>
                                    </div>

                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border shrink-0 ${
                                        sub.status === 'approved' ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300' :
                                        'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300'
                                    }`}>
                                        {sub.status === 'approved' ? '✅ Approved' : '📝 Revision'}
                                    </span>
                                </div>

                                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl space-y-1">
                                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block truncate">
                                        {sub.task_title}
                                    </span>
                                    {sub.score !== undefined && sub.score !== null && (
                                        <div className="text-xs font-bold text-emerald-600">
                                            Score: {sub.score}/10 {sub.proficiency_level && `• ${sub.proficiency_level}`}
                                        </div>
                                    )}
                                    {sub.feedback_text && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400 italic line-clamp-2">
                                            "{sub.feedback_text}"
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center justify-between pt-1">
                                    <span className="text-xs text-slate-400">
                                        {new Date(sub.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                    </span>

                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onReview(sub);
                                        }}
                                        className="min-h-[44px] px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1 active:scale-95"
                                    >
                                        View Review
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-12 text-center text-slate-500">
                    No completed tasks found for the selected filters.
                </div>
            )}
        </div>
    );
}
