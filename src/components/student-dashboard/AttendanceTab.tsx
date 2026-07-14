'use client';

import React, { useState, useMemo } from 'react';
import { 
    Calendar, 
    X, 
    Loader2, 
    ChevronLeft, 
    ChevronRight, 
    CalendarDays, 
    Filter, 
    RotateCcw 
} from 'lucide-react';

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
    // 1. Date Range Filter State
    const [fromDate, setFromDate] = useState<string>('');
    const [toDate, setToDate] = useState<string>('');
    
    // 2. Calendar View State
    const [calendarDate, setCalendarDate] = useState<Date>(new Date());

    // 3. Filter Logs based on selected Date Range
    const filteredLogs = useMemo(() => {
        return mergedLogs.filter(log => {
            if (fromDate && log.date < fromDate) return false;
            if (toDate && log.date > toDate) return false;
            return true;
        });
    }, [mergedLogs, fromDate, toDate]);

    // 4. Recalculate Stats for Filtered logs
    const filteredStats = useMemo(() => {
        const stats = { total: 0, present: 0, late: 0, absent: 0, excused: 0 };
        filteredLogs.forEach(log => {
            if (log.status !== 'unmarked') {
                stats.total++;
                if (log.status === 'present') stats.present++;
                else if (log.status === 'late') stats.late++;
                else if (log.status === 'absent') stats.absent++;
                else if (log.status === 'excused') stats.excused++;
            }
        });
        return stats;
    }, [filteredLogs]);

    // 5. Calendar Helper Logic
    const calendarDays = useMemo(() => {
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();

        // Day of week of 1st day of month (0 = Sunday, 6 = Saturday)
        const firstDayIndex = new Date(year, month, 1).getDay();

        // Days in current month
        const totalDays = new Date(year, month + 1, 0).getDate();

        // Days in previous month
        const prevTotalDays = new Date(year, month, 0).getDate();

        const days = [];

        // Prev month padding
        for (let i = firstDayIndex - 1; i >= 0; i--) {
            const dayNum = prevTotalDays - i;
            const prevMonth = month === 0 ? 11 : month - 1;
            const prevYear = month === 0 ? year - 1 : year;
            const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            days.push({
                day: dayNum,
                dateStr,
                isCurrentMonth: false,
            });
        }

        // Current month days
        for (let i = 1; i <= totalDays; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            days.push({
                day: i,
                dateStr,
                isCurrentMonth: true,
            });
        }

        // Next month padding
        const totalCells = days.length;
        const nextPadding = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        for (let i = 1; i <= nextPadding; i++) {
            const nextMonth = month === 11 ? 0 : month + 1;
            const nextYear = month === 11 ? year + 1 : year;
            const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            days.push({
                day: i,
                dateStr,
                isCurrentMonth: false,
            });
        }

        return days;
    }, [calendarDate]);

    // Handle calendar day selection/filtering
    const handleDayClick = (dateStr: string) => {
        if (fromDate === dateStr && toDate === dateStr) {
            // Already filtered to this day, so clear filter
            setFromDate('');
            setToDate('');
        } else {
            // Filter to this specific day
            setFromDate(dateStr);
            setToDate(dateStr);
        }
    };

    const isFilterActive = fromDate !== '' || toDate !== '';

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header section with title and excuse absence button */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
                    <div>
                        <h3 className="font-extrabold text-slate-800 dark:text-white text-base mb-1">Attendance Tracker</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Total attendance stats, calendar overview and class record history</p>
                    </div>
                    <button 
                        type="button"
                        onClick={() => setShowExcuseModal(true)}
                        className="px-5 py-2.5 bg-[#7C5E3F] hover:bg-[#634a31] text-white text-xs font-bold rounded-full flex items-center justify-center gap-2 shadow-xs transition-all hover:scale-102 active:scale-98 cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-sm">event_busy</span>
                        Inform Absence / Request Excuse
                    </button>
                </div>
            </div>

            {/* Core Body Section - Left Panel (Stats & Filters), Right Panel (Visual Calendar) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Columns - Stats cards and Date Inputs */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* Stats cards */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs text-left">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-extrabold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                                {isFilterActive ? 'Filtered Stats' : 'Overall Stats'}
                            </h4>
                            {isFilterActive && (
                                <span className="px-2 py-0.5 bg-[#7C5E3F]/10 text-[#7C5E3F] font-bold text-[10px] rounded-full">
                                    Filter Active
                                </span>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/30 rounded-2xl p-4 text-center">
                                <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block font-sans">Present</span>
                                <h4 className="font-extrabold text-xl text-slate-800 dark:text-white mt-1">
                                    {isFilterActive ? filteredStats.present : attendanceStats.present}
                                </h4>
                                <span className="text-[9px] text-slate-400 block mt-0.5">Classes</span>
                            </div>
                            <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100/50 dark:border-amber-900/30 rounded-2xl p-4 text-center">
                                <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest block font-sans">Late</span>
                                <h4 className="font-extrabold text-xl text-slate-800 dark:text-white mt-1">
                                    {isFilterActive ? filteredStats.late : attendanceStats.late}
                                </h4>
                                <span className="text-[9px] text-slate-400 block mt-0.5">Classes</span>
                            </div>
                            <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100/50 dark:border-rose-900/30 rounded-2xl p-4 text-center">
                                <span className="text-[9px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest block font-sans">Absent</span>
                                <h4 className="font-extrabold text-xl text-slate-800 dark:text-white mt-1">
                                    {isFilterActive ? filteredStats.absent : attendanceStats.absent}
                                </h4>
                                <span className="text-[9px] text-slate-400 block mt-0.5">Classes</span>
                            </div>
                            <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/30 rounded-2xl p-4 text-center">
                                <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest block font-sans">Excused</span>
                                <h4 className="font-extrabold text-xl text-slate-800 dark:text-white mt-1">
                                    {isFilterActive ? filteredStats.excused : attendanceStats.excused}
                                </h4>
                                <span className="text-[9px] text-slate-400 block mt-0.5">Classes</span>
                            </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span>
                                {isFilterActive 
                                    ? `Showing ${filteredStats.total} marked sessions in range` 
                                    : `Total: ${attendanceStats.total} marked sessions`}
                            </span>
                            {isFilterActive && (
                                <button 
                                    onClick={() => { setFromDate(''); setToDate(''); }}
                                    className="text-xs font-bold text-[#7C5E3F] hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                    <RotateCcw className="w-3 h-3" /> Reset Filter
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Date Filters Form */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs text-left">
                        <div className="flex items-center gap-2 mb-4">
                            <Filter className="w-4 h-4 text-[#7C5E3F]" />
                            <h4 className="font-extrabold text-slate-800 dark:text-white text-xs uppercase tracking-wider">
                                Filter Sessions by Date
                            </h4>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="block text-[9px] font-black text-[#7C5E3F] uppercase tracking-wider pl-1">From Date</label>
                                <input 
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#7C5E3F]/20 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-[9px] font-black text-[#7C5E3F] uppercase tracking-wider pl-1">To Date</label>
                                <input 
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#7C5E3F]/20 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {isFilterActive && (
                            <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-850 px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-800">
                                <span className="font-medium">
                                    Showing logs from{' '}
                                    <strong className="text-slate-700 dark:text-white">
                                        {fromDate ? new Date(fromDate).toLocaleDateString() : 'start'}
                                    </strong>{' '}
                                    to{' '}
                                    <strong className="text-slate-700 dark:text-white">
                                        {toDate ? new Date(toDate).toLocaleDateString() : 'end'}
                                    </strong>
                                </span>
                                <button 
                                    type="button"
                                    onClick={() => { setFromDate(''); setToDate(''); }}
                                    className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-[10px] flex items-center gap-1 hover:bg-slate-55 dark:hover:bg-slate-750 transition-all cursor-pointer"
                                >
                                    <RotateCcw className="w-2.5 h-2.5" />
                                    Clear Range
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column - Visual Monthly Calendar */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs text-left flex flex-col justify-between h-full">
                    <div>
                        {/* Calendar Header */}
                        <div className="flex items-center justify-between mb-5 border-b border-slate-100 dark:border-slate-800 pb-2">
                            <h4 className="font-extrabold text-slate-800 dark:text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <CalendarDays className="w-4 h-4 text-[#7C5E3F]" />
                                Attendance Calendar
                            </h4>
                            
                            <div className="flex items-center gap-1">
                                <button 
                                    type="button"
                                    onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase min-w-[70px] text-center font-sans tracking-wider">
                                    {calendarDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                                </span>
                                <button 
                                    type="button"
                                    onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Calendar Weekday Names */}
                        <div className="grid grid-cols-7 gap-1 text-center mb-2">
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                                <span key={idx} className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{day}</span>
                            ))}
                        </div>

                        {/* Calendar Grid Cells */}
                        <div className="grid grid-cols-7 gap-1">
                            {calendarDays.map((cell, idx) => {
                                // Find if there's any log matching this specific cell's date
                                const logForDay = mergedLogs.find(l => l.date === cell.dateStr);
                                const status = logForDay?.status;

                                let cellClass = "text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800";
                                let isMarked = false;

                                if (!cell.isCurrentMonth) {
                                    cellClass = "text-slate-300 dark:text-slate-700 pointer-events-none opacity-40";
                                } else if (status && status !== 'unmarked') {
                                    isMarked = true;
                                    if (status === 'present') {
                                        cellClass = "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-450 font-extrabold border border-emerald-200 dark:border-emerald-900/50";
                                    } else if (status === 'late') {
                                        cellClass = "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-450 font-extrabold border border-amber-200 dark:border-amber-900/50";
                                    } else if (status === 'absent') {
                                        cellClass = "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-450 font-extrabold border border-rose-200 dark:border-rose-900/50";
                                    } else if (status === 'excused') {
                                        cellClass = "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-450 font-extrabold border border-blue-200 dark:border-blue-900/50";
                                    }
                                }

                                const isSelected = fromDate === cell.dateStr && toDate === cell.dateStr;
                                if (isSelected) {
                                    cellClass += " ring-2 ring-[#7C5E3F] dark:ring-amber-500 ring-offset-1 dark:ring-offset-slate-900 z-10 scale-105";
                                }

                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        disabled={!cell.isCurrentMonth}
                                        onClick={() => handleDayClick(cell.dateStr)}
                                        title={logForDay ? `${new Date(cell.dateStr).toLocaleDateString()}: ${status.toUpperCase()} (${logForDay.classroom_name})` : undefined}
                                        className={`aspect-square flex flex-col items-center justify-center text-[11px] font-bold rounded-xl transition-all cursor-pointer relative ${cellClass}`}
                                    >
                                        {cell.day}
                                        {/* Underline or dot indicator for classes */}
                                        {cell.isCurrentMonth && logForDay && !isMarked && (
                                            <span className="absolute bottom-1 w-1 h-1 rounded-full bg-slate-350 dark:bg-slate-600"></span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Calendar Legend */}
                    <div className="mt-6 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-250 dark:border-emerald-900/50 block"></span>
                            <span>Present</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-250 dark:border-amber-900/50 block"></span>
                            <span>Late</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-250 dark:border-rose-900/50 block"></span>
                            <span>Absent</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-250 dark:border-blue-900/50 block"></span>
                            <span>Excused</span>
                        </div>
                    </div>
                </div>

            </div>

            {/* List logs section */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs text-left">
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <div>
                        <h4 className="font-extrabold text-slate-800 dark:text-white text-xs uppercase tracking-wider">
                            Attendance Logs History
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">List of marked classes and manuals matching filters</p>
                    </div>
                    {isFilterActive && (
                        <span className="text-[10px] font-semibold text-slate-450">
                            Showing {filteredLogs.length} of {mergedLogs.length} records
                        </span>
                    )}
                </div>

                {filteredLogs.length === 0 ? (
                    <div className="py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center bg-slate-50/50 dark:bg-slate-850/20">
                        <Calendar className="w-10 h-10 text-slate-350 dark:text-slate-700 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No records found.</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-550 mt-0.5">
                            {isFilterActive 
                                ? "Try resetting the date range filter above to view more logs." 
                                : "Your teacher has not logged any classroom sessions yet."}
                        </p>
                        {isFilterActive && (
                            <button
                                type="button"
                                onClick={() => { setFromDate(''); setToDate(''); }}
                                className="mt-3 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-[#7C5E3F] dark:text-amber-500 text-xs font-bold rounded-xl transition-all cursor-pointer"
                            >
                                Reset Date Filters
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="border border-slate-150 dark:border-slate-800 rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-850/50 text-left border-b border-slate-150 dark:border-slate-800">
                                        <th className="px-5 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Date & Start Time</th>
                                        <th className="px-5 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Classroom / Info</th>
                                        <th className="px-5 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Class Type</th>
                                        <th className="px-5 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Duration</th>
                                        <th className="px-5 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">My Attendance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredLogs.map((row) => {
                                        const badgeClass =
                                            row.status === 'present' ? 'bg-emerald-50 text-emerald-700 border-emerald-205 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900/30' :
                                            row.status === 'late' ? 'bg-amber-50 text-amber-700 border-amber-205 dark:bg-amber-950/20 dark:text-amber-450 dark:border-amber-900/30' :
                                            row.status === 'absent' ? 'bg-rose-50 text-rose-700 border-rose-205 dark:bg-rose-950/20 dark:text-rose-450 dark:border-rose-900/30' :
                                            row.status === 'excused' ? 'bg-blue-50 text-blue-700 border-blue-205 dark:bg-blue-950/20 dark:text-blue-450 dark:border-blue-900/30' :
                                            'bg-slate-50 text-slate-500 border-slate-205 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';

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
                                            <tr key={row.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-850/10">
                                                <td className="px-5 py-3.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                                                    <div>{formattedDate}</div>
                                                    {formattedTime && (
                                                        <div className="text-[10px] text-slate-400 dark:text-slate-555 font-semibold mt-0.5">at {formattedTime}</div>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5 text-xs text-slate-700 dark:text-slate-350 font-semibold">
                                                    {row.classroom_name}
                                                </td>
                                                <td className="px-5 py-3.5 text-xs">
                                                    {row.session_type === 'online' ? (
                                                        <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 rounded-full font-black text-[9px] uppercase tracking-wider">
                                                            Online Video Class
                                                        </span>
                                                    ) : row.session_type === 'offline' ? (
                                                        <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 rounded-full font-black text-[9px] uppercase tracking-wider">
                                                            In-Person Class
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-750 rounded-full font-black text-[9px] uppercase tracking-wider">
                                                            Manual Entry
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5 text-xs font-bold text-slate-600 dark:text-slate-400">
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
                    </div>
                )}
            </div>

            {/* Request Excuse Modal */}
            {showExcuseModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 text-left">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850/40 shrink-0">
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
                                className="p-1 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                        
                        {/* Form */}
                        <form onSubmit={handleSubmitExcuse} className="p-6 space-y-4 overflow-y-auto flex-1">
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
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-655 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSubmittingExcuse}
                                    className="px-5 py-2 bg-[#7C5E3F] hover:bg-[#6A4E31] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-md disabled:bg-stone-300 disabled:text-slate-500 disabled:cursor-not-allowed cursor-pointer"
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
