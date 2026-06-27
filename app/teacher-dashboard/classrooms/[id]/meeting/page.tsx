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
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string } | null>(null);
    const [classroomName, setClassroomName] = useState('');
    const [students, setStudents] = useState<SessionStudent[]>([]);

    // Step flow
    const [step, setStep] = useState<Step>(1);
    const [sessionType, setSessionType] = useState<SessionType | null>(null);
    const [sessionDate, setSessionDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [meetingLink, setMeetingLink] = useState('https://meet.google.com/abc-defg-hij');
    const isFirstRender = useRef(true);

    // Unified Hub states
    const [secondsElapsed, setSecondsElapsed] = useState(0);

    // ── Fetch classroom + enrolled students ──────────────────────────────────
    useEffect(() => {
        const init = async () => {
            try {
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (!session) { router.push('/login?type=teacher'); return; }

                const { data: profile } = await supabaseAuth
                    .from('users').select('id, name, email').eq('id', session.user.id).single();
                setTeacherProfile(profile);

                const { data: classroom } = await supabaseAuth
                    .from('classrooms').select('name, type').eq('id', classroomId).single();
                
                let roster: any[] = [];
                if (classroom) {
                    setClassroomName(classroom.name);

                    if (classroom.type === 'temporary') {
                        const { data: tempRoster } = await supabaseAuth
                            .from('session_student_overrides')
                            .select('student_id, users!student_id(name, profile_pic_url)')
                            .eq('target_classroom_id', classroomId);
                        roster = tempRoster || [];
                    } else {
                        const { data: permRoster } = await supabaseAuth
                            .from('classroom_students')
                            .select('student_id, users!student_id(name, profile_pic_url)')
                            .eq('classroom_id', classroomId);
                        const permList = permRoster || [];

                        const { data: overrideRoster } = await supabaseAuth
                            .from('session_student_overrides')
                            .select('student_id, users!student_id(name, profile_pic_url)')
                            .eq('target_classroom_id', classroomId)
                            .eq('override_date', sessionDate);
                        
                        const overrideList = (overrideRoster || []).map((row: any) => ({
                            ...row,
                            users: {
                                ...row.users,
                                name: `${row.users?.name || 'Unknown'} (Makeup)`
                            }
                        }));

                        roster = [...permList, ...overrideList];
                    }
                }

                const formatted: SessionStudent[] = (roster || []).map((r: any) => ({
                    id: r.student_id,
                    name: r.users?.name || 'Unknown',
                    profile_pic_url: r.users?.profile_pic_url || null,
                    attendance: null,
                }));

                // Fetch existing attendance for the selected date on load
                const { data: attendanceData } = await supabaseAuth
                    .from('attendance')
                    .select('student_id, status')
                    .eq('classroom_id', classroomId)
                    .eq('date', sessionDate);

                const recordsMap: Record<string, AttendanceStatus> = {};
                (attendanceData || []).forEach((row: any) => {
                    recordsMap[row.student_id] = row.status;
                });

                const withAttendance = formatted.map(s => ({
                    ...s,
                    attendance: recordsMap[s.id] || null
                }));

                setStudents(withAttendance);
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
                    const elapsed = Math.floor((Date.now() - activeSession.startedAt) / 1000);
                    setSecondsElapsed(elapsed > 0 ? elapsed : 0);
                    setStep(3);
                }
            } catch (e) {
                console.error('Failed to parse active session from localStorage:', e);
            }
        }
    }, [classroomId]);

    // ── Update attendance when date changes ──────────────────────────────
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        const updateAttendanceForDate = async () => {
            if (!classroomId || students.length === 0) return;
            try {
                const { data, error } = await supabaseAuth
                    .from('attendance')
                    .select('student_id, status')
                    .eq('classroom_id', classroomId)
                    .eq('date', sessionDate);

                if (error) throw error;

                const recordsMap: Record<string, AttendanceStatus> = {};
                (data || []).forEach((row: any) => {
                    recordsMap[row.student_id] = row.status;
                });

                setStudents(prev => prev.map(s => ({
                    ...s,
                    attendance: recordsMap[s.id] || null
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
        setStudents(prev => prev.map(s => s.id === studentId ? { ...s, attendance: status } : s));
    };

    const markAllPresent = () => {
        setStudents(prev => prev.map(s => ({ ...s, attendance: 'present' })));
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
        try {
            const rows = students.map(s => ({
                student_id: s.id,
                classroom_id: classroomId,
                date: sessionDate,
                status: (s.attendance || 'present').toLowerCase(),
                marked_by: teacherProfile.id,
            }));

            const { error } = await supabaseAuth
                .from('attendance')
                .upsert(rows, { onConflict: 'student_id, classroom_id, date' });

            if (error) throw error;

            // Mark classroom as live in DB
            const { error: liveError } = await supabaseAuth
                .from('classrooms')
                .update({
                    is_live: true,
                    live_meeting_link: sessionType === 'online' ? meetingLink : null,
                    live_session_started_at: new Date().toISOString()
                })
                .eq('id', classroomId);

            if (liveError) {
                console.error('Failed to mark classroom as live:', liveError);
            }

            // Trigger push & in-app notifications for students in this classroom
            const targetStudentIds = students.map(s => s.id);
            if (targetStudentIds.length > 0) {
                sendClassroomNotification({
                    teacherId: teacherProfile.id,
                    recipients: [{ id: classroomId, name: classroomName, type: 'class' }],
                    title: 'Class Started',
                    message: `The class session for "${classroomName}" has started.`,
                    studentIds: targetStudentIds
                }).catch(err => console.error('Failed to send classroom notifications:', err));
            }

            // Save active session info to localStorage for floating PIP widget support
            localStorage.setItem('active_class_session', JSON.stringify({
                classroomId,
                classroomName,
                sessionType: sessionType || 'online',
                sessionDate,
                startedAt: Date.now()
            }));

            setStep(3);
        } catch (err: any) {
            console.error('Error saving attendance:', err);
            alert(`Failed to save attendance: ${err.message || 'Please try again.'}`);
        } finally {
            setSavingAttendance(false);
        }
    };

    const endActiveSession = async () => {
        try {
            // Retrieve starting time from localStorage, fallback to elapsed calculation
            const activeSessionStr = localStorage.getItem('active_class_session');
            let startedAtTime = Date.now() - secondsElapsed * 1000;
            if (activeSessionStr) {
                try {
                    const parsed = JSON.parse(activeSessionStr);
                    if (parsed.startedAt) {
                        startedAtTime = parsed.startedAt;
                    }
                } catch (e) {
                    console.error('Error parsing startedAt from active session:', e);
                }
            }

            const endedAtTime = Date.now();
            const durationSecs = Math.max(1, Math.floor((endedAtTime - startedAtTime) / 1000));

            // Calculate attendance counts from the students state
            const present = students.filter(s => s.attendance === 'present').length;
            const absent = students.filter(s => s.attendance === 'absent').length;
            const late = students.filter(s => s.attendance === 'late').length;
            const excused = students.filter(s => s.attendance === 'excused').length;

            const logRow = {
                classroom_id: classroomId,
                session_date: sessionDate,
                session_type: sessionType || 'online',
                started_at: new Date(startedAtTime).toISOString(),
                ended_at: new Date(endedAtTime).toISOString(),
                duration_seconds: durationSecs,
                present_count: present,
                absent_count: absent,
                late_count: late,
                excused_count: excused
            };

            const { error } = await supabaseAuth
                .from('classroom_session_logs')
                .insert([logRow]);

            if (error) {
                console.error('Error saving session logs:', error);
                alert(`Failed to save classroom session log: ${error.message || 'Unknown error'}`);
            }

            // Mark classroom as no longer live in DB
            const { error: liveError } = await supabaseAuth
                .from('classrooms')
                .update({
                    is_live: false,
                    live_meeting_link: null,
                    live_session_started_at: null
                })
                .eq('id', classroomId);

            if (liveError) {
                console.error('Failed to mark classroom as no longer live:', liveError);
            }
        } catch (err: any) {
            console.error('Unexpected error ending active session:', err);
        } finally {
            localStorage.removeItem('active_class_session');
            router.push(`/teacher-dashboard/classrooms/${classroomId}`);
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
                                {students.map((student) => (
                                    <div key={student.id} className="py-4 first:pt-0 last:pb-0">
                                        <div className="flex items-center justify-between gap-4 flex-wrap md:flex-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-[#ecb613]/10 flex items-center justify-center border-2 border-white shadow-sm dark:border-slate-800 flex-shrink-0">
                                                    {student.profile_pic_url ? (
                                                        <img src={student.profile_pic_url} alt={student.name} className="w-full h-full rounded-full object-cover" />
                                                    ) : (
                                                        <span className="text-xs font-bold text-[#ecb613]">{student.name.charAt(0)}</span>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0 text-left">
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{student.name}</p>
                                                    {student.attendance === null && (
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
                                                    const isActive = student.attendance === opt.key;
                                                    return (
                                                        <button
                                                            key={opt.key}
                                                            onClick={() => markStudent(student.id, opt.key)}
                                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all duration-200 ${
                                                                isActive 
                                                                    ? opt.activeBg
                                                                    : `border ${opt.border} bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200`
                                                            }`}
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                ))}

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
