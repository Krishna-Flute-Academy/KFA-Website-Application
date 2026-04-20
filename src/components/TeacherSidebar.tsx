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
            <div className="p-6 flex items-center gap-3">
                <div className="size-10 bg-[#ecb613] rounded-lg flex items-center justify-center text-slate-900 shadow-lg shadow-[#ecb613]/20">
                    <span className="material-symbols-outlined text-2xl">music_note</span>
                </div>
                <div>
                    <h1 className="font-bold text-lg leading-tight text-slate-900 dark:text-white">Krishna Flute</h1>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Teacher Portal</p>
                </div>
            </div>

            <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto">
                {menuItems.map((item) => {
                    const isActive = item.href === '/teacher-dashboard' 
                        ? pathname === item.href 
                        : pathname?.startsWith(item.href);
                    return (
                        <Link
                            key={item.name}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive
                                    ? 'bg-[#ecb613]/10 text-[#ecb613] font-semibold'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                            href={item.href}
                        >
                            <span className="material-symbols-outlined">{item.icon}</span>
                            <span className="text-sm">{item.name}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <Link className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" href="#">
                    <span className="material-symbols-outlined">settings</span>
                    <span className="text-sm font-medium">Settings</span>
                </Link>
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                >
                    <span className="material-symbols-outlined">logout</span>
                    <span className="text-sm font-medium">Logout</span>
                </button>

                <div className="mt-4 flex items-center gap-3 px-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <div className="size-9 rounded-full bg-[#ecb613]/20 flex items-center justify-center text-[#ecb613] font-bold">
                        {teacherProfile?.name?.charAt(0) || 'T'}
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-sm font-semibold truncate">{teacherProfile?.name || 'Teacher'}</p>
                        <p className="text-xs text-slate-500 truncate">Senior Instructor</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
