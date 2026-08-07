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
    Check,
    X,
    ChevronDown,
    ChevronUp,
    BookOpen,
    User,
    Calendar,
    ArrowRight
} from 'lucide-react';
import TeacherSidebar from '../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../src/components/TeacherHeader';

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
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string; role?: string } | null>(null);
    
    // UI State
    const [mode, setMode] = useState<'class' | 'individual' | 'missed' | 'leaves'>('class');
    const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
    const [leavesLoading, setLeavesLoading] = useState(false);
    const [leavesFilter, setLeavesFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const dateParam = params.get('date');
            if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
                return dateParam;
            }
        }
        return new Date().toISOString().split('T')[0];
    });
    const [viewDate, setViewDate] = useState(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const dateParam = params.get('date');
            if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
                return new Date(dateParam);
            }
        }
        return new Date();
    }); // Calendar month being displayed
    const [searchQuery, setSearchQuery] = useState('');
    
    // Core Data State
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [allSchedules, setAllSchedules] = useState<BatchSchedule[]>([]);
    const [temporaryClasses, setTemporaryClasses] = useState<TemporaryClass[]>([]);
    
    // Expanded batch state
    const [expandedBatchId, setExpandedBatchId] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            return params.get('classId');
        }
        return null;
    });
    const [batchStudentsMap, setBatchStudentsMap] = useState<Record<string, Student[]>>({});
    const [batchAttendanceMap, setBatchAttendanceMap] = useState<Record<string, Record<string, 'present' | 'absent' | 'late' | 'excused'>>>({});
    const [batchLoadingMap, setBatchLoadingMap] = useState<Record<string, boolean>>({});
    const [batchSummaries, setBatchSummaries] = useState<Record<string, { present: number; absent: number; late: number; excused: number; total: number }>>({});
    
    // Individual Search Report State
    const [individualStudents, setIndividualStudents] = useState<Student[]>([]);
    const [individualLoading, setIndividualLoading] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

    // Missed Classes Report State
    const [missedLogs, setMissedLogs] = useState<any[]>([]);
    const [missedLoading, setMissedLoading] = useState(false);
    const [studentOverrides, setStudentOverrides] = useState<any[]>([]);
    const [missedStatusFilter, setMissedStatusFilter] = useState<'all' | 'absent' | 'excused'>('all');
    const [missedSearchQuery, setMissedSearchQuery] = useState('');

    // Schedule Makeup Modal State
    const [showMakeupModal, setShowMakeupModal] = useState(false);
    const [makeupStudent, setMakeupStudent] = useState<any | null>(null);
    const [makeupDate, setMakeupDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [makeupClassroomId, setMakeupClassroomId] = useState<string>('');
    const [makeupReason, setMakeupReason] = useState<string>('');
    const [isSavingMakeup, setIsSavingMakeup] = useState(false);
    const [editingMakeupId, setEditingMakeupId] = useState<string | null>(null);
    const [excusedSuggestions, setExcusedSuggestions] = useState<any[]>([]);
    const [completedMissedLogs, setCompletedMissedLogs] = useState<any[]>([]);
    const [historyStudent, setHistoryStudent] = useState<any | null>(null);
    const [studentHistoryLogs, setStudentHistoryLogs] = useState<any[]>([]);
    const [studentRescheduleChains, setStudentRescheduleChains] = useState<any[]>([]);
    const [activeHistoryTab, setActiveHistoryTab] = useState<'chains' | 'timeline'>('chains');
    const [historyLoading, setHistoryLoading] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);

    const formatLocalDateStr = useCallback((dateStr: string, includeYear = false, locale = 'en-IN', options?: Intl.DateTimeFormatOptions) => {
        if (!dateStr) return '';
        const cleanDate = dateStr.split('T')[0].split(' ')[0];
        const parts = cleanDate.split('-');
        if (parts.length !== 3) return dateStr;
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (options) {
            return d.toLocaleDateString(locale, options);
        }
        return d.toLocaleDateString(locale, { 
            day: 'numeric', 
            month: 'short', 
            ...(includeYear ? { year: 'numeric' } : {}) 
        });
    }, []);
 
    const stripMissedDateTag = useCallback((reasonStr: string) => {
        if (!reasonStr) return '';
        return reasonStr.replace(/^\[MissedDate:[^\]]+\]\s*/, '');
    }, []);

    const initialFromDate = useMemo(() => {
        const d = new Date();
        const pastDate = new Date(d.getTime() - 60 * 24 * 60 * 60 * 1000);
        const year = pastDate.getFullYear();
        const month = String(pastDate.getMonth() + 1).padStart(2, '0');
        const day = String(pastDate.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }, []);
    const initialToDate = useMemo(() => {
        const d = new Date();
        // Set default to end of next month so future excused leaves are visible for scheduling makeups
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 2, 0);
        const year = lastDay.getFullYear();
        const month = String(lastDay.getMonth() + 1).padStart(2, '0');
        const day = String(lastDay.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }, []);
    const [fromDate, setFromDate] = useState<string>(initialFromDate);
    const [toDate, setToDate] = useState<string>(initialToDate);
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
        return `${hours}:${m} ${ampm}`;
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

                if (profile?.role !== 'teacher' && profile?.role !== 'admin') {
                    router.push('/');
                    return;
                }

                setTeacherProfile({ id: profile.id, name: profile.name, email: profile.email, role: profile.role });
                const isAdmin = profile.role === 'admin';
                
                // 1. Fetch classrooms
                const classesQuery = supabaseAuth
                    .from('classrooms')
                    .select('id, name');
                const { data: classesData } = isAdmin
                    ? await classesQuery
                    : await classesQuery.eq('teacher_id', session.user.id);
                
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
                const tempClassesQuery = supabaseAuth
                    .from('temporary_classes')
                    .select('*');
                const { data: tempClassesData } = isAdmin
                    ? await tempClassesQuery
                    : await tempClassesQuery.eq('teacher_id', session.user.id);
                
                const loadedTempClasses = tempClassesData || [];
                setTemporaryClasses(loadedTempClasses);

                // Validate expandedBatchId from URL
                if (expandedBatchId && !isAdmin) {
                    const isOwnClass = loadedTempClasses.some(tc => tc.id === expandedBatchId) ||
                                       loadedClassrooms.some(c => c.id === expandedBatchId);
                    if (!isOwnClass) {
                        setExpandedBatchId(null);
                    }
                }

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
                        const { count } = await supabaseAuth
                            .from('session_student_overrides')
                            .select('*', { count: 'exact', head: true })
                            .eq('target_classroom_id', batch.id)
                            .eq('override_date', selectedDate);
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

        const isAdmin = teacherProfile?.role === 'admin';
        if (!isAdmin) {
            const isOwnClass = isTemporary
                ? temporaryClasses.some(tc => tc.id === batchId)
                : classrooms.some(c => c.id === batchId);
            if (!isOwnClass) {
                console.error("Authorization error: batch does not belong to this teacher.");
                alert("You are not authorized to view this classroom's attendance.");
                setExpandedBatchId(null);
                return;
            }
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
                        .select('student_id, users!student_id(name, profile_pic_url, teacher_id)')
                        .eq('classroom_id', batchId);
                    
                    const permRoster = (permanentStudents || [])
                        .filter((row: any) => isAdmin || row.users?.teacher_id === teacherProfile?.id)
                        .map((row: any) => ({
                            id: row.student_id,
                            name: row.users?.name || 'Unknown Student',
                            profile_pic_url: row.users?.profile_pic_url
                        }));

                    // Fetch temporary session override (makeup) students for this date
                    const { data: overrideStudents } = await supabaseAuth
                        .from('session_student_overrides')
                        .select('student_id, users!student_id(name, profile_pic_url, teacher_id)')
                        .eq('target_classroom_id', batchId)
                        .eq('override_date', selectedDate);

                    const tempRoster = (overrideStudents || [])
                        .filter((row: any) => isAdmin || row.users?.teacher_id === teacherProfile?.id)
                        .map((row: any) => ({
                            id: row.student_id,
                            name: `${row.users?.name || 'Unknown Student'} (Makeup)`,
                            profile_pic_url: row.users?.profile_pic_url
                        }));

                    roster = [...permRoster, ...tempRoster];
                } else {
                    const { data: tempStudents } = await supabaseAuth
                        .from('session_student_overrides')
                        .select('student_id, users!student_id(name, profile_pic_url, teacher_id)')
                        .eq('target_classroom_id', batchId)
                        .eq('override_date', selectedDate);
                    
                    roster = (tempStudents || [])
                        .filter((row: any) => isAdmin || row.users?.teacher_id === teacherProfile?.id)
                        .map((row: any) => ({
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

    const fetchLeaveRequests = useCallback(async (loadedRooms = classrooms) => {
        if (loadedRooms.length === 0) return;
        setLeavesLoading(true);
        try {
            const roomIds = loadedRooms.map(c => c.id);
            const { data: leaves, error } = await supabaseAuth
                .from('leave_requests')
                .select(`
                    id,
                    student_id,
                    classroom_id,
                    class_date,
                    reason,
                    status,
                    created_at,
                    users!student_id(name, email, profile_pic_url, teacher_id),
                    classrooms!classroom_id(name)
                `)
                .in('classroom_id', roomIds)
                .order('created_at', { ascending: false });
            if (error) throw error;
            
            const isAdmin = teacherProfile?.role === 'admin';
            const filteredLeaves = (leaves || []).filter((l: any) => isAdmin || l.users?.teacher_id === teacherProfile?.id);
            setLeaveRequests(filteredLeaves);
        } catch (err) {
            console.error('Error fetching leave requests:', err);
        } finally {
            setLeavesLoading(false);
        }
    }, [classrooms, teacherProfile]);

    // Fetch leave requests when teacherProfile or classrooms load
    useEffect(() => {
        if (teacherProfile) {
            fetchLeaveRequests();
        }
    }, [teacherProfile, fetchLeaveRequests]);

    const handleApproveLeave = async (request: any) => {
        if (!teacherProfile) return;
        try {
            const { error: updateError } = await supabaseAuth
                .from('leave_requests')
                .update({ status: 'approved', updated_at: new Date().toISOString() })
                .eq('id', request.id);

            if (updateError) throw updateError;

            const { error: attendanceError } = await supabaseAuth
                .from('attendance')
                .upsert({
                    student_id: request.student_id,
                    classroom_id: request.classroom_id,
                    date: request.class_date,
                    status: 'excused',
                    marked_by: teacherProfile.id
                }, { onConflict: 'student_id, classroom_id, date' });

            if (attendanceError) throw attendanceError;

            fetchLeaveRequests();
        } catch (err) {
            console.error('Error approving leave:', err);
            alert('Failed to approve leave request.');
        }
    };

    const handleRejectLeave = async (request: any) => {
        try {
            const { error: updateError } = await supabaseAuth
                .from('leave_requests')
                .update({ status: 'rejected', updated_at: new Date().toISOString() })
                .eq('id', request.id);

            if (updateError) throw updateError;

            fetchLeaveRequests();
        } catch (err) {
            console.error('Error rejecting leave:', err);
            alert('Failed to reject leave request.');
        }
    };

    // Quick Mark inside expanded batch
    const handleMarkBatchAttendance = async (
        batchId: string, 
        studentId: string, 
        status: 'present' | 'absent' | 'late' | 'excused'
    ) => {
        if (!teacherProfile) return;

        const isAdmin = teacherProfile.role === 'admin';
        if (!isAdmin) {
            const isOwnClass = temporaryClasses.some(tc => tc.id === batchId) ||
                               classrooms.some(c => c.id === batchId);
            if (!isOwnClass) {
                alert("You are not authorized to mark attendance for this class.");
                return;
            }
        }

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

            // Trigger refresh of missed report so changed status updates immediately
            fetchMissedReport();

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
                const studentsQuery = supabaseAuth
                    .from('users')
                    .select('id, name, profile_pic_url')
                    .or('role.eq.student,role.eq.pending')
                    .ilike('name', `%${searchQuery}%`);
                
                const { data } = teacherProfile.role === 'admin'
                    ? await studentsQuery
                    : await studentsQuery.eq('teacher_id', teacherProfile.id);
                
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

    const fetchMissedReport = useCallback(async () => {
        if (!teacherProfile) return;
        setMissedLoading(true);
        try {
            // 1. Fetch teacher's/all student IDs
            const studentsQuery = supabaseAuth
                .from('users')
                .select('id')
                .or('role.eq.student,role.eq.pending');

            const { data: studentsData, error: studentsErr } = teacherProfile.role === 'admin'
                ? await studentsQuery
                : await studentsQuery.eq('teacher_id', teacherProfile.id);

            if (studentsErr) throw studentsErr;
            const studentIds = (studentsData || []).map(s => s.id);

            if (studentIds.length === 0) {
                setMissedLogs([]);
                setStudentOverrides([]);
                return;
            }

            // 2. Fetch all student overrides (makeups) to match later (sorted chronologically)
            const { data: overridesData, error: overridesErr } = await supabaseAuth
                .from('session_student_overrides')
                .select('id, student_id, target_classroom_id, override_date, reason')
                .in('student_id', studentIds)
                .order('override_date', { ascending: true });

            if (overridesErr) {
                console.error('Error fetching overrides:', overridesErr);
            }
            setStudentOverrides(overridesData || []);

            // 3. Fetch all attendance records of these students to check if they attended makeup classes
            const { data: attendanceDataForMakeup } = await supabaseAuth
                .from('attendance')
                .select('student_id, classroom_id, date, status')
                .in('student_id', studentIds);

            const attendanceMap: Record<string, string> = {};
            (attendanceDataForMakeup || []).forEach((r: any) => {
                const cleanDate = r.date.split('T')[0].split(' ')[0];
                const key = `${r.student_id}_${r.classroom_id}_${cleanDate}`;
                attendanceMap[key] = r.status;
            });

            // 4. Fetch attendance logs where status is absent or excused
            const statuses = missedStatusFilter === 'all' ? ['absent', 'excused'] : [missedStatusFilter];
            const { data: logsData, error: logsErr } = await supabaseAuth
                .from('attendance')
                .select(`
                    id,
                    date,
                    status,
                    classroom_id,
                    student_id,
                    users!student_id(name, profile_pic_url)
                `)
                .in('student_id', studentIds)
                .in('status', statuses)
                .gte('date', fromDate)
                .lte('date', toDate)
                .order('date', { ascending: false });

            if (logsErr) throw logsErr;

            // Filter out logs that are actually missed makeup classes (overrides)
            // so they don't count as separate root missed classes.
            const regularLogs = (logsData || []).filter((r: any) => {
                const rDateClean = r.date.split('T')[0].split(' ')[0];
                const isOverride = (overridesData || []).some((o: any) => {
                    if (!o.override_date) return false;
                    const oDateClean = o.override_date.split('T')[0].split(' ')[0];
                    return o.student_id === r.student_id && 
                           o.target_classroom_id === r.classroom_id && 
                           oDateClean === rDateClean;
                });
                return !isOverride;
            });

            // 5. Resolve classroom names and check makeup completion status
            const resolved = await Promise.all(regularLogs.map(async (row: any) => {
                let name = classrooms.find(c => c.id === row.classroom_id)?.name;
                let isTemp = false;

                if (!name) {
                    const temp = temporaryClasses.find(tc => tc.id === row.classroom_id);
                    if (temp) {
                        name = temp.title;
                        isTemp = true;
                    }
                }

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

                // Find matching scheduled makeup override
                // Find matching scheduled makeup override (recursively trace chain)
                const logDateClean = row.date.split('T')[0].split(' ')[0];
                let initialMakeup = (overridesData || []).find((o: any) => {
                    if (!o.override_date || !row.date) return false;
                    const oDate = o.override_date.split('T')[0].split(' ')[0];
                    
                    // First try strict match with [MissedDate:YYYY-MM-DD] tag in reason
                    if (o.reason && o.reason.includes(`[MissedDate:${logDateClean}]`)) {
                        return o.student_id === row.student_id;
                    }
                    
                    // Fallback to date order if no tag
                    return o.student_id === row.student_id && oDate >= logDateClean;
                });

                let currentMakeup = initialMakeup;
                let visited = new Set();
                while (currentMakeup) {
                    if (visited.has(currentMakeup.id)) break;
                    visited.add(currentMakeup.id);
                    
                    const mDateClean = currentMakeup.override_date.split('T')[0].split(' ')[0];
                    const key = `${row.student_id}_${currentMakeup.target_classroom_id}_${mDateClean}`;
                    const attStatus = attendanceMap[key];
                    
                    if (attStatus === 'absent' || attStatus === 'excused') {
                        // It was missed! Find if there is another override scheduled for this missed date
                        const nextMakeup = (overridesData || []).find((o: any) => {
                            if (!o.override_date) return false;
                            const oDateClean = o.override_date.split('T')[0].split(' ')[0];
                            if (o.reason && o.reason.includes(`[MissedDate:${mDateClean}]`)) {
                                return o.student_id === row.student_id;
                            }
                            return o.student_id === row.student_id && oDateClean > mDateClean;
                        });
                        
                        if (nextMakeup && nextMakeup.id !== currentMakeup.id) {
                            currentMakeup = nextMakeup;
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }

                // Check if this scheduled makeup is completed/success or missed
                let isMakeupCompleted = false;
                let isMakeupMissed = false;
                let makeupAttendanceStatus = '';
                if (currentMakeup) {
                    const mDateClean = currentMakeup.override_date.split('T')[0].split(' ')[0];
                    const key = `${row.student_id}_${currentMakeup.target_classroom_id}_${mDateClean}`;
                    const attStatus = attendanceMap[key];
                    if (attStatus === 'present' || attStatus === 'late') {
                        isMakeupCompleted = true;
                        makeupAttendanceStatus = attStatus;
                    } else if (attStatus === 'absent' || attStatus === 'excused') {
                        isMakeupMissed = true;
                    }
                }

                return {
                    id: row.id,
                    date: row.date,
                    status: row.status,
                    classroom_id: row.classroom_id,
                    classroom_name: name,
                    is_temporary: isTemp,
                    student_id: row.student_id,
                    student_name: row.users?.name || 'Unknown Student',
                    student_profile_pic_url: row.users?.profile_pic_url,
                    scheduledMakeup: currentMakeup,
                    isMakeupCompleted,
                    isMakeupMissed,
                    makeupAttendanceStatus
                };
            }));

            // Filter by search query if any
            let finalLogs = resolved;
            if (missedSearchQuery.trim()) {
                const query = missedSearchQuery.toLowerCase();
                finalLogs = resolved.filter(log => log.student_name.toLowerCase().includes(query));
            }

            const pending = finalLogs.filter(log => !log.isMakeupCompleted);
            const completed = finalLogs.filter(log => log.isMakeupCompleted);

            setMissedLogs(pending);
            setCompletedMissedLogs(completed);
        } catch (err) {
            console.error('Error fetching missed classes report:', err);
        } finally {
            setMissedLoading(false);
        }
    }, [teacherProfile, fromDate, toDate, missedStatusFilter, missedSearchQuery, classrooms, temporaryClasses]);

    useEffect(() => {
        if (mode === 'missed') {
            fetchMissedReport();
        }
    }, [mode, fromDate, toDate, missedStatusFilter, missedSearchQuery, fetchMissedReport]);

    const fetchStudentHistory = async (studentId: string, studentName: string) => {
        setHistoryStudent({ id: studentId, name: studentName });
        setShowHistoryModal(true);
        setHistoryLoading(true);
        try {
            // 1. Fetch all attendance logs for this student
            const { data: attLogs, error: attErr } = await supabaseAuth
                .from('attendance')
                .select('id, date, status, classroom_id')
                .eq('student_id', studentId)
                .order('date', { ascending: true });

            if (attErr) throw attErr;

            // 2. Fetch all overrides for this student
            const { data: overrides, error: overErr } = await supabaseAuth
                .from('session_student_overrides')
                .select('id, target_classroom_id, override_date, reason')
                .eq('student_id', studentId)
                .order('override_date', { ascending: true });

            if (overErr) throw overErr;

            // Build chronological timeline of events
            const timelineEvents: any[] = [];

            // Helper to get classroom name
            const getClassroomName = (cId: string) => {
                let name = classrooms.find(c => c.id === cId)?.name;
                if (!name) {
                    const temp = temporaryClasses.find(tc => tc.id === cId);
                    if (temp) name = temp.title;
                }
                return name || 'Unknown Classroom';
            };

            const overrideDates = new Set((overrides || []).map(o => o.override_date.split('T')[0].split(' ')[0]));

            // Add missed classes (absent/excused records from regular classes)
            (attLogs || []).forEach((att: any) => {
                const attDate = att.date.split('T')[0].split(' ')[0];
                const isOverrideDate = overrideDates.has(attDate);
                const className = getClassroomName(att.classroom_id);

                if (isOverrideDate) {
                    // This is attendance marked for a makeup class
                    timelineEvents.push({
                        type: 'makeup_attendance',
                        date: attDate,
                        status: att.status,
                        classroomId: att.classroom_id,
                        classroomName: className,
                        details: `Attended makeup session in ${className}. Status: ${att.status.toUpperCase()}`
                    });
                } else if (att.status === 'absent' || att.status === 'excused') {
                    // This is a regular missed class
                    timelineEvents.push({
                        type: 'missed_class',
                        date: attDate,
                        status: att.status,
                        classroomId: att.classroom_id,
                        classroomName: className,
                        details: `Missed regular class ${className}. Status: ${att.status.toUpperCase()}`
                    });
                } else {
                    // Regular present attendance
                    timelineEvents.push({
                        type: 'regular_attendance',
                        date: attDate,
                        status: att.status,
                        classroomId: att.classroom_id,
                        classroomName: className,
                        details: `Attended regular class ${className}. Status: ${att.status.toUpperCase()}`
                    });
                }
            });

            // Add scheduled makeups
            (overrides || []).forEach((o: any) => {
                const oDate = o.override_date.split('T')[0].split(' ')[0];
                const className = getClassroomName(o.target_classroom_id);
                timelineEvents.push({
                    type: 'makeup_scheduled',
                    date: oDate,
                    classroomId: o.target_classroom_id,
                    classroomName: className,
                    reason: o.reason,
                    details: `Rescheduled makeup class in ${className}. Reason: ${stripMissedDateTag(o.reason || 'No reason provided')}`
                });
            });

            // Sort timeline chronologically (by date, and then logically by type priority)
            const typePriority: Record<string, number> = {
                'regular_attendance': 1,
                'missed_class': 2,
                'makeup_scheduled': 3,
                'makeup_attendance': 4
            };
            timelineEvents.sort((a, b) => {
                const dateComp = a.date.localeCompare(b.date);
                if (dateComp !== 0) return dateComp;
                const pA = typePriority[a.type] || 99;
                const pB = typePriority[b.type] || 99;
                return pA - pB;
            });

            setStudentHistoryLogs(timelineEvents);

            // Build reschedule chains
            const missedSessions = (attLogs || []).filter((att: any) => att.status === 'absent' || att.status === 'excused');
            missedSessions.sort((a: any, b: any) => a.date.localeCompare(b.date));

            const dateToOverride = new Map();
            const matchedOverrideIds = new Set();

            // First pass: Match by strict tag [MissedDate:YYYY-MM-DD]
            (overrides || []).forEach((o: any) => {
                if (o.reason) {
                    const match = o.reason.match(/\[MissedDate:(\d{4}-\d{2}-\d{2})\]/);
                    if (match) {
                        const missedDate = match[1];
                        dateToOverride.set(missedDate, o);
                        matchedOverrideIds.add(o.id);
                    }
                }
            });

            // Second pass: Match remaining overrides using date order (fallback)
            (overrides || []).forEach((o: any) => {
                if (matchedOverrideIds.has(o.id)) return;
                if (!o.override_date) return;
                const oDateClean = o.override_date.split('T')[0].split(' ')[0];
                const unmatchedMissed = missedSessions.find((m: any) => {
                    const mDateClean = m.date.split('T')[0].split(' ')[0];
                    return mDateClean <= oDateClean && !dateToOverride.has(mDateClean);
                });
                if (unmatchedMissed) {
                    const mDateClean = unmatchedMissed.date.split('T')[0].split(' ')[0];
                    dateToOverride.set(mDateClean, o);
                    matchedOverrideIds.add(o.id);
                }
            });

            const isMakeupMissedCheck = (m: any) => {
                const mDateClean = m.date.split('T')[0].split(' ')[0];
                return (overrides || []).some((o: any) => {
                    if (!o.override_date) return false;
                    const oDateClean = o.override_date.split('T')[0].split(' ')[0];
                    return o.target_classroom_id === m.classroom_id && oDateClean === mDateClean;
                });
            };

            const chains: any[] = [];
            const rootMissed = missedSessions.filter((m: any) => !isMakeupMissedCheck(m));

            rootMissed.forEach((root: any) => {
                const chain: any = {
                    root,
                    reschedules: []
                };

                let currentSession = root;
                let visited = new Set();

                while (currentSession) {
                    const curDateClean = currentSession.date.split('T')[0].split(' ')[0];
                    if (visited.has(curDateClean)) break;
                    visited.add(curDateClean);

                    const override = dateToOverride.get(curDateClean);
                    if (override) {
                        const oDateClean = override.override_date.split('T')[0].split(' ')[0];
                        
                        // Find if this override itself was missed
                        const missedAttendance = missedSessions.find((m: any) => {
                            const mDateClean = m.date.split('T')[0].split(' ')[0];
                            return m.classroom_id === override.target_classroom_id && mDateClean === oDateClean;
                        });

                        // Find if this override was attended
                        const attendedAttendance = (attLogs || []).find((att: any) => {
                            const attDateClean = att.date.split('T')[0].split(' ')[0];
                            return att.classroom_id === override.target_classroom_id &&
                                   attDateClean === oDateClean &&
                                   (att.status === 'present' || att.status === 'late');
                        });

                        let status = 'pending';
                        if (missedAttendance) {
                            status = 'missed';
                        } else if (attendedAttendance) {
                            status = 'attended';
                        }

                        chain.reschedules.push({
                            override,
                            status,
                            classroomName: getClassroomName(override.target_classroom_id)
                        });

                        if (missedAttendance) {
                            currentSession = missedAttendance;
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }
                chains.push(chain);
            });

            setStudentRescheduleChains(chains);
        } catch (err) {
            console.error('Error fetching student history:', err);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleSaveMakeup = async () => {
        let targetId = makeupClassroomId;
        if (!targetId && classrooms.length > 0) {
            targetId = classrooms[0].id;
        }
        if (!makeupStudent || !targetId || !makeupDate) {
            alert(`Please fill out all required fields. (Student: ${makeupStudent ? 'Yes' : 'No'}, Classroom: ${targetId ? 'Yes' : 'No'}, Date: ${makeupDate ? 'Yes' : 'No'})`);
            return;
        }
        setIsSavingMakeup(true);
        try {
            // Ensure the reason starts with [MissedDate:YYYY-MM-DD] tag for accurate matching
            const tag = `[MissedDate:${makeupStudent.date}]`;
            let cleanReason = makeupReason || '';
            if (!cleanReason.includes(tag)) {
                cleanReason = `${tag} ${cleanReason}`.trim();
            }

            if (editingMakeupId) {
                const { error } = await supabaseAuth
                    .from('session_student_overrides')
                    .update({
                        target_classroom_id: targetId,
                        override_date: makeupDate,
                        reason: cleanReason || null
                    })
                    .eq('id', editingMakeupId);

                if (error) {
                    throw new Error(error.message + (error.details ? ` (${error.details})` : '') + (error.hint ? ` [${error.hint}]` : ''));
                }
                alert('Makeup class rescheduled successfully!');
            } else {
                const { error } = await supabaseAuth
                    .from('session_student_overrides')
                    .insert([{
                        student_id: makeupStudent.student_id,
                        target_classroom_id: targetId,
                        override_date: makeupDate,
                        reason: cleanReason || null
                    }]);

                if (error) {
                    throw new Error(error.message + (error.details ? ` (${error.details})` : '') + (error.hint ? ` [${error.hint}]` : ''));
                }
                alert('Makeup class scheduled successfully!');
            }
            setShowMakeupModal(false);
            // Reset modal states
            setMakeupStudent(null);
            setMakeupClassroomId('');
            setMakeupReason('');
            setEditingMakeupId(null);
            // Refresh missed classes report
            await fetchMissedReport();
        } catch (err: any) {
            console.error('Error saving makeup override:', err);
            const errMsg = err.message || String(err);
            if (errMsg.includes('23505') || errMsg.includes('unique_violation') || errMsg.includes('unique constraint') || errMsg.includes('already exists')) {
                alert('A makeup class is already scheduled for this student in this classroom on the selected date. Please choose a different classroom or date.');
            } else {
                alert(`Failed to save makeup class: ${errMsg}`);
            }
        } finally {
            setIsSavingMakeup(false);
        }
    };

    const handleCloseModal = () => {
        setShowMakeupModal(false);
        setMakeupStudent(null);
        setMakeupClassroomId('');
        setMakeupReason('');
        setEditingMakeupId(null);
    };

    const fetchExcusedSuggestions = useCallback(async (dateStr: string) => {
        if (!teacherProfile) return;
        try {
            const { data, error } = await supabaseAuth
                .from('attendance')
                .select(`
                    classroom_id,
                    student_id,
                    users!student_id(name)
                `)
                .eq('date', dateStr)
                .eq('status', 'excused');

            if (error) throw error;

            const counts: Record<string, { name: string; studentNames: string[] }> = {};
            (data || []).forEach((row: any) => {
                const cid = row.classroom_id;
                const roomName = classrooms.find(c => c.id === cid)?.name || 'Classroom';
                const studentName = row.users?.name || 'Unknown Student';
                if (!counts[cid]) {
                    counts[cid] = { name: roomName, studentNames: [] };
                }
                counts[cid].studentNames.push(studentName);
            });

            const suggestions = Object.entries(counts).map(([cid, info]) => ({
                classroomId: cid,
                classroomName: info.name,
                excusedCount: info.studentNames.length,
                excusedStudents: info.studentNames
            }));

            setExcusedSuggestions(suggestions);
        } catch (err) {
            console.error('Error fetching excused suggestions:', err);
        }
    }, [teacherProfile, classrooms]);

    useEffect(() => {
        if (showMakeupModal && makeupDate) {
            fetchExcusedSuggestions(makeupDate);
        } else {
            setExcusedSuggestions([]);
        }
    }, [showMakeupModal, makeupDate, fetchExcusedSuggestions]);

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

            <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
                <TeacherHeader 
                    title="Attendance" 
                    backLink={teacherProfile?.role === 'admin' ? '/admin-dashboard' : '/teacher-dashboard'}
                />

                <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 w-full flex-1 overflow-y-auto">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">Today's Batches</p>
                                <h3 className="text-lg sm:text-2xl font-black text-slate-950 dark:text-white mt-1">{activeBatchesOnSelectedDate.length}</h3>
                            </div>
                            <div className="p-2 sm:p-3 bg-amber-50 dark:bg-amber-950/20 text-[#ecb613] rounded-xl shrink-0">
                                <School className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest font-sans">Scheduled Students</p>
                                <h3 className="text-lg sm:text-2xl font-black text-slate-950 dark:text-white mt-1">{stats.total}</h3>
                            </div>
                            <div className="p-2 sm:p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-600 rounded-xl shrink-0">
                                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest font-sans">Present / Late</p>
                                <h3 className="text-lg sm:text-2xl font-black text-slate-950 dark:text-white mt-1 text-emerald-600">{stats.present}</h3>
                            </div>
                            <div className="p-2 sm:p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 rounded-xl shrink-0">
                                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                        </div>
                        <div className="bg-[#ecb613] p-4 sm:p-5 rounded-2xl shadow-lg shadow-[#ecb613]/10 flex items-center justify-between text-slate-900">
                            <div>
                                <p className="text-[10px] sm:text-xs font-bold opacity-80 uppercase tracking-widest font-sans">Presence Rate</p>
                                <h3 className="text-lg sm:text-3xl font-black">{stats.rate}</h3>
                            </div>
                            <div className="p-2 sm:p-3 bg-white/20 rounded-xl shrink-0">
                                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950" />
                            </div>
                        </div>
                    </div>

                    {/* Mode Selector */}
                    <div className="flex items-center justify-between w-full">
                        <div className="bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap sm:flex-nowrap gap-1 shadow-sm w-full sm:w-auto">
                            <button 
                                onClick={() => setMode('class')}
                                className={`px-2 py-2 sm:px-6 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex-1 sm:flex-initial text-center ${mode === 'class' ? 'bg-[#ecb613] text-slate-900 shadow-lg shadow-[#ecb613]/10' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                            >
                                <span className="hidden sm:inline">Class Accordion Report</span>
                                <span className="sm:hidden">Class Batches</span>
                            </button>
                            <button 
                                onClick={() => setMode('individual')}
                                className={`px-2 py-2 sm:px-6 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex-1 sm:flex-initial text-center ${mode === 'individual' ? 'bg-[#ecb613] text-slate-900 shadow-lg shadow-[#ecb613]/10' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                            >
                                <span className="hidden sm:inline">Individual Range Report</span>
                                <span className="sm:hidden">Individual</span>
                            </button>
                            <button 
                                onClick={() => setMode('missed')}
                                className={`px-2 py-2 sm:px-6 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex-1 sm:flex-initial text-center ${mode === 'missed' ? 'bg-[#ecb613] text-slate-900 shadow-lg shadow-[#ecb613]/10' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                            >
                                <span className="hidden sm:inline">Missed Classes Report</span>
                                <span className="sm:hidden">Missed</span>
                            </button>
                            <button 
                                onClick={() => setMode('leaves')}
                                className={`px-2 py-2 sm:px-6 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex-1 sm:flex-initial text-center flex items-center justify-center gap-1.5 ${mode === 'leaves' ? 'bg-[#ecb613] text-slate-900 shadow-lg shadow-[#ecb613]/10' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                            >
                                <span>Leave Requests</span>
                                {leaveRequests.filter(r => r.status === 'pending').length > 0 && (
                                    <span className="px-1.5 py-0.5 text-[9px] font-black bg-rose-500 text-white rounded-full animate-pulse">
                                        {leaveRequests.filter(r => r.status === 'pending').length}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="grid grid-cols-12 gap-5">
                        
                        {/* LEFT COLUMN: Calendar Picker (Width = 4) */}
                        {mode !== 'missed' && mode !== 'leaves' && (
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
                                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-355'
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
                        )}

                        {/* RIGHT COLUMN: Interactive lists (Width = 8 or 12) */}
                        <div className={`col-span-12 ${(mode === 'missed' || mode === 'leaves') ? 'lg:col-span-12' : 'lg:col-span-8'} space-y-4`}>
                            
                            {/* ── MODE 1: CLASS MARKING (ACCORDION PATTERN) ────────────────── */}
                            {mode === 'class' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-2">
                                        <h4 className="font-extrabold text-slate-900 dark:text-white tracking-tight">
                                            Scheduled Batches on {formatLocalDateStr(selectedDate, true)}
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

                                                                            <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap justify-end">
                                                                                {([
                                                                                    { key: 'present', label: 'Present', shortLabel: 'P', activeClass: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 border-emerald-500', inactiveClass: 'border-emerald-100 text-emerald-600 dark:border-emerald-950/20' },
                                                                                    { key: 'absent', label: 'Absent', shortLabel: 'A', activeClass: 'bg-rose-500 text-white shadow-lg shadow-rose-500/25 border-rose-500', inactiveClass: 'border-rose-100 text-rose-600 dark:border-rose-950/20' },
                                                                                    { key: 'late', label: 'Late', shortLabel: 'L', activeClass: 'bg-amber-500 text-white shadow-lg shadow-amber-500/25 border-amber-500', inactiveClass: 'border-amber-100 text-amber-600 dark:border-amber-950/20' },
                                                                                    { key: 'excused', label: 'Excused', shortLabel: 'E', activeClass: 'bg-slate-600 text-white shadow-lg shadow-slate-600/25 border-slate-600', inactiveClass: 'border-slate-200 text-slate-600 dark:border-slate-750' }
                                                                                ] as const).map(opt => {
                                                                                    const isActive = status === opt.key;
                                                                                    return (
                                                                                        <button
                                                                                            key={opt.key}
                                                                                            onClick={() => handleMarkBatchAttendance(batch.id, student.id, opt.key)}
                                                                                            className={`px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all duration-200 ${
                                                                                                isActive ? opt.activeClass : `${opt.inactiveClass} bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800`
                                                                                            }`}
                                                                                        >
                                                                                            <span className="hidden sm:inline">{opt.label}</span>
                                                                                            <span className="sm:hidden">{opt.shortLabel}</span>
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
                                                <CalendarIcon className="w-8 h-8 text-slate-300" />
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
                                                    <div>
                                                        {/* Mobile view of logs (visible on mobile only) */}
                                                        <div className="block sm:hidden divide-y divide-slate-100 dark:divide-slate-800/40">
                                                            {attendanceLogs.map((log) => (
                                                                <div key={log.id} className="p-4 flex justify-between items-center bg-white dark:bg-slate-900">
                                                                    <div className="min-w-0 flex-1 pr-3">
                                                                        <h6 className="font-extrabold text-slate-900 dark:text-white text-xs truncate">{log.classroom_name}</h6>
                                                                        <div className="flex items-center gap-2 mt-1">
                                                                            <span className="text-[10px] text-slate-400 font-bold">{formatLocalDateStr(log.date, true)}</span>
                                                                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                                                                log.is_temporary
                                                                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                                                                                    : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700'
                                                                            }`}>
                                                                                {log.is_temporary ? 'Temp' : 'Perm'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="shrink-0">
                                                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
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
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="overflow-x-auto hidden sm:block">
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
                                                                            {formatLocalDateStr(log.date, true)}
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
                                                <User className="w-8 h-8 text-slate-300" />
                                            </div>
                                            <h5 className="font-extrabold text-slate-400 tracking-tight">No student selected</h5>
                                            <p className="text-xs text-slate-400 mt-1">Please search and select a student above to construct their range-query logs.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── MODE 3: MISSED CLASSES REPORT ───────────────────────────── */}
                            {mode === 'missed' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300 text-left">
                                    {/* Date Range & Status Filters */}
                                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex flex-col md:flex-row gap-4 flex-1">
                                            {/* Search box */}
                                            <div className="relative flex-1 max-w-xs">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                                <input 
                                                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-[#ecb613]/50 text-xs font-semibold outline-none transition-all placeholder:text-slate-400" 
                                                    placeholder="Search student by name..."
                                                    type="text"
                                                    value={missedSearchQuery}
                                                    onChange={(e) => setMissedSearchQuery(e.target.value)}
                                                />
                                            </div>

                                            {/* Status Filter */}
                                            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                                                <button 
                                                    onClick={() => setMissedStatusFilter('all')}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${missedStatusFilter === 'all' ? 'bg-[#ecb613] text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                                                >
                                                    All Missed
                                                </button>
                                                <button 
                                                    onClick={() => setMissedStatusFilter('absent')}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${missedStatusFilter === 'absent' ? 'bg-[#ecb613] text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                                                >
                                                    Absent (Uninformed)
                                                </button>
                                                <button 
                                                    onClick={() => setMissedStatusFilter('excused')}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${missedStatusFilter === 'excused' ? 'bg-[#ecb613] text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                                                >
                                                    Excused (Informed)
                                                </button>
                                            </div>
                                        </div>

                                        {/* Date Range Inputs */}
                                        <div className="flex items-center gap-2 flex-wrap shrink-0">
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

                                    {/* Grid/Table Results */}
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                        {missedLoading ? (
                                            <div className="flex flex-col items-center justify-center py-20">
                                                <Loader2 className="w-6 h-6 animate-spin text-[#ecb613] mb-2" />
                                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Querying missed classes...</p>
                                            </div>
                                        ) : missedLogs.length > 0 ? (
                                            <div>
                                                {/* Mobile view of missed logs (visible on mobile only) */}
                                                <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800/40">
                                                    {missedLogs.map((log) => {
                                                        const scheduledMakeup = studentOverrides.find(o => {
                                                            if (!o.override_date || !log.date) return false;
                                                            const oDate = o.override_date.split('T')[0].split(' ')[0];
                                                            const lDate = log.date.split('T')[0].split(' ')[0];
                                                            return o.student_id === log.student_id && oDate >= lDate;
                                                        });

                                                        return (
                                                            <div key={log.id} className="p-4 flex flex-col gap-3 bg-white dark:bg-slate-900 text-left">
                                                                <div className="flex items-center justify-between">
                                                                    <span 
                                                                        onClick={() => fetchStudentHistory(log.student_id, log.student_name)}
                                                                        className="text-xs font-extrabold text-slate-900 dark:text-white hover:underline cursor-pointer"
                                                                    >
                                                                        {log.student_name}
                                                                    </span>
                                                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                                                                        log.status === 'absent' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20' : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30'
                                                                    }`}>
                                                                        {log.status === 'absent' ? 'Absent' : 'Excused'}
                                                                    </span>
                                                                </div>
                                                                <div className="text-xs space-y-1 bg-slate-50 dark:bg-slate-800/30 p-2 rounded-lg border border-slate-100 dark:border-slate-800/50">
                                                                    <div className="flex justify-between">
                                                                        <span className="text-slate-400 font-medium">Batch:</span>
                                                                        <span className="font-semibold text-slate-700 dark:text-slate-300">{log.classroom_name}</span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span className="text-slate-400 font-medium">Missed Date:</span>
                                                                        <span className="font-semibold text-slate-700 dark:text-slate-300">{formatLocalDateStr(log.date, true)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-start">
                                                                        <span className="text-slate-400 font-medium shrink-0">Makeup status:</span>
                                                                        <span className="font-semibold text-slate-700 dark:text-slate-300 text-right ml-2">
                                                                            {log.scheduledMakeup ? (
                                                                                <span className={log.isMakeupMissed ? 'text-rose-600' : 'text-emerald-600'}>
                                                                                    {log.isMakeupMissed ? 'Missed Makeup' : 'Scheduled'} ({formatLocalDateStr(log.scheduledMakeup.override_date)})
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-slate-400 italic">No makeup</span>
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex justify-end pt-1">
                                                                    {log.scheduledMakeup && !log.isMakeupMissed ? (
                                                                        <button
                                                                            onClick={() => {
                                                                                setMakeupStudent(log);
                                                                                setMakeupDate(log.scheduledMakeup.override_date);
                                                                                setMakeupClassroomId(log.scheduledMakeup.target_classroom_id);
                                                                                setMakeupReason(stripMissedDateTag(log.scheduledMakeup.reason || ''));
                                                                                setEditingMakeupId(log.scheduledMakeup.id);
                                                                                setShowMakeupModal(true);
                                                                            }}
                                                                            className="w-full py-1.5 bg-[#ecb613]/10 hover:bg-[#ecb613]/25 text-[#92400e] dark:text-[#ecb613] text-[10px] font-extrabold uppercase tracking-wider rounded-lg border border-[#ecb613]/30"
                                                                        >
                                                                            Reschedule
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => {
                                                                                const targetLog = log.isMakeupMissed ? {
                                                                                    student_id: log.student_id,
                                                                                    student_name: log.student_name,
                                                                                    date: log.scheduledMakeup.override_date,
                                                                                    classroom_name: classrooms.find(c => c.id === log.scheduledMakeup.target_classroom_id)?.name || 'Makeup Classroom',
                                                                                    classroom_id: log.scheduledMakeup.target_classroom_id,
                                                                                    status: 'absent'
                                                                                } : log;
                                                                                setMakeupStudent(targetLog);
                                                                                setMakeupDate(targetLog.date);
                                                                                setMakeupClassroomId(classrooms[0]?.id || '');
                                                                                setMakeupReason(`Makeup for missing ${targetLog.classroom_name} class on ${formatLocalDateStr(targetLog.date)}`);
                                                                                setEditingMakeupId(null);
                                                                                setShowMakeupModal(true);
                                                                            }}
                                                                            className="w-full py-1.5 bg-[#ecb613] text-slate-900 text-[10px] font-extrabold uppercase tracking-wider rounded-lg"
                                                                        >
                                                                            Schedule Makeup
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div className="overflow-x-auto hidden md:block">
                                                    <table className="w-full text-left border-collapse min-w-[700px]">
                                                        <thead>
                                                            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                                                                <th className="px-5 py-3 text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider">Student</th>
                                                                <th className="px-5 py-3 text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider">Classroom / Batch</th>
                                                                <th className="px-5 py-3 text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider">Missed Date</th>
                                                                <th className="px-5 py-3 text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider">Missed Status</th>
                                                                <th className="px-5 py-3 text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider">Alternative Class (Makeup)</th>
                                                                <th className="px-5 py-3 text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider text-right">Action</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                                                        {missedLogs.map((log) => {
                                                            // Check if there is already an override scheduled on or after this missed date
                                                            const scheduledMakeup = studentOverrides.find(o => {
                                                                if (!o.override_date || !log.date) return false;
                                                                const oDate = o.override_date.split('T')[0].split(' ')[0];
                                                                const lDate = log.date.split('T')[0].split(' ')[0];
                                                                return o.student_id === log.student_id && oDate >= lDate;
                                                            });

                                                            return (
                                                                <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 transition-colors">
                                                                    <td className="px-5 py-4">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border flex items-center justify-center overflow-hidden">
                                                                                {log.student_profile_pic_url ? (
                                                                                    <img src={log.student_profile_pic_url} alt={log.student_name} className="w-full h-full object-cover" />
                                                                                ) : (
                                                                                    <span className="text-[#ecb613] font-black text-xs">{log.student_name.charAt(0)}</span>
                                                                                )}
                                                                            </div>
                                                                            <span 
                                                                                onClick={() => fetchStudentHistory(log.student_id, log.student_name)}
                                                                                className="text-xs font-extrabold text-slate-900 dark:text-white hover:text-[#ecb613] hover:underline cursor-pointer transition-all"
                                                                            >
                                                                                {log.student_name}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-5 py-4 text-xs font-extrabold text-slate-950 dark:text-white">
                                                                        {log.classroom_name}
                                                                    </td>
                                                                    <td className="px-5 py-4 text-xs font-bold text-slate-600 dark:text-slate-300">
                                                                        {formatLocalDateStr(log.date, true)}
                                                                    </td>
                                                                    <td className="px-5 py-4">
                                                                        <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                                                            log.status === 'absent'
                                                                                ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20'
                                                                                : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30'
                                                                        }`}>
                                                                            {log.status === 'absent' ? 'Absent' : 'Excused'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-5 py-4 text-xs">
                                                                        {log.scheduledMakeup ? (
                                                                            <div className="flex flex-col text-slate-600 dark:text-slate-400">
                                                                                {log.isMakeupMissed ? (
                                                                                    <span className="font-extrabold text-rose-600 dark:text-rose-455 flex items-center gap-1.5">
                                                                                        <XCircle className="w-3.5 h-3.5" /> Missed Makeup
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="font-extrabold text-emerald-600 dark:text-emerald-450 flex items-center gap-1.5">
                                                                                        <CheckCircle className="w-3.5 h-3.5" /> Scheduled
                                                                                    </span>
                                                                                )}
                                                                                <span className="text-[10px] mt-0.5 text-slate-500">
                                                                                    {formatLocalDateStr(log.scheduledMakeup.override_date)} in {classrooms.find(c => c.id === log.scheduledMakeup.target_classroom_id)?.name || 'Classroom'}
                                                                                </span>
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-slate-400 italic">No makeup scheduled</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-5 py-4 text-right">
                                                                        {log.scheduledMakeup && !log.isMakeupMissed ? (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setMakeupStudent(log);
                                                                                    setMakeupDate(log.scheduledMakeup.override_date);
                                                                                    setMakeupClassroomId(log.scheduledMakeup.target_classroom_id);
                                                                                    setMakeupReason(stripMissedDateTag(log.scheduledMakeup.reason || ''));
                                                                                    setEditingMakeupId(log.scheduledMakeup.id);
                                                                                    setShowMakeupModal(true);
                                                                                }}
                                                                                className="px-3 py-1.5 bg-[#ecb613]/10 hover:bg-[#ecb613]/25 text-[#92400e] dark:text-[#ecb613] text-[10px] font-extrabold uppercase tracking-wider rounded-lg shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-1 ml-auto cursor-pointer border border-[#ecb613]/30"
                                                                            >
                                                                                Reschedule
                                                                                <ArrowRight className="w-3 h-3" />
                                                                            </button>
                                                                        ) : (
                                                                            <button
                                                                                onClick={() => {
                                                                                    const targetLog = log.isMakeupMissed ? {
                                                                                        student_id: log.student_id,
                                                                                        student_name: log.student_name,
                                                                                        date: log.scheduledMakeup.override_date,
                                                                                        classroom_name: classrooms.find(c => c.id === log.scheduledMakeup.target_classroom_id)?.name || 'Makeup Classroom',
                                                                                        classroom_id: log.scheduledMakeup.target_classroom_id,
                                                                                        status: 'absent'
                                                                                    } : log;
                                                                                    setMakeupStudent(targetLog);
                                                                                    setMakeupDate(targetLog.date);
                                                                                    setMakeupClassroomId(classrooms[0]?.id || '');
                                                                                    setMakeupReason(`Makeup for missing ${targetLog.classroom_name} class on ${formatLocalDateStr(targetLog.date)}`);
                                                                                    setEditingMakeupId(null);
                                                                                    setShowMakeupModal(true);
                                                                                }}
                                                                                className="px-3 py-1.5 bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900 text-[10px] font-extrabold uppercase tracking-wider rounded-lg shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-1 ml-auto cursor-pointer"
                                                                            >
                                                                                Schedule Makeup
                                                                                <ArrowRight className="w-3 h-3" />
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                        ) : (
                                            <div className="py-16 text-center">
                                                <XCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                                <h6 className="font-extrabold text-slate-450">No missed classes found</h6>
                                                <p className="text-xs text-slate-400 mt-1">There are no absent or excused records for the selected filters and date range.</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Completed Makeup Classes (Success) Section */}
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                    Completed Makeup Classes (Success)
                                                </h4>
                                                <p className="text-[10px] text-slate-400 mt-0.5">Successfully resolved makeup sessions where the student attended.</p>
                                            </div>
                                            <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 font-black text-[10px] rounded-full uppercase tracking-wider">
                                                {completedMissedLogs.length} Records
                                            </span>
                                        </div>
                                        {completedMissedLogs.length > 0 ? (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse min-w-[700px]">
                                                    <thead>
                                                        <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                                                            <th className="px-5 py-3 text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider">Student</th>
                                                            <th className="px-5 py-3 text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider">Original Missed Class</th>
                                                            <th className="px-5 py-3 text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider">Attended Makeup Class</th>
                                                            <th className="px-5 py-3 text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider">Status</th>
                                                            <th className="px-5 py-3 text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider">Reason / Notes</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                                                        {completedMissedLogs.map((log) => (
                                                            <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 transition-colors">
                                                                <td className="px-5 py-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border flex items-center justify-center overflow-hidden">
                                                                            {log.student_profile_pic_url ? (
                                                                                <img src={log.student_profile_pic_url} alt={log.student_name} className="w-full h-full object-cover" />
                                                                            ) : (
                                                                                <span className="text-[#ecb613] font-black text-xs">{log.student_name.charAt(0)}</span>
                                                                            )}
                                                                        </div>
                                                                        <span 
                                                                            onClick={() => fetchStudentHistory(log.student_id, log.student_name)}
                                                                            className="text-xs font-extrabold text-slate-900 dark:text-white hover:text-[#ecb613] hover:underline cursor-pointer transition-all"
                                                                        >
                                                                            {log.student_name}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-5 py-4">
                                                                    <div className="flex flex-col text-xs">
                                                                        <span className="font-extrabold text-slate-700 dark:text-slate-200">{log.classroom_name}</span>
                                                                        <span className="text-[10px] text-slate-400">{formatLocalDateStr(log.date, true)}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-5 py-4">
                                                                    <div className="flex flex-col text-xs">
                                                                        <span className="font-extrabold text-slate-700 dark:text-slate-200">
                                                                            {classrooms.find(c => c.id === log.scheduledMakeup?.target_classroom_id)?.name || 'Classroom'}
                                                                        </span>
                                                                        <span className="text-[10px] text-slate-400">
                                                                            {log.scheduledMakeup ? formatLocalDateStr(log.scheduledMakeup.override_date, true) : ''}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-5 py-4">
                                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400">
                                                                        <Check className="w-3 h-3" /> Success
                                                                    </span>
                                                                </td>
                                                                <td className="px-5 py-4 text-xs text-slate-500 italic">
                                                                    {log.scheduledMakeup?.reason ? stripMissedDateTag(log.scheduledMakeup.reason) : 'No details provided'}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="py-16 text-center">
                                                <CheckCircle2 className="w-10 h-10 text-slate-350 mx-auto mb-3" />
                                                <h6 className="font-extrabold text-slate-450">No completed makeups yet</h6>
                                                <p className="text-xs text-slate-400 mt-1">Completed records will appear here automatically once makeup attendance is marked present.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── MODE 4: LEAVE REQUESTS ──────────────────────────────────── */}
                            {mode === 'leaves' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300 text-left">
                                    {/* Leaves Filters */}
                                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <button 
                                                onClick={() => setLeavesFilter('all')}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${leavesFilter === 'all' ? 'bg-[#ecb613] text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                                            >
                                                All Requests
                                            </button>
                                            <button 
                                                onClick={() => setLeavesFilter('pending')}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${leavesFilter === 'pending' ? 'bg-[#ecb613] text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                                            >
                                                Pending
                                            </button>
                                            <button 
                                                onClick={() => setLeavesFilter('approved')}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${leavesFilter === 'approved' ? 'bg-[#ecb613] text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                                            >
                                                Approved
                                            </button>
                                            <button 
                                                onClick={() => setLeavesFilter('rejected')}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${leavesFilter === 'rejected' ? 'bg-[#ecb613] text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                                            >
                                                Rejected
                                            </button>
                                        </div>
                                    </div>

                                    {/* Leaves List */}
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-5">
                                        {leavesLoading ? (
                                            <div className="flex items-center justify-center py-12">
                                                <Loader2 className="size-8 animate-spin text-[#ecb613]" />
                                            </div>
                                        ) : leaveRequests.filter(r => leavesFilter === 'all' || r.status === leavesFilter).length > 0 ? (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse min-w-[700px]">
                                                    <thead>
                                                        <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                                                            <th className="px-5 py-3 text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider">Student</th>
                                                            <th className="px-5 py-3 text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider">Classroom / Batch</th>
                                                            <th className="px-5 py-3 text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider">Requested Date</th>
                                                            <th className="px-5 py-3 text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider">Reason</th>
                                                            <th className="px-5 py-3 text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider">Status</th>
                                                            <th className="px-5 py-3 text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {leaveRequests
                                                            .filter(r => leavesFilter === 'all' || r.status === leavesFilter)
                                                            .map((request) => (
                                                                <tr key={request.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                                                                    <td className="px-5 py-4">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="size-8 rounded-full bg-[#ecb613]/10 text-[#ecb613] font-bold text-xs flex items-center justify-center overflow-hidden">
                                                                                {request.users?.profile_pic_url ? (
                                                                                    <img src={request.users.profile_pic_url} alt="" className="size-full object-cover" />
                                                                                ) : (
                                                                                    request.users?.name?.charAt(0) || 'S'
                                                                                )}
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-xs font-black text-slate-800 dark:text-white leading-tight">{request.users?.name || 'Unknown'}</p>
                                                                                <p className="text-[10px] text-slate-450 font-semibold">{request.users?.email}</p>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-5 py-4 text-xs font-bold text-slate-700 dark:text-slate-350">
                                                                        {request.classrooms?.name || 'Unknown Classroom'}
                                                                    </td>
                                                                    <td className="px-5 py-4 text-xs font-bold text-slate-700 dark:text-slate-350">
                                                                        {formatLocalDateStr(request.class_date, true)}
                                                                    </td>
                                                                    <td className="px-5 py-4 text-xs text-slate-550 italic max-w-xs truncate">
                                                                        {request.reason || 'No reason provided'}
                                                                    </td>
                                                                    <td className="px-5 py-4">
                                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                                                            request.status === 'approved'
                                                                                ? 'bg-emerald-50 text-emerald-750 dark:bg-emerald-950/20 dark:text-emerald-455'
                                                                                : request.status === 'rejected'
                                                                                    ? 'bg-rose-50 text-rose-750 dark:bg-rose-955/20 dark:text-rose-455'
                                                                                    : 'bg-amber-50 text-amber-750 dark:bg-amber-955/20 dark:text-amber-455'
                                                                        }`}>
                                                                            {request.status}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-5 py-4 text-right">
                                                                        {request.status === 'pending' ? (
                                                                            <div className="flex items-center justify-end gap-2">
                                                                                <button 
                                                                                    onClick={() => handleApproveLeave(request)}
                                                                                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/30 dark:text-emerald-400 rounded-lg transition-colors"
                                                                                    title="Approve Leave"
                                                                                >
                                                                                    <Check className="size-4" />
                                                                                </button>
                                                                                <button 
                                                                                    onClick={() => handleRejectLeave(request)}
                                                                                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 dark:text-rose-400 rounded-lg transition-colors"
                                                                                    title="Reject Leave"
                                                                                >
                                                                                    <X className="size-4" />
                                                                                </button>
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-[10px] font-bold text-slate-400">Processed</span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="py-16 text-center">
                                                <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                                <h6 className="font-extrabold text-slate-450">No leave requests found</h6>
                                                <p className="text-xs text-slate-450 mt-1">There are no leave requests matching the selected filter.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                        </div>

                    </div>
                </div>
            </main>

            {/* ── Schedule Makeup Modal ─────────────────────────────────────────── */}
            {showMakeupModal && makeupStudent && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md flex flex-col p-6 animate-in zoom-in-95 duration-200 text-left max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5 mb-4">
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                                    {editingMakeupId ? 'Reschedule Makeup Class' : 'Schedule Makeup Class'}
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Priority Booking Engine</p>
                            </div>
                            <button onClick={handleCloseModal} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="space-y-4 flex-1">
                            {/* Student details card */}
                            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-white">
                                    {makeupStudent.student_profile_pic_url ? (
                                        <img src={makeupStudent.student_profile_pic_url} alt={makeupStudent.student_name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-[#ecb613] font-black text-sm">{makeupStudent.student_name.charAt(0)}</span>
                                    )}
                                </div>
                                <div className="text-left">
                                    <h6 className="text-xs font-black text-slate-900 dark:text-white">{makeupStudent.student_name}</h6>
                                    <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                                        Missed: {makeupStudent.classroom_name} on {formatLocalDateStr(makeupStudent.date)}
                                    </p>
                                </div>
                            </div>

                            {/* Target classroom */}
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Target Class / Batch</label>
                                {classrooms.length > 0 ? (
                                    <select 
                                        value={makeupClassroomId}
                                        onChange={(e) => setMakeupClassroomId(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#ecb613]/40 outline-none transition-all"
                                    >
                                        {classrooms.map(room => (
                                            <option key={room.id} value={room.id}>{room.name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="text-xs text-rose-500 font-bold p-2.5 bg-rose-50 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900/40">
                                        No permanent classrooms found. You must configure at least one permanent classroom to schedule a makeup class.
                                    </div>
                                )}
                            </div>

                            {/* Date */}
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Makeup Class Date</label>
                                <input 
                                    type="date"
                                    value={makeupDate}
                                    onChange={(e) => setMakeupDate(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#ecb613]/40 outline-none transition-all"
                                />
                            </div>

                            {/* Suggestions based on excused absences */}
                            {makeupDate && (
                                <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                                    <div className="flex items-center gap-1.5 pl-1">
                                        <Lightbulb className="w-3.5 h-3.5 text-[#ecb613]" />
                                        <span className="block text-[10px] font-black text-slate-450 dark:text-slate-450 uppercase tracking-wider">
                                            Suggestions (Excused absences on this date)
                                        </span>
                                    </div>
                                    {excusedSuggestions.length > 0 ? (
                                        <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                                            {excusedSuggestions.map((sug) => {
                                                const isSelected = makeupClassroomId === sug.classroomId;
                                                return (
                                                    <button
                                                        key={sug.classroomId}
                                                        type="button"
                                                        onClick={() => setMakeupClassroomId(sug.classroomId)}
                                                        className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-start justify-between gap-3 group cursor-pointer ${
                                                            isSelected
                                                                ? 'border-[#ecb613] bg-[#ecb613]/10 dark:bg-[#ecb613]/5'
                                                                : 'border-slate-100 dark:border-slate-850 hover:border-[#ecb613]/50 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                                        }`}
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <p className={`text-xs font-bold truncate ${isSelected ? 'text-[#b45309] dark:text-[#ecb613]' : 'text-slate-800 dark:text-slate-200'}`}>
                                                                    {sug.classroomName}
                                                                </p>
                                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                                                    isSelected
                                                                        ? 'bg-[#ecb613] text-slate-900'
                                                                        : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
                                                                }`}>
                                                                    {sug.excusedCount} Slot{sug.excusedCount > 1 ? 's' : ''} Open
                                                                </span>
                                                            </div>
                                                            <p className="text-[10px] text-slate-500 font-medium truncate mt-1">
                                                                Excused: {sug.excusedStudents.join(', ')}
                                                            </p>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 italic pl-1">
                                            No excused absences on this date. You can select any classroom manually from the dropdown.
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Reason / Notes</label>
                                <textarea
                                    value={makeupReason}
                                    onChange={(e) => setMakeupReason(e.target.value)}
                                    rows={3}
                                    placeholder="Write a reason or notes..."
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#ecb613]/40 outline-none transition-all resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6 border-t border-slate-100 dark:border-slate-800 pt-4">
                            <button 
                                onClick={handleCloseModal}
                                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveMakeup}
                                disabled={isSavingMakeup || (!makeupClassroomId && classrooms.length === 0) || !makeupDate}
                                className="px-5 py-2.5 rounded-xl text-xs font-black bg-[#ecb613] text-slate-900 hover:bg-[#ecb613]/90 shadow-md shadow-[#ecb613]/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                            >
                                {isSavingMakeup ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                {editingMakeupId ? 'Reschedule Class' : 'Schedule Class'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showHistoryModal && historyStudent && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg flex flex-col p-6 animate-in zoom-in-95 duration-200 text-left max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5 mb-4">
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                                    Makeup & Reschedule History
                                </h3>
                                <p className="text-[10px] font-bold text-[#ecb613] uppercase tracking-widest mt-0.5">
                                    {historyStudent.name}
                                </p>
                            </div>
                            <button 
                                onClick={() => {
                                    setShowHistoryModal(false);
                                    setHistoryStudent(null);
                                    setStudentHistoryLogs([]);
                                    setStudentRescheduleChains([]);
                                    setActiveHistoryTab('chains');
                                }} 
                                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-450 hover:text-slate-650 transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                            <button
                                onClick={() => setActiveHistoryTab('chains')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                    activeHistoryTab === 'chains'
                                        ? 'bg-[#ecb613] text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                                }`}
                            >
                                Reschedule Chains
                            </button>
                            <button
                                onClick={() => setActiveHistoryTab('timeline')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                    activeHistoryTab === 'timeline'
                                        ? 'bg-[#ecb613] text-slate-900 shadow-sm'
                                        : 'text-slate-555 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                                }`}
                            >
                                Chronological Logs
                            </button>
                        </div>

                        {historyLoading ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-[#ecb613] mb-2" />
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Loading history...</p>
                            </div>
                        ) : activeHistoryTab === 'chains' ? (
                            studentRescheduleChains.length > 0 ? (
                                <div className="space-y-6 my-2">
                                    {studentRescheduleChains.map((chain, idx) => (
                                        <div key={idx} className="bg-slate-50/60 dark:bg-slate-850 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                                            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-2.5 mb-4">
                                                <div>
                                                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                                        Missed {chain.root.classroom_name || 'Class'}
                                                    </h4>
                                                    <p className="text-[10px] text-slate-450 font-bold mt-0.5">
                                                        {formatLocalDateStr(chain.root.date, true)}
                                                    </p>
                                                </div>
                                                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                                    chain.root.status === 'absent'
                                                        ? 'bg-rose-100/70 text-rose-700 dark:bg-rose-950/45 dark:text-rose-400'
                                                        : 'bg-blue-100/70 text-blue-700 dark:bg-blue-950/45 dark:text-blue-400'
                                                }`}>
                                                    {chain.root.status}
                                                </span>
                                            </div>

                                            {chain.reschedules.length > 0 ? (
                                                <div className="relative border-l-2 border-slate-200 dark:border-slate-800/80 ml-3 pl-5 space-y-4">
                                                    {chain.reschedules.map((r: any, rIdx: number) => {
                                                        let pillClass = '';
                                                        let pillText = '';
                                                        let iconEl = null;

                                                        if (r.status === 'attended') {
                                                            pillClass = 'bg-emerald-55 dark:bg-emerald-950/35 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40';
                                                            pillText = 'Attended';
                                                            iconEl = <Check className="w-2.5 h-2.5" />;
                                                        } else if (r.status === 'missed') {
                                                            pillClass = 'bg-rose-50 text-rose-650 dark:bg-rose-950/35 dark:text-rose-455 border border-rose-100 dark:border-rose-900/40';
                                                            pillText = 'Missed';
                                                            iconEl = <X className="w-2.5 h-2.5" />;
                                                        } else {
                                                            pillClass = 'bg-amber-50 text-amber-600 dark:bg-amber-950/35 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40';
                                                            pillText = 'Pending';
                                                            iconEl = <Clock className="w-2.5 h-2.5" />;
                                                        }

                                                        return (
                                                            <div key={rIdx} className="relative">
                                                                <div className={`absolute -left-[28px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ${
                                                                    r.status === 'attended' ? 'bg-emerald-500' : r.status === 'missed' ? 'bg-rose-500' : 'bg-amber-500'
                                                                }`} />
                                                                
                                                                <div>
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                                                            Rescheduled to {r.classroomName}
                                                                        </span>
                                                                        <span className="text-[9px] font-black text-slate-450 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                                            {formatLocalDateStr(r.override.override_date, true)}
                                                                        </span>
                                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${pillClass}`}>
                                                                            {iconEl}
                                                                            {pillText}
                                                                        </span>
                                                                    </div>
                                                                    {r.override.reason && (
                                                                        <p className="text-[10px] text-slate-500 italic mt-1 font-semibold pl-2 border-l-2 border-slate-200 dark:border-slate-800">
                                                                            Notes: {stripMissedDateTag(r.override.reason)}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="text-center py-2">
                                                    <p className="text-[10.5px] text-slate-450 italic font-semibold">No makeup class scheduled for this missed session yet.</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-12 text-center">
                                    <CheckCircle2 className="w-8 h-8 text-slate-350 mx-auto mb-2" />
                                    <p className="text-xs text-slate-400 italic font-semibold">No missed classes recorded for this student.</p>
                                </div>
                            )
                        ) : (
                            studentHistoryLogs.length > 0 ? (
                                <div className="relative border-l border-slate-200 dark:border-slate-850 ml-4 my-2 pl-6 space-y-6">
                                    {studentHistoryLogs.map((evt, idx) => {
                                        const isMissed = evt.type === 'missed_class';
                                        const isScheduled = evt.type === 'makeup_scheduled';
                                        const isAttendance = evt.type === 'makeup_attendance';
                                        const isRegular = evt.type === 'regular_attendance';

                                        let iconColor = 'bg-slate-100 text-slate-550';
                                        let iconContent = <Clock className="w-3.5 h-3.5" />;
                                        let title = '';
                                        let titleColor = 'text-slate-800 dark:text-slate-200';

                                        if (isMissed) {
                                            iconColor = 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-450';
                                            iconContent = <XCircle className="w-3.5 h-3.5" />;
                                            title = `Missed Class (${evt.status === 'absent' ? 'Absent' : 'Excused'})`;
                                            titleColor = 'text-rose-700 dark:text-rose-455';
                                        } else if (isScheduled) {
                                            iconColor = 'bg-amber-50 dark:bg-amber-950/30 text-[#ecb613]';
                                            iconContent = <CalendarIcon className="w-3.5 h-3.5" />;
                                            title = 'Rescheduled Makeup Booked';
                                            titleColor = 'text-amber-700 dark:text-amber-400';
                                        } else if (isAttendance) {
                                            const success = evt.status === 'present' || evt.status === 'late';
                                            if (success) {
                                                iconColor = 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600';
                                                iconContent = <Check className="w-3.5 h-3.5" />;
                                                title = `Attended Makeup (Success)`;
                                                titleColor = 'text-emerald-700 dark:text-emerald-450';
                                            } else {
                                                iconColor = 'bg-rose-50 dark:bg-rose-950/30 text-rose-600';
                                                iconContent = <XCircle className="w-3.5 h-3.5" />;
                                                title = `Missed Scheduled Makeup`;
                                                titleColor = 'text-rose-700 dark:text-rose-455';
                                            }
                                        } else if (isRegular) {
                                            iconColor = 'bg-slate-50 dark:bg-slate-850 text-slate-550';
                                            iconContent = <Check className="w-3.5 h-3.5" />;
                                            title = 'Attended Regular Class';
                                            titleColor = 'text-slate-700 dark:text-slate-400';
                                        }

                                        return (
                                            <div key={idx} className="relative group">
                                                <div className={`absolute -left-[35px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm ${iconColor}`}>
                                                    {iconContent}
                                                </div>

                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-xs font-black tracking-tight ${titleColor}`}>
                                                            {title}
                                                        </span>
                                                        <span className="text-[9px] font-black text-slate-450 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded">
                                                            {formatLocalDateStr(evt.date, true)}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10.5px] text-slate-500 mt-1 font-semibold leading-relaxed">
                                                        {evt.details}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="py-12 text-center">
                                    <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-xs text-slate-400 italic font-semibold">No attendance or makeup history recorded for this student.</p>
                                </div>
                            )
                        )}

                        <div className="flex justify-end mt-6 border-t border-slate-100 dark:border-slate-800 pt-4">
                            <button 
                                onClick={() => {
                                    setShowHistoryModal(false);
                                    setHistoryStudent(null);
                                    setStudentHistoryLogs([]);
                                    setStudentRescheduleChains([]);
                                    setActiveHistoryTab('chains');
                                }}
                                className="px-5 py-2.5 rounded-xl text-xs font-black bg-[#ecb613] text-slate-900 hover:bg-[#ecb613]/90 shadow-md shadow-[#ecb613]/10 transition-all cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
