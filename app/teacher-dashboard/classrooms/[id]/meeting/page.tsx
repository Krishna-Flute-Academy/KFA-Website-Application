'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabaseAuth } from '../../../../../src/lib/supabase-auth';
import {
    Loader2, ArrowLeft, LogOut, Wifi, WifiOff, Users, CheckCircle2,
    XCircle, AlertCircle, ChevronRight, Check, Clock, BookOpen, Music,
    ChevronLeft, Calendar
} from 'lucide-react';
import TeacherSidebar from '../../../../../src/components/TeacherSidebar';

declare global {
    interface Window { JitsiMeetExternalAPI: any; }
}

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
    const jitsiContainerRef = useRef<HTMLDivElement>(null);

    const [jitsiApi, setJitsiApi] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [savingAttendance, setSavingAttendance] = useState(false);
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string } | null>(null);
    const [classroomName, setClassroomName] = useState('');
    const [students, setStudents] = useState<SessionStudent[]>([]);

    // Step flow
    const [step, setStep] = useState<Step>(1);
    const [sessionType, setSessionType] = useState<SessionType | null>(null);
    const [sessionDate, setSessionDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const isFirstRender = useRef(true);

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
                    .from('classrooms').select('name').eq('id', classroomId).single();
                if (classroom) setClassroomName(classroom.name);

                const { data: roster } = await supabaseAuth
                    .from('classroom_students')
                    .select('student_id, users!student_id(name, profile_pic_url)')
                    .eq('classroom_id', classroomId);

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

    // ── Launch Jitsi after attendance is submitted (online only) ─────────────
    useEffect(() => {
        if (step !== 3 || sessionType !== 'online' || !teacherProfile || jitsiApi) return;

        const script = document.createElement('script');
        script.src = 'https://meet.jit.si/external_api.js';
        script.async = true;
        script.onload = () => {
            if (!jitsiContainerRef.current) return;
            const newApi = new window.JitsiMeetExternalAPI('meet.jit.si', {
                roomName: `KFA_Academy_Class_${classroomId}`,
                width: '100%',
                height: '100%',
                parentNode: jitsiContainerRef.current,
                userInfo: { email: teacherProfile.email, displayName: `${teacherProfile.name} (Teacher)` },
                configOverwrite: {
                    startWithAudioMuted: false, startWithVideoMuted: false,
                    prejoinPageEnabled: false, enableWelcomePage: false, enableClosePage: false,
                },
                interfaceConfigOverwrite: {
                    TOOLBAR_BUTTONS: [
                        'microphone', 'camera', 'desktop', 'fullscreen', 'hangup',
                        'chat', 'recording', 'raisehand', 'tileview', 'settings',
                    ],
                },
            });
            setJitsiApi(newApi);
            newApi.addEventListeners({ readyToClose: () => router.push(`/teacher-dashboard/classrooms/${classroomId}`) });
        };
        document.body.appendChild(script);
        return () => {
            if (jitsiApi) jitsiApi.dispose();
            try { document.body.removeChild(script); } catch (_) {}
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, sessionType]);

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
            setStep(3);
        } catch (err: any) {
            console.error('Error saving attendance:', err);
            alert(`Failed to save attendance: ${err.message || 'Please try again.'}`);
        } finally {
            setSavingAttendance(false);
        }
    };

    const handleLogout = async () => {
        if (jitsiApi) jitsiApi.dispose();
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    // ── Loading ───────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8f8f6]">
                <Loader2 className="w-10 h-10 animate-spin text-[#ecb613] mb-4" />
                <p className="font-medium text-slate-600 tracking-wide uppercase text-xs">Setting up session…</p>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3 — ONLINE: Full-screen Jitsi
    // ─────────────────────────────────────────────────────────────────────────
    if (step === 3 && sessionType === 'online') {
        return (
            <div className="flex h-screen bg-slate-900 overflow-hidden text-white font-sans">
                <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />
                <main className="flex-1 flex flex-col min-w-0 relative">
                    <header className="h-14 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-6 z-10 flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 px-3 py-1.5 rounded-full">
                                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                <span className="text-xs font-bold text-green-400 uppercase tracking-wider">Live Online</span>
                            </div>
                            <h2 className="text-sm font-bold text-white">{classroomName}</h2>
                        </div>
                        <button
                            onClick={() => { if (jitsiApi) jitsiApi.dispose(); router.push(`/teacher-dashboard/classrooms/${classroomId}`); }}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-2 shadow-lg"
                        >
                            <LogOut size={14} /> End Session
                        </button>
                    </header>
                    <div className="flex-1 relative bg-black">
                        <div ref={jitsiContainerRef} className="absolute inset-0 w-full h-full" />
                        {!jitsiApi && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-[#ecb613]" />
                            </div>
                        )}
                    </div>
                </main>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3 — OFFLINE: Session-in-progress dashboard
    // ─────────────────────────────────────────────────────────────────────────
    if (step === 3 && sessionType === 'offline') {
        return (
            <div className="flex min-h-screen bg-[#f8f8f6] font-sans">
                <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />
                <main className="flex-1 flex flex-col">
                    <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-8 flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <button onClick={() => router.push(`/teacher-dashboard/classrooms/${classroomId}`)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                                <ArrowLeft size={18} />
                            </button>
                            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-full">
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Offline Session In Progress</span>
                            </div>
                            <span className="text-sm font-bold text-slate-800">{classroomName}</span>
                        </div>
                        <button
                            onClick={() => router.push(`/teacher-dashboard/classrooms/${classroomId}`)}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-2"
                        >
                            <LogOut size={14} /> End Session
                        </button>
                    </header>

                    <div className="p-8 max-w-4xl mx-auto w-full space-y-6">
                        {/* Attendance summary */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {[
                                { label: 'Total', value: stats.total, color: 'bg-slate-100 text-slate-700', icon: <Users className="w-5 h-5" /> },
                                { label: 'Present', value: stats.present, color: 'bg-emerald-50 text-emerald-700 border border-emerald-100', icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" /> },
                                { label: 'Absent', value: stats.absent, color: 'bg-rose-50 text-rose-700 border border-rose-100', icon: <XCircle className="w-5 h-5 text-rose-500" /> },
                                { label: 'Late', value: stats.late, color: 'bg-amber-50 text-amber-700 border border-amber-100', icon: <Clock className="w-5 h-5 text-amber-500" /> },
                                { label: 'Excused', value: stats.excused, color: 'bg-indigo-50 text-indigo-700 border border-indigo-150', icon: <AlertCircle className="w-5 h-5 text-indigo-500" /> },
                            ].map(c => (
                                <div key={c.label} className={`${c.color} rounded-2xl p-5 flex flex-col gap-2`}>
                                    {c.icon}
                                    <p className="text-xs font-bold uppercase tracking-wider opacity-70">{c.label}</p>
                                    <p className="text-3xl font-black">{c.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Roster summary */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                                <BookOpen className="w-5 h-5 text-[#ecb613]" />
                                <h3 className="font-bold text-slate-900">Attendance Summary</h3>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {students.map(s => (
                                    <div key={s.id} className="flex items-center gap-4 px-6 py-3">
                                        <div className="w-9 h-9 rounded-full bg-[#ecb613]/10 flex items-center justify-center flex-shrink-0">
                                            {s.profile_pic_url
                                                ? <img src={s.profile_pic_url} alt={s.name} className="w-full h-full rounded-full object-cover" />
                                                : <span className="text-sm font-bold text-[#ecb613]">{s.name.charAt(0)}</span>
                                            }
                                        </div>
                                        <span className="flex-1 text-sm font-semibold text-slate-800">{s.name}</span>
                                        {s.attendance === 'present' && <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full">Present</span>}
                                        {s.attendance === 'absent' && <span className="px-2.5 py-1 bg-rose-50 text-rose-700 text-xs font-bold rounded-full">Absent</span>}
                                        {s.attendance === 'late' && <span className="px-2.5 py-1 bg-amber-50 text-amber-705 text-xs font-bold rounded-full">Late</span>}
                                        {s.attendance === 'excused' && <span className="px-2.5 py-1 bg-slate-150 text-slate-700 text-xs font-bold rounded-full">Excused</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1 + 2 — Setup flow (shared layout)
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="flex min-h-screen bg-[#f8f8f6] font-sans">
            <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

            <main className="flex-1 flex flex-col">
                {/* Header */}
                <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-8 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => step === 1 ? router.push(`/teacher-dashboard/classrooms/${classroomId}`) : setStep(1)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <h2 className="text-sm font-bold text-slate-900">{classroomName}</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {step === 1 ? 'Session Setup' : 'Attendance'}
                            </p>
                        </div>
                    </div>

                    {/* Step indicator */}
                    <div className="flex items-center gap-2">
                        {[
                            { n: 1, label: 'Session Type' },
                            { n: 2, label: 'Attendance' },
                            { n: 3, label: 'Start' },
                        ].map((s, i) => (
                            <React.Fragment key={s.n}>
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                                    step === s.n
                                        ? 'bg-[#ecb613] text-slate-900'
                                        : step > s.n
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-slate-100 text-slate-400'
                                }`}>
                                    {step > s.n ? <Check className="w-3 h-3" /> : <span>{s.n}</span>}
                                    <span className="hidden sm:inline">{s.label}</span>
                                </div>
                                {i < 2 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
                            </React.Fragment>
                        ))}
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8">
                    {/* ═══════════════════════════════════════════════════════
                        STEP 1 — Choose session type
                    ═══════════════════════════════════════════════════════ */}
                    {step === 1 && (
                        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="text-center mb-8">
                                <div className="w-14 h-14 rounded-2xl bg-[#ecb613]/10 flex items-center justify-center mx-auto mb-4">
                                    <Music className="w-7 h-7 text-[#ecb613]" />
                                </div>
                                <h1 className="text-2xl font-extrabold text-slate-900">Start a Session</h1>
                                <p className="text-slate-500 text-sm mt-1">Choose the type of session before taking attendance.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Online */}
                                <button
                                    onClick={() => { setSessionType('online'); setStep(2); }}
                                    className="group relative flex flex-col items-center gap-5 p-8 bg-white border-2 border-slate-200 hover:border-[#ecb613] rounded-2xl shadow-sm hover:shadow-lg transition-all text-left"
                                >
                                    <div className="w-16 h-16 rounded-2xl bg-blue-50 group-hover:bg-[#ecb613]/10 flex items-center justify-center transition-colors shadow-sm">
                                        <Wifi className="w-8 h-8 text-blue-500 group-hover:text-[#ecb613] transition-colors" />
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-lg font-extrabold text-slate-900 group-hover:text-[#ecb613] transition-colors">Online Session</h3>
                                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">Take attendance first, then launch the video call with your students.</p>
                                    </div>
                                    <span className="absolute top-4 right-4 text-[10px] font-bold bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full uppercase tracking-wider">Video</span>
                                </button>

                                {/* Offline */}
                                <button
                                    onClick={() => { setSessionType('offline'); setStep(2); }}
                                    className="group relative flex flex-col items-center gap-5 p-8 bg-white border-2 border-slate-200 hover:border-[#ecb613] rounded-2xl shadow-sm hover:shadow-lg transition-all text-left"
                                >
                                    <div className="w-16 h-16 rounded-2xl bg-amber-50 group-hover:bg-[#ecb613]/10 flex items-center justify-center transition-colors shadow-sm">
                                        <WifiOff className="w-8 h-8 text-amber-500 group-hover:text-[#ecb613] transition-colors" />
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-lg font-extrabold text-slate-900 group-hover:text-[#ecb613] transition-colors">Offline Session</h3>
                                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">In-person class. Take attendance and track the session without video.</p>
                                    </div>
                                    <span className="absolute top-4 right-4 text-[10px] font-bold bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full uppercase tracking-wider">In-Person</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ═══════════════════════════════════════════════════════
                        STEP 2 — Bulk Attendance
                    ═══════════════════════════════════════════════════════ */}
                    {step === 2 && (
                        <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            {/* Header + bulk actions */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-extrabold text-slate-900">Take Attendance</h2>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {sessionType === 'online' ? '🔵 Online Session' : '🟡 Offline Session'} · {stats.total} students
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={markAllPresent}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                                    >
                                        <CheckCircle2 className="w-4 h-4" /> Mark All Present
                                    </button>
                                </div>
                            </div>

                            {/* Date Navigation / Selector */}
                            <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                                        <Calendar className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Attendance Date</p>
                                        <p className="text-xs text-slate-500 mt-0.5">Marking session records for this specific date.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100 self-end sm:self-auto">
                                    <button 
                                        onClick={() => {
                                            const prev = new Date(sessionDate);
                                            prev.setDate(prev.getDate() - 1);
                                            setSessionDate(prev.toISOString().split('T')[0]);
                                        }}
                                        className="p-2 hover:bg-white rounded-lg text-slate-500 hover:text-slate-900 transition-all shadow-sm"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <input 
                                        type="date" 
                                        value={sessionDate}
                                        onChange={(e) => setSessionDate(e.target.value)}
                                        className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 outline-none px-2 text-center w-36"
                                    />
                                    <button 
                                        onClick={() => {
                                            const next = new Date(sessionDate);
                                            next.setDate(next.getDate() + 1);
                                            setSessionDate(next.toISOString().split('T')[0]);
                                        }}
                                        className="p-2 hover:bg-white rounded-lg text-slate-500 hover:text-slate-900 transition-all shadow-sm"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => setSessionDate(new Date().toISOString().split('T')[0])}
                                        className="px-3 py-1.5 bg-white text-xs font-bold text-slate-600 rounded-lg hover:bg-slate-100 transition-all border border-slate-200 shadow-sm"
                                    >
                                        Today
                                    </button>
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                                <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                                    <span>{stats.total - stats.unmarked} / {stats.total} marked</span>
                                    <span className={stats.unmarked === 0 ? 'text-emerald-600' : 'text-slate-400'}>
                                        {stats.unmarked === 0 ? '✓ All marked' : `${stats.unmarked} remaining`}
                                    </span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                    <div
                                        className="h-full bg-[#ecb613] rounded-full transition-all duration-500"
                                        style={{ width: `${stats.total > 0 ? ((stats.total - stats.unmarked) / stats.total) * 100 : 0}%` }}
                                    />
                                </div>
                                <div className="flex items-center gap-4 mt-3 text-[11px] font-bold">
                                    <span className="text-emerald-600">✓ {stats.present} Present</span>
                                    <span className="text-rose-600">✗ {stats.absent} Absent</span>
                                    <span className="text-amber-600">⚠ {stats.late} Late</span>
                                    <span className="text-slate-600">ℹ {stats.excused} Excused</span>
                                </div>
                            </div>

                            {/* Student cards */}
                            <div className="space-y-3">
                                {students.map(student => (
                                    <div
                                        key={student.id}
                                        className={`bg-white rounded-2xl border-2 transition-all shadow-sm overflow-hidden ${
                                            student.attendance === 'present'
                                                ? 'border-emerald-300 bg-emerald-50/30'
                                                : student.attendance === 'absent'
                                                ? 'border-rose-300 bg-rose-50/30'
                                                : student.attendance === 'late'
                                                ? 'border-amber-300 bg-amber-50/30'
                                                : student.attendance === 'excused'
                                                ? 'border-slate-300 bg-slate-50/30'
                                                : 'border-slate-200'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-4 p-4 flex-wrap sm:flex-nowrap">
                                            <div className="flex items-center gap-4 min-w-0">
                                                {/* Avatar */}
                                                <div className="w-11 h-11 rounded-full bg-[#ecb613]/10 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-white shadow-sm">
                                                    {student.profile_pic_url
                                                        ? <img src={student.profile_pic_url} alt={student.name} className="w-full h-full object-cover" />
                                                        : <span className="text-base font-bold text-[#ecb613]">{student.name.charAt(0)}</span>
                                                    }
                                                </div>

                                                {/* Name */}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-slate-900 truncate">{student.name}</p>
                                                    {student.attendance === null && (
                                                        <p className="text-[10px] text-slate-400 font-semibold">Not marked yet</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Attendance buttons */}
                                            <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                                                {([
                                                    { key: 'present', label: 'Present', color: 'emerald', border: 'border-emerald-200', activeBg: 'bg-emerald-500 text-white shadow-md shadow-emerald-200' },
                                                    { key: 'absent', label: 'Absent', color: 'rose', border: 'border-rose-200', activeBg: 'bg-rose-500 text-white shadow-md shadow-rose-200' },
                                                    { key: 'late', label: 'Late', color: 'amber', border: 'border-amber-200', activeBg: 'bg-amber-500 text-white shadow-md shadow-amber-200' },
                                                    { key: 'excused', label: 'Excused', color: 'slate', border: 'border-slate-200', activeBg: 'bg-slate-600 text-white shadow-md shadow-slate-200' }
                                                ] as const).map(opt => {
                                                    const isActive = student.attendance === opt.key;
                                                    return (
                                                        <button
                                                            key={opt.key}
                                                            onClick={() => markStudent(student.id, opt.key)}
                                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all duration-200 ${
                                                                isActive 
                                                                    ? opt.activeBg
                                                                    : `border ${opt.border} bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50`
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
                                    <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                                        <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                        <p className="text-sm font-semibold text-slate-500">No students enrolled in this classroom yet.</p>
                                    </div>
                                )}
                            </div>

                            {/* Submit */}
                            <div className="sticky bottom-0 pb-2 pt-4 bg-[#f8f8f6]">
                                <button
                                    onClick={saveAttendance}
                                    disabled={!allMarked || savingAttendance || students.length === 0}
                                    className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition-all shadow-lg ${
                                        allMarked && students.length > 0
                                            ? 'bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900 shadow-[#ecb613]/25'
                                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    }`}
                                >
                                    {savingAttendance ? (
                                        <><Loader2 className="w-5 h-5 animate-spin" /> Saving Attendance…</>
                                    ) : sessionType === 'online' ? (
                                        <><Clock className="w-5 h-5" /> Save Attendance & Start Video Session</>
                                    ) : (
                                        <><Clock className="w-5 h-5" /> Save Attendance & Begin Offline Session</>
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
