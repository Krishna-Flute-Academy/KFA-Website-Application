'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Check, RefreshCw, Volume2, AlertCircle } from 'lucide-react';

interface AudioRecorderWidgetProps {
    onAudioRecorded: (file: File) => void;
    onCancel?: () => void;
    label?: string;
    className?: string;
}

export default function AudioRecorderWidget({
    onAudioRecorded,
    onCancel,
    label = 'Record Voice Note',
    className = ''
}: AudioRecorderWidgetProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [mimeType, setMimeType] = useState<string>('audio/webm');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
                    if (newTime >= 600) { // 10 minutes max limit
                        stopRecording();
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
        setErrorMsg(null);
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Microphone access is not supported by your browser or device.');
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // Determine optimal supported MIME type
            let selectedMime = 'audio/webm';
            let options = {};
            if (typeof MediaRecorder !== 'undefined') {
                if (MediaRecorder.isTypeSupported('audio/webm')) {
                    selectedMime = 'audio/webm';
                    options = { mimeType: selectedMime };
                } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                    selectedMime = 'audio/mp4';
                    options = { mimeType: selectedMime };
                } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
                    selectedMime = 'audio/ogg';
                    options = { mimeType: selectedMime };
                } else if (MediaRecorder.isTypeSupported('audio/wav')) {
                    selectedMime = 'audio/wav';
                    options = { mimeType: selectedMime };
                }
            }
            setMimeType(selectedMime);

            const mediaRecorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: selectedMime });
                setAudioBlob(blob);
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);

                // Stop tracks to release mic
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            if (audioUrl) URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
            setAudioBlob(null);
        } catch (err: any) {
            console.error('Error starting recording:', err);
            setErrorMsg(err.message || 'Could not access microphone.');
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
        setAudioBlob(null);
        setRecordingTime(0);
        setErrorMsg(null);
    };

    const handleConfirmAttach = () => {
        if (!audioBlob) return;
        const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : mimeType.includes('wav') ? 'wav' : 'webm';
        const fileName = `Voice_Note_${Date.now()}.${ext}`;
        const file = new File([audioBlob], fileName, { type: audioBlob.type || mimeType });
        onAudioRecorded(file);
    };

    return (
        <div className={`p-4 bg-amber-50/40 dark:bg-amber-955/10 border border-amber-200/70 dark:border-amber-900/30 rounded-2xl space-y-3 ${className}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                        <Mic className="w-4 h-4" />
                    </div>
                    <div>
                        <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">{label}</h5>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            {isRecording ? 'Recording in progress...' : audioBlob ? 'Voice note recorded' : 'Record voice instruction directly'}
                        </p>
                    </div>
                </div>

                {/* Status timer badge */}
                <div className="flex items-center gap-2">
                    {isRecording && (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-xs font-mono font-bold animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                            {formatTime(recordingTime)}
                        </span>
                    )}
                    {!isRecording && audioBlob && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-mono font-bold">
                            {formatTime(recordingTime)}
                        </span>
                    )}
                </div>
            </div>

            {errorMsg && (
                <div className="flex items-center gap-2 p-2.5 bg-rose-50 dark:bg-rose-955/20 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                </div>
            )}

            {/* Controls area */}
            {!isRecording && !audioBlob && (
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={startRecording}
                        className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                        <Mic className="w-4 h-4" />
                        <span>Start Recording</span>
                    </button>
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="py-2.5 px-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            )}

            {isRecording && (
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={stopRecording}
                        className="flex-1 py-2.5 px-4 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                        <Square className="w-4 h-4 fill-current" />
                        <span>Stop Recording</span>
                    </button>
                </div>
            )}

            {!isRecording && audioBlob && audioUrl && (
                <div className="space-y-3 pt-1">
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
                        <audio src={audioUrl} controls className="w-full h-9 rounded-lg" />
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={discardRecording}
                            className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-900/20 dark:hover:bg-rose-900/30 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Discard recording"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span>Discard</span>
                        </button>
                        <button
                            type="button"
                            onClick={startRecording}
                            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Re-record"
                        >
                            <RefreshCw className="w-4 h-4" />
                            <span>Re-record</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirmAttach}
                            className="flex-1 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                        >
                            <Check className="w-4 h-4" />
                            <span>Attach Voice Note</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
