'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabaseAuth } from '../lib/supabase-auth';

interface TeacherSidebarProps {
    teacherProfile: { name: string; email: string } | null;
    handleLogout: () => void;
}

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

    useEffect(() => {
        const fetchUnassignedCount = async () => {
            try {
                const { count } = await supabaseAuth
                    .from('users')
                    .select('*', { count: 'exact', head: true })
                    .eq('role', 'student')
                    .is('teacher_id', null);
                
                if (count !== null) {
                    setUnassignedCount(count);
                }
            } catch (error) {
                console.error('Error fetching unassigned count:', error);
            }
        };

        fetchUnassignedCount();
        
        // Polling every 30 seconds for new signups
        const pollingInterval = setInterval(fetchUnassignedCount, 30000);
        return () => clearInterval(pollingInterval);
    }, []);

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

    const menuItems = [
        { name: 'Dashboard', icon: 'dashboard', href: '/teacher-dashboard' },
        { name: 'Students', icon: 'group', href: '/teacher-dashboard/students' },
        { name: 'Classrooms', icon: 'meeting_room', href: '/teacher-dashboard/classrooms' },
        { name: 'Tasks', icon: 'assignment', href: '/teacher-dashboard/tasks' },
        { name: 'Inventory Library', icon: 'inventory_2', href: '/teacher-dashboard/inventory' },
        { name: 'Attendance', icon: 'calendar_today', href: '/teacher-dashboard/attendance' },
        { name: 'Fees', icon: 'payments', href: '/teacher-dashboard/fees' },
        { name: 'Messages', icon: 'chat_bubble', href: '/teacher-dashboard/messages' },
        { name: 'Reports', icon: 'analytics', href: '/teacher-dashboard/reports' },
    ];

    return (
        <>
            <aside className="w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col sticky top-0 h-screen shrink-0">
            <div className="p-6 flex flex-col justify-center">
                <h1 className="font-black text-xl leading-tight text-slate-950 dark:text-white select-none">
                    Music Admin
                </h1>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 uppercase tracking-wider select-none">
                    Teacher Portal
                </p>
            </div>

            <nav className="flex-1 px-3 space-y-1.5 mt-6 overflow-y-auto">
                {menuItems.map((item) => {
                    const isActive = item.href === '/teacher-dashboard' 
                        ? pathname === item.href 
                        : pathname?.startsWith(item.href);
                    return (
                        <Link
                            key={item.name}
                            className={`flex items-center gap-3 py-3 transition-all relative ${isActive
                                    ? 'bg-gradient-to-r from-amber-500/10 to-amber-500/0 text-[#b45309] dark:text-[#ecb613] font-black border-l-4 border-[#d97706] pl-3.5 pr-4 rounded-r-2xl'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 px-4 rounded-xl'
                                }`}
                            href={item.href}
                        >
                            <span className="material-symbols-outlined text-[22px] select-none">{item.icon}</span>
                            <span className="text-sm font-semibold flex-1">{item.name}</span>
                            {item.name === 'Students' && unassignedCount > 0 && (
                                <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-in zoom-in">
                                    {unassignedCount} New
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

                <Link className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors" href="#">
                    <span className="material-symbols-outlined">settings</span>
                    <span className="text-sm font-semibold">Settings</span>
                </Link>
                <button
                    onClick={handleLogout}
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
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Senior Instructor</p>
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
