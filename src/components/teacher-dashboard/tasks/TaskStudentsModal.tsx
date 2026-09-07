'use client';

import React, { useState } from 'react';
import { X, Search, CheckCircle, Clock, PlayCircle, Users, ExternalLink } from 'lucide-react';
import { AssignmentBatch, TaskSubmission } from './types';

interface TaskStudentsModalProps {
    batch: AssignmentBatch | null;
    onClose: () => void;
    onReviewSubmission: (sub: TaskSubmission) => void;
}

export default function TaskStudentsModal({
    batch,
    onClose,
    onReviewSubmission
}: TaskStudentsModalProps) {
    const [searchQuery, setSearchQuery] = useState('');

    if (!batch) return null;

    const filteredSubmissions = batch.submissions.filter(s => {
        if (s.student_id === 'draft' || s.student_id === 'no-students') return false;
        if (!searchQuery.trim()) return true;
        return s.student_name.toLowerCase().includes(searchQuery.toLowerCase().trim());
    });

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[65] p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 text-left">
                {/* Header */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 rounded-t-3xl shrink-0">
                    <div className="min-w-0 flex-1 pr-3">
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                                {batch.taskTitle}
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-800 dark:text-amber-300 shrink-0">
                                🏫 {batch.classroomName}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                            {batch.submissions.filter(s => s.student_id !== 'draft' && s.student_id !== 'no-students').length} Assigned Students • Due {batch.dueDate ? new Date(batch.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'No Due Date'}
                        </p>
                    </div>

                    <button 
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors shrink-0"
                        type="button"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input 
                            type="text"
                            placeholder="Search assigned students..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-[#ecb613] outline-none"
                        />
                    </div>
                </div>

                {/* Students List */}
                <div className="p-4 overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-800 space-y-1">
                    {filteredSubmissions.length > 0 ? (
                        filteredSubmissions.map(sub => (
                            <div key={sub.id} className="pt-2 pb-2 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className="w-8 h-8 rounded-full bg-[#ecb613]/20 flex items-center justify-center overflow-hidden shrink-0 border border-[#ecb613]/30">
                                        {sub.student_profile_pic_url ? (
                                            <img src={sub.student_profile_pic_url} alt={sub.student_name} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-xs font-black text-[#ecb613]">{sub.student_name.charAt(0)}</span>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                            {sub.student_name}
                                        </h4>
                                        <span className="text-[10px] text-slate-400 block truncate">
                                            {sub.status === 'submitted' ? `Submitted ${new Date(sub.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` :
                                             sub.status === 'approved' ? `Approved (Score: ${sub.score ?? '—'}/10)` :
                                             sub.status === 'reviewed' ? `Needs Revision` : 'Not Submitted Yet'}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                                        sub.status === 'submitted' ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300' :
                                        sub.status === 'reviewed' ? 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300' :
                                        sub.status === 'approved' ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300' :
                                        'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                                    }`}>
                                        {sub.status}
                                    </span>

                                    {(sub.status === 'submitted' || sub.status === 'reviewed' || sub.status === 'approved') && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onClose();
                                                onReviewSubmission(sub);
                                            }}
                                            className="px-2.5 py-1 bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900 font-bold text-xs rounded-lg shadow-xs flex items-center gap-1 active:scale-95"
                                        >
                                            <PlayCircle className="w-3.5 h-3.5" />
                                            Review
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 text-xs text-slate-500 italic">
                            No students found matching this search.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
