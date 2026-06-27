'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
    Calendar, Users, MessageSquare, Clock, ChevronLeft, ChevronRight, 
    Send, User, Loader2, CheckCircle, Info, AlertTriangle, Play 
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
}

interface Classmate {
    id: string;
    name: string;
    level: string;
    profile_pic_url: string | null;
}

interface ClassroomTabProps {
    classroom: ClassroomInfo | null;
    classmates: Classmate[];
    mergedLogs: any[];
    profile: StudentProfile | null;
    batchSchedules: any[];
    makeupSchedules: any[];
    directMessages: any[];
    onSendDirectMessage: (receiverId: string, text: string) => Promise<void>;
    refreshData: () => Promise<void>;
}

export default function ClassroomTab({
    classroom,
    classmates,
    mergedLogs,
    profile,
    batchSchedules,
    makeupSchedules,
    directMessages,
    onSendDirectMessage,
    refreshData
}: ClassroomTabProps) {
    const [subTab, setSubTab] = useState<'calendar' | 'logs' | 'chat'>('calendar');
    
    // Calendar Month state
    const [currentDate, setCurrentDate] = useState(new Date());
    
    // Chat state
    const [selectedChatPartner, setSelectedChatPartner] = useState<{ id: string; name: string; isTeacher: boolean } | null>(null);
    const [chatInput, setChatInput] = useState('');
    const [sendingMsg, setSendingMsg] = useState(false);

    // Set default chat partner to teacher on mount if available
    useEffect(() => {
        if (classroom?.teacher_id && !selectedChatPartner) {
            setSelectedChatPartner({
                id: classroom.teacher_id,
                name: classroom.teacher_name || 'Academy Instructor',
                isTeacher: true
            });
        }
    }, [classroom, selectedChatPartner]);

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
        }> = [];

        // Previous month fill-in
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const d = prevMonthLast - i;
            const pmDate = new Date(year, month - 1, d);
            const dateStr = pmDate.toISOString().split('T')[0];
            days.push({
                dayNum: d,
                dateStr,
                isCurrentMonth: false,
                isToday: false,
                schedules: [],
                makeups: []
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

            days.push({
                dayNum: d,
                dateStr,
                isCurrentMonth: true,
                isToday: dateStr === todayStr,
                schedules: matchedSchedules,
                makeups: matchedMakeups
            });
        }

        // Next month fill-in
        const totalCells = days.length;
        const nextMonthDays = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        for (let d = 1; d <= nextMonthDays; d++) {
            const nmDate = new Date(year, month + 1, d);
            const dateStr = nmDate.toISOString().split('T')[0];
            days.push({
                dayNum: d,
                dateStr,
                isCurrentMonth: false,
                isToday: false,
                schedules: [],
                makeups: []
            });
        }

        return days;
    }, [currentDate, batchSchedules, makeupSchedules]);

    const handlePrevMonth = () => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    const monthLabel = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    // Active direct messages for the selected chat partner
    const activeChatThread = useMemo(() => {
        if (!selectedChatPartner || !profile?.id) return [];
        return directMessages.filter(m => 
            (m.sender_id === profile.id && m.receiver_id === selectedChatPartner.id) ||
            (m.sender_id === selectedChatPartner.id && m.receiver_id === profile.id)
        );
    }, [directMessages, selectedChatPartner, profile]);

    // Send direct message handler
    const handleSendMsg = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || !selectedChatPartner) return;
        
        setSendingMsg(true);
        try {
            await onSendDirectMessage(selectedChatPartner.id, chatInput.trim());
            setChatInput('');
        } catch (e) {
            console.error(e);
        } finally {
            setSendingMsg(false);
        }
    };

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

                {/* Sub Tab Navigation */}
                <div className="flex gap-2 border-t border-slate-100 dark:border-slate-800 mt-6 pt-5">
                    {[
                        { id: 'calendar', label: 'Class Calendar', icon: Calendar },
                        { id: 'logs', label: 'Class logs & Presence', icon: Clock },
                        { id: 'chat', label: 'Class Roster & Chat', icon: MessageSquare }
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
                    <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col">
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
                                const hasEvents = cell.schedules.length > 0 || cell.makeups.length > 0;
                                const regularClass = cell.schedules[0];
                                const makeupClass = cell.makeups[0];
                                
                                return (
                                    <div 
                                        key={idx}
                                        className={`min-h-[75px] p-2 border border-slate-100 dark:border-slate-805 rounded-xl flex flex-col justify-between text-left transition-all ${
                                            cell.isCurrentMonth 
                                                ? 'bg-white dark:bg-slate-900' 
                                                : 'bg-slate-50/50 dark:bg-slate-950/20 text-slate-400 opacity-40'
                                        } ${cell.isToday ? 'ring-2 ring-amber-500 dark:ring-amber-400' : ''}`}
                                    >
                                        <span className={`text-[10px] font-bold ${cell.isToday ? 'text-amber-600 dark:text-amber-400 font-extrabold' : 'text-slate-400 dark:text-slate-500'}`}>
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
                                                        <p className="text-[10px] text-slate-500 mt-0.5 italic">Reason: {o.reason || 'Temporary makeup allocation'}</p>
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

            {subTab === 'chat' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
                    {/* Class Contacts Roster */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col max-h-[600px]">
                        <h3 className="font-extrabold text-slate-808 dark:text-white text-base mb-1">Class Members</h3>
                        <p className="text-xs text-slate-455 mb-4">Select a classmate or teacher to start a message thread</p>

                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar text-left">
                            {/* Teacher Entry */}
                            {classroom?.teacher_id && (
                                <button
                                    onClick={() => setSelectedChatPartner({
                                        id: classroom.teacher_id!,
                                        name: classroom.teacher_name || 'Academy Instructor',
                                        isTeacher: true
                                    })}
                                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${
                                        selectedChatPartner?.id === classroom.teacher_id
                                            ? 'border-[#7C5E3F] bg-[#FAF5EE] dark:border-amber-400 dark:bg-slate-800'
                                            : 'border-slate-100 hover:border-slate-202 dark:border-slate-805 hover:bg-slate-50/50 dark:hover:bg-slate-850/50'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-[#ecb613] shrink-0 font-bold">
                                            {classroom.teacher_name?.charAt(0) || 'T'}
                                        </div>
                                        <div className="min-w-0 text-left">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <h4 className="font-black text-xs text-slate-808 dark:text-white leading-none">{classroom.teacher_name}</h4>
                                                <span className="text-[8px] font-black bg-[#7C5E3F] dark:bg-amber-400 text-white dark:text-slate-950 px-1.5 py-0.2 rounded uppercase tracking-wider shrink-0">Teacher</span>
                                            </div>
                                            <p className="text-[10px] text-slate-455 mt-1 truncate">{classroom.teacher_email}</p>
                                        </div>
                                    </div>
                                    <MessageSquare className="w-4 h-4 text-[#7C5E3F] dark:text-amber-400 shrink-0" />
                                </button>
                            )}

                            {/* Classmates */}
                            {classmates.length === 0 ? (
                                <p className="text-xs text-slate-400 italic text-center py-6">You have no classmates in this batch yet.</p>
                            ) : (
                                classmates.map((mate) => (
                                    <button
                                        key={mate.id}
                                        onClick={() => setSelectedChatPartner({
                                            id: mate.id,
                                            name: mate.name,
                                            isTeacher: false
                                        })}
                                        className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${
                                            selectedChatPartner?.id === mate.id
                                                ? 'border-[#7C5E3F] bg-[#FAF5EE] dark:border-amber-400 dark:bg-slate-800'
                                                : 'border-slate-100 hover:border-slate-202 dark:border-slate-850 hover:bg-slate-50/50 dark:hover:bg-slate-850/50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-slate-105 dark:bg-slate-800 overflow-hidden flex items-center justify-center shrink-0 border border-slate-150 shadow-2xs font-extrabold text-slate-600">
                                                {mate.profile_pic_url ? (
                                                    <img src={mate.profile_pic_url} alt={mate.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span>{mate.name.charAt(0)}</span>
                                                )}
                                            </div>
                                            <div className="min-w-0 text-left">
                                                <h4 className="font-extrabold text-xs text-slate-800 dark:text-white leading-none">{mate.name}</h4>
                                                <span className="inline-block text-[9px] font-semibold text-slate-455 mt-1">{mate.level}</span>
                                            </div>
                                        </div>
                                        <MessageSquare className="w-4 h-4 text-[#7C5E3F] dark:text-amber-400 shrink-0" />
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Chat Messages Workspace */}
                    <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col h-[600px]">
                        {selectedChatPartner ? (
                            <>
                                {/* Workspace Header */}
                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4 flex-shrink-0 text-left">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-slate-105 dark:bg-slate-800 overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-700 text-slate-655 font-black shrink-0">
                                            {selectedChatPartner.isTeacher ? (
                                                <span className="text-[#ecb613]">T</span>
                                            ) : (
                                                <span>{selectedChatPartner.name.charAt(0)}</span>
                                            )}
                                        </div>
                                        <div className="min-w-0 text-left">
                                            <h4 className="font-extrabold text-sm text-slate-908 dark:text-white leading-tight truncate">{selectedChatPartner.name}</h4>
                                            <p className="text-[10px] text-slate-455 font-mono uppercase tracking-wider mt-0.5">
                                                {selectedChatPartner.isTeacher ? 'Academy Instructor' : 'Class Partner'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Messages History View */}
                                <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 py-1 custom-scrollbar text-left flex flex-col">
                                    {activeChatThread.length === 0 ? (
                                        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-2">
                                            <MessageSquare className="w-8 h-8 text-slate-300 animate-pulse" />
                                            <p className="text-xs font-bold text-slate-500">No message history yet.</p>
                                            <p className="text-[10px] text-slate-400 max-w-[200px] leading-relaxed">
                                                Send a message below to start your conversation.
                                            </p>
                                        </div>
                                    ) : (
                                        activeChatThread.map((msg) => {
                                            const isMe = msg.sender_id === profile?.id;
                                            return (
                                                <div 
                                                    key={msg.id} 
                                                    className={`max-w-[80%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                                                        isMe 
                                                            ? 'bg-[#7C5E3F] text-white self-end rounded-br-none shadow-sm' 
                                                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-205 self-start rounded-bl-none border border-slate-100 dark:border-slate-750'
                                                    }`}
                                                >
                                                    <p className="whitespace-pre-wrap text-left select-text">{msg.message_text}</p>
                                                    <span className={`block text-[8px] mt-1.5 text-right font-medium ${isMe ? 'text-amber-50/60' : 'text-slate-400'}`}>
                                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Send Input Form */}
                                <form onSubmit={handleSendMsg} className="flex gap-2 border-t border-slate-100 dark:border-slate-800 pt-4 flex-shrink-0">
                                    <input
                                        type="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        placeholder={`Message ${selectedChatPartner.name}...`}
                                        required
                                        className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#7C5E3F] outline-none text-slate-850 dark:text-slate-100 transition-all"
                                    />
                                    <button
                                        type="submit"
                                        disabled={sendingMsg || !chatInput.trim()}
                                        className="p-2.5 rounded-xl bg-[#7C5E3F] hover:bg-[#634a31] text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md cursor-pointer flex items-center justify-center shrink-0"
                                    >
                                        {sendingMsg ? (
                                            <Loader2 className="w-4.5 h-4.5 animate-spin" />
                                        ) : (
                                            <Send className="w-4.5 h-4.5" />
                                        )}
                                    </button>
                                </form>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
                                <Users className="w-10 h-10 text-slate-300" />
                                <h4 className="font-extrabold text-sm text-slate-700 dark:text-slate-300">Select a Contact</h4>
                                <p className="text-xs text-slate-500 max-w-sm leading-normal">
                                    Select any classmate or instructor on the left panel to display message histories or send messages.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
