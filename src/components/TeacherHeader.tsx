'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabaseAuth } from '../lib/supabase-auth';

interface TeacherHeaderProps {
    title: string;
    searchQuery?: string;
    onSearchChange?: (query: string) => void;
    placeholder?: string;
    showSettings?: boolean;
    showAvatar?: boolean;
    avatarUrl?: string | null;
    userName?: string;
    backLink?: string;
    children?: React.ReactNode;
}

export default function TeacherHeader({ 
    title, 
    searchQuery, 
    onSearchChange,
    placeholder = "Search students or tasks...",
    showSettings = false,
    showAvatar = true,
    avatarUrl,
    userName,
    backLink,
    children
}: TeacherHeaderProps) {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const notifDropdownRef = useRef<HTMLDivElement>(null);

    // Fetch user and notifications using cached getSession (no extra getUser() round-trip)
    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (!session?.user) return;
                
                setCurrentUserId(session.user.id);

                const { data, error } = await supabaseAuth
                    .from('notifications')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .order('created_at', { ascending: false })
                    .limit(30);

                if (error) throw error;
                setNotifications(data || []);
            } catch (err) {
                console.error('Error loading notifications:', err);
            }
        };

        fetchNotifications();
    }, []);

    // Realtime notifications — use a single channel, update local state on INSERT/UPDATE
    // Note: The ToastContext global channel already handles showing toast popups.
    // This channel only keeps the header dropdown list in sync.
    useEffect(() => {
        if (!currentUserId) return;

        const notifChannel = supabaseAuth
            .channel(`header-notif-${currentUserId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${currentUserId}`
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setNotifications(prev => [payload.new as any, ...prev]);
                    } else if (payload.eventType === 'UPDATE') {
                        setNotifications(prev =>
                            prev.map(n => n.id === (payload.new as any).id ? { ...n, ...(payload.new as any) } : n)
                        );
                    }
                }
            )
            .subscribe();

        return () => {
            supabaseAuth.removeChannel(notifChannel);
        };
    }, [currentUserId]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target as Node)) {
                setShowNotificationsDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const markAllNotificationsAsRead = async () => {
        if (!currentUserId) return;
        try {
            const { error } = await supabaseAuth
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', currentUserId);
            if (error) throw error;
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (err) {
            console.error('Error marking notifications as read:', err);
        }
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;    return (
        <header className="min-h-16 h-auto md:h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-30 flex flex-col justify-center">
            <div className="w-full h-16 flex items-center justify-between px-4 md:px-8">
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
                    <h2 className="text-sm sm:text-base md:text-lg font-bold tracking-tight text-slate-800 dark:text-white truncate max-w-[140px] xs:max-w-[200px] sm:max-w-none min-w-0">{title}</h2>
                    {onSearchChange && (
                        <div className="hidden md:flex items-center flex-1 max-w-xs sm:max-w-md w-full">
                            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-2 shrink-0"></div>
                            <div className="relative group w-full">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl group-focus-within:text-[#ecb613] select-none">search</span>
                                <input
                                    className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg pl-10 pr-4 py-1.5 text-sm w-full focus:ring-2 focus:ring-[#ecb613]/20 transition-all outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
                                    placeholder={placeholder}
                                    type="text"
                                    value={searchQuery ?? ''}
                                    onChange={(e) => onSearchChange(e.target.value)}
                                />
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 ml-2">
                    {children}
                    
                    {/* Notifications Button */}
                    <div className="relative" ref={notifDropdownRef}>
                        <button 
                            onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                            className="size-9 sm:size-10 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-400 hover:bg-[#ecb613]/10 hover:text-[#ecb613] transition-colors relative" 
                            aria-label="Notifications"
                        >
                            <span className="material-symbols-outlined text-xl sm:text-2xl">
                                {unreadCount > 0 ? 'notifications_active' : 'notifications'}
                            </span>
                            {unreadCount > 0 && (
                                <span className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 size-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                            )}
                        </button>

                        {showNotificationsDropdown && (
                            <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-sm sm:w-80 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                    <span className="font-bold text-sm text-slate-800 dark:text-white">Notifications</span>
                                    {unreadCount > 0 && (
                                        <button 
                                            onClick={markAllNotificationsAsRead}
                                            className="text-xs text-[#b45309] dark:text-[#ecb613] hover:underline font-semibold"
                                        >
                                            Mark all as read
                                        </button>
                                    )}
                                </div>
                                
                                <div className="max-h-64 overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <div className="px-4 py-6 text-center text-slate-400 dark:text-slate-500 text-xs">
                                            No notifications yet.
                                        </div>
                                    ) : (
                                        notifications.map((notif) => (
                                            <div 
                                                key={notif.id} 
                                                className={`px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-b-0 flex flex-col gap-0.5 text-left ${!notif.is_read ? 'bg-amber-500/5 dark:bg-amber-500/10 font-medium' : ''}`}
                                            >
                                                <div className="flex justify-between items-start gap-1">
                                                    <span className={`text-xs text-slate-800 dark:text-slate-200 ${!notif.is_read ? 'font-bold' : ''}`}>{notif.title}</span>
                                                    <span className="text-[10px] text-slate-450 dark:text-slate-500 shrink-0">
                                                        {new Date(notif.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{notif.message}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Help/About button if not showing avatar */}
                    {!showAvatar && (
                        <button className="hidden sm:flex size-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-[#ecb613]/10 hover:text-[#ecb613] transition-colors" aria-label="Help">
                            <span className="material-symbols-outlined">help_outline</span>
                        </button>
                    )}

                    {/* User profile picture if showAvatar is enabled */}
                    {showAvatar && (
                        <Link 
                            href="/teacher-dashboard/settings"
                            className="flex items-center gap-2 group"
                            title="Profile Settings"
                        >
                            <div className="size-9 sm:size-10 rounded-full overflow-hidden border-2 border-amber-500/20 shadow-sm cursor-pointer group-hover:border-amber-500/60 transition-all select-none bg-amber-500/10 flex items-center justify-center shrink-0">
                                {avatarUrl ? (
                                    <img 
                                        src={avatarUrl} 
                                        alt={userName || "User profile"} 
                                        className="w-full h-full object-cover" 
                                    />
                                ) : (
                                    <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                                        {userName ? userName.charAt(0).toUpperCase() : 'U'}
                                    </span>
                                )}
                            </div>
                            {userName && (
                                <span className="hidden lg:inline-block text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-[#b45309] dark:group-hover:text-[#ecb613] transition-colors truncate max-w-[120px]">
                                    {userName}
                                </span>
                            )}
                        </Link>
                    )}
                </div>
            </div>

            {/* Mobile Search Input Row */}
            {onSearchChange && (
                <div className="px-4 pb-3 pt-1 md:hidden w-full border-t border-slate-100 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/50">
                    <div className="relative group w-full">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg group-focus-within:text-[#ecb613] select-none">search</span>
                        <input
                            className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg pl-9 pr-4 py-1.5 text-xs w-full focus:ring-2 focus:ring-[#ecb613]/20 transition-all outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
                            placeholder={placeholder}
                            type="text"
                            value={searchQuery ?? ''}
                            onChange={(e) => onSearchChange(e.target.value)}
                        />
                    </div>
                </div>
            )}
        </header>
    );
}
