'use client';

import React, { useState } from 'react';
import { 
    Check, 
    RotateCcw, 
    Trophy, 
    Sparkles, 
    Mic, 
    MicOff, 
    Pause, 
    ChevronRight, 
    AlertCircle, 
    Edit3, 
    Volume2,
    CheckCircle2,
    HelpCircle
} from 'lucide-react';
import { 
    EXERCISE_PRESETS, 
    normalizeSur 
} from '../../../lib/audio/notation/exerciseValidation';
import { UseSurToNotationExerciseReturn } from '../../../hooks/useSurToNotationExercise';
import TunerMeter from '../tuner/TunerMeter';

interface NotationExerciseViewProps {
    exercise: UseSurToNotationExerciseReturn;
}

export default function NotationExerciseView({ exercise }: NotationExerciseViewProps) {
    const {
        status,
        isListening,
        selectedSa,
        sequence,
        currentIndex,
        expectedNote,
        isComplete,
        feedback,
        livePitch,
        error,
        start,
        pause,
        stop,
        restart,
        setSequence
    } = exercise;

    const [isCustomMode, setIsCustomMode] = useState(false);
    const [customInput, setCustomInput] = useState(sequence.join(' '));

    const handleSelectPreset = (presetSeq: readonly string[]) => {
        setIsCustomMode(false);
        setSequence([...presetSeq]);
    };

    const handleApplyCustom = () => {
        const tokens = customInput.trim().split(/\s+/).filter(Boolean);
        const validTokens = tokens.filter(t => !!normalizeSur(t));
        if (validTokens.length === 0) {
            alert('Please enter valid Hindustani swaras (e.g. S R G m P D N).');
            return;
        }
        setSequence(validTokens);
        setIsCustomMode(false);
    };

    const normExpected = normalizeSur(expectedNote);
    const targetDevanagari = normExpected?.devanagari || '';
    const targetFullName = normExpected?.canonicalName || expectedNote;

    return (
        <div className="space-y-4 sm:space-y-5 text-left animate-in fade-in duration-200">
            
            {/* Error Banner */}
            {error && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-800 text-xs">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <strong className="font-bold block">Microphone Notice</strong>
                        <span>{error}</span>
                    </div>
                </div>
            )}

            {/* Exercise Presets Carousel / Badges */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2.5 px-1">
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                        Practice Sequence Presets
                    </span>
                    <button
                        type="button"
                        onClick={() => setIsCustomMode(!isCustomMode)}
                        className="text-[11px] font-extrabold text-[#d46211] hover:text-amber-800 flex items-center gap-1 transition-colors"
                    >
                        <Edit3 className="w-3 h-3" />
                        {isCustomMode ? 'Show Presets' : 'Custom Sequence'}
                    </button>
                </div>

                {!isCustomMode ? (
                    <div className="flex flex-wrap gap-1.5">
                        {EXERCISE_PRESETS.map(preset => {
                            const isSelected = sequence.join(' ') === preset.sequence.join(' ');
                            return (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => handleSelectPreset(preset.sequence)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all border ${
                                        isSelected
                                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    {preset.name}
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex items-center gap-2 mt-1">
                        <input
                            type="text"
                            value={customInput}
                            onChange={(e) => setCustomInput(e.target.value)}
                            placeholder="Type notation e.g. S R G M P M G R S"
                            className="flex-1 px-3.5 py-2 font-mono font-bold text-xs bg-[#FAF6F0] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ecb613]/50"
                        />
                        <button
                            type="button"
                            onClick={handleApplyCustom}
                            className="px-4 py-2 bg-slate-900 text-white font-black text-xs rounded-xl hover:bg-slate-800 transition-colors shrink-0"
                        >
                            Set Notes
                        </button>
                    </div>
                )}
            </div>

            {/* Sequence Progression Strip */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-400 mb-3 px-1">
                    <span>PROGRESSION ({Math.min(currentIndex, sequence.length)}/{sequence.length})</span>
                    <span className="text-slate-600 font-mono">Tonic Sa: <strong>{selectedSa}</strong></span>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                    {sequence.map((noteToken, idx) => {
                        const isPast = idx < currentIndex;
                        const isCurrent = idx === currentIndex && !isComplete;
                        const isFuture = idx > currentIndex;

                        return (
                            <div
                                key={`${noteToken}-${idx}`}
                                className={`flex flex-col items-center justify-center min-w-[52px] sm:min-w-[60px] h-16 sm:h-20 rounded-2xl border transition-all select-none relative ${
                                    isPast
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                        : isCurrent
                                            ? 'bg-amber-500/10 border-amber-500 text-slate-950 ring-2 ring-amber-400 ring-offset-2 scale-105 shadow-md'
                                            : 'bg-slate-50/70 border-slate-200 text-slate-400 opacity-60'
                                }`}
                            >
                                <span className="font-black font-mono text-base sm:text-xl">
                                    {noteToken}
                                </span>

                                {isPast && (
                                    <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center mt-1">
                                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                                    </div>
                                )}

                                {isCurrent && (
                                    <span className="text-[9px] font-black uppercase text-[#a15912] mt-0.5 tracking-wider">
                                        Target
                                    </span>
                                )}

                                {isFuture && (
                                    <span className="text-[9px] font-bold text-slate-400 mt-1">
                                        #{idx + 1}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Main Interactive Target Note Card */}
            {!isComplete ? (
                <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs text-center relative overflow-hidden">
                    {/* Feedback Status Header */}
                    <div className="flex items-center justify-between text-xs font-bold mb-3 px-1">
                        <span className="text-slate-400 text-[11px] uppercase tracking-wider">
                            Current Target
                        </span>

                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold border transition-all ${
                            feedback.status === 'correct'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 animate-pulse'
                                : feedback.status === 'incorrect'
                                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                                    : isListening
                                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                                        : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                            <span className={`w-2 h-2 rounded-full ${
                                feedback.status === 'correct'
                                    ? 'bg-emerald-500'
                                    : feedback.status === 'incorrect'
                                        ? 'bg-rose-500'
                                        : isListening
                                            ? 'bg-amber-500 animate-pulse'
                                            : 'bg-slate-400'
                            }`} />
                            {feedback.message}
                        </span>
                    </div>

                    {/* Giant Expected Note Display */}
                    <div className="my-2 select-none">
                        <div className="font-black text-6xl sm:text-8xl tracking-tight text-slate-900 flex items-center justify-center gap-2 sm:gap-3">
                            <span>{expectedNote}</span>
                            {targetDevanagari && (
                                <span className="text-2xl sm:text-4xl font-extrabold text-[#d46211] opacity-90">
                                    ({targetDevanagari})
                                </span>
                            )}
                        </div>
                        <p className="text-xs sm:text-sm font-extrabold text-slate-500 mt-1">
                            Play: <strong className="text-slate-800">{targetFullName}</strong> on your flute
                        </p>
                    </div>

                    {/* Detected Note & Tuning Deviation Meter */}
                    <div className="my-3 pt-2">
                        <TunerMeter
                            cents={livePitch && livePitch.confidence !== 'silence' ? livePitch.cents : null}
                            status={livePitch && livePitch.confidence !== 'silence' ? livePitch.tuningStatus : null}
                            isActive={isListening}
                            inTuneTolerance={35}
                        />
                    </div>

                    {/* Detection Summary Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-100 text-center">
                        <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Live Detection</span>
                            <span className="font-black text-xs sm:text-sm text-slate-800">
                                {livePitch?.formattedSwara || '—'}
                            </span>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pitch (Hz)</span>
                            <span className="font-black text-xs sm:text-sm text-slate-800">
                                {livePitch?.frequency ? `${livePitch.frequency.toFixed(1)} Hz` : '—'}
                            </span>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tonic Sa</span>
                            <span className="font-black text-xs sm:text-sm text-amber-700 font-mono">
                                {selectedSa}
                            </span>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Step</span>
                            <span className="font-black text-xs sm:text-sm text-slate-800">
                                {currentIndex + 1} of {sequence.length}
                            </span>
                        </div>
                    </div>
                </div>
            ) : (
                /* Celebration Card when Sequence is Complete */
                <div className="bg-white border-2 border-emerald-300 rounded-3xl p-6 sm:p-8 shadow-lg text-center animate-in zoom-in-95 duration-200">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
                        <Trophy className="w-8 h-8" />
                    </div>

                    <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                        Exercise Complete
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-sm mx-auto">
                        You successfully played all notes in the notation sequence with proper Sur alignment.
                    </p>

                    <div className="flex items-center justify-center gap-4 my-5">
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-2.5 text-center">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase">Notes</span>
                            <span className="text-base font-black text-slate-800">{sequence.length}</span>
                        </div>
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-2.5 text-center">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase">Tonic</span>
                            <span className="text-base font-black text-amber-600">{selectedSa}</span>
                        </div>
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-2.5 text-center">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase">Sequence</span>
                            <span className="text-base font-black text-slate-800 font-mono">{sequence.join(' ')}</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2.5">
                        <button
                            type="button"
                            onClick={restart}
                            className="py-3 px-6 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-950 font-black text-xs sm:text-sm rounded-2xl shadow-xs transition-all flex items-center gap-2"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Practice Again
                        </button>
                    </div>
                </div>
            )}

            {/* Action Bar: Mic controls & Restart */}
            <div className="flex flex-wrap items-center gap-2.5">
                {!isListening ? (
                    <button
                        type="button"
                        onClick={start}
                        className="flex-1 min-w-[140px] py-3 px-5 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-900 font-black text-xs sm:text-sm rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
                    >
                        <Mic className="w-4 h-4" />
                        {status === 'paused' ? 'Resume Exercise' : 'Start Exercise'}
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
                    onClick={restart}
                    className="py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-extrabold text-xs sm:text-sm rounded-2xl transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-[0.99]"
                    title="Restart Sequence from Beginning"
                >
                    <RotateCcw className="w-4 h-4" />
                    Reset
                </button>
            </div>
        </div>
    );
}
