'use client';

import React from 'react';
import Link from 'next/link';

interface StatsSummaryProps {
    stats: {
        totalStudents: number;
        activeClassrooms: number;
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
            label: 'Total Students', 
            value: stats.totalStudents, 
            icon: 'person', 
            colorClass: 'bg-blue-50 dark:bg-blue-950/20 text-blue-600', 
            borderClass: 'border-l-4 border-blue-500', 
            status: 'Live', 
            statusClass: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20', 
            href: '/teacher-dashboard/students' 
        },
        { 
            label: 'Active Classrooms', 
            value: stats.activeClassrooms, 
            icon: 'meeting_room', 
            colorClass: 'bg-amber-50 dark:bg-amber-950/20 text-amber-600', 
            borderClass: 'border-l-4 border-amber-500', 
            status: 'Active', 
            statusClass: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20', 
            href: '/teacher-dashboard/classrooms' 
        },
        { 
            label: 'Pending Submissions', 
            value: stats.pendingSubmissions, 
            icon: 'assignment_late', 
            colorClass: 'bg-purple-50 dark:bg-purple-950/20 text-purple-600', 
            borderClass: 'border-l-4 border-purple-500', 
            status: 'Review', 
            statusClass: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20', 
            href: '/teacher-dashboard/submissions' 
        },
        ...(isAdmin ? [{ 
            label: 'Fees Collection', 
            value: `₹${feesStats.collectedThisMonth.toLocaleString('en-IN')}`, 
            icon: 'payments', 
            colorClass: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600', 
            borderClass: 'border-l-4 border-emerald-500', 
            status: feesStats.dueStudentsCount > 0 ? `${feesStats.dueStudentsCount} Due` : 'Paid', 
            statusClass: feesStats.dueStudentsCount > 0 ? 'text-rose-600 bg-rose-50 dark:bg-rose-900/20 animate-pulse' : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20', 
            href: '/teacher-dashboard/fees' 
        }] : [])
    ];

    return (
        <section className={`grid grid-cols-2 gap-3 sm:gap-6 ${isAdmin ? 'lg:grid-cols-4' : 'md:grid-cols-3'}`}>
            {statsList.map((stat, i) => (
                <Link 
                    key={i} 
                    href={stat.href} 
                    className={`bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-r-2xl rounded-l-md border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:scale-[1.02] hover:shadow-md flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 items-start ${stat.borderClass}`}
                >
                    <div className="flex items-center justify-between w-full sm:w-auto sm:block">
                        <div className={`p-1.5 sm:p-2 rounded-lg ${stat.colorClass} shrink-0`}>
                            <span className="material-symbols-outlined text-lg sm:text-2xl block">{stat.icon}</span>
                        </div>
                        <span className={`sm:hidden text-[9px] font-semibold px-2 py-0.5 rounded-full ${stat.statusClass}`}>
                            {stat.status}
                        </span>
                    </div>
                    <div className="min-w-0 flex-1 w-full text-left">
                        <div className="hidden sm:flex items-center justify-between">
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">{stat.label}</p>
                            <span className={`text-[9px] sm:text-xs font-semibold px-2 py-0.5 rounded-full ${stat.statusClass}`}>
                                {stat.status}
                            </span>
                        </div>
                        <p className="sm:hidden text-slate-500 dark:text-slate-400 text-[9px] font-extrabold uppercase tracking-widest leading-none">{stat.label}</p>
                        <h3 className="text-base sm:text-xl font-black text-slate-800 dark:text-white mt-1 sm:mt-0.5 truncate">{stat.value}</h3>
                    </div>
                </Link>
            ))}
        </section>
    );
}
