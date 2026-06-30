'use client';

import React from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, Lightbulb } from 'lucide-react';

interface ForgottenClass {
    classroom_id: string;
    classroom_name: string;
    date: string;
    dayName: string;
}

interface PriorityTasksWidgetProps {
    stats: {
        pendingSubmissions: number;
    };
    forgottenClasses: ForgottenClass[];
}

/**
 * PriorityTasksWidget renders action items requiring immediate attention from the teacher.
 */
export default function PriorityTasksWidget({
    stats,
    forgottenClasses
}: PriorityTasksWidgetProps) {
    return (
        <div className="bg-[#0d5e5b] p-4 sm:p-6 rounded-2xl shadow-xl shadow-[#0d5e5b]/20 text-white relative overflow-hidden group text-left">
            <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                <AlertCircle className="w-24 h-24" />
            </div>
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-base sm:text-lg">Priority Tasks</h4>
                    <span className="bg-red-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">Urgent</span>
                </div>
                <div className="space-y-4">
                    <div className="flex items-center justify-between bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/5">
                        <div>
                            <p className="text-2xl font-bold">{stats.pendingSubmissions}</p>
                            <p className="text-[11px] font-medium text-teal-100/70 uppercase tracking-wide">Pending Reviews</p>
                        </div>
                        <Link className="bg-[#ecb613] text-slate-900 px-4 py-2 rounded-lg text-xs font-bold hover:bg-white transition-all flex items-center gap-2" href="/teacher-dashboard/submissions">
                            Review
                            <ArrowRight className="w-3 h-3" />
                        </Link>
                    </div>

                    {/* Forgotten Attendance List */}
                    {forgottenClasses.length > 0 && (
                        <div className="space-y-2 mt-4">
                            <p className="text-xs font-bold text-teal-100/70 uppercase tracking-wider">Forgot Attendance ({forgottenClasses.length})</p>
                            <div className="max-h-[180px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {forgottenClasses.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5 text-xs">
                                        <div className="truncate pr-2">
                                            <p className="font-bold truncate">{item.classroom_name}</p>
                                            <p className="text-[10px] text-teal-100/60 mt-0.5">{item.dayName}</p>
                                        </div>
                                        <Link 
                                            href={`/teacher-dashboard/attendance?date=${item.date}&classId=${item.classroom_id}`}
                                            className="bg-[#ecb613] hover:bg-white text-slate-900 px-2.5 py-1 rounded font-bold transition-all flex items-center gap-1 flex-shrink-0"
                                        >
                                            Mark
                                            <ArrowRight className="w-2.5 h-2.5" />
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="mt-8 pt-6 border-t border-white/10">
                    <div className="flex items-center gap-3 mb-3">
                        <Lightbulb className="w-4 h-4 text-[#ecb613]" />
                        <span className="text-xs font-bold tracking-wide uppercase">Teacher's Tip</span>
                    </div>
                    <p className="text-sm text-teal-55/90 leading-relaxed italic">
                        "Consistency is the key to mastering the flute. Encourage students to practice for at least 15 minutes daily."
                    </p>
                </div>
            </div>
        </div>
    );
}
