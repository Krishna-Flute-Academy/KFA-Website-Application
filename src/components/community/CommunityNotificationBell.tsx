'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, MessageSquare, Heart, AtSign, Sparkles } from 'lucide-react';
import { supabaseAuth } from '../../lib/supabase-auth';
import { htmlToPlainText } from '../../lib/text-utils';
import { getCommunityDiscussionUrl } from '../../lib/community';

interface CommunityNotificationBellProps {
    currentUserId?: string;
}

export default function CommunityNotificationBell({ currentUserId: propUserId }: CommunityNotificationBellProps) {
    const router = useRouter();
    const [userId, setUserId] = useState<string | null>(propUserId || null);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Ensure user ID is resolved even if prop was slightly delayed
    useEffect(() => {
        if (propUserId) {
            setUserId(propUserId);
            return;
        }

        let isMounted = true;
        supabaseAuth.auth.getSession().then(({ data: { session } }) => {
            if (isMounted && session?.user?.id) {
                setUserId(session.user.id);
            }
        });

        const { data: { subscription } } = supabaseAuth.auth.onAuthStateChange((_, session) => {
            if (isMounted) {
                setUserId(session?.user?.id || null);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, [propUserId]);

    // Initial fetch of notifications
    useEffect(() => {
        let isMounted = true;
        const fetchNotifications = async () => {
            if (!userId) return;
            try {
                const { data, error } = await supabaseAuth
                    .from('notifications')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(30);

                if (!error && isMounted) {
                    setNotifications(data || []);
                }
            } catch (err) {
                console.warn('[CommunityBell] Load notice:', err);
            }
        };

        fetchNotifications();
        return () => { isMounted = false; };
    }, [userId]);

    // Realtime notifications subscription: keeps bell badge and list immediately in sync
    useEffect(() => {
        if (!userId) return;

        const channel = supabaseAuth
            .channel(`community-bell-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newRow = payload.new as any;
                        setNotifications(prev => [newRow, ...prev.filter(n => n.id !== newRow.id)]);
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedRow = payload.new as any;
                        setNotifications(prev =>
                            prev.map(n => n.id === updatedRow.id ? { ...n, ...updatedRow } : n)
                        );
                    } else if (payload.eventType === 'DELETE') {
                        const oldId = (payload.old as any)?.id;
                        if (oldId) setNotifications(prev => prev.filter(n => n.id !== oldId));
                    }
                }
            )
            .subscribe();

        return () => {
            supabaseAuth.removeChannel(channel);
        };
    }, [userId]);

    // Close on click outside and escape
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setShowDropdown(false);
        };

        if (showDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [showDropdown]);

    const handleItemClick = async (notif: any) => {
        setShowDropdown(false);

        if (!notif.is_read) {
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
            try {
                await supabaseAuth.from('notifications').update({ is_read: true }).eq('id', notif.id);
            } catch (e) {
                console.warn('[CommunityBell] Mark read error:', e);
            }
        }

        const targetSlugOrId = notif.metadata?.slug || notif.metadata?.post_id;
        const fallbackLink = targetSlugOrId
            ? getCommunityDiscussionUrl(targetSlugOrId, notif.metadata?.reply_id)
            : '/community';
        const targetLink = notif.link || fallbackLink;

        // Check if navigation includes a hash anchor
        if (typeof window !== 'undefined' && targetLink.includes('#')) {
            const [path, hash] = targetLink.split('#');
            if (window.location.pathname === path) {
                // Update URL hash cleanly without full page re-render
                window.history.replaceState(null, '', targetLink);
                // Already on the same page - smoothly scroll to target element
                const el = document.getElementById(hash);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('ring-2', 'ring-amber-500', 'bg-amber-50/40', 'dark:bg-amber-950/40');
                    setTimeout(() => el.classList.remove('ring-2', 'ring-amber-500', 'bg-amber-50/40', 'dark:bg-amber-950/40'), 3500);
                    return;
                }
            }
        }

        router.push(targetLink);
    };

    const handleMarkAllRead = async () => {
        if (!userId) return;
        try {
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            await supabaseAuth
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', userId)
                .eq('is_read', false);
        } catch (e) {
            console.warn('[CommunityBell] Mark all read error:', e);
        }
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    // Helper for relative timestamps
    const formatRelativeTime = (isoString: string) => {
        const diffMs = Date.now() - new Date(isoString).getTime();
        const mins = Math.floor(diffMs / (60 * 1000));
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    // Helper for icon based on notification type
    const getNotificationIcon = (notif: any) => {
        const title = (notif.title || '').toLowerCase();
        const msg = (notif.message || '').toLowerCase();
        const metaType = notif.metadata?.type || '';

        if (metaType.includes('mention') || title.includes('mention') || msg.includes('mentioned')) {
            return <AtSign className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
        }
        if (metaType.includes('reaction') || title.includes('reaction') || msg.includes('liked') || msg.includes('reacted')) {
            return <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />;
        }
        if (metaType.includes('reply') || title.includes('reply') || msg.includes('replied')) {
            return <MessageSquare className="w-3.5 h-3.5 text-blue-500" />;
        }
        return <Sparkles className="w-3.5 h-3.5 text-amber-600" />;
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button: strictly locked 36x36px footprint */}
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                className={`relative w-9 h-9 p-2 rounded-xl flex items-center justify-center shrink-0 text-slate-700 dark:text-slate-200 hover:bg-amber-100/60 dark:hover:bg-amber-950/40 active:scale-95 transition-all ${showDropdown ? 'bg-amber-100/70 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300' : ''}`}
                aria-label={`Notifications (${unreadCount} unread)`}
                title="Community Notifications"
            >
                <Bell className="w-5 h-5 shrink-0" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-amber-600 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center shadow-xs border-2 border-white dark:border-[#1a140e] animate-in zoom-in-75 duration-200 pointer-events-none">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Notifications Dropdown Popover */}
            {showDropdown && (
                <div 
                    className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-sm sm:w-84 bg-white dark:bg-[#1f1710] rounded-2xl border border-amber-900/10 dark:border-amber-500/20 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                    role="dialog"
                    aria-label="Community Notifications"
                >
                    {/* Header */}
                    <div className="px-4 py-3 bg-amber-50/70 dark:bg-amber-950/40 border-b border-amber-900/10 dark:border-amber-500/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                                Notifications
                            </span>
                            {unreadCount > 0 && (
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-600 text-white rounded-full">
                                    {unreadCount} new
                                </span>
                            )}
                        </div>

                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-xs font-semibold text-amber-800 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 flex items-center gap-1 hover:underline"
                            >
                                <CheckCheck className="w-3.5 h-3.5" />
                                <span>Mark read</span>
                            </button>
                        )}
                    </div>

                    {/* Notification Items List */}
                    <div className="max-h-[360px] overflow-y-auto divide-y divide-amber-900/5 dark:divide-amber-500/10">
                        {notifications.length === 0 ? (
                            <div className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                                <Bell className="w-7 h-7 mx-auto mb-2 opacity-30 text-amber-800" />
                                <p className="text-xs font-medium">No notifications yet.</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">When people react, reply, or mention you, you&apos;ll see it here.</p>
                            </div>
                        ) : (
                            notifications.map((notif) => (
                                <div
                                    key={notif.id}
                                    onClick={() => handleItemClick(notif)}
                                    className={`px-4 py-3 flex gap-3 cursor-pointer transition-colors text-left ${!notif.is_read ? 'bg-amber-500/8 dark:bg-amber-500/15 hover:bg-amber-500/12' : 'hover:bg-amber-50/40 dark:hover:bg-amber-950/20'}`}
                                >
                                    <div className="mt-0.5 w-7 h-7 rounded-xl bg-amber-100/70 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                                        {getNotificationIcon(notif)}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline justify-between gap-1 mb-0.5">
                                            <span className={`text-xs text-slate-900 dark:text-slate-100 truncate ${!notif.is_read ? 'font-bold' : 'font-semibold'}`}>
                                                {notif.title}
                                            </span>
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                                                {formatRelativeTime(notif.created_at)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                                            {htmlToPlainText(notif.message)}
                                        </p>
                                    </div>

                                    {!notif.is_read && (
                                        <div className="w-2 h-2 rounded-full bg-amber-600 shrink-0 self-center" />
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
