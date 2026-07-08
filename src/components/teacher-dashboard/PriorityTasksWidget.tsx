'use client';

import React from 'react';
import Link from 'next/link';
import { CheckCircle2, ArrowRight, Lightbulb, AlertTriangle } from 'lucide-react';

interface ForgottenClass {
    classroom_id: string;
    classroom_name: string;
    date: string;
    dayName: string;
}

interface PriorityTasksWidgetProps {
    stats: { pendingSubmissions: number };
    forgottenClasses: ForgottenClass[];
}

const TIPS = [
    'Consistency is the key to mastering the flute. Encourage students to practice for at least 15 minutes daily.',
    'A student who records themselves often progresses twice as fast — listening is the secret half of learning.',
    'Introduce ragas in small, memorable fragments before teaching the full structure.',
];

export default function PriorityTasksWidget({ stats, forgottenClasses }: PriorityTasksWidgetProps) {
    const hasUrgent = stats.pendingSubmissions > 0 || forgottenClasses.length > 0;
    const tip = TIPS[new Date().getDay() % TIPS.length];

    return (
        <div className="bg-white dark:bg-[#1E3028] border border-[#E2DAC8] dark:border-[#2A3D32] rounded-xl overflow-hidden text-left">
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#E2DAC8] dark:border-[#2A3D32] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <span className={`size-5 rounded-sm inline-block ${hasUrgent ? 'bg-orange-500' : 'bg-[#1B4B43] dark:bg-[#7BC2B0]'}`} aria-hidden="true" />
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">Priority Tasks</h3>
                </div>
                {hasUrgent ? (
                    <span className="inline-flex items-center gap-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                        <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                        Action needed
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 bg-[#EAF4F2] dark:bg-[#162820] text-[#1B4B43] dark:text-[#7BC2B0] text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                        <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                        All clear
                    </span>
                )}
            </div>

            <div className="p-5 space-y-4">
                {/* Pending reviews */}
                <div className={`flex items-center justify-between p-4 rounded-lg border ${
                    stats.pendingSubmissions > 0
                        ? 'border-orange-200 dark:border-orange-800/50 bg-orange-50 dark:bg-orange-900/10'
                        : 'border-[#E2DAC8] dark:border-[#2A3D32] bg-[#FAF7F0]/60 dark:bg-[#13211C]/30'
                }`}>
                    <div>
                        <p className={`font-display text-3xl font-bold leading-none ${
                            stats.pendingSubmissions > 0
                                ? 'text-orange-600 dark:text-orange-400'
                                : 'text-slate-900 dark:text-slate-50'
                        }`}>{stats.pendingSubmissions}</p>
                        <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mt-1">
                            Pending Reviews
                        </p>
                    </div>
                    <Link
                        href="/teacher-dashboard/submissions"
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                            stats.pendingSubmissions > 0
                                ? 'bg-[#A6741E] dark:bg-[#E8C066] text-white dark:text-slate-900 hover:bg-[#C4892A]'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                        }`}
                    >
                        Review <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>

                {/* Forgotten attendance */}
                {forgottenClasses.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                            Missed Attendance ({forgottenClasses.length})
                        </p>
                        <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1">
                            {forgottenClasses.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-[#FAF7F0] dark:bg-[#13211C]/50 border border-[#E2DAC8] dark:border-[#2A3D32] p-3 rounded-lg text-xs">
                                    <div className="truncate pr-2">
                                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{item.classroom_name}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">{item.dayName}</p>
                                    </div>
                                    <Link
                                        href={`/teacher-dashboard/attendance?date=${item.date}&classId=${item.classroom_id}`}
                                        className="flex items-center gap-1 bg-[#A6741E] dark:bg-[#E8C066] text-white dark:text-slate-900 px-2.5 py-1 rounded-lg font-semibold hover:bg-[#C4892A] transition-all shrink-0"
                                    >
                                        Mark <ArrowRight className="w-2.5 h-2.5" />
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* All-clear */}
                {!hasUrgent && (
                    <div className="flex items-center gap-3 py-2">
                        <CheckCircle2 className="w-5 h-5 text-[#1B4B43] dark:text-[#7BC2B0] shrink-0" aria-hidden="true" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">You're all caught up — great work!</p>
                    </div>
                )}

                {/* Teacher's tip */}
                <div className="pt-3 border-t border-[#E2DAC8] dark:border-[#2A3D32]">
                    <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="w-3.5 h-3.5 text-[#A6741E] dark:text-[#E8C066]" aria-hidden="true" />
                        <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400 dark:text-slate-500">
                            Teacher's Tip
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed italic">"{tip}"</p>
                </div>
            </div>
        </div>
    );
}
