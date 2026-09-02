'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { supabaseAuth } from '../lib/supabase-auth';
import { supabase } from '../lib/supabase';

interface TeacherSidebarProps {
    teacherProfile: { id?: string; name: string; email: string; role?: string; phone?: string | null; profile_pic_url?: string | null } | null;
    handleLogout: () => void;
}

const isNetworkError = (error: any) => {
    if (!error) return false;
    const msg = String(error.message || error.details || error.hint || error).toLowerCase();
    return msg.includes('failed to fetch') || 
           msg.includes('load failed') || 
           msg.includes('networkerror') || 
           msg.includes('connection refused') ||
           msg.includes('upstream') ||
           msg.includes('timeout') ||
           msg.includes('504') ||
           msg.includes('502') ||
           msg.includes('gateway') ||
           msg.includes('abort') ||
           (error.name === 'TypeError' && msg.includes('fetch'));
};

// Cache storage usage at the module level to persist across client-side page transitions
let cachedStorageUsed: number | null = null;
let cachedStorageTime = 0;
const STORAGE_CACHE_DURATION = 60 * 1000; // 1 minute

export default function TeacherSidebar({ teacherProfile, handleLogout }: TeacherSidebarProps) {
    const pathname = usePathname();
    const [activeSession, setActiveSession] = useState<{
        classroomId: string;
        classroomName: string;
        sessionType: 'online' | 'offline';
        sessionDate: string;
        startedAt: number;
    } | null>(null);
    const [secondsElapsed, setSecondsElapsed] = useState(0);
    const [unassignedCount, setUnassignedCount] = useState(0);
    const [pendingLeavesCount, setPendingLeavesCount] = useState(0);
    const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);
    const [unreadFeesCount, setUnreadFeesCount] = useState(0);
    const [unreadTasksCount, setUnreadTasksCount] = useState(0);
    const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
    const [isEndingSession, setIsEndingSession] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    // Widget Minimize / Maximize State for active classroom session
    const [isWidgetMinimized, setIsWidgetMinimized] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('active_class_widget_minimized') === 'true';
        }
        return false;
    });

    const toggleWidgetMinimized = (val?: boolean) => {
        setIsWidgetMinimized(prev => {
            const next = val !== undefined ? val : !prev;
            if (typeof window !== 'undefined') {
                localStorage.setItem('active_class_widget_minimized', String(next));
            }
            return next;
        });
    };

    // Widget Drag Position State
    const [widgetPos, setWidgetPos] = useState<{ x: number; y: number } | null>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('active_class_widget_pos');
            if (saved) {
                try {
                    return JSON.parse(saved);
                } catch (e) {}
            }
        }
        return null;
    });

    const isDraggingRef = React.useRef(false);
    const dragStartRef = React.useRef<{ mouseX: number; mouseY: number; initialX: number; initialY: number }>({ mouseX: 0, mouseY: 0, initialX: 0, initialY: 0 });
    const currentPosRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const rafIdRef = React.useRef<number | null>(null);
    const widgetRef = React.useRef<HTMLDivElement>(null);

    const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('a') || target.closest('input')) {
            return;
        }

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        let currentX = widgetPos?.x;
        let currentY = widgetPos?.y;

        if (currentX === undefined || currentY === undefined || widgetPos === null) {
            if (widgetRef.current) {
                const rect = widgetRef.current.getBoundingClientRect();
                currentX = rect.left;
                currentY = rect.top;
            } else {
                currentX = window.innerWidth - 340;
                currentY = window.innerHeight - 200;
            }
        }

        isDraggingRef.current = true;
        dragStartRef.current = {
            mouseX: clientX,
            mouseY: clientY,
            initialX: currentX,
            initialY: currentY
        };
        currentPosRef.current = { x: currentX, y: currentY };

        if (widgetRef.current) {
            widgetRef.current.style.transition = 'none';
            widgetRef.current.style.left = `${currentX}px`;
            widgetRef.current.style.top = `${currentY}px`;
            widgetRef.current.style.right = 'auto';
            widgetRef.current.style.bottom = 'auto';
        }

        const handleDragMove = (moveEvt: MouseEvent | TouchEvent) => {
            if (!isDraggingRef.current) return;
            if (moveEvt.cancelable) moveEvt.preventDefault();

            const moveX = 'touches' in moveEvt ? moveEvt.touches[0].clientX : moveEvt.clientX;
            const moveY = 'touches' in moveEvt ? moveEvt.touches[0].clientY : moveEvt.clientY;

            const deltaX = moveX - dragStartRef.current.mouseX;
            const deltaY = moveY - dragStartRef.current.mouseY;

            let newX = dragStartRef.current.initialX + deltaX;
            let newY = dragStartRef.current.initialY + deltaY;

            const widgetWidth = widgetRef.current?.offsetWidth || 320;
            const widgetHeight = widgetRef.current?.offsetHeight || 180;

            const maxX = window.innerWidth - widgetWidth - 10;
            const maxY = window.innerHeight - widgetHeight - 10;

            newX = Math.max(10, Math.min(newX, maxX));
            newY = Math.max(10, Math.min(newY, maxY));

            currentPosRef.current = { x: newX, y: newY };

            if (rafIdRef.current === null) {
                rafIdRef.current = requestAnimationFrame(() => {
                    rafIdRef.current = null;
                    if (widgetRef.current && isDraggingRef.current) {
                        widgetRef.current.style.left = `${currentPosRef.current.x}px`;
                        widgetRef.current.style.top = `${currentPosRef.current.y}px`;
                    }
                });
            }
        };

        const handleDragEnd = () => {
            if (!isDraggingRef.current) return;
            isDraggingRef.current = false;
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
            window.removeEventListener('mousemove', handleDragMove);
            window.removeEventListener('mouseup', handleDragEnd);
            window.removeEventListener('touchmove', handleDragMove);
            window.removeEventListener('touchend', handleDragEnd);

            if (widgetRef.current) {
                widgetRef.current.style.transition = '';
            }

            const finalPos = currentPosRef.current;
            setWidgetPos(finalPos);
            if (typeof window !== 'undefined') {
                localStorage.setItem('active_class_widget_pos', JSON.stringify(finalPos));
            }
        };

        window.addEventListener('mousemove', handleDragMove);
        window.addEventListener('mouseup', handleDragEnd);
        window.addEventListener('touchmove', handleDragMove, { passive: false });
        window.addEventListener('touchend', handleDragEnd);
    };

    // Storage Status States
    const [storageUsed, setStorageUsed] = useState<number | null>(null);
    const [isFetchingStorage, setIsFetchingStorage] = useState<boolean>(true);
    const storageLimit = 2 * 1024 * 1024 * 1024; // 2 GB

    useEffect(() => {
        const handleToggle = () => setIsOpen(prev => !prev);
        const handleClose = () => setIsOpen(false);
        window.addEventListener('kfa-toggle-sidebar', handleToggle);
        window.addEventListener('kfa-close-sidebar', handleClose);
        return () => {
            window.removeEventListener('kfa-toggle-sidebar', handleToggle);
            window.removeEventListener('kfa-close-sidebar', handleClose);
        };
    }, []);

    const [localRole, setLocalRole] = useState<string>('teacher');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const role = localStorage.getItem('kfa-user-role');
            if (role) {
                setLocalRole(role.toLowerCase());
            }
        }
    }, []);

    const userRole = teacherProfile?.role?.toLowerCase() || 
                     (pathname?.startsWith('/admin-dashboard') ? 'admin' : localRole);

    useEffect(() => {
        const fetchStorageStatus = async () => {
            const now = Date.now();
            if (cachedStorageUsed !== null && (now - cachedStorageTime) < STORAGE_CACHE_DURATION) {
                setStorageUsed(cachedStorageUsed);
                setIsFetchingStorage(false);
                return;
            }

            try {
                let totalBytes = 0;

                // 1. Fetch from Main Supabase
                try {
                    const { data: blogFiles } = await supabase.storage.from('blog_images').list('', { limit: 1000, recursive: true } as any);
                    if (blogFiles) {
                        blogFiles.forEach(f => {
                            totalBytes += f.metadata?.size || 0;
                        });
                    }
                } catch (e) {
                    console.warn('Error fetching Main Supabase blog_images storage:', e);
                }

                try {
                    const { data: galleryFiles } = await supabase.storage.from('gallery').list('', { limit: 1000, recursive: true } as any);
                    if (galleryFiles) {
                        galleryFiles.forEach(f => {
                            totalBytes += f.metadata?.size || 0;
                        });
                    }
                } catch (e) {
                    console.warn('Error fetching Main Supabase gallery storage:', e);
                }

                // 2. Fetch from Auth Supabase
                try {
                    const { data: classNotesFiles } = await supabaseAuth.storage.from('class_notes').list('', { limit: 1000, recursive: true } as any);
                    if (classNotesFiles) {
                        classNotesFiles.forEach(f => {
                            totalBytes += f.metadata?.size || 0;
                        });
                    }
                } catch (e) {
                    console.warn('Error fetching Auth Supabase class_notes storage:', e);
                }

                try {
                    const { data: inventoryFiles } = await supabaseAuth.storage.from('inventory_materials').list('', { limit: 1000, recursive: true } as any);
                    if (inventoryFiles) {
                        inventoryFiles.forEach(f => {
                            totalBytes += f.metadata?.size || 0;
                        });
                    }
                } catch (e) {
                    console.warn('Error fetching Auth Supabase inventory_materials storage:', e);
                }

                cachedStorageUsed = totalBytes;
                cachedStorageTime = now;
                setStorageUsed(totalBytes);
            } catch (error) {
                console.error('Failed to calculate storage size:', error);
            } finally {
                setIsFetchingStorage(false);
            }
        };

        fetchStorageStatus();
    }, []);

    const formatStorageSize = (bytes: number) => {
        const mb = bytes / (1024 * 1024);
        if (mb < 1000) {
            return `${mb.toFixed(1)} MB`;
        }
        const gb = mb / 1024;
        return `${gb.toFixed(2)} GB`;
    };

    const storagePercentage = storageUsed !== null ? Math.min((storageUsed / storageLimit) * 100, 100) : 0;

    const isLiveCheckingRef = useRef(false);
    const isAdminCheckingRef = useRef(false);

    useEffect(() => {
        if (!teacherProfile?.id) return;

        // 1. Live classroom polling routine (60s cadence)
        const checkActiveSessionInDB = async () => {
            if (typeof document !== 'undefined' && document.hidden) return;
            if (isLiveCheckingRef.current || !teacherProfile?.id) return;
            isLiveCheckingRef.current = true;

            try {
                const isUserAdmin = userRole === 'admin';
                let query = supabaseAuth
                    .from('classrooms')
                    .select('id, name, is_live, live_meeting_link, live_session_started_at')
                    .eq('is_live', true);

                if (!isUserAdmin) {
                    query = query.eq('teacher_id', teacherProfile.id);
                }

                const { data: liveRooms, error } = await query
                    .order('live_session_started_at', { ascending: false })
                    .limit(1);

                if (!error) {
                    if (liveRooms && liveRooms.length > 0) {
                        const room = liveRooms[0];
                        const startedTime = room.live_session_started_at ? new Date(room.live_session_started_at).getTime() : Date.now();
                        const sessionDateStr = room.live_session_started_at
                            ? new Date(room.live_session_started_at).toISOString().split('T')[0]
                            : new Date().toISOString().split('T')[0];

                        setActiveSession({
                            classroomId: room.id,
                            classroomName: room.name,
                            sessionType: room.live_meeting_link ? 'online' : 'offline',
                            sessionDate: sessionDateStr,
                            startedAt: startedTime
                        });
                    } else {
                        setActiveSession(null);
                    }
                }
            } catch (err: any) {
                console.warn('Notice fetching active session from DB:', err?.message || err);
            } finally {
                isLiveCheckingRef.current = false;
            }
        };

        // 2. Administrative counters polling routine (180s cadence)
        const fetchAdminCounters = async () => {
            if (typeof document !== 'undefined' && document.hidden) return;
            if (isAdminCheckingRef.current || !teacherProfile?.id) return;
            isAdminCheckingRef.current = true;

            try {
                const isUserAdmin = userRole === 'admin';
                const teacherId = teacherProfile.id;
                const promises: Promise<any>[] = [];

                // A. Unassigned count (admin only)
                if (isUserAdmin) {
                    promises.push(
                        (async () => {
                            try {
                                const { count, error } = await supabaseAuth
                                    .from('users')
                                    .select('id', { count: 'exact', head: true })
                                    .in('role', ['student', 'pending'])
                                    .is('teacher_id', null);
                                if (!error && count !== null) setUnassignedCount(count);
                            } catch (err: any) {
                                console.warn('Notice fetching unassigned count:', err?.message || err);
                            }
                        })()
                    );
                }

                // B. Pending payments count (admin only)
                if (isUserAdmin) {
                    promises.push(
                        (async () => {
                            try {
                                const { count, error } = await supabaseAuth
                                    .from('fees_payments')
                                    .select('id', { count: 'exact', head: true })
                                    .eq('status', 'pending_approval');
                                if (!error && count !== null) setPendingPaymentsCount(count);
                            } catch (err: any) {
                                console.warn('Notice fetching pending payments count:', err?.message || err);
                            }
                        })()
                    );
                }

                // C. Pending leaves count
                promises.push(
                    (async () => {
                        try {
                            if (isUserAdmin) {
                                const { count, error } = await supabaseAuth
                                    .from('leave_requests')
                                    .select('id', { count: 'exact', head: true })
                                    .eq('status', 'pending');
                                if (!error && count !== null) setPendingLeavesCount(count);
                            } else {
                                const { data: classrooms, error: roomsErr } = await supabaseAuth
                                    .from('classrooms')
                                    .select('id')
                                    .eq('teacher_id', teacherId);
                                if (!roomsErr) {
                                    const roomIds = classrooms?.map(c => c.id) || [];
                                    if (roomIds.length > 0) {
                                        const { count, error: countErr } = await supabaseAuth
                                            .from('leave_requests')
                                            .select('id', { count: 'exact', head: true })
                                            .eq('status', 'pending')
                                            .in('classroom_id', roomIds);
                                        if (!countErr && count !== null) setPendingLeavesCount(count);
                                    } else {
                                        setPendingLeavesCount(0);
                                    }
                                }
                            }
                        } catch (err: any) {
                            console.warn('Notice fetching pending leave requests count:', err?.message || err);
                        }
                    })()
                );

                // D. Notifications unread category count
                promises.push(
                    (async () => {
                        try {
                            const { data, error } = await supabaseAuth
                                .from('notifications')
                                .select('type')
                                .eq('user_id', teacherId)
                                .eq('is_read', false);

                            if (!error && data) {
                                let fees = 0;
                                let tasks = 0;
                                let messages = 0;
                                data.forEach(n => {
                                    if (n.type === 'fees') fees++;
                                    else if (n.type === 'tasks') tasks++;
                                    else if (n.type === 'messages') messages++;
                                });
                                setUnreadFeesCount(fees);
                                setUnreadTasksCount(tasks);
                                setUnreadMessagesCount(messages);
                            }
                        } catch (err: any) {
                            console.warn('Notice fetching notification counts in sidebar:', err?.message || err);
                        }
                    })()
                );

                await Promise.allSettled(promises);
            } catch (error: any) {
                console.warn('Notice in sidebar counts polling:', error?.message || error);
            } finally {
                isAdminCheckingRef.current = false;
            }
        };

        // Run immediately on mount
        checkActiveSessionInDB();
        fetchAdminCounters();

        // 1. Live classroom polling: every 60 seconds (time-sensitive)
        const liveIntervalId = setInterval(checkActiveSessionInDB, 60000);

        // 2. Administrative counters polling: every 180 seconds (3 minutes)
        const adminIntervalId = setInterval(fetchAdminCounters, 180000);

        // Visibility restore: zero polling when hidden; immediate refresh on visible
        const handleVisibility = () => {
            if (!document.hidden) {
                checkActiveSessionInDB();
                fetchAdminCounters();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            clearInterval(liveIntervalId);
            clearInterval(adminIntervalId);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [teacherProfile?.id, userRole]);

    // Timer effect for the active session widget
    useEffect(() => {
        if (!activeSession) {
            setSecondsElapsed(0);
            return;
        }

        const updateTimer = () => {
            const elapsed = Math.floor((Date.now() - activeSession.startedAt) / 1000);
            setSecondsElapsed(elapsed > 0 ? elapsed : 0);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [activeSession]);

    const isMeetingPage = pathname?.endsWith('/meeting');
    const basePath = userRole === 'admin' ? '/admin-dashboard' : '/teacher-dashboard';

    const normalizePath = (p: string | null) => {
        if (!p) return '';
        let normalized = p.replace(/\/$/, '') || '/';
        normalized = normalized.replace('/admin-dashboard', '/teacher-dashboard');
        return normalized;
    };

    const menuItems = [
        { name: userRole === 'admin' ? 'Admin-dashboard' : 'Dashboard', icon: 'dashboard', href: basePath },
        ...(userRole === 'admin' ? [{ name: 'Students', icon: 'group', href: `${basePath}/students` }] : []),
        { name: 'Classrooms', icon: 'meeting_room', href: `${basePath}/classrooms` },
        { name: 'Tasks', icon: 'assignment', href: `${basePath}/tasks` },
        { name: 'Inventory Library', icon: 'inventory_2', href: `${basePath}/inventory` },
        { name: 'Attendance', icon: 'calendar_today', href: `${basePath}/attendance` },
        ...(userRole === 'admin' ? [{ name: 'Fees', icon: 'payments', href: `${basePath}/fees` }] : []),
        { name: 'Messages', icon: 'chat_bubble', href: `${basePath}/messages` },
        ...(userRole === 'admin' ? [{ name: 'Role Allocation', icon: 'manage_accounts', href: `${basePath}/role-allocation` }] : []),
        ...(userRole === 'admin' ? [{ name: 'Login Sessions', icon: 'history', href: `${basePath}/sessions` }] : []),
        { name: 'Academy Policies', icon: 'policy', href: `${basePath}/policies` },
        { name: 'Profile Settings', icon: 'settings', href: `${basePath}/settings` },
    ];

    const handleLogoutWithClear = () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('kfa-user-role');
        }
        handleLogout();
    };

    return (
        <>
            {/* Sidebar Overlay Backdrop for Mobile */}
            {isOpen && (
                <div 
                    className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}
            <aside className={`
                w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0
                fixed md:sticky top-0 left-0 h-screen z-50 transition-transform duration-300 md:translate-x-0
                ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
            <div className="p-6 flex items-center justify-between">
                <div className="flex flex-col justify-center">
                    <h1 className="font-black text-xl leading-tight text-slate-950 dark:text-white select-none">
                        {userRole === 'admin' ? 'Music Admin' : 'Teacher Portal'}
                    </h1>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 uppercase tracking-wider select-none">
                        {userRole === 'admin' ? 'Admin Portal' : 'Instructor View'}
                    </p>
                </div>
                <button 
                    onClick={() => setIsOpen(false)}
                    className="md:hidden size-8 flex items-center justify-center rounded-lg text-slate-550 hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors"
                    aria-label="Close Sidebar"
                >
                    <span className="material-symbols-outlined select-none text-xl">close</span>
                </button>
            </div>

            <nav className="flex-1 px-3 space-y-1.5 mt-6 overflow-y-auto">
                {menuItems.map((item) => {
                    const normalizedPathname = normalizePath(pathname);
                    const normalizedItemHref = normalizePath(item.href);
                    const normalizedBasePath = normalizePath(basePath);

                    const isActive = normalizedItemHref === normalizedBasePath 
                        ? normalizedPathname === normalizedItemHref 
                        : normalizedPathname.startsWith(normalizedItemHref);
                    return (
                        <Link
                            key={item.name}
                            className={`flex items-center gap-3 py-3 transition-all relative ${isActive
                                    ? 'bg-gradient-to-r from-amber-500/10 to-amber-500/0 text-[#b45309] dark:text-[#ecb613] font-black border-l-4 border-[#d97706] pl-3.5 pr-4 rounded-r-2xl'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 px-4 rounded-xl'
                                }`}
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                        >
                            <span className="material-symbols-outlined text-[22px] select-none">{item.icon}</span>
                            <span className="text-sm font-semibold flex-1">{item.name}</span>
                            {item.name === 'Students' && userRole === 'admin' && unassignedCount > 0 && (
                                <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-in zoom-in">
                                    {unassignedCount} New
                                </span>
                            )}
                            {item.name === 'Attendance' && pendingLeavesCount > 0 && (
                                <span className="bg-[#ecb613] text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-in zoom-in">
                                    {pendingLeavesCount} New
                                </span>
                            )}
                            {item.name === 'Fees' && userRole === 'admin' && unreadFeesCount > 0 && (
                                <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-in zoom-in">
                                    {unreadFeesCount} New
                                </span>
                            )}
                            {item.name === 'Tasks' && unreadTasksCount > 0 && (
                                <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-in zoom-in">
                                    {unreadTasksCount} New
                                </span>
                            )}
                            {item.name === 'Messages' && unreadMessagesCount > 0 && (
                                <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-in zoom-in">
                                    {unreadMessagesCount} New
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-4 bg-slate-50/50 dark:bg-slate-900/30">
                {/* Storage Status Widget */}
                <div className="px-4 py-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-[#d97706]">
                        <span>Storage Status</span>
                        {isFetchingStorage && (
                            <span className="animate-pulse text-slate-400">Updating...</span>
                        )}
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden border border-transparent dark:border-slate-800">
                        <div 
                            className="bg-[#d97706] h-2 rounded-full transition-all duration-500 ease-out" 
                            style={{ width: `${storagePercentage}%` }}
                        ></div>
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-none">
                        {isFetchingStorage && storageUsed === null ? (
                            'Calculating...'
                        ) : (
                            `${formatStorageSize(storageUsed || 0)} of ${formatStorageSize(storageLimit)} used`
                        )}
                    </div>
                </div>

                <button
                    onClick={handleLogoutWithClear}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                >
                    <span className="material-symbols-outlined">logout</span>
                    <span className="text-sm font-semibold">Logout</span>
                </button>

                <div className="mt-4 flex items-center gap-3 px-3 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 shadow-xs">
                    <div className="size-10 rounded-full overflow-hidden border border-amber-500/20 bg-amber-500/10 flex items-center justify-center shrink-0">
                        {teacherProfile?.profile_pic_url ? (
                            <img 
                                src={teacherProfile.profile_pic_url} 
                                alt={teacherProfile.name || 'User profile'} 
                                className="w-full h-full object-cover" 
                            />
                        ) : (
                            <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                                {teacherProfile?.name ? teacherProfile.name.charAt(0).toUpperCase() : 'U'}
                            </span>
                        )}
                    </div>
                    <div className="overflow-hidden min-w-0">
                        <p className="text-sm font-black truncate text-slate-900 dark:text-white">{teacherProfile?.name || 'User'}</p>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                            {userRole === 'admin' ? 'Administrator' : 'Instructor'}
                        </p>
                    </div>
                </div>
            </div>
        </aside>

        {/* Global floating ongoing active class screen widget */}
        {activeSession && !isMeetingPage && (
            isWidgetMinimized ? (
                /* Minimized Pill View */
                <div
                    ref={widgetRef}
                    onMouseDown={handleDragStart}
                    onTouchStart={handleDragStart}
                    style={widgetPos ? { left: `${widgetPos.x}px`, top: `${widgetPos.y}px`, right: 'auto', bottom: 'auto' } : undefined}
                    className={`${widgetPos ? 'fixed z-[150]' : 'fixed bottom-6 right-6 z-[150]'} bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-amber-500/40 dark:border-amber-500/30 shadow-2xl px-4 py-2.5 flex items-center gap-3 animate-in slide-in-from-bottom-3 duration-200 text-left cursor-grab active:cursor-grabbing select-none`}
                >
                    <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-sm cursor-grab">drag_indicator</span>
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                activeSession.sessionType === 'online' ? 'bg-blue-400' : 'bg-amber-400'
                            }`}></span>
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                                activeSession.sessionType === 'online' ? 'bg-blue-500' : 'bg-amber-500'
                            }`}></span>
                        </span>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 font-mono">
                                Started Class
                            </span>
                            <h4 className="text-xs font-black text-slate-900 dark:text-white max-w-[140px] sm:max-w-[180px] truncate leading-tight">
                                {activeSession.classroomName}
                            </h4>
                        </div>
                    </div>

                    {/* Timer */}
                    <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                        <span>{(() => {
                            const mins = Math.floor(secondsElapsed / 60);
                            const secs = secondsElapsed % 60;
                            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                        })()}</span>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => toggleWidgetMinimized(false)}
                            title="Expand active class widget"
                            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-base">open_in_full</span>
                        </button>
                        <Link
                            href={`/teacher-dashboard/classrooms/${activeSession.classroomId}/meeting`}
                            className="px-3 py-1.5 bg-[#ecb613] hover:bg-amber-500 text-slate-950 rounded-xl text-[10px] font-black tracking-wide uppercase transition-all shadow-sm flex items-center gap-1 hover:scale-105 active:scale-95 text-center cursor-pointer"
                            title="Open started classroom"
                        >
                            <span className="material-symbols-outlined text-sm">fullscreen</span>
                            Maximize
                        </Link>
                    </div>
                </div>
            ) : (
                /* Maximized Card View */
                <div
                    ref={widgetRef}
                    onMouseDown={handleDragStart}
                    onTouchStart={handleDragStart}
                    style={widgetPos ? { left: `${widgetPos.x}px`, top: `${widgetPos.y}px`, right: 'auto', bottom: 'auto' } : undefined}
                    className={`${widgetPos ? 'fixed z-[150]' : 'fixed bottom-6 right-6 z-[150]'} w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-4 flex flex-col gap-3 animate-in slide-in-from-bottom-5 duration-300 text-left cursor-grab active:cursor-grabbing select-none`}
                >
                    {/* Glowing active indicator, drag handle, timer, and minimize button */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-sm cursor-grab">drag_indicator</span>
                            <span className="relative flex h-2.5 w-2.5">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                    activeSession.sessionType === 'online' ? 'bg-blue-400' : 'bg-amber-400'
                                }`}></span>
                                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                                    activeSession.sessionType === 'online' ? 'bg-blue-500' : 'bg-amber-500'
                                }`}></span>
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 font-mono">
                                Ongoing {activeSession.sessionType === 'online' ? 'Online' : 'In-Person'} Class
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {/* Compact timer */}
                            <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-150 dark:border-slate-800">
                                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                                <span>{(() => {
                                    const mins = Math.floor(secondsElapsed / 60);
                                    const secs = secondsElapsed % 60;
                                    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                                })()}</span>
                            </div>
                            {/* Minimize Widget Button */}
                            <button
                                onClick={() => toggleWidgetMinimized(true)}
                                title="Minimize active class widget"
                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-base">close_fullscreen</span>
                            </button>
                        </div>
                    </div>

                    <div className="text-left space-y-1">
                        <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">{activeSession.classroomName}</h4>
                        <p className="text-[10px] text-slate-500 font-medium">Classroom is started. Navigate away safely; your session remains active.</p>
                    </div>

                    {/* Direct action triggers */}
                    <div className="flex gap-2 mt-1">
                        <button
                            disabled={isEndingSession}
                            onClick={async () => {
                                if (isEndingSession) return;
                                if (confirm('Are you sure you want to end this active class session?')) {
                                    setIsEndingSession(true);
                                    const sessionToClear = activeSession;
                                    if (!sessionToClear) {
                                        setIsEndingSession(false);
                                        return;
                                    }
                                    // Optimistically hide active session widget immediately for instant responsiveness
                                    if (typeof window !== 'undefined') {
                                        localStorage.removeItem('active_class_session');
                                        window.dispatchEvent(new Event('storage'));
                                        window.dispatchEvent(new CustomEvent('class_session_ended', { detail: { classroomId: sessionToClear.classroomId } }));
                                    }
                                    setActiveSession(null);

                                    try {
                                        const startedAtTime = sessionToClear.startedAt || Date.now();
                                        const endedAtTime = Date.now();
                                        const durationSecs = Math.max(1, Math.floor((endedAtTime - startedAtTime) / 1000));
                                        const sessionDateStr = sessionToClear.sessionDate || new Date().toISOString().split('T')[0];

                                        try {
                                            await supabaseAuth.rpc('end_classroom_session', {
                                                p_classroom_id: sessionToClear.classroomId,
                                                p_session_date: sessionDateStr,
                                                p_session_type: sessionToClear.sessionType || 'online',
                                                p_started_at: new Date(startedAtTime).toISOString(),
                                                p_ended_at: new Date(endedAtTime).toISOString(),
                                                p_duration_seconds: durationSecs
                                            });
                                        } catch (rpcErr) {
                                            console.warn('RPC end_classroom_session warning/error:', rpcErr);
                                        }

                                        await supabaseAuth
                                            .from('classrooms')
                                            .update({
                                                is_live: false,
                                                live_meeting_link: null,
                                                live_session_started_at: null
                                            })
                                            .eq('id', sessionToClear.classroomId);
                                    } catch (err: any) {
                                        console.error('Error ending class session from sidebar:', err);
                                    } finally {
                                        setIsEndingSession(false);
                                    }
                                }
                            }}
                            className="flex-1 py-2 border border-rose-200 hover:bg-rose-50 dark:border-rose-900/30 dark:hover:bg-rose-950/20 text-rose-600 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isEndingSession ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                            ) : (
                                <span className="material-symbols-outlined text-sm">logout</span>
                            )}
                            {isEndingSession ? 'Ending...' : 'End Class'}
                        </button>
                        <Link
                            href={`/teacher-dashboard/classrooms/${activeSession.classroomId}/meeting`}
                            className="flex-1 py-2 bg-[#ecb613] hover:bg-amber-500 text-slate-950 rounded-xl text-[11px] font-black tracking-wide uppercase transition-all shadow-md shadow-amber-500/10 flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-95 text-center cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-sm">fullscreen</span>
                            Maximize
                        </Link>
                    </div>
                </div>
            )
        )}
    </>
);
}
