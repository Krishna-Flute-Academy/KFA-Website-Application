'use client';

import React from 'react';
import Link from 'next/link';
import { Music, Download } from 'lucide-react';

interface Submission {
    id: string;
    student_name: string;
    student_profile_pic_url?: string;
    task_title: string;
    status: string;
    submitted_at: string;
    video_url?: string | null;
}

interface SubmissionsWidgetProps {
    recentSubmissions: Submission[];
}

function Avatar({ name, url }: { name: string; url?: string }) {
    return (
        <div className="size-8 rounded-full bg-[#EAF4F2] dark:bg-[#162820] flex items-center justify-center overflow-hidden border border-[#E2DAC8] dark:border-[#2A3D32] shrink-0">
            {url ? (
                <img src={url} alt={name} className="w-full h-full object-cover rounded-full" loading="lazy" />
            ) : (
                <span className="text-[11px] font-bold text-[#1B4B43] dark:text-[#7BC2B0]">
                    {name.charAt(0).toUpperCase()}
                </span>
            )}
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const s = status.toLowerCase();
    if (s === 'approved') return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#EAF4F2] dark:bg-[#162820] text-[#1B4B43] dark:text-[#7BC2B0]">
            Approved
        </span>
    );
    if (s === 'rejected') return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400">
            Rejected
        </span>
    );
    return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#FBF3E4] dark:bg-[#2B2010] text-[#A6741E] dark:text-[#E8C066]">
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    );
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center gap-3 py-10 px-6 text-center">
            <div className="size-11 rounded-full bg-[#EAF4F2] dark:bg-[#162820] flex items-center justify-center">
                <Music className="w-5 h-5 text-[#1B4B43] dark:text-[#7BC2B0]" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No submissions yet</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed">
                Once a student records and submits a practice audio or video, it will appear here for your review.
            </p>
        </div>
    );
}

export default function SubmissionsWidget({ recentSubmissions }: SubmissionsWidgetProps) {
    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden text-left">
            {/* Header with yellow/orange accent */}
            <div className="px-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-50/50 to-orange-50/10 dark:from-amber-955/10 dark:to-orange-955/5">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-[#ecb613]/10 dark:bg-[#ecb613]/20 rounded-lg text-[#ecb613] flex items-center justify-center shrink-0">
                        <Music className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div>
                        <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                            Recent Submissions
                        </h3>
                        <p className="text-[11px] text-slate-400 dark:text-slate-550 mt-0.5 font-medium">
                            Student recordings awaiting review
                        </p>
                    </div>
                </div>
                <Link
                    href="/teacher-dashboard/submissions"
                    className="text-[10px] sm:text-xs font-bold text-[#ecb613] hover:underline"
                >
                    View all →
                </Link>
            </div>

            {recentSubmissions.length === 0 ? (
                <EmptyState />
            ) : (
                <>
                    {/* Mobile cards */}
                    <div className="block sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
                        {recentSubmissions.map((sub) => (
                            <div key={sub.id} className="p-4 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <Avatar name={sub.student_name} url={sub.student_profile_pic_url} />
                                        <span className="text-xs font-bold text-slate-900 dark:text-white">{sub.student_name}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-450 font-medium">{sub.submitted_at}</span>
                                </div>
                                <div className="flex items-center justify-between pl-10">
                                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[180px] font-medium">{sub.task_title}</span>
                                    <StatusBadge status={sub.status} />
                                </div>
                                {sub.video_url && (
                                    <div className="pl-10">
                                        <a href={sub.video_url} target="_blank" rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#ecb613] hover:underline">
                                            <Download className="w-3 h-3" /> Download recording
                                        </a>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-[10px] font-bold text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-800/20">
                                    <th className="px-5 py-3.5">Student</th>
                                    <th className="px-5 py-3.5">Task</th>
                                    <th className="px-5 py-3.5">Status</th>
                                    <th className="px-5 py-3.5 text-right">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {recentSubmissions.map((sub) => (
                                    <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-2.5">
                                                <Avatar name={sub.student_name} url={sub.student_profile_pic_url} />
                                                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{sub.student_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-slate-500 dark:text-slate-450 max-w-[200px] truncate font-medium">{sub.task_title}</td>
                                        <td className="px-5 py-3.5"><StatusBadge status={sub.status} /></td>
                                        <td className="px-5 py-3.5 text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                <span className="text-xs text-slate-400 font-medium">{sub.submitted_at}</span>
                                                {sub.video_url && (
                                                    <a href={sub.video_url} target="_blank" rel="noopener noreferrer"
                                                        className="p-1.5 rounded-lg text-[#ecb613] hover:bg-[#ecb613]/10 transition-colors"
                                                        aria-label={`Download submission by ${sub.student_name}`}>
                                                        <Download className="w-3.5 h-3.5" />
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
