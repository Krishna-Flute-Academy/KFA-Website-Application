'use client';

import React from 'react';
import { Loader2, Clock } from 'lucide-react';

interface ClassLogsTabProps {
    sessionLogs: any[];
    sessionLogsLoading: boolean;
    fetchSessionLogs: () => void;
}

export default function ClassLogsTab({
    sessionLogs,
    sessionLogsLoading,
    fetchSessionLogs
}: ClassLogsTabProps) {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
                <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Classroom Session Logs</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">History of class sessions started, durations, and student attendance statistics.</p>
                    </div>
                    <button 
                        onClick={fetchSessionLogs}
                        disabled={sessionLogsLoading}
                        className="px-4 py-2 border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 transition-all flex items-center gap-2 cursor-pointer"
                    >
                        {sessionLogsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
                        Refresh Logs
                    </button>
                </div>

                {sessionLogsLoading && sessionLogs.length === 0 ? (
                    <div className="flex justify-center items-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-[#ecb613]" />
                    </div>
                ) : sessionLogs.length === 0 ? (
                    <div className="py-20 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                        <Clock className="w-12 h-12 text-slate-305 dark:text-slate-600 mx-auto mb-4" />
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">No Session Logs Found</h3>
                        <p className="text-xs text-slate-505 dark:text-slate-400 mt-1 max-w-sm mx-auto">Sessions will show up here after you start and end a class from the Classroom Meeting Hub.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-xl">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50 text-left border-b border-slate-105 dark:border-slate-800">
                                    <th className="px-5 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Date & Start Time</th>
                                    <th className="px-5 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Type</th>
                                    <th className="px-5 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Duration</th>
                                    <th className="px-5 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Attendance Breakdown</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {sessionLogs.map((log) => {
                                    const formattedDate = new Date(log.started_at).toLocaleDateString(undefined, {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    });
                                    const formattedTime = new Date(log.started_at).toLocaleTimeString(undefined, {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    });

                                    const durationMins = Math.floor(log.duration_seconds / 60);
                                    const durationHrs = Math.floor(durationMins / 60);
                                    const remMins = durationMins % 60;
                                    const durationStr = durationHrs > 0 
                                        ? `${durationHrs}h ${remMins}m`
                                        : `${durationMins} min${durationMins !== 1 ? 's' : ''}`;

                                    return (
                                        <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                                            <td className="px-5 py-4 text-xs font-bold text-slate-800 dark:text-slate-200">
                                                <div>{formattedDate}</div>
                                                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">at {formattedTime}</div>
                                            </td>
                                            <td className="px-5 py-4 text-xs">
                                                {log.session_type === 'online' ? (
                                                    <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 rounded-full font-black text-[9px] uppercase tracking-wider">
                                                        Online
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 rounded-full font-black text-[9px] uppercase tracking-wider">
                                                        In-Person
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-xs font-bold text-slate-650 dark:text-slate-300">
                                                {durationStr}
                                            </td>
                                            <td className="px-5 py-4 text-xs">
                                                <div className="flex gap-2 flex-wrap">
                                                    <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/20 rounded-lg font-bold text-[10px]">
                                                        Present: {log.present_count ?? 0}
                                                    </span>
                                                    <span className="px-2 py-0.5 bg-rose-50 dark:bg-rose-955/30 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-900/20 rounded-lg font-bold text-[10px]">
                                                        Absent: {log.absent_count ?? 0}
                                                    </span>
                                                    <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-955/30 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/20 rounded-lg font-bold text-[10px]">
                                                        Late: {log.late_count ?? 0}
                                                    </span>
                                                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-605 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-[10px]">
                                                        Excused: {log.excused_count ?? 0}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
