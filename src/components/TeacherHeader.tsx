'use client';

import React from 'react';
import Link from 'next/link';

interface TeacherHeaderProps {
    title: string;
    searchQuery?: string;
    onSearchChange?: (query: string) => void;
    placeholder?: string;
    showSettings?: boolean;
    showAvatar?: boolean;
    avatarUrl?: string;
    backLink?: string;
}

export default function TeacherHeader({ 
    title, 
    searchQuery, 
    onSearchChange,
    placeholder = "Search students or tasks...",
    showSettings = false,
    showAvatar = false,
    avatarUrl = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
    backLink
}: TeacherHeaderProps) {
    return (
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
            <div className="w-full h-full flex items-center justify-between px-4 md:px-8">
                <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent('kfa-toggle-sidebar'))}
                        className="md:hidden p-2 -ml-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                        aria-label="Toggle Menu"
                    >
                        <span className="material-symbols-outlined text-2xl select-none">menu</span>
                    </button>
                    {backLink && (
                        <Link 
                            href={backLink}
                            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 flex items-center justify-center"
                            aria-label="Go Back"
                        >
                            <span className="material-symbols-outlined text-2xl select-none">arrow_back</span>
                        </Link>
                    )}
                    <h2 className="text-base md:text-lg font-bold tracking-tight text-slate-800 dark:text-white shrink-0 truncate max-w-[120px] sm:max-w-none">{title}</h2>
                    <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1 md:mx-2 shrink-0"></div>
                    <div className="relative group max-w-xs sm:max-w-md w-full">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl group-focus-within:text-[#ecb613] select-none">search</span>
                        <input
                            className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg pl-10 pr-4 py-1.5 text-xs sm:text-sm w-full focus:ring-2 focus:ring-[#ecb613]/20 transition-all outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
                            placeholder={placeholder}
                            type="text"
                            value={searchQuery ?? ''}
                            onChange={(e) => onSearchChange?.(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 shrink-0 ml-2 sm:ml-4">
                    {!showAvatar && (
                        <Link href="/" className="hidden sm:inline px-2 sm:px-4 text-xs sm:text-sm font-semibold text-[#a15912] hover:underline mr-1 sm:mr-2">
                            Back to Main Site
                        </Link>
                    )}
                    
                    {/* Notifications Button */}
                    <button className="size-9 sm:size-10 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-400 hover:bg-[#ecb613]/10 hover:text-[#ecb613] transition-colors relative" aria-label="Notifications">
                        <span className="material-symbols-outlined text-xl sm:text-2xl">notifications</span>
                        {/* Red dot only if not in custom high-fidelity mode */}
                        {!showAvatar && (
                            <span className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 size-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                        )}
                    </button>

                    {/* Settings Button */}
                    {showSettings && (
                        <button className="size-9 sm:size-10 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-400 hover:bg-[#ecb613]/10 hover:text-[#ecb613] transition-colors" aria-label="Settings">
                            <span className="material-symbols-outlined text-xl sm:text-2xl">settings</span>
                        </button>
                    )}

                    {/* Help/About button if not showing avatar */}
                    {!showAvatar && (
                        <button className="hidden sm:flex size-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-[#ecb613]/10 hover:text-[#ecb613] transition-colors" aria-label="Help">
                            <span className="material-symbols-outlined">help_outline</span>
                        </button>
                    )}

                    {/* User profile picture if showAvatar is enabled */}
                    {showAvatar && (
                        <div className="size-9 sm:size-10 rounded-full overflow-hidden border-2 border-amber-500/20 shadow-sm cursor-pointer hover:border-amber-500/50 transition-all select-none">
                            <img 
                                src={avatarUrl} 
                                alt="User profile" 
                                className="w-full h-full object-cover" 
                            />
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
