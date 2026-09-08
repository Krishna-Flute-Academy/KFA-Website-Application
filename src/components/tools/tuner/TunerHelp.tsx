'use client';

import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Wind } from 'lucide-react';

export default function TunerHelp() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="w-full bg-amber-50/40 border border-amber-200/80 rounded-2xl overflow-hidden shadow-xs">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-amber-100/40 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-[#d46211]" />
                    <span className="text-xs sm:text-sm font-extrabold text-slate-800">
                        How to Use the Flute Tuner
                    </span>
                </div>
                {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
            </button>

            {isOpen && (
                <div className="p-4 sm:p-5 border-t border-amber-200/60 bg-white/80 space-y-3 text-xs text-slate-600">
                    <ol className="list-decimal pl-5 space-y-1.5 font-medium leading-relaxed">
                        <li>
                            Select the note you use as <strong>Sa</strong> (for example, <strong>E</strong> for an E bass bansuri).
                        </li>
                        <li>
                            Press <strong>Start Tuner</strong> to grant microphone access.
                        </li>
                        <li>
                            Play one steady note on the flute (such as holding <strong>Sa</strong> or <strong>Pa</strong>).
                        </li>
                        <li>
                            Hold the note for approximately <strong>1–2 seconds</strong> with consistent embouchure.
                        </li>
                        <li>
                            Watch the tuner meter:
                            <ul className="list-disc pl-4 mt-1 space-y-0.5 text-slate-500 font-normal">
                                <li>If the indicator moves <strong>left</strong>, your note is <strong>flat</strong> (komal / low).</li>
                                <li>If the indicator moves <strong>right</strong>, your note is <strong>sharp</strong> (tivra / high).</li>
                                <li>Adjust your blowing angle, finger covering, or breath to bring it to the <strong>center sweet spot</strong>.</li>
                            </ul>
                        </li>
                    </ol>

                    {/* Flute Specific Breath Warning */}
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/70 flex items-start gap-2.5 mt-3 text-amber-900">
                        <Wind className="w-4 h-4 text-[#d46211] shrink-0 mt-0.5" />
                        <div className="text-[11px] leading-relaxed">
                            <strong className="font-extrabold">Bansuri Tip: </strong>
                            Avoid blowing too hard while tuning. Keep the breath steady and gentle because breath pressure and blowing angle (blowing inward or outward) directly change the flute pitch.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
