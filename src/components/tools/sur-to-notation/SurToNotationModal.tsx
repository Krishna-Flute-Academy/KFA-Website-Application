'use client';

import React, { useEffect } from 'react';
import { 
    X, 
    Mic, 
    MicOff, 
    Pause, 
    RotateCcw, 
    ShieldCheck, 
    AlertCircle, 
    Music2, 
    Info
} from 'lucide-react';
import { useSurToNotation } from '../../../hooks/useSurToNotation';
import { useAuthNavigation } from '../../../lib/auth-navigation';
import StudentAccessModal from '../StudentAccessModal';
import RootNoteSelector from '../tuner/RootNoteSelector';
import LivePitchDisplay from './LivePitchDisplay';
import NotationEditor from './NotationEditor';
import TranscriptionStats from './TranscriptionStats';

interface SurToNotationModalProps {
    onClose: () => void;
}

export default function SurToNotationModal({ onClose }: SurToNotationModalProps) {
    const { hasStudentAccess } = useAuthNavigation();
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

    if (!hasStudentAccess) {
        return (
            <StudentAccessModal
                isOpen={true}
                toolName="Flute to Notes (Sur to Notation)"
                onClose={onClose}
            />
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            {/* Modal Window */}
            <div className="relative w-full max-w-4xl lg:max-w-5xl max-h-[92vh] md:max-h-[86vh] flex flex-col bg-[#FAF6F0] rounded-2xl sm:rounded-3xl shadow-2xl border border-amber-900/10 overflow-hidden">
                
                {/* Header */}
                <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3 bg-white border-b border-slate-200/90 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#d46211] border border-orange-100 flex items-center justify-center shrink-0">
                            <Music2 className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                            <div className="flex items-center gap-2">
                                <h2 className="font-black text-sm sm:text-base text-slate-800">
                                    Flute to Notes (Sur to Notation)
                                </h2>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-[#a15912] uppercase tracking-wider">
                                    Live Sargam
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 hidden sm:block">
                                Play your flute — notes are created and written automatically in real time.
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

                {/* Content: 2-column landscape layout to fit window without scrolling */}
                <div className="flex-1 overflow-y-auto md:overflow-hidden p-3 sm:p-4 min-h-0">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 h-full">
                        
                        {/* LEFT COLUMN: Controls, Tuning, Pitch Meter & Audio Stats */}
                        <div className="md:col-span-5 flex flex-col gap-2.5 justify-between min-h-0">
                            
                            {/* Error Banner */}
                            {error && (
                                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800 text-xs text-left shrink-0">
                                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                    <div className="flex-1 text-[11px] leading-tight">
                                        <strong className="font-bold block">Microphone Access Notice</strong>
                                        <span>{error}</span>
                                    </div>
                                </div>
                            )}

                            {/* Flute Root Note (Sa) Tonic Selector */}
                            <RootNoteSelector
                                selectedSa={selectedSa}
                                onSelectSa={setSelectedSa}
                                compact={true}
                            />

                            {/* Microphone Action Controls: Start / Pause / Stop / Clear */}
                            <div className="flex items-center gap-2 shrink-0">
                                {!isListening ? (
                                    <button
                                        type="button"
                                        onClick={start}
                                        className="flex-1 py-2.5 px-3 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
                                    >
                                        <Mic className="w-4 h-4 text-slate-950" />
                                        {status === 'paused' ? 'Resume' : 'Start Listening'}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={pause}
                                        className="flex-1 py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
                                    >
                                        <Pause className="w-4 h-4" />
                                        Pause
                                    </button>
                                )}

                                {status !== 'idle' && (
                                    <button
                                        type="button"
                                        onClick={stop}
                                        className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-[0.99]"
                                    >
                                        <MicOff className="w-3.5 h-3.5 text-rose-400" />
                                        Stop
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={clear}
                                    disabled={!notationText.trim() && tokens.length === 0}
                                    className="py-2.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed font-extrabold text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-[0.99]"
                                    title="Clear All Notes"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Clear
                                </button>
                            </div>

                            {/* Live Flute Sound Note Display */}
                            <div className="flex-1 min-h-[140px] flex flex-col justify-center">
                                <LivePitchDisplay
                                    status={status}
                                    selectedSa={selectedSa}
                                    livePitch={livePitch}
                                    compact={true}
                                />
                            </div>

                            {/* Session Stats (Duration, Notes Count, Mic Signal) */}
                            <TranscriptionStats
                                durationSeconds={durationSeconds}
                                noteCount={tokens.length}
                                status={status}
                                inputVolume={livePitch?.inputVolume}
                                compact={true}
                            />
                        </div>

                        {/* RIGHT COLUMN: Transcribed Notation Sheet & Action Controls */}
                        <div className="md:col-span-7 flex flex-col gap-2 min-h-0 h-full">
                            {/* Real-time Created Notes Area (Sargam Textarea + Copy/Undo/Clear) */}
                            <div className="flex-1 min-h-0">
                                <NotationEditor
                                    notationText={notationText}
                                    onTextChange={setNotationText}
                                    onUndoLastNote={undoLastNote}
                                    onClear={clear}
                                    hasTokens={tokens.length > 0}
                                    compact={true}
                                />
                            </div>

                            {/* Gentle Flute Advice & Privacy Guarantee */}
                            <div className="space-y-1.5 shrink-0 pt-0.5">
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-2.5 py-1.5 flex items-center gap-2 text-left text-[11px] text-slate-700">
                                    <Info className="w-3.5 h-3.5 text-[#d46211] shrink-0" />
                                    <span className="leading-tight">
                                        <strong className="font-bold text-[#a15912]">Tip: </strong>
                                        Play one steady note at a time on your flute. The app automatically transcribes each Sur.
                                    </span>
                                </div>
                                <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
                                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                    <span>Microphone audio is processed locally on your device — never recorded or stored.</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
