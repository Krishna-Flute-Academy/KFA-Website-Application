'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabaseAuth } from '../lib/supabase-auth';

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

    useEffect(() => {
        const checkSession = () => {
            const sessionStr = localStorage.getItem('active_class_session');
            if (sessionStr) {
                try {
                    const session = JSON.parse(sessionStr);
                    setActiveSession(session);
                    const elapsed = Math.floor((Date.now() - session.startedAt) / 1000);
                    setSecondsElapsed(elapsed > 0 ? elapsed : 0);
                } catch (e) {
                    console.error(e);
                    setActiveSession(null);
                }
            } else {
                setActiveSession(null);
            }
        };

        checkSession();
        const interval = setInterval(checkSession, 1000);
        return () => clearInterval(interval);
    }, []);

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
        { name: 'Students', icon: 'group', href: `${basePath}/students` },
        { name: 'Classrooms', icon: 'meeting_room', href: `${basePath}/classrooms` },
        { name: 'Tasks', icon: 'assignment', href: `${basePath}/tasks` },
        { name: 'Inventory Library', icon: 'inventory_2', href: `${basePath}/inventory` },
        { name: 'Attendance', icon: 'calendar_today', href: `${basePath}/attendance` },
        ...(userRole === 'admin' ? [{ name: 'Fees', icon: 'payments', href: `${basePath}/fees` }] : []),
        { name: 'Messages', icon: 'chat_bubble', href: `${basePath}/messages` },
        ...(userRole === 'admin' ? [{ name: 'Role Allocation', icon: 'manage_accounts', href: `${basePath}/role-allocation` }] : []),
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
            <div className="p-6 flex flex-col justify-center">
                <h1 className="font-black text-xl leading-tight text-slate-950 dark:text-white select-none">
                    {userRole === 'admin' ? 'Music Admin' : 'Teacher Portal'}
                </h1>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 uppercase tracking-wider select-none">
                    {userRole === 'admin' ? 'Admin Portal' : 'Instructor View'}
                </p>
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
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden border border-transparent dark:border-slate-800">
                        <div className="bg-[#d97706] h-2 rounded-full" style={{ width: '65%' }}></div>
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-none">
                        6.5 GB of 10 GB used
                    </div>
                </div>

                <Link 
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors" 
                    href="#"
                    onClick={() => setIsOpen(false)}
                >
                    <span className="material-symbols-outlined">settings</span>
                    <span className="text-sm font-semibold">Settings</span>
                </Link>
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
                        onClick={() => {
                            if (confirm('Are you sure you want to end this active class session?')) {
                                localStorage.removeItem('active_class_session');
                                window.location.reload();
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
