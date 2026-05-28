'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface TeacherSidebarProps {
    teacherProfile: { name: string; email: string } | null;
    handleLogout: () => void;
}

export default function TeacherSidebar({ teacherProfile, handleLogout }: TeacherSidebarProps) {
    const pathname = usePathname();

    const menuItems = [
        { name: 'Dashboard', icon: 'dashboard', href: '/teacher-dashboard' },
        { name: 'Students', icon: 'group', href: '/teacher-dashboard/students' },
        { name: 'Classrooms', icon: 'meeting_room', href: '/teacher-dashboard/classrooms' },
        { name: 'Tasks', icon: 'assignment', href: '/teacher-dashboard/tasks' },
        { name: 'Inventory Library', icon: 'inventory_2', href: '/teacher-dashboard/inventory' },
        { name: 'Attendance', icon: 'calendar_today', href: '/teacher-dashboard/attendance' },
        { name: 'Messages', icon: 'chat_bubble', href: '/teacher-dashboard/messages' },
        { name: 'Reports', icon: 'analytics', href: '/teacher-dashboard/reports' },
    ];

    return (
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
                            <span className="text-sm font-semibold">{item.name}</span>
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
    );
}
