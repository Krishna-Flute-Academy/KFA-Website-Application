'use client';

import React from 'react';
import Link from 'next/link';

interface StatsSummaryProps {
    stats: {
        totalStudents: number;
        liveStudents: number;
        activeClassrooms: number;
        permanentClassrooms: number;
        temporaryClassroomsNotDone: number;
        pendingSubmissions: number;
    };
    feesStats: {
        collectedThisMonth: number;
        dueStudentsCount: number;
    };
    isAdmin: boolean;
}

/**
 * StatsSummary displays active students, classrooms, pending assignments reviews,
 * and fees metrics in a modern grid banner.
 */
export default function StatsSummary({
    stats,
    feesStats,
    isAdmin
}: StatsSummaryProps) {
    const statsList = [
        { 
            label: 'Students', 
            value: stats.totalStudents, 
            icon: 'person', 
            colorClass: 'bg-blue-50 dark:bg-blue-955/20 text-blue-600 dark:text-blue-400', 
            borderClass: 'border-l-4 border-blue-500', 
            status: `${stats.liveStudents} Live`, 
            statusClass: stats.liveStudents > 0 
                ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 font-bold animate-pulse' 
                : 'text-slate-500 bg-slate-50 dark:bg-slate-900/20', 
            href: '/teacher-dashboard/students',
            statusDot: stats.liveStudents > 0,
            statusDotClass: 'bg-emerald-500 animate-pulse'
        },
        { 
            label: 'Classrooms', 
            value: stats.activeClassrooms, 
            icon: 'meeting_room', 
            colorClass: 'bg-amber-50 dark:bg-amber-955/20 text-amber-600 dark:text-amber-400', 
            borderClass: 'border-l-4 border-amber-500', 
            status: `${stats.permanentClassrooms} Perm / ${stats.temporaryClassroomsNotDone} Temp`, 
            statusClass: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 font-semibold', 
            href: '/teacher-dashboard/classrooms',
            statusDot: false,
            statusDotClass: 'bg-transparent'
        },
        { 
            label: 'Task Submitted', 
            value: stats.pendingSubmissions, 
            icon: 'assignment_late', 
            colorClass: 'bg-purple-50 dark:bg-purple-955/20 text-purple-600 dark:text-purple-400', 
            borderClass: 'border-l-4 border-purple-500', 
            status: 'Submitted', 
            statusClass: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20', 
            href: '/teacher-dashboard/tasks',
            statusDot: stats.pendingSubmissions > 0,
            statusDotClass: 'bg-purple-500 animate-pulse'
        },
        ...(isAdmin ? [{ 
            label: 'Fees Collection', 
            value: `₹${feesStats.collectedThisMonth.toLocaleString('en-IN')}`, 
            icon: 'payments', 
            colorClass: 'bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 dark:text-emerald-450', 
            borderClass: 'border-l-4 border-emerald-500', 
            status: feesStats.dueStudentsCount > 0 ? `${feesStats.dueStudentsCount} Due` : 'Paid', 
            statusClass: feesStats.dueStudentsCount > 0 ? 'text-rose-600 bg-rose-50 dark:bg-rose-900/20 animate-pulse' : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-955/20', 
            href: '/teacher-dashboard/fees',
            statusDot: feesStats.dueStudentsCount > 0,
            statusDotClass: 'bg-rose-500 animate-pulse'
        }] : [])
    ];

    return (
        <section className={`grid grid-cols-2 ${isAdmin ? 'lg:grid-cols-4' : 'sm:grid-cols-3'} gap-3 sm:gap-4 md:gap-6 w-full`}>
            {statsList.map((stat, i) => (
                <Link 
                    key={i} 
                    href={stat.href} 
                    className={`bg-white dark:bg-slate-900 p-3 sm:p-5 rounded-r-2xl rounded-l-md border border-slate-200 dark:border-slate-800 shadow-xs transition-all hover:scale-[1.02] hover:shadow-md flex flex-col md:flex-row md:items-center gap-1.5 sm:gap-4 relative overflow-hidden ${stat.borderClass} ${!isAdmin && i === 2 ? 'col-span-2 sm:col-span-1' : ''}`}
                >
                    {/* Status dot notification for mobile */}
                    {stat.statusDot && (
                        <span className={`md:hidden absolute top-1 right-1 size-1.5 rounded-full ${stat.statusDotClass}`} />
                    )}

                    <div className={`p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl ${stat.colorClass} shrink-0 flex items-center justify-center`}>
                        <span className="material-symbols-outlined text-base sm:text-2xl block select-none">{stat.icon}</span>
                    </div>

                    <div className="min-w-0 flex-1 text-center md:text-left w-full">
                        <div className="hidden md:flex items-center justify-between gap-1">
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider truncate">{stat.label}</p>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${stat.statusClass}`}>
                                {stat.status}
                            </span>
                        </div>
                        {/* Compact mobile layout */}
                        <p className="md:hidden text-slate-400 dark:text-slate-500 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider truncate leading-none">{stat.label}</p>
                        <h3 className="text-xs sm:text-base md:text-xl font-black text-slate-800 dark:text-white mt-0.5 md:mt-1 truncate leading-none">{stat.value}</h3>
                    </div>
                </Link>
            ))}
        </section>
    );
}
