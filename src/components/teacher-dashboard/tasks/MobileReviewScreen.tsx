'use client';

import React, { useState, useEffect } from 'react';
import { 
    ChevronLeft, ChevronRight, CheckCircle, RotateCcw, Loader2, 
    PlayCircle, ExternalLink, Folder, Paperclip, Clock, BookOpen,
    Award, X
} from 'lucide-react';
import { TaskSubmission, formatFileSize } from './types';
import AutoLinkText from '../../../components/common/AutoLinkText';

interface MobileReviewScreenProps {
    isOpen: boolean;
    submission: TaskSubmission | null;
    currentIndex: number;
    totalCount: number;
    onClose: () => void;
    onPrevious: () => void;
    onNext: () => void;
    hasPrevious: boolean;
    hasNext: boolean;
    onSaveReview: (sub: TaskSubmission, updates: {
        status: 'reviewed' | 'approved';
        score?: number | null;
        proficiency_level?: string;
        feedback_text?: string;
    }) => Promise<boolean>;
    isSaving: boolean;
}

export default function MobileReviewScreen({
    isOpen,
    submission,
    currentIndex,
    totalCount,
    onClose,
    onPrevious,
    onNext,
    hasPrevious,
    hasNext,
    onSaveReview,
    isSaving
}: MobileReviewScreenProps) {
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
        if (success && hasNext) {
            onNext();
        } else if (success && !hasNext) {
            onClose();
        }
    };

    const handleRequestResubmission = async () => {
        const success = await onSaveReview(submission, {
            status: 'reviewed',
            score: score === '' ? null : Number(score),
            proficiency_level: proficiency,
            feedback_text: feedback
        });
        if (success && hasNext) {
            onNext();
        } else if (success && !hasNext) {
            onClose();
        }
    };

    const renderMedia = (url?: string) => {
        if (!url) return null;

        const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
        if (ytMatch && ytMatch[1]) {
            return (
                <iframe 
                    className="w-full aspect-video rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 bg-black" 
                    src={`https://www.youtube.com/embed/${ytMatch[1]}`} 
                    title="Student Submission Video"
                    allowFullScreen
                />
            );
        }

        if (url.includes('drive.google.com')) {
            const isFolder = url.includes('/folders/') || url.includes('/drive/folders');
            if (isFolder) {
                return (
                    <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl space-y-3">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-amber-500/20 rounded-lg text-amber-700 shrink-0">
                                <Folder className="w-5 h-5" />
                            </div>
                            <div className="text-xs">
                                <h4 className="font-bold text-slate-900 dark:text-white">Google Drive Folder</h4>
                                <p className="text-slate-500 dark:text-slate-400 mt-0.5">Open in Google Drive to view files.</p>
                            </div>
                        </div>
                        <a 
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 bg-[#ecb613] text-slate-900 font-extrabold text-xs rounded-xl shadow-xs"
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
                        className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700"
                    >
                        <ExternalLink className="w-3.5 h-3.5 text-[#ecb613]" />
                        Open in Google Drive
                    </a>
                </div>
            );
        }

        if (url.includes('/storage/v1/object/public/') || url.match(/\.(mp4|webm|ogg|mp3|wav|m4a)$/i)) {
            const isAudio = url.match(/\.(mp3|wav|ogg|m4a)$/i);
            if (isAudio) {
                return (
                    <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 space-y-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Student Voice/Audio Recording:</span>
                        <audio controls src={url} className="w-full h-10 rounded-lg" />
                    </div>
                );
            }
            return (
                <video 
                    className="w-full rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 bg-black aspect-video max-h-[260px] object-contain"
                    controls
                    src={url}
                />
            );
        }

        return (
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate max-w-[200px]" title={url}>
                    {url}
                </span>
                <a 
                    href={url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="min-h-[44px] flex items-center gap-1.5 px-3 py-1.5 bg-[#ecb613] text-slate-900 font-bold text-xs rounded-lg shrink-0"
                >
                    <PlayCircle className="w-3.5 h-3.5" />
                    Open Work
                </a>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[80] bg-white dark:bg-slate-950 flex flex-col font-sans overflow-hidden">
            {/* Mobile Header Bar */}
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                <button
                    type="button"
                    onClick={onClose}
                    className="min-h-[44px] min-w-[44px] -ml-2 p-2 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95"
                    aria-label="Back to tasks"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>

                <div className="flex-1 text-center px-2 min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono block">
                        Submission {currentIndex} of {totalCount}
                    </span>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
                        {submission.student_name}
                    </h3>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <button
                        type="button"
                        onClick={onPrevious}
                        disabled={!hasPrevious}
                        className="min-h-[44px] min-w-[44px] p-2 flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-20 active:scale-95"
                        title="Previous submission"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                        type="button"
                        onClick={onNext}
                        disabled={!hasNext}
                        className="min-h-[44px] min-w-[44px] p-2 flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-20 active:scale-95"
                        title="Next submission"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Scrollable Mobile Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Student & Task Bar */}
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="w-10 h-10 rounded-full bg-[#ecb613]/20 flex items-center justify-center overflow-hidden shrink-0 border border-[#ecb613]/30">
                        {submission.student_profile_pic_url ? (
                            <img src={submission.student_profile_pic_url} alt={submission.student_name} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-xs font-black text-[#ecb613]">{submission.student_name.charAt(0)}</span>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">{submission.task_title}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            🏫 {submission.classroom_name || 'Individual'} • {new Date(submission.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                    </div>
                </div>

                {/* Task Instructions Accordion */}
                {submission.task_description && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed space-y-1.5">
                        <span className="font-bold text-[10px] uppercase text-slate-400 font-mono block">Instructions:</span>
                        <AutoLinkText text={submission.task_description} />
                    </div>
                )}

                {/* Submitted Work Media */}
                <div className="space-y-2">
                    <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider font-mono flex items-center gap-1.5">
                        <PlayCircle className="w-4 h-4 text-[#ecb613]" />
                        Submitted Work
                    </span>
                    {submission.video_url ? (
                        renderMedia(submission.video_url)
                    ) : (
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 italic">
                            No media submitted.
                        </div>
                    )}

                    {submission.student_notes && (
                        <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/15 text-xs text-slate-700 dark:text-slate-300">
                            <span className="font-bold text-amber-700 block mb-0.5">Note from Student:</span>
                            {submission.student_notes}
                        </div>
                    )}
                </div>

                {/* Grading Controls */}
                <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider font-mono flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-[#ecb613]" />
                        Score & Feedback
                    </span>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                                Score (0 - 10)
                            </label>
                            <input 
                                type="number"
                                min="0"
                                max="10"
                                step="0.5"
                                placeholder="8.5"
                                value={score}
                                onChange={(e) => setScore(e.target.value === '' ? '' : Number(e.target.value))}
                                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-bold outline-none focus:ring-2 focus:ring-[#ecb613]"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                                Proficiency
                            </label>
                            <select
                                value={proficiency}
                                onChange={(e) => setProficiency(e.target.value)}
                                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold outline-none focus:ring-2 focus:ring-[#ecb613]"
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
                            rows={3}
                            placeholder="Add actionable feedback..."
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-[#ecb613]"
                        />
                    </div>

                    <label className="flex items-start gap-3 p-3 bg-rose-50/60 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-900/40 cursor-pointer">
                        <input 
                            type="checkbox"
                            checked={reassign}
                            onChange={(e) => setReassign(e.target.checked)}
                            className="mt-1 rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4"
                        />
                        <div>
                            <span className="text-xs font-extrabold text-rose-700 dark:text-rose-300 block">
                                Request Resubmission
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                Student will be notified to revise and re-record this task.
                            </span>
                        </div>
                    </label>
                </div>
            </div>

            {/* Sticky Mobile Action Footer (Touch target >= 44px) */}
            <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2 shrink-0">
                <button
                    type="button"
                    onClick={handleRequestResubmission}
                    disabled={isSaving}
                    className="min-h-[48px] py-2.5 px-3 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 font-extrabold text-xs rounded-xl border border-rose-200 dark:border-rose-800 flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                    <RotateCcw className="w-4 h-4" />
                    Resubmit
                </button>

                <button
                    type="button"
                    onClick={handleApprove}
                    disabled={isSaving}
                    className="min-h-[48px] py-2.5 px-3 bg-[#ecb613] text-slate-900 font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Approve Task
                </button>
            </div>
        </div>
    );
}
