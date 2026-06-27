'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
    Calendar, Users, MessageSquare, Clock, ChevronLeft, ChevronRight, 
    Send, User, Loader2, CheckCircle, Info, AlertTriangle, Play, FileText, Download 
} from 'lucide-react';
import { supabaseAuth } from '../../lib/supabase-auth';

interface StudentProfile {
    id: string;
    name: string;
    email: string;
    level?: string;
    profile_pic_url?: string;
}

interface ClassroomInfo {
    id: string;
    name: string;
    teacher_id?: string;
    teacher_name?: string;
    teacher_email?: string;
    description?: string;
    is_live?: boolean;
    live_meeting_link?: string | null;
    live_session_started_at?: string | null;
}

interface Classmate {
    id: string;
    name: string;
    level: string;
    profile_pic_url: string | null;
}

interface ClassNote {
    id: string;
    title: string;
    content?: string;
    file_url?: string;
    file_name?: string;
    file_size?: number;
    color?: string;
    created_at: string;
}

interface ClassroomTabProps {
    classroom: ClassroomInfo | null;
    classmates: Classmate[];
    mergedLogs: any[];
    profile: StudentProfile | null;
    batchSchedules: any[];
    makeupSchedules: any[];
    refreshData: () => Promise<void>;
    classNotes: ClassNote[];
    assignments?: any[];
}

export default function ClassroomTab({
    classroom,
    classmates,
    mergedLogs,
    profile,
    batchSchedules,
    makeupSchedules,
    refreshData,
    classNotes,
    assignments = []
}: ClassroomTabProps) {
    const [subTab, setSubTab] = useState<'calendar' | 'logs' | 'notes'>('calendar');
    
    // Calendar Month state
    const [currentDate, setCurrentDate] = useState(new Date());

    // Format local date strings
    const formatLocalDate = (dateStr: string): Date => {
        if (!dateStr) return new Date();
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const [year, month, day] = dateStr.split('-').map(Number);
            return new Date(year, month - 1, day);
        }
        return new Date(dateStr);
    };

    // Calendar Calculations
    const calendarDays = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        
        const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday
        const totalDays = lastDayOfMonth.getDate();
        
        const prevMonthLast = new Date(year, month, 0).getDate();
        
        const days: Array<{
            dayNum: number;
            dateStr: string;
            isCurrentMonth: boolean;
            isToday: boolean;
            schedules: any[];
            makeups: any[];
            assignments: any[];
        }> = [];

        // Previous month fill-in
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const d = prevMonthLast - i;
            const pmDate = new Date(year, month - 1, d);
            const dateStr = pmDate.toISOString().split('T')[0];
            const matchedAssignments = assignments.filter(asg => {
                if (!asg.due_date) return false;
                const asgDatePart = asg.due_date.includes('T') ? asg.due_date.split('T')[0] : asg.due_date;
                return asgDatePart === dateStr;
            });
            days.push({
                dayNum: d,
                dateStr,
                isCurrentMonth: false,
                isToday: false,
                schedules: [],
                makeups: [],
                assignments: matchedAssignments
            });
        }

        const todayStr = new Date().toISOString().split('T')[0];

        // Current month days
        for (let d = 1; d <= totalDays; d++) {
            const dateObj = new Date(year, month, d);
            const dateStr = dateObj.toISOString().split('T')[0];
            const dayOfWeek = dateObj.getDay();
            
            // Check recurring batch schedules (schedules matching day_of_week)
            const matchedSchedules = batchSchedules.filter(s => s.day_of_week === dayOfWeek);
            
            // Check makeup session overrides matching dateStr
            const matchedMakeups = makeupSchedules.filter(o => o.override_date === dateStr);

            const matchedAssignments = assignments.filter(asg => {
                if (!asg.due_date) return false;
                const asgDatePart = asg.due_date.includes('T') ? asg.due_date.split('T')[0] : asg.due_date;
                return asgDatePart === dateStr;
            });

            days.push({
                dayNum: d,
                dateStr,
                isCurrentMonth: true,
                isToday: dateStr === todayStr,
                schedules: matchedSchedules,
                makeups: matchedMakeups,
                assignments: matchedAssignments
            });
        }

        // Next month fill-in
        const totalCells = days.length;
        const nextMonthDays = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        for (let d = 1; d <= nextMonthDays; d++) {
            const nmDate = new Date(year, month + 1, d);
            const dateStr = nmDate.toISOString().split('T')[0];
            const matchedAssignments = assignments.filter(asg => {
                if (!asg.due_date) return false;
                const asgDatePart = asg.due_date.includes('T') ? asg.due_date.split('T')[0] : asg.due_date;
                return asgDatePart === dateStr;
            });
            days.push({
                dayNum: d,
                dateStr,
                isCurrentMonth: false,
                isToday: false,
                schedules: [],
                makeups: [],
                assignments: matchedAssignments
            });
        }

        return days;
    }, [currentDate, batchSchedules, makeupSchedules, assignments]);

    const handlePrevMonth = () => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    const monthLabel = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });



    const formatTime12hr = (timeStr: string) => {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':');
        let hours = parseInt(h, 10);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        return `${hours}:${m} ${ampm}`;
    };

    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Live Session Alert Callout */}
            {classroom?.is_live && (
                <div className="bg-gradient-to-r from-red-500/10 to-rose-600/10 border border-red-200 dark:border-red-950/30 rounded-3xl p-5 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-2xl bg-red-500 text-white flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-xl animate-pulse">live_tv</span>
                        </div>
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                                <span className="text-[8px] font-black uppercase tracking-wider bg-red-500 text-white px-2 py-0.5 rounded font-mono animate-pulse">Live</span>
                                {classroom.live_session_started_at && (
                                    <span className="text-[10px] text-red-600 dark:text-red-400 font-bold font-mono">
                                        Active since {new Date(classroom.live_session_started_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                                    </span>
                                )}
                            </div>
                            <h4 className="text-sm font-black text-slate-800 dark:text-white">Active Classroom Session In Progress</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Join the live call to participate in instructions and class questions.</p>
                        </div>
                    </div>
                    {classroom.live_meeting_link ? (
                        <a 
                            href={classroom.live_meeting_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-full text-xs transition-all flex items-center justify-center gap-1.5 hover:scale-102 active:scale-98 shadow-xs cursor-pointer uppercase tracking-wider font-mono"
                        >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            Join Session
                        </a>
                    ) : (
                        <span className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold rounded-full text-xs">
                            Waiting for link...
                        </span>
                    )}
                </div>
            )}

            {/* Classroom Header Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs text-left relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -mr-8 -mt-8"></div>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest block font-mono">My Classroom</span>
                        <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white truncate">
                            {classroom?.name || 'Classroom Portal'}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                            {classroom?.description || 'Learn and interact with section members and practice flutes together.'}
                        </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <div className="p-3.5 bg-amber-50/50 dark:bg-slate-850 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-[#ecb613]">
                                <User className="w-5 h-5 text-[#ecb613]" />
                            </div>
                            <div className="text-left">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider font-mono">Instructor</p>
                                <h4 className="text-xs font-black text-slate-808 dark:text-white mt-0.5">{classroom?.teacher_name || 'Academy Teacher'}</h4>
                                <p className="text-[10px] font-medium text-slate-500 truncate mt-0.5">{classroom?.teacher_email}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 border-t border-slate-100 dark:border-slate-800 mt-6 pt-5">
                    {[
                        { id: 'calendar', label: 'Class Calendar', icon: Calendar },
                        { id: 'logs', label: 'Class logs & Presence', icon: Clock },
                        { id: 'notes', label: 'Class Notes', icon: FileText }
                    ].map(tab => {
                        const Icon = tab.icon;
                        const active = subTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setSubTab(tab.id as any)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    active 
                                        ? 'bg-[#FAF5EE] text-[#7C5E3F] border border-[#FAF5EE] dark:bg-slate-800 dark:text-amber-400 dark:border-slate-700 shadow-2xs'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
                                }`}
                            >
                                <Icon className="w-4 h-4 shrink-0" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Sub Tab Content */}
            {subTab === 'calendar' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
                    {/* Calendar grid */}
                    <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-extrabold text-slate-800 dark:text-white text-base">Monthly Schedule</h3>
                            <div className="flex items-center gap-2">
                                <button onClick={handlePrevMonth} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 cursor-pointer">
                                    <ChevronLeft className="w-4.5 h-4.5" />
                                </button>
                                <span className="text-xs font-black text-slate-800 dark:text-white min-w-32 text-center uppercase tracking-wider font-mono">
                                    {monthLabel}
                                </span>
                                <button onClick={handleNextMonth} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 cursor-pointer">
                                    <ChevronRight className="w-4.5 h-4.5" />
                                </button>
                            </div>
                        </div>

                        {/* Calendar Grid Header */}
                        <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] text-slate-400 uppercase tracking-widest mb-2 font-mono">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} className="py-1">{day}</div>
                            ))}
                        </div>

                        {/* Calendar Grid Cells */}
                        <div className="grid grid-cols-7 gap-1 flex-1">
                            {calendarDays.map((cell, idx) => {
                                const hasEvents = cell.schedules.length > 0 || cell.makeups.length > 0 || (cell.assignments && cell.assignments.length > 0);
                                const regularClass = cell.schedules[0];
                                const makeupClass = cell.makeups[0];
                                
                                const hasPendingAssignment = cell.assignments && cell.assignments.some(asg => asg.status === 'pending');
                                const hasCompletedAssignment = cell.assignments && cell.assignments.length > 0 && !hasPendingAssignment;

                                let cellBgAndBorder = 'border-slate-100 dark:border-slate-805 bg-white dark:bg-slate-900';
                                if (!cell.isCurrentMonth) {
                                    cellBgAndBorder = 'bg-slate-50/50 dark:bg-slate-950/20 text-slate-400 opacity-40 border-slate-100 dark:border-slate-805';
                                } else if (hasPendingAssignment) {
                                    cellBgAndBorder = 'border-rose-200 dark:border-rose-900/40 bg-rose-50/10 dark:bg-rose-950/5 shadow-3xs';
                                } else if (hasCompletedAssignment) {
                                    cellBgAndBorder = 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/5 dark:bg-emerald-950/5 shadow-3xs';
                                }

                                return (
                                    <div 
                                        key={idx}
                                        className={`min-h-[50px] p-1.5 border rounded-xl flex flex-col justify-between text-left transition-all ${cellBgAndBorder} ${cell.isToday ? 'ring-2 ring-amber-500 dark:ring-amber-400' : ''}`}
                                    >
                                        <span className={`text-[10px] font-bold ${cell.isToday ? 'text-amber-600 dark:text-amber-400 font-extrabold' : 'text-slate-400 dark:text-slate-550'}`}>
                                            {cell.dayNum}
                                        </span>

                                        {hasEvents && cell.isCurrentMonth && (
                                            <div className="space-y-1">
                                                {regularClass && (
                                                    <div className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 truncate" title={`Weekly Class: ${formatTime12hr(regularClass.start_time.slice(0, 5))}`}>
                                                        {formatTime12hr(regularClass.start_time.slice(0, 5))} Class
                                                    </div>
                                                )}
                                                {makeupClass && (
                                                    <div className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 truncate" title={`Makeup Class: ${makeupClass.reason || 'Rescheduled'}`}>
                                                        Makeup Class
                                                    </div>
                                                )}
                                                {cell.assignments && cell.assignments.map((asg) => (
                                                    <div 
                                                        key={asg.id} 
                                                        className={`px-1.5 py-0.5 rounded text-[8px] font-black border truncate ${
                                                            asg.status === 'pending' 
                                                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-450 border-rose-500/20' 
                                                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border-emerald-500/20'
                                                        }`}
                                                        title={`Task Due: ${asg.title} (${asg.status})`}
                                                    >
                                                        📝 {asg.title}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Schedule Side Panel */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5 flex flex-col justify-between">
                        <div className="space-y-4">
                            <h3 className="font-extrabold text-slate-800 dark:text-white text-base">Schedule Information</h3>
                            
                            <div className="space-y-3.5">
                                <div>
                                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Weekly Recurring Schedule</span>
                                    {batchSchedules.length === 0 ? (
                                        <p className="text-xs text-slate-405 italic mt-1.5">No recurring schedule has been set for this batch.</p>
                                    ) : (
                                        <div className="space-y-2 mt-2">
                                            {batchSchedules.map((s, idx) => (
                                                <div key={idx} className="flex items-center gap-3 p-3 bg-blue-500/[0.02] border border-blue-500/10 rounded-xl">
                                                    <Calendar className="w-4 h-4 text-blue-550 shrink-0" />
                                                    <div className="text-xs text-left">
                                                        <p className="font-black text-slate-800 dark:text-slate-200">{DAY_NAMES[s.day_of_week]}</p>
                                                        <p className="text-[10px] text-slate-455 mt-0.5">{formatTime12hr(s.start_time.slice(0,5))} – {formatTime12hr(s.end_time.slice(0,5))}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="border-t border-slate-100 dark:border-slate-800 pt-3.5">
                                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Upcoming Makeup / Overrides</span>
                                    {makeupSchedules.length === 0 ? (
                                        <p className="text-xs text-slate-405 italic mt-1.5">No temporary makeup sessions scheduled.</p>
                                    ) : (
                                        <div className="space-y-2 mt-2">
                                            {makeupSchedules.slice(0, 3).map((o, idx) => (
                                                <div key={idx} className="flex items-center gap-3 p-3 bg-emerald-500/[0.02] border border-emerald-500/10 rounded-xl">
                                                    <CheckCircle className="w-4 h-4 text-emerald-550 shrink-0" />
                                                    <div className="text-xs text-left">
                                                        <p className="font-black text-slate-808 dark:text-slate-200">
                                                            {formatLocalDate(o.override_date).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </p>
                                                        <p className="text-[10px] text-slate-505 mt-0.5 italic">Reason: {o.reason || 'Temporary makeup allocation'}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="border-t border-slate-100 dark:border-slate-800 pt-3.5">
                                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Upcoming Task Deadlines</span>
                                    {assignments.filter(asg => asg.due_date && asg.status === 'pending').length === 0 ? (
                                        <p className="text-xs text-slate-405 italic mt-1.5">No pending task deadlines.</p>
                                    ) : (
                                        <div className="space-y-2 mt-2">
                                            {assignments
                                                .filter(asg => asg.due_date && asg.status === 'pending')
                                                .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
                                                .slice(0, 3)
                                                .map((asg, idx) => (
                                                    <div key={idx} className="flex items-center gap-3 p-3 bg-rose-500/[0.02] border border-rose-500/10 rounded-xl">
                                                        <FileText className="w-4 h-4 text-rose-550 shrink-0" />
                                                        <div className="text-xs text-left">
                                                            <p className="font-black text-slate-808 dark:text-slate-200">
                                                                {new Date(asg.due_date).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                                                            </p>
                                                            <p className="text-[10px] text-slate-500 mt-0.5 truncate">{asg.title}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-amber-500/[0.02] border border-amber-500/10 rounded-2xl flex items-start gap-3 mt-4">
                            <Info className="w-5 h-5 text-[#ecb613] shrink-0 mt-0.5" />
                            <p className="text-[10px] text-slate-505 dark:text-slate-400 leading-normal font-semibold">
                                Attendance checkins are marked live by the teacher during classes. Any discrepancies can be cleared up by messaging the instructor directly.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {subTab === 'logs' && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs text-left">
                    <h3 className="font-extrabold text-slate-808 dark:text-white text-base mb-1">Class Presence Logs</h3>
                    <p className="text-xs text-slate-455 mb-6">Logs of completed live sessions and attendance results</p>

                    {mergedLogs.length === 0 ? (
                        <div className="py-16 border border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-center bg-slate-50/50 dark:bg-slate-950/10">
                            <Clock className="w-10 h-10 text-slate-350 mx-auto mb-2" />
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No session logs found.</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Logs will automatically populate when classes are held.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">
                                        <th className="pb-3 pt-1">Session Date</th>
                                        <th className="pb-3 pt-1">Timing / Start</th>
                                        <th className="pb-3 pt-1">Type</th>
                                        <th className="pb-3 pt-1">Duration</th>
                                        <th className="pb-3 pt-1 text-right">My Attendance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-805">
                                    {mergedLogs.map((log, idx) => {
                                        const dateLabel = formatLocalDate(log.date).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
                                        const startTimeLabel = log.started_at 
                                            ? new Date(log.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                            : 'Not Logged';
                                        
                                        const durationMinutes = log.duration_seconds 
                                            ? `${Math.round(log.duration_seconds / 60)} mins`
                                            : '—';

                                        const statusColors = {
                                            present: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-500/20',
                                            absent: 'bg-rose-105 text-rose-700 dark:bg-rose-955/20 dark:text-rose-400 border border-rose-500/20',
                                            late: 'bg-amber-100 text-amber-700 dark:bg-amber-955/20 dark:text-amber-400 border border-amber-500/20',
                                            excused: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-202/60',
                                            unmarked: 'bg-slate-50 text-slate-400 dark:bg-slate-900 border border-slate-200/50'
                                        };

                                        return (
                                            <tr key={idx} className="hover:bg-slate-50/40 dark:hover:bg-slate-850/20 transition-colors">
                                                <td className="py-4 font-bold text-slate-808 dark:text-white">{dateLabel}</td>
                                                <td className="py-4 text-slate-505 dark:text-slate-400">{startTimeLabel}</td>
                                                <td className="py-4 font-black">
                                                    {log.session_type === 'online' ? (
                                                        <span className="text-blue-550 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/15">Online</span>
                                                    ) : log.session_type === 'offline' ? (
                                                        <span className="text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/15">Offline</span>
                                                    ) : (
                                                        <span className="text-slate-400">—</span>
                                                    )}
                                                </td>
                                                <td className="py-4 font-mono font-semibold text-slate-505 dark:text-slate-400">{durationMinutes}</td>
                                                <td className="py-4 text-right">
                                                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${statusColors[log.status as keyof typeof statusColors] || statusColors.unmarked}`}>
                                                        {log.status}
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
            )}

            {subTab === 'notes' && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs text-left">
                    <h3 className="font-extrabold text-slate-808 dark:text-white text-base mb-1">Class Notes & Materials</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Resources and reference material uploaded by your instructor</p>

                    {classNotes.length === 0 ? (
                        <div className="py-16 border border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-center bg-slate-50/50 dark:bg-slate-950/10">
                            <FileText className="w-10 h-10 text-slate-350 mx-auto mb-2" />
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No notes found.</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Your teacher has not posted class notes yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                            {classNotes.map((note) => {
                                // Dynamic note color styling
                                const bgClass =
                                    note.color === 'blue' ? 'bg-blue-50/50 border-blue-100/50 dark:bg-blue-950/10 dark:border-blue-900/30' :
                                    note.color === 'green' ? 'bg-emerald-50/50 border-emerald-100/50 dark:bg-emerald-950/10 dark:border-emerald-900/30' :
                                    note.color === 'rose' ? 'bg-rose-50/50 border-rose-100/50 dark:bg-rose-955/10 dark:border-rose-900/30' :
                                    'bg-amber-50/40 border-amber-100/40 dark:bg-amber-955/10 dark:border-amber-900/30';

                                return (
                                    <div 
                                        key={note.id} 
                                        className={`border rounded-2xl p-5 hover:shadow-xs transition-shadow flex flex-col justify-between gap-4 text-left ${bgClass}`}
                                    >
                                        <div>
                                            <h4 className="font-extrabold text-xs md:text-sm text-slate-808 dark:text-white">{note.title}</h4>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-4 leading-relaxed whitespace-pre-wrap">
                                                {note.content}
                                            </p>
                                        </div>

                                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                            <span className="text-[8px] font-bold text-slate-400">
                                                {new Date(note.created_at).toLocaleDateString()}
                                            </span>

                                            {note.file_url && (
                                                <a 
                                                    href={note.file_url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-md hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                                                >
                                                    <Download className="w-3 h-3" /> Download
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
              )}
        </div>
    );
}
