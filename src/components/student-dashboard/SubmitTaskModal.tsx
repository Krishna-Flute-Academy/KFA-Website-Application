'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Loader2, Mic, Square, Trash2, Link as LinkIcon, Video } from 'lucide-react';

export interface EnrichedAssignment {
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
    created_at?: string;
    classroom_id?: string;
    classroom_name?: string;
}

interface SubmitTaskModalProps {
    selectedAssignment: EnrichedAssignment | null;
    setSelectedAssignment: (asg: EnrichedAssignment | null) => void;
    submitVideoUrl: string;
    setSubmitVideoUrl: (url: string) => void;
    submitVideoFile: File | null;
    setSubmitVideoFile: (file: File | null) => void;
    submissionType: 'link' | 'upload' | 'audio';
    setSubmissionType: (type: 'link' | 'upload' | 'audio') => void;
    submitAudioBlob: Blob | null;
    setSubmitAudioBlob: (blob: Blob | null) => void;
    isSubmittingTask: boolean;
    handleSubmitTask: (e: React.FormEvent) => Promise<void>;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function SubmitTaskModal({
    selectedAssignment,
    setSelectedAssignment,
    submitVideoUrl,
    setSubmitVideoUrl,
    submitVideoFile,
    setSubmitVideoFile,
    submissionType,
    setSubmissionType,
    submitAudioBlob,
    setSubmitAudioBlob,
    isSubmittingTask,
    handleSubmitTask
}: SubmitTaskModalProps) {
    if (!selectedAssignment) return null;

    // Audio Recorder States
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<BlobPart[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const videoFileInputRef = useRef<HTMLInputElement>(null);

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
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('navigator.mediaDevices.getUserMedia is not supported by your browser/device');
            }
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            });
            
            // Determine optimal MIME type supported by the browser
            let mimeType = 'audio/webm';
            let options = {};
            if (typeof MediaRecorder !== 'undefined') {
                if (MediaRecorder.isTypeSupported('audio/webm')) {
                    mimeType = 'audio/webm';
                    options = { mimeType };
                } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                    mimeType = 'audio/mp4'; // Standard iOS Safari format
                    options = { mimeType };
                } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
                    mimeType = 'audio/ogg';
                    options = { mimeType };
                } else if (MediaRecorder.isTypeSupported('audio/wav')) {
                    mimeType = 'audio/wav';
                    options = { mimeType };
                }
            }

            const mediaRecorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
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
        } catch (error: any) {
            console.error('Error accessing microphone:', error);
            alert(error.message || 'Could not access your microphone. Please check permissions.');
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

    const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setSubmitVideoFile(file);
    };

    const handleClose = () => {
        setSelectedAssignment(null);
        setSubmitVideoUrl('');
        setSubmitVideoFile(null);
        discardRecording();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 text-left">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 shrink-0">
                    <div>
                        <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest block font-mono">Submit Practice Recording</span>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1.5 line-clamp-1">{selectedAssignment.title}</h3>
                    </div>
                    <button 
                        onClick={handleClose} 
                        className="p-1.5 hover:bg-slate-105 dark:hover:bg-slate-800 rounded-full text-slate-400 dark:text-slate-500 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Body */}
                <form onSubmit={handleSubmitTask} className="p-6 space-y-5 overflow-y-auto flex-1">
                    <div className="space-y-1.5 bg-slate-55 dark:bg-slate-850 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Assignment Brief</h4>
                        <p className="text-xs text-slate-550 dark:text-slate-400 leading-relaxed line-clamp-3 mt-1">
                            {selectedAssignment.description || 'No instruction notes provided by the teacher.'}
                        </p>
                    </div>

                    {/* Submission Type Toggle — 3 tabs */}
                    <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setSubmissionType('link')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all ${submissionType === 'link' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                        >
                            <LinkIcon className="w-3 h-3 shrink-0" />
                            Provide Link
                        </button>

                        <button
                            type="button"
                            onClick={() => setSubmissionType('audio')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all ${submissionType === 'audio' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                        >
                            <Mic className="w-3 h-3 shrink-0" />
                            Record Audio
                        </button>
                    </div>

                    {/* ── PROVIDE LINK ── */}
                    {submissionType === 'link' && (
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
                                    <p className="font-semibold text-slate-700 dark:text-slate-300">How to upload an &quot;Unlisted&quot; YouTube video (Free &amp; Private):</p>
                                    <ol className="list-decimal pl-4 space-y-1.5 marker:text-amber-500 marker:font-bold">
                                        <li>Record your practice session using your phone or computer.</li>
                                        <li>Open the YouTube app or website and click the <b>&quot;+&quot;</b> (Create) button.</li>
                                        <li>Select <b>&quot;Upload video&quot;</b> and choose your recording.</li>
                                        <li>Under &quot;Visibility&quot;, select <b>&quot;Unlisted&quot;</b> (so only people with the link can watch it).</li>
                                        <li>Wait for the upload to finish, then copy the video link and paste it in the box above!</li>
                                    </ol>
                                    <p className="text-[9px] text-slate-400 italic mt-2">Alternatively, you can share a Google Drive link. Just make sure the link access is set to &quot;Anyone with the link&quot;.</p>
                                </div>
                            </details>
                        </div>
                    )}

                    {/* ── RECORD AUDIO ── */}

                    {submissionType === 'audio' && (
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
                                                Discard &amp; Re-record
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
                                    &quot;{selectedAssignment.feedback_text}&quot;
                                </p>
                            )}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                        <button 
                            type="button"
                            onClick={handleClose}
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
    );
}
