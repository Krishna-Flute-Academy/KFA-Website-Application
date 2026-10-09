'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabaseAuth } from '../../../../../src/lib/supabase-auth';
import {
    Loader2, ArrowLeft, Users, CheckCircle2,
    XCircle, AlertCircle, Clock, Video, Calendar
} from 'lucide-react';
import TeacherSidebar from '../../../../../src/components/TeacherSidebar';
import ClassroomDashboardPage from '../page';
import { sendClassroomNotification } from '../../../../../src/lib/notifications';
import { isStudentOperationallyActive } from '../../../../../src/lib/student-lifecycle';
import { CoveredAttendanceRecord, buildCoveredAttendanceMap } from '../../../../../src/lib/on-behalf-attendance';
import { startActiveClass, endActiveClass, isSessionAttendanceEnabled } from '../../../../../src/lib/class-session-lifecycle';
import { handleFeeBalanceTransitionNotifications } from '../../../../../src/lib/fee-notifications';
import { extractClassroomMetadata } from '../../../../../src/lib/meeting-utils';

// ─── Types ────────────────────────────────────────────────────────────────────
type SessionType = 'online' | 'offline';
type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | null;

interface SessionStudent {
    id: string;
    name: string;
    profile_pic_url: string | null;
    attendance: AttendanceStatus;
}

type Step = 1 | 2 | 3;

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MeetingPage() {
    const router = useRouter();
    const params = useParams();
    const classroomId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [savingAttendance, setSavingAttendance] = useState(false);
    const [isEnding, setIsEnding] = useState(false);
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string } | null>(null);
    const [classroomName, setClassroomName] = useState('');
    const [students, setStudents] = useState<SessionStudent[]>([]);
    const [coveredMap, setCoveredMap] = useState<Record<string, CoveredAttendanceRecord>>({});

    // Step flow
    const [step, setStep] = useState<Step>(1);
    const [sessionType, setSessionType] = useState<SessionType | null>(null);
    const [sessionDate, setSessionDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [meetingLink, setMeetingLink] = useState('');
    const isFirstRender = useRef(true);

    // Unified Hub states
    const [secondsElapsed, setSecondsElapsed] = useState(0);
    const [isLiveSession, setIsLiveSession] = useState(false);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

    // ── Fetch classroom + enrolled students ──────────────────────────────────
    useEffect(() => {
        const init = async () => {
            const t0 = performance.now();
            try {
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (!session) { router.push('/login?type=teacher'); return; }

                const [profileRes, classroomRes] = await Promise.all([
                    supabaseAuth.from('users').select('id, name, email').eq('id', session.user.id).single(),
                    supabaseAuth.from('classrooms').select('name, type, description, is_live, live_meeting_link, live_session_started_at, active_session_id').eq('id', classroomId).single()
                ]);

                setTeacherProfile(profileRes.data);
                const classroom = classroomRes.data;

                let roster: any[] = [];
                if (classroom) {
                    setClassroomName(classroom.name);

                    // Pre-fill meeting link and delivery format from metadata or active live session
                    const meta = extractClassroomMetadata(classroom.description);
                    if (meta.reusableMeetingLink) {
                        setMeetingLink(meta.reusableMeetingLink);
                    }
                    if (meta.deliveryFormat) {
                        setSessionType(meta.deliveryFormat);
                    }

                    // Fetch roster, overrides, pre-existing attendance, and covered alternative attendance concurrently
                    const [rosterRes, overrideRes, attendanceRes, coveredRes] = await Promise.all([
                        classroom.type === 'temporary'
                            ? supabaseAuth
                                .from('session_student_overrides')
                                .select('student_id, users!student_id(name, profile_pic_url, status)')
                                .eq('target_classroom_id', classroomId)
                            : supabaseAuth
                                .from('classroom_students')
                                .select('student_id, users!student_id(name, profile_pic_url, status)')
                                .eq('classroom_id', classroomId),
                        classroom.type !== 'temporary'
                            ? supabaseAuth
                                .from('session_student_overrides')
                                .select('student_id, users!student_id(name, profile_pic_url, status)')
                                .eq('target_classroom_id', classroomId)
                                .eq('override_date', sessionDate)
                            : Promise.resolve({ data: [] }),
                        supabaseAuth
                            .from('attendance')
                            .select('student_id, status')
                            .eq('classroom_id', classroomId)
                            .eq('date', sessionDate),
                        supabaseAuth
                            .from('attendance')
                            .select('id, student_id, classroom_id, date, status, on_behalf_of_date')
                            .eq('on_behalf_of_date', sessionDate)
                            .neq('date', sessionDate)
                            .in('status', ['present', 'late', 'absent', 'excused'])
                    ]);

                    const isLearningCircle = classroom.type === 'learning_circle';
                    if (classroom.type === 'temporary') {
                        const raw = rosterRes.data || [];
                        roster = isLearningCircle ? raw : raw.filter((r: any) => isStudentOperationallyActive(r.users?.status));
                    } else {
                        const rawPerm = rosterRes.data || [];
                        const permList = isLearningCircle ? rawPerm : rawPerm.filter((r: any) => isStudentOperationallyActive(r.users?.status));
                        const rawOverrides = overrideRes.data || [];
                        const filteredOverrides = isLearningCircle ? rawOverrides : rawOverrides.filter((r: any) => isStudentOperationallyActive(r.users?.status));
                        const overrideList = filteredOverrides.map((row: any) => ({
                            ...row,
                            users: {
                                ...row.users,
                                name: `${row.users?.name || 'Unknown'} (Makeup)`
                            }
                        }));
                        roster = [...permList, ...overrideList];
                    }

                    // Auto-restore step 3 if this classroom is already live in the database
                    if (classroom.is_live && classroom.live_session_started_at) {
                        setSessionType(classroom.live_meeting_link ? 'online' : 'offline');
                        
                        const liveDate = new Date(classroom.live_session_started_at);
                        const year = liveDate.getFullYear();
                        const month = String(liveDate.getMonth() + 1).padStart(2, '0');
                        const day = String(liveDate.getDate()).padStart(2, '0');
                        const activeDateStr = `${year}-${month}-${day}`;
                        setSessionDate(activeDateStr);
                        
                        if (classroom.live_meeting_link) {
                            setMeetingLink(classroom.live_meeting_link);
                        }
                        
                        const elapsed = Math.floor((Date.now() - new Date(classroom.live_session_started_at).getTime()) / 1000);
                        setSecondsElapsed(elapsed > 0 ? elapsed : 0);
                        setIsLiveSession(true);
                        if (classroom.active_session_id) {
                            setActiveSessionId(classroom.active_session_id);
                        }
                        setStep(3);

                        // Populate local storage for backup consistency
                        localStorage.setItem('active_class_session', JSON.stringify({
                            classroomId,
                            classroomName: classroom.name,
                            sessionType: classroom.live_meeting_link ? 'online' : 'offline',
                            sessionDate: activeDateStr,
                            sessionId: classroom.active_session_id || null,
                            startedAt: new Date(classroom.live_session_started_at).getTime()
                        }));
                    }

                    const loadedCoveredMap = buildCoveredAttendanceMap(coveredRes.data || [], sessionDate);
                    setCoveredMap(loadedCoveredMap);

                    const recordsMap: Record<string, AttendanceStatus> = {};
                    (attendanceRes.data || []).forEach((row: any) => {
                        recordsMap[row.student_id] = row.status;
                    });

                    const formatted: SessionStudent[] = (roster || []).map((r: any) => ({
                        id: r.student_id,
                        name: r.users?.name || 'Unknown',
                        profile_pic_url: r.users?.profile_pic_url || null,
                        attendance: loadedCoveredMap[r.student_id]
                            ? (loadedCoveredMap[r.student_id].status as AttendanceStatus)
                            : (recordsMap[r.student_id] || null),
                    }));

                    setStudents(formatted);
                }

                if (process.env.NODE_ENV !== 'production') {
                    console.log(`[Perf-MeetingInit] Initialized session in ${(performance.now() - t0).toFixed(1)}ms`);
                }
            } catch (err) {
                console.error('Error initializing session:', err);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [classroomId, router]);

    // Restore active session details from localStorage if present
    useEffect(() => {
        const activeSessionStr = localStorage.getItem('active_class_session');
        if (activeSessionStr) {
            try {
                const activeSession = JSON.parse(activeSessionStr);
                if (activeSession.classroomId === classroomId) {
                    setSessionType(activeSession.sessionType);
                    setSessionDate(activeSession.sessionDate);
                    if (activeSession.sessionId) {
                        setActiveSessionId(activeSession.sessionId);
                    }
                    const elapsed = Math.floor((Date.now() - activeSession.startedAt) / 1000);
                    setSecondsElapsed(elapsed > 0 ? elapsed : 0);
                    setStep(3);
                }
            } catch (e) {
                console.error('Failed to parse active session from localStorage:', e);
            }
        }
    }, [classroomId]);

    // Live session termination synchronization (listens to auto-end, other tabs, or sidebar)
    useEffect(() => {
        if (!classroomId) return;

        const handleEnded = (e: any) => {
            if (!e.detail?.classroomId || e.detail.classroomId === classroomId) {
                setIsLiveSession(false);
                router.push(`/teacher-dashboard/classrooms/${classroomId}`);
            }
        };

        window.addEventListener('class_session_ended', handleEnded);

        const channel = supabaseAuth
            .channel(`meeting-live-status-${classroomId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'classrooms', filter: `id=eq.${classroomId}` },
                (payload: any) => {
                    if (payload.new && !payload.new.is_live) {
                        setIsLiveSession(false);
                        router.push(`/teacher-dashboard/classrooms/${classroomId}`);
                    }
                }
            )
            .subscribe();

        return () => {
            window.removeEventListener('class_session_ended', handleEnded);
            supabaseAuth.removeChannel(channel);
        };
    }, [classroomId, router]);

    // ── Update attendance when date changes ──────────────────────────────
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        const updateAttendanceForDate = async () => {
            if (!classroomId || students.length === 0) return;
            try {
                const [attRes, coveredRes] = await Promise.all([
                    supabaseAuth
                        .from('attendance')
                        .select('student_id, status')
                        .eq('classroom_id', classroomId)
                        .eq('date', sessionDate),
                    supabaseAuth
                        .from('attendance')
                        .select('id, student_id, classroom_id, date, status, on_behalf_of_date')
                        .eq('on_behalf_of_date', sessionDate)
                        .neq('date', sessionDate)
                        .in('status', ['present', 'late', 'absent', 'excused'])
                ]);

                if (attRes.error) throw attRes.error;

                const dateCoveredMap = buildCoveredAttendanceMap(coveredRes.data || [], sessionDate);
                setCoveredMap(dateCoveredMap);

                const recordsMap: Record<string, AttendanceStatus> = {};
                (attRes.data || []).forEach((row: any) => {
                    recordsMap[row.student_id] = row.status;
                });

                setStudents(prev => prev.map(s => ({
                    ...s,
                    attendance: dateCoveredMap[s.id]
                        ? (dateCoveredMap[s.id].status as AttendanceStatus)
                        : (recordsMap[s.id] || null)
                })));
            } catch (err) {
                console.error('Error updating attendance for date:', err);
            }
        };

        updateAttendanceForDate();
    }, [sessionDate, classroomId]);

    // ── Class Timer Hook ──────────────────────────────────────────────────────
    useEffect(() => {
        if (step !== 3) return;
        const interval = setInterval(() => {
            setSecondsElapsed(prev => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [step]);

    // ── Attendance helpers ────────────────────────────────────────────────────
    const markStudent = (studentId: string, status: AttendanceStatus) => {
        if (coveredMap[studentId]) return;
        setStudents(prev => prev.map(s => {
            if (s.id === studentId) {
                const nextStatus = s.attendance === status ? null : status;
                return { ...s, attendance: nextStatus };
            }
            return s;
        }));
    };

    const unmarkStudent = (studentId: string) => {
        if (coveredMap[studentId]) return;
        setStudents(prev => prev.map(s => s.id === studentId ? { ...s, attendance: null } : s));
    };

    const markAllPresent = () => {
        setStudents(prev => prev.map(s => {
            if (coveredMap[s.id]) return s;
            return { ...s, attendance: 'present' };
        }));
    };

    const stats = useMemo(() => {
        const present = students.filter(s => s.attendance === 'present').length;
        const absent = students.filter(s => s.attendance === 'absent').length;
        const late = students.filter(s => s.attendance === 'late').length;
        const excused = students.filter(s => s.attendance === 'excused').length;
        const unmarked = students.filter(s => s.attendance === null || s.attendance === undefined).length;
        return { present, absent, late, excused, unmarked, total: students.length };
    }, [students]);

    const allMarked = stats.unmarked === 0;

    // ── Save attendance to DB ─────────────────────────────────────────────────
    const saveAttendance = async () => {
        if (!teacherProfile || !allMarked) return;
        setSavingAttendance(true);
        const t0 = performance.now();
        try {
            // Exclude covered students whose attendance belongs to the alternative date
            const rowsToUpsert = students
                .filter(s => s.attendance !== null && !coveredMap[s.id])
                .map(s => ({
                    student_id: s.id,
                    classroom_id: classroomId,
                    date: sessionDate,
                    status: s.attendance!.toLowerCase(),
                    marked_by: teacherProfile.id,
                }));

            const nullStudentIds = students
                .filter(s => s.attendance === null && !coveredMap[s.id])
                .map(s => s.id);

            // Step 1: Authoritative start of active class session (creates or retrieves database-backed session ID)
            const startResult = await startActiveClass({
                classroomId,
                classroomName,
                meetingLink: sessionType === 'online' ? meetingLink : null,
                sessionType: sessionType || 'online',
                sessionDate,
                startedAt: Date.now()
            });

            const effectiveSessionId = startResult.sessionId || activeSessionId || null;
            if (effectiveSessionId) {
                setActiveSessionId(effectiveSessionId);
            }

            // Safe rollout guard: Only pass non-null session_id if feature is active
            const sessionToSave = isSessionAttendanceEnabled() ? effectiveSessionId : null;

            // Step 2: Parallel execution of Attendance records and null student deletions
            const dbOps: Promise<any>[] = [];

            if (rowsToUpsert.length > 0) {
                dbOps.push(
                    (async () => {
                        const results = await Promise.all(
                            rowsToUpsert.map(row => 
                                supabaseAuth.rpc('save_attendance_record', {
                                    p_classroom_id: row.classroom_id,
                                    p_student_id: row.student_id,
                                    p_date: row.date,
                                    p_status: row.status,
                                    p_session_id: sessionToSave,
                                    p_on_behalf_of_date: null,
                                    p_is_extra_class: false,
                                    p_marked_by: row.marked_by
                                })
                            )
                        );
                        for (const res of results) {
                            if (res.error) throw res.error;
                        }
                    })()
                );
            }

            if (nullStudentIds.length > 0) {
                dbOps.push(
                    (async () => {
                        const { error } = await supabaseAuth
                            .from('attendance')
                            .delete()
                            .in('student_id', nullStudentIds)
                            .eq('classroom_id', classroomId)
                            .eq('date', sessionDate);
                        if (error) throw error;
                    })()
                );
            }

            await Promise.all(dbOps);

            if (process.env.NODE_ENV !== 'production') {
                console.log(`[Perf-StartClass] Session init (${effectiveSessionId}) & attendance save completed in ${(performance.now() - t0).toFixed(1)}ms`);
            }

            // Trigger push & in-app notifications for students in this classroom (non-blocking async)
            const wasAlreadyLive = isLiveSession;
            const targetStudentIds = students.map(s => s.id);
            if (!wasAlreadyLive && targetStudentIds.length > 0) {
                const isOnline = (sessionType || 'online') === 'online';
                const notifTitle = `Class Started: ${classroomName}`;
                const notifMessage = isOnline
                    ? `The online class for "${classroomName}" has started. Open your student classroom to join the live session.`
                    : `The class for "${classroomName}" has started.`;

                sendClassroomNotification({
                    teacherId: teacherProfile?.id,
                    recipients: [{ id: classroomId, name: classroomName, type: 'class' }],
                    title: notifTitle,
                    message: notifMessage,
                    studentIds: targetStudentIds,
                    type: 'live_class'
                }).catch(err => console.error('Failed to send classroom notifications:', err));
            }

            // Trigger idempotent fee balance transition check for marked students
            rowsToUpsert.forEach(r => {
                handleFeeBalanceTransitionNotifications({
                    studentId: r.student_id,
                    teacherId: teacherProfile?.id,
                    supabase: supabaseAuth
                }).catch(err => console.error('Error checking fee balance transition:', err));
            });

            setIsLiveSession(true);
            setStep(3);
        } catch (err: any) {
            console.error('Error saving attendance:', err);
            alert(`Failed to save attendance: ${err.message || 'Please try again.'}`);
        } finally {
            setSavingAttendance(false);
        }
    };

    const endActiveSession = async () => {
        if (isEnding) return;
        setIsEnding(true);
        const t0 = performance.now();
        try {
            // Retrieve starting time from localStorage, fallback to elapsed calculation
            const activeSessionStr = typeof window !== 'undefined' ? localStorage.getItem('active_class_session') : null;
            let startedAtTime = Date.now() - Math.max(0, secondsElapsed || 0) * 1000;
            if (activeSessionStr) {
                try {
                    const parsed = JSON.parse(activeSessionStr);
                    if (parsed.startedAt && !isNaN(parsed.startedAt)) {
                        startedAtTime = parsed.startedAt;
                    }
                } catch (e) {
                    console.error('Error parsing startedAt from active session:', e);
                }
            }

            const endedAtTime = Date.now();
            const durationSecs = Math.max(1, Math.floor((endedAtTime - startedAtTime) / 1000));
            const activeSessionDate = sessionDate || new Date().toISOString().split('T')[0];

            // Calculate attendance counts from the students state
            const present = students.filter(s => s.attendance === 'present').length;
            const absent = students.filter(s => s.attendance === 'absent').length;
            const late = students.filter(s => s.attendance === 'late').length;
            const excused = students.filter(s => s.attendance === 'excused').length;

            await endActiveClass({
                classroomId,
                sessionDate: activeSessionDate,
                sessionType: sessionType || 'online',
                startedAt: startedAtTime,
                endedAt: endedAtTime,
                durationSeconds: durationSecs,
                presentCount: present,
                absentCount: absent,
                lateCount: late,
                excusedCount: excused
            });

            if (process.env.NODE_ENV !== 'production') {
                console.log(`[Perf-EndClass] Active session ended in ${(performance.now() - t0).toFixed(1)}ms`);
            }

            setIsLiveSession(false);
            router.push(`/teacher-dashboard/classrooms/${classroomId}`);
        } catch (err: any) {
            console.error('Unexpected error ending active session:', err);
            alert(`Failed to end session: ${err.message || 'Unknown error'}`);
        } finally {
            setIsEnding(false);
        }
    };

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3 — UNIFIED ONGOING CLASS HUB (Online & Offline Dashboard Mirror)
    // ─────────────────────────────────────────────────────────────────────────
    if (step === 3) {
        return (
            <ClassroomDashboardPage
                isMeetingView={true}
                sessionType={sessionType || 'online'}
                sessionDate={sessionDate}
                secondsElapsed={secondsElapsed}
                onMinimizeSession={() => router.push(`/teacher-dashboard/classrooms/${classroomId}`)}
                onEndSession={endActiveSession}
            />
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Loading State
    // ─────────────────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex h-screen bg-[#f8f8f6] dark:bg-[#1a1608] font-sans">
                <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-10 h-10 animate-spin text-[#ecb613]" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-[#f8f8f6] dark:bg-[#1a1608] font-sans">
            <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

            <main className="flex-1 p-8 overflow-y-auto">
                <div className="max-w-4xl mx-auto space-y-8">
                    {/* Header */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(`/teacher-dashboard/classrooms/${classroomId}`)}
                            className="p-2 bg-white dark:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm"
                        >
                            <ArrowLeft size={16} />
                        </button>
                        <div>
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-left block">Flute Academy Session</span>
                            <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 text-left">{classroomName}</h1>
                        </div>
                    </div>

                    {/* STEP 1: Select Type & Date */}
                    {step === 1 && (
                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md p-8 space-y-6">
                            <div className="text-left">
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Start a New Class Session</h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Select meeting configuration to begin instruction</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button
                                    onClick={() => setSessionType('online')}
                                    className={`p-6 rounded-2xl border-2 text-left transition-all ${
                                        sessionType === 'online'
                                            ? 'border-[#ecb613] bg-[#ecb613]/5'
                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750'
                                    }`}
                                >
                                    <Video className="w-8 h-8 text-[#ecb613] mb-3" />
                                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Online Video Class</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Conduct class online. You can compose and broadcast a Google Meet URL directly to students during the session.</p>
                                </button>

                                <button
                                    onClick={() => setSessionType('offline')}
                                    className={`p-6 rounded-2xl border-2 text-left transition-all ${
                                        sessionType === 'offline'
                                            ? 'border-[#ecb613] bg-[#ecb613]/5'
                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750'
                                    }`}
                                >
                                    <Users className="w-8 h-8 text-[#ecb613] mb-3" />
                                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">In-Person Class</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Conduct local, in-person instruction. Ideal for monitoring physical posture and physical flute playing.</p>
                                </button>
                            </div>

                            <div className="space-y-2 text-left">
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-wide text-left">Session Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    <input
                                        type="date"
                                        value={sessionDate}
                                        onChange={(e) => setSessionDate(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#ecb613] outline-none"
                                    />
                                </div>
                            </div>

                            {sessionType === 'online' && (
                                <div className="space-y-2 text-left animate-in fade-in duration-300">
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wide text-left">Google Meet / Class Link</label>
                                    <div className="relative">
                                        <Video className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                        <input
                                            type="url"
                                            value={meetingLink}
                                            onChange={(e) => setMeetingLink(e.target.value)}
                                            placeholder="e.g. https://meet.google.com/abc-defg-hij"
                                            className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#ecb613] outline-none text-slate-800 dark:text-slate-100"
                                        />
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={() => setStep(2)}
                                disabled={!sessionType}
                                className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                                    sessionType
                                        ? 'bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                            >
                                Continue to Attendance <ArrowLeft className="rotate-180 w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* STEP 2: Attendance Check */}
                    {step === 2 && (
                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md p-8 space-y-6">
                            <div className="flex justify-between items-start flex-wrap gap-4">
                                <div className="text-left">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Step 2 of 2</span>
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">Pre-Session Attendance</h2>
                                    <p className="text-xs text-slate-500 mt-1">Mark student attendance before entering the active session hub</p>
                                </div>
                                <button
                                    onClick={markAllPresent}
                                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 transition-all flex items-center gap-1.5"
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Mark All Present
                                </button>
                            </div>

                            {/* Student roster listing */}
                            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[400px] overflow-y-auto pr-1">
                                {students.map((student) => {
                                    const coveredInfo = coveredMap[student.id];
                                    const isCoveredLocked = !!coveredInfo;
                                    const currentStatus = isCoveredLocked ? (coveredInfo.status as any) : student.attendance;
                                    return (
                                        <div key={student.id} className="py-4 first:pt-0 last:pb-0">
                                            <div 
                                                key={student.id} 
                                                onDoubleClick={() => {
                                                    if (isCoveredLocked) return;
                                                    if (student.attendance) {
                                                        unmarkStudent(student.id);
                                                    }
                                                }}
                                                title={isCoveredLocked ? `Attendance covered on ${coveredInfo.actualDate}` : (student.attendance ? "Double-click marked section to unmark attendance" : undefined)}
                                                className="flex items-center justify-between gap-4 flex-wrap md:flex-nowrap select-none"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-[#ecb613]/10 flex items-center justify-center border-2 border-white shadow-sm dark:border-slate-800 flex-shrink-0">
                                                        {student.profile_pic_url ? (
                                                            <img src={student.profile_pic_url} alt={student.name} className="w-full h-full rounded-full object-cover" />
                                                        ) : (
                                                            <span className="text-xs font-bold text-[#ecb613]">{student.name.charAt(0)}</span>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0 text-left">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{student.name}</p>
                                                            {isCoveredLocked && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                                                                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                                                    <span>Already counted on {coveredInfo.actualDate}</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                        {student.attendance === null && !isCoveredLocked && (
                                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">Not marked yet</p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Attendance buttons */}
                                                <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                                                    {([
                                                        { key: 'present', label: 'Present', color: 'emerald', border: 'border-emerald-200 dark:border-emerald-900/30', activeBg: 'bg-emerald-500 text-white shadow-md shadow-emerald-200 dark:shadow-none' },
                                                        { key: 'absent', label: 'Absent', color: 'rose', border: 'border-rose-200 dark:border-rose-900/30', activeBg: 'bg-rose-500 text-white shadow-md shadow-rose-200 dark:shadow-none' },
                                                        { key: 'late', label: 'Late', color: 'amber', border: 'border-amber-200 dark:border-amber-900/30', activeBg: 'bg-amber-500 text-white shadow-md shadow-amber-200 dark:shadow-none' },
                                                        { key: 'excused', label: 'Excused', color: 'slate', border: 'border-slate-200 dark:border-slate-700', activeBg: 'bg-slate-600 text-white shadow-md shadow-slate-200 dark:shadow-none' }
                                                    ] as const).map(opt => {
                                                        const isActive = currentStatus === opt.key;
                                                        return (
                                                            <button
                                                                key={opt.key}
                                                                disabled={isCoveredLocked}
                                                                title={isCoveredLocked ? `Attendance covered on ${coveredInfo.actualDate}` : (isActive ? "Double-click or click to unmark attendance" : `Mark as ${opt.label}`)}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (isCoveredLocked) return;
                                                                    markStudent(student.id, opt.key);
                                                                }}
                                                                onDoubleClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (isCoveredLocked) return;
                                                                    unmarkStudent(student.id);
                                                                }}
                                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all duration-200 ${
                                                                    isCoveredLocked
                                                                        ? (isActive 
                                                                            ? `${opt.activeBg} opacity-85 cursor-not-allowed` 
                                                                            : `border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-600 opacity-40 cursor-not-allowed`)
                                                                        : (isActive 
                                                                            ? `${opt.activeBg} cursor-pointer`
                                                                            : `border ${opt.border} bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer`)
                                                                }`}
                                                            >
                                                                {opt.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {students.length === 0 && (
                                    <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                                        <Users className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No students enrolled in this classroom yet.</p>
                                    </div>
                                )}
                            </div>

                            {/* Submit */}
                            <div className="sticky bottom-0 pb-2 pt-4 bg-white dark:bg-slate-900">
                                <button
                                    onClick={saveAttendance}
                                    disabled={!allMarked || savingAttendance || students.length === 0}
                                    className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-3 transition-all shadow-lg ${
                                        allMarked && students.length > 0
                                            ? 'bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900 shadow-[#ecb613]/25'
                                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    }`}
                                >
                                    {savingAttendance ? (
                                        <><Loader2 className="w-5 h-5 animate-spin" /> Saving Attendance...</>
                                    ) : sessionType === 'online' ? (
                                        <><Clock className="w-5 h-5" /> Save Attendance & Start Video Session</>
                                    ) : (
                                        <><Clock className="w-5 h-5" /> Save Attendance & Begin In-Person Session</>
                                    )}
                                </button>
                                {!allMarked && students.length > 0 && (
                                    <p className="text-center text-xs text-slate-400 mt-2 font-semibold">
                                        Mark all {stats.unmarked} remaining student{stats.unmarked !== 1 ? 's' : ''} before continuing.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
