'use client';

import React from 'react';
import { FileText, Download, Volume2, Music, Sparkles } from 'lucide-react';

interface LibraryTabProps {
    setPracticeSuiteTab: (tab: 'metronome' | 'tanpura' | 'drums' | 'combosetup') => void;
    setShowPracticeSuite: (show: boolean) => void;
    onOpenTuner?: () => void;
    onOpenSurToNotation?: () => void;
}

/**
 * LibraryTab displays backing tracks, PDF resources, and metronome/sequencer launching blocks.
 */
export default function LibraryTab({
    setPracticeSuiteTab,
    setShowPracticeSuite,
    onOpenTuner,
    onOpenSurToNotation
}: LibraryTabProps) {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">

            {/* 1. Individual Practice Tools Section */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 text-[10px] font-extrabold uppercase tracking-wider mb-1.5 border border-blue-100">
                            Standalone Instruments
                        </div>
                        <h3 className="font-extrabold text-slate-900 text-base">Individual Practice Tools</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Focused, standalone precision tools for dedicated riyaz. Each tool runs independently.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                    {/* Flute Tuner Tool */}
                    <div className="border border-slate-150 rounded-2xl p-5 hover:shadow-xs transition-shadow flex flex-col justify-between items-start gap-4 bg-slate-50/20">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#d46211] flex items-center justify-center shrink-0 border border-orange-100">
                                <span className="material-symbols-outlined text-xl font-bold">graphic_eq</span>
                            </div>
                            <div className="text-left">
                                <h4 className="font-extrabold text-xs md:text-sm text-slate-800">Flute Tuner</h4>
                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                    Tune your flute and check your Sur in real time with Indian Bansuri & Chromatic pitch detection.
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={onOpenTuner}
                            className="px-4 py-2 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-900 font-extrabold text-xs rounded-xl shadow-xs transition-colors mt-2 cursor-pointer"
                        >
                            Open Tuner
                        </button>
                    </div>

                    {/* Flute to Notes (Sur to Notation) Tool */}
                    <div className="border border-slate-150 rounded-2xl p-5 hover:shadow-xs transition-shadow flex flex-col justify-between items-start gap-4 bg-slate-50/20">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <h4 className="font-extrabold text-xs md:text-sm text-slate-800">Flute to Notes (Sur to Notation)</h4>
                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                    Real-time acoustic ear training & live transcription that detects notes as you play your flute.
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={onOpenSurToNotation}
                            className="px-4 py-2 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-900 font-extrabold text-xs rounded-xl shadow-xs transition-colors mt-2 cursor-pointer"
                        >
                            Open Flute to Notes
                        </button>
                    </div>

                    {/* Tanpura Drone Tool (Standalone) */}
                    <div className="border border-slate-150 rounded-2xl p-5 hover:shadow-xs transition-shadow flex flex-col justify-between items-start gap-4 bg-slate-50/20">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#d46211] flex items-center justify-center shrink-0 border border-orange-100">
                                <Music className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <h4 className="font-extrabold text-xs md:text-sm text-slate-800">Tanpura Drone</h4>
                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                    A standalone plucked Indian classical string drone to align your shruti (pitch scales) and tune your flute.
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={() => {
                                setPracticeSuiteTab('tanpura');
                                setShowPracticeSuite(true);
                            }}
                            className="px-4 py-2 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-900 font-extrabold text-xs rounded-xl shadow-xs transition-colors mt-2 cursor-pointer"
                        >
                            Open Tanpura
                        </button>
                    </div>

                    {/* Practice Metronome Tool (Standalone) */}
                    <div className="border border-slate-150 rounded-2xl p-5 hover:shadow-xs transition-shadow flex flex-col justify-between items-start gap-4 bg-slate-50/20">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0 border border-amber-100">
                                <Volume2 className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <h4 className="font-extrabold text-xs md:text-sm text-slate-800">Practice Metronome</h4>
                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                    Keep perfect time with speed adjustments, custom beats, subdivisions, and ramp acceleration modes.
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={() => {
                                setPracticeSuiteTab('metronome');
                                setShowPracticeSuite(true);
                            }}
                            className="px-4 py-2 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-900 font-extrabold text-xs rounded-xl shadow-xs transition-colors mt-2 cursor-pointer"
                        >
                            Open Metronome
                        </button>
                    </div>

                    {/* Drum Beats Sequencer Tool (Standalone) */}
                    <div className="border border-slate-150 rounded-2xl p-5 hover:shadow-xs transition-shadow flex flex-col justify-between items-start gap-4 bg-slate-50/20">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#d46211]/10 text-[#d46211] flex items-center justify-center shrink-0 border border-[#d46211]/20">
                                <span className="material-symbols-outlined text-xl font-bold">album</span>
                            </div>
                            <div className="text-left">
                                <h4 className="font-extrabold text-xs md:text-sm text-slate-800">Drum Beats Sequencer</h4>
                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                    Interactive standalone step sequencer featuring synthesized Kick, Snare, Hi-hat, and Shaker drums for play-along practice.
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={() => {
                                setPracticeSuiteTab('drums');
                                setShowPracticeSuite(true);
                            }}
                            className="px-4 py-2 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-900 font-extrabold text-xs rounded-xl shadow-xs transition-colors mt-2 cursor-pointer"
                        >
                            Open Drum Beats
                        </button>
                    </div>

                </div>
            </div>

            {/* 2. Dedicated Combo Section (Merged Tanpura + Metronome + Drums) */}
            <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-slate-50 border-2 border-amber-300/80 rounded-3xl p-6 sm:p-7 shadow-sm text-left">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="max-w-2xl">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-900 border border-amber-500/30 text-xs font-black uppercase tracking-wider mb-3">
                            <span className="material-symbols-outlined text-sm font-bold">tune</span>
                            <span>Combo Riyaz Section • Merged Accompaniment</span>
                        </div>
                        <h3 className="font-extrabold text-slate-900 text-lg sm:text-xl tracking-tight">
                            Combo Session Mixer
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                            Only in this dedicated Combo section are Tanpura drone, Metronome clicks, and Drum beats merged into a synchronized 3-track accompaniment engine with independent channel faders and master tempo control.
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px] font-bold text-slate-700">
                            <span className="px-2.5 py-1 bg-white/80 rounded-lg border border-amber-200 shadow-2xs">✓ Synchronized Downbeat & Sam</span>
                            <span className="px-2.5 py-1 bg-white/80 rounded-lg border border-amber-200 shadow-2xs">✓ Multi-Channel Audio Faders</span>
                            <span className="px-2.5 py-1 bg-white/80 rounded-lg border border-amber-200 shadow-2xs">✓ Simultaneous Riyaz Playback</span>
                        </div>
                    </div>

                    <div className="shrink-0 flex flex-col gap-2">
                        <button 
                            onClick={() => {
                                setPracticeSuiteTab('combosetup');
                                setShowPracticeSuite(true);
                            }}
                            className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                        >
                            <span className="material-symbols-outlined text-lg font-bold">play_circle</span>
                            <span>Open Combo Session Mixer</span>
                        </button>
                        <span className="text-[10px] text-center text-slate-400 font-medium">
                            Merged Tanpura, Metronome & Drums
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
