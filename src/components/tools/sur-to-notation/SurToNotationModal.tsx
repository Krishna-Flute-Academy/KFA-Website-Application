'use client';

import React, { useEffect } from 'react';
import { 
    X, 
    Mic, 
    MicOff, 
    Pause, 
    Play, 
    RotateCcw, 
    ShieldCheck, 
    AlertCircle, 
    Music2, 
    Info,
    Sparkles 
} from 'lucide-react';
import { useSurToNotation } from '../../../hooks/useSurToNotation';
import RootNoteSelector from '../tuner/RootNoteSelector';
import LivePitchDisplay from './LivePitchDisplay';
import NotationEditor from './NotationEditor';
import TranscriptionStats from './TranscriptionStats';

interface SurToNotationModalProps {
    onClose: () => void;
}

export default function SurToNotationModal({ onClose }: SurToNotationModalProps) {
    const {
        status,
        isListening,
        selectedSa,
        livePitch,
        notationText,
        tokens,
        durationSeconds,
        error,
        start,
        pause,
        stop,
        clear,
        undoLastNote,
        setNotationText,
        setSelectedSa
    } = useSurToNotation();

    // Ensure audio stops immediately when modal is unmounted
    useEffect(() => {
        return () => {
            stop();
        };
    }, [stop]);

    // Handle ESC key to cleanly close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                stop();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, stop]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            {/* Modal Window */}
            <div className="relative w-full max-w-2xl max-h-[95vh] flex flex-col bg-[#FAF6F0] rounded-3xl shadow-2xl border border-amber-900/10 overflow-hidden">
                
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 bg-white border-b border-slate-200/90 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#d46211] border border-orange-100 flex items-center justify-center shrink-0">
                            <Music2 className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <div className="flex items-center gap-2">
                                <h2 className="font-black text-sm sm:text-base text-slate-800">
                                    Sur to Notation
                                </h2>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-[#a15912] uppercase tracking-wider">
                                    Hindustani Sargam
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                                Play a note or phrase and convert your Sur into Sargam notation.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            stop();
                            onClose();
                        }}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors shrink-0"
                        title="Close Tool"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
                    
                    {/* Error Banner */}
                    {error && (
                        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-800 text-xs text-left">
                            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <strong className="font-bold block">Microphone Access Notice</strong>
                                <span>{error}</span>
                            </div>
                        </div>
                    )}

                    {/* Root Note (Sa) Tonic Selector */}
                    <RootNoteSelector
                        selectedSa={selectedSa}
                        onSelectSa={setSelectedSa}
                    />

                    {/* Microphone Action Controls: Start / Pause / Stop / Clear */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        {!isListening ? (
                            <button
                                type="button"
                                onClick={start}
                                className="flex-1 min-w-[140px] py-3 px-5 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-900 font-black text-xs sm:text-sm rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
                            >
                                <Mic className="w-4 h-4" />
                                {status === 'paused' ? 'Resume Listening' : 'Start Listening'}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={pause}
                                className="flex-1 min-w-[120px] py-3 px-5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs sm:text-sm rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
                            >
                                <Pause className="w-4 h-4" />
                                Pause
                            </button>
                        )}

                        {status !== 'idle' && (
                            <button
                                type="button"
                                onClick={stop}
                                className="py-3 px-5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs sm:text-sm rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
                            >
                                <MicOff className="w-4 h-4 text-rose-400" />
                                Stop
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={clear}
                            disabled={!notationText.trim() && tokens.length === 0}
                            className="py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed font-extrabold text-xs sm:text-sm rounded-2xl transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-[0.99]"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Clear
                        </button>
                    </div>

                    {/* Live Pitch Display */}
                    <LivePitchDisplay
                        status={status}
                        selectedSa={selectedSa}
                        livePitch={livePitch}
                    />

                    {/* Session Stats (Duration, Count, Mic Signal) */}
                    <TranscriptionStats
                        durationSeconds={durationSeconds}
                        noteCount={tokens.length}
                        status={status}
                        inputVolume={livePitch?.inputVolume}
                    />

                    {/* Real-time Editable Notation Area */}
                    <NotationEditor
                        notationText={notationText}
                        onTextChange={setNotationText}
                        onUndoLastNote={undoLastNote}
                        onClear={clear}
                        hasTokens={tokens.length > 0}
                    />

                    {/* Friendly Advice & Limitations Notice */}
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 flex items-start gap-2.5 text-left text-xs text-slate-700">
                        <Info className="w-4 h-4 text-[#d46211] shrink-0 mt-0.5" />
                        <div className="leading-relaxed">
                            <strong className="font-bold text-[#a15912] block">Tips for Best Results:</strong>
                            Play one steady note at a time in a quiet room. Best suited for Indian flute (Bansuri), humming, or monophonic instruments. Polyphonic accompaniment or background music will reduce transcription accuracy.
                        </div>
                    </div>

                    {/* Privacy Guarantee */}
                    <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 pt-1 pb-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Microphone audio is processed on your device and is not uploaded.</span>
                    </div>

                </div>
            </div>
        </div>
    );
}
