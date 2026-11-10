'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { cancelAlternativeSpecialSession } from '../../../src/lib/alternative-class-sessions';
import { sortClassroomsByDayAndTime, parseDayAndStartFromClassroom } from '../../../src/lib/classroomSort';
import { HistoricalLeaveCorrectionModal } from '../../../src/components/teacher-dashboard/attendance/HistoricalLeaveCorrectionModal';
import { HistoricalAttendanceCorrectionModal } from '../../../src/components/teacher-dashboard/attendance/HistoricalAttendanceCorrectionModal';
import { AttendanceCorrectionHistoryModal } from '../../../src/components/teacher-dashboard/attendance/AttendanceCorrectionHistoryModal';
import { UnmarkAttendanceModal } from '../../../src/components/teacher-dashboard/attendance/UnmarkAttendanceModal';
import DeclareHolidayModal from '../../../src/components/teacher-dashboard/holidays/DeclareHolidayModal';
import ScheduleAlternativeModal from '../../../src/components/teacher-dashboard/holidays/ScheduleAlternativeModal';
import HolidayAuditHistoryModal from '../../../src/components/teacher-dashboard/holidays/HolidayAuditHistoryModal';
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
    ArrowRight,
    AlertCircle,
    AlertTriangle,
    History,
    Sparkles
} from 'lucide-react';
import TeacherSidebar from '../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../src/components/TeacherHeader';
import { ArrangeMakeupModal } from '../../../src/components/makeup/ArrangeMakeupModal';
import { StudentAttendanceModal } from '../../../src/components/teacher-dashboard/attendance/StudentAttendanceModal';
import { isStudentOperationallyActive, isStudentEnrolledOnDate } from '../../../src/lib/student-lifecycle';
import { CoveredAttendanceRecord, buildCoveredAttendanceMap } from '../../../src/lib/on-behalf-attendance';
import { handleFeeBalanceTransitionNotifications } from '../../../src/lib/fee-notifications';
import { 
    derivePendingAttendanceSessions, 
    calculatePendingSummary, 
    filterPendingSessions, 
    PendingClassSession, 
    PendingSummary, 
    PendingFilterType,
    formatTime12hr
} from '../../../src/lib/attendance-pending';

interface Classroom {
    id: string;
    name: string;
    type?: string | null;
    status?: string | null;
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
    description?: string | null;
    class_date: string;
    start_time: string;
    end_time: string;
    lifecycle_status?: string | null;
}

interface Student {
    id: string;
    name: string;
    profile_pic_url?: string | null;
    isGuest?: boolean;
    isMakeup?: boolean;
    missedDate?: string | null;
}

interface BatchItem {
    id: string;
    name: string;
    type: 'permanent' | 'temporary';
    time: string;
    startTime?: string;
    activeHoliday?: any | null;
    alternativeHoliday?: any | null;
    linkedHolidayDate?: string | null;
    linkedHolidayRoomId?: string | null;
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
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string; phone?: string | null; role?: string; profile_pic_url?: string | null } | null>(null);
    
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
    
    // Quick Student Attendance Modal & Top Search State
    const [attendanceModalStudent, setAttendanceModalStudent] = useState<{ id: string; name?: string; pic?: string } | null>(null);
    const openStudentAttendanceModal = useCallback((studentId: string, name?: string, pic?: string) => {
        setAttendanceModalStudent({ id: studentId, name, pic });
    }, []);
    const closeStudentAttendanceModal = useCallback(() => {
        setAttendanceModalStudent(null);
    }, []);

    const [quickStudentSearch, setQuickStudentSearch] = useState('');
    const [quickSearchResults, setQuickSearchResults] = useState<Student[]>([]);
    const [quickSearchLoading, setQuickSearchLoading] = useState(false);

    // Individual Range Report — Date-based student list
    const [dateStudentSearchQuery, setDateStudentSearchQuery] = useState('');
    interface DateStudentEntry { student: Student; classroom_id: string; classroom_name: string; isMakeup: boolean; }
    const [dateStudentsData, setDateStudentsData] = useState<DateStudentEntry[]>([]);
    const [dateStudentsLoading, setDateStudentsLoading] = useState(false);
    // Key: `${studentId}_${classroomId}` → status
    const [dateAttendanceMap, setDateAttendanceMap] = useState<Record<string, 'present' | 'absent' | 'late' | 'excused'>>({});

    // Attendance Pending (Missed Classes Report) State
    const [pendingSessions, setPendingSessions] = useState<PendingClassSession[]>([]);
    const [pendingLoading, setPendingLoading] = useState(false);
    const [pendingFilterType, setPendingFilterType] = useState<PendingFilterType>('all');
    const [pendingSearchQuery, setPendingSearchQuery] = useState('');
    const [pendingMarkingMap, setPendingMarkingMap] = useState<Record<string, boolean>>({});
    const [missedSubTab, setMissedSubTab] = useState<'pending' | 'makeup'>('pending');

    const pendingSummary = useMemo(() => calculatePendingSummary(pendingSessions), [pendingSessions]);

    const filteredPendingSessions = useMemo(() => {
        return filterPendingSessions(pendingSessions, pendingFilterType, pendingSearchQuery);
    }, [pendingSessions, pendingFilterType, pendingSearchQuery]);

    // Missed Classes Report State (Legacy Makeup Tracking)
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
    const [correctionLeaveRequest, setCorrectionLeaveRequest] = useState<any | null>(null);
    const [showCorrectionModal, setShowCorrectionModal] = useState(false);
    const [attendanceCorrectionTarget, setAttendanceCorrectionTarget] = useState<{
        id: string;
        student_id: string;
        student_name?: string;
        classroom_id: string;
        classroom_name?: string;
        date: string;
        status: string;
    } | null>(null);
    const [attendanceUnmarkTarget, setAttendanceUnmarkTarget] = useState<{
        attendanceId: string;
        studentId: string;
        studentName: string;
        classroomId: string;
        classroomName: string;
        classDate: string;
        currentStatus: string;
    } | null>(null);
    const [showCorrectionAuditModal, setShowCorrectionAuditModal] = useState(false);
    const [auditModalClassroomId, setAuditModalClassroomId] = useState<string | undefined>(undefined);
    const [auditModalStudentId, setAuditModalStudentId] = useState<string | undefined>(undefined);

    // In-flight attendance save tracker to guard against double clicks and rapid state changes
    const [savingAttendanceMap, setSavingAttendanceMap] = useState<Record<string, boolean>>({});

    // Holiday Management State (BR-22 & BR-23)
    const [classroomHolidays, setClassroomHolidays] = useState<any[]>([]);
    const [declareHolidayModalState, setDeclareHolidayModalState] = useState<{
        isOpen: boolean;
        classroomId: string;
        classroomName: string;
        initialDate: string;
    }>({ isOpen: false, classroomId: '', classroomName: '', initialDate: '' });
    const [scheduleAltModalState, setScheduleAltModalState] = useState<{
        isOpen: boolean;
        holiday: any | null;
        classroomName: string;
    }>({ isOpen: false, holiday: null, classroomName: '' });
    const [holidayAuditModalState, setHolidayAuditModalState] = useState<{
        isOpen: boolean;
        classroomId: string;
        classroomName: string;
    }>({ isOpen: false, classroomId: '', classroomName: '' });

    // On-Behalf-Of batch state mapping batchId -> on_behalf_of_date
    const [batchOnBehalfOfMap, setBatchOnBehalfOfMap] = useState<Record<string, string | null>>({});
    // Mapping of student_id -> CoveredAttendanceRecord for students covered on an alternative date
    const [coveredAttendanceMap, setCoveredAttendanceMap] = useState<Record<string, CoveredAttendanceRecord>>({});

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

    const formatYMD = useCallback((d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }, []);

    const initialMonthRange = useMemo(() => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const year = now.getFullYear();
        const m1 = String(now.getMonth() + 1).padStart(2, '0');
        const dLast = String(lastDay.getDate()).padStart(2, '0');
        return {
            from: `${year}-${m1}-01`,
            to: `${year}-${m1}-${dLast}`
        };
    }, []);

    const [fromDate, setFromDate] = useState<string>(initialMonthRange.from);
    const [toDate, setToDate] = useState<string>(initialMonthRange.to);
    const [individualStatusFilter, setIndividualStatusFilter] = useState<'all' | 'present' | 'late' | 'absent' | 'excused'>('all');

    const setPresetThisMonth = useCallback(() => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        setFromDate(formatYMD(firstDay));
        setToDate(formatYMD(lastDay));
        setViewDate(now);
    }, [formatYMD]);

    const setPresetLastMonth = useCallback(() => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
        setFromDate(formatYMD(firstDay));
        setToDate(formatYMD(lastDay));
        setViewDate(firstDay);
    }, [formatYMD]);

    const setPresetLast30Days = useCallback(() => {
        const now = new Date();
        const past = new Date();
        past.setDate(now.getDate() - 30);
        setFromDate(formatYMD(past));
        setToDate(formatYMD(now));
    }, [formatYMD]);

    const setPresetLast3Months = useCallback(() => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        setFromDate(formatYMD(firstDay));
        setToDate(formatYMD(lastDay));
    }, [formatYMD]);

    const activePreset = useMemo(() => {
        const now = new Date();
        const curFirst = formatYMD(new Date(now.getFullYear(), now.getMonth(), 1));
        const curLast = formatYMD(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        if (fromDate === curFirst && toDate === curLast) return 'this_month';

        const lastFirst = formatYMD(new Date(now.getFullYear(), now.getMonth() - 1, 1));
        const lastLast = formatYMD(new Date(now.getFullYear(), now.getMonth(), 0));
        if (fromDate === lastFirst && toDate === lastLast) return 'last_month';

        const threeFirst = formatYMD(new Date(now.getFullYear(), now.getMonth() - 2, 1));
        if (fromDate === threeFirst && toDate === curLast) return 'last_3_months';

        return 'custom';
    }, [fromDate, toDate, formatYMD]);
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
                    .select('id, name, email, phone, role, profile_pic_url')
                    .eq('id', session.user.id)
                    .single();

                if (profile?.role !== 'teacher' && profile?.role !== 'admin') {
                    router.push('/');
                    return;
                }

                const cachedRole = typeof window !== 'undefined' ? localStorage.getItem('kfa-user-role') : null;
                const userRole = cachedRole || profile.role;
                setTeacherProfile({ id: profile.id, name: profile.name, email: profile.email, phone: profile.phone, role: userRole, profile_pic_url: profile.profile_pic_url });
                const isAdmin = userRole === 'admin';
                
                // 1. Fetch classrooms
                const classesQuery = supabaseAuth
                    .from('classrooms')
                    .select('id, name, type, status');
                const { data: classesData } = isAdmin
                    ? await classesQuery
                    : await classesQuery.eq('teacher_id', session.user.id);
                
                const allClassroomsRaw = classesData || [];
                const shadowRoomStatusById = new Map<string, string>(
                    allClassroomsRaw.map(c => [c.id, (c.status || 'active').toLowerCase()])
                );
                const loadedClassrooms = allClassroomsRaw.filter(c => {
                    const cType = (c.type || 'permanent').toLowerCase();
                    const cStatus = (c.status || 'active').toLowerCase();
                    return cType === 'permanent' && cStatus !== 'archived' && cStatus !== 'inactive';
                });
                setClassrooms(loadedClassrooms);

                // 2. Fetch all batch schedules & active classroom holidays in parallel
                if (loadedClassrooms.length > 0) {
                    const roomIds = loadedClassrooms.map(c => c.id);
                    const [{ data: schedulesData }, { data: holidaysData }] = await Promise.all([
                        supabaseAuth
                            .from('batch_schedules')
                            .select('*')
                            .in('classroom_id', roomIds)
                            .order('day_of_week', { ascending: true })
                            .order('start_time', { ascending: true }),
                        supabaseAuth
                            .from('classroom_holidays')
                            .select('*')
                            .in('classroom_id', roomIds)
                            .eq('status', 'active')
                    ]);
                    
                    setAllSchedules(schedulesData || []);
                    setClassroomHolidays(holidaysData || []);
                }

                // 3. Fetch all temporary classes (ordered by time ascending)
                const tempClassesQuery = supabaseAuth
                    .from('temporary_classes')
                    .select('*')
                    .order('start_time', { ascending: true });
                const { data: tempClassesData } = isAdmin
                    ? await tempClassesQuery
                    : await tempClassesQuery.eq('teacher_id', session.user.id);
                
                const loadedTempClasses = (tempClassesData || []).filter(tc => {
                    const lifecycle = (tc.lifecycle_status || 'scheduled').toLowerCase();
                    if (lifecycle === 'cancelled') return false;
                    if (tc.classroom_id) {
                        const shadowStatus = shadowRoomStatusById.get(tc.classroom_id);
                        if ((shadowStatus === 'archived' || shadowStatus === 'inactive') && lifecycle !== 'completed') {
                            return false;
                        }
                    }
                    return true;
                });
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

    const fetchClassroomHolidays = useCallback(async (loadedRooms = classrooms) => {
        if (!loadedRooms || loadedRooms.length === 0) {
            setClassroomHolidays([]);
            return [];
        }
        try {
            const roomIds = loadedRooms.map(c => c.id);
            const { data, error } = await supabaseAuth
                .from('classroom_holidays')
                .select('*')
                .in('classroom_id', roomIds)
                .eq('status', 'active');
            if (!error && data) {
                setClassroomHolidays(data);
                return data;
            }
        } catch (err) {
            console.error('Error fetching classroom holidays:', err);
        }
        return classroomHolidays;
    }, [classrooms, classroomHolidays]);

    // Active batches scheduled on the selected date (sorted in time ascending order)
    const activeBatchesOnSelectedDate = useMemo((): BatchItem[] => {
        if (!selectedDate) return [];
        const [year, month, day] = selectedDate.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day);
        const dayOfWeek = dateObj.getDay(); 

        // Index active classroom holidays by classroom_id + holiday_date and classroom_id + alternative_date
        const activeHolByClassDate = new Map<string, any>();
        const altHolByClassDate = new Map<string, any>();
        (classroomHolidays || []).forEach(h => {
            if (h && h.classroom_id && (!h.status || h.status === 'active')) {
                const holDate = String(h.holiday_date || '').split('T')[0];
                const altDate = h.alternative_date ? String(h.alternative_date).split('T')[0] : '';
                if (holDate) {
                    activeHolByClassDate.set(`${h.classroom_id}_${holDate}`, { ...h, holiday_date: holDate, alternative_date: altDate || null });
                }
                if (altDate && (h.holiday_type === 'alternative_scheduled' || h.holiday_type === 'with_alternative')) {
                    altHolByClassDate.set(`${h.classroom_id}_${altDate}`, { ...h, holiday_date: holDate, alternative_date: altDate });
                }
            }
        });

        // Active temporary classes for selected date (excluding any legacy/auto-created alternative shadow sessions)
        const activeTemporary = temporaryClasses
            .filter(tc => {
                if (tc.class_date !== selectedDate) return false;
                if ((tc.lifecycle_status || 'scheduled').toLowerCase() === 'cancelled') return false;
                const desc = String(tc.description || '');
                if (desc.includes('[OnBehalfOfHoliday:')) return false;
                return true;
            })
            .map(tc => {
                return {
                    id: tc.classroom_id || tc.id,
                    name: tc.title || 'Temporary Session',
                    type: 'temporary' as const,
                    time: `${formatTime12hr(tc.start_time.slice(0, 5))} - ${formatTime12hr(tc.end_time.slice(0, 5))}`,
                    startTime: tc.start_time,
                    alternativeHoliday: null,
                    linkedHolidayDate: null,
                    linkedHolidayRoomId: null
                };
            });

        const processedRoomIds = new Set<string>();
        const activePermanent: BatchItem[] = [];

        // 1. Process allSchedules for dayOfWeek
        allSchedules
            .filter(s => s.day_of_week === dayOfWeek)
            .forEach(s => {
                const room = classrooms.find(c => c.id === s.classroom_id);
                if (room && !processedRoomIds.has(room.id)) {
                    processedRoomIds.add(room.id);
                    const parsed = parseDayAndStartFromClassroom(room);
                    const startTimeStr = s.start_time || (parsed.startTimeMinutes < 24 * 60 ? `${String(Math.floor(parsed.startTimeMinutes / 60)).padStart(2, '0')}:${String(parsed.startTimeMinutes % 60).padStart(2, '0')}:00` : '00:00:00');
                    const endTimeStr = s.end_time || '01:00:00';
                    const activeHol = activeHolByClassDate.get(`${room.id}_${selectedDate}`) || null;
                    const altHol = altHolByClassDate.get(`${room.id}_${selectedDate}`) || null;
                    activePermanent.push({
                        id: room.id,
                        name: room.name || 'Classroom',
                        type: 'permanent',
                        time: `${formatTime12hr(startTimeStr.slice(0, 5))} - ${formatTime12hr(endTimeStr.slice(0, 5))}`,
                        startTime: startTimeStr,
                        activeHoliday: activeHol,
                        alternativeHoliday: altHol
                    });
                }
            });

        // 2. Include any classrooms whose title explicitly matches dayOfWeek even if schedule row is missing/mismatched
        classrooms.forEach(room => {
            const roomType = (room.type || 'permanent').toLowerCase();
            const roomStatus = (room.status || 'active').toLowerCase();
            if (roomType !== 'permanent' || roomStatus === 'archived' || roomStatus === 'inactive') return;
            if (!processedRoomIds.has(room.id)) {
                const parsed = parseDayAndStartFromClassroom(room);
                if (parsed.dayOfWeek === dayOfWeek) {
                    processedRoomIds.add(room.id);
                    const startTimeStr = parsed.startTimeMinutes < 24 * 60 ? `${String(Math.floor(parsed.startTimeMinutes / 60)).padStart(2, '0')}:${String(parsed.startTimeMinutes % 60).padStart(2, '0')}:00` : '00:00:00';
                    const endMin = (parsed.startTimeMinutes + 60) % (24 * 60);
                    const endTimeStr = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}:00`;
                    const activeHol = activeHolByClassDate.get(`${room.id}_${selectedDate}`) || null;
                    const altHol = altHolByClassDate.get(`${room.id}_${selectedDate}`) || null;
                    activePermanent.push({
                        id: room.id,
                        name: room.name || 'Classroom',
                        type: 'permanent',
                        time: `${formatTime12hr(startTimeStr.slice(0, 5))} - ${formatTime12hr(endTimeStr.slice(0, 5))}`,
                        startTime: startTimeStr,
                        activeHoliday: activeHol,
                        alternativeHoliday: altHol
                    });
                }
            }
        });

        // 3. Include any permanent classroom that has an active scheduled alternative class (BR-22) on selectedDate
        classrooms.forEach(room => {
            if (processedRoomIds.has(room.id)) return;
            const altHol = altHolByClassDate.get(`${room.id}_${selectedDate}`);
            if (!altHol) return;

            processedRoomIds.add(room.id);
            const fallbackSched = allSchedules.find(s => s.classroom_id === room.id);
            const startTimeStr = altHol.alternative_start_time || fallbackSched?.start_time || '10:00:00';
            const endTimeStr = altHol.alternative_end_time || fallbackSched?.end_time || '11:00:00';
            activePermanent.push({
                id: room.id,
                name: room.name || 'Classroom',
                type: 'permanent',
                time: `${formatTime12hr(startTimeStr.slice(0, 5))} - ${formatTime12hr(endTimeStr.slice(0, 5))}`,
                startTime: startTimeStr,
                activeHoliday: null,
                alternativeHoliday: altHol,
                linkedHolidayDate: altHol.holiday_date,
                linkedHolidayRoomId: room.id
            });
        });

        const combined = [...activePermanent, ...activeTemporary];
        combined.sort((a, b) => (a.startTime || '00:00:00').localeCompare(b.startTime || '00:00:00'));
        return combined;
    }, [selectedDate, allSchedules, classrooms, temporaryClasses, classroomHolidays]);

    // Helper to calculate dot indicators for the calendar month
    const scheduledDatesSet = useMemo(() => {
        const scheduledDaysOfWeek = new Set(allSchedules.map(s => s.day_of_week));
        classrooms.forEach(c => {
            const cType = (c.type || 'permanent').toLowerCase();
            const cStatus = (c.status || 'active').toLowerCase();
            if (cType !== 'permanent' || cStatus === 'archived' || cStatus === 'inactive') return;
            const parsed = parseDayAndStartFromClassroom(c);
            if (parsed.dayOfWeek !== 99) {
                scheduledDaysOfWeek.add(parsed.dayOfWeek);
            }
        });
        const tempDates = new Set(
            temporaryClasses
                .filter(tc => (tc.lifecycle_status || 'scheduled').toLowerCase() !== 'cancelled')
                .map(tc => tc.class_date)
        );
        (classroomHolidays || []).forEach(h => {
            if (h && (!h.status || h.status === 'active') && h.alternative_date) {
                tempDates.add(String(h.alternative_date).split('T')[0]);
            }
        });
        return { scheduledDaysOfWeek, tempDates };
    }, [allSchedules, classrooms, temporaryClasses, classroomHolidays]);

    const hasClassesOnDate = useCallback((dateStr: string) => {
        if (!dateStr) return false;
        const [year, month, day] = dateStr.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day);
        const dayOfWeek = dateObj.getDay();
        return scheduledDatesSet.scheduledDaysOfWeek.has(dayOfWeek) || scheduledDatesSet.tempDates.has(dateStr);
    }, [scheduledDatesSet]);

    // Fetch summaries for all active batches on selectedDate (to display present/absent counts on headers)
    useEffect(() => {
        const fetchHeaderSummaries = async () => {
            if (activeBatchesOnSelectedDate.length === 0) {
                setBatchSummaries({});
                return;
            }

            try {
                const permanentBatchIds = activeBatchesOnSelectedDate.filter(b => b.type === 'permanent').map(b => b.id);
                const allBatchIds = activeBatchesOnSelectedDate.map(b => b.id);

                const permStudentsPromise = permanentBatchIds.length > 0
                    ? supabaseAuth.from('classroom_students').select('classroom_id, student_id, joined_at, users!student_id(status, join_date, created_at)').in('classroom_id', permanentBatchIds)
                    : Promise.resolve({ data: [] });

                const overridesPromise = allBatchIds.length > 0
                    ? supabaseAuth.from('session_student_overrides').select('target_classroom_id, student_id, users!student_id(status)').in('target_classroom_id', allBatchIds).eq('override_date', selectedDate)
                    : Promise.resolve({ data: [] });

                const attendancePromise = allBatchIds.length > 0
                    ? supabaseAuth.from('attendance').select('*').in('classroom_id', allBatchIds).eq('date', selectedDate)
                    : Promise.resolve({ data: [] });

                const coveredPromise = supabaseAuth
                    .from('attendance')
                    .select('id, student_id, classroom_id, date, status, on_behalf_of_date')
                    .eq('on_behalf_of_date', selectedDate)
                    .neq('date', selectedDate)
                    .in('status', ['present', 'late', 'absent', 'excused']);

                const [
                    { data: permRows },
                    { data: overrideRows },
                    { data: attRows },
                    { data: coveredRows }
                ] = await Promise.all([
                    permStudentsPromise,
                    overridesPromise,
                    attendancePromise,
                    coveredPromise
                ]);

                const coveredMap = buildCoveredAttendanceMap(coveredRows || [], selectedDate);
                setCoveredAttendanceMap(prev => {
                    const prevKeys = Object.keys(prev);
                    const nextKeys = Object.keys(coveredMap);
                    if (prevKeys.length !== nextKeys.length) return coveredMap;
                    const isSame = prevKeys.every(k =>
                        prev[k]?.attendanceId === coveredMap[k]?.attendanceId &&
                        prev[k]?.actualDate === coveredMap[k]?.actualDate &&
                        prev[k]?.status === coveredMap[k]?.status
                    );
                    return isSame ? prev : coveredMap;
                });

                const physicalStudentsWithAttendance = new Set<string>();
                (attRows || []).forEach((r: any) => {
                    if (r.student_id && r.classroom_id) {
                        physicalStudentsWithAttendance.add(`${r.student_id}_${r.classroom_id}`);
                    }
                });

                const enrolledCountMap = new Map<string, number>();
                const activeRosterStudentsByBatch = new Set<string>();

                (permRows || []).forEach((r: any) => {
                    const hasAtt = physicalStudentsWithAttendance.has(`${r.student_id}_${r.classroom_id}`) || !!coveredMap[r.student_id];
                    if (isStudentOperationallyActive(r.users?.status) && isStudentEnrolledOnDate(r, selectedDate, hasAtt)) {
                        enrolledCountMap.set(r.classroom_id, (enrolledCountMap.get(r.classroom_id) || 0) + 1);
                        activeRosterStudentsByBatch.add(`${r.classroom_id}_${r.student_id}`);
                    }
                });

                const overrideCountMap = new Map<string, number>();
                (overrideRows || []).forEach((r: any) => {
                    if (isStudentOperationallyActive(r.users?.status)) {
                        overrideCountMap.set(r.target_classroom_id, (overrideCountMap.get(r.target_classroom_id) || 0) + 1);
                        activeRosterStudentsByBatch.add(`${r.target_classroom_id}_${r.student_id}`);
                    }
                });

                const attendanceStatsMap = new Map<string, { present: number; absent: number; late: number; excused: number }>();
                const loadedOnBehalfMap: Record<string, string | null> = {};
                activeBatchesOnSelectedDate.forEach(batch => {
                    loadedOnBehalfMap[batch.id] = batch.alternativeHoliday?.holiday_date || batch.linkedHolidayDate || null;
                });
                (attRows || []).forEach((r: any) => {
                    if (r.on_behalf_of_date && !loadedOnBehalfMap[r.classroom_id]) {
                        loadedOnBehalfMap[r.classroom_id] = r.on_behalf_of_date;
                    }

                    // Only count attendance towards the batch summary if the student is an operationally active roster member of this batch
                    if (!activeRosterStudentsByBatch.has(`${r.classroom_id}_${r.student_id}`)) {
                        return;
                    }

                    if (!attendanceStatsMap.has(r.classroom_id)) {
                        attendanceStatsMap.set(r.classroom_id, { present: 0, absent: 0, late: 0, excused: 0 });
                    }
                    const stats = attendanceStatsMap.get(r.classroom_id)!;
                    if (r.status === 'present') stats.present++;
                    else if (r.status === 'absent') stats.absent++;
                    else if (r.status === 'late') stats.late++;
                    else if (r.status === 'excused') stats.excused++;
                });

                // Include covered students who are not physically marked for this date
                (permRows || []).forEach((r: any) => {
                    const hasAtt = physicalStudentsWithAttendance.has(`${r.student_id}_${r.classroom_id}`) || !!coveredMap[r.student_id];
                    if (isStudentOperationallyActive(r.users?.status) && isStudentEnrolledOnDate(r, selectedDate, hasAtt) && !physicalStudentsWithAttendance.has(`${r.student_id}_${r.classroom_id}`)) {
                        const cov = coveredMap[r.student_id];
                        if (cov) {
                            if (!attendanceStatsMap.has(r.classroom_id)) {
                                attendanceStatsMap.set(r.classroom_id, { present: 0, absent: 0, late: 0, excused: 0 });
                            }
                            const stats = attendanceStatsMap.get(r.classroom_id)!;
                            if (cov.status === 'present') stats.present++;
                            else if (cov.status === 'late') stats.late++;
                            else if (cov.status === 'absent') stats.absent++;
                            else if (cov.status === 'excused') stats.excused++;
                            physicalStudentsWithAttendance.add(`${r.student_id}_${r.classroom_id}`);
                        }
                    }
                });
                (overrideRows || []).forEach((r: any) => {
                    if (isStudentOperationallyActive(r.users?.status) && !physicalStudentsWithAttendance.has(`${r.student_id}_${r.target_classroom_id}`)) {
                        const cov = coveredMap[r.student_id];
                        if (cov) {
                            if (!attendanceStatsMap.has(r.target_classroom_id)) {
                                attendanceStatsMap.set(r.target_classroom_id, { present: 0, absent: 0, late: 0, excused: 0 });
                            }
                            const stats = attendanceStatsMap.get(r.target_classroom_id)!;
                            if (cov.status === 'present') stats.present++;
                            else if (cov.status === 'late') stats.late++;
                            else if (cov.status === 'absent') stats.absent++;
                            else if (cov.status === 'excused') stats.excused++;
                            physicalStudentsWithAttendance.add(`${r.student_id}_${r.target_classroom_id}`);
                        }
                    }
                });

                setBatchOnBehalfOfMap(prev => ({ ...prev, ...loadedOnBehalfMap }));

                const summaries: Record<string, { present: number; absent: number; late: number; excused: number; total: number }> = {};

                activeBatchesOnSelectedDate.forEach(batch => {
                    const enrolledCount = batch.type === 'permanent' ? (enrolledCountMap.get(batch.id) || 0) : 0;
                    const overrideCount = overrideCountMap.get(batch.id) || 0;
                    const total = enrolledCount + overrideCount;

                    const stats = attendanceStatsMap.get(batch.id) || { present: 0, absent: 0, late: 0, excused: 0 };
                    summaries[batch.id] = {
                        present: stats.present,
                        absent: stats.absent,
                        late: stats.late,
                        excused: stats.excused,
                        total
                    };
                });

                setBatchSummaries(summaries);

                // Update dashboard global stats for this day
                const values = Object.values(summaries);
                const total = values.reduce((acc, curr) => acc + curr.total, 0);
                const present = values.reduce((acc, curr) => acc + curr.present + curr.late, 0);
                const absent = values.reduce((acc, curr) => acc + curr.absent, 0);
                const rate = total > 0 ? `${Math.round((present / total) * 100)}%` : '0%';
                setStats({ total, present, absent, rate });
            } catch (e) {
                console.error('Error fetching summaries:', e);
            }
        };

        fetchHeaderSummaries();
    }, [activeBatchesOnSelectedDate, selectedDate]);

    const isFirstDateMount = useRef(true);
    const initialClassIdHandled = useRef(false);

    // Reset expanded batch and cached maps when selectedDate changes to guarantee date-specific roster loading
    useEffect(() => {
        if (isFirstDateMount.current) {
            isFirstDateMount.current = false;
            return;
        }
        setExpandedBatchId(null);
        setBatchStudentsMap({});
        setBatchAttendanceMap({});
        setDateStudentsData([]);
        setDateAttendanceMap({});
        setDateStudentsLoading(true);
    }, [selectedDate]);

    // Accordion Batch expansion fetch
    const handleExpandBatch = async (batchId: string, isTemporary: boolean, forceOpen = false) => {
        if (!forceOpen && expandedBatchId === batchId) {
            setExpandedBatchId(null);
            return;
        }

        const isAdmin = teacherProfile?.role === 'admin';
        if (!isAdmin) {
            const isOwnClass = isTemporary
                ? temporaryClasses.some(tc => (tc.classroom_id === batchId || tc.id === batchId))
                : classrooms.some(c => c.id === batchId);
            if (!isOwnClass) {
                console.error("Authorization error: batch does not belong to this teacher.");
                alert("You are not authorized to view this classroom's attendance.");
                setExpandedBatchId(null);
                return;
            }
        }

        setExpandedBatchId(batchId);

        setBatchLoadingMap(prev => ({ ...prev, [batchId]: true }));

        try {
            let batchRoster: Student[] = [];

                if (!isTemporary) {
                    const { data: permanentStudents } = await supabaseAuth
                        .from('classroom_students')
                        .select('student_id, joined_at, users!student_id(name, profile_pic_url, teacher_id, status, join_date, created_at)')
                        .eq('classroom_id', batchId);
                    
                    const permRoster = (permanentStudents || [])
                        .filter((row: any) => isStudentOperationallyActive(row.users?.status) && (isAdmin || row.users?.teacher_id === teacherProfile?.id) && isStudentEnrolledOnDate(row, selectedDate))
                        .map((row: any) => ({
                            id: row.student_id,
                            name: row.users?.name || 'Unknown Student',
                            profile_pic_url: row.users?.profile_pic_url
                        }));

                    // Fetch temporary session override (makeup) students for this date
                    const { data: overrideStudents } = await supabaseAuth
                        .from('session_student_overrides')
                        .select('student_id, missed_session_date, reason, users!student_id(name, profile_pic_url, teacher_id, status)')
                        .eq('target_classroom_id', batchId)
                        .eq('override_date', selectedDate);

                    const tempRoster = (overrideStudents || [])
                        .filter((row: any) => isStudentOperationallyActive(row.users?.status))
                        .map((row: any) => ({
                            id: row.student_id,
                            name: row.users?.name || 'Unknown Student',
                            profile_pic_url: row.users?.profile_pic_url,
                            isGuest: true,
                            isMakeup: true,
                            missedDate: row.missed_session_date
                        }));

                    batchRoster = [...permRoster, ...tempRoster];
                } else {
                    const { data: tempStudents } = await supabaseAuth
                        .from('session_student_overrides')
                        .select('student_id, users!student_id(name, profile_pic_url, teacher_id, status)')
                        .eq('target_classroom_id', batchId)
                        .eq('override_date', selectedDate);
                    
                    batchRoster = (tempStudents || [])
                        .filter((row: any) => isStudentOperationallyActive(row.users?.status))
                        .map((row: any) => ({
                            id: row.student_id,
                            name: row.users?.name || 'Unknown Student',
                            profile_pic_url: row.users?.profile_pic_url
                        }));
                }

                setBatchStudentsMap(prev => ({ ...prev, [batchId]: batchRoster }));

            // 2. Always fetch fresh attendance data (never cached — must stay in sync with Classroom view)
            const { data: attendanceData } = await supabaseAuth
                .from('attendance')
                .select('*')
                .eq('classroom_id', batchId)
                .eq('date', selectedDate);
            
            const attendanceMap: Record<string, 'present' | 'absent' | 'late' | 'excused'> = {};
            let existingOnBehalfOf: string | null = null;
            (attendanceData || []).forEach((row: any) => {
                attendanceMap[row.student_id] = row.status;
                if (row.on_behalf_of_date && !existingOnBehalfOf) {
                    existingOnBehalfOf = row.on_behalf_of_date;
                }
            });

            // Populate covered students if covered by an alternative date on behalf of selectedDate
            batchRoster.forEach(st => {
                const cov = coveredAttendanceMap[st.id];
                if (cov) {
                    attendanceMap[st.id] = cov.status as any;
                }
            });

            setBatchAttendanceMap(prev => ({ ...prev, [batchId]: attendanceMap }));
            const batchObj = activeBatchesOnSelectedDate.find(b => b.id === batchId);
            const defaultOnBehalf = existingOnBehalfOf || batchObj?.alternativeHoliday?.holiday_date || batchObj?.linkedHolidayDate || null;
            setBatchOnBehalfOfMap(prev => ({ ...prev, [batchId]: defaultOnBehalf }));

        } catch (err) {
            console.error('Error expanding batch:', err);
        } finally {
            setBatchLoadingMap(prev => ({ ...prev, [batchId]: false }));
        }
    };

    const getUpcomingScheduledDatesForBatch = useCallback((batchId: string, baseDateStr: string) => {
        const schedules = allSchedules.filter(s => s.classroom_id === batchId);
        const base = new Date(baseDateStr);
        if (schedules.length === 0) {
            const dates: string[] = [];
            for (let i = 1; i <= 8; i++) {
                const d = new Date(base);
                d.setDate(base.getDate() + i * 7);
                dates.push(d.toISOString().split('T')[0]);
            }
            return dates;
        }

        const dows = new Set(schedules.map(s => s.day_of_week));
        const dates: string[] = [];
        for (let i = 1; i <= 60; i++) {
            const d = new Date(base);
            d.setDate(base.getDate() + i);
            if (dows.has(d.getDay())) {
                dates.push(d.toISOString().split('T')[0]);
                if (dates.length >= 8) break;
            }
        }
        return dates;
    }, [allSchedules]);

    const handleSetBatchOnBehalfOf = async (batchId: string, rawSelection: string | null) => {
        const prevValue = batchOnBehalfOfMap[batchId] || null;
        let selectedHolidayIdFromOption: string | null = null;
        let targetDate: string | null = rawSelection;

        if (rawSelection && rawSelection.startsWith('HOLIDAY:')) {
            const parts = rawSelection.split(':');
            selectedHolidayIdFromOption = parts[1] || null;
            targetDate = parts[2] || null;
        }

        setBatchOnBehalfOfMap(prev => ({ ...prev, [batchId]: targetDate }));

        try {
            const batchObj = activeBatchesOnSelectedDate.find(b => b.id === batchId);
            const tcRow = temporaryClasses.find(tc => (tc.classroom_id || tc.id) === batchId);

            if (!targetDate) {
                // If this batch was previously linked to an active holiday on selectedDate, revert that holiday back to alternative_pending
                const linkedHol = (classroomHolidays || []).find(h =>
                    h.status === 'active' &&
                    (h.holiday_type === 'alternative_scheduled' || h.holiday_type === 'with_alternative') &&
                    String(h.alternative_date || '').split('T')[0] === selectedDate &&
                    (h.classroom_id === batchId || batchObj?.linkedHolidayRoomId === h.classroom_id || String(h.holiday_date).split('T')[0] === prevValue)
                );
                if (linkedHol) {
                    const { error: revErr } = await supabaseAuth.rpc('revert_holiday_alternative_to_pending', {
                        p_holiday_id: linkedHol.id,
                        p_reason: 'Unlinked replacement class from Attendance section'
                    });
                    if (revErr) throw revErr;

                    if (tcRow) {
                        const cleanDesc = String(tcRow.description || '')
                            .replace(/\s*\[OnBehalfOfHoliday:[^\]]+\]/g, '')
                            .replace(/\s*\[HolidayClassroom:[^\]]+\]/g, '')
                            .replace(/\s*\[HolidayId:[^\]]+\]/g, '')
                            .trim();
                        await supabaseAuth.from('classrooms').update({ description: cleanDesc }).eq('id', batchId);
                        setTemporaryClasses(prev => prev.map(tc =>
                            (tc.classroom_id || tc.id) === batchId ? { ...tc, description: cleanDesc } : tc
                        ));
                    }
                    await fetchClassroomHolidays();
                }

                // Clearing on-behalf-of mapping for all attendance rows in this batch on selectedDate
                const { error } = await supabaseAuth
                    .from('attendance')
                    .update({ on_behalf_of_date: null })
                    .eq('classroom_id', batchId)
                    .eq('date', selectedDate);
                if (error) throw error;
            } else {
                // Resolve matching active holiday either by explicit holiday ID or by classroom + date
                const matchingHol = selectedHolidayIdFromOption
                    ? (classroomHolidays || []).find(h => h.id === selectedHolidayIdFromOption && h.status === 'active')
                    : (classroomHolidays || []).find(
                        h => h.status === 'active' &&
                             String(h.holiday_date).split('T')[0] === targetDate &&
                             (h.classroom_id === batchId || batchObj?.linkedHolidayRoomId === h.classroom_id || batchObj?.type === 'temporary')
                    );

                if (matchingHol && matchingHol.holiday_type !== 'no_alternative') {
                    const altStartTime = tcRow?.start_time || batchObj?.startTime || null;
                    const altEndTime = tcRow?.end_time || null;

                    const { error: schedErr } = await supabaseAuth.rpc('schedule_holiday_alternative', {
                        p_holiday_id: matchingHol.id,
                        p_alternative_date: selectedDate,
                        p_alt_start_time: altStartTime,
                        p_alt_end_time: altEndTime,
                        p_reason: `Linked to ${batchObj?.name || 'replacement class'} on ${selectedDate}`
                    });
                    if (schedErr) throw schedErr;

                    // If this batch is a Special Session (temporary_classes), persist linkage tags in shadow classroom description & credit_treatment
                    if (tcRow) {
                        const baseDesc = String(tcRow.description || '')
                            .replace(/\s*\[OnBehalfOfHoliday:[^\]]+\]/g, '')
                            .replace(/\s*\[HolidayClassroom:[^\]]+\]/g, '')
                            .replace(/\s*\[HolidayId:[^\]]+\]/g, '')
                            .trim();
                        const holDateClean = String(matchingHol.holiday_date).split('T')[0];
                        const updatedDesc = `${baseDesc} [OnBehalfOfHoliday:${holDateClean}][HolidayClassroom:${matchingHol.classroom_id}][HolidayId:${matchingHol.id}]`.trim();

                        await Promise.all([
                            supabaseAuth.from('classrooms').update({ description: updatedDesc }).eq('id', batchId),
                            supabaseAuth.from('temporary_classes').update({ credit_treatment: 'consume_credit' }).eq('classroom_id', batchId),
                            supabaseAuth.from('session_student_overrides')
                                .update({ credit_treatment: 'consume_credit' })
                                .eq('target_classroom_id', batchId)
                                .eq('override_date', selectedDate)
                                .eq('credit_treatment', 'complimentary')
                        ]);

                        setTemporaryClasses(prev => prev.map(tc =>
                            (tc.classroom_id || tc.id) === batchId
                                ? { ...tc, description: updatedDesc, credit_treatment: 'consume_credit' }
                                : tc
                        ));
                    }

                    await fetchClassroomHolidays();
                    fetchPendingReport();
                }

                // Fetch attendance rows for this batch and date
                const { data: attRows, error: fetchErr } = await supabaseAuth
                    .from('attendance')
                    .select('id, student_id')
                    .eq('classroom_id', batchId)
                    .eq('date', selectedDate);
                if (fetchErr) throw fetchErr;

                if (attRows && attRows.length > 0) {
                    const studentIds = attRows.map(r => r.student_id);
                    // Check if any student already has an on_behalf_of_date record for targetDate in another classroom (e.g. guest makeup students)
                    const { data: conflicts, error: conflictErr } = await supabaseAuth
                        .from('attendance')
                        .select('student_id')
                        .eq('on_behalf_of_date', targetDate)
                        .in('student_id', studentIds)
                        .neq('classroom_id', batchId);
                    if (conflictErr) throw conflictErr;

                    const conflictSet = new Set((conflicts || []).map(c => c.student_id));
                    const eligibleIds = attRows
                        .filter(r => !conflictSet.has(r.student_id))
                        .map(r => r.id);

                    if (eligibleIds.length > 0) {
                        const { error: updateErr } = await supabaseAuth
                            .from('attendance')
                            .update({ on_behalf_of_date: targetDate })
                            .in('id', eligibleIds);
                        if (updateErr) throw updateErr;
                    }
                }
            }
        } catch (err: any) {
            console.error('Error updating on_behalf_of_date for batch:', err);
            setBatchOnBehalfOfMap(prev => ({ ...prev, [batchId]: prevValue }));
            alert(`Failed to update on-behalf date: ${err.message || err}`);
        }
    };

    // BR-22: alternative class is a Special Session; cancel it when the holiday/alternative is withdrawn
    const cancelLinkedAlternativeSession = async (holidayId: string) => {
        try {
            await cancelAlternativeSpecialSession(supabaseAuth, holidayId);
            setTemporaryClasses(prev => prev.filter(tc => !String(tc.description || '').includes(`[HolidayId:${holidayId}]`)));
        } catch (sessErr) {
            console.error('Error cancelling alternative class special session:', sessErr);
        }
    };

    const handleCancelHoliday = async (holiday: any) => {
        if (!holiday?.id) return;
        const reason = window.prompt(
            `Cancel declared class off on ${holiday.holiday_date}?\nPlease enter a cancellation reason (minimum 3 characters):`,
            'Regular class restored by teacher'
        );
        if (!reason || reason.trim().length < 3) {
            if (reason !== null) {
                alert('A valid cancellation reason (minimum 3 characters) is required.');
            }
            return;
        }
        try {
            const { error } = await supabaseAuth.rpc('cancel_classroom_holiday', {
                p_holiday_id: holiday.id,
                p_reason: reason.trim()
            });
            if (error) throw error;
            await cancelLinkedAlternativeSession(holiday.id);
            await fetchClassroomHolidays();
            fetchPendingReport();
        } catch (err: any) {
            console.error('Error cancelling class off:', err);
            alert(err?.message || 'Failed to cancel class off.');
        }
    };

    const handleRevertHolidayToPending = async (holiday: any) => {
        if (!holiday?.id) return;
        const reason = window.prompt(
            `Revert scheduled alternative date (${holiday.alternative_date}) back to Alternative Pending?\nPlease enter a reason (minimum 3 characters):`,
            'Rescheduling replacement date later'
        );
        if (!reason || reason.trim().length < 3) {
            if (reason !== null) {
                alert('A valid reason (minimum 3 characters) is required.');
            }
            return;
        }
        try {
            const { error } = await supabaseAuth.rpc('revert_holiday_alternative_to_pending', {
                p_holiday_id: holiday.id,
                p_reason: reason.trim()
            });
            if (error) throw error;
            await cancelLinkedAlternativeSession(holiday.id);
            await fetchClassroomHolidays();
            fetchPendingReport();
        } catch (err: any) {
            console.error('Error reverting holiday alternative:', err);
            alert(err?.message || 'Failed to revert alternative to pending.');
        }
    };

    // Auto-expand batch if classId was passed via URL
    useEffect(() => {
        if (loading || initialClassIdHandled.current) return;
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const targetClassId = params.get('classId');
            if (targetClassId) {
                initialClassIdHandled.current = true;
                const isTemp = temporaryClasses.some(tc => tc.classroom_id === targetClassId || tc.id === targetClassId);
                handleExpandBatch(targetClassId, isTemp, true);
            }
        }
    }, [loading, temporaryClasses, classrooms]);

    const fetchLeaveRequests = useCallback(async (loadedRooms = classrooms) => {
        if (!teacherProfile) return;
        setLeavesLoading(true);
        try {
            const isAdmin = teacherProfile.role === 'admin';
            const roomIds = loadedRooms.map(c => c.id);

            // 1. Pending leave requests: always query all pending requests regardless of date
            // so actionable items are never hidden by historical date ranges
            let pendingQuery = supabaseAuth
                .from('leave_requests')
                .select(`
                    id,
                    student_id,
                    classroom_id,
                    class_date,
                    reason,
                    status,
                    created_at,
                    users!student_id(id, name, email, profile_pic_url, teacher_id),
                    classrooms!classroom_id(id, name)
                `)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (!isAdmin && roomIds.length > 0) {
                pendingQuery = pendingQuery.in('classroom_id', roomIds);
            }

            // 2. Historical approved/rejected leave requests: query within the selected reporting range
            let historicalQuery = supabaseAuth
                .from('leave_requests')
                .select(`
                    id,
                    student_id,
                    classroom_id,
                    class_date,
                    reason,
                    status,
                    created_at,
                    users!student_id(id, name, email, profile_pic_url, teacher_id),
                    classrooms!classroom_id(id, name)
                `)
                .in('status', ['approved', 'rejected'])
                .gte('class_date', fromDate)
                .lte('class_date', toDate)
                .order('class_date', { ascending: false });

            if (!isAdmin && roomIds.length > 0) {
                historicalQuery = historicalQuery.in('classroom_id', roomIds);
            }

            const [{ data: pendingLeaves, error: pErr }, { data: historicalLeaves, error: hErr }] = await Promise.all([
                pendingQuery,
                historicalQuery
            ]);

            if (pErr) throw pErr;
            if (hErr) throw hErr;

            const allLeaves = [...(pendingLeaves || []), ...(historicalLeaves || [])];
            const filteredLeaves = allLeaves.filter((l: any) => isAdmin || l.users?.teacher_id === teacherProfile.id);

            // 3. Enrich leave requests with scheduled/completed makeup details
            const studentIds = Array.from(new Set(filteredLeaves.map((l: any) => l.student_id).filter(Boolean)));
            let enrichedLeaves = filteredLeaves;

            if (studentIds.length > 0) {
                const [{ data: overridesDataRaw }, { data: attendanceData }] = await Promise.all([
                    supabaseAuth
                        .from('session_student_overrides')
                        .select('id, student_id, target_classroom_id, override_date, missed_session_date, reason, booking_status, credit_treatment')
                        .in('student_id', studentIds)
                        .order('override_date', { ascending: true }),
                    supabaseAuth
                        .from('attendance')
                        .select('id, student_id, classroom_id, date, status, on_behalf_of_date')
                        .in('student_id', studentIds)
                ]);

                const overridesData = (overridesDataRaw || []).filter((o: any) => o.booking_status !== 'cancelled');

                const attendanceMap: Record<string, string> = {};
                (attendanceData || []).forEach((r: any) => {
                    const cleanDate = (r.date || '').split('T')[0].split(' ')[0];
                    const key = `${r.student_id}_${r.classroom_id}_${cleanDate}`;
                    attendanceMap[key] = r.status;
                });

                const onBehalfAttendance: Record<string, any> = {};
                (attendanceData || []).forEach((r: any) => {
                    if (r.on_behalf_of_date) {
                        const cleanObDate = r.on_behalf_of_date.split('T')[0].split(' ')[0];
                        const key = `${r.student_id}_${cleanObDate}`;
                        onBehalfAttendance[key] = r;
                    }
                });

                enrichedLeaves = filteredLeaves.map((lr: any) => {
                    const reqDateClean = (lr.class_date || '').split('T')[0].split(' ')[0];
                    const studentOverrides = overridesData.filter((o: any) => o.student_id === lr.student_id);

                    // 1. Match initial makeup override
                    let initialMakeup = studentOverrides.find((o: any) => {
                        if (!o.override_date) return false;
                        const oMissedDate = o.missed_session_date ? o.missed_session_date.split('T')[0].split(' ')[0] : null;
                        if (oMissedDate && oMissedDate === reqDateClean) return true;
                        if (o.reason && o.reason.includes(`[MissedDate:${reqDateClean}]`)) return true;
                        return false;
                    });

                    // Fallback to chronological order if not tagged with specific missed date
                    if (!initialMakeup) {
                        initialMakeup = studentOverrides.find((o: any) => {
                            if (!o.override_date) return false;
                            const oMissedDate = o.missed_session_date ? o.missed_session_date.split('T')[0].split(' ')[0] : null;
                            if (!oMissedDate && (!o.reason || !o.reason.includes('[MissedDate:'))) {
                                const oDateClean = o.override_date.split('T')[0].split(' ')[0];
                                return oDateClean >= reqDateClean;
                            }
                            return false;
                        });
                    }

                    // Follow chain if rescheduled
                    let currentMakeup = initialMakeup;
                    let visited = new Set();
                    while (currentMakeup) {
                        if (visited.has(currentMakeup.id)) break;
                        visited.add(currentMakeup.id);

                        const mDateClean = (currentMakeup.override_date || '').split('T')[0].split(' ')[0];
                        const attKey = `${lr.student_id}_${currentMakeup.target_classroom_id}_${mDateClean}`;
                        const attStatus = attendanceMap[attKey];

                        if (attStatus === 'absent' || attStatus === 'excused') {
                            const nextMakeup = studentOverrides.find((o: any) => {
                                if (!o.override_date || o.id === currentMakeup.id) return false;
                                const oMissedDate = o.missed_session_date ? o.missed_session_date.split('T')[0].split(' ')[0] : null;
                                if (oMissedDate && oMissedDate === mDateClean) return true;
                                if (o.reason && o.reason.includes(`[MissedDate:${mDateClean}]`)) return true;
                                return false;
                            });
                            if (nextMakeup) {
                                currentMakeup = nextMakeup;
                            } else {
                                break;
                            }
                        } else {
                            break;
                        }
                    }

                    let isMakeupCompleted = false;
                    let isMakeupMissed = false;
                    let makeupAttendanceStatus = '';

                    if (currentMakeup) {
                        const mDateClean = (currentMakeup.override_date || '').split('T')[0].split(' ')[0];
                        const attKey = `${lr.student_id}_${currentMakeup.target_classroom_id}_${mDateClean}`;
                        const attStatus = attendanceMap[attKey];
                        if (attStatus === 'present' || attStatus === 'late') {
                            isMakeupCompleted = true;
                            makeupAttendanceStatus = attStatus;
                        } else if (attStatus === 'absent' || attStatus === 'excused') {
                            isMakeupMissed = true;
                            makeupAttendanceStatus = attStatus;
                        }
                    }

                    // Also check onBehalfAttendance if not completed via override attendance
                    if (!isMakeupCompleted) {
                        const obAtt = onBehalfAttendance[`${lr.student_id}_${reqDateClean}`];
                        if (obAtt && (obAtt.status === 'present' || obAtt.status === 'late')) {
                            isMakeupCompleted = true;
                            makeupAttendanceStatus = obAtt.status;
                            if (!currentMakeup) {
                                currentMakeup = {
                                    id: 'ob_' + obAtt.id,
                                    student_id: lr.student_id,
                                    target_classroom_id: obAtt.classroom_id,
                                    override_date: obAtt.date,
                                    missed_session_date: reqDateClean,
                                    reason: 'Alternative class attended',
                                    booking_status: 'completed',
                                    credit_treatment: 'makeup'
                                };
                            }
                        }
                    }

                    return {
                        ...lr,
                        scheduledMakeup: currentMakeup,
                        isMakeupCompleted,
                        isMakeupMissed,
                        makeupAttendanceStatus
                    };
                });
            }

            setLeaveRequests(enrichedLeaves);
        } catch (err) {
            console.error('Error fetching leave requests:', err);
        } finally {
            setLeavesLoading(false);
        }
    }, [classrooms, teacherProfile, fromDate, toDate]);

    const fetchLeaveRequestsRef = useRef(fetchLeaveRequests);
    const fetchMissedReportRef = useRef<() => void>(() => {});
    useEffect(() => {
        fetchLeaveRequestsRef.current = fetchLeaveRequests;
    }, [fetchLeaveRequests]);

    // Fetch leave requests when teacherProfile or date range changes
    useEffect(() => {
        if (teacherProfile) {
            fetchLeaveRequests();
        }
    }, [teacherProfile, fetchLeaveRequests]);

    // Realtime updates for leave requests, attendance, and session overrides (makeups)
    useEffect(() => {
        if (!teacherProfile) return;

        const channel = supabaseAuth
            .channel('realtime_attendance_leave_requests_channel')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'leave_requests' },
                () => {
                    fetchLeaveRequestsRef.current();
                    fetchMissedReportRef.current?.();
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'attendance' },
                () => {
                    fetchLeaveRequestsRef.current();
                    fetchMissedReportRef.current?.();
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'session_student_overrides' },
                () => {
                    fetchLeaveRequestsRef.current();
                    fetchMissedReportRef.current?.();
                }
            )
            .subscribe();

        return () => {
            supabaseAuth.removeChannel(channel);
        };
    }, [teacherProfile?.id]);

    const handleApproveLeave = async (request: any) => {
        if (!teacherProfile) return;
        try {
            const { error } = await supabaseAuth.rpc('approve_student_leave', {
                p_leave_id: request.id
            });

            if (error) throw error;

            fetchLeaveRequests();
        } catch (err: any) {
            console.error('Error approving leave:', err);
            alert(err?.message || 'Failed to approve leave request.');
        }
    };

    const handleRejectLeave = async (request: any) => {
        try {
            const { error: updateError } = await supabaseAuth.rpc('reject_student_leave', {
                p_leave_id: request.id,
                p_reason: 'Rejected by teacher'
            });

            if (updateError) throw updateError;

            fetchLeaveRequests();
        } catch (err) {
            console.error('Error rejecting leave:', err);
            alert('Failed to reject leave request.');
        }
    };

    // Reconcile batch summaries and header metrics dynamically without full refetch
    const reconcileAttendanceTotals = useCallback((classroomId: string, prevStatus?: string | null, newStatus?: string | null) => {
        if (!classroomId || prevStatus === newStatus) return;

        setBatchSummaries(prev => {
            const batchSummary = prev[classroomId] || { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
            let presentDiff = 0;
            let absentDiff = 0;
            let lateDiff = 0;
            let excusedDiff = 0;

            if (prevStatus === 'present') presentDiff--;
            if (prevStatus === 'absent') absentDiff--;
            if (prevStatus === 'late') lateDiff--;
            if (prevStatus === 'excused') excusedDiff--;

            if (newStatus === 'present') presentDiff++;
            if (newStatus === 'absent') absentDiff++;
            if (newStatus === 'late') lateDiff++;
            if (newStatus === 'excused') excusedDiff++;

            return {
                ...prev,
                [classroomId]: {
                    ...batchSummary,
                    present: Math.max(0, batchSummary.present + presentDiff),
                    absent: Math.max(0, batchSummary.absent + absentDiff),
                    late: Math.max(0, batchSummary.late + lateDiff),
                    excused: Math.max(0, batchSummary.excused + excusedDiff)
                }
            };
        });

        setStats(prev => {
            let presentDiff = 0;
            let absentDiff = 0;

            if (prevStatus === 'present' || prevStatus === 'late') presentDiff--;
            if (prevStatus === 'absent') absentDiff--;

            if (newStatus === 'present' || newStatus === 'late') presentDiff++;
            if (newStatus === 'absent') absentDiff++;

            const newPresent = Math.max(0, prev.present + presentDiff);
            const newAbsent = Math.max(0, prev.absent + absentDiff);
            const rate = prev.total > 0 ? `${Math.round((newPresent / prev.total) * 100)}%` : '0%';

            return {
                ...prev,
                present: newPresent,
                absent: newAbsent,
                rate
            };
        });
    }, []);

    // Unmark attendance inside expanded batch
    const handleUnmarkBatchAttendance = async (batchId: string, studentId: string) => {
        if (!teacherProfile) return;

        const lockKey = `${batchId}_${studentId}`;
        if (savingAttendanceMap[lockKey]) return;

        const coveredInfo = coveredAttendanceMap[studentId];
        if (coveredInfo) {
            alert(`Cannot unmark attendance: This student was already counted on ${formatLocalDateStr(coveredInfo.actualDate)} on behalf of this date.`);
            return;
        }

        const isAdmin = teacherProfile.role === 'admin';
        if (!isAdmin) {
            const isOwnClass = temporaryClasses.some(tc => tc.id === batchId) ||
                               classrooms.some(c => c.id === batchId);
            if (!isOwnClass) {
                alert("You are not authorized to unmark attendance for this class.");
                return;
            }
        }

        const prevStatus = batchAttendanceMap[batchId]?.[studentId];
        if (!prevStatus) return;

        setSavingAttendanceMap(prev => ({ ...prev, [lockKey]: true }));
        try {
            // Fetch attendance record to unmark
            const { data: existingRow } = await supabaseAuth
                .from('attendance')
                .select('id, student_id, classroom_id, date, status')
                .eq('classroom_id', batchId)
                .eq('student_id', studentId)
                .eq('date', selectedDate)
                .maybeSingle();

            if (existingRow) {
                // Optimistically update
                setBatchAttendanceMap(prev => {
                    const curr = { ...(prev[batchId] || {}) };
                    delete curr[studentId];
                    return {
                        ...prev,
                        [batchId]: curr
                    };
                });
                const k = `${studentId}_${batchId}`;
                setDateAttendanceMap(prev => {
                    const next = { ...prev };
                    delete next[k];
                    return next;
                });

                // Update batch summary and header stats
                reconcileAttendanceTotals(batchId, prevStatus, null);

                try {
                    const { error: rpcErr } = await supabaseAuth.rpc('unmark_historical_attendance', {
                        p_attendance_id: existingRow.id,
                        p_reason: 'Attendance unmarked by teacher'
                    });
                    if (rpcErr) {
                        const errMsg = (rpcErr.message || rpcErr.details || '').toLowerCase();
                        if (!errMsg.includes('not found')) {
                            throw rpcErr;
                        }
                    }

                    fetchPendingReport().catch(e => console.error('Error refreshing pending report:', e));
                } catch (err: any) {
                    console.error('Error unmarking attendance:', err?.message || err?.details || err);
                    alert(`Failed to unmark attendance: ${err.message || err}`);
                    // Revert
                    setBatchAttendanceMap(prev => ({
                        ...prev,
                        [batchId]: {
                            ...(prev[batchId] || {}),
                            [studentId]: prevStatus
                        }
                    }));
                    setDateAttendanceMap(prev => ({
                        ...prev,
                        [k]: prevStatus
                    }));
                    reconcileAttendanceTotals(batchId, null, prevStatus);
                }
            }
        } finally {
            setSavingAttendanceMap(prev => ({ ...prev, [lockKey]: false }));
        }
    };

    // Quick Mark inside expanded batch
    const handleMarkBatchAttendance = async (
        batchId: string, 
        studentId: string, 
        status: 'present' | 'absent' | 'late' | 'excused'
    ) => {
        if (!teacherProfile) return;

        const lockKey = `${batchId}_${studentId}`;
        if (savingAttendanceMap[lockKey]) return;

        let coveredInfo = coveredAttendanceMap[studentId];
        if (!coveredInfo) {
            const { data: dbCovered } = await supabaseAuth
                .from('attendance')
                .select('id, date, status')
                .eq('student_id', studentId)
                .eq('on_behalf_of_date', selectedDate)
                .neq('date', selectedDate)
                .in('status', ['present', 'late', 'absent', 'excused'])
                .limit(1);
            if (dbCovered && dbCovered.length > 0) {
                coveredInfo = {
                    attendanceId: dbCovered[0].id,
                    studentId,
                    classroomId: batchId,
                    actualDate: dbCovered[0].date,
                    targetDate: selectedDate,
                    status: dbCovered[0].status
                };
                setCoveredAttendanceMap(prev => ({ ...prev, [studentId]: coveredInfo! }));
            }
        }
        if (coveredInfo) {
            alert(`Cannot change attendance: This student was already counted on ${formatLocalDateStr(coveredInfo.actualDate)} on behalf of this date.`);
            return;
        }

        const isAdmin = teacherProfile.role === 'admin';
        if (!isAdmin) {
            const isOwnClass = temporaryClasses.some(tc => tc.id === batchId) ||
                               classrooms.some(c => c.id === batchId);
            if (!isOwnClass) {
                alert("You are not authorized to mark attendance for this class.");
                return;
            }
        }

        // If status is already selected, unmark it
        if (batchAttendanceMap[batchId]?.[studentId] === status) {
            await handleUnmarkBatchAttendance(batchId, studentId);
            return;
        }

        setSavingAttendanceMap(prev => ({ ...prev, [lockKey]: true }));
        try {
            const currentBatchStatus = batchAttendanceMap[batchId]?.[studentId];
            const k = `${studentId}_${batchId}`;

            // If an attendance status was already recorded, modifying it directly uses the audited RPC
            // without demanding a justification modal
            if (currentBatchStatus && currentBatchStatus !== status) {
                const { data: existingRow } = await supabaseAuth
                    .from('attendance')
                    .select('id, student_id, classroom_id, date, status')
                    .eq('classroom_id', batchId)
                    .eq('student_id', studentId)
                    .eq('date', selectedDate)
                    .maybeSingle();

                if (existingRow) {
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
                    setDateAttendanceMap(prev => ({
                        ...prev,
                        [k]: status
                    }));

                    try {
                        const { error: rpcErr } = await supabaseAuth.rpc('correct_historical_attendance', {
                            p_attendance_id: existingRow.id,
                            p_new_status: status.toLowerCase(),
                            p_reason: 'Attendance updated by teacher',
                            p_authorized_credit_delta: null
                        });

                        if (rpcErr) {
                            const errMsg = (rpcErr.message || rpcErr.details || '').toLowerCase();
                            if (errMsg.includes('not found')) {
                                // If row was concurrently removed, fallback to insert
                                console.warn('Attendance record not found in RPC, inserting fresh record:', existingRow.id);
                                const batchForRoom = activeBatchesOnSelectedDate.find(b => b.id === batchId);
                                const onBehalfDate = batchOnBehalfOfMap[batchId] || batchForRoom?.alternativeHoliday?.holiday_date || batchForRoom?.linkedHolidayDate || null;
                                const { error: insErr } = await supabaseAuth
                                    .from('attendance')
                                    .insert({
                                        student_id: studentId,
                                        classroom_id: batchId,
                                        date: selectedDate,
                                        status: status.toLowerCase(),
                                        marked_by: teacherProfile.id,
                                        on_behalf_of_date: onBehalfDate
                                    });
                                if (insErr) throw insErr;
                            } else {
                                throw rpcErr;
                            }
                        }

                        handleFeeBalanceTransitionNotifications({
                            studentId,
                            teacherId: teacherProfile?.id,
                            supabase: supabaseAuth
                        }).catch(e => console.error('Error checking fee balance transition:', e));

                        fetchPendingReport().catch(e => console.error('Error refreshing pending report:', e));

                        // Recalculate summary stats for this batch header dynamically
                        reconcileAttendanceTotals(batchId, currentBatchStatus, status);
                        return;
                    } catch (err: any) {
                        console.error('Error updating attendance:', err?.message || err?.details || err);
                        alert(`Failed to update attendance: ${err.message || err}`);
                        // Revert
                        setBatchAttendanceMap(prev => ({
                            ...prev,
                            [batchId]: {
                                ...(prev[batchId] || {}),
                                [studentId]: currentBatchStatus
                            }
                        }));
                        setDateAttendanceMap(prev => ({
                            ...prev,
                            [k]: currentBatchStatus
                        }));
                        reconcileAttendanceTotals(batchId, status, currentBatchStatus);
                        return;
                    }
                }
            }

            // Fresh mark (insert)
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
            setDateAttendanceMap(prev => ({
                ...prev,
                [k]: status
            }));

            const prevRecords = batchAttendanceMap[batchId] || {};
            const prevStatus = prevRecords[studentId];
            reconcileAttendanceTotals(batchId, prevStatus || null, status);

            try {
                const batchForRoom = activeBatchesOnSelectedDate.find(b => b.id === batchId);
                if (batchForRoom?.activeHoliday) {
                    throw new Error(`Cannot record attendance: ${selectedDate} is declared as a class off for this classroom.`);
                }
                let onBehalfDate = batchOnBehalfOfMap[batchId] || batchForRoom?.alternativeHoliday?.holiday_date || batchForRoom?.linkedHolidayDate || null;
                if (onBehalfDate) {
                    // Ensure student doesn't already have an on_behalf_of_date record for this target date in another class
                    const { data: conflict } = await supabaseAuth
                        .from('attendance')
                        .select('id')
                        .eq('student_id', studentId)
                        .eq('on_behalf_of_date', onBehalfDate)
                        .neq('classroom_id', batchId)
                        .limit(1);
                    if (conflict && conflict.length > 0) {
                        onBehalfDate = null;
                    }
                }

                const { data: insData, error } = await supabaseAuth
                    .from('attendance')
                    .insert({
                        student_id: studentId,
                        classroom_id: batchId,
                        date: selectedDate,
                        status: (status as string).toLowerCase(),
                        marked_by: teacherProfile.id,
                        on_behalf_of_date: onBehalfDate
                    })
                    .select('id, status')
                    .maybeSingle();

                if (error) throw error;

                const confirmedStatus = (insData?.status || status).toLowerCase() as any;
                setBatchAttendanceMap(prev => {
                    const currentBatch = prev[batchId] || {};
                    return {
                        ...prev,
                        [batchId]: {
                            ...currentBatch,
                            [studentId]: confirmedStatus
                        }
                    };
                });
                setDateAttendanceMap(prev => ({
                    ...prev,
                    [k]: confirmedStatus
                }));

                handleFeeBalanceTransitionNotifications({
                    studentId,
                    teacherId: teacherProfile?.id,
                    supabase: supabaseAuth
                }).catch(e => console.error('Error checking fee balance transition:', e));

                fetchPendingReport().catch(e => console.error('Error refreshing pending report:', e));

            } catch (err: any) {
                console.error('Error marking attendance:', err?.message || err?.details || err);
                alert(`Failed to save attendance: ${err.message || err}`);
                
                // Revert state
                const { data } = await supabaseAuth
                    .from('attendance')
                    .select('status')
                    .eq('classroom_id', batchId)
                    .eq('student_id', studentId)
                    .eq('date', selectedDate)
                    .single();
                
                const revertedStatus = data?.status || undefined;
                setBatchAttendanceMap(prev => {
                    const currentBatch = prev[batchId] || {};
                    return {
                        ...prev,
                        [batchId]: {
                            ...currentBatch,
                            [studentId]: revertedStatus
                        }
                    };
                });
                setDateAttendanceMap(prev => {
                    const next = { ...prev };
                    if (revertedStatus) {
                        next[k] = revertedStatus;
                    } else {
                        delete next[k];
                    }
                    return next;
                });
                reconcileAttendanceTotals(batchId, status, revertedStatus || null);
            }
        } finally {
            setSavingAttendanceMap(prev => ({ ...prev, [lockKey]: false }));
        }
    };

    // ── Quick Student Search (Top Search Bar) logic ───────────────────────────
    useEffect(() => {
        const searchStudents = async () => {
            if (!teacherProfile) return;
            if (quickStudentSearch.trim().length < 2) {
                setQuickSearchResults([]);
                return;
            }

            setQuickSearchLoading(true);
            try {
                const studentsQuery = supabaseAuth
                    .from('users')
                    .select('id, name, profile_pic_url')
                    .or('role.eq.student,role.eq.pending,role.eq.mentor')
                    .eq('status', 'active')
                    .ilike('name', `%${quickStudentSearch.trim()}%`)
                    .limit(10);
                
                const { data } = teacherProfile.role === 'admin'
                    ? await studentsQuery
                    : await studentsQuery.eq('teacher_id', teacherProfile.id);
                
                setQuickSearchResults(data || []);
            } catch (err) {
                console.error('Error searching students:', err);
            } finally {
                setQuickSearchLoading(false);
            }
        };

        const timer = setTimeout(searchStudents, 250);
        return () => clearTimeout(timer);
    }, [quickStudentSearch, teacherProfile]);

    const activeBatchesRef = useRef(activeBatchesOnSelectedDate);
    activeBatchesRef.current = activeBatchesOnSelectedDate;

    const coveredAttendanceMapRef = useRef(coveredAttendanceMap);
    coveredAttendanceMapRef.current = coveredAttendanceMap;

    const dateStudentsDataRef = useRef(dateStudentsData);
    dateStudentsDataRef.current = dateStudentsData;

    const activeBatchSignature = useMemo(() => {
        return activeBatchesOnSelectedDate.map(b => `${b.id}_${b.type}_${b.name}`).join('|');
    }, [activeBatchesOnSelectedDate]);

    // ── Fetch students allocated for the selected date (Individual Range mode) ──
    const fetchDateStudents = useCallback(async (isSilent = false) => {
        const currentBatches = activeBatchesRef.current;
        if (!teacherProfile || currentBatches.length === 0) {
            setDateStudentsData([]);
            setDateAttendanceMap({});
            return;
        }
        if (!isSilent && dateStudentsDataRef.current.length === 0) {
            setDateStudentsLoading(true);
        }
        try {
            const isAdmin = teacherProfile.role === 'admin';
            const entries: DateStudentEntry[] = [];
            const allBatchIds = currentBatches.map(b => b.id);
            const { data: attData } = allBatchIds.length > 0
                ? await supabaseAuth
                    .from('attendance')
                    .select('student_id, classroom_id, status')
                    .in('classroom_id', allBatchIds)
                    .eq('date', selectedDate)
                : { data: [] };

            const existingAttSet = new Set<string>();
            const newMap: Record<string, 'present' | 'absent' | 'late' | 'excused'> = {};
            (attData || []).forEach((row: any) => {
                const key = `${row.student_id}_${row.classroom_id}`;
                existingAttSet.add(key);
                newMap[key] = row.status;
            });

            const currentCoveredMap = coveredAttendanceMapRef.current;

            await Promise.all(currentBatches.map(async (batch) => {
                const batchName = batch.name;
                const batchId = batch.id;
                const isTemporary = batch.type === 'temporary';

                if (!isTemporary) {
                    // Permanent classroom: enrolled students
                    const { data: permanentStudents } = await supabaseAuth
                        .from('classroom_students')
                        .select('student_id, joined_at, users!student_id(name, profile_pic_url, teacher_id, status, join_date, created_at)')
                        .eq('classroom_id', batchId);

                    (permanentStudents || [])
                        .filter((row: any) => {
                            const hasAtt = existingAttSet.has(`${row.student_id}_${batchId}`) || !!currentCoveredMap[row.student_id];
                            return isStudentOperationallyActive(row.users?.status) &&
                                (isAdmin || row.users?.teacher_id === teacherProfile.id) &&
                                isStudentEnrolledOnDate(row, selectedDate, hasAtt);
                        })
                        .forEach((row: any) => {
                            entries.push({
                                student: { id: row.student_id, name: row.users?.name || 'Unknown Student', profile_pic_url: row.users?.profile_pic_url },
                                classroom_id: batchId,
                                classroom_name: batchName,
                                isMakeup: false
                            });
                        });

                    // Makeup students assigned to this classroom on this date
                    const { data: overrideStudents } = await supabaseAuth
                        .from('session_student_overrides')
                        .select('student_id, users!student_id(name, profile_pic_url, teacher_id, status)')
                        .eq('target_classroom_id', batchId)
                        .eq('override_date', selectedDate);

                    (overrideStudents || [])
                        .filter((row: any) => isStudentOperationallyActive(row.users?.status))
                        .forEach((row: any) => {
                            entries.push({
                                student: { id: row.student_id, name: row.users?.name || 'Unknown Student', profile_pic_url: row.users?.profile_pic_url },
                                classroom_id: batchId,
                                classroom_name: batchName,
                                isMakeup: true
                            });
                        });
                } else {
                    // Temporary class: only override/makeup students
                    const { data: tempStudents } = await supabaseAuth
                        .from('session_student_overrides')
                        .select('student_id, users!student_id(name, profile_pic_url, teacher_id, status)')
                        .eq('target_classroom_id', batchId)
                        .eq('override_date', selectedDate);

                    (tempStudents || [])
                        .filter((row: any) => isStudentOperationallyActive(row.users?.status))
                        .forEach((row: any) => {
                            entries.push({
                                student: { id: row.student_id, name: row.users?.name || 'Unknown Student', profile_pic_url: row.users?.profile_pic_url },
                                classroom_id: batchId,
                                classroom_name: batchName,
                                isMakeup: false
                            });
                        });
                }
            }));

            setDateStudentsData(entries);

            // Populate covered students if covered on an alternative date
            entries.forEach(e => {
                const k = `${e.student.id}_${e.classroom_id}`;
                const cov = currentCoveredMap[e.student.id];
                if (cov && !newMap[k]) {
                    newMap[k] = cov.status as any;
                }
            });
            setDateAttendanceMap(newMap);
        } catch (err) {
            console.error('Error fetching date students:', err);
        } finally {
            setDateStudentsLoading(false);
        }
    }, [teacherProfile?.id, teacherProfile?.role, selectedDate, activeBatchSignature]);

    useEffect(() => {
        if (mode === 'individual') {
            fetchDateStudents();
        }
    }, [mode, selectedDate, activeBatchSignature, fetchDateStudents]);

    // Unmark attendance from Individual Range date view
    const handleUnmarkDateAttendance = async (studentId: string, classroomId: string) => {
        if (!teacherProfile) return;

        const lockKey = `${classroomId}_${studentId}`;
        if (savingAttendanceMap[lockKey]) return;

        const coveredInfo = coveredAttendanceMap[studentId];
        if (coveredInfo) {
            alert(`Cannot unmark attendance: This student was already counted on ${formatLocalDateStr(coveredInfo.actualDate)} on behalf of this date.`);
            return;
        }

        const key = `${studentId}_${classroomId}`;
        const prevStatus = dateAttendanceMap[key];
        if (!prevStatus) return;

        setSavingAttendanceMap(prev => ({ ...prev, [lockKey]: true }));
        try {
            const { data: existingRow } = await supabaseAuth
                .from('attendance')
                .select('id, student_id, classroom_id, date, status')
                .eq('classroom_id', classroomId)
                .eq('student_id', studentId)
                .eq('date', selectedDate)
                .maybeSingle();

            if (existingRow) {
                setDateAttendanceMap(prev => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                });
                setBatchAttendanceMap(prev => {
                    const curr = { ...(prev[classroomId] || {}) };
                    delete curr[studentId];
                    return {
                        ...prev,
                        [classroomId]: curr
                    };
                });
                reconcileAttendanceTotals(classroomId, prevStatus, null);

                try {
                    const { error: rpcErr } = await supabaseAuth.rpc('unmark_historical_attendance', {
                        p_attendance_id: existingRow.id,
                        p_reason: 'Attendance unmarked by teacher'
                    });
                    if (rpcErr) {
                        const errMsg = (rpcErr.message || rpcErr.details || '').toLowerCase();
                        if (!errMsg.includes('not found')) {
                            throw rpcErr;
                        }
                    }

                    fetchPendingReport().catch(e => console.error('Error refreshing pending report:', e));
                } catch (err: any) {
                    console.error('Error unmarking attendance:', err?.message || err?.details || err);
                    alert(`Failed to unmark attendance: ${err.message || err}`);
                    setDateAttendanceMap(prev => ({
                        ...prev,
                        [key]: prevStatus
                    }));
                    setBatchAttendanceMap(prev => ({
                        ...prev,
                        [classroomId]: {
                            ...(prev[classroomId] || {}),
                            [studentId]: prevStatus
                        }
                    }));
                    reconcileAttendanceTotals(classroomId, null, prevStatus);
                }
            }
        } finally {
            setSavingAttendanceMap(prev => ({ ...prev, [lockKey]: false }));
        }
    };

    // Mark attendance from Individual Range date view
    const handleMarkDateAttendance = async (
        studentId: string,
        classroomId: string,
        status: 'present' | 'absent' | 'late' | 'excused'
    ) => {
        if (!teacherProfile) return;

        const lockKey = `${classroomId}_${studentId}`;
        if (savingAttendanceMap[lockKey]) return;

        let coveredInfo = coveredAttendanceMap[studentId];
        if (!coveredInfo) {
            const { data: dbCovered } = await supabaseAuth
                .from('attendance')
                .select('id, date, status')
                .eq('student_id', studentId)
                .eq('on_behalf_of_date', selectedDate)
                .neq('date', selectedDate)
                .in('status', ['present', 'late', 'absent', 'excused'])
                .limit(1);
            if (dbCovered && dbCovered.length > 0) {
                coveredInfo = {
                    attendanceId: dbCovered[0].id,
                    studentId,
                    classroomId,
                    actualDate: dbCovered[0].date,
                    targetDate: selectedDate,
                    status: dbCovered[0].status
                };
                setCoveredAttendanceMap(prev => ({ ...prev, [studentId]: coveredInfo! }));
            }
        }
        if (coveredInfo) {
            alert(`Cannot change attendance: This student was already counted on ${formatLocalDateStr(coveredInfo.actualDate)} on behalf of this date.`);
            return;
        }

        const key = `${studentId}_${classroomId}`;
        if (dateAttendanceMap[key] === status) {
            await handleUnmarkDateAttendance(studentId, classroomId);
            return;
        }

        setSavingAttendanceMap(prev => ({ ...prev, [lockKey]: true }));
        try {
            const currentDateStatus = dateAttendanceMap[key];
            // If an attendance status was already recorded, modifying it directly uses the audited RPC
            // without demanding a justification modal
            if (currentDateStatus && currentDateStatus !== status) {
                const { data: existingRow } = await supabaseAuth
                    .from('attendance')
                    .select('id, student_id, classroom_id, date, status')
                    .eq('classroom_id', classroomId)
                    .eq('student_id', studentId)
                    .eq('date', selectedDate)
                    .maybeSingle();

                if (existingRow) {
                    // Optimistic update
                    setDateAttendanceMap(prev => ({ ...prev, [key]: status }));
                    setBatchAttendanceMap(prev => ({
                        ...prev,
                        [classroomId]: {
                            ...(prev[classroomId] || {}),
                            [studentId]: status
                        }
                    }));
                    reconcileAttendanceTotals(classroomId, currentDateStatus, status);

                    try {
                        const { error: rpcErr } = await supabaseAuth.rpc('correct_historical_attendance', {
                            p_attendance_id: existingRow.id,
                            p_new_status: status.toLowerCase(),
                            p_reason: 'Attendance updated by teacher',
                            p_authorized_credit_delta: null
                        });

                        if (rpcErr) {
                            const errMsg = (rpcErr.message || rpcErr.details || '').toLowerCase();
                            if (errMsg.includes('not found')) {
                                console.warn('Attendance record not found in RPC, inserting fresh record:', existingRow.id);
                                const batchForRoom = activeBatchesRef.current.find(b => b.id === classroomId);
                                const onBehalfDate = batchOnBehalfOfMap[classroomId] || batchForRoom?.alternativeHoliday?.holiday_date || batchForRoom?.linkedHolidayDate || null;
                                const { data: insData, error: insErr } = await supabaseAuth
                                    .from('attendance')
                                    .insert({
                                        student_id: studentId,
                                        classroom_id: classroomId,
                                        date: selectedDate,
                                        status: status.toLowerCase(),
                                        marked_by: teacherProfile.id,
                                        on_behalf_of_date: onBehalfDate
                                    })
                                    .select('id, status')
                                    .maybeSingle();
                                if (insErr) throw insErr;

                                const confirmedStatus = (insData?.status || status).toLowerCase() as any;
                                setDateAttendanceMap(prev => ({ ...prev, [key]: confirmedStatus }));
                                setBatchAttendanceMap(prev => ({
                                    ...prev,
                                    [classroomId]: {
                                        ...(prev[classroomId] || {}),
                                        [studentId]: confirmedStatus
                                    }
                                }));
                            } else {
                                throw rpcErr;
                            }
                        }

                        handleFeeBalanceTransitionNotifications({
                            studentId,
                            teacherId: teacherProfile?.id,
                            supabase: supabaseAuth
                        }).catch(e => console.error('Error checking fee balance transition:', e));

                        fetchPendingReport().catch(e => console.error('Error refreshing pending report:', e));
                        return;
                    } catch (err: any) {
                        console.error('Error updating attendance:', err?.message || err?.details || err);
                        alert(`Failed to update attendance: ${err.message || err}`);
                        setDateAttendanceMap(prev => ({ ...prev, [key]: currentDateStatus }));
                        setBatchAttendanceMap(prev => ({
                            ...prev,
                            [classroomId]: {
                                ...(prev[classroomId] || {}),
                                [studentId]: currentDateStatus
                            }
                        }));
                        reconcileAttendanceTotals(classroomId, status, currentDateStatus);
                        return;
                    }
                }
            }
            // Optimistic update
            setDateAttendanceMap(prev => ({ ...prev, [key]: status }));
            setBatchAttendanceMap(prev => {
                const currentBatch = prev[classroomId] || {};
                return { ...prev, [classroomId]: { ...currentBatch, [studentId]: status } };
            });
            reconcileAttendanceTotals(classroomId, null, status);

            try {
                const batchForRoom = activeBatchesRef.current.find(b => b.id === classroomId);
                if (batchForRoom?.activeHoliday) {
                    throw new Error(`Cannot record attendance: ${selectedDate} is declared as a class off for this classroom.`);
                }
                const onBehalfDate = batchOnBehalfOfMap[classroomId] || batchForRoom?.alternativeHoliday?.holiday_date || batchForRoom?.linkedHolidayDate || null;
                const { data: insData, error } = await supabaseAuth
                    .from('attendance')
                    .insert({
                        student_id: studentId,
                        classroom_id: classroomId,
                        date: selectedDate,
                        on_behalf_of_date: onBehalfDate,
                        status: status.toLowerCase(),
                        marked_by: teacherProfile.id
                    })
                    .select('id, status')
                    .maybeSingle();
                if (error) throw error;

                const confirmedStatus = (insData?.status || status).toLowerCase() as any;
                setDateAttendanceMap(prev => ({ ...prev, [key]: confirmedStatus }));
                setBatchAttendanceMap(prev => {
                    const currentBatch = prev[classroomId] || {};
                    return { ...prev, [classroomId]: { ...currentBatch, [studentId]: confirmedStatus } };
                });

                handleFeeBalanceTransitionNotifications({
                    studentId,
                    teacherId: teacherProfile?.id,
                    supabase: supabaseAuth
                }).catch(e => console.error('Error checking fee balance transition:', e));

                fetchPendingReport().catch(e => console.error('Error refreshing pending report:', e));
            } catch (err: any) {
                console.error('Error marking attendance:', err?.message || err?.details || err);
                alert(`Failed to save attendance: ${err.message || err}`);
                // Revert
                setDateAttendanceMap(prev => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                });
                setBatchAttendanceMap(prev => {
                    const currentBatch = { ...(prev[classroomId] || {}) };
                    delete currentBatch[studentId];
                    return { ...prev, [classroomId]: currentBatch };
                });
                reconcileAttendanceTotals(classroomId, status, null);
            }
        } finally {
            setSavingAttendanceMap(prev => ({ ...prev, [lockKey]: false }));
        }
    };

    const fetchMissedReport = useCallback(async () => {
        if (!teacherProfile) return;
        setMissedLoading(true);
        try {
            // 1. Fetch teacher's/all student IDs
            const studentsQuery = supabaseAuth
                .from('users')
                .select('id')
                .or('role.eq.student,role.eq.pending,role.eq.mentor')
                .eq('status', 'active');

            const { data: studentsData, error: studentsErr } = teacherProfile.role === 'admin'
                ? await studentsQuery
                : await studentsQuery.eq('teacher_id', teacherProfile.id);

            if (studentsErr) throw studentsErr;

            console.log("DEBUG studentIds query status:", {
                studentsErr,
                studentsDataCount: studentsData?.length,
                pranshuInStudentsData: studentsData?.filter((s: any) => s.id.startsWith("2a31496d"))
            });

            const studentIds = (studentsData || []).map(s => s.id);

            if (studentIds.length === 0) {
                setMissedLogs([]);
                setStudentOverrides([]);
                return;
            }

            // 2. Fetch all student overrides (makeups) to match later (sorted chronologically)
            const { data: overridesDataRaw, error: overridesErr } = await supabaseAuth
                .from('session_student_overrides')
                .select('id, student_id, target_classroom_id, override_date, missed_session_date, reason, booking_status, credit_treatment')
                .in('student_id', studentIds)
                .order('override_date', { ascending: true });

            if (overridesErr) {
                console.error('Error fetching overrides:', overridesErr);
            }
            const overridesData = (overridesDataRaw || []).filter((o: any) => o.booking_status !== 'cancelled');
            setStudentOverrides(overridesData);

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

            // 4. Fetch attendance logs where status is absent or excused within selected date range
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
                    
                    const matchesOverride = o.student_id === r.student_id && 
                           o.target_classroom_id === r.classroom_id && 
                           oDateClean === rDateClean;

                    if (matchesOverride) {
                        // Check if there is an original missed class record (parent) in logsData
                        const hasParentRecord = (logsData || []).some((parent: any) => {
                            if (parent.student_id !== r.student_id || parent.id === r.id) return false;
                            const pDateClean = parent.date.split('T')[0].split(' ')[0];
                            return pDateClean < oDateClean;
                        });
                        return hasParentRecord;
                    }
                    return false;
                });
                return !isOverride;
            });

            // 5. Resolve classroom names and check makeup completion status
            const resolved = await Promise.all(regularLogs.map(async (row: any) => {
                let name = classrooms.find(c => c.id === row.classroom_id)?.name;
                let isTemp = false;

                if (!name) {
                    const temp = temporaryClasses.find(tc => tc.classroom_id === row.classroom_id || tc.id === row.classroom_id);
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
                        const { data: tc } = await supabaseAuth.from('temporary_classes').select('title').or(`classroom_id.eq.${row.classroom_id},id.eq.${row.classroom_id}`).maybeSingle();
                        name = tc?.title || 'Unknown Classroom';
                        isTemp = !!tc;
                    }
                }

                // Find matching scheduled makeup override (recursively trace chain)
                const logDateClean = row.date.split('T')[0].split(' ')[0];
                let initialMakeup = (overridesData || []).find((o: any) => {
                    if (!o.override_date || !row.date) return false;
                    if (o.student_id !== row.student_id) return false;

                    const oDate = o.override_date.split('T')[0].split(' ')[0];
                    const oMissedDate = o.missed_session_date ? o.missed_session_date.split('T')[0].split(' ')[0] : null;

                    // 1. Exact match with missed_session_date column
                    if (oMissedDate && oMissedDate === logDateClean) {
                        return true;
                    }

                    // 2. Strict match with [MissedDate:YYYY-MM-DD] tag in reason
                    if (o.reason && o.reason.includes(`[MissedDate:${logDateClean}]`)) {
                        return true;
                    }

                    // 3. Fallback to date order if no tag and no specific missed date recorded
                    if (!oMissedDate && (!o.reason || !o.reason.includes('[MissedDate:'))) {
                        return oDate >= logDateClean;
                    }

                    return false;
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
                            if (o.student_id !== row.student_id) return false;

                            const oDateClean = o.override_date.split('T')[0].split(' ')[0];
                            const oMissedDate = o.missed_session_date ? o.missed_session_date.split('T')[0].split(' ')[0] : null;

                            if (oMissedDate && oMissedDate === mDateClean) return true;
                            if (o.reason && o.reason.includes(`[MissedDate:${mDateClean}]`)) {
                                return true;
                            }
                            if (!oMissedDate && (!o.reason || !o.reason.includes('[MissedDate:'))) {
                                return oDateClean > mDateClean;
                            }
                            return false;
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
        fetchMissedReportRef.current = fetchMissedReport;
    }, [fetchMissedReport]);

    const resolveClassroomName = useCallback((classroomId: string) => {
        if (!classroomId) return 'Classroom';
        const perm = classrooms.find(c => c.id === classroomId);
        if (perm) return perm.name;
        const temp = temporaryClasses.find(tc => tc.classroom_id === classroomId || tc.id === classroomId);
        if (temp) return temp.title;
        return 'Classroom';
    }, [classrooms, temporaryClasses]);

    const fetchPendingReport = useCallback(async () => {
        if (!teacherProfile || classrooms.length === 0) return;
        setPendingLoading(true);
        try {
            const roomIds = classrooms.map(c => c.id);
            if (roomIds.length === 0) {
                setPendingSessions([]);
                return;
            }

            const [permRes, overridesRes, attRes, coveredRes, holidaysRes] = await Promise.all([
                supabaseAuth
                    .from('classroom_students')
                    .select('classroom_id, student_id, joined_at, users!student_id(name, profile_pic_url, teacher_id, status, join_date, created_at)')
                    .in('classroom_id', roomIds),
                supabaseAuth
                    .from('session_student_overrides')
                    .select('id, student_id, target_classroom_id, override_date, missed_session_date, reason, users!student_id(name, profile_pic_url, teacher_id, status)')
                    .gte('override_date', fromDate)
                    .lte('override_date', toDate),
                supabaseAuth
                    .from('attendance')
                    .select('id, student_id, classroom_id, date, status, on_behalf_of_date')
                    .gte('date', fromDate),
                supabaseAuth
                    .from('attendance')
                    .select('id, student_id, classroom_id, date, status, on_behalf_of_date')
                    .gte('on_behalf_of_date', fromDate),
                supabaseAuth
                    .from('classroom_holidays')
                    .select('*')
                    .in('classroom_id', roomIds)
                    .eq('status', 'active')
            ]);

            if (holidaysRes.data) {
                setClassroomHolidays(prev => {
                    if (prev.length !== (holidaysRes.data?.length || 0)) return holidaysRes.data;
                    const prevSig = prev.map((h: any) => `${h.id}_${h.status}_${h.holiday_date}_${h.alternative_date}`).join('|');
                    const nextSig = (holidaysRes.data || []).map((h: any) => `${h.id}_${h.status}_${h.holiday_date}_${h.alternative_date}`).join('|');
                    return prevSig === nextSig ? prev : holidaysRes.data;
                });
            }

            const derived = derivePendingAttendanceSessions({
                fromDate,
                toDate,
                classrooms,
                batchSchedules: allSchedules,
                temporaryClasses,
                permanentStudents: permRes.data || [],
                sessionOverrides: overridesRes.data || [],
                attendanceRows: attRes.data || [],
                coveredAttendanceRows: coveredRes.data || [],
                classroomHolidays: holidaysRes.data || []
            });

            setPendingSessions(derived);
        } catch (err) {
            console.error('Error fetching pending attendance report:', err);
        } finally {
            setPendingLoading(false);
        }
    }, [teacherProfile, classrooms, allSchedules, temporaryClasses, fromDate, toDate]);

    // Fetch pending report when classrooms, schedules, or date range changes
    useEffect(() => {
        if (classrooms.length > 0) {
            fetchPendingReport();
        }
    }, [classrooms, allSchedules, fromDate, toDate, fetchPendingReport]);

    // Fetch missed makeup report when in makeup tab
    useEffect(() => {
        if (mode === 'missed' && missedSubTab === 'makeup') {
            fetchMissedReport();
        }
    }, [mode, missedSubTab, fromDate, toDate, missedStatusFilter, missedSearchQuery, fetchMissedReport]);

    const handleMarkPendingStudent = async (
        session: PendingClassSession,
        studentId: string,
        status: 'present' | 'absent' | 'late' | 'excused'
    ) => {
        if (!teacherProfile) return;
        if (session.holidayInfo) {
            if (session.holidayInfo.alternativeStatus === 'not_scheduled' || !session.holidayInfo.alternativeDate) {
                const fullHol = classroomHolidays.find(h => h.id === session.holidayInfo?.id) || {
                    id: session.holidayInfo.id,
                    classroom_id: session.classroomId,
                    holiday_date: session.holidayInfo.holidayDate,
                    holiday_type: session.holidayInfo.holidayType,
                    alternative_date: session.holidayInfo.alternativeDate,
                    alternative_start_time: session.holidayInfo.alternativeStartTime,
                    alternative_end_time: session.holidayInfo.alternativeEndTime,
                    reason: session.holidayInfo.reason
                };
                setScheduleAltModalState({
                    isOpen: true,
                    holiday: fullHol,
                    classroomName: session.classroomName
                });
                return;
            }
        }
        const markKey = `${session.sessionKey}_${studentId}`;
        setPendingMarkingMap(prev => ({ ...prev, [markKey]: true }));

        try {
            const targetAttendanceDate = session.holidayInfo?.alternativeDate || session.date;
            const targetOnBehalfDate = session.holidayInfo ? session.holidayInfo.holidayDate : null;
            const { error } = await supabaseAuth
                .from('attendance')
                .upsert({
                    student_id: studentId,
                    classroom_id: session.classroomId,
                    date: targetAttendanceDate,
                    on_behalf_of_date: targetOnBehalfDate,
                    status: status,
                    marked_by: teacherProfile.id
                }, {
                    onConflict: 'student_id,classroom_id,date'
                });

            if (error) throw error;

            // Optimistically update pendingSessions
            setPendingSessions(prev => {
                return prev.map(s => {
                    if (s.sessionKey !== session.sessionKey) return s;
                    const nextPending = s.pendingStudents.filter(st => st.studentId !== studentId);
                    return {
                        ...s,
                        pendingStudents: nextPending,
                        markedCount: s.markedCount + 1
                    };
                }).filter(s => s.pendingStudents.length > 0);
            });

            // Synchronize with active calendar batch if open
            if (selectedDate === session.date && batchAttendanceMap[session.classroomId]) {
                setBatchAttendanceMap(prev => ({
                    ...prev,
                    [session.classroomId]: {
                        ...(prev[session.classroomId] || {}),
                        [studentId]: status
                    }
                }));
            }
        } catch (err: any) {
            console.error('Error marking pending attendance:', err);
            alert(`Failed to save attendance: ${err.message || err}`);
        } finally {
            setPendingMarkingMap(prev => {
                const next = { ...prev };
                delete next[markKey];
                return next;
            });
        }
    };

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
                const { error } = await supabaseAuth.rpc('reschedule_makeup_session', {
                    p_override_id: editingMakeupId,
                    p_new_target_classroom_id: targetId,
                    p_new_override_date: makeupDate,
                    p_notes: cleanReason || null
                });

                if (error) {
                    throw new Error(error.message + (error.details ? ` (${error.details})` : '') + (error.hint ? ` [${error.hint}]` : ''));
                }
                alert('Makeup class rescheduled successfully!');
            } else {
                const { error } = await supabaseAuth.rpc('book_makeup_session', {
                    p_student_id: makeupStudent.student_id,
                    p_target_classroom_id: targetId,
                    p_override_date: makeupDate,
                    p_missed_session_date: makeupStudent.date,
                    p_original_classroom_id: makeupStudent.classroom_id || null,
                    p_notes: cleanReason || null
                });

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
            // Get day of week (0-6) from the local date representation of dateStr
            const [year, month, day] = dateStr.split('-').map(Number);
            const localDate = new Date(year, month - 1, day);
            const dayOfWeek = localDate.getDay();

            // Fetch classroom students
            const { data: permStudentsData } = await supabaseAuth
                .from('classroom_students')
                .select('classroom_id, student_id, users!student_id(name, status)');
            
            // Fetch temporary classroom students
            const { data: tempStudentsData } = await supabaseAuth
                .from('temporary_class_students')
                .select('temporary_class_id, student_id, users!student_id(name, status)');

            // Fetch overrides for this date
            const { data: overridesData } = await supabaseAuth
                .from('session_student_overrides')
                .select('target_classroom_id, student_id, users!student_id(name, status)')
                .eq('override_date', dateStr);

            // Fetch attendance on this date
            const { data: attendanceData } = await supabaseAuth
                .from('attendance')
                .select('classroom_id, student_id, status, users!student_id(name)')
                .eq('date', dateStr);

            const attendanceMap: Record<string, string> = {};
            (attendanceData || []).forEach((att: any) => {
                const key = `${att.classroom_id}_${att.student_id}`;
                attendanceMap[key] = att.status; // 'present', 'absent', 'late', 'excused'
            });

            const suggestions: any[] = [];

            // 1. Process Permanent Classrooms
            classrooms.forEach((room: any) => {
                const schedules = allSchedules.filter((s: any) => s.classroom_id === room.id && s.day_of_week === dayOfWeek);
                
                schedules.forEach((sched: any) => {
                    const regularStudents = (permStudentsData || [])
                        .filter((cs: any) => cs.classroom_id === room.id && isStudentOperationallyActive(cs.users?.status))
                        .map((cs: any) => ({
                            id: cs.student_id,
                            name: cs.users?.name || 'Unknown Student',
                            isOverride: false
                        }));

                    const overrideStudents = (overridesData || [])
                        .filter((o: any) => o.target_classroom_id === room.id && isStudentOperationallyActive(o.users?.status))
                        .map((o: any) => ({
                            id: o.student_id,
                            name: o.users?.name || 'Unknown Student',
                            isOverride: true
                        }));

                    const allAllocated = [...regularStudents, ...overrideStudents];

                    let excusedCount = 0;
                    const studentList = allAllocated.map(s => {
                        const status = attendanceMap[`${room.id}_${s.id}`];
                        if (status === 'excused') {
                            excusedCount++;
                        }
                        return {
                            ...s,
                            status: status || null
                        };
                    });

                    const startClean = sched.start_time.substring(0, 5);
                    const endClean = sched.end_time.substring(0, 5);

                    suggestions.push({
                        classroomId: room.id,
                        classroomName: room.name,
                        timings: `${startClean} - ${endClean}`,
                        isTemporary: false,
                        excusedCount,
                        students: studentList,
                        startTime: sched.start_time
                    });
                });
            });

            // 2. Process Temporary Classrooms
            const activeTemps = temporaryClasses.filter(
                (tc: any) => tc.class_date === dateStr && (tc.lifecycle_status || 'scheduled').toLowerCase() !== 'cancelled'
            );
            activeTemps.forEach((tc: any) => {
                const targetRoomId = tc.classroom_id || tc.id;
                const overrideStudents = (overridesData || [])
                    .filter((o: any) => (o.target_classroom_id === targetRoomId || o.target_classroom_id === tc.id) && isStudentOperationallyActive(o.users?.status))
                    .map((o: any) => ({
                        id: o.student_id,
                        name: o.users?.name || 'Unknown Student',
                        isOverride: true
                    }));

                const allAllocated = overrideStudents;

                let excusedCount = 0;
                const studentList = allAllocated.map(s => {
                    const status = attendanceMap[`${targetRoomId}_${s.id}`] || attendanceMap[`${tc.id}_${s.id}`];
                    if (status === 'excused') {
                        excusedCount++;
                    }
                    return {
                        ...s,
                        status: status || null
                    };
                });

                const startClean = tc.start_time.substring(0, 5);
                const endClean = tc.end_time.substring(0, 5);

                suggestions.push({
                    classroomId: targetRoomId,
                    classroomName: tc.title,
                    timings: `${startClean} - ${endClean}`,
                    isTemporary: true,
                    excusedCount,
                    students: studentList,
                    startTime: tc.start_time
                });
            });

            // Sort suggestions by startTime
            suggestions.sort((a, b) => a.startTime.localeCompare(b.startTime));

            setExcusedSuggestions(suggestions);
        } catch (err) {
            console.error('Error fetching excused suggestions:', err);
        }
    }, [teacherProfile, classrooms, allSchedules, temporaryClasses]);

    useEffect(() => {
        if (showMakeupModal && makeupDate) {
            fetchExcusedSuggestions(makeupDate);
        } else {
            setExcusedSuggestions([]);
        }
    }, [showMakeupModal, makeupDate, fetchExcusedSuggestions]);

    useEffect(() => {
        if (!showMakeupModal || !makeupStudent || editingMakeupId) return;
        
        let targetClassName = classrooms.find(c => c.id === makeupClassroomId)?.name;
        if (!targetClassName) {
            targetClassName = temporaryClasses.find(tc => tc.id === makeupClassroomId)?.title;
        }
        
        if (targetClassName && makeupDate) {
            const missedDateClean = formatLocalDateStr(makeupStudent.date, true);
            const targetDateClean = formatLocalDateStr(makeupDate, true);
            setMakeupReason(
                `Makeup for missing ${makeupStudent.classroom_name} class on ${missedDateClean}. Assigned to ${targetClassName} on ${targetDateClean}`
            );
        }
    }, [makeupClassroomId, makeupDate, showMakeupModal, makeupStudent, editingMakeupId, classrooms, temporaryClasses, formatLocalDateStr]);

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
                    avatarUrl={teacherProfile?.profile_pic_url}
                    userName={teacherProfile?.name}
                    backLink={teacherProfile?.role === 'admin' ? '/admin-dashboard' : '/teacher-dashboard'}
                />

                <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 w-full flex-1 overflow-y-auto">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div>
                            <h1 className="admin-page-title">Attendance Management</h1>
                            <p className="admin-page-subtitle">Track daily batch attendance, leave requests, and student history.</p>
                        </div>
                    </div>
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

                    {/* Attendance Pending Warning Banner */}
                    {pendingSummary.totalPendingStudents > 0 && mode === 'class' && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-900 dark:text-white animate-in fade-in duration-300">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-amber-500/20 text-amber-600 dark:text-amber-450 rounded-xl shrink-0">
                                    <AlertCircle className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                        ⚠️ {pendingSummary.totalPendingStudents} attendance pending across {pendingSummary.affectedClassesCount} past {pendingSummary.affectedClassesCount === 1 ? 'class' : 'classes'}
                                    </p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        Past completed classes have students waiting for attendance marking.
                                        {pendingSummary.oldestPendingDate && (
                                            <span> Oldest pending from {formatLocalDateStr(pendingSummary.oldestPendingDate, true)}.</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setMissedSubTab('pending');
                                    setMode('missed');
                                }}
                                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-xs self-start sm:self-auto shrink-0 flex items-center gap-1.5 cursor-pointer"
                            >
                                <span>Review & Mark Now</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}

                    {/* Mode Selector and Quick Student Attendance Search */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 w-full">
                        <div className="bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap sm:flex-nowrap gap-1 shadow-sm w-full lg:w-auto">
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
                                className={`px-2 py-2 sm:px-6 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex-1 sm:flex-initial text-center flex items-center justify-center gap-1.5 ${mode === 'missed' ? 'bg-[#ecb613] text-slate-900 shadow-lg shadow-[#ecb613]/10' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                            >
                                <span className="hidden sm:inline">Missed / Pending</span>
                                <span className="sm:hidden">Pending</span>
                                {pendingSummary.totalPendingStudents > 0 && (
                                    <span className="px-1.5 py-0.5 text-[9px] font-black bg-amber-500 text-white rounded-full">
                                        {pendingSummary.totalPendingStudents}
                                    </span>
                                )}
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

                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full lg:w-auto">
                            {/* Declare Class Off Button (BR-22 & BR-23) */}
                            <button
                                type="button"
                                onClick={() => {
                                    const defaultRoom = classrooms.find(c => c.id === expandedBatchId) ||
                                        classrooms.find(c => activeBatchesOnSelectedDate.some(b => b.id === c.id && b.type === 'permanent')) ||
                                        classrooms[0];
                                    setDeclareHolidayModalState({
                                        isOpen: true,
                                        classroomId: defaultRoom?.id || '',
                                        classroomName: defaultRoom?.name || 'Classroom',
                                        initialDate: selectedDate
                                    });
                                }}
                                className="px-3.5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                                title="Declare class off (Single or Multiple Classes — With or Without Alternative Class)"
                            >
                                <span>🏖️</span>
                                <span>Declare Class Off</span>
                            </button>

                            {/* Class Off Audit Log Button */}
                            <button
                                type="button"
                                onClick={() => {
                                    const defaultRoom = classrooms.find(c => c.id === expandedBatchId) ||
                                        classrooms.find(c => activeBatchesOnSelectedDate.some(b => b.id === c.id && b.type === 'permanent')) ||
                                        classrooms[0];
                                    if (!defaultRoom) return;
                                    setHolidayAuditModalState({
                                        isOpen: true,
                                        classroomId: defaultRoom.id,
                                        classroomName: defaultRoom.name
                                    });
                                }}
                                className="px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                                title="View Class Off Declaration & Rescheduling Audit History"
                            >
                                <span>📋</span>
                                <span className="hidden xl:inline">Class Off History</span>
                            </button>

                            {/* Audit Trail Button */}
                            <button
                                type="button"
                                onClick={() => {
                                    setAuditModalClassroomId(expandedBatchId || undefined);
                                    setAuditModalStudentId(undefined);
                                    setShowCorrectionAuditModal(true);
                                }}
                                className="px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                                title="View immutable attendance correction audit log"
                            >
                                <History className="w-4 h-4 text-[#ecb613]" />
                                <span className="hidden sm:inline">Audit Trail</span>
                            </button>

                            {/* Compact Quick Student Attendance Search Bar */}
                            <div className="relative w-full lg:w-80">
                            <div className="relative">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input 
                                    type="text"
                                    value={quickStudentSearch}
                                    onChange={(e) => setQuickStudentSearch(e.target.value)}
                                    placeholder="Search student attendance..."
                                    className="w-full pl-10 pr-9 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-[#ecb613]/50 outline-none shadow-xs transition-all"
                                />
                                {quickSearchLoading ? (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ecb613]" />
                                    </div>
                                ) : quickStudentSearch ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setQuickStudentSearch('');
                                            setQuickSearchResults([]);
                                        }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                ) : null}
                            </div>

                            {/* Dropdown Suggestions */}
                            {quickSearchResults.length > 0 && (
                                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden max-h-[260px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                                    {quickSearchResults.map(student => (
                                        <div 
                                            key={student.id} 
                                            onClick={() => {
                                                openStudentAttendanceModal(student.id, student.name, student.profile_pic_url || undefined);
                                                setQuickStudentSearch('');
                                                setQuickSearchResults([]);
                                            }}
                                            className="px-3.5 py-2.5 hover:bg-[#ecb613]/10 dark:hover:bg-[#ecb613]/20 flex items-center justify-between cursor-pointer transition-colors"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                                    {student.profile_pic_url ? (
                                                        <img src={student.profile_pic_url} alt={student.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-[#ecb613] font-black text-xs">{student.name.charAt(0)}</span>
                                                    )}
                                                </div>
                                                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{student.name}</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-[#ecb613] uppercase tracking-wider flex items-center gap-0.5 shrink-0">
                                                View <ArrowRight className="w-3 h-3" />
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                    {/* Shared Global Attendance Reporting Range Bar */}
                    <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-amber-50 dark:bg-amber-950/30 text-[#ecb613] rounded-xl shrink-0">
                                <CalendarIcon className="w-4 h-4" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-extrabold text-slate-900 dark:text-white">Reporting Period</span>
                                    {activePreset === 'this_month' && (
                                        <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 rounded-full border border-emerald-200 dark:border-emerald-800">
                                            Current Month (Default)
                                        </span>
                                    )}
                                    {activePreset === 'last_month' && (
                                        <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-blue-50 text-blue-600 dark:bg-blue-950/30 rounded-full border border-blue-200 dark:border-blue-800">
                                            Previous Month
                                        </span>
                                    )}
                                    {activePreset === 'last_3_months' && (
                                        <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-purple-50 text-purple-600 dark:bg-purple-950/30 rounded-full border border-purple-200 dark:border-purple-800">
                                            Last 3 Months
                                        </span>
                                    )}
                                    {activePreset === 'custom' && (
                                        <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 rounded-full">
                                            Custom Range
                                        </span>
                                    )}
                                </div>
                                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                    Historical attendance reports query directly between From and To dates.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {/* Preset buttons */}
                            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/80">
                                <button
                                    type="button"
                                    onClick={setPresetThisMonth}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                        activePreset === 'this_month'
                                            ? 'bg-[#ecb613] text-slate-900 shadow-xs'
                                            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                                    }`}
                                >
                                    This Month
                                </button>
                                <button
                                    type="button"
                                    onClick={setPresetLastMonth}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                        activePreset === 'last_month'
                                            ? 'bg-[#ecb613] text-slate-900 shadow-xs'
                                            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                                    }`}
                                >
                                    Last Month
                                </button>
                                <button
                                    type="button"
                                    onClick={setPresetLast3Months}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                        activePreset === 'last_3_months'
                                            ? 'bg-[#ecb613] text-slate-900 shadow-xs'
                                            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                                    }`}
                                >
                                    Last 3 Months
                                </button>
                            </div>

                            {/* Date Inputs */}
                            <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">From</span>
                                    <input
                                        type="date"
                                        value={fromDate}
                                        onChange={(e) => setFromDate(e.target.value)}
                                        className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none border-none p-0 cursor-pointer"
                                    />
                                </div>
                                <span className="text-slate-300 dark:text-slate-600 font-bold text-xs">→</span>
                                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">To</span>
                                    <input
                                        type="date"
                                        value={toDate}
                                        onChange={(e) => setToDate(e.target.value)}
                                        className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none border-none p-0 cursor-pointer"
                                    />
                                </div>
                            </div>
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
                                    <div className="flex items-center justify-between px-1">
                                        <h4 className="admin-section-title">
                                            Scheduled Batches on {formatLocalDateStr(selectedDate, true)}
                                        </h4>
                                        <span className="admin-meta-text uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full shrink-0 ml-2">
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
                                                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-all duration-300"
                                            >
                                                {/* Accordion Header */}
                                                <div 
                                                    onClick={() => handleExpandBatch(batch.id, batch.type === 'temporary')}
                                                    className="p-3.5 sm:p-4 flex items-center justify-between gap-2.5 sm:gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors select-none"
                                                >
                                                    <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                                                        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                                            batch.type === 'permanent'
                                                                ? 'bg-[#ecb613]/10 text-[#ecb613]'
                                                                : 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400'
                                                        }`}>
                                                            <School className="w-4 h-4 sm:w-5 sm:h-5" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <h5 className="font-bold text-xs sm:text-sm md:text-base text-slate-900 dark:text-white leading-snug truncate max-w-full">{batch.name}</h5>
                                                            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap mt-1">
                                                                <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                                                                    <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                                                    {batch.time}
                                                                </span>
                                                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 ${
                                                                    batch.type === 'permanent'
                                                                        ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600'
                                                                        : 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400'
                                                                }`}>
                                                                    {batch.type === 'permanent' ? '👥 Classroom' : '⚡ Special Session'}
                                                                </span>
                                                                {batch.activeHoliday && (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                                                        {batch.activeHoliday.holiday_type === 'no_alternative'
                                                                            ? '🏖️ Class Off — No Alternative'
                                                                            : batch.activeHoliday.holiday_type === 'alternative_pending'
                                                                                ? '⏳ Class Off — Alt Pending'
                                                                                : `🏖️ Class Off — Alt: ${formatLocalDateStr(batch.activeHoliday.alternative_date)}`}
                                                                    </span>
                                                                )}
                                                                {batch.activeHoliday && (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                                        0 Credit Deduction
                                                                    </span>
                                                                )}
                                                                {(batch.alternativeHoliday || batch.linkedHolidayDate) && !batch.activeHoliday && (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                                                                        🔄 On Behalf Of {formatLocalDateStr(batch.alternativeHoliday?.holiday_date || batch.linkedHolidayDate!)}
                                                                    </span>
                                                                )}
                                                                {batchOnBehalfOfMap[batch.id] && !batch.alternativeHoliday && !batch.linkedHolidayDate && (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                                                        🗓️ Taken on behalf of {formatLocalDateStr(batchOnBehalfOfMap[batch.id]!)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Summary Status indicator */}
                                                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-1">
                                                        {batch.type === 'permanent' && !batch.activeHoliday && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setDeclareHolidayModalState({
                                                                        isOpen: true,
                                                                        classroomId: batch.id,
                                                                        classroomName: batch.name,
                                                                        initialDate: selectedDate
                                                                    });
                                                                }}
                                                                className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-[10px] font-bold transition-colors cursor-pointer"
                                                                title="Declare Class Off for this class"
                                                            >
                                                                <span>🏖️ Class Off</span>
                                                            </button>
                                                        )}
                                                        {batch.activeHoliday ? (
                                                            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-1 sm:px-2.5 sm:py-1 bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-full whitespace-nowrap">
                                                                🔒 Class Off Locked
                                                            </span>
                                                        ) : summary && summary.total > 0 ? (
                                                            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-1 sm:px-2.5 sm:py-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border border-emerald-100 dark:border-emerald-900 rounded-full whitespace-nowrap">
                                                                Marked {summary.present + summary.late + summary.absent + summary.excused}/{summary.total}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-1 sm:px-2.5 sm:py-1 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-full whitespace-nowrap">
                                                                No Students
                                                            </span>
                                                        )}
                                                        {isExpanded ? (
                                                            <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                                                        ) : (
                                                            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Accordion Content */}
                                                {isExpanded && (
                                                    <div className="border-t border-slate-100 dark:border-slate-800 p-3.5 sm:p-4 bg-slate-50/50 dark:bg-slate-850/20">
                                                        {/* ── Declared Class Off Banner & Actions (BR-22 & BR-23) ── */}
                                                        {batch.activeHoliday && (
                                                            <div className="mb-3.5 p-3.5 sm:p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                                                                            {batch.activeHoliday.holiday_type === 'no_alternative'
                                                                                ? '🏖️ Class Off — No Alternative Class'
                                                                                : batch.activeHoliday.holiday_type === 'alternative_pending'
                                                                                    ? '⏳ Class Off — Alternative Class Pending'
                                                                                    : '🏖️ Class Off — Alternative Scheduled'}
                                                                        </span>
                                                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                                                            0 Credit Deduction
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                                                                        {batch.activeHoliday.holiday_type === 'no_alternative' ? (
                                                                            <>No replacement class or attendance on this date. Unused credits remain intact.</>
                                                                        ) : batch.activeHoliday.holiday_type === 'alternative_pending' ? (
                                                                            <>Alternative class date &amp; time not set yet. Schedule the alternative date or create a Special Session on behalf of this class off.</>
                                                                        ) : (() => {
                                                                            const altDateClean = String(batch.activeHoliday.alternative_date || '').split('T')[0];
                                                                            const linkedSpecialClass = temporaryClasses.find(tc => {
                                                                                if ((tc.lifecycle_status || 'scheduled').toLowerCase() === 'cancelled') return false;
                                                                                const desc = String(tc.description || '');
                                                                                if (desc.includes(`[HolidayId:${batch.activeHoliday.id}]`)) return true;
                                                                                if (desc.includes(`[OnBehalfOfHoliday:${batch.activeHoliday.holiday_date}]`) && desc.includes(`[HolidayClassroom:${batch.id}]`)) return true;
                                                                                return tc.class_date === altDateClean && (!batch.activeHoliday.alternative_start_time || String(tc.start_time || '').slice(0, 5) === String(batch.activeHoliday.alternative_start_time).slice(0, 5));
                                                                            });
                                                                            const startStr = batch.activeHoliday.alternative_start_time || linkedSpecialClass?.start_time;
                                                                            const endStr = batch.activeHoliday.alternative_end_time || linkedSpecialClass?.end_time;
                                                                            return (
                                                                                <>
                                                                                    Alternative class:{' '}
                                                                                    {linkedSpecialClass?.title ? (
                                                                                        <strong className="text-amber-950 dark:text-white">{linkedSpecialClass.title}</strong>
                                                                                    ) : null}
                                                                                    {linkedSpecialClass?.title ? ' on ' : 'scheduled on '}
                                                                                    <strong className="underline">{formatLocalDateStr(batch.activeHoliday.alternative_date, true)}</strong>
                                                                                    {startStr ? ` (${formatTime12hr(String(startStr).slice(0, 5))}${endStr ? ` - ${formatTime12hr(String(endStr).slice(0, 5))}` : ''})` : ''}.
                                                                                    {' '}Take attendance on the alternative class.
                                                                                </>
                                                                            );
                                                                        })()}
                                                                    </p>
                                                                    {batch.activeHoliday.reason && (
                                                                        <p className="text-[11px] text-amber-700 dark:text-amber-400 italic">
                                                                            Reason: {batch.activeHoliday.reason}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                                                    {batch.activeHoliday.holiday_type === 'alternative_pending' && (
                                                                        <>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setScheduleAltModalState({
                                                                                    isOpen: true,
                                                                                    holiday: batch.activeHoliday,
                                                                                    classroomName: batch.name
                                                                                })}
                                                                                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition-all cursor-pointer shadow-xs"
                                                                            >
                                                                                📅 Schedule Alternative
                                                                            </button>
                                                                            <Link
                                                                                href={`/teacher-dashboard/classrooms/add?type=temporary&holidayId=${batch.activeHoliday.id}&classroomId=${batch.id}&holidayDate=${batch.activeHoliday.holiday_date}`}
                                                                                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all cursor-pointer shadow-xs inline-flex items-center gap-1"
                                                                            >
                                                                                <span>⚡ Create Special Session (On Behalf)</span>
                                                                            </Link>
                                                                        </>
                                                                    )}
                                                                    {(batch.activeHoliday.holiday_type === 'alternative_scheduled' || batch.activeHoliday.holiday_type === 'with_alternative') && (
                                                                        <>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    if (batch.activeHoliday.alternative_date) {
                                                                                        setSelectedDate(batch.activeHoliday.alternative_date);
                                                                                    }
                                                                                }}
                                                                                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
                                                                            >
                                                                                ➡️ Go to Alternative ({formatLocalDateStr(batch.activeHoliday.alternative_date)})
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setScheduleAltModalState({
                                                                                    isOpen: true,
                                                                                    holiday: batch.activeHoliday,
                                                                                    classroomName: batch.name
                                                                                })}
                                                                                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 font-bold text-xs transition-all cursor-pointer"
                                                                            >
                                                                                ✏️ Reschedule
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleRevertHolidayToPending(batch.activeHoliday)}
                                                                                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition-all cursor-pointer"
                                                                            >
                                                                                ⏳ Revert to Pending
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleCancelHoliday(batch.activeHoliday)}
                                                                        className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold text-xs transition-all cursor-pointer"
                                                                    >
                                                                        Cancel Class Off
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* ── Alternative Class Banner (BR-22) ── */}
                                                        {(batch.alternativeHoliday || batch.linkedHolidayDate) && !batch.activeHoliday && (
                                                            <div className="mb-3.5 p-3.5 sm:p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-300 dark:border-blue-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-200 dark:bg-blue-900/60 text-blue-900 dark:text-blue-200">
                                                                            🔄 Alternative Class (On Behalf Of {formatLocalDateStr(batch.alternativeHoliday?.holiday_date || batch.linkedHolidayDate!, true)})
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                                                                        Attendance recorded in this class counts on behalf of the class off on{' '}
                                                                        <strong>{formatLocalDateStr(batch.alternativeHoliday?.holiday_date || batch.linkedHolidayDate!, true)}</strong>.
                                                                        Present/Late/Uninformed Absent deducts <strong>1 credit</strong> (no double deduction, no makeup entitlement).
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Optional On-Behalf-Of Control */}
                                                        {!batch.activeHoliday && (
                                                            <div className="mb-3.5 p-3 sm:p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-800/80 flex flex-wrap items-center justify-between gap-2.5 text-xs shadow-xs">
                                                                <div className="flex items-center gap-2.5 min-w-0">
                                                                    <span className="text-lg shrink-0">🗓️</span>
                                                                    <div className="min-w-0">
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <span className="font-bold text-slate-900 dark:text-slate-100">
                                                                                Take this class on behalf of another scheduled or class off session?
                                                                            </span>
                                                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">
                                                                                Class Accounting
                                                                            </span>
                                                                        </div>
                                                                        {batchOnBehalfOfMap[batch.id] ? (
                                                                            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                                                                                ✓ Today ({formatLocalDateStr(selectedDate)}) counts towards {formatLocalDateStr(batchOnBehalfOfMap[batch.id]!)}
                                                                            </p>
                                                                        ) : (
                                                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                                                Default: Regular scheduled class for {formatLocalDateStr(selectedDate)}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    {(() => {
                                                                        const currentTargetDate = batchOnBehalfOfMap[batch.id] || '';
                                                                        const matchedHolidayOption = classroomHolidays.find((h: any) =>
                                                                            h.status === 'active' &&
                                                                            h.holiday_type !== 'no_alternative' &&
                                                                            String(h.holiday_date).split('T')[0] === currentTargetDate &&
                                                                            (h.classroom_id === batch.id || batch.linkedHolidayRoomId === h.classroom_id || batch.type === 'temporary')
                                                                        );
                                                                        const selectValue = matchedHolidayOption
                                                                            ? `HOLIDAY:${matchedHolidayOption.id}:${String(matchedHolidayOption.holiday_date).split('T')[0]}`
                                                                            : currentTargetDate;
                                                                        return (
                                                                            <select
                                                                                value={selectValue}
                                                                                onChange={(e) => handleSetBatchOnBehalfOf(batch.id, e.target.value || null)}
                                                                                className="text-xs font-bold px-3 py-1.5 rounded-lg border-2 border-amber-400 dark:border-amber-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500/50 outline-hidden cursor-pointer shadow-xs"
                                                                            >
                                                                                <option value="">No (Regular Class)</option>
                                                                                {classroomHolidays
                                                                                    .filter((h: any) => h.status === 'active' && h.holiday_type !== 'no_alternative' && (h.classroom_id === batch.id || batch.type === 'temporary'))
                                                                                    .map((h: any) => {
                                                                                        const holDateStr = String(h.holiday_date).split('T')[0];
                                                                                        return (
                                                                                            <option key={`hol_${h.id}`} value={`HOLIDAY:${h.id}:${holDateStr}`}>
                                                                                                🏖️ Class Off on {formatLocalDateStr(holDateStr, true)}{h.classroom_id !== batch.id ? ` — ${classrooms.find(c => c.id === h.classroom_id)?.name || 'Class'}` : ''}
                                                                                            </option>
                                                                                        );
                                                                                    })}
                                                                                {getUpcomingScheduledDatesForBatch(batch.id, selectedDate).map(dStr => (
                                                                                    <option key={dStr} value={dStr}>
                                                                                        Yes, on behalf of {formatLocalDateStr(dStr, true)}
                                                                                    </option>
                                                                                ))}
                                                                            </select>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {isBatchLoading ? (
                                                            <div className="flex flex-col items-center justify-center py-6">
                                                                <Loader2 className="w-5 h-5 animate-spin text-[#ecb613] mb-1.5" />
                                                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Loading Roster...</p>
                                                            </div>
                                                        ) : batchRoster.length > 0 ? (
                                                            <div className="relative">
                                                                {batch.activeHoliday && (
                                                                    <div className="mb-2.5 px-3 py-2 rounded-xl bg-amber-100/90 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 flex items-center justify-between gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                                                                        <span>
                                                                            🔒 Attendance is blurred and locked because this class is marked as Class Off ({batch.activeHoliday.holiday_type === 'no_alternative' ? 'No Alternative' : 'Attendance taken in Alternative Class'}).
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                <div className={`space-y-2 transition-all ${batch.activeHoliday ? 'blur-[2px] opacity-45 pointer-events-none select-none' : ''}`}>
                                                                {batchRoster.map((student) => {
                                                                    const status = batchAttendance[student.id];
                                                                    const coveredInfo = coveredAttendanceMap[student.id];
                                                                    const isCoveredLocked = !!coveredInfo;
                                                                    const currentStatus = isCoveredLocked ? (coveredInfo.status as any) : status;
                                                                    return (
                                                                        <div 
                                                                            key={student.id} 
                                                                            onDoubleClick={() => openStudentAttendanceModal(student.id, student.name, student.profile_pic_url || undefined)}
                                                                            title="Double-click student to view attendance history"
                                                                            className="bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-300/60 dark:hover:border-amber-700/60 flex items-center justify-between gap-2 shadow-xs select-none transition-colors"
                                                                        >
                                                                            <div 
                                                                                onClick={() => openStudentAttendanceModal(student.id, student.name, student.profile_pic_url || undefined)}
                                                                                className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group/student"
                                                                            >
                                                                                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 group-hover/student:border-[#ecb613] transition-colors">
                                                                                    {student.profile_pic_url ? (
                                                                                        <img src={student.profile_pic_url} alt={student.name} className="w-full h-full object-cover" />
                                                                                    ) : (
                                                                                        <span className="text-[#ecb613] font-bold text-xs">{student.name.charAt(0)}</span>
                                                                                    )}
                                                                                </div>
                                                                                <div className="min-w-0 flex-1">
                                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                                        <h6 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate max-w-full leading-tight group-hover/student:text-[#ecb613] transition-colors">{student.name}</h6>
                                                                                        {student.isMakeup && (
                                                                                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                                                                                                GUEST • MAKEUP
                                                                                            </span>
                                                                                        )}
                                                                                        {isCoveredLocked && (
                                                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                                                                                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                                                                                                <span>Already counted on {formatLocalDateStr(coveredInfo.actualDate)}</span>
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    {student.missedDate && (
                                                                                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                                                                                            Makeup for: {formatLocalDateStr(student.missedDate)}
                                                                                        </p>
                                                                                    )}
                                                                                </div>
                                                                            </div>

                                                                            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                                                                                {/* Accessible View Attendance Button */}
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        openStudentAttendanceModal(student.id, student.name, student.profile_pic_url || undefined);
                                                                                    }}
                                                                                    title="View Attendance Details"
                                                                                    className="p-1.5 sm:px-2 sm:py-1 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                                                                >
                                                                                    <BookOpen className="w-3.5 h-3.5 text-[#ecb613]" />
                                                                                    <span className="hidden md:inline">History</span>
                                                                                </button>

                                                                                {([
                                                                                    { key: 'present', label: 'Present', shortLabel: 'P', activeClass: 'bg-emerald-500 text-white shadow-sm border-emerald-500', inactiveClass: 'border-emerald-200/80 text-emerald-600 dark:border-emerald-900/40' },
                                                                                    { key: 'absent', label: 'Absent', shortLabel: 'A', activeClass: 'bg-rose-500 text-white shadow-sm border-rose-500', inactiveClass: 'border-rose-200/80 text-rose-600 dark:border-rose-900/40' },
                                                                                    { key: 'late', label: 'Late', shortLabel: 'L', activeClass: 'bg-amber-500 text-white shadow-sm border-amber-500', inactiveClass: 'border-amber-200/80 text-amber-600 dark:border-amber-900/40' },
                                                                                    { key: 'excused', label: 'Excused', shortLabel: 'E', activeClass: 'bg-slate-600 text-white shadow-sm border-slate-600', inactiveClass: 'border-slate-200 text-slate-600 dark:border-slate-700' }
                                                                                ] as const).map(opt => {
                                                                                    const isActive = currentStatus === opt.key;
                                                                                    const studentLockKey = `${batch.id}_${student.id}`;
                                                                                    const isSaving = !!savingAttendanceMap[studentLockKey];
                                                                                    const isDisabled = isCoveredLocked || isSaving;
                                                                                    return (
                                                                                        <button
                                                                                            key={opt.key}
                                                                                            disabled={isDisabled}
                                                                                            title={isCoveredLocked 
                                                                                                ? `Attendance covered on ${formatLocalDateStr(coveredInfo.actualDate)}` 
                                                                                                : (isActive ? "Click to unmark attendance" : `Mark as ${opt.label}`)}
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                if (isDisabled) return;
                                                                                                handleMarkBatchAttendance(batch.id, student.id, opt.key);
                                                                                            }}
                                                                                            className={`w-7 h-7 sm:w-auto sm:h-auto sm:px-3 sm:py-1 rounded-lg text-xs font-bold uppercase border transition-all duration-200 flex items-center justify-center ${
                                                                                                isCoveredLocked
                                                                                                    ? (isActive 
                                                                                                        ? `${opt.activeClass} opacity-85 cursor-not-allowed` 
                                                                                                        : 'border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 opacity-40 cursor-not-allowed')
                                                                                                    : isSaving
                                                                                                        ? `${isActive ? opt.activeClass : opt.inactiveClass} opacity-60 cursor-wait`
                                                                                                        : (isActive ? `${opt.activeClass} cursor-pointer` : `${opt.inactiveClass} bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer`)
                                                                                            }`}
                                                                                        >
                                                                                            {isSaving && isActive && <Loader2 className="w-3 h-3 animate-spin mr-1 shrink-0 inline" />}
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
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">

                                    {/* ── Section A: Date-based Student Roster with Attendance Marking ── */}
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                        {/* Header */}
                                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div>
                                                <h4 className="font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                                                    <Users className="w-4 h-4 text-[#ecb613]" />
                                                    <span>Students on {formatLocalDateStr(selectedDate, true)}</span>
                                                    {dateStudentsLoading && dateStudentsData.length > 0 && (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ecb613]" />
                                                    )}
                                                </h4>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                                                    {dateStudentsData.length} student{dateStudentsData.length !== 1 ? 's' : ''} allocated · select date from calendar
                                                </p>
                                            </div>
                                            {/* Search within date students */}
                                            <div className="relative min-w-0 w-full sm:w-64">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                                                <input
                                                    type="text"
                                                    value={dateStudentSearchQuery}
                                                    onChange={(e) => setDateStudentSearchQuery(e.target.value)}
                                                    placeholder="Search students..."
                                                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-[#ecb613]/50 text-xs font-semibold outline-none transition-all placeholder:text-slate-400"
                                                />
                                            </div>
                                        </div>

                                        {/* Student list body */}
                                        {dateStudentsLoading && dateStudentsData.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-14">
                                                <Loader2 className="w-6 h-6 animate-spin text-[#ecb613] mb-2" />
                                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Loading students...</p>
                                            </div>
                                        ) : (() => {
                                            const query = dateStudentSearchQuery.toLowerCase().trim();
                                            const filtered = dateStudentsData.filter(e =>
                                                !query || e.student.name.toLowerCase().includes(query)
                                            );

                                            if (dateStudentsData.length === 0) {
                                                return (
                                                    <div className="py-14 flex flex-col items-center justify-center text-center">
                                                        <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-3">
                                                            <CalendarIcon className="w-7 h-7 text-slate-300" />
                                                        </div>
                                                        <h6 className="font-extrabold text-slate-400 tracking-tight">No batches scheduled</h6>
                                                        <p className="text-xs text-slate-400 mt-1">Select a date with a batch from the calendar.</p>
                                                    </div>
                                                );
                                            }

                                            if (filtered.length === 0) {
                                                return (
                                                    <div className="py-10 flex flex-col items-center justify-center text-center">
                                                        <Search className="w-7 h-7 text-slate-300 mb-2" />
                                                        <p className="text-xs font-bold text-slate-400">No students match "{dateStudentSearchQuery}"</p>
                                                    </div>
                                                );
                                            }

                                            // Group by classroom
                                            const grouped: Record<string, { name: string; entries: typeof filtered }> = {};
                                            filtered.forEach(e => {
                                                if (!grouped[e.classroom_id]) {
                                                    grouped[e.classroom_id] = { name: e.classroom_name, entries: [] };
                                                }
                                                grouped[e.classroom_id].entries.push(e);
                                            });

                                            const sortedGrouped = Object.entries(grouped).sort(([cidA], [cidB]) => {
                                                const batchA = activeBatchesOnSelectedDate.find(b => b.id === cidA);
                                                const batchB = activeBatchesOnSelectedDate.find(b => b.id === cidB);
                                                const timeA = batchA?.startTime || '00:00:00';
                                                const timeB = batchB?.startTime || '00:00:00';
                                                return timeA.localeCompare(timeB);
                                            });

                                            return (
                                                <div className="divide-y divide-slate-100 dark:divide-slate-800/40">
                                                    {sortedGrouped.map(([cid, group]) => {
                                                        const groupBatch = activeBatchesOnSelectedDate.find(b => b.id === cid);
                                                        const groupHoliday = groupBatch?.activeHoliday;
                                                        return (
                                                        <div key={cid}>
                                                            {/* Batch sub-header */}
                                                            <div className="px-3 py-2 sm:px-5 sm:py-2.5 bg-slate-50/70 dark:bg-slate-800/40 flex items-center gap-2 flex-wrap">
                                                                <School className="w-3.5 h-3.5 text-[#ecb613] shrink-0" />
                                                                <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest truncate">{group.name}</span>
                                                                {groupHoliday && (
                                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                                                        🔒 Class Off Locked ({groupHoliday.holiday_type === 'no_alternative' ? 'No Alternative' : 'Alt Class'})
                                                                    </span>
                                                                )}
                                                                <span className="ml-auto text-[9px] font-black text-slate-400 uppercase tracking-wider shrink-0">{group.entries.length} student{group.entries.length !== 1 ? 's' : ''}</span>
                                                            </div>
                                                            {/* Students */}
                                                            <div className={`divide-y divide-slate-50 dark:divide-slate-800/20 ${groupHoliday ? 'blur-[2px] opacity-45 pointer-events-none select-none' : ''}`}>
                                                                {group.entries.map((entry) => {
                                                                    const attKey = `${entry.student.id}_${entry.classroom_id}`;
                                                                    const status = dateAttendanceMap[attKey];
                                                                    const coveredInfo = coveredAttendanceMap[entry.student.id];
                                                                    const isCoveredLocked = !!coveredInfo;
                                                                    const currentStatus = isCoveredLocked ? (coveredInfo.status as any) : status;
                                                                    return (
                                                                        <div
                                                                            key={attKey}
                                                                            onDoubleClick={() => openStudentAttendanceModal(entry.student.id, entry.student.name, entry.student.profile_pic_url || undefined)}
                                                                            title="Double-click student to view attendance history"
                                                                            className="px-3 py-2.5 sm:px-5 sm:py-3.5 flex items-center justify-between gap-2 hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors select-none"
                                                                        >
                                                                            <div 
                                                                                onClick={() => openStudentAttendanceModal(entry.student.id, entry.student.name, entry.student.profile_pic_url || undefined)}
                                                                                className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group/student"
                                                                            >
                                                                                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 group-hover/student:border-[#ecb613] transition-colors">
                                                                                    {entry.student.profile_pic_url ? (
                                                                                        <img src={entry.student.profile_pic_url} alt={entry.student.name} className="w-full h-full object-cover" />
                                                                                    ) : (
                                                                                        <span className="text-[#ecb613] font-bold text-xs sm:text-sm">{entry.student.name.charAt(0)}</span>
                                                                                    )}
                                                                                </div>
                                                                                <div className="min-w-0 flex-1">
                                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                                        <h6 className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm leading-tight truncate group-hover/student:text-[#ecb613] transition-colors">{entry.student.name}</h6>
                                                                                        {entry.isMakeup && (
                                                                                            <span className="text-[8px] sm:text-[9px] font-black text-blue-500 uppercase tracking-wider block truncate">Makeup Session</span>
                                                                                        )}
                                                                                        {isCoveredLocked && (
                                                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                                                                                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                                                                                                <span>Already counted on {formatLocalDateStr(coveredInfo.actualDate)}</span>
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            {/* Accessible View Attendance Button & Attendance buttons */}
                                                                            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        openStudentAttendanceModal(entry.student.id, entry.student.name, entry.student.profile_pic_url || undefined);
                                                                                    }}
                                                                                    title="View Attendance Details"
                                                                                    className="p-1.5 sm:px-2 sm:py-1 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                                                                >
                                                                                    <BookOpen className="w-3.5 h-3.5 text-[#ecb613]" />
                                                                                    <span className="hidden md:inline">History</span>
                                                                                </button>

                                                                                {([
                                                                                    { key: 'present' as const, label: 'Present', shortLabel: 'P', activeClass: 'bg-emerald-500 text-white shadow-sm border-emerald-500', inactiveClass: 'border-emerald-200/80 text-emerald-600 dark:border-emerald-900/40' },
                                                                                    { key: 'absent' as const, label: 'Absent', shortLabel: 'A', activeClass: 'bg-rose-500 text-white shadow-sm border-rose-500', inactiveClass: 'border-rose-200/80 text-rose-600 dark:border-rose-900/40' },
                                                                                    { key: 'late' as const, label: 'Late', shortLabel: 'L', activeClass: 'bg-amber-500 text-white shadow-sm border-amber-500', inactiveClass: 'border-amber-200/80 text-amber-600 dark:border-amber-900/40' },
                                                                                    { key: 'excused' as const, label: 'Excused', shortLabel: 'E', activeClass: 'bg-slate-600 text-white shadow-sm border-slate-600', inactiveClass: 'border-slate-200 text-slate-600 dark:border-slate-700' }
                                                                                ]).map(opt => {
                                                                                    const isActive = currentStatus === opt.key;
                                                                                    const studentLockKey = `${entry.classroom_id}_${entry.student.id}`;
                                                                                    const isSaving = !!savingAttendanceMap[studentLockKey];
                                                                                    const isDisabled = isCoveredLocked || isSaving;
                                                                                    return (
                                                                                        <button
                                                                                            key={opt.key}
                                                                                            disabled={isDisabled}
                                                                                            title={isCoveredLocked 
                                                                                                ? `Attendance covered on ${formatLocalDateStr(coveredInfo.actualDate)}` 
                                                                                                : (isActive ? "Click to unmark attendance" : `Mark as ${opt.label}`)}
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                if (isDisabled) return;
                                                                                                handleMarkDateAttendance(entry.student.id, entry.classroom_id, opt.key);
                                                                                            }}
                                                                                            className={`w-7 h-7 sm:w-auto sm:h-auto sm:px-3.5 sm:py-1.5 rounded-lg text-xs font-black uppercase border transition-all duration-200 flex items-center justify-center ${
                                                                                                isCoveredLocked
                                                                                                    ? (isActive 
                                                                                                        ? `${opt.activeClass} opacity-85 cursor-not-allowed` 
                                                                                                        : 'border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 opacity-40 cursor-not-allowed')
                                                                                                    : isSaving
                                                                                                        ? `${isActive ? opt.activeClass : opt.inactiveClass} opacity-60 cursor-wait`
                                                                                                        : (isActive ? opt.activeClass : `${opt.inactiveClass} bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer`)
                                                                                            }`}
                                                                                        >
                                                                                            {isSaving && isActive && <Loader2 className="w-3 h-3 animate-spin mr-1 shrink-0 inline" />}
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
                                                        </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}

                            {/* ── MODE 3: ATTENDANCE PENDING & MISSED CLASSES REPORT ───────── */}
                            {mode === 'missed' && (
                                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300 text-left">
                                    {/* Top Header & Sub-Tab Switcher */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div>
                                            <h2 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white flex items-center gap-2">
                                                <Clock className="w-6 h-6 text-[#ecb613]" />
                                                {missedSubTab === 'pending' ? 'Attendance Pending' : 'Missed Classes & Makeups'}
                                            </h2>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                {missedSubTab === 'pending' 
                                                    ? 'Past classes with attendance still waiting to be completed.'
                                                    : 'Review absent and excused students, schedule makeup classes, and track completed makeups.'}
                                            </p>
                                        </div>

                                        {/* Sub-tab switcher */}
                                        <div className="bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl flex items-center gap-1 self-start sm:self-auto border border-slate-200/50 dark:border-slate-700/50">
                                            <button
                                                onClick={() => setMissedSubTab('pending')}
                                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                                    missedSubTab === 'pending'
                                                        ? 'bg-[#ecb613] text-slate-950 shadow-xs'
                                                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                                                }`}
                                            >
                                                <span>Pending Attendance</span>
                                                {pendingSummary.totalPendingStudents > 0 && (
                                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                                                        missedSubTab === 'pending' ? 'bg-slate-950 text-[#ecb613]' : 'bg-amber-500 text-white'
                                                    }`}>
                                                        {pendingSummary.totalPendingStudents}
                                                    </span>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setMissedSubTab('makeup');
                                                    fetchMissedReport();
                                                }}
                                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                                    missedSubTab === 'makeup'
                                                        ? 'bg-[#ecb613] text-slate-950 shadow-xs'
                                                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                                                }`}
                                            >
                                                <span>Makeup Tracking</span>
                                                {missedLogs.length > 0 && (
                                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                                                        missedSubTab === 'makeup' ? 'bg-slate-950 text-[#ecb613]' : 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                                                    }`}>
                                                        {missedLogs.length}
                                                    </span>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {missedSubTab === 'pending' ? (
                                        /* ── SUB-TAB 1: ATTENDANCE PENDING ────────────────────────────── */
                                        <div className="space-y-5">
                                            {/* 3 Summary Cards */}
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                                                <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                                                    <div>
                                                        <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">Pending Students</p>
                                                        <h3 className="text-xl sm:text-2xl font-black text-amber-500 mt-1">
                                                            {pendingSummary.totalPendingStudents}
                                                        </h3>
                                                        <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Un-marked student outcomes</p>
                                                    </div>
                                                    <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-500 rounded-xl shrink-0">
                                                        <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                                                    </div>
                                                </div>

                                                <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                                                    <div>
                                                        <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">Affected Classes</p>
                                                        <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
                                                            {pendingSummary.affectedClassesCount}
                                                        </h3>
                                                        <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Sessions awaiting completion</p>
                                                    </div>
                                                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-500 rounded-xl shrink-0">
                                                        <School className="w-5 h-5 sm:w-6 sm:h-6" />
                                                    </div>
                                                </div>

                                                <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                                                    <div>
                                                        <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">Oldest Pending</p>
                                                        <h3 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
                                                            {pendingSummary.oldestPendingDate ? formatLocalDateStr(pendingSummary.oldestPendingDate, true) : 'None'}
                                                        </h3>
                                                        <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                                                            {pendingSummary.oldestPendingDate ? 'Earliest backlog date' : 'All up to date'}
                                                        </p>
                                                    </div>
                                                    <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl shrink-0">
                                                        <History className="w-5 h-5 sm:w-6 sm:h-6" />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Filters & Date Range Bar */}
                                            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                                                    {/* Student Search */}
                                                    <div className="relative flex-1 max-w-xs">
                                                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                                        <input 
                                                            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-xl focus:ring-2 focus:ring-[#ecb613]/50 text-xs font-semibold outline-none transition-all placeholder:text-slate-400" 
                                                            placeholder="Search pending student..."
                                                            type="text"
                                                            value={pendingSearchQuery}
                                                            onChange={(e) => setPendingSearchQuery(e.target.value)}
                                                        />
                                                    </div>

                                                    {/* Status Filter Tabs */}
                                                    <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60 overflow-x-auto">
                                                        <button 
                                                            onClick={() => setPendingFilterType('all')}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                                                pendingFilterType === 'all' 
                                                                    ? 'bg-[#ecb613] text-slate-900 shadow-xs' 
                                                                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                                                            }`}
                                                        >
                                                            All Pending ({pendingSessions.length})
                                                        </button>
                                                        <button 
                                                            onClick={() => setPendingFilterType('unmarked')}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                                                pendingFilterType === 'unmarked' 
                                                                    ? 'bg-[#ecb613] text-slate-900 shadow-xs' 
                                                                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                                                            }`}
                                                        >
                                                            Fully Unmarked
                                                        </button>
                                                        <button 
                                                            onClick={() => setPendingFilterType('partial')}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                                                pendingFilterType === 'partial' 
                                                                    ? 'bg-[#ecb613] text-slate-900 shadow-xs' 
                                                                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                                                            }`}
                                                        >
                                                            Partially Marked
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Date Range Picker & Quick Presets */}
                                                <div className="flex items-center gap-2 flex-wrap shrink-0">
                                                    <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                                                        <button
                                                            onClick={setPresetThisMonth}
                                                            className="px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white rounded-md transition-all cursor-pointer"
                                                        >
                                                            This Month
                                                        </button>
                                                        <button
                                                            onClick={setPresetLast30Days}
                                                            className="px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white rounded-md transition-all cursor-pointer"
                                                        >
                                                            Last 30 Days
                                                        </button>
                                                        <button
                                                            onClick={setPresetLastMonth}
                                                            className="px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white rounded-md transition-all cursor-pointer"
                                                        >
                                                            Last Month
                                                        </button>
                                                    </div>

                                                    <div className="flex items-center gap-1.5">
                                                        <input 
                                                            type="date" 
                                                            value={fromDate}
                                                            onChange={(e) => setFromDate(e.target.value)}
                                                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-[#ecb613]/50 outline-none px-2.5 py-1.5 shadow-xs"
                                                        />
                                                        <span className="text-xs text-slate-400 font-bold">to</span>
                                                        <input 
                                                            type="date" 
                                                            value={toDate}
                                                            onChange={(e) => setToDate(e.target.value)}
                                                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-[#ecb613]/50 outline-none px-2.5 py-1.5 shadow-xs"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Pending Classes Content */}
                                            {pendingLoading ? (
                                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-16 flex flex-col items-center justify-center shadow-sm">
                                                    <Loader2 className="w-8 h-8 animate-spin text-[#ecb613] mb-3" />
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                                                        Analyzing past classes and pending attendance...
                                                    </p>
                                                </div>
                                            ) : filteredPendingSessions.length > 0 ? (
                                                <div className="space-y-4">
                                                    {filteredPendingSessions.map((session) => (
                                                        <div 
                                                            key={session.sessionKey}
                                                            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
                                                        >
                                                            {/* Class Header */}
                                                            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30">
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <h4 className="text-sm sm:text-base font-black text-slate-950 dark:text-white">
                                                                            {session.classroomName}
                                                                        </h4>
                                                                        {session.isTemporary && (
                                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400">
                                                                                Special Session
                                                                            </span>
                                                                        )}
                                                                        {session.holidayInfo ? (
                                                                            session.holidayInfo.alternativeStatus === 'not_scheduled' ? (
                                                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                                                                    🏖️ Class Off — Alternative Class Not Scheduled Yet
                                                                                </span>
                                                                            ) : (
                                                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                                                                                    🏖️ Class Off — Alt Class Attendance Pending ({formatLocalDateStr(session.holidayInfo.alternativeDate!, true)})
                                                                                </span>
                                                                            )
                                                                        ) : session.markedCount === 0 ? (
                                                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400">
                                                                                Fully Unmarked (0/{session.totalExpectedCount})
                                                                            </span>
                                                                        ) : (
                                                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400">
                                                                                Partially Marked ({session.markedCount}/{session.totalExpectedCount})
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium flex-wrap">
                                                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                                        <span>{formatLocalDateStr(session.date, true)}</span>
                                                                        <span>•</span>
                                                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                                        <span>{session.timeFormatted}</span>
                                                                        {session.holidayInfo?.reason && (
                                                                            <>
                                                                                <span>•</span>
                                                                                <span className="text-amber-700 dark:text-amber-400 italic">Reason: {session.holidayInfo.reason}</span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                                                                    {session.holidayInfo && session.holidayInfo.alternativeStatus === 'not_scheduled' && (
                                                                        <>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    const holRow = classroomHolidays.find((h: any) => h.id === session.holidayInfo?.id);
                                                                                    setScheduleAltModalState({
                                                                                        isOpen: true,
                                                                                        holiday: holRow || {
                                                                                            id: session.holidayInfo!.id,
                                                                                            classroom_id: session.classroomId,
                                                                                            holiday_date: session.date,
                                                                                            holiday_type: 'alternative_pending',
                                                                                            reason: session.holidayInfo!.reason
                                                                                        },
                                                                                        classroomName: session.classroomName
                                                                                    });
                                                                                }}
                                                                                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black transition-all cursor-pointer shadow-xs"
                                                                            >
                                                                                📅 Schedule Alternative
                                                                            </button>
                                                                            <Link
                                                                                href={`/teacher-dashboard/classrooms/add?type=temporary&holidayId=${session.holidayInfo.id}&classroomId=${session.classroomId}&holidayDate=${session.date}`}
                                                                                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs inline-flex items-center gap-1"
                                                                            >
                                                                                <span>⚡ Create Special Session (On Behalf)</span>
                                                                            </Link>
                                                                        </>
                                                                    )}
                                                                    {session.holidayInfo && session.holidayInfo.alternativeDate && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setSelectedDate(session.holidayInfo!.alternativeDate!);
                                                                                setMode('class');
                                                                                handleExpandBatch(session.classroomId, session.isTemporary, true);
                                                                            }}
                                                                            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                                                                        >
                                                                            <span>Open Alternative ({formatLocalDateStr(session.holidayInfo.alternativeDate)})</span>
                                                                            <ArrowRight className="w-3 h-3" />
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedDate(session.date);
                                                                            setMode('class');
                                                                            handleExpandBatch(session.classroomId, session.isTemporary, true);
                                                                        }}
                                                                        className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-[#ecb613] hover:text-[#ecb613] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                                                                    >
                                                                        <span>Open in Calendar</span>
                                                                        <ArrowRight className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Student Pending Rows */}
                                                            <div className={`divide-y divide-slate-100 dark:divide-slate-800/50 ${session.holidayInfo?.alternativeStatus === 'not_scheduled' ? 'blur-[1.5px] opacity-45 pointer-events-none select-none' : ''}`}>
                                                                {session.pendingStudents.map((student) => {
                                                                    const markKey = `${session.sessionKey}_${student.studentId}`;
                                                                    const isMarking = !!pendingMarkingMap[markKey];

                                                                    return (
                                                                        <div 
                                                                            key={student.studentId}
                                                                            className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
                                                                        >
                                                                            {/* Student Info */}
                                                                            <div className="flex items-center gap-3">
                                                                                {student.profilePicUrl ? (
                                                                                    <img 
                                                                                        src={student.profilePicUrl} 
                                                                                        alt={student.studentName} 
                                                                                        className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0" 
                                                                                    />
                                                                                ) : (
                                                                                    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-500 uppercase shrink-0">
                                                                                        {student.studentName ? student.studentName.slice(0, 2) : 'ST'}
                                                                                    </div>
                                                                                )}
                                                                                <div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span 
                                                                                            onClick={() => openStudentAttendanceModal(student.studentId, student.studentName, student.profilePicUrl)}
                                                                                            className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white hover:underline cursor-pointer"
                                                                                        >
                                                                                            {student.studentName}
                                                                                        </span>
                                                                                        {student.isMakeup && (
                                                                                            <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
                                                                                                Makeup
                                                                                            </span>
                                                                                        )}
                                                                                        {student.isGuest && !student.isMakeup && (
                                                                                            <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400">
                                                                                                Guest
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 mt-0.5">
                                                                                        <Clock className="w-3 h-3" />
                                                                                        Attendance Pending
                                                                                    </p>
                                                                                </div>
                                                                            </div>

                                                                            {/* Inline Quick Action Buttons */}
                                                                            <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                                                                                {isMarking ? (
                                                                                    <div className="px-4 py-2 flex items-center gap-2 text-xs font-bold text-slate-400">
                                                                                        <Loader2 className="w-4 h-4 animate-spin text-[#ecb613]" />
                                                                                        <span>Saving...</span>
                                                                                    </div>
                                                                                ) : (
                                                                                    <>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => handleMarkPendingStudent(session, student.studentId, 'present')}
                                                                                            className="px-2.5 sm:px-3 py-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white dark:bg-emerald-950/20 dark:text-emerald-400 dark:hover:bg-emerald-600 dark:hover:text-white rounded-lg text-[11px] font-bold transition-all shadow-2xs border border-emerald-200/50 dark:border-emerald-800/50 flex items-center gap-1 cursor-pointer"
                                                                                        >
                                                                                            <Check className="w-3 h-3" />
                                                                                            <span>Present</span>
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => handleMarkPendingStudent(session, student.studentId, 'absent')}
                                                                                            className="px-2.5 sm:px-3 py-1.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-600 dark:hover:text-white rounded-lg text-[11px] font-bold transition-all shadow-2xs border border-rose-200/50 dark:border-rose-800/50 flex items-center gap-1 cursor-pointer"
                                                                                        >
                                                                                            <X className="w-3 h-3" />
                                                                                            <span>Absent</span>
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => handleMarkPendingStudent(session, student.studentId, 'late')}
                                                                                            className="px-2.5 sm:px-3 py-1.5 bg-amber-50 hover:bg-amber-600 text-amber-700 hover:text-white dark:bg-amber-950/20 dark:text-amber-400 dark:hover:bg-amber-600 dark:hover:text-white rounded-lg text-[11px] font-bold transition-all shadow-2xs border border-amber-200/50 dark:border-amber-800/50 flex items-center gap-1 cursor-pointer"
                                                                                        >
                                                                                            <Clock className="w-3 h-3" />
                                                                                            <span>Late</span>
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => handleMarkPendingStudent(session, student.studentId, 'excused')}
                                                                                            className="px-2.5 sm:px-3 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white dark:bg-blue-950/20 dark:text-blue-400 dark:hover:bg-blue-600 dark:hover:text-white rounded-lg text-[11px] font-bold transition-all shadow-2xs border border-blue-200/50 dark:border-blue-800/50 flex items-center gap-1 cursor-pointer"
                                                                                        >
                                                                                            <span>Excused</span>
                                                                                        </button>
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-16 text-center shadow-sm">
                                                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 flex items-center justify-center mx-auto mb-3">
                                                        <CheckCircle2 className="w-8 h-8" />
                                                    </div>
                                                    <h4 className="text-base font-black text-slate-900 dark:text-white">
                                                        All Caught Up!
                                                    </h4>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 font-medium">
                                                        {pendingSearchQuery || pendingFilterType !== 'all' 
                                                            ? 'No pending attendance matches the current filter or search criteria.'
                                                            : 'Every scheduled past class session in this date range has finalized attendance marked.'}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* ── SUB-TAB 2: LEGACY MAKEUP TRACKER ──────────────────────────── */
                                        <div className="space-y-4">
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
                                                        return (
                                                            <div 
                                                                key={log.id} 
                                                                onDoubleClick={() => openStudentAttendanceModal(log.student_id, log.student_name, log.student_profile_pic_url)}
                                                                title="Double-click to view student attendance history"
                                                                className="p-4 flex flex-col gap-3 bg-white dark:bg-slate-900 text-left select-none"
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <span 
                                                                        onClick={() => openStudentAttendanceModal(log.student_id, log.student_name, log.student_profile_pic_url)}
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
                                                                                    <span className="block text-[10px] text-slate-500 font-normal">
                                                                                        in {resolveClassroomName(log.scheduledMakeup.target_classroom_id)}
                                                                                    </span>
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
                                                                                    classroom_name: resolveClassroomName(log.scheduledMakeup.target_classroom_id),
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
                                                            return (
                                                                <tr 
                                                                    key={log.id} 
                                                                    onDoubleClick={() => openStudentAttendanceModal(log.student_id, log.student_name, log.student_profile_pic_url)}
                                                                    title="Double-click to view student attendance history"
                                                                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 transition-colors select-none"
                                                                >
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
                                                                                onClick={() => openStudentAttendanceModal(log.student_id, log.student_name, log.student_profile_pic_url)}
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
                                                                                    {formatLocalDateStr(log.scheduledMakeup.override_date)} in {resolveClassroomName(log.scheduledMakeup.target_classroom_id)}
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
                                                                                        classroom_name: resolveClassroomName(log.scheduledMakeup.target_classroom_id),
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
                                                            <tr 
                                                                key={log.id} 
                                                                onDoubleClick={() => openStudentAttendanceModal(log.student_id, log.student_name, log.student_profile_pic_url)}
                                                                title="Double-click to view student attendance history"
                                                                className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 transition-colors select-none"
                                                            >
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
                                                                            onClick={() => openStudentAttendanceModal(log.student_id, log.student_name, log.student_profile_pic_url)}
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
                                        <p className="text-[11px] text-slate-400 font-medium">
                                            Actionable pending leaves remain visible. Approved/rejected history obeys <span className="font-bold text-slate-600 dark:text-slate-300">{fromDate} → {toDate}</span>.
                                        </p>
                                    </div>

                                    {/* Leaves List */}
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-5">
                                        {leavesLoading ? (
                                            <div className="flex items-center justify-center py-12">
                                                <Loader2 className="size-8 animate-spin text-[#ecb613]" />
                                            </div>
                                        ) : leaveRequests.filter(r => leavesFilter === 'all' || r.status === leavesFilter).length > 0 ? (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse min-w-[850px]">
                                                    <thead>
                                                        <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                                                            <th className="px-5 py-3 text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider">Student</th>
                                                            <th className="px-5 py-3 text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider">Classroom / Batch</th>
                                                            <th className="px-5 py-3 text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider">Requested Date</th>
                                                            <th className="px-5 py-3 text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider">Reason</th>
                                                            <th className="px-5 py-3 text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider">Status</th>
                                                            <th className="px-5 py-3 text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider">Alternative Class (Makeup)</th>
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
                                                                                : request.status === 'cancelled'
                                                                                    ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                                                                    : request.status === 'rejected'
                                                                                        ? 'bg-rose-50 text-rose-750 dark:bg-rose-955/20 dark:text-rose-455'
                                                                                        : 'bg-amber-50 text-amber-750 dark:bg-amber-955/20 dark:text-amber-455'
                                                                        }`} title={request.cancellation_reason || undefined}>
                                                                            {request.status === 'cancelled' ? 'Cancelled (Class Off)' : request.status}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-5 py-4 text-xs">
                                                                        {request.status === 'approved' ? (
                                                                            request.scheduledMakeup ? (
                                                                                <div className="flex flex-col text-slate-600 dark:text-slate-400">
                                                                                    {request.isMakeupCompleted ? (
                                                                                        <span className="font-extrabold text-emerald-600 dark:text-emerald-450 flex items-center gap-1.5">
                                                                                            <CheckCircle2 className="w-3.5 h-3.5" /> Attended ({request.makeupAttendanceStatus || 'present'})
                                                                                        </span>
                                                                                    ) : request.isMakeupMissed ? (
                                                                                        <span className="font-extrabold text-rose-600 dark:text-rose-455 flex items-center gap-1.5">
                                                                                            <XCircle className="w-3.5 h-3.5" /> Missed Makeup
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="font-extrabold text-amber-600 dark:text-amber-450 flex items-center gap-1.5">
                                                                                            <Calendar className="w-3.5 h-3.5" /> Scheduled
                                                                                        </span>
                                                                                    )}
                                                                                    <span className="text-[10px] mt-0.5 text-slate-500 font-medium">
                                                                                        {formatLocalDateStr(request.scheduledMakeup.override_date)} in {resolveClassroomName(request.scheduledMakeup.target_classroom_id)}
                                                                                    </span>
                                                                                </div>
                                                                            ) : (
                                                                                <span className="text-slate-400 italic">No makeup scheduled</span>
                                                                            )
                                                                        ) : (
                                                                            <span className="text-slate-400 font-mono">—</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-5 py-4 text-right">
                                                                        <div className="flex items-center justify-end gap-2">
                                                                            {request.status === 'pending' ? (
                                                                                <>
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
                                                                                </>
                                                                            ) : request.status === 'approved' ? (
                                                                                request.isMakeupCompleted ? (
                                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-wider border border-emerald-200 dark:border-emerald-800/40" title="Makeup class completed">
                                                                                        <Check className="size-3" /> Attended
                                                                                    </span>
                                                                                ) : request.scheduledMakeup && !request.isMakeupMissed ? (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setMakeupStudent({
                                                                                                student_id: request.student_id,
                                                                                                student_name: request.users?.name || 'Student',
                                                                                                student_profile_pic_url: request.users?.profile_pic_url,
                                                                                                date: request.class_date,
                                                                                                classroom_name: request.classrooms?.name || 'Regular Batch',
                                                                                                classroom_id: request.classroom_id
                                                                                            });
                                                                                            setMakeupDate(request.scheduledMakeup.override_date);
                                                                                            setMakeupClassroomId(request.scheduledMakeup.target_classroom_id);
                                                                                            setMakeupReason(stripMissedDateTag(request.scheduledMakeup.reason || ''));
                                                                                            setEditingMakeupId(request.scheduledMakeup.id?.startsWith('ob_') ? null : request.scheduledMakeup.id);
                                                                                            setShowMakeupModal(true);
                                                                                        }}
                                                                                        className="px-2.5 py-1 bg-[#ecb613]/10 hover:bg-[#ecb613]/25 text-[#92400e] dark:text-[#ecb613] rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors border border-[#ecb613]/30"
                                                                                        title="Reschedule makeup class"
                                                                                    >
                                                                                        <span>Reschedule</span>
                                                                                        <ArrowRight className="size-3" />
                                                                                    </button>
                                                                                ) : (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            const targetClassroomName = request.classrooms?.name || resolveClassroomName(request.classroom_id);
                                                                                            setMakeupStudent({
                                                                                                student_id: request.student_id,
                                                                                                student_name: request.users?.name || 'Student',
                                                                                                student_profile_pic_url: request.users?.profile_pic_url,
                                                                                                date: request.class_date,
                                                                                                classroom_name: targetClassroomName,
                                                                                                classroom_id: request.classroom_id
                                                                                            });
                                                                                            setMakeupDate(request.class_date);
                                                                                            setMakeupClassroomId(classrooms[0]?.id || '');
                                                                                            setMakeupReason(`Makeup for approved leave on ${formatLocalDateStr(request.class_date)}`);
                                                                                            setEditingMakeupId(null);
                                                                                            setShowMakeupModal(true);
                                                                                        }}
                                                                                        className="px-2.5 py-1 bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                                                                                        title="Schedule makeup class for this approved leave"
                                                                                    >
                                                                                        <span>Schedule Makeup</span>
                                                                                        <ArrowRight className="size-3" />
                                                                                    </button>
                                                                                )
                                                                            ) : (
                                                                                <span className="text-[10px] font-bold text-slate-400">Processed</span>
                                                                            )}

                                                                            {teacherProfile?.role === 'admin' && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setCorrectionLeaveRequest(request);
                                                                                        setShowCorrectionModal(true);
                                                                                    }}
                                                                                    className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:hover:bg-amber-900/30 dark:text-amber-300 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors"
                                                                                    title="Admin: Audit-backed leave correction"
                                                                                >
                                                                                    Correct
                                                                                </button>
                                                                            )}
                                                                        </div>
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
                                                <p className="text-xs text-slate-450 mt-1">
                                                    {leavesFilter === 'pending'
                                                        ? 'There are no pending leave requests requiring action.'
                                                        : `There are no ${leavesFilter === 'all' ? '' : leavesFilter + ' '}leave requests in the selected reporting range (${fromDate} → ${toDate}).`}
                                                </p>
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
                <ArrangeMakeupModal
                    isOpen={showMakeupModal}
                    onClose={handleCloseModal}
                    onSuccess={() => {
                        handleCloseModal();
                        fetchMissedReport();
                        fetchLeaveRequests();
                        if (expandedBatchId) {
                            handleExpandBatch(expandedBatchId, false, true);
                        }
                    }}
                    student={{
                        id: makeupStudent.student_id,
                        name: makeupStudent.student_name,
                        profile_pic_url: makeupStudent.student_profile_pic_url
                    }}
                    missedSession={{
                        date: makeupStudent.date,
                        classroomId: makeupStudent.classroom_id,
                        classroomName: makeupStudent.classroom_name
                    }}
                    existingOverrideId={editingMakeupId || undefined}
                    currentTeacherId={teacherProfile?.id}
                    isAdmin={teacherProfile?.role === 'admin'}
                />
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

            {/* Student Attendance Details Modal */}
            <StudentAttendanceModal
                isOpen={!!attendanceModalStudent}
                onClose={closeStudentAttendanceModal}
                studentId={attendanceModalStudent?.id || null}
                initialStudentName={attendanceModalStudent?.name}
                initialProfilePicUrl={attendanceModalStudent?.pic}
            />

            {/* Historical Leave Correction Modal (Admin Only) */}
            {showCorrectionModal && (
                <HistoricalLeaveCorrectionModal
                    isOpen={showCorrectionModal}
                    onClose={() => {
                        setShowCorrectionModal(false);
                        setCorrectionLeaveRequest(null);
                    }}
                    leaveRequest={correctionLeaveRequest}
                    onSuccess={() => {
                        fetchLeaveRequests();
                    }}
                />
            )}

            {/* Historical Attendance Correction Modal */}
            {attendanceCorrectionTarget && (
                <HistoricalAttendanceCorrectionModal
                    isOpen={!!attendanceCorrectionTarget}
                    onClose={() => setAttendanceCorrectionTarget(null)}
                    record={attendanceCorrectionTarget ? {
                        attendanceId: attendanceCorrectionTarget.id,
                        studentId: attendanceCorrectionTarget.student_id,
                        studentName: attendanceCorrectionTarget.student_name || 'Student',
                        classroomId: attendanceCorrectionTarget.classroom_id,
                        classroomName: attendanceCorrectionTarget.classroom_name || 'Classroom',
                        classDate: attendanceCorrectionTarget.date,
                        currentStatus: attendanceCorrectionTarget.status
                    } : null}
                    onSuccess={(result) => {
                        setAttendanceCorrectionTarget(null);
                        if (result?.classroom_id && result?.student_id && result?.new_status) {
                            setBatchAttendanceMap(prev => {
                                const curr = prev[result.classroom_id] || {};
                                return {
                                    ...prev,
                                    [result.classroom_id]: {
                                        ...curr,
                                        [result.student_id]: result.new_status
                                    }
                                };
                            });
                            const k = `${result.student_id}_${result.classroom_id}`;
                            setDateAttendanceMap(prev => ({ ...prev, [k]: result.new_status }));
                            if (expandedBatchId === result.classroom_id) {
                                handleExpandBatch(result.classroom_id, false, true);
                            }
                        }
                    }}
                />
            )}

            {/* Attendance Correction History / Audit Trail Modal */}
            {showCorrectionAuditModal && (
                <AttendanceCorrectionHistoryModal
                    isOpen={showCorrectionAuditModal}
                    onClose={() => {
                        setShowCorrectionAuditModal(false);
                        setAuditModalClassroomId(undefined);
                        setAuditModalStudentId(undefined);
                    }}
                    classroomId={auditModalClassroomId || expandedBatchId || undefined}
                    studentId={auditModalStudentId}
                />
            )}

            {/* Audited Attendance Unmarking Modal */}
            {attendanceUnmarkTarget && (
                <UnmarkAttendanceModal
                    isOpen={!!attendanceUnmarkTarget}
                    onClose={() => setAttendanceUnmarkTarget(null)}
                    record={attendanceUnmarkTarget}
                    onSuccess={(result) => {
                        setAttendanceUnmarkTarget(null);
                        if (result?.classroom_id && result?.student_id) {
                            setBatchAttendanceMap(prev => {
                                const curr = { ...(prev[result.classroom_id] || {}) };
                                delete curr[result.student_id];
                                return {
                                    ...prev,
                                    [result.classroom_id]: curr
                                };
                            });
                            const k = `${result.student_id}_${result.classroom_id}`;
                            setDateAttendanceMap(prev => {
                                const next = { ...prev };
                                delete next[k];
                                return next;
                            });
                            if (expandedBatchId === result.classroom_id) {
                                handleExpandBatch(result.classroom_id, false, true);
                            }
                        }
                    }}
                />
            )}

            {/* Holiday Management Modals (BR-22 & BR-23) */}
            <DeclareHolidayModal
                isOpen={declareHolidayModalState.isOpen}
                onClose={() => setDeclareHolidayModalState(prev => ({ ...prev, isOpen: false }))}
                classroomId={declareHolidayModalState.classroomId || expandedBatchId || classrooms[0]?.id}
                classroomName={declareHolidayModalState.classroomName || classrooms.find(c => c.id === expandedBatchId)?.name || classrooms[0]?.name}
                initialDate={declareHolidayModalState.initialDate || selectedDate}
                onSuccess={async () => {
                    await fetchClassroomHolidays();
                    if (expandedBatchId) {
                        const batch = activeBatchesOnSelectedDate.find(b => b.id === expandedBatchId);
                        handleExpandBatch(expandedBatchId, batch?.type === 'temporary', true);
                    }
                    if (mode === 'missed') {
                        fetchPendingReport();
                    }
                }}
            />

            <ScheduleAlternativeModal
                isOpen={scheduleAltModalState.isOpen}
                onClose={() => setScheduleAltModalState(prev => ({ ...prev, isOpen: false }))}
                holiday={scheduleAltModalState.holiday}
                classroomName={scheduleAltModalState.classroomName}
                onSuccess={async () => {
                    await fetchClassroomHolidays();
                    if (expandedBatchId) {
                        const batch = activeBatchesOnSelectedDate.find(b => b.id === expandedBatchId);
                        handleExpandBatch(expandedBatchId, batch?.type === 'temporary', true);
                    }
                    if (mode === 'missed') {
                        fetchPendingReport();
                    }
                }}
            />

            <HolidayAuditHistoryModal
                isOpen={holidayAuditModalState.isOpen}
                onClose={() => setHolidayAuditModalState(prev => ({ ...prev, isOpen: false }))}
                classroomId={holidayAuditModalState.classroomId}
                classroomName={holidayAuditModalState.classroomName}
            />
        </div>
    );
}
