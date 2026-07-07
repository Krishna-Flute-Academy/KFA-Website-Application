'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
    Calendar, Users, MessageSquare, Clock, ChevronLeft, ChevronRight, 
    User, CheckCircle, Info, AlertTriangle, Play, FileText, Download,
    BookOpen, Megaphone
} from 'lucide-react';
import ClassroomChatTab from '../classroom/ClassroomChatTab';

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
    live_classroom_name?: string | null;
}

interface Classmate {
    id: string;
    name: string;
    level: string;
    profile_pic_url: string | null;
}

interface ClassNote {
    id: string;
    classroom_id: string;
    title: string;
    content?: string;
    file_url?: string;
    file_name?: string;
    file_size?: number;
    color?: string;
    created_at: string;
    classroom_name?: string;
    classroom_status?: string;
}

interface ClassroomTabProps {
    classroom: ClassroomInfo | null;
    activeRooms?: any[];
    setClassroom?: React.Dispatch<React.SetStateAction<any>>;
    classmates: Classmate[];
    mergedLogs: any[];
    profile: StudentProfile | null;
    batchSchedules: any[];
    makeupSchedules: any[];
    refreshData: () => Promise<void>;
    classNotes: ClassNote[];
    assignments?: any[];
    broadcasts?: any[];
    classroomMessages?: any[];
    isSendingClassroomMessage?: boolean;
    onSendClassroomMessage?: (messageText: string) => Promise<void>;
    onSelectAssignment?: (asg: any) => void;
}

export default function ClassroomTab({
    classroom,
    activeRooms = [],
    setClassroom,
    classmates,
    mergedLogs,
    profile,
    batchSchedules,
    makeupSchedules,
    refreshData,
    classNotes,
    assignments = [],
    broadcasts = [],
    classroomMessages = [],
    isSendingClassroomMessage = false,
    onSendClassroomMessage,
    onSelectAssignment
}: ClassroomTabProps) {
    const [subTab, setSubTab] = useState<'calendar' | 'logs' | 'notes' | 'assignments' | 'messages'>('calendar');
    const [messageTab, setMessageTab] = useState<'broadcasts' | 'chat'>('broadcasts');

    // Filter class notes by current classroom
    const filteredClassNotes = useMemo(() => {
        if (!classroom?.id) return [];
        return classNotes.filter(n => n.classroom_id === classroom.id);
    }, [classNotes, classroom?.id]);

    // Filter assignments by current classroom
    const filteredAssignments = useMemo(() => {
        if (!classroom?.id) return [];
        return (assignments || []).filter(a => a.classroom_id === classroom.id);
    }, [assignments, classroom?.id]);

    const classroomBroadcasts = useMemo(() => {
        if (!classroom?.id || !broadcasts) return [];
        return broadcasts
            .filter((broadcast: any) =>
                broadcast.recipients?.some((recipient: any) => recipient.type === 'class' && recipient.id === classroom.id)
            )
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [broadcasts, classroom?.id]);

    const classroomChatParticipants = useMemo(() => {
        const teacher = classroom?.teacher_id
            ? [{ id: classroom.teacher_id, name: classroom.teacher_name || 'Academy Instructor', role: 'teacher' }]
            : [];

        return [
            ...teacher,
            ...(profile ? [{ id: profile.id, name: profile.name || 'Me', role: 'student', profile_pic_url: profile.profile_pic_url || null }] : []),
            ...classmates.map(mate => ({ ...mate, role: 'student' }))
        ];
    }, [classroom?.teacher_id, classroom?.teacher_name, profile, classmates]);
    
    // Calendar Month state
    const [currentDate, setCurrentDate] = useState(new Date());

    const getLocalYYYYMMDD = (date: Date): string => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const getSchedulesForDate = (date: Date): any[] => {
        const dateStr = getLocalYYYYMMDD(date);
        const dayOfWeek = date.getDay();
        
        const dayClasses: any[] = [];
        
        // 1. Check matching temporary classes (overrides)
        const makeups = makeupSchedules.filter(o => o.override_date === dateStr);
        makeups.forEach(m => {
            dayClasses.push({
                type: 'temporary',
                title: m.title || 'Temporary Class',
                start_time: m.start_time,
                end_time: m.end_time,
                reason: m.reason,
                date: new Date(date)
            });
        });
        
        // 2. Check matching recurring batch schedules (only if there are no overrides/makeups for today)
        if (makeups.length === 0) {
            const regulars = batchSchedules.filter(s => s.day_of_week === dayOfWeek);
            regulars.forEach(r => {
                dayClasses.push({
                    type: 'permanent',
                    title: classroom?.name || 'Regular Class',
                    start_time: r.start_time,
                    end_time: r.end_time,
                    date: new Date(date)
                });
            });
        }
        
        return dayClasses;
    };

    // Calculate today's classes
    const todayClasses = useMemo(() => {
        const today = new Date();
        return getSchedulesForDate(today);
    }, [batchSchedules, makeupSchedules, classroom]);

    // Calculate tomorrow's classes and later classes
    const tomorrowClasses = useMemo(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return getSchedulesForDate(tomorrow);
    }, [batchSchedules, makeupSchedules, classroom]);

    const upcomingClassesLater = useMemo(() => {
        const classes: any[] = [];
        const today = new Date();
        
        // Next 7 days (excluding tomorrow which is day 1)
        for (let i = 2; i <= 7; i++) {
            const date = new Date();
            date.setDate(today.getDate() + i);
            const dayClasses = getSchedulesForDate(date);
            classes.push(...dayClasses);
        }
        return classes.sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [batchSchedules, makeupSchedules, classroom]);

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
            const dateStr = getLocalYYYYMMDD(pmDate);
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

        const todayStr = getLocalYYYYMMDD(new Date());

        // Current month days
        for (let d = 1; d <= totalDays; d++) {
            const dateObj = new Date(year, month, d);
            const dateStr = getLocalYYYYMMDD(dateObj);
            const dayOfWeek = dateObj.getDay();
            
            // Check makeup session overrides matching dateStr
            const matchedMakeups = makeupSchedules.filter(o => o.override_date === dateStr);

            // Check recurring batch schedules (schedules matching day_of_week) - only if no overrides exist for this day
            const matchedSchedules = matchedMakeups.length === 0
                ? batchSchedules.filter(s => s.day_of_week === dayOfWeek)
                : [];

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
            const dateStr = getLocalYYYYMMDD(nmDate);
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
                            <h4 className="text-sm font-black text-slate-800 dark:text-white">
                                {classroom.live_classroom_name 
                                    ? `Live Class: ${classroom.live_classroom_name}` 
                                    : 'Active Classroom Session In Progress'}
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Join the live call to participate in instructions and class questions.</p>
                        </div>
                    </div>
                    {classroom.live_meeting_link && (
                        <a 
                            href={classroom.live_meeting_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-full text-xs transition-all flex items-center justify-center gap-1.5 hover:scale-102 active:scale-98 shadow-xs cursor-pointer uppercase tracking-wider font-mono"
                        >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            Join Session
                        </a>
                    )}
                </div>
            )}

            {/* Classroom Header Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs text-left relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -mr-8 -mt-8"></div>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest block font-mono">My Classroom</span>
                        {activeRooms && activeRooms.length > 1 ? (
                            <div className="relative inline-block text-left mt-1">
                                <select
                                    value={classroom?.id || ''}
                                    onChange={(e) => {
                                        const selected = activeRooms.find(r => r.id === e.target.value);
                                        if (selected && setClassroom) setClassroom(selected);
                                    }}
                                    className="text-xl md:text-2xl font-black text-slate-900 dark:text-white bg-transparent border-b-2 border-amber-500 pr-8 focus:outline-hidden cursor-pointer"
                                >
                                    {activeRooms.map((room) => (
                                        <option key={room.id} value={room.id} className="text-sm font-semibold text-slate-800 dark:text-white bg-white dark:bg-slate-900">
                                            {room.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white truncate">
                                {classroom?.name || 'Classroom Portal'}
                            </h2>
                        )}
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                            {classroom?.description 
                                ? classroom.description.replace(/\[delivery_format:(online|offline)\]/g, '').trim() 
                                : 'Learn and interact with section members and practice flutes together.'}
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

                <div className="flex flex-wrap gap-2 border-t border-slate-100 dark:border-slate-800 mt-6 pt-5">
                    {[
                        { id: 'calendar', label: 'Class Calendar', icon: Calendar },
                        { id: 'assignments', label: 'Assignments', icon: BookOpen },
                        { id: 'notes', label: 'Class Notes', icon: FileText },
                        { id: 'messages', label: 'Messages & Discussion', icon: MessageSquare },
                        { id: 'logs', label: 'Presence Logs', icon: Clock }
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
                                                {cell.schedules.map((regularClass, sIdx) => (
                                                    <div key={`reg-${sIdx}`} className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 truncate" title={`Weekly Class: ${formatTime12hr(regularClass.start_time.slice(0, 5))}`}>
                                                        {formatTime12hr(regularClass.start_time.slice(0, 5))} Class
                                                    </div>
                                                ))}
                                                {cell.makeups.map((makeupClass, mIdx) => (
                                                     <div 
                                                         key={`make-${mIdx}`}
                                                         className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 truncate" 
                                                         title={`${makeupClass.title || 'Temporary Class'}: ${makeupClass.start_time ? formatTime12hr(makeupClass.start_time.slice(0, 5)) : ''} - ${makeupClass.end_time ? formatTime12hr(makeupClass.end_time.slice(0, 5)) : ''} (Reason: ${makeupClass.reason || 'N/A'})`}
                                                     >
                                                         ⚡ {makeupClass.title || 'Makeup Class'}
                                                     </div>
                                                 ))}
                                                {cell.assignments && cell.assignments.map((asg) => (
                                                    <button 
                                                        key={asg.id} 
                                                        onClick={() => onSelectAssignment?.(asg)}
                                                        className={`w-full text-left px-1.5 py-0.5 rounded text-[8px] font-black border truncate transition-all hover:scale-102 active:scale-98 cursor-pointer block ${
                                                            asg.status === 'pending' 
                                                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-450 border-rose-500/20' 
                                                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border-emerald-500/20'
                                                        }`}
                                                        title={`Task: ${asg.title}\nClass: ${asg.classroom_name || 'Classroom'}\nCreated: ${asg.created_at ? new Date(asg.created_at).toLocaleDateString() : 'N/A'}\nDue: ${asg.due_date ? new Date(asg.due_date).toLocaleDateString() : 'N/A'} (${asg.status})`}
                                                    >
                                                        📝 {asg.title}
                                                    </button>
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
                            
                            <div className="space-y-4">
                                {/* Today's Classes */}
                                <div>
                                    <span className="text-[10px] font-black text-rose-600 dark:text-rose-450 uppercase tracking-widest font-mono">Today's Classes</span>
                                    {todayClasses.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic mt-1.5">No classes scheduled for today.</p>
                                    ) : (
                                        <div className="space-y-2 mt-2">
                                            {todayClasses.map((c, idx) => (
                                                <div key={idx} className="p-3 bg-rose-50/40 dark:bg-rose-950/10 border border-rose-200/50 dark:border-rose-900/30 rounded-xl space-y-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="font-extrabold text-xs text-slate-800 dark:text-slate-200 truncate">{c.title}</p>
                                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                                            c.type === 'temporary' 
                                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' 
                                                                : 'bg-blue-100 text-blue-805 dark:bg-blue-955/40 dark:text-blue-400'
                                                        }`}>
                                                            {c.type === 'temporary' ? 'Temporary' : 'Permanent'}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-600 dark:text-slate-400 font-bold flex items-center gap-1">
                                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                        {c.start_time ? formatTime12hr(c.start_time.slice(0, 5)) : ''} - {c.end_time ? formatTime12hr(c.end_time.slice(0, 5)) : ''}
                                                    </p>
                                                    {c.reason && (
                                                        <p className="text-[9px] text-slate-400 italic">Reason: {c.reason}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Tomorrow's Classes */}
                                <div>
                                    <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest font-mono">Tomorrow's Classes</span>
                                    {tomorrowClasses.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic mt-1.5">No classes scheduled for tomorrow.</p>
                                    ) : (
                                        <div className="space-y-2 mt-2">
                                            {tomorrowClasses.map((c, idx) => (
                                                <div key={idx} className="p-3 bg-amber-50/40 dark:bg-amber-955/10 border border-amber-200/50 dark:border-amber-900/30 rounded-xl space-y-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="font-extrabold text-xs text-slate-800 dark:text-slate-200 truncate">{c.title}</p>
                                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                                            c.type === 'temporary' 
                                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' 
                                                                : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400'
                                                        }`}>
                                                            {c.type === 'temporary' ? 'Temporary' : 'Permanent'}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-600 dark:text-slate-400 font-bold flex items-center gap-1">
                                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                        {c.start_time ? formatTime12hr(c.start_time.slice(0, 5)) : ''} - {c.end_time ? formatTime12hr(c.end_time.slice(0, 5)) : ''}
                                                    </p>
                                                    {c.reason && (
                                                        <p className="text-[9px] text-slate-400 italic">Reason: {c.reason}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Upcoming Classes (Next 7 Days) */}
                                <div className="border-t border-slate-100 dark:border-slate-800 pt-3.5">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">Upcoming Classes (Next 7 Days)</span>
                                    {upcomingClassesLater.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic mt-1.5">No other classes scheduled for the next 7 days.</p>
                                    ) : (
                                        <div className="space-y-2 mt-2 max-h-[180px] overflow-y-auto pr-1">
                                            {upcomingClassesLater.map((c, idx) => (
                                                <div key={idx} className="p-2.5 bg-slate-50/50 dark:bg-slate-850/50 border border-slate-200/50 dark:border-slate-800 rounded-xl space-y-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="font-bold text-xs text-slate-800 dark:text-slate-250 truncate">{c.title}</p>
                                                        <span className={`px-1 py-0.2 rounded text-[7px] font-black uppercase tracking-wider ${
                                                            c.type === 'temporary' 
                                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' 
                                                                : 'bg-blue-100 text-blue-805 dark:bg-blue-955/40 dark:text-blue-400'
                                                        }`}>
                                                            {c.type === 'temporary' ? 'Temp' : 'Perm'}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-550 dark:text-slate-400 font-semibold flex items-center gap-1 flex-wrap">
                                                        <span>{c.date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                                                        <span>•</span>
                                                        <span>{c.start_time ? formatTime12hr(c.start_time.slice(0, 5)) : ''} - {c.end_time ? formatTime12hr(c.end_time.slice(0, 5)) : ''}</span>
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Weekly Standard Schedule Reference */}
                                <div className="border-t border-slate-100 dark:border-slate-800 pt-3.5">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">Weekly Standard Schedule</span>
                                    {batchSchedules.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic mt-1.5">No standard weekly schedule has been set.</p>
                                    ) : (
                                        <div className="space-y-1.5 mt-1.5">
                                            {batchSchedules.map((s, idx) => (
                                                <div key={idx} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 p-1.5 bg-slate-50/20 rounded-lg">
                                                    <span className="font-extrabold">{DAY_NAMES[s.day_of_week]}</span>
                                                    <span className="font-mono text-[10px]">{formatTime12hr(s.start_time.slice(0,5))} – {formatTime12hr(s.end_time.slice(0,5))}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Upcoming Task Deadlines */}
                                <div className="border-t border-slate-100 dark:border-slate-800 pt-3.5">
                                    <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest font-mono">Tasks & Assignments</span>
                                    {assignments.filter(asg => asg.due_date && asg.status === 'pending').length === 0 ? (
                                        <p className="text-xs text-slate-400 italic mt-1.5">No pending task deadlines.</p>
                                    ) : (
                                        <div className="space-y-2 mt-2">
                                            {assignments
                                                .filter(asg => asg.due_date && asg.status === 'pending')
                                                .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
                                                .slice(0, 2)
                                                .map((asg, idx) => (
                                                    <button 
                                                        key={idx} 
                                                        onClick={() => onSelectAssignment?.(asg)}
                                                        className="w-full flex items-start gap-2.5 p-3 bg-rose-500/[0.01] hover:bg-rose-500/[0.04] border border-rose-500/10 hover:border-rose-500/20 rounded-xl transition-all text-left cursor-pointer hover:scale-102 active:scale-98"
                                                    >
                                                        <FileText className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                                        <div className="text-[11px] space-y-0.5 w-full">
                                                            <div className="flex items-center justify-between gap-1 w-full">
                                                                <p className="font-extrabold text-slate-800 dark:text-slate-200 truncate max-w-[130px]">{asg.title}</p>
                                                                <span className="text-[8px] font-black text-rose-600 dark:text-rose-450 uppercase tracking-wider font-mono">Pending</span>
                                                            </div>
                                                            <p className="text-[9px] text-slate-455 dark:text-slate-400 font-semibold truncate">
                                                                Class: {asg.classroom_name || 'Classroom'}
                                                            </p>
                                                            <div className="flex items-center justify-between text-[9px] text-slate-400 font-medium pt-1">
                                                                <span>Created: {asg.created_at ? new Date(asg.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' }) : 'N/A'}</span>
                                                                <span className="font-bold text-slate-600 dark:text-slate-350">Due: {new Date(asg.due_date).toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
                                                            </div>
                                                        </div>
                                                    </button>
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
                                        <th className="pb-3 pt-1">Session Date / Class</th>
                                        <th className="pb-3 pt-1">Timing / Start</th>
                                        <th className="pb-3 pt-1">Format</th>
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

                                        const isTempLog = log.classroom_id && log.classroom_id !== classroom?.id;

                                        const statusColors = {
                                            present: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-500/20',
                                            absent: 'bg-rose-105 text-rose-700 dark:bg-rose-955/20 dark:text-rose-400 border border-rose-500/20',
                                            late: 'bg-amber-100 text-amber-700 dark:bg-amber-955/20 dark:text-amber-400 border border-amber-500/20',
                                            excused: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-202/60',
                                            unmarked: 'bg-slate-50 text-slate-400 dark:bg-slate-900 border border-slate-200/50'
                                        };

                                        return (
                                            <tr key={idx} className="hover:bg-slate-50/40 dark:hover:bg-slate-850/20 transition-colors">
                                                <td className="py-4 text-left">
                                                    <p className="font-bold text-slate-800 dark:text-white">{dateLabel}</p>
                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">{log.classroom_name || 'Classroom'}</p>
                                                </td>
                                                <td className="py-4 text-slate-505 dark:text-slate-400">{startTimeLabel}</td>
                                                <td className="py-4">
                                                    {log.session_type === 'online' ? (
                                                        <span className="text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/15 font-black">Online</span>
                                                    ) : log.session_type === 'offline' ? (
                                                        <span className="text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/15 font-black">Offline</span>
                                                    ) : (
                                                        <span className="text-slate-400">—</span>
                                                    )}
                                                </td>
                                                <td className="py-4">
                                                    {isTempLog ? (
                                                        <span className="text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/15 font-black">Temporary</span>
                                                    ) : (
                                                        <span className="text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/15 font-black">Permanent</span>
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

                    {filteredClassNotes.length === 0 ? (
                        <div className="py-16 border border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-center bg-slate-50/50 dark:bg-slate-950/10">
                            <FileText className="w-10 h-10 text-slate-350 mx-auto mb-2" />
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No notes found.</p>
                            <p className="text-[10px] text-slate-405 mt-0.5">Your teacher has not posted class notes yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                            {filteredClassNotes.map((note) => {
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
                                            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                                                <span className="text-[9px] font-black text-slate-455 dark:text-slate-500 uppercase tracking-wider font-mono">
                                                    {note.classroom_name || 'Classroom'}
                                                </span>
                                                {note.classroom_status && note.classroom_status.toLowerCase() !== 'active' && (
                                                    <span className="text-[7px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded">
                                                        🚫 Inactive
                                                    </span>
                                                )}
                                            </div>
                                            <h4 className="font-extrabold text-xs md:text-sm text-slate-800 dark:text-white">{note.title}</h4>
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

            {subTab === 'assignments' && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs text-left">
                    <h3 className="font-extrabold text-slate-808 dark:text-white text-base mb-1">Class Assignments</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Assigned tasks and practice works for this classroom</p>

                    {filteredAssignments.length === 0 ? (
                        <div className="py-16 border border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-center bg-slate-50/50 dark:bg-slate-950/10">
                            <BookOpen className="w-10 h-10 text-slate-350 mx-auto mb-2" />
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No assignments found.</p>
                            <p className="text-[10px] text-slate-405 mt-0.5">There are no assignments posted for this classroom.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                            {filteredAssignments.map((asg) => {
                                const statusColors = {
                                    pending: 'bg-amber-100/50 text-amber-700 border-amber-500/20 dark:bg-amber-950/20 dark:text-amber-400',
                                    submitted: 'bg-blue-100/50 text-blue-700 border-blue-500/20 dark:bg-blue-950/20 dark:text-blue-450',
                                    reviewed: 'bg-purple-100/50 text-purple-700 border-purple-500/20 dark:bg-purple-950/20 dark:text-purple-400',
                                    approved: 'bg-emerald-100/50 text-emerald-700 border-emerald-500/20 dark:bg-emerald-950/20 dark:text-emerald-450',
                                };
                                const isPending = asg.status === 'pending';

                                return (
                                    <div 
                                        key={asg.id} 
                                        className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between gap-4 text-left bg-white dark:bg-slate-900"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${statusColors[asg.status as keyof typeof statusColors] || statusColors.pending}`}>
                                                    {asg.status}
                                                </span>
                                                {asg.due_date && (
                                                    <span className="text-[9px] text-slate-400 font-bold">
                                                        Due: {new Date(asg.due_date).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                            <h4 className="font-extrabold text-xs md:text-sm text-[#7C5E3F] dark:text-white line-clamp-1">{asg.title}</h4>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                                                {asg.description || 'No description provided.'}
                                            </p>
                                        </div>

                                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                            {asg.score !== undefined && asg.score !== null ? (
                                                <span className="text-xs font-black text-slate-808 dark:text-white">
                                                    Score: <span className="text-[#ecb613]">{asg.score}/100</span>
                                                </span>
                                            ) : (
                                                <span className="text-[9px] text-slate-405 font-semibold">Ungraded</span>
                                            )}

                                            <button 
                                                onClick={() => onSelectAssignment?.(asg)}
                                                className="inline-flex items-center gap-1 text-[9px] font-black text-[#7C5E3F] hover:text-amber-700 bg-[#FAF5EE] dark:bg-slate-800 dark:text-amber-400 hover:bg-amber-100/50 px-2.5 py-1.5 rounded-lg border border-transparent transition-colors cursor-pointer"
                                            >
                                                {isPending ? 'Submit Task' : 'View Details'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {subTab === 'messages' && (
                <div className="space-y-5 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs">
                        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 dark:bg-slate-950/40 p-1 border border-slate-100 dark:border-slate-800">
                            {[
                                { id: 'broadcasts' as const, label: 'Broadcast Messages', icon: Megaphone },
                                { id: 'chat' as const, label: 'Chat', icon: MessageSquare }
                            ].map((tab) => {
                                const Icon = tab.icon;
                                const active = messageTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setMessageTab(tab.id)}
                                        className={`min-h-[44px] px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                            active
                                                ? 'bg-white dark:bg-slate-900 text-[#7C5E3F] dark:text-amber-400 shadow-2xs border border-slate-200 dark:border-slate-700'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 border border-transparent'
                                        }`}
                                    >
                                        <Icon className="w-4 h-4 shrink-0" />
                                        <span className="truncate">{tab.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {messageTab === 'broadcasts' ? (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs text-left min-h-[560px]">
                            <div className="flex items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
                                <div className="min-w-0">
                                    <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest block font-mono">Read Only</span>
                                    <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mt-1 truncate">Classroom Announcements</h3>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-400/10 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
                                    <Megaphone className="w-5 h-5" />
                                </div>
                            </div>

                            {classroomBroadcasts.length === 0 ? (
                                <div className="min-h-[380px] flex flex-col items-center justify-center text-center border border-dashed border-slate-150 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/15 p-6">
                                    <Megaphone className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-3" />
                                    <p className="text-sm font-extrabold text-slate-700 dark:text-slate-300">No classroom broadcasts yet.</p>
                                    <p className="text-xs text-slate-400 mt-1 max-w-[260px] leading-relaxed">Announcements from your teacher will appear here.</p>
                                </div>
                            ) : (
                                <div className="space-y-4 max-h-[520px] overflow-y-auto custom-scrollbar pr-1">
                                    {classroomBroadcasts.map((broadcast: any) => {
                                        const senderName = broadcast.sender?.name || classroom?.teacher_name || 'Academy Instructor';
                                        const senderRole = broadcast.sender?.role || 'teacher';

                                        return (
                                            <article
                                                key={broadcast.id}
                                                className="p-4 sm:p-5 rounded-2xl border border-amber-100 dark:border-slate-800 bg-[#FAF5EE]/60 dark:bg-slate-850/30 shadow-3xs"
                                            >
                                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white leading-snug">{broadcast.subject || 'Classroom Announcement'}</h4>
                                                            <span className="text-[7.5px] font-black bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                                {senderRole}
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] font-bold text-slate-400 mt-1">From {senderName}</p>
                                                    </div>
                                                    <span className="text-[9px] font-bold text-slate-400 shrink-0">
                                                        {new Date(broadcast.created_at).toLocaleString([], {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-650 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                                    {broadcast.content}
                                                </p>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : (
                        <ClassroomChatTab
                            classroom={classroom}
                            currentUser={profile ? { id: profile.id, name: profile.name, role: 'student' } : null}
                            messages={classroomMessages}
                            participants={classroomChatParticipants}
                            sending={isSendingClassroomMessage}
                            onSendMessage={async (messageText) => {
                                if (!onSendClassroomMessage) return;
                                await onSendClassroomMessage(messageText);
                            }}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
