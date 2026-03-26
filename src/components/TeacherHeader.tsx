'use client';

import React from 'react';
import Link from 'next/link';

interface TeacherHeaderProps {
    title: string;
    searchQuery?: string;
    onSearchChange?: (query: string) => void;
}

export default function TeacherHeader({ title, searchQuery, onSearchChange }: TeacherHeaderProps) {
    return (
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-10">
            <div className="max-w-[1600px] mx-auto w-full h-full flex items-center justify-between px-8">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-bold tracking-tight">{title}</h2>
                    <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>
                    <div className="relative group">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl group-focus-within:text-[#ecb613]">search</span>
                        <input
                            className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg pl-10 pr-4 py-1.5 text-sm w-64 focus:ring-2 focus:ring-[#ecb613]/20 transition-all outline-none"
                            placeholder="Search students or tasks..."
                            type="text"
                            value={searchQuery ?? ''}
                            onChange={(e) => onSearchChange?.(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/" className="px-4 text-sm font-semibold text-[#a15912] hover:underline mr-4">
                        Back to Main Site
                    </Link>
                    <button className="size-10 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-[#ecb613]/10 hover:text-[#ecb613] transition-colors relative" aria-label="Notifications">
                        <span className="material-symbols-outlined">notifications</span>
                        <span className="absolute top-2.5 right-2.5 size-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                    </button>
                    <button className="size-10 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-[#ecb613]/10 hover:text-[#ecb613] transition-colors" aria-label="Help">
                        <span className="material-symbols-outlined">help_outline</span>
                    </button>
                </div>
            </div>
        </header>
    );
}
