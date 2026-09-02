'use client';

import React, { useState, useEffect } from 'react';
import { 
    X, CheckCircle, RotateCcw, Loader2, PlayCircle, ExternalLink, 
    Folder, Paperclip, ChevronRight, UserCircle, Clock, BookOpen, 
    AlertCircle, Sparkles, MessageSquare, Award
} from 'lucide-react';
import { TaskSubmission, formatFileSize } from './types';
import AutoLinkText from '../../../components/common/AutoLinkText';

interface ReviewDrawerProps {
    isOpen: boolean;
    submission: TaskSubmission | null;
    onClose: () => void;
    onSaveReview: (sub: TaskSubmission, updates: {
        status: 'reviewed' | 'approved';
        score?: number | null;
        proficiency_level?: string;
        feedback_text?: string;
    }) => Promise<boolean>;
    isSaving: boolean;
    nextSubmission?: TaskSubmission | null;
    onSelectNext?: () => void;
}

export default function ReviewDrawer({
    isOpen,
    submission,
    onClose,
    onSaveReview,
    isSaving,
    nextSubmission,
    onSelectNext
}: ReviewDrawerProps) {
    const [score, setScore] = useState<number | ''>('');
    const [proficiency, setProficiency] = useState('');
    const [feedback, setFeedback] = useState('');
    const [reassign, setReassign] = useState(false);

    useEffect(() => {
        if (submission) {
            setScore(submission.score !== undefined && submission.score !== null ? submission.score : '');
            setProficiency(submission.proficiency_level || '');
            setFeedback(submission.feedback_text || '');
            setReassign(submission.status === 'reviewed');
        }
    }, [submission]);

    if (!isOpen || !submission) return null;

    const handleApprove = async () => {
        const success = await onSaveReview(submission, {
            status: 'approved',
            score: score === '' ? null : Number(score),
            proficiency_level: proficiency,
            feedback_text: feedback
        });
        if (success && nextSubmission && onSelectNext) {
            onSelectNext();
        }
    };

    const handleRequestResubmission = async () => {
        const success = await onSaveReview(submission, {
            status: 'reviewed',
            score: score === '' ? null : Number(score),
            proficiency_level: proficiency,
            feedback_text: feedback
        });
        if (success && nextSubmission && onSelectNext) {
            onSelectNext();
        }
    };

    const handleSaveOnly = async () => {
        await onSaveReview(submission, {
            status: reassign ? 'reviewed' : 'approved',
            score: score === '' ? null : Number(score),
            proficiency_level: proficiency,
            feedback_text: feedback
        });
    };

    const renderMedia = (url?: string) => {
        if (!url) return null;
        
        // YouTube Embed
        const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
        if (ytMatch && ytMatch[1]) {
            return (
                <div className="space-y-1.5">
                    <iframe 
                        className="w-full aspect-video rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 bg-black" 
                        src={`https://www.youtube.com/embed/${ytMatch[1]}`} 
                        title="Student Submission Video"
                        allowFullScreen
                    />
                </div>
            );
        }

        // Google Drive Embed / Link
        if (url.includes('drive.google.com')) {
            const isFolder = url.includes('/folders/') || url.includes('/drive/folders');
            if (isFolder) {
                return (
                    <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl space-y-3">
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-amber-500/20 rounded-xl text-amber-700 dark:text-amber-300 shrink-0">
                                <Folder className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Google Drive Folder</h4>
                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                                    Click below to view the student's submission files directly in Google Drive.
                                </p>
                            </div>
                        </div>
                        <a 
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900 font-extrabold text-xs rounded-xl shadow-xs transition-all"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Open Folder in Google Drive
                        </a>
                    </div>
                );
            }

            const embedUrl = url.replace(/\/view.*$/, '/preview');
            return (
                <div className="space-y-2">
                    <iframe 
                        className="w-full aspect-video rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 bg-slate-900"
                        src={embedUrl}
                        title="Student Submission Preview"
                        allow="autoplay"
                    />
                    <a 
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
                    >
                        <ExternalLink className="w-3.5 h-3.5 text-[#ecb613]" />
                        Open Original in Google Drive
                    </a>
                </div>
            );
        }

        // Direct Video / Audio
        if (url.includes('/storage/v1/object/public/') || url.match(/\.(mp4|webm|ogg|mp3|wav|m4a)$/i)) {
            const isAudio = url.match(/\.(mp3|wav|ogg|m4a)$/i);
            if (isAudio) {
                return (
                    <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 space-y-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Student Audio Recording:</span>
                        <audio controls src={url} className="w-full h-10 rounded-xl" />
                    </div>
                );
            }
            return (
                <video 
                    className="w-full rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 bg-black aspect-video max-h-[340px] object-contain"
                    controls
                    src={url}
                />
            );
        }

        // Generic Link
        return (
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate max-w-[240px]" title={url}>
                    {url}
                </span>
                <a 
                    href={url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900 font-bold text-xs rounded-lg transition-colors shrink-0 shadow-xs"
                >
                    <PlayCircle className="w-3.5 h-3.5" />
                    Open Submission
                </a>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
            <div className="w-full max-w-xl bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="p-5 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-[#ecb613]/20 flex items-center justify-center overflow-hidden border border-[#ecb613]/30 shrink-0">
                            {submission.student_profile_pic_url ? (
                                <img 
                                    src={submission.student_profile_pic_url} 
                                    alt={submission.student_name} 
                                    className="w-full h-full object-cover rounded-2xl" 
                                />
                            ) : (
                                <span className="text-[#ecb613] text-sm font-black">
                                    {submission.student_name.charAt(0)}
                                </span>
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-black text-slate-900 dark:text-white truncate">
                                    {submission.student_name}
                                </h3>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                    submission.status === 'submitted' ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300' :
                                    submission.status === 'reviewed' ? 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300' :
                                    submission.status === 'approved' ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300' :
                                    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
                                }`}>
                                    {submission.status === 'submitted' ? 'Awaiting Review' : submission.status}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                                🏫 {submission.classroom_name || 'Individual Student'} • Submitted {new Date(submission.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>
                    
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200/80 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0"
                        title="Close review drawer"
                        type="button"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content Body */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                    {/* Task Overview Card */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono">
                                Task Details
                            </span>
                            {submission.due_date && (
                                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Due: {new Date(submission.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                </span>
                            )}
                        </div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white">
                            {submission.task_title}
                        </h4>
                        {submission.task_description && (
                            <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-h-24 overflow-y-auto">
                                <AutoLinkText text={submission.task_description} />
                            </div>
                        )}
                        {(submission.inventory_ref_title || submission.file_url) && (
                            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-wrap items-center gap-2 text-xs">
                                {submission.inventory_ref_title && (
                                    <span className="px-2 py-0.5 rounded-lg bg-[#ecb613]/10 text-amber-800 dark:text-amber-300 font-bold flex items-center gap-1">
                                        <BookOpen className="w-3.5 h-3.5" />
                                        {submission.inventory_ref_title}
                                    </span>
                                )}
                                {submission.file_url && (
                                    <a 
                                        href={submission.file_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="px-2 py-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:underline flex items-center gap-1"
                                    >
                                        <Paperclip className="w-3.5 h-3.5 text-amber-600" />
                                        {submission.file_name || 'Attached Material'}
                                    </a>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Student Submission Work */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider font-mono flex items-center gap-1.5">
                                <PlayCircle className="w-4 h-4 text-[#ecb613]" />
                                Student Submission
                            </h4>
                        </div>
                        
                        {submission.video_url ? (
                            renderMedia(submission.video_url)
                        ) : (
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500 italic">
                                No media attachment provided with this submission.
                            </div>
                        )}

                        {submission.student_notes && (
                            <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/15 text-xs text-slate-700 dark:text-slate-300">
                                <span className="font-bold text-amber-700 dark:text-amber-400 block mb-1">Student Note:</span>
                                {submission.student_notes}
                            </div>
                        )}
                    </div>

                    {/* Teacher Review & Grading Form */}
                    <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider font-mono flex items-center gap-1.5">
                            <Award className="w-4 h-4 text-[#ecb613]" />
                            Grading & Feedback
                        </h4>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                                    Score (Out of 10)
                                </label>
                                <input 
                                    type="number"
                                    min="0"
                                    max="10"
                                    step="0.5"
                                    placeholder="e.g. 8.5"
                                    value={score}
                                    onChange={(e) => setScore(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold focus:ring-2 focus:ring-[#ecb613] outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                                    Proficiency Level
                                </label>
                                <select
                                    value={proficiency}
                                    onChange={(e) => setProficiency(e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold focus:ring-2 focus:ring-[#ecb613] outline-none"
                                >
                                    <option value="">Select Level</option>
                                    <option value="Beginner">Beginner</option>
                                    <option value="Developing">Developing</option>
                                    <option value="Proficient">Proficient</option>
                                    <option value="Exemplary">Exemplary</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                                Teacher Feedback
                            </label>
                            <textarea 
                                rows={4}
                                placeholder="Give encouragement or specific tips on breath support, finger posture, rhythm..."
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-[#ecb613] outline-none"
                            />
                        </div>

                        {/* Request Resubmission Option */}
                        <label className="flex items-start gap-3 p-3.5 bg-rose-50/70 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-900/40 cursor-pointer select-none">
                            <input 
                                type="checkbox"
                                checked={reassign}
                                onChange={(e) => setReassign(e.target.checked)}
                                className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                            />
                            <div>
                                <span className="text-xs font-extrabold text-rose-700 dark:text-rose-300 block">
                                    Request Resubmission (Needs Revision)
                                </span>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                    Marks status as "Reviewed" and asks the student to record/submit again with your feedback.
                                </span>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Drawer Footer Actions */}
                <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 shrink-0">
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={handleRequestResubmission}
                            disabled={isSaving}
                            className="py-3 px-4 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 font-extrabold text-xs rounded-xl border border-rose-200 dark:border-rose-800 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-50"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Request Resubmission
                        </button>
                        
                        <button
                            type="button"
                            onClick={handleApprove}
                            disabled={isSaving}
                            className="py-3 px-4 bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900 font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                            Approve Task
                        </button>
                    </div>

                    {nextSubmission && (
                        <button
                            type="button"
                            onClick={onSelectNext}
                            disabled={isSaving}
                            className="w-full py-2 px-3 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center gap-1 transition-colors"
                        >
                            <span>Skip to Next Submission ({nextSubmission.student_name})</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
