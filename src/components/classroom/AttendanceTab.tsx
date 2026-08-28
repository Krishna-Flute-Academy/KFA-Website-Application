'use client';

import React from 'react';
import { 
    Calendar, ChevronLeft, ChevronRight, Users, 
    CheckCircle, X, TrendingUp, Loader2
} from 'lucide-react';

interface AttendanceTabProps {
    attendanceDate: string;
    setAttendanceDate: (date: string) => void;
    attendanceRecords: Record<string, 'present' | 'absent' | 'late' | 'excused'>;
    activeAttendanceRoster: any[];
    attendanceLoading: boolean;
    isSavingAttendanceMap: Record<string, boolean>;
    handleMarkClassroomAttendance: (studentId: string, status: string) => Promise<void>;
    handleUnmarkClassroomAttendance?: (studentId: string) => Promise<void>;
    formatLocalDate: (dateStr: string) => Date;
}

export default function AttendanceTab({
    attendanceDate,
    setAttendanceDate,
    attendanceRecords,
    activeAttendanceRoster,
    attendanceLoading,
    isSavingAttendanceMap,
    handleMarkClassroomAttendance,
    handleUnmarkClassroomAttendance,
    formatLocalDate
}: AttendanceTabProps) {
    const activeRecords = Object.values(attendanceRecords);
    const totalCount = activeAttendanceRoster.length;
    const presentCount = activeRecords.filter(r => r === 'present').length;
    const lateCount = activeRecords.filter(r => r === 'late').length;
    const absentCount = activeRecords.filter(r => r === 'absent').length;
    const excusedCount = activeRecords.filter(r => r === 'excused').length;
    const activeTotalCount = totalCount - excusedCount;
    const presentRate = activeTotalCount > 0 ? Math.round(((presentCount + lateCount) / activeTotalCount) * 100) : 0;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
            {/* Attendance Header Controls */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                        <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Class Attendance</h3>
                        <p className="text-sm text-slate-505 dark:text-slate-400">Mark or update student attendance for your class. Double-click marked status to unmark.</p>
                    </div>
                </div>
                
                {/* Date Navigation */}
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-100 dark:border-slate-700">
                    <button 
                        onClick={() => {
                            const prev = new Date(attendanceDate);
                            prev.setDate(prev.getDate() - 1);
                            setAttendanceDate(prev.toISOString().split('T')[0]);
                        }}
                        className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-505 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm cursor-pointer"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <input 
                        type="date" 
                        value={attendanceDate}
                        onChange={(e) => setAttendanceDate(e.target.value)}
                        className="bg-transparent border-none text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none px-2 text-center font-semibold"
                    />
                    <button 
                        onClick={() => {
                            const next = new Date(attendanceDate);
                            next.setDate(next.getDate() + 1);
                            setAttendanceDate(next.toISOString().split('T')[0]);
                        }}
                        className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-505 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm cursor-pointer"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => setAttendanceDate(new Date().toISOString().split('T')[0])}
                        className="px-3 py-1.5 bg-white dark:bg-slate-700 text-xs font-bold text-slate-655 dark:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-all border border-slate-200 dark:border-slate-600 shadow-sm cursor-pointer"
                    >
                        Today
                    </button>
                </div>
            </div>

            {/* Summary Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Enrolled Students</p>
                        <h4 className="text-2xl font-black text-slate-950 dark:text-white mt-1">{totalCount}</h4>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-955/20 text-blue-600 dark:text-blue-400 rounded-xl">
                        <Users className="w-5 h-5" />
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Present / Late</p>
                        <h4 className="text-2xl font-black text-slate-955 dark:text-white mt-1">
                            <span className="text-emerald-605">{presentCount}</span>
                            <span className="text-slate-400 mx-1">/</span>
                            <span className="text-amber-500">{lateCount}</span>
                        </h4>
                    </div>
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 rounded-xl">
                        <CheckCircle className="w-5 h-5" />
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Absent / Excused</p>
                        <h4 className="text-2xl font-black text-slate-955 dark:text-white mt-1">
                            <span className="text-rose-605">{absentCount}</span>
                            <span className="text-slate-400 mx-1">/</span>
                            <span className="text-slate-500">{excusedCount}</span>
                        </h4>
                    </div>
                    <div className="p-3 bg-rose-50 dark:bg-rose-955/20 text-rose-600 dark:text-rose-450 rounded-xl">
                        <X className="w-5 h-5" />
                    </div>
                </div>
                <div className="bg-[#ecb613] p-5 rounded-2xl shadow-lg shadow-[#ecb613]/10 flex items-center justify-between text-slate-900">
                    <div>
                        <p className="text-xs font-bold opacity-80 uppercase tracking-widest">Presence Rate</p>
                        <h4 className="text-3xl font-black mt-1">{presentRate}%</h4>
                    </div>
                    <div className="p-3 bg-white/20 rounded-xl">
                        <TrendingUp className="w-5 h-5 text-slate-950" />
                    </div>
                </div>
            </div>

            {/* Attendance Table Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                {attendanceLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-[#ecb613] mb-2" />
                        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Syncing attendance logs...</p>
                    </div>
                ) : activeAttendanceRoster.length > 0 ? (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {activeAttendanceRoster.map((student) => {
                            const status = attendanceRecords[student.student_id];
                            const isSaving = isSavingAttendanceMap[student.student_id];
                            return (
                                <div 
                                    key={student.id} 
                                    onDoubleClick={() => {
                                        if (status && handleUnmarkClassroomAttendance) {
                                            handleUnmarkClassroomAttendance(student.student_id);
                                        }
                                    }}
                                    title={status ? "Double-click marked section to unmark attendance" : undefined}
                                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all group select-none"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-slate-50 dark:border-slate-700 shadow-inner group-hover:scale-105 transition-transform relative shrink-0">
                                            {student.profile_pic_url ? (
                                                <img src={student.profile_pic_url} alt={student.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-[#ecb613] text-lg font-black">{student.name.charAt(0)}</span>
                                            )}
                                        </div>
                                        <div className="text-left">
                                            <h4 className="font-extrabold text-slate-900 dark:text-white tracking-tight">{student.name}</h4>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                                                {student.is_makeup 
                                                    ? 'Makeup Student' 
                                                    : (student.joined_at ? `Joined ${formatLocalDate(student.joined_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Enrolled Student')
                                                }
                                            </p>
                                        </div>
                                    </div>

                                    {/* Custom Button Selectors */}
                                    <div className="flex items-center gap-2 flex-wrap relative">
                                        {isSaving && (
                                            <div className="absolute -left-8 top-1/2 -translate-y-1/2">
                                                <Loader2 className="w-4 h-4 animate-spin text-[#ecb613]" />
                                            </div>
                                        )}
                                        
                                        {([
                                            { key: 'present', label: 'Present', color: 'emerald', border: 'border-emerald-200 dark:border-emerald-800', activeBg: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' },
                                            { key: 'absent', label: 'Absent', color: 'rose', border: 'border-rose-200 dark:border-rose-800', activeBg: 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' },
                                            { key: 'late', label: 'Late', color: 'amber', border: 'border-amber-200 dark:border-amber-800', activeBg: 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' },
                                            { key: 'excused', label: 'Excused', color: 'slate', border: 'border-slate-200 dark:border-slate-700', activeBg: 'bg-slate-600 text-white shadow-lg shadow-slate-600/20' }
                                        ] as const).map(opt => {
                                            const isActive = status === opt.key;
                                            return (
                                                <button
                                                    key={opt.key}
                                                    disabled={isSaving}
                                                    title={isActive ? "Double-click or click to unmark attendance" : `Mark as ${opt.label}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleMarkClassroomAttendance(student.student_id, opt.key);
                                                    }}
                                                    onDoubleClick={(e) => {
                                                        e.stopPropagation();
                                                        if (handleUnmarkClassroomAttendance) {
                                                            handleUnmarkClassroomAttendance(student.student_id);
                                                        } else {
                                                            handleMarkClassroomAttendance(student.student_id, opt.key);
                                                        }
                                                    }}
                                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                                                        isActive 
                                                            ? opt.activeBg
                                                            : `border ${opt.border} bg-white dark:bg-slate-900 text-slate-505 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800`
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="py-20 text-center">
                        <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Enrolled Students</h3>
                        <p className="text-sm text-slate-505 dark:text-slate-400 mt-1 max-w-sm mx-auto">Please enroll students in the Students tab first to mark their attendance.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
