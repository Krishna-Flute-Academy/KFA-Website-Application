'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { X, GraduationCap, ArrowRight, MessageCircle, Lock } from 'lucide-react';
import { trackToolEvent } from '../../lib/analytics';

interface StudentAccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    toolName?: string;
}

export default function StudentAccessModal({ isOpen, onClose, toolName }: StudentAccessModalProps) {
    useEffect(() => {
        if (!isOpen) return;

        trackToolEvent('student_tool_interest', { tool: toolName || 'unspecified' });

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, toolName]);

    if (!isOpen) return null;

    const whatsappUrl = `https://wa.me/919900119616?text=${encodeURIComponent(
        `Hello Krishna Flute Academy! I was exploring your ${toolName || 'Student Practice Tools'} and would like to discuss which Bansuri learning course is right for me.`
    )}`;

    return (
        <div 
            className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-left flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-blue-900 text-white p-6 sm:p-7 relative overflow-hidden">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                        title="Close"
                        aria-label="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold mb-3 border border-amber-400/30">
                        <GraduationCap className="w-3.5 h-3.5" />
                        <span>KFA Student Exclusive</span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">
                        Unlock KFA Student Practice Tools
                    </h2>
                    {toolName && (
                        <p className="text-xs text-amber-300/90 font-medium mt-1">
                            Access feature: <span className="font-bold underline decoration-amber-400">{toolName}</span>
                        </p>
                    )}
                </div>

                {/* Body Content */}
                <div className="p-6 sm:p-7 space-y-5">
                    <div className="text-slate-600 text-xs sm:text-sm leading-relaxed space-y-2.5">
                        <p>
                            These advanced practice tools are available to Krishna Flute Academy students as part of their guided learning experience.
                        </p>
                        <p>
                            Along with structured lessons, KFA students can use interactive tools to support rhythm, listening, pitch awareness and purposeful Riyaz.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="space-y-2.5 pt-2">
                        {/* Primary: Explore Bansuri Courses */}
                        <Link
                            href="/courses"
                            onClick={() => {
                                trackToolEvent('student_tool_course_click', { tool: toolName });
                                onClose();
                            }}
                            className="w-full py-3.5 px-5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold text-xs sm:text-sm rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-center"
                        >
                            <span>Explore Bansuri Courses</span>
                            <ArrowRight className="w-4 h-4" />
                        </Link>

                        {/* Secondary: Discuss Which Course Is Right for Me */}
                        <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => {
                                trackToolEvent('student_tool_enquiry_click', { tool: toolName });
                            }}
                            className="w-full py-3 px-5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-900 border border-slate-200 text-slate-800 font-bold text-xs sm:text-sm rounded-2xl transition-all flex items-center justify-center gap-2 text-center"
                        >
                            <MessageCircle className="w-4 h-4 text-emerald-600" />
                            <span>Discuss Which Course Is Right for Me</span>
                        </a>
                    </div>

                    {/* Text link: Already a KFA Student? Login */}
                    <div className="pt-3 border-t border-slate-100 text-center">
                        <Link
                            href="/login"
                            onClick={() => {
                                trackToolEvent('student_tool_login_click', { tool: toolName });
                                onClose();
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-900 hover:text-blue-950 hover:underline transition-colors"
                        >
                            <Lock className="w-3.5 h-3.5 text-blue-800" />
                            <span>Already a KFA Student? Login</span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
