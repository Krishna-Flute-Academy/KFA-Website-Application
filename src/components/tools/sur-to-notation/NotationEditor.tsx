'use client';

import React, { useState } from 'react';
import { RotateCcw, Trash2, Copy, Check, FileText } from 'lucide-react';
import { useToast } from '../../../lib/ToastContext';

interface NotationEditorProps {
    notationText: string;
    onTextChange: (text: string) => void;
    onUndoLastNote: () => void;
    onClear: () => void;
    hasTokens: boolean;
}

export default function NotationEditor({
    notationText,
    onTextChange,
    onUndoLastNote,
    onClear,
    hasTokens
}: NotationEditorProps) {
    const [copied, setCopied] = useState(false);
    const { showToast } = useToast();

    const handleCopy = async () => {
        if (!notationText.trim()) return;
        try {
            await navigator.clipboard.writeText(notationText.trim());
            setCopied(true);
            showToast('Notation copied to clipboard!', 'success');
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy notation:', err);
            showToast('Could not copy to clipboard. Please copy manually.', 'error');
        }
    };

    return (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs text-left">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#d46211] border border-orange-100 flex items-center justify-center font-bold">
                        <FileText className="w-4 h-4" />
                    </div>
                    <div>
                        <h4 className="text-sm font-extrabold text-slate-800">
                            Transcribed Notation
                        </h4>
                        <p className="text-[11px] text-slate-400">
                            Real-time Sargam phrase. You can manually edit or insert bar-lines (|).
                        </p>
                    </div>
                </div>

                {/* Quick Token Count Pill */}
                {notationText.trim() && (
                    <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-[#a15912] rounded-xl text-[10px] font-extrabold">
                        {notationText.trim().split(/\s+/).filter(Boolean).length} Notes
                    </span>
                )}
            </div>

            {/* Editable Notation Textarea */}
            <div className="relative">
                <textarea
                    value={notationText}
                    onChange={(e) => onTextChange(e.target.value)}
                    placeholder="Transcribed Sargam will appear here as you play your flute (e.g. S R G m P D N S')..."
                    rows={4}
                    className="w-full p-4 font-mono text-base sm:text-lg font-bold text-slate-800 bg-[#FAF6F0]/60 border border-slate-200/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#ecb613]/50 focus:border-[#ecb613] resize-y placeholder:text-slate-400 placeholder:font-sans placeholder:text-xs sm:placeholder:text-sm tracking-wide leading-relaxed"
                />
            </div>

            {/* Action Buttons: Undo, Clear, Copy */}
            <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onUndoLastNote}
                        disabled={!hasTokens && !notationText.trim()}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 active:scale-95"
                        title="Undo Last Note"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Undo Last
                    </button>

                    <button
                        type="button"
                        onClick={onClear}
                        disabled={!notationText.trim()}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 disabled:opacity-40 disabled:cursor-not-allowed font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 active:scale-95"
                        title="Clear All Notation"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Clear
                    </button>
                </div>

                <button
                    type="button"
                    onClick={handleCopy}
                    disabled={!notationText.trim()}
                    className={`px-4 py-2 font-extrabold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 active:scale-95 ${
                        copied
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#ecb613] hover:bg-[#d49f0e] text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed'
                    }`}
                >
                    {copied ? (
                        <>
                            <Check className="w-3.5 h-3.5" />
                            Copied!
                        </>
                    ) : (
                        <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy Notation
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
