'use client';

import React from 'react';
import { Sparkles, Activity } from 'lucide-react';
import { LivePitchState, ListeningStatus } from '../../../lib/audio/notation/types';
import { RootNote } from '../../../lib/audio/pitch/types';
import TunerMeter from '../tuner/TunerMeter';

interface LivePitchDisplayProps {
    status: ListeningStatus;
    selectedSa: RootNote;
    livePitch: LivePitchState | null;
}

export default function LivePitchDisplay({
    status,
    selectedSa,
    livePitch
}: LivePitchDisplayProps) {
    const isListening = status === 'listening';
    const isPaused = status === 'paused';

    // Primary Swara display (Largest visual element)
    let displaySwara = '—';
    let devanagari = '';
    let westernPitch = '—';
    let frequencyText = '—';
    let centsText = '—';
    let confidenceLabel = isListening ? 'Awaiting Sound' : isPaused ? 'Paused' : 'Stopped';

    if (livePitch && livePitch.confidence !== 'silence') {
        displaySwara = livePitch.formattedSwara || livePitch.swara;
        devanagari = livePitch.devanagari;
        westernPitch = livePitch.westernNote;
        frequencyText = `${livePitch.frequency.toFixed(1)} Hz`;
        const sign = livePitch.cents > 0 ? '+' : '';
        centsText = `${sign}${livePitch.cents} cents`;
        confidenceLabel = livePitch.confidence === 'stable' ? 'Stable' : 'Detecting...';
    } else if (isListening) {
        displaySwara = 'SA';
        confidenceLabel = 'Listening...';
    }

    return (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs text-center relative overflow-hidden">
            {/* Ambient tuning glow when note is steady in tune */}
            {livePitch?.tuningStatus === 'in_tune' && livePitch.confidence === 'stable' && (
                <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none animate-pulse" />
            )}

            {/* Top Bar: Selected Sa & Saptak Classification */}
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-2 px-1">
                <span className="flex items-center gap-1 text-slate-600">
                    <Sparkles className="w-3.5 h-3.5 text-[#ecb613]" />
                    <span>Selected Sa: <strong className="text-slate-800 font-extrabold">{selectedSa}</strong></span>
                </span>

                <div className="flex items-center gap-1.5">
                    {livePitch?.saptakLabel && (
                        <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100 text-[10px] font-extrabold">
                            {livePitch.saptakLabel}
                        </span>
                    )}
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                        isListening 
                            ? (livePitch?.confidence === 'stable' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-amber-50 text-amber-700 border-amber-200')
                            : isPaused 
                                ? 'bg-amber-50 text-amber-600 border-amber-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                            isListening ? (livePitch?.confidence === 'stable' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500') : 'bg-slate-400'
                        }`} />
                        {confidenceLabel}
                    </span>
                </div>
            </div>

            {/* Central Giant Swara Display */}
            <div className="my-3 select-none">
                <div className="font-black text-6xl sm:text-8xl tracking-tight text-slate-900 flex items-center justify-center gap-2 sm:gap-3">
                    <span className="transition-all duration-100 transform">{displaySwara}</span>
                    {devanagari && (
                        <span className="text-2xl sm:text-4xl font-extrabold text-[#d46211] opacity-90">
                            ({devanagari})
                        </span>
                    )}
                </div>

                {/* Subtitle Western Note */}
                <p className="text-xs sm:text-sm font-bold text-slate-500 mt-1">
                    {livePitch?.swaraName ? (
                        <span>{livePitch.swaraName} • <span className="text-slate-700 font-extrabold">{westernPitch}</span></span>
                    ) : (
                        <span>Western Pitch: <strong className="text-slate-700">{westernPitch}</strong></span>
                    )}
                </p>
            </div>

            {/* Subtle Tuning Meter (Cents Deviation) */}
            <div className="my-3">
                <TunerMeter
                    cents={livePitch && livePitch.confidence !== 'silence' ? livePitch.cents : null}
                    status={livePitch && livePitch.confidence !== 'silence' ? livePitch.tuningStatus : null}
                    isActive={isListening}
                    inTuneTolerance={5}
                />
            </div>

            {/* Metric Badges: Western Pitch, Frequency, Deviation, Confidence */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-100 text-center">
                <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-100">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Western Pitch</span>
                    <span className="font-black text-xs sm:text-sm text-slate-800">{westernPitch}</span>
                </div>

                <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-100">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Frequency</span>
                    <span className="font-black text-xs sm:text-sm text-slate-800">{frequencyText}</span>
                </div>

                <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-100">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Deviation</span>
                    <span className={`font-black text-xs sm:text-sm ${
                        livePitch && livePitch.confidence !== 'silence'
                            ? (livePitch.tuningStatus === 'in_tune' ? 'text-emerald-600' : 'text-slate-800')
                            : 'text-slate-500'
                    }`}>
                        {centsText}
                    </span>
                </div>

                <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-100">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Confidence</span>
                    <span className={`font-black text-xs sm:text-sm ${
                        livePitch?.confidence === 'stable' ? 'text-emerald-600' : 'text-slate-600'
                    }`}>
                        {confidenceLabel}
                    </span>
                </div>
            </div>
        </div>
    );
}
