'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabaseAuth } from '../lib/supabase-auth';
import { supabase } from '../lib/supabase';

interface TeacherSidebarProps {
    teacherProfile: { id?: string; name: string; email: string; role?: string } | null;
    handleLogout: () => void;
}

const isNetworkError = (error: any) => {
    if (!error) return false;
    const msg = error.message || String(error);
    return msg.includes('Failed to fetch') || 
           msg.includes('Load failed') || 
           msg.includes('NetworkError') || 
           msg.includes('connection refused') ||
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
    const [isOpen, setIsOpen] = useState(false);

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

    useEffect(() => {
        if (userRole !== 'admin') return;

        const fetchUnassignedCount = async () => {
            try {
                const { count, error } = await supabaseAuth
                    .from('users')
                    .select('id', { count: 'exact' })
                    .eq('role', 'student')
                    .is('teacher_id', null);
                
                if (error) throw error;
                if (count !== null) setUnassignedCount(count);
            } catch (error: any) {
                if (isNetworkError(error)) {
                    console.warn('Network issue fetching unassigned count (will retry):', error?.message || error);
                } else {
                    console.error('Error fetching unassigned count:', error?.message || error);
                }
            }
        };

        fetchUnassignedCount();

        // Realtime: refresh count when users table changes (new signup or teacher_id assignment)
        const channel = supabaseAuth
            .channel('sidebar-unassigned-users')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
                fetchUnassignedCount();
            })
            .subscribe();

        return () => { supabaseAuth.removeChannel(channel); };
    }, [userRole]);

    useEffect(() => {
        if (userRole !== 'admin') return;

        const fetchPendingPaymentsCount = async () => {
            try {
                const { count, error } = await supabaseAuth
                    .from('fees_payments')
                    .select('id', { count: 'exact' })
                    .eq('status', 'pending_approval');
                
                if (error) throw error;
                if (count !== null) setPendingPaymentsCount(count);
            } catch (error: any) {
                if (isNetworkError(error)) {
                    console.warn('Network issue fetching pending payments count (will retry):', error?.message || error);
                } else {
                    console.error('Error fetching pending payments count:', error?.message || error);
                }
            }
        };

        fetchPendingPaymentsCount();

        // Realtime: refresh count when fees_payments table changes
        const channel = supabaseAuth
            .channel('sidebar-pending-payments')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'fees_payments' }, () => {
                fetchPendingPaymentsCount();
            })
            .subscribe();

        return () => { supabaseAuth.removeChannel(channel); };
    }, [userRole]);

    useEffect(() => {
        if (!teacherProfile || !teacherProfile.id) return;

        const fetchPendingLeavesCount = async () => {
            try {
                if (userRole === 'admin') {
                    const { count, error } = await supabaseAuth
                        .from('leave_requests')
                        .select('id', { count: 'exact' })
                        .eq('status', 'pending');
                    
                    if (error) throw error;
                    if (count !== null) {
                        setPendingLeavesCount(count);
                    }
                } else {
                    const { data: classrooms, error: roomsErr } = await supabaseAuth
                        .from('classrooms')
                        .select('id')
                        .eq('teacher_id', teacherProfile.id);
                    
                    if (roomsErr) throw roomsErr;
                    
                    const roomIds = classrooms?.map(c => c.id) || [];
                    if (roomIds.length > 0) {
                        const { count, error: countErr } = await supabaseAuth
                            .from('leave_requests')
                            .select('id', { count: 'exact' })
                            .eq('status', 'pending')
                            .in('classroom_id', roomIds);
                        
                        if (countErr) throw countErr;
                        if (count !== null) {
                            setPendingLeavesCount(count);
                        }
                    } else {
                        setPendingLeavesCount(0);
                    }
                }
            } catch (error: any) {
                if (isNetworkError(error)) {
                    console.warn('Network issue fetching pending leave requests count (will retry):', error?.message || error?.details || error);
                } else {
                    console.error('Error fetching pending leave requests count:', error?.message || error?.details || error);
                }
            }
        };

        fetchPendingLeavesCount();

        const pollingInterval = setInterval(fetchPendingLeavesCount, 30000);
        return () => clearInterval(pollingInterval);
    }, [teacherProfile, userRole]);

    useEffect(() => {
        if (!teacherProfile?.id) return;

        const fetchNotificationCounts = async () => {
            try {
                const { data, error } = await supabaseAuth
                    .from('notifications')
                    .select('type')
                    .eq('user_id', teacherProfile.id)
                    .eq('is_read', false);

                if (error) throw error;

                let fees = 0;
                let tasks = 0;
                let messages = 0;

                (data || []).forEach(n => {
                    if (n.type === 'fees') fees++;
                    else if (n.type === 'tasks') tasks++;
                    else if (n.type === 'messages') messages++;
                });

                setUnreadFeesCount(fees);
                setUnreadTasksCount(tasks);
                setUnreadMessagesCount(messages);
            } catch (err: any) {
                if (isNetworkError(err)) {
                    console.warn('Network issue fetching notification counts in sidebar (will retry):', err?.message || err);
                } else {
                    console.error('Error fetching notification counts in sidebar:', err);
                }
            }
        };

        fetchNotificationCounts();

        // Subscribe to real-time notification changes (INSERT, UPDATE, DELETE) for this user
        const notifChannel = supabaseAuth
            .channel(`sidebar-notifications-${teacherProfile.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${teacherProfile.id}`
                },
                () => {
                    fetchNotificationCounts();
                }
            )
            .subscribe();

        return () => {
            supabaseAuth.removeChannel(notifChannel);
        };
    }, [teacherProfile?.id]);

    // Fetch active session from classrooms table and subscribe to realtime updates
    useEffect(() => {
        if (!teacherProfile?.id) return;

        const checkActiveSessionInDB = async () => {
            try {
                let query = supabaseAuth
                    .from('classrooms')
                    .select('id, name, is_live, live_meeting_link, live_session_started_at')
                    .eq('is_live', true);

                if (userRole !== 'admin') {
                    query = query.eq('teacher_id', teacherProfile.id);
                }

                const { data: liveRooms, error } = await query
                    .order('live_session_started_at', { ascending: false })
                    .limit(1);

                if (error) throw error;

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
            } catch (err) {
                console.error('Error fetching active session from DB:', err);
            }
        };

        checkActiveSessionInDB();

        // Realtime subscription to classrooms table to detect start/end of sessions
        const classroomsChannel = supabaseAuth
            .channel('sidebar-active-classrooms')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'classrooms' },
                () => {
                    checkActiveSessionInDB();
                }
            )
            .subscribe();

        return () => {
            supabaseAuth.removeChannel(classroomsChannel);
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
                fixed md:sticky top-0 left-0 h-screen z-40 transition-transform duration-300 md:translate-x-0
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
                    <div className="size-10 rounded-full overflow-hidden border border-amber-500/10">
                        <img 
                            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" 
                            alt="Teacher profile" 
                            className="w-full h-full object-cover" 
                        />
                    </div>
                    <div className="overflow-hidden min-w-0">
                        <p className="text-sm font-black truncate text-slate-900 dark:text-white">{teacherProfile?.name || 'Krishna Gopal'}</p>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                            {userRole === 'admin' ? 'Administrator' : 'Instructor'}
                        </p>
                    </div>
                </div>
            </div>
        </aside>

        {/* Global floating ongoing active class screen widget */}
        {activeSession && !isMeetingPage && (
            <div className="fixed bottom-6 right-6 z-[150] w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-4 flex flex-col gap-3 animate-in slide-in-from-bottom-5 duration-300 text-left">
                {/* Glowing active indicator and class name */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
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
                    {/* Compact timer */}
                    <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-150 dark:border-slate-800">
                        <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                        <span>{(() => {
                            const mins = Math.floor(secondsElapsed / 60);
                            const secs = secondsElapsed % 60;
                            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                        })()}</span>
                    </div>
                </div>

                <div className="text-left space-y-1">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">{activeSession.classroomName}</h4>
                    <p className="text-[10px] text-slate-500 font-medium">Session in progress. Navigate away safely; your progress is preserved.</p>
                </div>

                {/* Direct action triggers */}
                <div className="flex gap-2 mt-1">
                    <button
                        onClick={async () => {
                            if (confirm('Are you sure you want to end this active class session?')) {
                                try {
                                    const startedAtTime = activeSession.startedAt;
                                    const endedAtTime = Date.now();
                                    const durationSecs = Math.max(1, Math.floor((endedAtTime - startedAtTime) / 1000));
                                    
                                    // 1. Fetch attendance counts to log correctly
                                    const { data: attData } = await supabaseAuth
                                        .from('attendance')
                                        .select('status')
                                        .eq('classroom_id', activeSession.classroomId)
                                        .eq('date', activeSession.sessionDate);
                                    
                                    const present = attData?.filter(a => a.status === 'present').length || 0;
                                    const absent = attData?.filter(a => a.status === 'absent').length || 0;
                                    const late = attData?.filter(a => a.status === 'late').length || 0;
                                    const excused = attData?.filter(a => a.status === 'excused').length || 0;
                                    
                                    // 2. Call RPC to end classroom session transactionally and log history
                                    await supabaseAuth.rpc('end_classroom_session', {
                                        p_classroom_id: activeSession.classroomId,
                                        p_session_date: activeSession.sessionDate,
                                        p_session_type: activeSession.sessionType,
                                        p_started_at: new Date(startedAtTime).toISOString(),
                                        p_ended_at: new Date(endedAtTime).toISOString(),
                                        p_duration_seconds: durationSecs,
                                        p_present_count: present,
                                        p_absent_count: absent,
                                        p_late_count: late,
                                        p_excused_count: excused
                                    });

                                    // 3. Clear classrooms live state
                                    await supabaseAuth
                                        .from('classrooms')
                                        .update({
                                            is_live: false,
                                            live_meeting_link: null,
                                            live_session_started_at: null
                                        })
                                        .eq('id', activeSession.classroomId);

                                    localStorage.removeItem('active_class_session');
                                    window.location.reload();
                                } catch (err) {
                                    console.error('Error ending class session from sidebar:', err);
                                    alert('Failed to end classroom session. Please try again.');
                                }
                            }
                        }}
                        className="flex-1 py-2 border border-rose-200 hover:bg-rose-50 dark:border-rose-900/30 dark:hover:bg-rose-950/20 text-rose-600 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95"
                    >
                        <span className="material-symbols-outlined text-sm">logout</span>
                        End Class
                    </button>
                    <Link
                        href={`/teacher-dashboard/classrooms/${activeSession.classroomId}/meeting`}
                        className="flex-1 py-2 bg-[#ecb613] hover:bg-amber-500 text-slate-950 rounded-xl text-[11px] font-black tracking-wide uppercase transition-all shadow-md shadow-amber-500/10 flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-95 text-center"
                    >
                        <span className="material-symbols-outlined text-sm">screen_share</span>
                        Resume
                    </Link>
                </div>
            </div>
        )}
    </>
);
}
