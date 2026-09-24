'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles, BookOpen } from 'lucide-react';

export default function AcademyConversionBanner() {
    return (
        <div className="relative overflow-hidden bg-gradient-to-r from-[#211911] via-[#3a291a] to-[#211911] text-white rounded-3xl p-6 sm:p-8 my-8 shadow-xl border border-amber-900/40">
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-2 text-center md:text-left">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Structured Bansuri Curriculum</span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-amber-100">
                        Want structured flute training?
                    </h3>
                    <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
                        Join Krishna Flute Academy for guided 1-on-1 and batch training from basic blowing and fingering to advanced Indian classical raag elaboration.
                    </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <Link
                        href="/#courses"
                        className="inline-flex items-center gap-2 px-5 py-3 bg-[#ecb613] hover:bg-[#d4a310] text-slate-950 font-extrabold text-sm rounded-xl shadow-lg transform active:scale-95 transition-all"
                    >
                        <BookOpen className="w-4 h-4" />
                        <span>Explore Academy Courses</span>
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>

            {/* Decorative background glow */}
            <div className="absolute -top-12 -right-12 w-64 h-64 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>
    );
}
