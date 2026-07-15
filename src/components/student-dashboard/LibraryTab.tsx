'use client';

import React from 'react';
import { FileText, Download, Volume2, Music } from 'lucide-react';

interface LibraryTabProps {
    setPracticeSuiteTab: (tab: 'metronome' | 'tanpura' | 'drums') => void;
    setShowPracticeSuite: (show: boolean) => void;
}

/**
 * LibraryTab displays backing tracks, PDF resources, and metronome/sequencer launching blocks.
 */
export default function LibraryTab({
    setPracticeSuiteTab,
    setShowPracticeSuite
}: LibraryTabProps) {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">

            {/* Practice Tools */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs text-left">
                <h3 className="font-extrabold text-slate-800 text-base mb-1">Practice Tools</h3>
                <p className="text-xs text-slate-500 mb-6">Interactive instruments to support your flute rehearsal sessions</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                            className="px-4 py-2 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-900 font-extrabold text-xs rounded-xl shadow-xs transition-colors mt-2"
                        >
                            Open Metronome
                        </button>
                    </div>
 
                    <div className="border border-slate-150 rounded-2xl p-5 hover:shadow-xs transition-shadow flex flex-col justify-between items-start gap-4 bg-slate-50/20">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#d46211] flex items-center justify-center shrink-0 border border-orange-100">
                                <Music className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <h4 className="font-extrabold text-xs md:text-sm text-slate-800">Tanpura Drone</h4>
                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                    A plucked Indian classical string drone to align your shruti (pitch scales) and tune your flute.
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={() => {
                                setPracticeSuiteTab('tanpura');
                                setShowPracticeSuite(true);
                            }}
                            className="px-4 py-2 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-900 font-extrabold text-xs rounded-xl shadow-xs transition-colors mt-2"
                        >
                            Open Tanpura
                        </button>
                    </div>
 
                    <div className="border border-slate-150 rounded-2xl p-5 hover:shadow-xs transition-shadow flex flex-col justify-between items-start gap-4 bg-slate-50/20">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#d46211]/10 text-[#d46211] flex items-center justify-center shrink-0 border border-[#d46211]/20">
                                <span className="material-symbols-outlined text-xl font-bold">album</span>
                            </div>
                            <div className="text-left">
                                <h4 className="font-extrabold text-xs md:text-sm text-slate-800">Drum Beats Sequencer</h4>
                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                    An interactive step sequencer featuring synthesized Kick, Snare, Hi-hat, and Shaker drums to practice flute play-along grooves.
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={() => {
                                setPracticeSuiteTab('drums');
                                setShowPracticeSuite(true);
                            }}
                            className="px-4 py-2 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-900 font-extrabold text-xs rounded-xl shadow-xs transition-colors mt-2"
                        >
                            Open Drum Beats
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
