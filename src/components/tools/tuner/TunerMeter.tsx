'use client';

import React from 'react';
import { TuningStatus } from '../../../lib/audio/pitch/types';

interface TunerMeterProps {
    cents: number | null;
    status: TuningStatus | null;
    isActive: boolean;
    inTuneTolerance?: number; // default 5
}

export default function TunerMeter({
    cents,
    status,
    isActive,
    inTuneTolerance = 5
}: TunerMeterProps) {
    const clampedCents = cents !== null ? Math.max(-50, Math.min(50, cents)) : 0;
    // Map -50..+50 cents to 0%..100% position on meter
    const needlePercent = ((clampedCents + 50) / 100) * 100;

    // Status colors
    const getStatusStyle = () => {
        if (!isActive || status === null) {
            return {
                badgeBg: 'bg-slate-100 text-slate-400 border-slate-200',
                needleBg: 'bg-slate-300',
                glow: '',
                label: 'Awaiting Sound'
            };
        }

        switch (status) {
            case 'in_tune':
                return {
                    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-4 ring-emerald-500/10',
                    needleBg: 'bg-emerald-500 shadow-lg shadow-emerald-500/40',
                    glow: 'shadow-[0_0_24px_rgba(16,185,129,0.35)]',
                    label: 'In Tune'
                };
            case 'slightly_flat':
                return {
                    badgeBg: 'bg-amber-50 text-amber-700 border-amber-300 ring-2 ring-amber-500/10',
                    needleBg: 'bg-amber-500 shadow-md shadow-amber-500/30',
                    glow: '',
                    label: 'Slightly Flat'
                };
            case 'slightly_sharp':
                return {
                    badgeBg: 'bg-amber-50 text-amber-700 border-amber-300 ring-2 ring-amber-500/10',
                    needleBg: 'bg-amber-500 shadow-md shadow-amber-500/30',
                    glow: '',
                    label: 'Slightly Sharp'
                };
            case 'too_flat':
                return {
                    badgeBg: 'bg-rose-50 text-rose-700 border-rose-300',
                    needleBg: 'bg-rose-500 shadow-md shadow-rose-500/30',
                    glow: '',
                    label: 'Too Flat'
                };
            case 'too_sharp':
                return {
                    badgeBg: 'bg-rose-50 text-rose-700 border-rose-300',
                    needleBg: 'bg-rose-500 shadow-md shadow-rose-500/30',
                    glow: '',
                    label: 'Too Sharp'
                };
        }
    };

    const style = getStatusStyle();
    const ticks = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50];

    return (
        <div className="w-full flex flex-col items-center">
            {/* Meter Status Badge */}
            <div className="mb-4">
                <span className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs md:text-sm font-extrabold uppercase tracking-wider border transition-all duration-200 ${style.badgeBg}`}>
                    <span className={`w-2 h-2 rounded-full ${
                        isActive && status ? (status === 'in_tune' ? 'bg-emerald-500 animate-pulse' : 'bg-current') : 'bg-slate-300'
                    }`} />
                    {isActive ? (status ? style.label : 'Play a steady note') : 'Microphone Off'}
                </span>
            </div>

            {/* Visual Gauge Container */}
            <div className={`w-full max-w-md bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs transition-all duration-300 ${style.glow}`}>
                {/* Labels above ticks */}
                <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold text-slate-400 mb-2 px-1">
                    <span className="text-rose-500 font-extrabold flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[14px]">arrow_back</span>
                        FLAT
                    </span>
                    <span className={`font-black tracking-wide ${status === 'in_tune' ? 'text-emerald-600 font-extrabold scale-110' : 'text-slate-600'} transition-transform`}>
                        SUR / 0
                    </span>
                    <span className="text-rose-500 font-extrabold flex items-center gap-0.5">
                        SHARP
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </span>
                </div>

                {/* Meter Track & Sweet Spot */}
                <div className="relative h-12 w-full bg-slate-100/90 rounded-xl overflow-hidden border border-slate-200/80 flex items-center">
                    {/* Background in-tune zone (±5 cents -> 45% to 55%) */}
                    <div 
                        className="absolute top-0 bottom-0 bg-emerald-500/15 border-x border-emerald-500/30"
                        style={{
                            left: `${(( -inTuneTolerance + 50) / 100) * 100}%`,
                            width: `${((2 * inTuneTolerance) / 100) * 100}%`
                        }}
                    />

                    {/* Flat gradient area (left) */}
                    <div 
                        className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-rose-500/10 to-transparent"
                        style={{ width: '40%' }}
                    />

                    {/* Sharp gradient area (right) */}
                    <div 
                        className="absolute top-0 bottom-0 right-0 bg-gradient-to-l from-rose-500/10 to-transparent"
                        style={{ width: '40%' }}
                    />

                    {/* Center Reference Line */}
                    <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[2px] bg-emerald-500/60 z-0" />

                    {/* Dynamic Moving Needle */}
                    <div 
                        className="absolute top-1 bottom-1 w-2 -ml-1 transition-all duration-100 ease-out z-10 flex flex-col items-center justify-between"
                        style={{
                            left: isActive && cents !== null ? `${needlePercent}%` : '50%'
                        }}
                    >
                        <div className={`w-3 h-3 rounded-full ${style.needleBg} ring-2 ring-white`} />
                        <div className={`w-1 flex-1 ${style.needleBg} rounded-full`} />
                        <div className={`w-3 h-3 rounded-full ${style.needleBg} ring-2 ring-white`} />
                    </div>
                </div>

                {/* Tick marks & Numeric labels */}
                <div className="relative w-full h-6 mt-1 flex justify-between px-0.5 select-none">
                    {ticks.map(tick => {
                        const isCenter = tick === 0;
                        const isMajor = tick % 20 === 0;
                        return (
                            <div key={tick} className="flex flex-col items-center">
                                <div className={`w-[1px] ${
                                    isCenter 
                                        ? 'h-3 bg-emerald-500' 
                                        : isMajor 
                                            ? 'h-2.5 bg-slate-400' 
                                            : 'h-1.5 bg-slate-300'
                                }`} />
                                <span className={`text-[9px] sm:text-[10px] mt-0.5 ${
                                    isCenter 
                                        ? 'font-black text-emerald-600' 
                                        : isMajor 
                                            ? 'font-bold text-slate-500' 
                                            : 'text-slate-300 hidden sm:inline'
                                }`}>
                                    {tick > 0 ? `+${tick}` : tick}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
