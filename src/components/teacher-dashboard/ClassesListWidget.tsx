'use client';

import React from 'react';
import Link from 'next/link';
import { Video } from 'lucide-react';

interface UpcomingClass {
    id: string;
    classroom_id: string;
    session_date: string;
    start_time: string;
    end_time: string;
    classroom_name: string;
    students_joined: number;
}

interface ClassesListWidgetProps {
    upcomingClasses: UpcomingClass[];
    formatTime12hr: (time: string) => string;
}

/**
 * ClassesListWidget displays all classes scheduled for today.
 * Shows status (Ongoing, Upcoming, Past) dynamically.
 */
export default function ClassesListWidget({
    upcomingClasses,
    formatTime12hr
}: ClassesListWidgetProps) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden text-left">
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-amber-50/50 to-orange-50/10 dark:from-amber-955/10 dark:to-orange-955/5">
                <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">Today's Classes</h3>
                <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 uppercase tracking-wider font-semibold">
                    {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
            </div>
            <div className="p-4 sm:p-6 space-y-6">
                {upcomingClasses.map((cl) => {
                    const now = new Date();
                    const curTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                    const startStr = cl.start_time.slice(0, 5);
                    const endStr = cl.end_time.slice(0, 5);
                    const isPast = endStr < curTimeStr;
                    const isOngoing = startStr <= curTimeStr && endStr >= curTimeStr;
                    const isUpcoming = startStr > curTimeStr;

                    return (
                        <div key={cl.id} className={`relative pl-6 border-l-2 ${isPast ? 'border-slate-200 dark:border-slate-800 opacity-60' : isOngoing ? 'border-emerald-500' : 'border-[#ecb613]'}`}>
                            <div className={`absolute -left-[9px] top-0 size-4 rounded-full border-2 ${isPast ? 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900' : isOngoing ? 'border-emerald-500 bg-emerald-500' : 'border-[#ecb613] bg-[#ecb613]'} bg-white dark:bg-slate-900`}></div>
                            <p className={`text-xs font-bold ${isPast ? 'text-slate-400' : isOngoing ? 'text-emerald-500' : 'text-[#ecb613]'} uppercase tracking-wider flex items-center gap-1.5`}>
                                {formatTime12hr(cl.start_time.slice(0, 5))} - {formatTime12hr(cl.end_time.slice(0, 5))}
                                {isOngoing && <span className="size-1.5 bg-emerald-500 rounded-full animate-pulse" />}
                                {isUpcoming && <span className="text-[10px] font-semibold text-slate-500 lowercase font-normal">(upcoming)</span>}
                            </p>
                            <h4 className={`text-sm font-bold mt-1 text-left ${isPast ? 'text-slate-500 dark:text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>{cl.classroom_name}</h4>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="material-symbols-outlined text-base text-slate-400">group</span>
                                <span className="text-xs text-slate-500">{cl.students_joined} Students joined</span>
                            </div>
                            <Link 
                                href={`/teacher-dashboard/classrooms/${cl.classroom_id}/meeting`}
                                className={`mt-4 w-full py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-xs ${
                                    isPast 
                                        ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400' 
                                        : isOngoing 
                                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/10' 
                                            : 'bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900 shadow-[#ecb613]/10'
                                }`}
                            >
                                <Video className="w-4 h-4" /> Start Session
                            </Link>
                        </div>
                    );
                })}
                {upcomingClasses.length === 0 && (
                    <div className="text-center py-6">
                        <p className="text-slate-500 text-sm">No classes scheduled for today.</p>
                        <Link href="/teacher-dashboard/classrooms" className="text-xs text-[#ecb613] font-bold mt-2 inline-block hover:underline">Manage Classrooms</Link>
                    </div>
                )}
            </div>
        </div>
    );
}
