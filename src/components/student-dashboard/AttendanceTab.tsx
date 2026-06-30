'use client';

import React from 'react';
import { Calendar, X, Loader2 } from 'lucide-react';

interface AttendanceTabProps {
    attendanceStats: {
        present: number;
        late: number;
        absent: number;
        excused: number;
        total: number;
    };
    mergedLogs: any[];
    showExcuseModal: boolean;
    setShowExcuseModal: (show: boolean) => void;
    excuseDate: string;
    setExcuseDate: (date: string) => void;
    excuseReason: string;
    setExcuseReason: (reason: string) => void;
    isSubmittingExcuse: boolean;
    handleSubmitExcuse: (e: React.FormEvent) => Promise<void>;
}

/**
 * AttendanceTab displays logs of student attendance records and provides absence excuse forms.
 */
export default function AttendanceTab({
    attendanceStats,
    mergedLogs,
    showExcuseModal,
    setShowExcuseModal,
    excuseDate,
    setExcuseDate,
    excuseReason,
    setExcuseReason,
    isSubmittingExcuse,
    handleSubmitExcuse
}: AttendanceTabProps) {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Attendance statistics */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-2 border-b border-slate-100">
                    <div>
                        <h3 className="font-extrabold text-slate-800 text-base mb-1">Attendance Tracker</h3>
                        <p className="text-xs text-slate-500">Total attendance stats and class record history</p>
                    </div>
                    <button 
                        type="button"
                        onClick={() => setShowExcuseModal(true)}
                        className="px-5 py-2.5 bg-[#7C5E3F] hover:bg-[#634a31] text-white text-xs font-bold rounded-full flex items-center justify-center gap-2 shadow-xs transition-all hover:scale-102 active:scale-98"
                    >
                        <span className="material-symbols-outlined text-sm">event_busy</span>
                        Inform Absence / Request Excuse
                    </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-2xl p-4 text-center shrink-0">
                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block">Present</span>
                        <h4 className="font-extrabold text-xl text-slate-800 mt-1">{attendanceStats.present} Classes</h4>
                    </div>
                    <div className="bg-amber-50/50 border border-amber-100/50 rounded-2xl p-4 text-center shrink-0">
                        <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest block">Late</span>
                        <h4 className="font-extrabold text-xl text-slate-800 mt-1">{attendanceStats.late} Classes</h4>
                    </div>
                    <div className="bg-rose-50/50 border border-rose-100/50 rounded-2xl p-4 text-center shrink-0">
                        <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest block">Absent</span>
                        <h4 className="font-extrabold text-xl text-slate-800 mt-1">{attendanceStats.absent} Classes</h4>
                    </div>
                    <div className="bg-blue-50/50 border border-blue-100/50 rounded-2xl p-4 text-center shrink-0">
                        <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest block">Excused</span>
                        <h4 className="font-extrabold text-xl text-slate-800 mt-1">{attendanceStats.excused} Classes</h4>
                    </div>
                </div>

                {mergedLogs.length === 0 ? (
                    <div className="py-12 border border-dashed border-slate-100 rounded-2xl text-center bg-slate-50/50">
                        <Calendar className="w-10 h-10 text-slate-350 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-700">No classroom logs found.</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Your teacher has not logged any classroom sessions yet.</p>
                    </div>
                ) : (
                    <div className="border border-slate-150 rounded-2xl overflow-hidden">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-left border-b border-slate-150">
                                    <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date & Start Time</th>
                                    <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Class Type</th>
                                    <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Duration</th>
                                    <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">My Attendance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {mergedLogs.map((row) => {
                                    const badgeClass =
                                        row.status === 'present' ? 'bg-emerald-50 text-emerald-700 border-emerald-205' :
                                        row.status === 'late' ? 'bg-amber-50 text-amber-700 border-amber-205' :
                                        row.status === 'absent' ? 'bg-rose-50 text-rose-700 border-rose-205' :
                                        row.status === 'excused' ? 'bg-blue-50 text-blue-700 border-blue-205' :
                                        'bg-slate-50 text-slate-500 border-slate-205';

                                    const formattedDate = row.started_at
                                        ? new Date(row.started_at).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                                        : new Date(row.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                                    
                                    const formattedTime = row.started_at
                                        ? new Date(row.started_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                                        : null;

                                    let durationStr = '—';
                                    if (row.duration_seconds !== null) {
                                        const durationMins = Math.floor(row.duration_seconds / 60);
                                        const durationHrs = Math.floor(durationMins / 60);
                                        const remMins = durationMins % 60;
                                        durationStr = durationHrs > 0 
                                            ? `${durationHrs}h ${remMins}m`
                                            : `${durationMins} min${durationMins !== 1 ? 's' : ''}`;
                                    }

                                    return (
                                        <tr key={row.id} className="hover:bg-slate-50/30">
                                            <td className="px-5 py-3.5 text-xs font-bold text-slate-800">
                                                <div>{formattedDate}</div>
                                                {formattedTime && (
                                                    <div className="text-[10px] text-slate-400 font-semibold mt-0.5">at {formattedTime}</div>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 text-xs">
                                                {row.session_type === 'online' ? (
                                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-full font-black text-[9px] uppercase tracking-wider">
                                                        Online Video Class
                                                    </span>
                                                ) : row.session_type === 'offline' ? (
                                                    <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-full font-black text-[9px] uppercase tracking-wider">
                                                        In-Person Class
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-slate-50 text-slate-500 border border-slate-200 rounded-full font-black text-[9px] uppercase tracking-wider">
                                                        Manual Entry
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 text-xs font-bold text-slate-600">
                                                {durationStr}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider ${badgeClass}`}>
                                                    {row.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Request Excuse Modal */}
            {showExcuseModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 text-left">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850/40">
                            <div>
                                <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest block">Class Leave Request</span>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">Inform Absence / Request Excuse</h3>
                            </div>
                            <button 
                                onClick={() => {
                                    setShowExcuseModal(false);
                                    setExcuseDate('');
                                    setExcuseReason('');
                                }} 
                                className="p-1 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                        
                        {/* Form */}
                        <form onSubmit={handleSubmitExcuse} className="p-6 space-y-4">
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Informing your teacher and academy admin in advance helps us reschedule classes. Submitting this request logs an <strong>Excused Absence</strong> and makes you eligible for a makeup/alternative slot.
                            </p>

                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-[#7C5E3F] uppercase tracking-wider pl-1">Absence Date *</label>
                                <input 
                                    type="date"
                                    required
                                    value={excuseDate}
                                    onChange={(e) => setExcuseDate(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#7C5E3F]/20 outline-none transition-all"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-[#7C5E3F] uppercase tracking-wider pl-1">Reason / Notes</label>
                                <textarea
                                    value={excuseReason}
                                    onChange={(e) => setExcuseReason(e.target.value)}
                                    rows={3}
                                    placeholder="Explain your plan or reason (e.g. exams, travel, unwell)..."
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#7C5E3F]/20 outline-none transition-all resize-none"
                                />
                            </div>

                            {/* Footer / Actions */}
                            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setShowExcuseModal(false);
                                        setExcuseDate('');
                                        setExcuseReason('');
                                    }}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-655 dark:text-slate-300 text-xs font-bold rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSubmittingExcuse}
                                    className="px-5 py-2 bg-[#7C5E3F] hover:bg-[#6A4E31] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-md disabled:bg-stone-300 disabled:text-slate-500 disabled:cursor-not-allowed"
                                >
                                    {isSubmittingExcuse ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                    Submit Request
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
