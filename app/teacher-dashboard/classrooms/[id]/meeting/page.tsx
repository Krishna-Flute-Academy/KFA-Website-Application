'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabaseAuth } from '../../../../../src/lib/supabase-auth';
import {
    Loader2, ArrowLeft, LogOut, Wifi, WifiOff, Users, CheckCircle2,
    XCircle, AlertCircle, ChevronRight, Check, Clock, BookOpen, Music,
    ChevronLeft, Calendar, Lightbulb, Video, Send, FileText, MessageSquare,
    Clipboard, Share2
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

    // Unified Hub states
    const [activeTab, setActiveTab] = useState<'attendance' | 'messages' | 'assignments' | 'curriculum'>('attendance');
    const [secondsElapsed, setSecondsElapsed] = useState(0);
    
    // Broadcast composer states
    const [messageSubject, setMessageSubject] = useState('');
    const [messageContent, setMessageContent] = useState('');
    const [isSendingMessage, setIsSendingMessage] = useState(false);
    const [classBroadcasts, setClassBroadcasts] = useState<any[]>([]);

    // Assignment composer states
    const [assignmentTitle, setAssignmentTitle] = useState('');
    const [assignmentDesc, setAssignmentDesc] = useState('');
    const [assignmentDueDate, setAssignmentDueDate] = useState('');
    const [isAssigningTask, setIsAssigningTask] = useState(false);
    const [classAssignments, setClassAssignments] = useState<any[]>([]);

    // Curriculum Class Log state
    const [classLog, setClassLog] = useState('');
    const [isSavingLog, setIsSavingLog] = useState(false);

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

    // ── Launch Jitsi (DISABLED as requested by user) ──────────────────────────
    useEffect(() => {
        if (true) return; // Jitsi disabled. Meet URL shared via message.
    }, [step, sessionType]);

    // ── Class Timer Hook ──────────────────────────────────────────────────────
    useEffect(() => {
        if (step !== 3) return;
        const interval = setInterval(() => {
            setSecondsElapsed(prev => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [step]);

    const formatDuration = (sec: number) => {
        const mins = Math.floor(sec / 60);
        const secs = sec % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Prefill broadcast subject once classroom name is loaded
    useEffect(() => {
        if (classroomName && !messageSubject) {
            setMessageSubject(`Live Session Announcement - ${classroomName}`);
        }
    }, [classroomName, messageSubject]);

    // ── Live attendance update during active session ──────────────────────────
    const handleLiveAttendanceUpdate = async (studentId: string, status: AttendanceStatus) => {
        if (!teacherProfile) return;
        // Optimistically update local state
        setStudents(prev => prev.map(s => s.id === studentId ? { ...s, attendance: status } : s));
        try {
            const row = {
                student_id: studentId,
                classroom_id: classroomId,
                date: sessionDate,
                status: (status || 'present').toLowerCase(),
                marked_by: teacherProfile.id
            };
            const { error } = await supabaseAuth
                .from('attendance')
                .upsert(row, { onConflict: 'student_id, classroom_id, date' });
            if (error) throw error;
        } catch (err) {
            console.error('Failed to update attendance live:', err);
        }
    };

    // ── Broadcast message to class ────────────────────────────────────────────
    const handleSendClassMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageContent.trim() || !teacherProfile) return;
        setIsSendingMessage(true);
        try {
            const payload = {
                teacher_id: teacherProfile.id,
                channel: 'classroom',
                recipients: [{ id: classroomId, name: classroomName, type: 'class' }],
                subject: messageSubject.trim() || `Class Update - ${classroomName}`,
                content: messageContent.trim(),
                created_at: new Date().toISOString()
            };
            const { data, error } = await supabaseAuth
                .from('broadcasts')
                .insert(payload)
                .select();
            if (error) throw error;
            
            if (data && data.length > 0) {
                setClassBroadcasts(prev => [data[0], ...prev]);
            }
            setMessageContent('');
            alert('Message successfully broadcast to all students in this class!');
        } catch (err: any) {
            console.error('Error broadcasting message:', err);
            alert(`Failed to send message: ${err.message}`);
        } finally {
            setIsSendingMessage(false);
        }
    };

    // ── Create quick class assignment inline ─────────────────────────────────
    const handleQuickAssignTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assignmentTitle.trim() || !assignmentDesc.trim() || !teacherProfile) {
            alert('Please fill in title and instruction details.');
            return;
        }
        setIsAssigningTask(true);
        try {
            const insertData = {
                classroom_id: classroomId,
                teacher_id: teacherProfile.id,
                title: assignmentTitle.trim(),
                description: assignmentDesc.trim(),
                due_date: assignmentDueDate || null,
                target_type: 'all',
                created_at: new Date().toISOString()
            };
            
            const { data: newAsg, error: asgErr } = await supabaseAuth
                .from('assignments')
                .insert(insertData)
                .select()
                .single();
                
            if (asgErr) throw asgErr;
            
            if (students.length > 0 && newAsg) {
                const studentMappings = students.map(student => ({
                    assignment_id: newAsg.id,
                    student_id: student.id,
                    status: 'pending'
                }));
                const { error: mappingErr } = await supabaseAuth
                    .from('assignment_students')
                    .insert(studentMappings);
                    
                if (mappingErr) throw mappingErr;
            }
            
            if (newAsg) {
                setClassAssignments(prev => [newAsg, ...prev]);
            }
            setAssignmentTitle('');
            setAssignmentDesc('');
            setAssignmentDueDate('');
            alert('Task assigned successfully to all class students!');
        } catch (err: any) {
            console.error('Failed to assign task:', err);
            alert(`Failed to assign task: ${err.message}`);
        } finally {
            setIsAssigningTask(false);
        }
    };

    // ── Load historical session data when entering Step 3 ───────────────────
    useEffect(() => {
        if (step !== 3 || !teacherProfile) return;
        const loadSessionData = async () => {
            try {
                // 1. Fetch broadcasts for this class
                const { data: broadcastsData } = await supabaseAuth
                    .from('broadcasts')
                    .select('*')
                    .eq('teacher_id', teacherProfile.id)
                    .order('created_at', { ascending: false });
                
                if (broadcastsData) {
                    const classroomBroads = broadcastsData.filter((b: any) => 
                        Array.isArray(b.recipients) && b.recipients.some((r: any) => r.id === classroomId)
                    );
                    setClassBroadcasts(classroomBroads);
                }

                // 2. Fetch active assignments
                const { data: asgData } = await supabaseAuth
                    .from('assignments')
                    .select('*')
                    .eq('classroom_id', classroomId)
                    .order('created_at', { ascending: false });
                
                if (asgData) {
                    setClassAssignments(asgData);
                }

                // 3. Restore class logs
                const savedLog = localStorage.getItem(`kfa_class_log_${classroomId}_${sessionDate}`);
                if (savedLog) {
                    setClassLog(savedLog);
                }
            } catch (e) {
                console.error('Failed to load live session dashboard history:', e);
            }
        };
        loadSessionData();
    }, [step, teacherProfile, classroomId, sessionDate]);

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
        await supabaseAuth.auth.signOut();
        router.push('/');
    };
       // ─────────────────────────────────────────────────────────────────────────
    // STEP 3 — UNIFIED ONGOING CLASS HUB (Online & Offline)
    // ─────────────────────────────────────────────────────────────────────────
    if (step === 3) {
        return (
            <div className="flex min-h-screen bg-[#f8f8f6] dark:bg-[#1a1608] font-sans">
                <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />
                
                <main className="flex-1 flex flex-col min-w-0">
                    {/* Header */}
                    <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between px-8 py-4 gap-4 flex-shrink-0 shadow-sm">
                        <div className="flex items-center gap-3">
                            <button onClick={() => router.push(`/teacher-dashboard/classrooms/${classroomId}`)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-705 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <ArrowLeft size={18} />
                            </button>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Active Class Session</span>
                                    {sessionType === 'online' ? (
                                        <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded-full">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Live Online</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">In-Person</span>
                                        </div>
                                    )}
                                </div>
                                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">{classroomName}</h2>
                            </div>
                        </div>

                        {/* Live Timer and End Session */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-850 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800">
                                <Clock className="w-4 h-4 text-[#ecb613] animate-spin" style={{ animationDuration: '6s' }} />
                                <div className="text-xs">
                                    <span className="text-slate-400 font-medium mr-1">Session Duration:</span>
                                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{formatDuration(secondsElapsed)}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => router.push(`/teacher-dashboard/classrooms/${classroomId}`)}
                                className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-red-200 dark:shadow-none hover:scale-[1.02] active:scale-98"
                            >
                                <LogOut size={14} /> End Active Class
                            </button>
                        </div>
                    </header>

                    {/* Navigation Tabs */}
                    <div className="px-8 pt-6 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-850">
                        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-850">
                            {[
                                { id: 'attendance', label: 'Attendance & Roster', icon: <Users size={16} /> },
                                { id: 'messages', label: 'Class Message / Meet Link', icon: <MessageSquare size={16} /> },
                                { id: 'assignments', label: 'Quick Assignment', icon: <FileText size={16} /> },
                                { id: 'curriculum', label: 'Curriculum Log', icon: <BookOpen size={16} /> }
                            ].map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setActiveTab(t.id as any)}
                                    className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all -mb-px ${
                                        activeTab === t.id
                                            ? 'border-[#ecb613] text-[#92400e] dark:text-[#ecb613] bg-white dark:bg-slate-900 rounded-t-xl'
                                            : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 bg-transparent'
                                    }`}
                                >
                                    {t.icon}
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 p-8 overflow-y-auto">
                        <div className="max-w-6xl mx-auto w-full space-y-6">
                            
                            {/* TAB 1: ATTENDANCE & ROSTER */}
                            {activeTab === 'attendance' && (
                                <div className="space-y-6 animate-fadeIn">
                                    {/* Stats grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                        {[
                                            { label: 'Total', value: stats.total, color: 'bg-slate-105 dark:bg-slate-800 text-slate-700 dark:text-slate-300', icon: <Users className="w-5 h-5" /> },
                                            { label: 'Present', value: stats.present, color: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30', icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" /> },
                                            { label: 'Absent', value: stats.absent, color: 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30', icon: <XCircle className="w-5 h-5 text-rose-500" /> },
                                            { label: 'Late', value: stats.late, color: 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30', icon: <Clock className="w-5 h-5 text-amber-500" /> },
                                            { label: 'Excused', value: stats.excused, color: 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30', icon: <AlertCircle className="w-5 h-5 text-indigo-500" /> },
                                        ].map(c => (
                                            <div key={c.label} className={`${c.color} rounded-2xl p-5 flex flex-col gap-2 shadow-sm transition-all hover:scale-[1.02]`}>
                                                {c.icon}
                                                <p className="text-xs font-bold uppercase tracking-wider opacity-70">{c.label}</p>
                                                <p className="text-3xl font-black">{c.value}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Roster list */}
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <BookOpen className="w-5 h-5 text-[#ecb613]" />
                                                <h3 className="font-bold text-slate-900 dark:text-white">Live Session Attendance Roster</h3>
                                            </div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Toggle to adjust live records</span>
                                        </div>
                                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {students.map(s => (
                                                <div key={s.id} className="flex items-center justify-between gap-4 px-6 py-4 flex-wrap sm:flex-nowrap hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-10 h-10 rounded-full bg-[#ecb613]/10 flex items-center justify-center flex-shrink-0 border-2 border-white shadow-sm dark:border-slate-850">
                                                            {s.profile_pic_url ? (
                                                                <img src={s.profile_pic_url} alt={s.name} className="w-full h-full rounded-full object-cover" />
                                                            ) : (
                                                                <span className="text-sm font-bold text-[#ecb613]">{s.name.charAt(0)}</span>
                                                            )}
                                                        </div>
                                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{s.name}</span>
                                                    </div>

                                                    {/* Live update status controls */}
                                                    <div className="flex gap-1.5 flex-wrap">
                                                        {([
                                                            { key: 'present', label: 'Present', activeClass: 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-100 dark:shadow-none' },
                                                            { key: 'absent', label: 'Absent', activeClass: 'bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-100 dark:shadow-none' },
                                                            { key: 'late', label: 'Late', activeClass: 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-100 dark:shadow-none' },
                                                            { key: 'excused', label: 'Excused', activeClass: 'bg-indigo-500 text-white border-indigo-500 shadow-md shadow-indigo-100 dark:shadow-none' }
                                                        ] as const).map(opt => {
                                                            const isAct = s.attendance === opt.key;
                                                            return (
                                                                <button
                                                                    key={opt.key}
                                                                    onClick={() => handleLiveAttendanceUpdate(s.id, opt.key)}
                                                                    className={`px-3 py-1.5 text-xs font-bold border-2 rounded-xl transition-all duration-200 hover:scale-[1.02] ${
                                                                        isAct
                                                                            ? opt.activeClass
                                                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                                    }`}
                                                                >
                                                                    {opt.label}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                            {students.length === 0 && (
                                                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                                                    No students enrolled in this classroom.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: CLASS MESSAGES & BROADCASTS */}
                            {activeTab === 'messages' && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
                                    {/* Broadcast Composer */}
                                    <div className="lg:col-span-2">
                                        <form onSubmit={handleSendClassMessage} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6 hover:shadow-md transition-shadow">
                                            <div className="flex items-center justify-between">
                                                <h3 className="font-extrabold text-slate-955 dark:text-white text-lg flex items-center gap-2">
                                                    <MessageSquare className="text-[#ecb613] size-5" />
                                                    Broadcast to Class
                                                </h3>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const meetLink = "Join Google Meet: https://meet.google.com/abc-defg-hij";
                                                        setMessageContent(prev => prev ? `${prev}\n\n${meetLink}` : meetLink);
                                                    }}
                                                    className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 hover:scale-[1.02] border border-blue-200/50 dark:border-blue-900/30"
                                                >
                                                    <Video size={14} /> 🔗 Share Meet Link
                                                </button>
                                            </div>

                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wide mb-2">Subject</label>
                                                    <input
                                                        type="text"
                                                        value={messageSubject}
                                                        onChange={(e) => setMessageSubject(e.target.value)}
                                                        placeholder={`e.g. Google Meet URL - Classroom Session`}
                                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#ecb613] focus:border-[#ecb613] outline-none transition-all placeholder:text-slate-400"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wide mb-2">Message Content</label>
                                                    <textarea
                                                        rows={6}
                                                        value={messageContent}
                                                        onChange={(e) => setMessageContent(e.target.value)}
                                                        placeholder="Hi Class, please join today's session via this link or prepare the A1 scale exercise..."
                                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#ecb613] focus:border-[#ecb613] outline-none transition-all placeholder:text-slate-400 font-medium"
                                                    />
                                                </div>
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={isSendingMessage || !messageContent.trim()}
                                                className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
                                                    messageContent.trim()
                                                        ? 'bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900 shadow-[#ecb613]/25 hover:scale-[1.01]'
                                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                }`}
                                            >
                                                {isSendingMessage ? (
                                                    <><Loader2 className="w-5 h-5 animate-spin" /> Broadcasting...</>
                                                ) : (
                                                    <><Send className="w-5 h-5" /> Send Announcement to Class</>
                                                )}
                                            </button>
                                        </form>
                                    </div>

                                    {/* Broadcast History */}
                                    <div className="lg:col-span-1 space-y-4">
                                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 hover:shadow-md transition-shadow">
                                            <h4 className="font-extrabold text-slate-900 dark:text-white text-md mb-4 flex items-center gap-2">
                                                <Share2 size={16} className="text-amber-500" />
                                                Recently Sent
                                            </h4>
                                            <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
                                                {classBroadcasts.map((b, i) => (
                                                    <div key={b.id || i} className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-100 dark:border-slate-800 text-xs hover:border-[#ecb613] transition-colors relative">
                                                        <div className="flex justify-between items-center gap-2 mb-1.5">
                                                            <span className="font-bold text-slate-900 dark:text-white truncate">{b.subject}</span>
                                                            <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                                                                {new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                        <p className="text-slate-650 dark:text-slate-450 leading-relaxed font-medium line-clamp-3 whitespace-pre-wrap">{b.content}</p>
                                                    </div>
                                                ))}
                                                {classBroadcasts.length === 0 && (
                                                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-8 italic font-semibold">
                                                        No broadcasts sent to this class yet.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: QUICK ASSIGNMENTS */}
                            {activeTab === 'assignments' && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
                                    {/* Assignment Form */}
                                    <div className="lg:col-span-2">
                                        <form onSubmit={handleQuickAssignTask} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6 hover:shadow-md transition-shadow">
                                            <h3 className="font-extrabold text-slate-955 dark:text-white text-lg flex items-center gap-2">
                                                <FileText className="text-[#ecb613] size-5" />
                                                Create Quick Class Assignment
                                            </h3>

                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wide mb-2">Assignment Title</label>
                                                    <input
                                                        type="text"
                                                        value={assignmentTitle}
                                                        onChange={(e) => setAssignmentTitle(e.target.value)}
                                                        placeholder="e.g. Breath practice 15 mins & record audio"
                                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#ecb613] focus:border-[#ecb613] outline-none transition-all placeholder:text-slate-400"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wide mb-2">Instructions / Instructions Details</label>
                                                    <textarea
                                                        rows={4}
                                                        value={assignmentDesc}
                                                        onChange={(e) => setAssignmentDesc(e.target.value)}
                                                        placeholder="Detail what students should submit. e.g., 'Submit a video of you playing the G Major scale...'"
                                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#ecb613] focus:border-[#ecb613] outline-none transition-all placeholder:text-slate-400 font-medium"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wide mb-2">Due Date</label>
                                                    <input
                                                        type="date"
                                                        value={assignmentDueDate}
                                                        onChange={(e) => setAssignmentDueDate(e.target.value)}
                                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#ecb613] focus:border-[#ecb613] outline-none transition-all"
                                                    />
                                                </div>
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={isAssigningTask || !assignmentTitle.trim() || !assignmentDesc.trim()}
                                                className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
                                                    assignmentTitle.trim() && assignmentDesc.trim()
                                                        ? 'bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900 shadow-[#ecb613]/25 hover:scale-[1.01]'
                                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                }`}
                                            >
                                                {isAssigningTask ? (
                                                    <><Loader2 className="w-5 h-5 animate-spin" /> Assigning...</>
                                                ) : (
                                                    <><Send className="w-5 h-5" /> Assign to Entire Class</>
                                                )}
                                            </button>
                                        </form>
                                    </div>

                                    {/* Class Active Assignments */}
                                    <div className="lg:col-span-1 space-y-4">
                                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 hover:shadow-md transition-shadow">
                                            <h4 className="font-extrabold text-slate-900 dark:text-white text-md mb-4 flex items-center gap-2">
                                                <Clipboard size={16} className="text-amber-500" />
                                                Class Active Tasks
                                            </h4>
                                            <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
                                                {classAssignments.map((a, i) => (
                                                    <div key={a.id || i} className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-100 dark:border-slate-800 text-xs hover:border-[#ecb613] transition-colors relative group">
                                                        <div className="flex justify-between items-start gap-2 mb-1">
                                                            <span className="font-bold text-slate-900 dark:text-white line-clamp-1">{a.title}</span>
                                                            <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-50 dark:bg-amber-955/20 dark:text-amber-400 px-1.5 py-0.5 rounded shrink-0">
                                                                Active
                                                            </span>
                                                        </div>
                                                        <p className="text-slate-550 dark:text-slate-400 leading-snug line-clamp-2 mb-2 font-medium">{a.description}</p>
                                                        {a.due_date && (
                                                            <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                                                                <Calendar size={12} /> Due: {new Date(a.due_date).toLocaleDateString()}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                                {classAssignments.length === 0 && (
                                                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-8 italic font-semibold">
                                                        No active assignments for this class.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 4: CURRICULUM LOG & RESOURCES */}
                            {activeTab === 'curriculum' && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
                                    {/* Lessons Guide / Tips */}
                                    <div className="lg:col-span-2 space-y-6">
                                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 hover:shadow-md transition-shadow">
                                            <h3 className="font-extrabold text-slate-900 dark:text-white text-lg flex items-center gap-2 mb-4">
                                                <BookOpen className="text-[#ecb613] size-5" />
                                                Class Lesson Activity Log
                                            </h3>
                                            <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed font-medium">
                                                Keep track of what topics, raga scales, or flute theory lessons you covered in today's active session. This will help you track classroom progress.
                                            </p>
                                            <textarea
                                                rows={5}
                                                value={classLog}
                                                onChange={(e) => {
                                                    setClassLog(e.target.value);
                                                    localStorage.setItem(`kfa_class_log_${classroomId}_${sessionDate}`, e.target.value);
                                                }}
                                                placeholder="Write down what you taught today, student progress remarks, or syllabus updates..."
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#ecb613] focus:border-[#ecb613] outline-none transition-all placeholder:text-slate-400 font-medium"
                                            />
                                            <div className="flex justify-between items-center mt-3 flex-wrap gap-2">
                                                <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                                                    ✓ Automatically saved to local cache
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        alert('Class logs saved successfully for today\'s session!');
                                                    }}
                                                    className="px-4 py-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-250 hover:bg-emerald-100 rounded-xl text-xs font-black transition-all hover:scale-[1.02] shadow-sm"
                                                >
                                                    Save Progress Log
                                                </button>
                                            </div>
                                        </div>

                                        <div className="bg-[#0d5e5b] p-6 rounded-2xl shadow-xl shadow-[#0d5e5b]/10 text-white relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                                                <Lightbulb className="w-16 h-16 text-teal-350" />
                                            </div>
                                            <h4 className="font-extrabold text-[#ecb613] text-sm mb-3 flex items-center gap-2 tracking-wide uppercase">
                                                <Lightbulb className="w-5 h-5 text-[#ecb613]" />
                                                Music Teaching Tip
                                            </h4>
                                            <p className="text-sm text-teal-50/90 leading-relaxed italic font-medium">
                                                "Breath control is 70% of good flute performance. Start every class with a 3-minute long breath note practice (Pranayama tone building) before diving into scales."
                                            </p>
                                        </div>
                                    </div>

                                    {/* Resources & Shortcuts */}
                                    <div className="lg:col-span-1 space-y-4">
                                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 hover:shadow-md transition-shadow">
                                            <h4 className="font-extrabold text-slate-900 dark:text-white text-md mb-4 flex items-center gap-2">
                                                <Music size={16} className="text-amber-500" />
                                                Quick Reference
                                            </h4>
                                            <div className="space-y-3">
                                                {[
                                                    { title: "Basic Flute Fingering Guide", desc: "PDF chart for standard 8-hole bansuri", type: "PDF" },
                                                    { title: "Mohanam Raga Lessons", desc: "Level-1 beginner notation guide", type: "Sheet" },
                                                    { title: "Breath Control Exercises", desc: "Long tones practice track", type: "Audio" }
                                                ].map((res, i) => (
                                                    <div key={i} className="p-3 bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between hover:border-amber-500 transition-all cursor-pointer">
                                                        <div className="min-w-0 pr-2">
                                                            <div className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">{res.title}</div>
                                                            <div className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{res.desc}</div>
                                                        </div>
                                                        <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400 px-1.5 py-0.5 rounded shrink-0">
                                                            {res.type}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

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
