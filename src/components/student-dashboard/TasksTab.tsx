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
    submissionType: 'link' | 'audio';
    setSubmissionType: (type: 'link' | 'audio') => void;
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

    // Audio Recorder States
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<BlobPart[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Clean up audio URL on unmount
    useEffect(() => {
        return () => {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, [audioUrl]);

    // Timer logic
    useEffect(() => {
        if (isRecording) {
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => {
                    const newTime = prev + 1;
                    if (newTime >= 600) { // 10 minutes = 600 seconds
                        stopRecording();
                        alert('Maximum recording limit of 10 minutes reached.');
                        return 600;
                    }
                    return newTime;
                });
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isRecording]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setSubmitAudioBlob(audioBlob);
                const url = URL.createObjectURL(audioBlob);
                setAudioUrl(url);
                
                // Stop all tracks to release microphone
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
            setSubmitAudioBlob(null);
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Could not access your microphone. Please check permissions.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const discardRecording = () => {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
        setSubmitAudioBlob(null);
        setRecordingTime(0);
    };

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

                                    {asg.video_url && (
                                        <a 
                                            href={asg.video_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 shadow-2xs hover:scale-102 active:scale-98 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 border border-slate-200/55 dark:border-slate-700"
                                            title="View Submission"
                                        >
                                            <Download className="w-4 h-4" />
                                            View
                                        </a>
                                    )}
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
                                        {asg.status === 'pending' ? 'Submit' : 'Update'}
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
                                    discardRecording();
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

                            {/* Submission Type Toggle */}
                            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setSubmissionType('link')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${submissionType === 'link' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                                >
                                    <LinkIcon className="w-3.5 h-3.5" />
                                    Provide Link
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSubmissionType('audio')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${submissionType === 'audio' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                                >
                                    <Mic className="w-3.5 h-3.5" />
                                    Record Audio
                                </button>
                            </div>

                            {submissionType === 'link' ? (
                                <div className="space-y-1.5 animate-in slide-in-from-right-4 duration-200">
                                    <label htmlFor="video-url" className="text-[10px] font-black text-slate-500 dark:text-slate-455 uppercase tracking-widest block font-mono">Video / Recording Link</label>
                                    <input 
                                        id="video-url"
                                        type="url"
                                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500 font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                                        placeholder="e.g., YouTube, Google Drive, Soundcloud, or Vimeo link"
                                        value={submitVideoUrl}
                                        onChange={(e) => setSubmitVideoUrl(e.target.value)}
                                        required={submissionType === 'link'}
                                    />
                                    
                                    {/* Guidelines for uploading */}
                                    <details className="mt-3 group rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 open:bg-white dark:open:bg-slate-800 transition-all overflow-hidden cursor-pointer">
                                        <summary className="flex items-center gap-2 px-3 py-2 text-[10px] sm:text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-500 transition-colors list-none outline-none">
                                            <span className="material-symbols-outlined text-sm text-amber-500 transition-transform group-open:rotate-90">play_circle</span>
                                            Need help submitting via YouTube?
                                        </summary>
                                        <div className="px-3 pb-3 pt-1 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 space-y-2 border-t border-slate-200 dark:border-slate-700 ml-1">
                                            <p className="font-semibold text-slate-700 dark:text-slate-300">How to upload an "Unlisted" YouTube video (Free & Private):</p>
                                            <ol className="list-decimal pl-4 space-y-1.5 marker:text-amber-500 marker:font-bold">
                                                <li>Record your practice session using your phone or computer.</li>
                                                <li>Open the YouTube app or website and click the <b>"+"</b> (Create) button.</li>
                                                <li>Select <b>"Upload video"</b> and choose your recording.</li>
                                                <li>Under "Visibility", select <b>"Unlisted"</b> (so only people with the link can watch it).</li>
                                                <li>Wait for the upload to finish, then copy the video link and paste it in the box above!</li>
                                            </ol>
                                            <p className="text-[9px] text-slate-400 italic mt-2">Alternatively, you can share a Google Drive link. Just make sure the link access is set to "Anyone with the link".</p>
                                        </div>
                                    </details>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in slide-in-from-left-4 duration-200 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center">
                                    <div className="flex flex-col items-center justify-center gap-4">
                                        {/* Status indicator */}
                                        <div className="flex items-center justify-center gap-2">
                                            {isRecording && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
                                            <span className={`font-mono text-sm font-bold ${isRecording ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                                                {formatTime(recordingTime)}
                                            </span>
                                        </div>

                                        {/* Controls */}
                                        {!submitAudioBlob ? (
                                            !isRecording ? (
                                                <button
                                                    type="button"
                                                    onClick={startRecording}
                                                    className="w-16 h-16 rounded-full bg-red-100 hover:bg-red-200 dark:bg-red-950 dark:hover:bg-red-900 border-4 border-red-500 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                                                    title="Start Recording"
                                                >
                                                    <Mic className="w-6 h-6 text-red-600 dark:text-red-400" />
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={stopRecording}
                                                    className="w-16 h-16 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 border-4 border-slate-400 dark:border-slate-500 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                                                    title="Stop Recording"
                                                >
                                                    <Square className="w-6 h-6 text-slate-600 dark:text-slate-300 fill-current" />
                                                </button>
                                            )
                                        ) : (
                                            <div className="w-full space-y-4">
                                                {audioUrl && (
                                                    <audio src={audioUrl} controls className="w-full h-10 rounded-lg outline-none" />
                                                )}
                                                <div className="flex justify-center">
                                                    <button
                                                        type="button"
                                                        onClick={discardRecording}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 dark:bg-red-950/30 rounded-lg hover:bg-red-100 transition-colors"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                        Discard & Re-record
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {!submitAudioBlob && !isRecording && (
                                            <p className="text-xs text-slate-500 dark:text-slate-455">Click to start recording your practice session</p>
                                        )}
                                        {isRecording && (
                                            <p className="text-xs text-red-500 animate-pulse">Recording in progress...</p>
                                        )}
                                        {submitAudioBlob && (
                                            <p className="text-xs text-emerald-600 dark:text-emerald-450 font-bold">Recording ready to submit!</p>
                                        )}
                                    </div>
                                </div>
                            )}

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
                                        discardRecording();
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
