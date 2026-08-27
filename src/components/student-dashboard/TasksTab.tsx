'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ClipboardList, Download, Video, X, Loader2, Search, Calendar, Award, CheckCircle2, AlertCircle, Mic, Square, Trash2, Link as LinkIcon, Radio } from 'lucide-react';

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
    submissionType: 'link' | 'upload' | 'audio';
    setSubmissionType: (type: 'link' | 'upload' | 'audio') => void;
    submitAudioBlob: Blob | null;
    setSubmitAudioBlob: (blob: Blob | null) => void;
    isSubmittingTask: boolean;
    handleSubmitTask: (e: React.FormEvent) => Promise<void>;
}

export default function TasksTab({
    assignments,
    selectedAssignment,
    setSelectedAssignment,
    submitVideoUrl,
    setSubmitVideoUrl,
    submissionType,
    setSubmissionType,
    submitAudioBlob,
    setSubmitAudioBlob,
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
            
            // For 'all' filter, exclude completed/approved tasks to keep the task list clean
            return asg.status !== 'approved';
        });
    }, [assignments, searchQuery, activeFilter]);

    // Counts for filter badges
    const counts = useMemo(() => {
        return {
            all: assignments.filter(a => a.status !== 'approved').length,
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
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${
                                    active 
                                        ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900 shadow-sm scale-102'
                                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent'
                                }`}
                            >
                                <span>{tab.label}</span>
                                <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${
                                    active 
                                        ? 'bg-amber-500 text-slate-950 dark:bg-amber-400 dark:text-slate-950'
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredAssignments.map((asg) => {
                        // Dynamic status colors and configuration
                        const statusColors = 
                            asg.status === 'approved' 
                                ? { 
                                    bar: 'bg-emerald-500', 
                                    badge: 'bg-emerald-50/80 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200/50', 
                                    icon: CheckCircle2 
                                } :
                            asg.status === 'reviewed'
                                ? { 
                                    bar: 'bg-blue-500', 
                                    badge: 'bg-blue-50/80 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-200/50', 
                                    icon: Award 
                                } :
                            asg.status === 'submitted'
                                ? { 
                                    bar: 'bg-indigo-500', 
                                    badge: 'bg-indigo-50/80 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border-indigo-200/50', 
                                    icon: Loader2 
                                } :
                                { 
                                    bar: 'bg-amber-500', 
                                    badge: 'bg-amber-50/80 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200/50', 
                                    icon: AlertCircle 
                                };

                        const StatusIcon = statusColors.icon;

                        return (
                            <div 
                                key={asg.id} 
                                className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col justify-between text-left"
                            >
                                {/* Left accent indicator bar */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusColors.bar}`} />

                                <div className="space-y-2.5">
                                    {/* Header: Title and Status badge */}
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="space-y-0.5">
                                            <h4 className="font-extrabold text-sm text-slate-800 dark:text-white line-clamp-1">{asg.title}</h4>
                                            <span className={`inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-2 py-0.2 rounded-full border ${statusColors.badge}`}>
                                                <StatusIcon className={`w-2.5 h-2.5 ${asg.status === 'submitted' ? 'animate-spin' : ''}`} />
                                                {asg.status === 'submitted' ? 'Pending Review' : asg.status}
                                            </span>
                                        </div>

                                        {/* Score / Grade */}
                                        {asg.score !== null && asg.score !== undefined && (
                                            <div className="bg-emerald-500 text-white font-black text-[10px] px-2.5 py-0.5 rounded-full shrink-0 flex items-center gap-0.5 shadow-2xs font-mono">
                                                <Award className="w-3 h-3" />
                                                {asg.score}/10
                                            </div>
                                        )}
                                    </div>

                                    {/* Description */}
                                    <p className="text-xs text-slate-500 dark:text-slate-450 leading-relaxed line-clamp-2">
                                        {asg.description || 'No detailed instructions provided.'}
                                    </p>

                                    {/* Instructor Feedback Bubble */}
                                    {asg.feedback_text && (
                                        <div className="p-2.5 bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 rounded-xl">
                                            <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block font-mono">Feedback</p>
                                            <p className="text-xs text-slate-655 dark:text-slate-350 italic mt-0.5 font-medium leading-relaxed">
                                                "{asg.feedback_text}"
                                            </p>
                                        </div>
                                    )}

                                    {/* Attachment file */}
                                    {asg.file_url && (
                                        <div className="pt-0.5 space-y-1.5">
                                            <a 
                                                href={asg.file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-2xs"
                                            >
                                                <Download className="w-3.5 h-3.5 text-amber-500" />
                                                <span className="truncate max-w-[180px]">{asg.file_name || 'Instruction Attachment'}</span>
                                            </a>
                                            {(asg.file_url.includes('.webm') || asg.file_url.includes('.mp3') || asg.file_url.includes('.wav') || asg.file_url.includes('.m4a') || asg.file_url.includes('.ogg') || (asg.file_name && asg.file_name.toLowerCase().includes('voice'))) && (
                                                <audio src={asg.file_url} controls className="w-full h-8 rounded-lg" />
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Divider & Actions */}
                                <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3 mt-4 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-1 text-slate-450 dark:text-slate-500">
                                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                                        <span className="text-[10px] font-bold">
                                            {asg.due_date ? `Due: ${new Date(asg.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'No due date'}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        {asg.video_url && (
                                            <a 
                                                href={asg.video_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1 shadow-2xs hover:scale-102 active:scale-98 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                                                title="View Submission"
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                                View
                                            </a>
                                        )}
                                        <button 
                                            onClick={() => {
                                                setSelectedAssignment(asg);
                                                setSubmitVideoUrl(asg.video_url || '');
                                            }}
                                            className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1 shadow-2xs hover:scale-102 active:scale-98 cursor-pointer ${
                                                asg.status === 'approved' || asg.status === 'reviewed'
                                                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                                                    : 'bg-amber-500 hover:bg-amber-600 text-slate-900'
                                            }`}
                                        >
                                            <Video className="w-3.5 h-3.5" />
                                            {asg.status === 'pending' ? 'Submit' : 'Resubmit'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}


        </div>
    );
}
