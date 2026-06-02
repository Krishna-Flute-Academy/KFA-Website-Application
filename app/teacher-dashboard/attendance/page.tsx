'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { 
    Loader2, 
    Calendar as CalendarIcon, 
    CheckCircle2, 
    XCircle, 
    Clock, 
    Search, 
    TrendingUp, 
    Users, 
    ChevronLeft, 
    ChevronRight,
    Filter,
    Download,
    Lightbulb,
    School,
    ArrowDown,
    CheckCircle,
    X,
    ChevronDown,
    ChevronUp,
    BookOpen,
    User,
    Calendar,
    ArrowRight
} from 'lucide-react';
import TeacherSidebar from '../../../src/components/TeacherSidebar';

interface Classroom {
    id: string;
    name: string;
}

interface BatchSchedule {
    id: string;
    classroom_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
}

interface TemporaryClass {
    id: string;
    classroom_id?: string | null;
    title: string;
    class_date: string;
    start_time: string;
    end_time: string;
}

interface Student {
    id: string;
    name: string;
    profile_pic_url?: string | null;
}

interface BatchItem {
    id: string;
    name: string;
    type: 'permanent' | 'temporary';
    time: string;
}

interface AttendanceLog {
    id: string;
    date: string;
    status: 'present' | 'absent' | 'late' | 'excused';
    classroom_id: string;
    classroom_name: string;
    is_temporary: boolean;
}

export default function AttendancePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string } | null>(null);
    
    // UI State
    const [mode, setMode] = useState<'class' | 'individual'>('class');
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [viewDate, setViewDate] = useState(new Date()); // Calendar month being displayed
    const [searchQuery, setSearchQuery] = useState('');
    
    // Core Data State
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [allSchedules, setAllSchedules] = useState<BatchSchedule[]>([]);
    const [temporaryClasses, setTemporaryClasses] = useState<TemporaryClass[]>([]);
    
    // Expanded batch state
    const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
    const [batchStudentsMap, setBatchStudentsMap] = useState<Record<string, Student[]>>({});
    const [batchAttendanceMap, setBatchAttendanceMap] = useState<Record<string, Record<string, 'present' | 'absent' | 'late' | 'excused'>>>({});
    const [batchLoadingMap, setBatchLoadingMap] = useState<Record<string, boolean>>({});
    const [batchSummaries, setBatchSummaries] = useState<Record<string, { present: number; absent: number; late: number; excused: number; total: number }>>({});
    
    // Individual Search Report State
    const [individualStudents, setIndividualStudents] = useState<Student[]>([]);
    const [individualLoading, setIndividualLoading] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    
    const initialFromDate = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    }, []);
    const [fromDate, setFromDate] = useState<string>(initialFromDate);
    const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);

    // Global Stats state
    const [stats, setStats] = useState({
        total: 0,
        present: 0,
        absent: 0,
        rate: '0%'
    });

    const formatDate = (date: Date) => {
        const d = new Date(date);
        let month = '' + (d.getMonth() + 1);
        let day = '' + d.getDate();
        const year = d.getFullYear();

        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;

        return [year, month, day].join('-');
    };

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

    // Authenticate & Load initial meta-data
    useEffect(() => {
        const checkAuthAndLoad = async () => {
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

                if (profile?.role !== 'teacher') {
                    router.push('/');
                    return;
                }

                setTeacherProfile({ id: profile.id, name: profile.name, email: profile.email });
                
                // 1. Fetch classrooms
                const { data: classesData } = await supabaseAuth
                    .from('classrooms')
                    .select('id, name')
                    .eq('teacher_id', session.user.id);
                
                const loadedClassrooms = classesData || [];
                setClassrooms(loadedClassrooms);

                // 2. Fetch all batch schedules in parallel
                if (loadedClassrooms.length > 0) {
                    const roomIds = loadedClassrooms.map(c => c.id);
                    const { data: schedulesData } = await supabaseAuth
                        .from('batch_schedules')
                        .select('*')
                        .in('classroom_id', roomIds);
                    
                    setAllSchedules(schedulesData || []);
                }

                // 3. Fetch all temporary classes
                const { data: tempClassesData } = await supabaseAuth
                    .from('temporary_classes')
                    .select('*')
                    .eq('teacher_id', session.user.id);
                
                setTemporaryClasses(tempClassesData || []);

            } catch (err) {
                console.error('Error on initial load:', err);
            } finally {
                setLoading(false);
            }
        };

        checkAuthAndLoad();
    }, [router]);

    // Active batches scheduled on the selected date
    const activeBatchesOnSelectedDate = useMemo((): BatchItem[] => {
        if (!selectedDate) return [];
        const dateObj = new Date(selectedDate);
        // Correctly handle UTC vs local day mapping
        const dayOfWeek = dateObj.getDay(); 

        const activePermanent = allSchedules
            .filter(s => s.day_of_week === dayOfWeek)
            .map(s => {
                const room = classrooms.find(c => c.id === s.classroom_id);
                return {
                    id: s.classroom_id,
                    name: room?.name || 'Classroom',
                    type: 'permanent' as const,
                    time: `${formatTime12hr(s.start_time.slice(0, 5))} - ${formatTime12hr(s.end_time.slice(0, 5))}`
                };
            });

        const activeTemporary = temporaryClasses
            .filter(tc => tc.class_date === selectedDate)
            .map(tc => ({
                id: tc.classroom_id || tc.id,
                name: tc.title || 'Temporary Session',
                type: 'temporary' as const,
                time: `${formatTime12hr(tc.start_time.slice(0, 5))} - ${formatTime12hr(tc.end_time.slice(0, 5))}`
            }));

        return [...activePermanent, ...activeTemporary];
    }, [selectedDate, allSchedules, classrooms, temporaryClasses]);

    // Helper to calculate dot indicators for the calendar month
    const scheduledDatesSet = useMemo(() => {
        const scheduledDaysOfWeek = new Set(allSchedules.map(s => s.day_of_week));
        const tempDates = new Set(temporaryClasses.map(tc => tc.class_date));
        return { scheduledDaysOfWeek, tempDates };
    }, [allSchedules, temporaryClasses]);

    const hasClassesOnDate = useCallback((dateStr: string) => {
        const dateObj = new Date(dateStr);
        const dayOfWeek = dateObj.getDay();
        return scheduledDatesSet.scheduledDaysOfWeek.has(dayOfWeek) || scheduledDatesSet.tempDates.has(dateStr);
    }, [scheduledDatesSet]);

    // Fetch summaries for all active batches on selectedDate (to display present/absent counts on headers)
    useEffect(() => {
        const fetchHeaderSummaries = async () => {
            if (activeBatchesOnSelectedDate.length === 0) return;
            
            const summaries: Record<string, { present: number; absent: number; late: number; excused: number; total: number }> = {};
            
            await Promise.all(activeBatchesOnSelectedDate.map(async (batch) => {
                try {
                    // Fetch roster counts
                    let total = 0;
                    if (batch.type === 'permanent') {
                        const { count: enrolledCount } = await supabaseAuth
                            .from('classroom_students')
                            .select('*', { count: 'exact', head: true })
                            .eq('classroom_id', batch.id);
                        
                        const { count: overrideCount } = await supabaseAuth
                            .from('session_student_overrides')
                            .select('*', { count: 'exact', head: true })
                            .eq('target_classroom_id', batch.id)
                            .eq('override_date', selectedDate);
                        
                        total = (enrolledCount || 0) + (overrideCount || 0);
                    } else {
                        const tempClass = temporaryClasses.find(tc => tc.classroom_id === batch.id || tc.id === batch.id);
                        const tempId = tempClass?.id || batch.id;
                        const { count } = await supabaseAuth
                            .from('temporary_class_students')
                            .select('*', { count: 'exact', head: true })
                            .eq('temporary_class_id', tempId);
                        total = count || 0;
                    }

                    // Fetch marked attendance records
                    const { data: attendanceData } = await supabaseAuth
                        .from('attendance')
                        .select('status')
                        .eq('classroom_id', batch.id)
                        .eq('date', selectedDate);
                    
                    const present = (attendanceData || []).filter(r => r.status === 'present').length;
                    const absent = (attendanceData || []).filter(r => r.status === 'absent').length;
                    const late = (attendanceData || []).filter(r => r.status === 'late').length;
                    const excused = (attendanceData || []).filter(r => r.status === 'excused').length;
                    
                    summaries[batch.id] = { present, absent, late, excused, total };
                } catch (e) {
                    console.error('Error fetching summaries:', e);
                }
            }));
            
            setBatchSummaries(summaries);

            // Update dashboard global stats for this day
            const values = Object.values(summaries);
            const total = values.reduce((acc, curr) => acc + curr.total, 0);
            const present = values.reduce((acc, curr) => acc + curr.present + curr.late, 0);
            const absent = values.reduce((acc, curr) => acc + curr.absent, 0);
            const rate = total > 0 ? `${Math.round((present / total) * 100)}%` : '0%';
            setStats({ total, present, absent, rate });
        };

        fetchHeaderSummaries();
    }, [activeBatchesOnSelectedDate, selectedDate]);

    // Reset expanded batch and cached maps when selectedDate changes to guarantee date-specific roster loading
    useEffect(() => {
        setExpandedBatchId(null);
        setBatchStudentsMap({});
        setBatchAttendanceMap({});
    }, [selectedDate]);

    // Accordion Batch expansion fetch
    const handleExpandBatch = async (batchId: string, isTemporary: boolean) => {
        if (expandedBatchId === batchId) {
            setExpandedBatchId(null);
            return;
        }

        setExpandedBatchId(batchId);

        // Always show loading for fresh attendance data
        const isRosterCached = !!batchStudentsMap[batchId];
        if (!isRosterCached) {
            setBatchLoadingMap(prev => ({ ...prev, [batchId]: true }));
        }

        try {
            // 1. Fetch Students roster (cached — roster doesn't change often)
            if (!isRosterCached) {
                let roster: Student[] = [];
                if (!isTemporary) {
                    const { data: permanentStudents } = await supabaseAuth
                        .from('classroom_students')
                        .select('student_id, users!student_id(name, profile_pic_url)')
                        .eq('classroom_id', batchId);
                    
                    const permRoster = (permanentStudents || []).map((row: any) => ({
                        id: row.student_id,
                        name: row.users?.name || 'Unknown Student',
                        profile_pic_url: row.users?.profile_pic_url
                    }));

                    // Fetch temporary session override (makeup) students for this date
                    const { data: overrideStudents } = await supabaseAuth
                        .from('session_student_overrides')
                        .select('student_id, users!student_id(name, profile_pic_url)')
                        .eq('target_classroom_id', batchId)
                        .eq('override_date', selectedDate);

                    const tempRoster = (overrideStudents || []).map((row: any) => ({
                        id: row.student_id,
                        name: `${row.users?.name || 'Unknown Student'} (Makeup)`,
                        profile_pic_url: row.users?.profile_pic_url
                    }));

                    roster = [...permRoster, ...tempRoster];
                } else {
                    const tempClass = temporaryClasses.find(tc => tc.classroom_id === batchId || tc.id === batchId);
                    const tempId = tempClass?.id || batchId;
                    const { data: tempStudents } = await supabaseAuth
                        .from('temporary_class_students')
                        .select('student_id, users!student_id(name, profile_pic_url)')
                        .eq('temporary_class_id', tempId);
                    
                    roster = (tempStudents || []).map((row: any) => ({
                        id: row.student_id,
                        name: row.users?.name || 'Unknown Student',
                        profile_pic_url: row.users?.profile_pic_url
                    }));
                }

                setBatchStudentsMap(prev => ({ ...prev, [batchId]: roster }));
            }

            // 2. Always fetch fresh attendance data (never cached — must stay in sync with Classroom view)
            const { data: attendanceData } = await supabaseAuth
                .from('attendance')
                .select('student_id, status')
                .eq('classroom_id', batchId)
                .eq('date', selectedDate);
            
            const attendanceMap: Record<string, 'present' | 'absent' | 'late' | 'excused'> = {};
            (attendanceData || []).forEach((row: any) => {
                attendanceMap[row.student_id] = row.status;
            });

            setBatchAttendanceMap(prev => ({ ...prev, [batchId]: attendanceMap }));

        } catch (err) {
            console.error('Error expanding batch:', err);
        } finally {
            setBatchLoadingMap(prev => ({ ...prev, [batchId]: false }));
        }
    };

    // Quick Mark inside expanded batch
    const handleMarkBatchAttendance = async (
        batchId: string, 
        studentId: string, 
        status: 'present' | 'absent' | 'late' | 'excused'
    ) => {
        if (!teacherProfile) return;

        // Optimistically update
        setBatchAttendanceMap(prev => {
            const currentBatch = prev[batchId] || {};
            return {
                ...prev,
                [batchId]: {
                    ...currentBatch,
                    [studentId]: status
                }
            };
        });

        try {
            const { error } = await supabaseAuth
                .from('attendance')
                .upsert({
                    student_id: studentId,
                    classroom_id: batchId,
                    date: selectedDate,
                    status: (status as string).toLowerCase(),
                    marked_by: teacherProfile.id
                }, { onConflict: 'student_id, classroom_id, date' });

            if (error) throw error;

            // Recalculate summary stats for this batch header dynamically
            // Read the previous status from the batchAttendanceMap state before the optimistic update
            const prevRecords = batchAttendanceMap[batchId] || {};
            const prevStatus = prevRecords[studentId];

            setBatchSummaries(prev => {
                const batchSummary = prev[batchId] || { present: 0, absent: 0, late: 0, excused: 0, total: 0 };

                let presentDiff = 0;
                let absentDiff = 0;
                let lateDiff = 0;
                let excusedDiff = 0;

                // Remove previous contribution
                if (prevStatus === 'present') presentDiff--;
                if (prevStatus === 'absent') absentDiff--;
                if (prevStatus === 'late') lateDiff--;
                if (prevStatus === 'excused') excusedDiff--;

                // Add new contribution
                if (status === 'present') presentDiff++;
                if (status === 'absent') absentDiff++;
                if (status === 'late') lateDiff++;
                if (status === 'excused') excusedDiff++;

                const nextSummary = {
                    ...batchSummary,
                    present: Math.max(0, batchSummary.present + presentDiff),
                    absent: Math.max(0, batchSummary.absent + absentDiff),
                    late: Math.max(0, batchSummary.late + lateDiff),
                    excused: Math.max(0, batchSummary.excused + excusedDiff)
                };

                return { ...prev, [batchId]: nextSummary };
            });

        } catch (err: any) {
            console.error('Error marking attendance:', err);
            alert(`Failed to save attendance: ${err.message || err}`);
            
            // Revert state
            const { data } = await supabaseAuth
                .from('attendance')
                .select('status')
                .eq('classroom_id', batchId)
                .eq('student_id', studentId)
                .eq('date', selectedDate)
                .single();
            
            setBatchAttendanceMap(prev => {
                const currentBatch = prev[batchId] || {};
                return {
                    ...prev,
                    [batchId]: {
                        ...currentBatch,
                        [studentId]: data?.status || undefined
                    }
                };
            });
        }
    };

    // ── Individual Search Mode logic ───────────────────────────────────────────
    useEffect(() => {
        const searchStudents = async () => {
            if (!teacherProfile || mode !== 'individual') return;
            if (searchQuery.trim().length < 2) {
                setIndividualStudents([]);
                return;
            }

            setIndividualLoading(true);
            try {
                const { data } = await supabaseAuth
                    .from('users')
                    .select('id, name, profile_pic_url')
                    .eq('role', 'student')
                    .eq('teacher_id', teacherProfile.id)
                    .ilike('name', `%${searchQuery}%`);
                
                setIndividualStudents(data || []);
            } catch (err) {
                console.error('Error searching students:', err);
            } finally {
                setIndividualLoading(false);
            }
        };

        const timer = setTimeout(searchStudents, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, mode, teacherProfile]);

    const fetchIndividualLogs = useCallback(async () => {
        if (!selectedStudent) return;
        setLogsLoading(true);
        try {
            const { data, error } = await supabaseAuth
                .from('attendance')
                .select(`
                    id,
                    date,
                    status,
                    classroom_id
                `)
                .eq('student_id', selectedStudent.id)
                .gte('date', fromDate)
                .lte('date', toDate)
                .order('date', { ascending: false });

            if (error) throw error;

            // Resolve classroom names
            const resolvedLogs = await Promise.all((data || []).map(async (row: any) => {
                // Try finding classroom name in our permanent state
                let name = classrooms.find(c => c.id === row.classroom_id)?.name;
                let isTemp = false;

                if (!name) {
                    // Try temporary classes state
                    const temp = temporaryClasses.find(tc => tc.id === row.classroom_id);
                    if (temp) {
                        name = temp.title;
                        isTemp = true;
                    }
                }

                // If not found in loaded states, run a small direct query
                if (!name) {
                    const { data: cl } = await supabaseAuth.from('classrooms').select('name').eq('id', row.classroom_id).maybeSingle();
                    if (cl) {
                        name = cl.name;
                    } else {
                        const { data: tc } = await supabaseAuth.from('temporary_classes').select('title').eq('id', row.classroom_id).maybeSingle();
                        name = tc?.title || 'Unknown Classroom';
                        isTemp = !!tc;
                    }
                }

                return {
                    id: row.id,
                    date: row.date,
                    status: row.status,
                    classroom_id: row.classroom_id,
                    classroom_name: name,
                    is_temporary: isTemp
                };
            }));

            setAttendanceLogs(resolvedLogs);
        } catch (err) {
            console.error('Error loading individual logs:', err);
        } finally {
            setLogsLoading(false);
        }
    }, [selectedStudent, fromDate, toDate, classrooms, temporaryClasses]);

    useEffect(() => {
        if (selectedStudent) {
            fetchIndividualLogs();
        }
    }, [selectedStudent, fromDate, toDate, fetchIndividualLogs]);

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

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8f8f6] dark:bg-[#221d10]">
                <Loader2 className="w-10 h-10 animate-spin text-[#ecb613] mb-4" />
                <p className="font-medium text-slate-600 dark:text-slate-400 tracking-wide uppercase text-xs">Syncing logs...</p>
            </div>
        );
    }

    return (
        <div className="bg-[#f8f8f6] dark:bg-[#221d10] text-[#0f172a] dark:text-slate-100 min-h-screen flex font-sans">
            <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

            <main className="flex-1 flex flex-col min-w-0">
                <header className="sticky top-0 z-30 flex items-center justify-between px-8 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Attendance Management</h2>
                        <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 mx-2"></div>
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-medium">
                            <CalendarIcon className="w-4 h-4" />
                            <span>{new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                    </div>
                </header>

                <div className="p-6 space-y-6 max-w-[1600px] mx-auto w-full flex-1 overflow-y-auto">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Today's Batches</p>
                                <h3 className="text-2xl font-black text-slate-950 dark:text-white mt-1">{activeBatchesOnSelectedDate.length}</h3>
                            </div>
                            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-[#ecb613] rounded-xl">
                                <School className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest font-sans">Total Scheduled Students</p>
                                <h3 className="text-2xl font-black text-slate-950 dark:text-white mt-1">{stats.total}</h3>
                            </div>
                            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-600 rounded-xl">
                                <Users className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest font-sans">Present / Late Today</p>
                                <h3 className="text-2xl font-black text-slate-950 dark:text-white mt-1 text-emerald-600">{stats.present}</h3>
                            </div>
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 rounded-xl">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="bg-[#ecb613] p-5 rounded-2xl shadow-lg shadow-[#ecb613]/10 flex items-center justify-between text-slate-900">
                            <div>
                                <p className="text-xs font-bold opacity-80 uppercase tracking-widest font-sans">Avg. Presence Rate</p>
                                <h3 className="text-3xl font-black">{stats.rate}</h3>
                            </div>
                            <div className="p-3 bg-white/20 rounded-xl">
                                <TrendingUp className="w-5 h-5 text-slate-950" />
                            </div>
                        </div>
                    </div>

                    {/* Mode Selector */}
                    <div className="flex items-center justify-between">
                        <div className="bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 flex gap-1 shadow-sm">
                            <button 
                                onClick={() => setMode('class')}
                                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${mode === 'class' ? 'bg-[#ecb613] text-slate-900 shadow-lg shadow-[#ecb613]/10' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                            >
                                Class Accordion Report
                            </button>
                            <button 
                                onClick={() => setMode('individual')}
                                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${mode === 'individual' ? 'bg-[#ecb613] text-slate-900 shadow-lg shadow-[#ecb613]/10' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                            >
                                Individual Range Report
                            </button>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="grid grid-cols-12 gap-5">
                        
                        {/* LEFT COLUMN: Calendar Picker (Width = 4) */}
                        <div className="col-span-12 lg:col-span-4 space-y-4">
                            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
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
                                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350'
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
                                    Dynamic Schedule Engine
                                </h4>
                                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                                    Days highlighted with a golden dot contain active batches mapped directly from weekly recurrences or one-off sessions.
                                </p>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Interactive lists (Width = 8) */}
                        <div className="col-span-12 lg:col-span-8 space-y-4">
                            
                            {/* ── MODE 1: CLASS MARKING (ACCORDION PATTERN) ────────────────── */}
                            {mode === 'class' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-2">
                                        <h4 className="font-extrabold text-slate-900 dark:text-white tracking-tight">
                                            Scheduled Batches on {new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </h4>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            {activeBatchesOnSelectedDate.length} Found
                                        </span>
                                    </div>

                                    {activeBatchesOnSelectedDate.map((batch) => {
                                        const isExpanded = expandedBatchId === batch.id;
                                        const batchRoster = batchStudentsMap[batch.id] || [];
                                        const batchAttendance = batchAttendanceMap[batch.id] || {};
                                        const isBatchLoading = batchLoadingMap[batch.id];
                                        const summary = batchSummaries[batch.id];

                                        return (
                                            <div 
                                                key={batch.id} 
                                                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300"
                                            >
                                                {/* Accordion Header */}
                                                <div 
                                                    onClick={() => handleExpandBatch(batch.id, batch.type === 'temporary')}
                                                    className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors select-none"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-3 rounded-xl flex items-center justify-center ${
                                                            batch.type === 'permanent'
                                                                ? 'bg-[#ecb613]/10 text-[#ecb613]'
                                                                : 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400'
                                                        }`}>
                                                            <School className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <h5 className="font-bold text-slate-900 dark:text-white text-base tracking-tight">{batch.name}</h5>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                                <span className="text-xs text-slate-500 dark:text-slate-400">{batch.time}</span>
                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                                    batch.type === 'permanent'
                                                                        ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600'
                                                                        : 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400'
                                                                }`}>
                                                                    {batch.type === 'permanent' ? '👥 Classroom' : '⚡ Temporary'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Summary Status indicator */}
                                                    <div className="flex items-center gap-3">
                                                        {summary && summary.total > 0 ? (
                                                            <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border border-emerald-100 dark:border-emerald-900 rounded-full">
                                                                Marked {summary.present + summary.late + summary.absent + summary.excused}/{summary.total}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-full">
                                                                No Students
                                                            </span>
                                                        )}
                                                        {isExpanded ? (
                                                            <ChevronUp className="w-5 h-5 text-slate-400" />
                                                        ) : (
                                                            <ChevronDown className="w-5 h-5 text-slate-400" />
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Accordion Content */}
                                                {isExpanded && (
                                                    <div className="border-t border-slate-100 dark:border-slate-800 p-5 bg-slate-50/50 dark:bg-slate-850/20">
                                                        {isBatchLoading ? (
                                                            <div className="flex flex-col items-center justify-center py-10">
                                                                <Loader2 className="w-6 h-6 animate-spin text-[#ecb613] mb-2" />
                                                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Loading Roster...</p>
                                                            </div>
                                                        ) : batchRoster.length > 0 ? (
                                                            <div className="space-y-3">
                                                                {batchRoster.map((student) => {
                                                                    const status = batchAttendance[student.id];
                                                                    return (
                                                                        <div 
                                                                            key={student.id} 
                                                                            className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                                                                        >
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
                                                                                    {student.profile_pic_url ? (
                                                                                        <img src={student.profile_pic_url} alt={student.name} className="w-full h-full object-cover" />
                                                                                    ) : (
                                                                                        <span className="text-[#ecb613] font-black text-sm">{student.name.charAt(0)}</span>
                                                                                    )}
                                                                                </div>
                                                                                <h6 className="font-extrabold text-slate-900 dark:text-white text-sm">{student.name}</h6>
                                                                            </div>

                                                                            <div className="flex items-center gap-1.5">
                                                                                {([
                                                                                    { key: 'present', label: 'Present', activeClass: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 border-emerald-500', inactiveClass: 'border-emerald-100 text-emerald-600 dark:border-emerald-950/20' },
                                                                                    { key: 'absent', label: 'Absent', activeClass: 'bg-rose-500 text-white shadow-lg shadow-rose-500/25 border-rose-500', inactiveClass: 'border-rose-100 text-rose-600 dark:border-rose-950/20' },
                                                                                    { key: 'late', label: 'Late', activeClass: 'bg-amber-500 text-white shadow-lg shadow-amber-500/25 border-amber-500', inactiveClass: 'border-amber-100 text-amber-600 dark:border-amber-950/20' },
                                                                                    { key: 'excused', label: 'Excused', activeClass: 'bg-slate-600 text-white shadow-lg shadow-slate-600/25 border-slate-600', inactiveClass: 'border-slate-200 text-slate-600 dark:border-slate-750' }
                                                                                ] as const).map(opt => {
                                                                                    const isActive = status === opt.key;
                                                                                    return (
                                                                                        <button
                                                                                            key={opt.key}
                                                                                            onClick={() => handleMarkBatchAttendance(batch.id, student.id, opt.key)}
                                                                                            className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border-2 transition-all duration-200 ${
                                                                                                isActive ? opt.activeClass : `${opt.inactiveClass} bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800`
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
                                                            <div className="py-6 text-center text-slate-400 text-xs font-semibold">
                                                                No students currently enrolled in this batch.
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {activeBatchesOnSelectedDate.length === 0 && (
                                        <div className="bg-white dark:bg-slate-900 p-12 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center">
                                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                                                <CalendarIcon className="w-8 h-8 text-slate-350" />
                                            </div>
                                            <h5 className="font-extrabold text-slate-400 tracking-tight">No batches scheduled</h5>
                                            <p className="text-xs text-slate-400 mt-1">Please select another date on the calendar, or schedule a classroom session.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── MODE 2: INDIVIDUAL RANGE HISTORY REPORT ──────────────────── */}
                            {mode === 'individual' && (
                                <div className="space-y-4">
                                    {/* Student Search bar */}
                                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
                                        <div className="relative">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                            <input 
                                                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-[#ecb613]/50 text-xs font-semibold outline-none transition-all placeholder:text-slate-400" 
                                                placeholder="Search student by name to get individual logs..."
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                            />
                                        </div>

                                        {/* Dropdown Suggestions */}
                                        {individualStudents.length > 0 && (
                                            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm max-h-[160px] overflow-y-auto">
                                                {individualStudents.map(student => (
                                                    <div 
                                                        key={student.id} 
                                                        onClick={() => {
                                                            setSelectedStudent(student);
                                                            setIndividualStudents([]);
                                                            setSearchQuery('');
                                                        }}
                                                        className="px-4 py-2.5 hover:bg-[#ecb613]/10 dark:hover:bg-[#ecb613]/20 flex items-center justify-between cursor-pointer border-b border-slate-100/55 dark:border-slate-700 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-100">
                                                                {student.profile_pic_url ? (
                                                                    <img src={student.profile_pic_url} alt={student.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span className="text-[#ecb613] font-black text-xs">{student.name.charAt(0)}</span>
                                                                )}
                                                            </div>
                                                            <span className="text-xs font-extrabold text-slate-900 dark:text-white">{student.name}</span>
                                                        </div>
                                                        <ChevronRight className="w-4 h-4 text-slate-400" />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Report Display Panel */}
                                    {selectedStudent ? (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                            {/* Profile Header & Custom Date Inputs */}
                                            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-slate-50 dark:border-slate-750 shadow-inner flex items-center justify-center overflow-hidden">
                                                        {selectedStudent.profile_pic_url ? (
                                                            <img src={selectedStudent.profile_pic_url} alt={selectedStudent.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-[#ecb613] text-xl font-black">{selectedStudent.name.charAt(0)}</span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h5 className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight">{selectedStudent.name}</h5>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Individual Performance Log</p>
                                                    </div>
                                                </div>

                                                {/* Date Range Inputs */}
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider pl-1">From</label>
                                                        <input 
                                                            type="date" 
                                                            value={fromDate}
                                                            onChange={(e) => setFromDate(e.target.value)}
                                                            className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-[#ecb613]/50 outline-none px-3 py-1.5 shadow-xs"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider pl-1">To</label>
                                                        <input 
                                                            type="date" 
                                                            value={toDate}
                                                            onChange={(e) => setToDate(e.target.value)}
                                                            className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-[#ecb613]/50 outline-none px-3 py-1.5 shadow-xs"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Report Statistics Summary */}
                                            {(() => {
                                                const totalLogs = attendanceLogs.length;
                                                const presentLogs = attendanceLogs.filter(l => l.status === 'present').length;
                                                const lateLogs = attendanceLogs.filter(l => l.status === 'late').length;
                                                const rateValue = totalLogs > 0 ? Math.round(((presentLogs + lateLogs) / totalLogs) * 100) : 0;
                                                
                                                return (
                                                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800 shadow-xs">
                                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Logs</p>
                                                            <h5 className="text-xl font-black mt-1 text-slate-950 dark:text-white">{totalLogs}</h5>
                                                        </div>
                                                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800 shadow-xs">
                                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-emerald-600">Present Days</p>
                                                            <h5 className="text-xl font-black mt-1 text-emerald-600">{presentLogs}</h5>
                                                        </div>
                                                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800 shadow-xs">
                                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-rose-600">Absent Days</p>
                                                            <h5 className="text-xl font-black mt-1 text-rose-600">{attendanceLogs.filter(l => l.status === 'absent').length}</h5>
                                                        </div>
                                                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800 shadow-xs">
                                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-amber-500 font-sans">Attendance Rate</p>
                                                            <h5 className="text-xl font-black mt-1 text-slate-900 dark:text-slate-100">{rateValue}%</h5>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Log Results Table */}
                                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                                {logsLoading ? (
                                                    <div className="flex flex-col items-center justify-center py-20">
                                                        <Loader2 className="w-6 h-6 animate-spin text-[#ecb613] mb-2" />
                                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Querying history logs...</p>
                                                    </div>
                                                ) : attendanceLogs.length > 0 ? (
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-left border-collapse min-w-[500px]">
                                                            <thead>
                                                                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                                                                    <th className="px-5 py-3 text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider">Date</th>
                                                                    <th className="px-5 py-3 text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider">Classroom / Batch</th>
                                                                    <th className="px-5 py-3 text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider">Type</th>
                                                                    <th className="px-5 py-3 text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider text-right">Status</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                                                                {attendanceLogs.map((log) => (
                                                                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 transition-colors">
                                                                        <td className="px-5 py-4 text-xs font-bold text-slate-800 dark:text-slate-300">
                                                                            {new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                        </td>
                                                                        <td className="px-5 py-4 text-xs font-extrabold text-slate-950 dark:text-white">
                                                                            {log.classroom_name}
                                                                        </td>
                                                                        <td className="px-5 py-4">
                                                                            <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                                                                log.is_temporary
                                                                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                                                                                    : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700'
                                                                            }`}>
                                                                                {log.is_temporary ? 'Temporary' : 'Classroom'}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-5 py-4 text-right">
                                                                            <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                                                                log.status === 'present'
                                                                                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20'
                                                                                    : log.status === 'absent'
                                                                                    ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20'
                                                                                    : log.status === 'late'
                                                                                    ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20'
                                                                                    : log.status === 'excused'
                                                                                    ? 'bg-slate-50 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400'
                                                                                    : 'bg-slate-50 text-slate-500 dark:bg-slate-800'
                                                                            }`}>
                                                                                {log.status}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : (
                                                    <div className="py-12 text-center">
                                                        <CalendarIcon className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                                                        <h6 className="font-extrabold text-slate-400">No attendance logs found</h6>
                                                        <p className="text-xs text-slate-400 mt-1">There are no attendance records for this student in the selected range.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-white dark:bg-slate-900 p-12 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center">
                                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                                                <User className="w-8 h-8 text-slate-350" />
                                            </div>
                                            <h5 className="font-extrabold text-slate-400 tracking-tight">No student selected</h5>
                                            <p className="text-xs text-slate-400 mt-1">Please search and select a student above to construct their range-query logs.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}
