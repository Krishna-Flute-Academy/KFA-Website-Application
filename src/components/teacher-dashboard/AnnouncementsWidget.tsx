'use client';

import React from 'react';

interface AnnouncementsWidgetProps {
    onAddAnnouncement?: () => void;
}

/**
 * AnnouncementsWidget renders a notice board for teachers to view or create notifications.
 */
export default function AnnouncementsWidget({
    onAddAnnouncement
}: AnnouncementsWidgetProps) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden text-left">
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-50/50 to-orange-50/10 dark:from-amber-950/10 dark:to-orange-950/5">
                <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">Recent Announcements</h3>
                <button 
                    onClick={onAddAnnouncement}
                    className="size-7 sm:size-8 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-[#ecb613] hover:text-white transition-all"
                >
                    <span className="material-symbols-outlined text-base sm:text-xl">add</span>
                </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
                <div className="flex gap-4 p-4 rounded-xl bg-[#ecb613]/5 border border-[#ecb613]/10">
                    <span className="material-symbols-outlined text-[#ecb613] text-2xl">campaign</span>
                    <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Upcoming Annual Concert</h4>
                        <p className="text-xs text-slate-500 mt-0.5">Posted 2 hours ago • All Students</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Registration for the 'Venu Nad' concert is now open. Teachers please prepare your intermediate batches.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
