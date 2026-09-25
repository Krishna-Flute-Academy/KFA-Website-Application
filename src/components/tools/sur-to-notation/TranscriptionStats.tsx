'use client';

import React from 'react';
import { Clock, Music4, Volume2 } from 'lucide-react';
import { ListeningStatus } from '../../../lib/audio/notation/types';

interface TranscriptionStatsProps {
    durationSeconds: number;
    noteCount: number;
    status: ListeningStatus;
    inputVolume?: number;
    compact?: boolean;
}

export default function TranscriptionStats({
    durationSeconds,
    noteCount,
    status,
    inputVolume = 0,
    compact = false
}: TranscriptionStatsProps) {
    const formatDuration = (totalSec: number) => {
        const mins = Math.floor(totalSec / 60);
        const secs = totalSec % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (compact) {
        return (
            <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="bg-white border border-slate-200/90 rounded-xl px-2 py-1.5 shadow-xs flex items-center justify-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#ecb613]" />
                    <span className="font-mono font-black text-xs text-slate-800">
                        {formatDuration(durationSeconds)}
                    </span>
                </div>
                <div className="bg-white border border-slate-200/90 rounded-xl px-2 py-1.5 shadow-xs flex items-center justify-center gap-1.5">
                    <Music4 className="w-3.5 h-3.5 text-[#d46211]" />
                    <span className="font-black text-xs text-slate-800">
                        {noteCount} <span className="font-normal text-[10px] text-slate-400">Notes</span>
                    </span>
                </div>
                <div className="bg-white border border-slate-200/90 rounded-xl px-2 py-1.5 shadow-xs flex items-center justify-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-slate-500" />
                    <div className="w-12 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-emerald-500 transition-all duration-75 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(0, inputVolume * 500))}%` }}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {/* Duration */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-[#ecb613] border border-amber-100 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                </div>
                <div className="text-left min-w-0">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                        Duration
                    </span>
                    <span className="font-mono font-black text-xs sm:text-sm text-slate-800">
                        {formatDuration(durationSeconds)}
                    </span>
                </div>
            </div>

            {/* Note Count */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#d46211] border border-orange-100 flex items-center justify-center shrink-0">
                    <Music4 className="w-4 h-4" />
                </div>
                <div className="text-left min-w-0">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                        Notes Captured
                    </span>
                    <span className="font-black text-xs sm:text-sm text-slate-800">
                        {noteCount}
                    </span>
                </div>
            </div>

            {/* Input Level */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-600 border border-slate-100 flex items-center justify-center shrink-0">
                    <Volume2 className="w-4 h-4" />
                </div>
                <div className="text-left min-w-0 flex-1">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                        Mic Signal
                    </span>
                    <div className="flex items-center gap-1.5 mt-1">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-75 ${
                                    status === 'listening' ? (inputVolume > 60 ? 'bg-emerald-500' : 'bg-amber-400') : 'bg-slate-300'
                                }`}
                                style={{ width: `${status === 'listening' ? Math.min(100, Math.max(5, inputVolume)) : 0}%` }}
                            />
                        </div>
                        <span className="text-[10px] font-extrabold text-slate-500">
                            {status === 'listening' ? `${inputVolume}%` : 'Off'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
