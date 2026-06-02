'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { Loader2, Plus, Users, Clock, ArrowRight, Lightbulb, Video, Search, ChevronLeft, ChevronRight, PlusCircle, Filter, Calendar, List, MapPin, Activity, Link as LinkIcon, Mic, Disc, Music } from 'lucide-react';
import Link from 'next/link';
import TeacherSidebar from '../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../src/components/TeacherHeader';

function formatTime12hr(time24: string) {
    if (!time24) return '';
    const [h, m] = time24.split(':');
    let hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hStr = hours.toString().padStart(2, '0');
    return `${hStr}:${m} ${ampm}`;
}

interface Classroom {
    id: string;
    name: string;
    description: string;
    schedule?: string;
    student_count: number;
    status: string;
    type?: 'permanent' | 'temporary';
    classroom_id?: string | null;
}


export default function ClassroomsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string } | null>(null);
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [tempClassrooms, setTempClassrooms] = useState<Classroom[]>([]);
    const [activeView, setActiveView] = useState<'today' | 'permanent' | 'temporary'>('today');
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [viewDate, setViewDate] = useState(new Date());
    const [searchQuery, setSearchQuery] = useState('');
    const [rawSchedules, setRawSchedules] = useState<any[]>([]);
    const [activeSession, setActiveSession] = useState<{ classroomId: string } | null>(null);

    useEffect(() => {
        const checkActiveSession = () => {
            if (typeof window !== 'undefined') {
                const sessionStr = localStorage.getItem('active_class_session');
                if (sessionStr) {
                    try {
                        const session = JSON.parse(sessionStr);
                        setActiveSession(session);
                    } catch (e) {
                        console.error(e);
                    }
                } else {
                    setActiveSession(null);
                }
            }
        };
        checkActiveSession();
        const interval = setInterval(checkActiveSession, 2000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (!session) {
                    router.push('/login?type=teacher');
                    return;
                }

                const { data: profile } = await supabaseAuth
                    .from('users')
                    .select('id, name, email')
                    .eq('id', session.user.id)
                    .single();
                setTeacherProfile(profile);

                if (!profile) return;

                const { data: roomsData, error: roomsError } = await supabaseAuth
                    .from('classrooms')
                    .select('*')
                    .eq('teacher_id', profile.id);

                if (roomsError) throw roomsError;

                // Fetch batch schedules for all classrooms
                const roomIds = (roomsData || []).map(r => r.id);
                const { data: allSchedules } = roomIds.length > 0
                    ? await supabaseAuth.from('batch_schedules').select('classroom_id, day_of_week, start_time, end_time').in('classroom_id', roomIds)
                    : { data: [] };

                setRawSchedules(allSchedules || []);

                const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const scheduleMap: Record<string, string> = {};
                if (allSchedules) {
                    const grouped: Record<string, typeof allSchedules> = {};
                    allSchedules.forEach(s => {
                        if (!grouped[s.classroom_id]) grouped[s.classroom_id] = [];
                        grouped[s.classroom_id].push(s);
                    });
                    for (const [cid, entries] of Object.entries(grouped)) {
                        const days = Array.from(new Set(entries.map(e => DAY_SHORT[e.day_of_week]))).join(', ');
                        
                        // Just take the first timing range for the summary view
                        const first = entries[0];
                        if (first) {
                            const startStr = formatTime12hr(first.start_time.slice(0, 5));
                            const endStr = formatTime12hr(first.end_time.slice(0, 5));
                            scheduleMap[cid] = `${days} • ${startStr} - ${endStr}`;
                        } else {
                            scheduleMap[cid] = `${days}`;
                        }
                    }
                }

                const roomsWithCounts = await Promise.all((roomsData || []).map(async (room) => {
                    const { count } = await supabaseAuth
                        .from('classroom_students')
                        .select('*', { count: 'exact', head: true })
                        .eq('classroom_id', room.id);

                    return {
                        ...room,
                        schedule: scheduleMap[room.id] || room.schedule || 'No schedule set',
                        student_count: count || 0,
                        status: 'Active',
                        type: 'permanent' as const
                    };
                }));

                setClassrooms(roomsWithCounts);

                // Fetch Temporary Classes
                const { data: tempRoomsData } = await supabaseAuth
                    .from('temporary_classes')
                    .select('*')
                    .eq('teacher_id', profile.id)
                    .order('class_date', { ascending: false });
                
                const tempRoomsWithCounts = await Promise.all((tempRoomsData || []).map(async (room) => {
                    const { count } = await supabaseAuth
                        .from('temporary_class_students')
                        .select('*', { count: 'exact', head: true })
                        .eq('temporary_class_id', room.id);

                    return {
                        id: room.id,
                        name: room.title || 'Temporary Class',
                        description: `Temporary Session on ${room.class_date}`,
                        schedule: `${new Date(room.class_date).toLocaleDateString('en-US', {weekday:'short'})} • ${formatTime12hr(room.start_time.slice(0,5))} - ${formatTime12hr(room.end_time.slice(0,5))}`,
                        student_count: count || 0,
                        status: 'Active',
                        class_date: room.class_date,
                        classroom_id: room.classroom_id,
                        start_time: room.start_time,
                        end_time: room.end_time,
                        type: 'temporary' as const
                    };
                }));
                
                setTempClassrooms(tempRoomsWithCounts);

            } catch (err) {
                console.error('Error fetching classrooms:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [router]);

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    const formatDate = (date: Date) => {
        const d = new Date(date);
        let month = '' + (d.getMonth() + 1);
        let day = '' + d.getDate();
        const year = d.getFullYear();

        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;

        return [year, month, day].join('-');
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const days = [];
        for (let i = 0; i < firstDay; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
        return days;
    };

    const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));

    const scheduledDatesSet = React.useMemo(() => {
        const scheduledDaysOfWeek = new Set(rawSchedules.map(s => s.day_of_week));
        const tempDates = new Set(tempClassrooms.map(tc => (tc as any).class_date));
        return { scheduledDaysOfWeek, tempDates };
    }, [rawSchedules, tempClassrooms]);

    const hasClassesOnDate = React.useCallback((dateStr: string) => {
        const dateObj = new Date(dateStr);
        const dayOfWeek = dateObj.getDay();
        return scheduledDatesSet.scheduledDaysOfWeek.has(dayOfWeek) || scheduledDatesSet.tempDates.has(dateStr);
    }, [scheduledDatesSet]);

    const getClassesForDate = React.useCallback((dateStr: string) => {
        if (!dateStr) return [];
        const dateObj = new Date(dateStr);
        const dayOfWeek = dateObj.getDay();

        // Filter permanent classes with matching day_of_week
        const matchingSchedules = rawSchedules.filter(s => s.day_of_week === dayOfWeek);
        const activePermanent = matchingSchedules.map(s => {
            const room = classrooms.find(c => c.id === s.classroom_id);
            if (!room) return null;
            return {
                ...room,
                type: 'permanent' as const,
                displayTime: `${formatTime12hr(s.start_time.slice(0, 5))} - ${formatTime12hr(s.end_time.slice(0, 5))}`,
                start_time: s.start_time,
                end_time: s.end_time
            };
        }).filter(Boolean);

        // Filter temporary classes with matching class_date
        const activeTemporary = tempClassrooms.filter(tc => (tc as any).class_date === dateStr).map(tc => ({
            ...tc,
            type: 'temporary' as const,
            displayTime: tc.schedule ? (tc.schedule.includes('•') ? tc.schedule.split('•')[1]?.trim() : tc.schedule) : '',
            start_time: (tc as any).start_time,
            end_time: (tc as any).end_time
        }));

        const combined = [...activePermanent, ...activeTemporary] as any[];
        combined.sort((a, b) => {
            const timeA = a.start_time || '00:00:00';
            const timeB = b.start_time || '00:00:00';
            return timeA.localeCompare(timeB);
        });
        return combined;
    }, [rawSchedules, classrooms, tempClassrooms]);

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8f8f6]">
                <Loader2 className="w-10 h-10 animate-spin text-[#ecb613] mb-4" />
                <p className="font-medium text-slate-600 tracking-wide uppercase text-xs">Loading Classrooms...</p>
            </div>
        );
    }

    const todayStr = new Date().toISOString().split('T')[0];
    let displayedClassrooms = activeView === 'today' 
        ? getClassesForDate(todayStr) 
        : (activeView === 'permanent' ? classrooms : tempClassrooms);

    if (searchQuery.trim() !== '') {
        const lowerQ = searchQuery.toLowerCase();
        displayedClassrooms = displayedClassrooms.filter(room => 
            room.name.toLowerCase().includes(lowerQ) || 
            (room.description && room.description.toLowerCase().includes(lowerQ))
        );
    }

    return (
        <div className="flex min-h-screen bg-[#f8f8f6] dark:bg-[#221d10] text-[#0f172a] dark:text-slate-100 font-sans">
            <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

            <main className="flex-1 flex flex-col min-w-0">
                {/* TopAppBar */}
                <header className="sticky top-0 z-40 flex justify-between items-center px-8 h-16 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-4 flex-1">
                        <div className="relative w-full max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
                            <input 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-full text-sm focus:ring-2 focus:ring-[#fef3c7]" 
                                placeholder="Search classes, students..." 
                                type="text"
                            />
                        </div>
                    </div>
                </header>

                <div className="p-8 max-w-7xl mx-auto w-full flex-1 overflow-y-auto">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                        <div>
                            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">Classroom Management</h1>
                            <p className="text-slate-500 dark:text-slate-400 font-medium">Manage your active music sessions, schedules, and student enrollment.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Link href="/teacher-dashboard/classrooms/add">
                                <button className="flex items-center gap-2 px-6 py-2.5 bg-[#ecb613] text-slate-900 font-bold rounded-xl shadow-sm hover:shadow-md transition-all">
                                    <PlusCircle className="size-5" />
                                    Configure New Class
                                </button>
                            </Link>
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-full md:w-auto">
                            {viewMode === 'list' ? (
                                <>
                                    <button 
                                        onClick={() => setActiveView('today')}
                                        className={`px-6 py-2 text-sm font-bold rounded-lg shadow-sm w-full md:w-auto transition-colors ${activeView === 'today' ? 'bg-white dark:bg-slate-700 text-[#451a03] dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 bg-transparent shadow-none'}`}
                                    >
                                        Today's Classes
                                    </button>
                                    <button 
                                        onClick={() => setActiveView('permanent')}
                                        className={`px-6 py-2 text-sm font-bold rounded-lg shadow-sm w-full md:w-auto transition-colors ${activeView === 'permanent' ? 'bg-white dark:bg-slate-700 text-[#451a03] dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 bg-transparent shadow-none'}`}
                                    >
                                        Permanent Classes
                                    </button>
                                    <button 
                                        onClick={() => setActiveView('temporary')}
                                        className={`px-6 py-2 text-sm font-bold rounded-lg shadow-sm w-full md:w-auto transition-colors ${activeView === 'temporary' ? 'bg-white dark:bg-slate-700 text-[#451a03] dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 bg-transparent shadow-none'}`}
                                    >
                                        Temporary Sessions
                                    </button>
                                </>
                            ) : (
                                <div className="px-4 py-2 text-sm font-extrabold text-[#92400e] dark:text-[#ecb613] flex items-center gap-2">
                                    <Calendar className="size-4" />
                                    <span>Interactive Schedule Calendar</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative flex-1 md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
                                <input 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#fef3c7]" 
                                    placeholder="Find by name..." 
                                    type="text"
                                />
                            </div>
                            <div className="inline-flex rounded-lg shadow-sm bg-white dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-800 h-[38px]">
                                <button 
                                    onClick={() => setViewMode('list')}
                                    className={`px-3 py-1 text-sm rounded-md flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-[#fef3c7] dark:bg-[#ecb613]/20 text-[#92400e] dark:text-[#ecb613] font-bold' : 'text-slate-400 hover:text-slate-600 dark:hover:text-[#ecb613] bg-transparent'}`}
                                    title="List View"
                                >
                                    <List className="size-4" />
                                </button>
                                <button 
                                    onClick={() => setViewMode('calendar')}
                                    className={`px-3 py-1 text-sm rounded-md flex items-center justify-center transition-colors ${viewMode === 'calendar' ? 'bg-[#fef3c7] dark:bg-[#ecb613]/20 text-[#92400e] dark:text-[#ecb613] font-bold' : 'text-slate-400 hover:text-slate-600 dark:hover:text-[#ecb613] bg-transparent'}`}
                                    title="Calendar View"
                                >
                                    <Calendar className="size-4" />
                                </button>
                            </div>
                            <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors h-[38px]">
                                <Filter className="size-4" />
                                Filter
                            </button>
                        </div>
                    </div>

                    {viewMode === 'calendar' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12 animate-fadeIn">
                            {/* Calendar Card (Left) */}
                            <div className="col-span-12 lg:col-span-4 space-y-4">
                                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="font-extrabold text-slate-900 dark:text-white tracking-tight">
                                            {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                        </h4>
                                        <div className="flex gap-1">
                                            <button onClick={prevMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"><ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" /></button>
                                            <button onClick={nextMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"><ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" /></button>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-7 gap-1 text-center mb-4">
                                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                                            <div key={day} className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{day}</div>
                                        ))}
                                    </div>
                                    
                                    <div className="grid grid-cols-7 gap-1">
                                        {getDaysInMonth(viewDate).map((day, idx) => {
                                            if (!day) return <div key={`empty-${idx}`} className="aspect-square" />;
                                            
                                            const dateStr = formatDate(day);
                                            const isSelected = selectedDate === dateStr;
                                            const hasClasses = hasClassesOnDate(dateStr);
                                            
                                            return (
                                                <div key={dateStr} className="flex flex-col items-center justify-center">
                                                    <button 
                                                        onClick={() => setSelectedDate(dateStr)}
                                                        className={`aspect-square w-full flex items-center justify-center text-xs font-bold rounded-xl transition-all relative ${
                                                            isSelected
                                                            ? 'bg-[#ecb613] text-slate-900 shadow-md shadow-[#ecb613]/25 font-black scale-105'
                                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                                                        }`}
                                                    >
                                                        {day.getDate()}
                                                        {hasClasses && !isSelected && (
                                                            <span className="absolute bottom-1 w-1.5 h-1.5 bg-[#ecb613] rounded-full"></span>
                                                        )}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                
                                <div className="bg-[#ecb613]/10 dark:bg-[#ecb613]/5 p-5 rounded-2xl border border-[#ecb613]/20 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                                        <Lightbulb className="w-16 h-16 text-[#ecb613]" />
                                    </div>
                                    <h4 className="font-black text-[#ecb613] mb-3 flex items-center gap-2 tracking-tight">
                                        <Lightbulb className="w-5 h-5" />
                                        Calendar Schedule View
                                    </h4>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                                        Select a date on the calendar to view all permanent recurring and temporary sessions scheduled for that day.
                                    </p>
                                </div>
                            </div>

                            {/* Classes List (Right) */}
                            <div className="col-span-12 lg:col-span-8 space-y-4">
                                <div className="flex items-center justify-between px-2">
                                    <h3 className="font-extrabold text-slate-900 dark:text-white text-lg tracking-tight">
                                        Classes on {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                    </h3>
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                                        {getClassesForDate(selectedDate).length} Scheduled
                                    </span>
                                </div>

                                <div className="space-y-4">
                                    {getClassesForDate(selectedDate).map((room, idx) => {
                                        const iconColors = [
                                            { bg: 'bg-[#fef3c7]/60 dark:bg-[#ecb613]/20', text: 'text-[#ecb613]', icon: Music },
                                            { bg: 'bg-blue-100/30 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', icon: Activity },
                                            { bg: 'bg-orange-100/30 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', icon: Mic },
                                            { bg: 'bg-purple-100/30 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', icon: Disc }
                                        ];
                                        const styleConfig = iconColors[idx % iconColors.length];
                                        const IconComponent = styleConfig.icon;
                                        const isOngoing = activeSession && activeSession.classroomId === room.id;

                                        return (
                                            <div key={`${room.id}-${idx}`} className={`p-6 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group ${
                                                isOngoing
                                                    ? 'bg-rose-50/15 dark:bg-rose-950/10 border-rose-250 dark:border-rose-800 shadow-md shadow-rose-500/5'
                                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md'
                                            }`}>
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-xl ${styleConfig.bg} flex items-center justify-center ${styleConfig.text}`}>
                                                        <IconComponent className="size-6" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <Link href={room.type === 'permanent' ? `/teacher-dashboard/classrooms/${room.id}` : `/teacher-dashboard/classrooms/temp/${room.id}`} className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-[#ecb613] transition-colors">
                                                                {room.name}
                                                            </Link>
                                                            {isOngoing && (
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-500 text-white tracking-wider animate-pulse shadow-md shadow-rose-500/25">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                                                                    Live Session
                                                                </span>
                                                            )}
                                                            {room.type === 'temporary' ? (
                                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                                                    Temporary
                                                                </span>
                                                            ) : (
                                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                                    Permanent
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{room.description}</p>
                                                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                                                            <span className="flex items-center gap-1"><Users className="size-4 text-slate-400" /> {room.student_count} Enrolled</span>
                                                            <span className="flex items-center gap-1"><Clock className="size-4 text-slate-400" /> {room.displayTime}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 self-end md:self-auto">
                                                    <Link href={room.type === 'permanent' ? `/teacher-dashboard/classrooms/${room.id}` : `/teacher-dashboard/classrooms/temp/${room.id}`}>
                                                        <button className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm">
                                                            Manage
                                                        </button>
                                                    </Link>
                                                    {isOngoing ? (
                                                        <Link href={`/teacher-dashboard/classrooms/${room.type === 'permanent' ? room.id : (room.classroom_id || room.id)}/meeting`}>
                                                            <button className="px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-extrabold rounded-lg transition-all shadow-lg shadow-rose-500/25 flex items-center gap-1.5 animate-pulse">
                                                                <Activity className="size-3.5 animate-spin" />
                                                                Resume
                                                            </button>
                                                        </Link>
                                                    ) : (
                                                        <Link href={`/teacher-dashboard/classrooms/${room.type === 'permanent' ? room.id : (room.classroom_id || room.id)}/meeting`}>
                                                            <button className="px-4 py-2.5 bg-[#0d5a5e] text-white text-xs font-bold rounded-lg hover:bg-[#115e59] transition-colors shadow-sm">
                                                                Start
                                                            </button>
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {getClassesForDate(selectedDate).length === 0 && (
                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
                                            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-4">
                                                <Calendar className="size-8 text-amber-500 animate-bounce" />
                                            </div>
                                            <p className="text-lg font-bold text-slate-900 dark:text-white">No classes scheduled</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                                                There are no classes scheduled for this date. Select another day or configure a temporary class.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Stats Overview */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4">
                                        <Users className="size-6" />
                                    </div>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Total Students</p>
                                    <p className="text-2xl font-black text-slate-900 dark:text-white">{displayedClassrooms.reduce((acc, r) => acc + r.student_count, 0)}</p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4">
                                        <Video className="size-6" />
                                    </div>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Online Classes</p>
                                    <p className="text-2xl font-black text-slate-900 dark:text-white">0</p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4">
                                        <MapPin className="size-6" />
                                    </div>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Offline Classes</p>
                                    <p className="text-2xl font-black text-slate-900 dark:text-white">{displayedClassrooms.length}</p>
                                </div>
                                <div className="bg-[#ecb613] p-6 rounded-2xl border border-[#ecb613] shadow-sm hover:shadow-md transition-shadow text-slate-900">
                                    <div className="w-12 h-12 rounded-xl bg-white/30 flex items-center justify-center text-slate-900 mb-4">
                                        <Clock className="size-6" />
                                    </div>
                                    <p className="text-slate-900/80 text-sm font-medium mb-1">Total Classes</p>
                                    <p className="text-2xl font-black">{displayedClassrooms.length}</p>
                                </div>
                            </div>

                            {/* Class Management List Table */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md mb-10">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse min-w-[800px]">
                                        <thead>
                                            <tr className="bg-slate-100/50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                                <th className="px-6 py-4 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Class Name</th>
                                                <th className="px-6 py-4 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Enrollment</th>
                                                <th className="px-6 py-4 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Schedule</th>
                                                <th className="px-6 py-4 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
                                                <th className="px-6 py-4 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                            {displayedClassrooms.map((room, idx) => {
                                                const iconColors = [
                                                    { bg: 'bg-[#fef3c7]/60 dark:bg-[#ecb613]/20', text: 'text-[#ecb613]', icon: Music },
                                                    { bg: 'bg-blue-100/30 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', icon: Activity },
                                                    { bg: 'bg-orange-100/30 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', icon: Mic },
                                                    { bg: 'bg-purple-100/30 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', icon: Disc }
                                                ];
                                                const styleConfig = iconColors[idx % iconColors.length];
                                                const IconComponent = styleConfig.icon;
                                                const isOnline = idx % 2 !== 0;

                                                const mockTime = room.schedule && room.schedule.includes('•') ? room.schedule.split('•') : [room.schedule || 'Days Not Set', '09:00 AM - 10:30 AM'];
                                                const days = mockTime[0]?.trim() || 'Mon, Wed';
                                                const times = mockTime[1]?.trim() || '10:00 AM - 11:30 AM';
                                                const isOngoing = activeSession && activeSession.classroomId === room.id;

                                                return (
                                                    <tr key={room.id} className={`transition-colors group border-b border-slate-100 dark:border-slate-800/50 ${
                                                        isOngoing
                                                            ? 'bg-rose-50/15 dark:bg-rose-950/10 hover:bg-rose-50/20 dark:hover:bg-rose-950/15'
                                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 even:bg-slate-50/30 dark:even:bg-slate-800/20'
                                                    }`}>
                                                        <td className="px-6 py-6">
                                                            <div className="flex items-center gap-4">
                                                                <div className={`w-10 h-10 rounded-lg ${styleConfig.bg} flex items-center justify-center ${styleConfig.text}`}>
                                                                    <IconComponent className="size-5" />
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <Link href={room.type === 'permanent' ? `/teacher-dashboard/classrooms/${room.id}` : `/teacher-dashboard/classrooms/temp/${room.id}`} className="font-bold text-slate-900 dark:text-white group-hover:text-[#ecb613] transition-colors">
                                                                            {room.name}
                                                                        </Link>
                                                                        {isOngoing && (
                                                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-500 text-white tracking-wider animate-pulse shadow-md shadow-rose-500/25">
                                                                                <span className="w-1 h-1 rounded-full bg-white animate-ping"></span>
                                                                                Live Session
                                                                            </span>
                                                                        )}
                                                                        {room.type === 'temporary' ? (
                                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400 tracking-wider">
                                                                                ⚡ Temporary
                                                                            </span>
                                                                        ) : (
                                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400 tracking-wider">
                                                                                👥 Permanent
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">ID: {room.id.substring(0, 8).toUpperCase()}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-6">
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex -space-x-2">
                                                                    <div className="size-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 bg-cover bg-center" style={{ backgroundImage: "url('https://avatar.iran.liara.run/public/boy')" }}></div>
                                                                    <div className="size-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 bg-cover bg-center" style={{ backgroundImage: "url('https://avatar.iran.liara.run/public/girl')" }}></div>
                                                                    <div className="size-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                                                        +{room.student_count > 2 ? room.student_count - 2 : 0}
                                                                    </div>
                                                                </div>
                                                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">{room.student_count} Enrolled</p>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-6">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-bold text-slate-900 dark:text-white">{days}</span>
                                                                <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-0.5 rounded-full inline-block w-fit mt-1">
                                                                    {times}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-6">
                                                            {isOnline ? (
                                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                                                    Online
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                                    Offline
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-6 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <Link href={room.type === 'permanent' ? `/teacher-dashboard/classrooms/${room.id}` : `/teacher-dashboard/classrooms/temp/${room.id}`}>
                                                                    <button className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm">
                                                                        Manage
                                                                    </button>
                                                                </Link>
                                                                {isOngoing ? (
                                                                    <Link href={`/teacher-dashboard/classrooms/${room.type === 'permanent' ? room.id : (room.classroom_id || room.id)}/meeting`}>
                                                                        <button className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-extrabold rounded-lg transition-all shadow-lg shadow-rose-500/25 flex items-center gap-1.5 animate-pulse">
                                                                            <Activity className="size-3.5 animate-spin" />
                                                                            Resume
                                                                        </button>
                                                                    </Link>
                                                                ) : (
                                                                    <Link href={`/teacher-dashboard/classrooms/${room.type === 'permanent' ? room.id : (room.classroom_id || room.id)}/meeting`}>
                                                                        <button className="px-4 py-2 bg-[#0d5a5e] text-white text-xs font-bold rounded-lg hover:bg-[#115e59] transition-colors shadow-sm">
                                                                            Start
                                                                        </button>
                                                                    </Link>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {displayedClassrooms.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-12 text-center">
                                                        {activeView === 'today' ? (
                                                            <div className="flex flex-col items-center justify-center py-6">
                                                                <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center text-[#ecb613] mb-3">
                                                                    <Calendar className="size-8 animate-pulse" />
                                                                </div>
                                                                <p className="text-base font-extrabold text-slate-900 dark:text-white">No class today</p>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Enjoy your day or configure a temporary session!</p>
                                                            </div>
                                                        ) : (
                                                            <p className="text-slate-500 py-6">No classes found. Click "Configure New Class" to get started.</p>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800/30 px-6 py-4 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
                                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Showing {displayedClassrooms.length} classes</p>
                                    <div className="flex gap-2">
                                        <button className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 transition-colors text-slate-500" disabled>
                                            <ChevronLeft className="size-4" />
                                        </button>
                                        <button className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-colors text-slate-500">
                                            <ChevronRight className="size-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Recent Activity / Classroom Insights Section */}
                            <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                                <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Weekly Class Utilization</h3>
                                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400 px-3 py-1 bg-amber-50 dark:bg-amber-900/20 rounded-full">Report</span>
                                    </div>
                                    <div className="h-64 flex items-end justify-between gap-4 px-2">
                                        <div className="flex-1 flex flex-col items-center gap-2">
                                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-t-lg relative h-48 overflow-hidden group">
                                                <div className="absolute bottom-0 w-full bg-[#ecb613] h-[60%] rounded-t-lg group-hover:opacity-80 transition-opacity"></div>
                                            </div>
                                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Mon</span>
                                        </div>
                                        <div className="flex-1 flex flex-col items-center gap-2">
                                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-t-lg relative h-48 overflow-hidden group">
                                                <div className="absolute bottom-0 w-full bg-[#ecb613] h-[85%] rounded-t-lg group-hover:opacity-80 transition-opacity"></div>
                                            </div>
                                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Tue</span>
                                        </div>
                                        <div className="flex-1 flex flex-col items-center gap-2">
                                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-t-lg relative h-48 overflow-hidden group">
                                                <div className="absolute bottom-0 w-full bg-[#ecb613] h-[45%] rounded-t-lg group-hover:opacity-80 transition-opacity"></div>
                                            </div>
                                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Wed</span>
                                        </div>
                                        <div className="flex-1 flex flex-col items-center gap-2">
                                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-t-lg relative h-48 overflow-hidden group">
                                                <div className="absolute bottom-0 w-full bg-[#ecb613] h-[95%] rounded-t-lg group-hover:opacity-80 transition-opacity"></div>
                                            </div>
                                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Thu</span>
                                        </div>
                                        <div className="flex-1 flex flex-col items-center gap-2">
                                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-t-lg relative h-48 overflow-hidden group">
                                                <div className="absolute bottom-0 w-full bg-[#ecb613] h-[70%] rounded-t-lg group-hover:opacity-80 transition-opacity"></div>
                                            </div>
                                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Fri</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-[#f8f8f6] dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Instructor To-Do</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 cursor-pointer hover:border-[#ecb613] transition-colors">
                                            <div className="mt-1">
                                                <div className="w-5 h-5 rounded-md border-2 border-[#fef3c7] dark:border-[#ecb613]/50 flex items-center justify-center"></div>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 dark:text-white">Review Piano Exam Recitals</p>
                                                <p className="text-xs text-slate-500 font-medium mt-0.5">Due today, 5:00 PM</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 cursor-pointer hover:border-[#ecb613] transition-colors">
                                            <div className="mt-1">
                                                <div className="w-5 h-5 rounded-md border-2 border-[#fef3c7] dark:border-[#ecb613]/50 flex items-center justify-center"></div>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 dark:text-white">Update Flute Theory Syllabus</p>
                                                <p className="text-xs text-slate-500 font-medium mt-0.5">Due tomorrow</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3 p-3 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-[#ecb613] transition-colors cursor-pointer group">
                                            <button className="w-full flex items-center justify-center gap-2 py-1 text-slate-500 group-hover:text-[#ecb613] text-xs font-bold transition-colors">
                                                <Plus className="size-4" />
                                                Add Quick Task
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-8 rounded-xl overflow-hidden bg-slate-900 relative">
                                        <div className="absolute inset-0 bg-[#ecb613]/20 mix-blend-overlay"></div>
                                        <img alt="Music background" className="w-full h-24 object-cover grayscale opacity-50 contrast-125 hover:scale-105 transition-transform duration-700" src="https://images.unsplash.com/photo-1511192336575-5a79af67a629?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"/>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}
