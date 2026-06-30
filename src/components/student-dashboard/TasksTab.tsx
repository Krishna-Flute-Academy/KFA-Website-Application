'use client';

import React, { useState, useMemo } from 'react';
import { ClipboardList, Download, Video, X, Loader2, Search, Calendar, Award, CheckCircle2, AlertCircle } from 'lucide-react';

interface EnrichedAssignment {
    id: string;
    title: string;
    description?: string;
    due_date?: string;
    file_url?: string | null;
    file_name?: string | null;
    file_size?: number | null;
    status: 'pending' | 'submitted' | 'reviewed' | 'approved';
    score?: number | null;
    proficiency_level?: string | null;
    feedback_text?: string | null;
    video_url?: string | null;
    submitted_at?: string | null;
}

interface TasksTabProps {
    assignments: EnrichedAssignment[];
    selectedAssignment: EnrichedAssignment | null;
    setSelectedAssignment: (asg: EnrichedAssignment | null) => void;
    submitVideoUrl: string;
    setSubmitVideoUrl: (url: string) => void;
    isSubmittingTask: boolean;
    handleSubmitTask: (e: React.FormEvent) => Promise<void>;
}

export default function TasksTab({
    assignments,
    selectedAssignment,
    setSelectedAssignment,
    submitVideoUrl,
    setSubmitVideoUrl,
    isSubmittingTask,
    handleSubmitTask
}: TasksTabProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'submitted' | 'graded'>('all');

    // Filter and search logic
    const filteredAssignments = useMemo(() => {
        return assignments.filter(asg => {
            // 1. Search filter
            const matchesSearch = 
                asg.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                (asg.description || '').toLowerCase().includes(searchQuery.toLowerCase());
            
            if (!matchesSearch) return false;

            // 2. Status filter
            if (activeFilter === 'pending') return asg.status === 'pending';
            if (activeFilter === 'submitted') return asg.status === 'submitted';
            if (activeFilter === 'graded') return asg.status === 'reviewed' || asg.status === 'approved';
            
            return true;
        });
    }, [assignments, searchQuery, activeFilter]);

    // Counts for filter badges
    const counts = useMemo(() => {
        return {
            all: assignments.length,
            pending: assignments.filter(a => a.status === 'pending').length,
            submitted: assignments.filter(a => a.status === 'submitted').length,
            graded: assignments.filter(a => a.status === 'reviewed' || a.status === 'approved').length
        };
    }, [assignments]);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header and Controls */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs text-left">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h3 className="font-extrabold text-slate-808 dark:text-white text-base">Tasks & Submissions</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Submit practice video recordings and review instructor feedback</p>
                    </div>

                    {/* Search Bar */}
                    <div className="relative max-w-md w-full md:w-72">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text"
                            placeholder="Search tasks..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 transition-all"
                        />
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex flex-wrap gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                    {[
                        { id: 'all', label: 'All Tasks', count: counts.all },
                        { id: 'pending', label: 'Pending', count: counts.pending, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/20' },
                        { id: 'submitted', label: 'Submitted', count: counts.submitted, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20' },
                        { id: 'graded', label: 'Graded', count: counts.graded, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20' }
                    ].map(tab => {
                        const active = activeFilter === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveFilter(tab.id as any)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                                    active 
                                        ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs'
                                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
                                }`}
                            >
                                <span>{tab.label}</span>
                                <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-black ${
                                    active 
                                        ? 'bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900'
                                        : tab.color || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                }`}>
                                    {tab.count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Assignments Grid */}
            {filteredAssignments.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center text-slate-400">
                    <ClipboardList className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3 animate-pulse" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No assignments found.</p>
                    <p className="text-xs text-slate-500 dark:text-slate-455 mt-1">Try resetting filters or changing your search query.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredAssignments.map((asg) => {
                        // Dynamic status color configs
                        const statusConfig = 
                            asg.status === 'approved' 
                                ? { bg: 'from-emerald-500/5 to-emerald-600/5 border-emerald-200 dark:border-emerald-950/30', badge: 'bg-emerald-500 text-white', icon: CheckCircle2 } :
                            asg.status === 'reviewed'
                                ? { bg: 'from-blue-500/5 to-blue-600/5 border-blue-200 dark:border-blue-950/30', badge: 'bg-blue-500 text-white', icon: Award } :
                            asg.status === 'submitted'
                                ? { bg: 'from-indigo-500/5 to-indigo-600/5 border-indigo-200 dark:border-indigo-950/30', badge: 'bg-indigo-500 text-white', icon: Loader2 } :
                                { bg: 'from-amber-500/5 to-amber-600/5 border-amber-200 dark:border-amber-950/30', badge: 'bg-amber-500 text-white', icon: AlertCircle };

                        const StatusIcon = statusConfig.icon;

                        return (
                            <div 
                                key={asg.id} 
                                className={`bg-gradient-to-br ${statusConfig.bg} border rounded-3xl p-6 hover:shadow-md transition-all flex flex-col justify-between text-left`}
                            >
                                <div className="space-y-4">
                                    {/* Header */}
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="space-y-1">
                                            <h4 className="font-extrabold text-sm text-slate-808 dark:text-white line-clamp-1">{asg.title}</h4>
                                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-slate-400 dark:text-slate-500">
                                                <StatusIcon className="w-3 h-3" />
                                                {asg.status === 'submitted' ? 'Submitted (Pending Review)' : asg.status}
                                            </span>
                                        </div>
                                        {asg.score !== null && asg.score !== undefined && (
                                            <div className="bg-emerald-500 text-white font-black text-xs px-3 py-1 rounded-2xl shrink-0 flex items-center gap-1 shadow-2xs font-mono">
                                                <Award className="w-3.5 h-3.5" />
                                                {asg.score}/10
                                            </div>
                                        )}
                                    </div>

                                    {/* Description */}
                                    <p className="text-xs text-slate-505 dark:text-slate-400 leading-relaxed line-clamp-3">
                                        {asg.description || 'No detailed instructions provided.'}
                                    </p>

                                    {/* Attachment file */}
                                    {asg.file_url && (
                                        <div className="pt-1">
                                            <a 
                                                href={asg.file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-2xs"
                                            >
                                                <Download className="w-4 h-4 text-amber-500" />
                                                <span className="truncate max-w-[180px]">{asg.file_name || 'Download Attachment'}</span>
                                            </a>
                                        </div>
                                    )}
                                </div>

                                {/* Divider & Actions */}
                                <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 mt-5 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-1.5 text-slate-400">
                                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                                        <span className="text-[10px] font-bold">
                                            {asg.due_date ? `Due: ${new Date(asg.due_date).toLocaleDateString()}` : 'No due date'}
                                        </span>
                                    </div>

                                    <button 
                                        onClick={() => {
                                            setSelectedAssignment(asg);
                                            setSubmitVideoUrl(asg.video_url || '');
                                        }}
                                        className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 shadow-2xs hover:scale-102 active:scale-98 cursor-pointer ${
                                            asg.status === 'approved' || asg.status === 'reviewed'
                                                ? 'bg-slate-150 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 border border-slate-200/55 dark:border-slate-700'
                                                : 'bg-amber-500 hover:bg-amber-600 text-white'
                                        }`}
                                    >
                                        <Video className="w-4 h-4" />
                                        {asg.status === 'pending' ? 'Submit Video' : 'Update Video'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Submit Assignment Modal */}
            {selectedAssignment && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 text-left">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
                            <div>
                                <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest block font-mono">Submit Practice Recording</span>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1.5 line-clamp-1">{selectedAssignment.title}</h3>
                            </div>
                            <button 
                                onClick={() => {
                                    setSelectedAssignment(null);
                                    setSubmitVideoUrl('');
                                }} 
                                className="p-1.5 hover:bg-slate-105 dark:hover:bg-slate-800 rounded-full text-slate-400 dark:text-slate-500 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSubmitTask} className="p-6 space-y-5">
                            <div className="space-y-1.5 bg-slate-55 dark:bg-slate-850 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Assignment Brief</h4>
                                <p className="text-xs text-slate-550 dark:text-slate-400 leading-relaxed line-clamp-3 mt-1">
                                    {selectedAssignment.description || 'No instruction notes provided by the teacher.'}
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="video-url" className="text-[10px] font-black text-slate-500 dark:text-slate-455 uppercase tracking-widest block font-mono">Video / Recording Link</label>
                                <input 
                                    id="video-url"
                                    type="url"
                                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500 font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                                    placeholder="e.g., YouTube, Google Drive, Soundcloud, or Vimeo link"
                                    value={submitVideoUrl}
                                    onChange={(e) => setSubmitVideoUrl(e.target.value)}
                                    required
                                />
                                <p className="text-[9px] text-slate-405 mt-1">
                                    Upload your practice recording to Drive or YouTube (unlisted) and paste the link here.
                                </p>
                            </div>

                            {/* Grade summary */}
                            {(selectedAssignment.score !== undefined && selectedAssignment.score !== null) && (
                                <div className="p-4 bg-emerald-500/5 border border-emerald-100 dark:border-emerald-950/30 rounded-2xl space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-450 uppercase tracking-widest font-mono">Graded Assessment</span>
                                        <span className="font-extrabold text-xs text-emerald-700 bg-emerald-500/10 px-2 py-0.5 rounded-full font-mono">Score: {selectedAssignment.score}/10</span>
                                    </div>
                                    {selectedAssignment.feedback_text && (
                                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed italic">
                                            "{selectedAssignment.feedback_text}"
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Footer */}
                            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setSelectedAssignment(null);
                                        setSubmitVideoUrl('');
                                    }}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-655 dark:text-slate-300 text-xs font-bold rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSubmittingTask}
                                    className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-md hover:shadow-lg disabled:bg-stone-300 disabled:text-slate-500 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
                                >
                                    {isSubmittingTask ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />}
                                    {selectedAssignment.status === 'pending' ? 'Submit Recording' : 'Resubmit Recording'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
