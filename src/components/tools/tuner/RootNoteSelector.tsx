'use client';

import React from 'react';
import { RootNote } from '../../../lib/audio/pitch/types';

interface RootNoteSelectorProps {
    selectedSa: RootNote;
    onSelectSa: (sa: RootNote) => void;
    disabled?: boolean;
}

const ROOT_NOTES: Array<{ value: RootNote; label: string; flutes?: string }> = [
    { value: 'C',  label: 'C',      flutes: 'C Medium / C Bass' },
    { value: 'C#', label: 'C# / Db', flutes: 'C# Medium' },
    { value: 'D',  label: 'D',      flutes: 'D Medium' },
    { value: 'D#', label: 'D# / Eb', flutes: 'D# Medium' },
    { value: 'E',  label: 'E',      flutes: 'E Bass (Most Common)' },
    { value: 'F',  label: 'F',      flutes: 'F Medium / F Bass' },
    { value: 'F#', label: 'F# / Gb', flutes: 'F# Bass / Medium' },
    { value: 'G',  label: 'G',      flutes: 'G Base / G Medium' },
    { value: 'G#', label: 'G# / Ab', flutes: 'G# Bass / Medium' },
    { value: 'A',  label: 'A',      flutes: 'A Bass' },
    { value: 'A#', label: 'A# / Bb', flutes: 'A# Bass' },
    { value: 'B',  label: 'B',      flutes: 'B Bass' },
];

export default function RootNoteSelector({
    selectedSa,
    onSelectSa,
    disabled = false
}: RootNoteSelectorProps) {
    return (
        <div className="w-full bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-orange-50 text-[#d46211] border border-orange-100 flex items-center justify-center font-black text-xs">
                        सा
                    </span>
                    <div>
                        <h4 className="text-xs sm:text-sm font-extrabold text-slate-800">
                            My Sa (Flute Scale)
                        </h4>
                        <p className="text-[11px] text-slate-500">
                            Select the key of your flute (when upper 3 holes are closed)
                        </p>
                    </div>
                </div>

                <div className="px-3 py-1 bg-amber-500/10 text-[#d46211] rounded-xl font-extrabold text-xs border border-amber-500/20">
                    Sa = <span className="text-[#a15912] font-black">{selectedSa}</span>
                </div>
            </div>

            {/* Quick Grid of all 12 Root Notes */}
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 sm:gap-2">
                {ROOT_NOTES.map(note => {
                    const isSelected = selectedSa === note.value;
                    return (
                        <button
                            key={note.value}
                            type="button"
                            disabled={disabled}
                            onClick={() => onSelectSa(note.value)}
                            title={note.flutes}
                            className={`py-2 px-1 text-center rounded-xl font-bold text-xs transition-all duration-150 relative ${
                                isSelected
                                    ? 'bg-[#ecb613] text-slate-900 font-black shadow-sm ring-2 ring-[#ecb613]/50 scale-[1.02]'
                                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/70 hover:border-slate-300'
                            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <span className="block truncate">{note.label}</span>
                            {note.value === 'E' && (
                                <span className="block text-[8px] opacity-75 font-normal tracking-tight truncate">
                                    Common
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
