'use client';

import React from 'react';
import Link from 'next/link';

interface Submission {
    id: string;
    student_name: string;
    student_profile_pic_url?: string;
    task_title: string;
    status: string;
    submitted_at: string;
}

interface SubmissionsWidgetProps {
    recentSubmissions: Submission[];
}

/**
 * SubmissionsWidget displays student submissions awaiting grading/feedback.
 * It is fully responsive, switching to a card layout on mobile and table layout on desktop.
 */
export default function SubmissionsWidget({
    recentSubmissions
}: SubmissionsWidgetProps) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden text-left">
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-50/50 to-orange-50/10 dark:from-amber-950/10 dark:to-orange-950/5">
                <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">Recent Student Submissions</h3>
                <Link className="text-xs sm:text-sm font-semibold text-[#ecb613] hover:underline" href="/teacher-dashboard/submissions">View All</Link>
            </div>
            
            {/* Mobile Card List View */}
            <div className="block sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {recentSubmissions.map((sub) => (
                    <div key={sub.id} className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="size-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
                                    {sub.student_profile_pic_url ? (
                                        <img 
                                            src={sub.student_profile_pic_url} 
                                            alt={sub.student_name} 
                                            className="w-full h-full object-cover rounded-full"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <span className="text-[10px] font-bold">{sub.student_name.charAt(0)}</span>
                                    )}
                                </div>
                                <span className="text-xs font-bold text-slate-900 dark:text-white">{sub.student_name}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-semibold">{sub.submitted_at}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[200px]">{sub.task_title}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                sub.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                }`}>
                                {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                            </span>
                        </div>
                    </div>
                ))}
                {recentSubmissions.length === 0 && (
                    <div className="p-6 text-center text-slate-500 text-xs">
                        No recent submissions found.
                    </div>
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-[10px] sm:text-xs font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-900/50">
                            <th className="px-4 py-3 sm:px-6 sm:py-4">Student</th>
                            <th className="px-4 py-3 sm:px-6 sm:py-4">Task</th>
                            <th className="px-4 py-3 sm:px-6 sm:py-4">Status</th>
                            <th className="px-4 py-3 sm:px-6 sm:py-4 text-right">Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {recentSubmissions.map((sub) => (
                            <tr key={sub.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="px-4 py-3 sm:px-6 sm:py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="size-7 sm:size-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
                                            {sub.student_profile_pic_url ? (
                                                <img 
                                                    src={sub.student_profile_pic_url} 
                                                    alt={sub.student_name} 
                                                    className="w-full h-full object-cover rounded-full"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <span className="text-[10px] font-bold">{sub.student_name.charAt(0)}</span>
                                            )}
                                        </div>
                                        <span className="text-xs sm:text-sm font-medium">{sub.student_name}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400">{sub.task_title}</td>
                                <td className="px-4 py-3 sm:px-6 sm:py-4">
                                    <span className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold ${
                                        sub.status === 'approved'
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                        }`}>
                                        {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                                    </span>
                                </td>
                                <td className="px-4 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm text-slate-500 text-right">{sub.submitted_at}</td>
                            </tr>
                        ))}
                        {recentSubmissions.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-10 text-center text-slate-500">
                                    No recent submissions found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
