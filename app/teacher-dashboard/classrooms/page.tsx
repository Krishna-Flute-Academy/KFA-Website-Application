'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { Loader2, Plus, Users, Clock, ArrowRight, Lightbulb, Video, Search, ChevronLeft, ChevronRight, PlusCircle, Filter, Calendar, List, MapPin, Activity, Link as LinkIcon, Mic, Disc, Music, Trash2, Check, Info } from 'lucide-react';
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
    return `${hours}:${m} ${ampm}`;
}

function parseClassDate(dateStr?: string): Date | null {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    const yr = parseInt(parts[0], 10);
    const mo = parseInt(parts[1], 10);
    const dy = parseInt(parts[2], 10);
    if (isNaN(yr) || isNaN(mo) || isNaN(dy)) return null;
    return new Date(yr, mo - 1, dy);
}

function calculateDuration(startTime: string, endTime: string) {
    if (!startTime || !endTime) return '';
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return '';
    let diffMins = (eh * 60 + em) - (sh * 60 + sm);
    if (diffMins < 0) diffMins += 24 * 60; // handle overnight transition
    
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    
    if (hrs > 0) {
        return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
    }
    return `${mins} mins`;
}

function getCleanDescription(desc: string) {
    if (!desc) return '';
    return desc
        .replace(/\[delivery_format:(online|offline)\]/g, '')
        .replace(/\[class_logs:[\s\S]*?\]/g, '')
        .trim();
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
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string; role?: string } | null>(null);
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [tempClassrooms, setTempClassrooms] = useState<Classroom[]>([]);
    const [activeView, setActiveView] = useState<'today' | 'permanent' | 'temporary' | 'all' | 'inactive'>('today');
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [viewDate, setViewDate] = useState(new Date());
    const [searchQuery, setSearchQuery] = useState('');
    const [rawSchedules, setRawSchedules] = useState<any[]>([]);
    const [activeSession, setActiveSession] = useState<{ classroomId: string } | null>(null);
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [formatFilter, setFormatFilter] = useState<'all' | 'online' | 'offline'>('all');
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);

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

    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isDeletingMultiple, setIsDeletingMultiple] = useState(false);

    // Auto-dismiss toast notification after 3 seconds
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const handleDeleteClassroom = async (room: any) => {
        const confirmMsg = `Are you sure you want to delete the ${room.type === 'permanent' ? 'permanent class' : 'temporary session'} "${room.name}"? This will permanently delete the class and all associated data.`;
        if (!window.confirm(confirmMsg)) return;

        setIsDeletingId(room.id);
        try {
            const table = room.type === 'permanent' ? 'classrooms' : 'temporary_classes';
            const { error } = await supabaseAuth
                .from(table)
                .delete()
                .eq('id', room.id);

            if (error) throw error;

            // Remove from local state
            if (room.type === 'permanent') {
                setClassrooms(prev => prev.filter(c => c.id !== room.id));
            } else {
                setTempClassrooms(prev => prev.filter(c => c.id !== room.id));
            }

            setToast({
                type: 'success',
                message: `Classroom "${room.name}" deleted successfully!`
            });
        } catch (err: any) {
            console.error('Error deleting classroom:', err);
            setToast({
                type: 'error',
                message: `Failed to delete classroom: ${err.message || err}`
            });
        } finally {
            setIsDeletingId(null);
        }
    };

    const handleDeleteMultiple = async () => {
        const count = selectedIds.length;
        if (count === 0) return;
        const confirmMsg = `Are you sure you want to delete the ${count} selected classrooms? This will permanently delete the classes and all associated schedule/student data.`;
        if (!window.confirm(confirmMsg)) return;

        setIsDeletingMultiple(true);
        try {
            // Find which selected IDs are permanent and which are temporary
            const permanentIds = classrooms.filter(c => selectedIds.includes(c.id)).map(c => c.id);
            const temporaryIds = tempClassrooms.filter(tc => selectedIds.includes(tc.id)).map(tc => tc.id);

            // Trigger deletes using Promise.all or direct queries
            if (permanentIds.length > 0) {
                const { error: permErr } = await supabaseAuth
                    .from('classrooms')
                    .delete()
                    .in('id', permanentIds);
                if (permErr) throw permErr;
            }

            if (temporaryIds.length > 0) {
                const { error: tempErr } = await supabaseAuth
                    .from('temporary_classes')
                    .delete()
                    .in('id', temporaryIds);
                if (tempErr) throw tempErr;
            }

            // Sync local React states
            setClassrooms(prev => prev.filter(c => !selectedIds.includes(c.id)));
            setTempClassrooms(prev => prev.filter(tc => !selectedIds.includes(tc.id)));

            setToast({
                type: 'success',
                message: `Successfully deleted ${count} classrooms!`
            });
            setSelectedIds([]);
        } catch (err: any) {
            console.error('Error deleting multiple classrooms:', err);
            setToast({
                type: 'error',
                message: `Failed to delete classrooms: ${err.message || err}`
            });
        } finally {
            setIsDeletingMultiple(false);
        }
    };

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
                    .select('id, name, email, role')
                    .eq('id', session.user.id)
                    .single();
                setTeacherProfile(profile);

                if (!profile) return;

                const isAdminUser = profile.role === 'admin';

                // Fetch all active teachers/admins to map their names in memory
                const { data: teachersData, error: teachersError } = await supabaseAuth
                    .from('users')
                    .select('id, name')
                    .in('role', ['teacher', 'admin']);
                if (teachersError) {
                    console.error('Error fetching teachersData for mapping:', teachersError);
                }
                const teacherMap: Record<string, string> = {};
                if (teachersData) {
                    teachersData.forEach(t => {
                        teacherMap[t.id] = t.name;
                    });
                }

                const classroomsQuery = supabaseAuth
                    .from('classrooms')
                    .select('*');

                const { data: roomsData, error: roomsError } = isAdminUser
                    ? await classroomsQuery
                    : await classroomsQuery.eq('teacher_id', profile.id);

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
                        teacher: room.teacher_id ? { name: teacherMap[room.teacher_id] } : null,
                        schedule: scheduleMap[room.id] || room.schedule || 'No schedule set',
                        student_count: count || 0,
                        status: room.status || 'Active',
                        type: room.type || 'permanent'
                    };
                }));

                setClassrooms(roomsWithCounts.filter(r => r.type === 'permanent'));

                // Fetch Temporary Classes
                const tempQuery = supabaseAuth
                    .from('temporary_classes')
                    .select('*')
                    .order('class_date', { ascending: false });

                const { data: tempRoomsData } = isAdminUser
                    ? await tempQuery
                    : await tempQuery.eq('teacher_id', profile.id);
                
                const tempRoomsWithCounts = await Promise.all((tempRoomsData || []).map(async (room) => {
                    const { count } = await supabaseAuth
                        .from('session_student_overrides')
                        .select('*', { count: 'exact', head: true })
                        .eq('target_classroom_id', room.classroom_id);

                    return {
                        id: room.id,
                        name: room.title || 'Temporary Class',
                        description: (roomsData || []).find(c => c.id === room.classroom_id)?.description || `Temporary Session on ${room.class_date}`,
                        schedule: (() => {
                            const parsed = parseClassDate(room.class_date);
                            const dayName = parsed ? parsed.toLocaleDateString('en-US', { weekday: 'short' }) : 'Invalid Date';
                            return `${dayName} • ${formatTime12hr(room.start_time.slice(0,5))} - ${formatTime12hr(room.end_time.slice(0,5))}`;
                        })(),
                        teacher: room.teacher_id ? { name: teacherMap[room.teacher_id] } : null,
                        student_count: count || 0,
                        status: (() => {
                            const shadowRoom = (roomsData || []).find(c => c.id === room.classroom_id);
                            return shadowRoom ? (shadowRoom.status || 'Active') : 'Active';
                        })(),
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
        let filteredPerm = classrooms;
        let filteredTemp = tempClassrooms;

        // Apply status filter / default active filtering
        if (statusFilter === 'all') {
            filteredPerm = filteredPerm.filter(room => {
                const status = (room.status || 'active').toLowerCase();
                return status !== 'inactive' && status !== 'archived';
            });
            filteredTemp = filteredTemp.filter(room => {
                const status = (room.status || 'active').toLowerCase();
                return status !== 'inactive' && status !== 'archived';
            });
        } else {
            filteredPerm = filteredPerm.filter(room => {
                const status = (room.status || 'active').toLowerCase();
                return statusFilter === 'active' ? (status === 'active') : (status === 'inactive' || status === 'archived');
            });
            filteredTemp = filteredTemp.filter(room => {
                const status = (room.status || 'active').toLowerCase();
                return statusFilter === 'active' ? (status === 'active') : (status === 'inactive' || status === 'archived');
            });
        }

        // Apply delivery format filter
        if (formatFilter !== 'all') {
            filteredPerm = filteredPerm.filter(room => {
                const isOnline = room.description?.includes('[delivery_format:online]');
                return formatFilter === 'online' ? isOnline : !isOnline;
            });
            filteredTemp = filteredTemp.filter(room => {
                const isOnline = room.description?.includes('[delivery_format:online]');
                return formatFilter === 'online' ? isOnline : !isOnline;
            });
        }

        // Apply search query
        if (searchQuery.trim() !== '') {
            const lowerQ = searchQuery.toLowerCase();
            filteredPerm = filteredPerm.filter(room => 
                room.name.toLowerCase().includes(lowerQ) || 
                (room.description && room.description.toLowerCase().includes(lowerQ))
            );
            filteredTemp = filteredTemp.filter(room => 
                room.name.toLowerCase().includes(lowerQ) || 
                (room.description && room.description.toLowerCase().includes(lowerQ))
            );
        }

        const activePermIds = new Set(filteredPerm.map(c => c.id));
        const activeSchedules = rawSchedules.filter(s => activePermIds.has(s.classroom_id));

        const scheduledDaysOfWeek = new Set(activeSchedules.map(s => s.day_of_week));
        const tempDates = new Set(filteredTemp.map(tc => (tc as any).class_date));
        return { scheduledDaysOfWeek, tempDates };
    }, [rawSchedules, classrooms, tempClassrooms, statusFilter, formatFilter, searchQuery]);

    const hasClassesOnDate = React.useCallback((dateStr: string) => {
        const dateObj = parseClassDate(dateStr);
        if (!dateObj) return false;
        const dayOfWeek = dateObj.getDay();
        return scheduledDatesSet.scheduledDaysOfWeek.has(dayOfWeek) || scheduledDatesSet.tempDates.has(dateStr);
    }, [scheduledDatesSet]);

    const getClassesForDate = React.useCallback((dateStr: string) => {
        if (!dateStr) return [];
        const dateObj = parseClassDate(dateStr);
        if (!dateObj) return [];
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

    const getFilteredClassesForDate = React.useCallback((dateStr: string) => {
        const baseClasses = getClassesForDate(dateStr);
        let filtered = baseClasses;

        // Apply status filter / default active filtering
        if (statusFilter === 'all') {
            filtered = filtered.filter(room => {
                const status = (room.status || 'active').toLowerCase();
                return status !== 'inactive' && status !== 'archived';
            });
        } else {
            filtered = filtered.filter(room => {
                const status = (room.status || 'active').toLowerCase();
                return statusFilter === 'active' ? (status === 'active') : (status === 'inactive' || status === 'archived');
            });
        }

        // Apply delivery format filter
        if (formatFilter !== 'all') {
            filtered = filtered.filter(room => {
                const isOnline = room.description?.includes('[delivery_format:online]');
                return formatFilter === 'online' ? isOnline : !isOnline;
            });
        }

        // Apply search query
        if (searchQuery.trim() !== '') {
            const lowerQ = searchQuery.toLowerCase();
            filtered = filtered.filter(room => 
                room.name.toLowerCase().includes(lowerQ) || 
                (room.description && room.description.toLowerCase().includes(lowerQ))
            );
        }

        // Sort active ongoing classes above all others
        filtered = [...filtered].sort((a, b) => {
            const isOngoingA = activeSession && activeSession.classroomId === a.id;
            const isOngoingB = activeSession && activeSession.classroomId === b.id;
            if (isOngoingA && !isOngoingB) return -1;
            if (!isOngoingA && isOngoingB) return 1;
            return 0;
        });

        return filtered;
    }, [getClassesForDate, statusFilter, formatFilter, searchQuery, activeSession]);

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8f8f6]">
                <Loader2 className="w-10 h-10 animate-spin text-[#ecb613] mb-4" />
                <p className="font-medium text-slate-600 tracking-wide uppercase text-xs">Loading Classrooms...</p>
            </div>
        );
    }

    const todayStr = formatDate(new Date());
    let displayedClassrooms = activeView === 'today' 
        ? getClassesForDate(todayStr) 
        : activeView === 'permanent' 
            ? classrooms 
            : activeView === 'temporary' 
                ? tempClassrooms 
                : activeView === 'inactive'
                    ? [...classrooms, ...tempClassrooms]
                    : [...classrooms, ...tempClassrooms];

    // Apply status filter / default active/inactive tab partitioning
    if (statusFilter === 'all') {
        if (activeView === 'inactive') {
            displayedClassrooms = displayedClassrooms.filter(room => {
                const status = (room.status || 'active').toLowerCase();
                return status === 'inactive' || status === 'archived';
            });
        } else {
            // Exclude inactive/archived classes from Today, Permanent, Temporary, and All tabs
            displayedClassrooms = displayedClassrooms.filter(room => {
                const status = (room.status || 'active').toLowerCase();
                return status !== 'inactive' && status !== 'archived';
            });
        }
    } else {
        // If status filter is explicitly selected, override the tab default partitioning
        displayedClassrooms = displayedClassrooms.filter(room => {
            const status = (room.status || 'active').toLowerCase();
            return statusFilter === 'active' ? (status === 'active') : (status === 'inactive' || status === 'archived');
        });
    }

    // Apply delivery format filter (Online / Offline)
    if (formatFilter !== 'all') {
        displayedClassrooms = displayedClassrooms.filter(room => {
            const isOnline = room.description?.includes('[delivery_format:online]');
            return formatFilter === 'online' ? isOnline : !isOnline;
        });
    }

    if (searchQuery.trim() !== '') {
        const lowerQ = searchQuery.toLowerCase();
        displayedClassrooms = displayedClassrooms.filter(room => 
            room.name.toLowerCase().includes(lowerQ) || 
            (room.description && room.description.toLowerCase().includes(lowerQ))
        );
    }

    // Sort active ongoing classes above all others
    displayedClassrooms = [...displayedClassrooms].sort((a, b) => {
        const isOngoingA = activeSession && activeSession.classroomId === a.id;
        const isOngoingB = activeSession && activeSession.classroomId === b.id;
        if (isOngoingA && !isOngoingB) return -1;
        if (!isOngoingA && isOngoingB) return 1;
        return 0;
    });

    return (
        <div className="flex min-h-screen bg-[#f8f8f6] dark:bg-[#221d10] text-[#0f172a] dark:text-slate-100 font-sans">
            <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

            <main className="flex-1 flex flex-col min-w-0">
                {/* TopAppBar */}
                <TeacherHeader 
                    title="Classrooms" 
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    placeholder="Search classes..."
                    backLink={teacherProfile?.role === 'admin' ? '/admin-dashboard' : '/teacher-dashboard'}
                />

                <div className="p-4 sm:p-6 md:p-8 w-full flex-1 overflow-y-auto">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                        <div>
                            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">Classroom Management</h1>
                            <p className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2">
                                {activeView === 'today' 
                                    ? "Showing today's scheduled classes and sessions." 
                                    : "Manage your active music sessions, schedules, and student enrollment."}
                                {activeView !== 'today' && (
                                    <button 
                                        onClick={() => setActiveView('today')}
                                        className="text-xs font-bold text-[#ecb613] hover:underline bg-transparent border-0 cursor-pointer ml-1"
                                    >
                                        Show Today's Classes
                                    </button>
                                )}
                            </p>
                        </div>
                        {teacherProfile?.role === 'admin' && (
                            <div className="flex items-center gap-3">
                                <Link href="/teacher-dashboard/classrooms/add">
                                    <button className="flex items-center gap-2 px-6 py-2.5 bg-[#ecb613] text-slate-900 font-bold rounded-xl shadow-sm hover:shadow-md transition-all">
                                        <PlusCircle className="size-5" />
                                        Configure New Class
                                    </button>
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Filter Bar */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex flex-wrap items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-full md:w-auto gap-1">
                            {viewMode === 'list' ? (
                                <>
                                    <button 
                                        onClick={() => setActiveView('permanent')}
                                        className={`px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold rounded-lg shadow-sm flex-1 md:flex-initial text-center transition-colors ${activeView === 'permanent' ? 'bg-white dark:bg-slate-700 text-[#451a03] dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 bg-transparent shadow-none'}`}
                                    >
                                        Permanent Classes
                                    </button>
                                    <button 
                                        onClick={() => setActiveView('temporary')}
                                        className={`px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold rounded-lg shadow-sm flex-1 md:flex-initial text-center transition-colors ${activeView === 'temporary' ? 'bg-white dark:bg-slate-700 text-[#451a03] dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 bg-transparent shadow-none'}`}
                                    >
                                        Temporary Sessions
                                    </button>
                                    <button 
                                        onClick={() => setActiveView('all')}
                                        className={`px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold rounded-lg shadow-sm flex-1 md:flex-initial text-center transition-colors ${activeView === 'all' ? 'bg-white dark:bg-slate-700 text-[#451a03] dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 bg-transparent shadow-none'}`}
                                    >
                                        All Classes
                                    </button>
                                    <button 
                                        onClick={() => setActiveView('inactive')}
                                        className={`px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold rounded-lg shadow-sm flex-1 md:flex-initial text-center transition-colors ${activeView === 'inactive' ? 'bg-white dark:bg-slate-700 text-rose-605 dark:text-rose-400' : 'text-slate-550 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 bg-transparent shadow-none'}`}
                                    >
                                        Inactive / Archived
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
                            <div className="relative">
                                <button 
                                    onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                                    className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-bold transition-all h-[38px] cursor-pointer ${
                                        statusFilter !== 'all' || formatFilter !== 'all'
                                            ? 'bg-amber-50 border-amber-300 text-[#b45309] dark:bg-amber-955/20 dark:border-amber-900/50 dark:text-amber-400'
                                            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <Filter className="size-4" />
                                    <span>Filter</span>
                                    {(statusFilter !== 'all' || formatFilter !== 'all') && (
                                        <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
                                    )}
                                </button>
                                
                                {showFilterDropdown && (
                                    <>
                                        <div className="fixed inset-0 z-45" onClick={() => setShowFilterDropdown(false)} />
                                        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 text-left">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 px-1">Status</label>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    {(['all', 'active', 'inactive'] as const).map(s => (
                                                        <button
                                                            key={s}
                                                            onClick={() => setStatusFilter(s)}
                                                            className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border text-center uppercase tracking-wider transition-all cursor-pointer ${
                                                                statusFilter === s
                                                                    ? 'bg-[#ecb613] text-slate-900 border-transparent shadow-sm'
                                                                    : 'bg-slate-50 dark:bg-slate-855 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                                                            }`}
                                                        >
                                                            {s}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3">
                                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 px-1">Delivery Format</label>
                                                <div className="grid grid-cols-3 gap-1.5">
                                                    {(['all', 'online', 'offline'] as const).map(f => (
                                                        <button
                                                            key={f}
                                                            onClick={() => setFormatFilter(f)}
                                                            className={`px-2 py-1.5 text-[10px] font-black rounded-lg border text-center uppercase tracking-wider transition-all cursor-pointer ${
                                                                formatFilter === f
                                                                    ? 'bg-[#ecb613] text-slate-900 border-transparent shadow-sm'
                                                                    : 'bg-slate-50 dark:bg-slate-805 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                                                            }`}
                                                        >
                                                            {f}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {(statusFilter !== 'all' || formatFilter !== 'all') && (
                                                <button
                                                    onClick={() => {
                                                        setStatusFilter('all');
                                                        setFormatFilter('all');
                                                        setShowFilterDropdown(false);
                                                    }}
                                                    className="w-full text-center py-1.5 text-[11px] font-black text-rose-500 dark:text-rose-455 hover:underline transition-all cursor-pointer border-t border-slate-100 dark:border-slate-800/80 pt-3 block"
                                                >
                                                    Clear All Filters
                                                </button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
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
                                        {getFilteredClassesForDate(selectedDate).length} Scheduled
                                    </span>
                                </div>

                                <div className="space-y-4">
                                    {getFilteredClassesForDate(selectedDate).map((room, idx) => {
                                        const statusLower = (room.status || 'active').toLowerCase();
                                        const isInactive = statusLower === 'inactive';
                                        const isArchived = statusLower === 'archived';
                                        const isDisabled = isInactive || isArchived;

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
                                            <div key={`${room.id}-${idx}`} className={`p-4 sm:p-6 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group ${
                                                isOngoing
                                                    ? 'bg-rose-50/15 dark:bg-rose-950/10 border-rose-200 dark:border-rose-800 shadow-md shadow-rose-500/5'
                                                    : isDisabled
                                                    ? 'bg-slate-50/60 dark:bg-slate-900/20 border-dashed border-slate-300 dark:border-slate-850 opacity-75 hover:opacity-100'
                                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md'
                                            }`}>
                                                <div className="flex items-center gap-3 sm:gap-4">
                                                    {teacherProfile?.role === 'admin' && (
                                                        <input 
                                                            type="checkbox"
                                                            checked={selectedIds.includes(room.id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedIds(prev => [...prev, room.id]);
                                                                } else {
                                                                    setSelectedIds(prev => prev.filter(id => id !== room.id));
                                                                }
                                                            }}
                                                            className="rounded border-slate-300 text-[#ecb613] focus:ring-[#ecb613]/50 cursor-pointer size-4 mr-1 sm:mr-2"
                                                        />
                                                    )}
                                                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${isDisabled ? 'bg-slate-200/50 dark:bg-slate-800 text-slate-400 dark:text-slate-550' : styleConfig.bg} flex items-center justify-center ${isDisabled ? '' : styleConfig.text} shrink-0`}>
                                                        <IconComponent className="size-5 sm:size-6" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <Link href={room.type === 'permanent' ? `/teacher-dashboard/classrooms/${room.id}` : `/teacher-dashboard/classrooms/${room.classroom_id}`} className="font-bold text-base sm:text-lg text-slate-900 dark:text-white group-hover:text-[#ecb613] transition-colors">
                                                                {room.name}
                                                            </Link>
                                                            {isOngoing && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-rose-500 text-white tracking-wider animate-pulse shadow-md">
                                                                    Live
                                                                </span>
                                                            )}
                                                            {room.type === 'temporary' ? (
                                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                                                    Temp
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                                    Perm
                                                                </span>
                                                            )}
                                                            {isInactive && (
                                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-405">
                                                                    Inactive
                                                                </span>
                                                            )}
                                                            {isArchived && (
                                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase bg-slate-205 text-slate-700 dark:bg-slate-800 dark:text-slate-400">
                                                                    Archived
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1">
                                                            {getCleanDescription(room.description)}
                                                            {(room as any).teacher?.name && ` • ${(room as any).teacher.name}`}
                                                        </p>
                                                        <div className="flex items-center gap-3 sm:gap-4 mt-1 sm:mt-2 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
                                                            <span className="flex items-center gap-1"><Users className="size-3.5 text-slate-400" /> {room.student_count}</span>
                                                            <span className="flex items-center gap-1 truncate max-w-[150px] sm:max-w-none">
                                                                <Clock className="size-3.5 text-slate-400" />
                                                                {room.displayTime}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 mt-2 md:mt-0 justify-end w-full md:w-auto border-t md:border-t-0 border-slate-100 dark:border-slate-800/60 pt-2 md:pt-0">
                                                    <Link href={room.type === 'permanent' ? `/teacher-dashboard/classrooms/${room.id}` : `/teacher-dashboard/classrooms/${room.classroom_id}`} className="flex-1 md:flex-initial">
                                                        <button className="w-full md:w-auto px-3 sm:px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm">
                                                            Manage
                                                        </button>
                                                    </Link>
                                                    {isOngoing ? (
                                                        <Link href={`/teacher-dashboard/classrooms/${room.type === 'permanent' ? room.id : (room.classroom_id || room.id)}/meeting`} className="flex-1 md:flex-initial">
                                                            <button className="w-full md:w-auto px-3 sm:px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-extrabold rounded-lg transition-all shadow-lg shadow-rose-500/25 flex items-center justify-center gap-1.5 animate-pulse">
                                                                <Activity className="size-3.5 animate-spin" />
                                                                Resume
                                                            </button>
                                                        </Link>
                                                    ) : (
                                                        <Link href={`/teacher-dashboard/classrooms/${room.type === 'permanent' ? room.id : (room.classroom_id || room.id)}/meeting`} className="flex-1 md:flex-initial">
                                                            <button 
                                                                disabled={isDisabled}
                                                                className={`w-full md:w-auto px-3 sm:px-4 py-2 text-xs font-bold rounded-lg transition-colors shadow-sm ${
                                                                    isDisabled 
                                                                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed' 
                                                                        : 'bg-[#0d5a5e] text-white hover:bg-[#115e59]'
                                                                }`}
                                                            >
                                                                Start
                                                            </button>
                                                        </Link>
                                                    )}
                                                    {teacherProfile?.role === 'admin' && (
                                                        <button
                                                            onClick={() => handleDeleteClassroom(room)}
                                                            disabled={isDeletingId === room.id}
                                                            className="p-2 border border-rose-200 dark:border-rose-900/60 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg hover:scale-105 transition-all shadow-xs flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            title="Delete class"
                                                        >
                                                            <Trash2 className="size-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {getFilteredClassesForDate(selectedDate).length === 0 && (
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
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mb-8">
                                <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-2 sm:mb-4">
                                        <Users className="size-5 sm:size-6" />
                                    </div>
                                    <p className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-sm font-medium mb-0.5 sm:mb-1">Total Students</p>
                                    <p className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white">{displayedClassrooms.reduce((acc, r) => acc + r.student_count, 0)}</p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-2 sm:mb-4">
                                        <Video className="size-5 sm:size-6" />
                                    </div>
                                    <p className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-sm font-medium mb-0.5 sm:mb-1">Online Classes</p>
                                    <p className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white">0</p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2 sm:mb-4">
                                        <MapPin className="size-5 sm:size-6" />
                                    </div>
                                    <p className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-sm font-medium mb-0.5 sm:mb-1">Offline Classes</p>
                                    <p className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white">{displayedClassrooms.length}</p>
                                </div>
                                <div className="bg-[#ecb613] p-4 sm:p-6 rounded-2xl border border-[#ecb613] shadow-sm hover:shadow-md transition-shadow text-slate-900">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/30 flex items-center justify-center text-slate-900 mb-2 sm:mb-4">
                                        <Clock className="size-5 sm:size-6" />
                                    </div>
                                    <p className="text-slate-900/80 text-[10px] sm:text-sm font-medium mb-0.5 sm:mb-1">Total Classes</p>
                                    <p className="text-lg sm:text-2xl font-black">{displayedClassrooms.length}</p>
                                </div>
                            </div>

                            {/* Class Management List Table */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md mb-10">
                                {/* Mobile view of list */}
                                <div className="block md:hidden p-3 space-y-3">
                                    {displayedClassrooms.map((room, idx) => {
                                        const statusLower = (room.status || 'active').toLowerCase();
                                        const isInactive = statusLower === 'inactive';
                                        const isArchived = statusLower === 'archived';
                                        const isDisabled = isInactive || isArchived;

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
                                            <div key={room.id} className={`p-3 rounded-xl border transition-all flex flex-col gap-2.5 ${
                                                isOngoing
                                                    ? 'bg-rose-50/15 dark:bg-rose-950/10 border-rose-200 dark:border-rose-800 shadow-sm'
                                                    : isDisabled
                                                    ? 'bg-slate-50/60 dark:bg-slate-900/20 border-dashed border-slate-300 dark:border-slate-850 opacity-75 hover:opacity-100'
                                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'
                                            }`}>
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                        {teacherProfile?.role === 'admin' && (
                                                            <input 
                                                                type="checkbox"
                                                                checked={selectedIds.includes(room.id)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setSelectedIds(prev => [...prev, room.id]);
                                                                    } else {
                                                                        setSelectedIds(prev => prev.filter(id => id !== room.id));
                                                                    }
                                                                }}
                                                                className="rounded border-slate-300 text-[#ecb613] focus:ring-[#ecb613]/50 cursor-pointer size-4 shrink-0"
                                                            />
                                                        )}
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <Link href={room.type === 'permanent' ? `/teacher-dashboard/classrooms/${room.id}` : `/teacher-dashboard/classrooms/${room.classroom_id}`} className="font-bold text-sm text-slate-900 dark:text-white hover:text-[#ecb613] transition-colors truncate block max-w-[150px] sm:max-w-none">
                                                                    {room.name}
                                                                </Link>
                                                                {isOngoing && (
                                                                    <span className="px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase bg-rose-500 text-white tracking-wider animate-pulse shrink-0">
                                                                        Live
                                                                    </span>
                                                                )}
                                                                {isInactive && (
                                                                    <span className="px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase bg-rose-105 text-rose-800 dark:bg-rose-950/20 dark:text-rose-400 tracking-wider shrink-0">
                                                                        Inactive
                                                                    </span>
                                                                )}
                                                                {isArchived && (
                                                                    <span className="px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase bg-slate-205 text-slate-700 dark:bg-slate-800 dark:text-slate-400 tracking-wider shrink-0">
                                                                        Archived
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[210px] sm:max-w-none">
                                                                {room.student_count} Enrolled • {room.schedule || 'No schedule'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider shrink-0 ${
                                                        room.type === 'temporary'
                                                            ? 'bg-amber-50 dark:bg-amber-955/30 text-amber-600'
                                                            : 'bg-emerald-50 dark:bg-emerald-955/30 text-emerald-600'
                                                    }`}>
                                                        {room.type === 'temporary' ? 'Temp' : 'Perm'}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800/60 pt-2 text-[11px]">
                                                    <div className="text-[10px] text-slate-400 font-mono">
                                                        ID: {room.id.substring(0, 4).toUpperCase()}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Link href={room.type === 'permanent' ? `/teacher-dashboard/classrooms/${room.id}` : `/teacher-dashboard/classrooms/${room.classroom_id}`}>
                                                            <button className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-md hover:bg-slate-200 transition-colors">
                                                                Manage
                                                            </button>
                                                        </Link>
                                                        {isOngoing ? (
                                                            <Link href={`/teacher-dashboard/classrooms/${room.type === 'permanent' ? room.id : (room.classroom_id || room.id)}/meeting`}>
                                                                <button className="px-2.5 py-1 bg-rose-505 hover:bg-rose-600 text-white font-extrabold rounded-md transition-all flex items-center gap-0.5">
                                                                    <Activity className="size-3 animate-spin" />
                                                                    Resume
                                                                </button>
                                                            </Link>
                                                        ) : (
                                                            <Link href={`/teacher-dashboard/classrooms/${room.type === 'permanent' ? room.id : (room.classroom_id || room.id)}/meeting`}>
                                                                <button 
                                                                    disabled={isDisabled}
                                                                    className={`px-2.5 py-1 font-bold rounded-md transition-colors ${
                                                                        isDisabled
                                                                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                                                                            : 'bg-[#0d5a5e] hover:bg-[#115e59] text-white'
                                                                    }`}
                                                                >
                                                                    Start
                                                                </button>
                                                            </Link>
                                                        )}
                                                        {teacherProfile?.role === 'admin' && (
                                                            <button
                                                                onClick={() => handleDeleteClassroom(room)}
                                                                disabled={isDeletingId === room.id}
                                                                className="p-1 border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-md disabled:opacity-50"
                                                                title="Delete class"
                                                            >
                                                                <Trash2 className="size-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {displayedClassrooms.length === 0 && (
                                        <p className="text-center text-slate-400 text-xs py-8">No classrooms found.</p>
                                    )}
                                </div>
                                <div className="overflow-x-auto hidden md:block">
                                    <table className="w-full text-left border-collapse min-w-[800px]">
                                        <thead>
                                            <tr className="bg-slate-100/50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                                <th className="px-6 py-4 w-12 text-center">
                                                    {teacherProfile?.role === 'admin' && (
                                                        <input 
                                                            type="checkbox"
                                                            checked={displayedClassrooms.length > 0 && selectedIds.length === displayedClassrooms.length}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedIds(displayedClassrooms.map(c => c.id));
                                                                } else {
                                                                    setSelectedIds([]);
                                                                }
                                                            }}
                                                            className="rounded border-slate-300 text-[#ecb613] focus:ring-[#ecb613]/50 cursor-pointer size-4"
                                                        />
                                                    )}
                                                </th>
                                                <th className="px-6 py-4 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Class Name</th>
                                                <th className="px-6 py-4 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Enrollment</th>
                                                <th className="px-6 py-4 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Schedule</th>
                                                <th className="px-6 py-4 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
                                                <th className="px-6 py-4 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                            {displayedClassrooms.map((room, idx) => {
                                                const statusLower = (room.status || 'active').toLowerCase();
                                                const isInactive = statusLower === 'inactive';
                                                const isArchived = statusLower === 'archived';
                                                const isDisabled = isInactive || isArchived;

                                                const iconColors = [
                                                    { bg: 'bg-[#fef3c7]/60 dark:bg-[#ecb613]/20', text: 'text-[#ecb613]', icon: Music },
                                                    { bg: 'bg-blue-100/30 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', icon: Activity },
                                                    { bg: 'bg-orange-100/30 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', icon: Mic },
                                                    { bg: 'bg-purple-100/30 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', icon: Disc }
                                                ];
                                                const styleConfig = iconColors[idx % iconColors.length];
                                                const IconComponent = styleConfig.icon;
                                                const isOnline = room.description?.includes('[delivery_format:online]');

                                                const mockTime = room.schedule && room.schedule.includes('•') ? room.schedule.split('•') : [room.schedule || 'Days Not Set', '09:00 AM - 10:30 AM'];
                                                const days = mockTime[0]?.trim() || 'Mon, Wed';
                                                const times = mockTime[1]?.trim() || '10:00 AM - 11:30 AM';
                                                const isOngoing = activeSession && activeSession.classroomId === room.id;

                                                return (
                                                    <tr key={room.id} className={`transition-colors group border-b border-slate-100 dark:border-slate-800/50 ${
                                                        isOngoing
                                                            ? 'bg-rose-50/15 dark:bg-rose-950/10 hover:bg-rose-50/20 dark:hover:bg-rose-955/15'
                                                            : isDisabled
                                                            ? 'bg-slate-50/40 dark:bg-slate-900/20 hover:bg-slate-100/40 dark:hover:bg-slate-800/30 opacity-75 hover:opacity-100'
                                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 even:bg-slate-50/30 dark:even:bg-slate-800/20'
                                                    }`}>
                                                        <td className="px-6 py-6 w-12 text-center">
                                                            {teacherProfile?.role === 'admin' && (
                                                                <input 
                                                                    type="checkbox"
                                                                    checked={selectedIds.includes(room.id)}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) {
                                                                            setSelectedIds(prev => [...prev, room.id]);
                                                                        } else {
                                                                            setSelectedIds(prev => prev.filter(id => id !== room.id));
                                                                        }
                                                                    }}
                                                                    className="rounded border-slate-300 text-[#ecb613] focus:ring-[#ecb613]/50 cursor-pointer size-4"
                                                                />
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-6">
                                                            <div className="flex items-center gap-4">
                                                                <div className={`w-10 h-10 rounded-lg ${isDisabled ? 'bg-slate-200/50 dark:bg-slate-800 text-slate-400 dark:text-slate-550' : styleConfig.bg} flex items-center justify-center ${isDisabled ? '' : styleConfig.text}`}>
                                                                    <IconComponent className="size-5" />
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <Link href={room.type === 'permanent' ? `/teacher-dashboard/classrooms/${room.id}` : `/teacher-dashboard/classrooms/${room.classroom_id}`} className="font-bold text-slate-900 dark:text-white group-hover:text-[#ecb613] transition-colors">
                                                                            {room.name}
                                                                        </Link>
                                                                        {isOngoing && (
                                                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-500 text-white tracking-wider animate-pulse shadow-md shadow-rose-500/25">
                                                                                <span className="w-1 h-1 rounded-full bg-white animate-ping"></span>
                                                                                Live Session
                                                                            </span>
                                                                        )}
                                                                        {room.type === 'temporary' ? (
                                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-955/20 dark:text-amber-400 tracking-wider">
                                                                                ⚡ Temporary
                                                                            </span>
                                                                        ) : (
                                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-955/20 dark:text-emerald-405 tracking-wider">
                                                                                👥 Permanent
                                                                            </span>
                                                                        )}
                                                                        {isInactive && (
                                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-100 text-rose-800 dark:bg-rose-950/20 dark:text-rose-450 tracking-wider">
                                                                                🚫 Inactive
                                                                            </span>
                                                                        )}
                                                                        {isArchived && (
                                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-205 text-slate-700 dark:bg-slate-800 dark:text-slate-400 tracking-wider">
                                                                                📦 Archived
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                                        ID: {room.id.substring(0, 8).toUpperCase()}
                                                                        {(room as any).teacher?.name && ` • Instructor: ${(room as any).teacher.name}`}
                                                                    </p>
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
                                                                <p className="text-xs font-semibold text-slate-505 dark:text-slate-400 whitespace-nowrap">{room.student_count} Enrolled</p>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-6">
                                                             {activeView === 'today' ? (
                                                                 <div className="flex flex-col bg-slate-50 dark:bg-slate-805/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800 min-w-[150px] text-left">
                                                                     <span className="text-[10px] font-black text-emerald-605 dark:text-emerald-400 uppercase tracking-wide">Today</span>
                                                                     <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 mt-0.5">
                                                                         {room.start_time ? formatTime12hr(room.start_time.slice(0, 5)) : ''} - {room.end_time ? formatTime12hr(room.end_time.slice(0, 5)) : ''}
                                                                     </span>
                                                                     <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                                                                         Duration: {room.start_time && room.end_time ? calculateDuration(room.start_time, room.end_time) : ''}
                                                                     </span>
                                                                 </div>
                                                             ) : room.type === 'temporary' ? (
                                                                 <div className="flex flex-col bg-slate-50 dark:bg-slate-805/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800 min-w-[150px] text-left">
                                                                     <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                                                                         {(() => {
                                                                             const parsed = parseClassDate(room.class_date);
                                                                             return parsed ? parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Invalid Date';
                                                                         })()}
                                                                     </span>
                                                                     <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 mt-0.5">
                                                                         {room.start_time ? formatTime12hr(room.start_time.slice(0, 5)) : ''} - {room.end_time ? formatTime12hr(room.end_time.slice(0, 5)) : ''}
                                                                     </span>
                                                                     <span className="text-[9px] font-bold text-slate-400 dark:text-slate-550 mt-0.5">
                                                                         Duration: {room.start_time && room.end_time ? calculateDuration(room.start_time, room.end_time) : ''}
                                                                     </span>
                                                                 </div>
                                                             ) : (
                                                                 <div className="flex flex-col gap-1.5 min-w-[150px]">
                                                                     {rawSchedules.filter(s => s.classroom_id === room.id).map((sched, sIdx) => {
                                                                         const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][sched.day_of_week];
                                                                         const start = formatTime12hr(sched.start_time.slice(0, 5));
                                                                         const end = formatTime12hr(sched.end_time.slice(0, 5));
                                                                         const duration = calculateDuration(sched.start_time, sched.end_time);
                                                                         return (
                                                                             <div key={sIdx} className="flex flex-col bg-slate-50 dark:bg-slate-805/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800 text-left">
                                                                                 <span className="text-[10px] font-black text-[#b45309] dark:text-[#ecb613] uppercase tracking-wide">{dayName}</span>
                                                                                 <span className="text-xs font-extrabold text-slate-705 dark:text-slate-200 mt-0.5">{start} - {end}</span>
                                                                                 <span className="text-[9px] font-bold text-slate-400 dark:text-slate-550 mt-0.5">Duration: {duration}</span>
                                                                             </div>
                                                                         );
                                                                     })}
                                                                     {rawSchedules.filter(s => s.classroom_id === room.id).length === 0 && (
                                                                         <span className="text-slate-400 dark:text-slate-600 text-xs font-semibold">No schedule set</span>
                                                                     )}
                                                                 </div>
                                                             )}
                                                        </td>
                                                        <td className="px-6 py-6">
                                                            {isOnline ? (
                                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-105 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
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
                                                                <Link href={room.type === 'permanent' ? `/teacher-dashboard/classrooms/${room.id}` : `/teacher-dashboard/classrooms/${room.classroom_id}`}>
                                                                    <button className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-705 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm">
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
                                                                        <button 
                                                                            disabled={isDisabled}
                                                                            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors shadow-sm ${
                                                                                isDisabled
                                                                                    ? 'bg-slate-205 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                                                                                    : 'bg-[#0d5a5e] text-white hover:bg-[#115e59]'
                                                                            }`}
                                                                        >
                                                                            Start
                                                                        </button>
                                                                    </Link>
                                                                )}
                                                                {teacherProfile?.role === 'admin' && (
                                                                    <button
                                                                        onClick={() => handleDeleteClassroom(room)}
                                                                        disabled={isDeletingId === room.id}
                                                                        className="p-2 border border-rose-200 dark:border-rose-900/60 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg hover:scale-105 transition-all shadow-xs flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed animate-in fade-in"
                                                                        title="Delete class"
                                                                    >
                                                                        <Trash2 className="size-4" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {displayedClassrooms.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-12 text-center">
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
                                    </div>
                                </div>
                        </>
                    )}
                </div>
                {/* Floating bulk actions bar */}
                {selectedIds.length > 0 && teacherProfile?.role === 'admin' && (
                    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[250] bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-2xl px-6 py-4 rounded-full flex items-center gap-6 animate-in fade-in slide-in-from-bottom-6 duration-300 backdrop-blur-md">
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            <span className="text-[#ecb613] font-black mr-1">{selectedIds.length}</span> classes selected
                        </span>
                        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700"></div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleDeleteMultiple}
                                disabled={isDeletingMultiple}
                                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white text-xs font-bold rounded-full transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                            >
                                {isDeletingMultiple ? (
                                    <Loader2 className="size-3 animate-spin" />
                                ) : (
                                    <Trash2 className="size-3.5" />
                                )}
                                Delete Selected
                            </button>
                            <button
                                onClick={() => setSelectedIds([])}
                                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold rounded-full transition-all active:scale-95"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
                {/* Global floating toast notification */}
                {toast && (
                    <div className="fixed bottom-6 right-6 z-[300] bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-800 dark:border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-sm select-text">
                        {toast.type === 'success' ? (
                            <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                        ) : (
                            <Info className="w-5 h-5 text-red-500 shrink-0" />
                        )}
                        <p className="text-xs font-bold leading-relaxed">{toast.message}</p>
                    </div>
                )}
            </main>
        </div>
    );
}
