'use client';

import React, { useState } from 'react';
import { TunerMode } from '../../../lib/audio/pitch/types';
import { ChevronDown, ChevronUp, Sliders } from 'lucide-react';

interface TunerSettingsProps {
    tunerMode: TunerMode;
    onModeChange: (mode: TunerMode) => void;
    a4Reference: number;
    onA4Change: (a4: number) => void;
}

export default function TunerSettings({
    tunerMode,
    onModeChange,
    a4Reference,
    onA4Change
}: TunerSettingsProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="w-full bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
            {/* Header Accordion Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-slate-500" />
                    <span className="text-xs sm:text-sm font-bold text-slate-700">Tuner Settings</span>
                    <span className="text-[10px] text-slate-400 font-medium">
                        ({tunerMode === 'indian' ? 'Indian Bansuri' : 'Chromatic'}, A4={a4Reference}Hz)
                    </span>
                </div>
                {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
            </button>

            {/* Accordion Content */}
            {isOpen && (
                <div className="p-4 sm:p-5 border-t border-slate-150 space-y-4 bg-slate-50/40">
                    {/* Mode Selector */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            Tuning Mode
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => onModeChange('indian')}
                                className={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all text-center ${
                                    tunerMode === 'indian'
                                        ? 'bg-[#FAF5EE] text-[#7C5E3F] border-2 border-[#7C5E3F] shadow-xs'
                                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                Indian / Bansuri Mode
                                <span className="block text-[10px] font-normal text-slate-500 mt-0.5">
                                    Shows Swaras (Sa, Re, Ga, Ma...)
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => onModeChange('chromatic')}
                                className={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all text-center ${
                                    tunerMode === 'chromatic'
                                        ? 'bg-[#FAF5EE] text-[#7C5E3F] border-2 border-[#7C5E3F] shadow-xs'
                                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                Chromatic Mode
                                <span className="block text-[10px] font-normal text-slate-500 mt-0.5">
                                    Shows Western notes (C, D, E...)
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* A4 Reference Pitch Calibration */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-bold text-slate-700">
                                A4 Reference Pitch
                            </label>
                            <span className="text-xs font-black text-[#d46211] bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-100">
                                {a4Reference} Hz
                            </span>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => onA4Change(Math.max(430, a4Reference - 1))}
                                className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 flex items-center justify-center shrink-0"
                            >
                                -
                            </button>

                            <input
                                type="range"
                                min={430}
                                max={450}
                                step={1}
                                value={a4Reference}
                                onChange={(e) => onA4Change(Number(e.target.value))}
                                className="flex-1 accent-[#d46211] cursor-pointer"
                            />

                            <button
                                type="button"
                                onClick={() => onA4Change(Math.min(450, a4Reference + 1))}
                                className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 flex items-center justify-center shrink-0"
                            >
                                +
                            </button>

                            {a4Reference !== 440 && (
                                <button
                                    type="button"
                                    onClick={() => onA4Change(440)}
                                    className="text-[11px] text-[#d46211] font-bold hover:underline shrink-0"
                                >
                                    Reset (440)
                                </button>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                            Standard concert pitch is 440 Hz. Some Indian classical recordings tune to 432 Hz.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
