'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../src/lib/supabase-auth';
import { 
    Loader2, BookOpen, Calendar, Mail, FileText, CheckCircle, 
    Clock, Video, Play, Music, Award, Users, Search, PlayCircle, 
    Send, X, ClipboardList, Info, BarChart2, Plus, Volume2, 
    HelpCircle, ChevronRight, Download, LogOut, Check
} from 'lucide-react';
import dynamic from 'next/dynamic';

const PracticeSuiteModal = dynamic(() => import('../../src/components/PracticeSuiteModal'), { ssr: false });

interface StudentProfile {
    id: string;
    name: string;
    email: string;
    level?: string;
    profile_pic_url?: string;
    role?: string;
    teacher_id?: string | null;
}

interface EnrichedAssignment {
    id: string;
    title: string;
    description?: string;
    due_date?: string;
    file_url?: string | null;
    file_name?: string | null;
    file_size?: number | null;
    status: 'pending' | 'submitted' | 'reviewed' | 'approved';
    score?: number | null;
    proficiency_level?: string | null;
    feedback_text?: string | null;
    video_url?: string | null;
    submitted_at?: string | null;
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

interface AttendanceRecord {
    id: string;
    date: string;
    status: 'present' | 'absent' | 'late' | 'excused';
}

interface Broadcast {
    id: string;
    channel: string;
    subject: string;
    content: string;
    audio_attachment?: string | null;
    created_at: string;
}

interface ClassNote {
    id: string;
    title: string;
    content?: string;
    file_url?: string;
    file_name?: string;
    file_size?: number;
    color?: string;
    created_at: string;
}

export default function StudentDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<StudentProfile | null>(null);
    const [classroom, setClassroom] = useState<ClassroomInfo | null>(null);
    const [classmates, setClassmates] = useState<Classmate[]>([]);
    const [assignments, setAssignments] = useState<EnrichedAssignment[]>([]);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [sessionLogs, setSessionLogs] = useState<any[]>([]);
    const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
    const [classNotes, setClassNotes] = useState<ClassNote[]>([]);
    
    // Curriculum states
    const [courseModules, setCourseModules] = useState<any[]>([]);
    const [courseChapters, setCourseChapters] = useState<any[]>([]);
    const [courseLessons, setCourseLessons] = useState<any[]>([]);
    const [studentProgress, setStudentProgress] = useState<any[]>([]);
    const [classroomInventoryAllocations, setClassroomInventoryAllocations] = useState<any[]>([]);
    const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
    const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});

    // UI Navigation state
    const [activeTab, setActiveTab] = useState<'overview' | 'curriculum' | 'tasks' | 'messages' | 'attendance' | 'library'>('overview');
    const [showPracticeSuite, setShowPracticeSuite] = useState(false);
    const [practiceSuiteTab, setPracticeSuiteTab] = useState<'metronome' | 'drums'>('metronome');

    // Submission modal/drawer states
    const [selectedAssignment, setSelectedAssignment] = useState<EnrichedAssignment | null>(null);
    const [submitVideoUrl, setSubmitVideoUrl] = useState('');
    const [isSubmittingTask, setIsSubmittingTask] = useState(false);

    // Audio voice broadcast states
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const refreshData = async () => {
        try {
            const { data: { session } } = await supabaseAuth.auth.getSession();
            if (!session) { router.push('/login'); return; }

            const userId = session.user.id;

            // 1. Fetch student profile
            const { data: user } = await supabaseAuth
                .from('users')
                .select('id, name, email, level, profile_pic_url, role, teacher_id')
                .eq('id', userId)
                .maybeSingle();

            if (!user || user.role === 'teacher') { router.push('/'); return; }
            setProfile(user);

            // 2. Fetch classroom mapping
            const { data: cs } = await supabaseAuth
                .from('classroom_students')
                .select('classroom_id, classrooms(id, name, description, teacher_id, users!teacher_id(name, email))')
                .eq('student_id', userId)
                .maybeSingle();

            let classroomId = '';
            if (cs?.classrooms) {
                const cls = cs.classrooms as any;
                classroomId = cls.id;
                setClassroom({
                    id: cls.id,
                    name: cls.name,
                    description: cls.description || '',
                    teacher_id: cls.teacher_id,
                    teacher_name: cls.users?.name || 'Academy Instructor',
                    teacher_email: cls.users?.email || ''
                });

                // Fetch classmates in same classroom
                const { data: classmatesList } = await supabaseAuth
                    .from('classroom_students')
                    .select('student_id, users!student_id(id, name, level, profile_pic_url)')
                    .eq('classroom_id', cls.id)
                    .neq('student_id', userId);

                if (classmatesList) {
                    const formattedClassmates = classmatesList.map((c: any) => ({
                        id: c.users?.id || c.student_id,
                        name: c.users?.name || 'Classmate',
                        level: c.users?.level || 'Beginner',
                        profile_pic_url: c.users?.profile_pic_url || null
                    }));
                    setClassmates(formattedClassmates);
                }

                // Fetch class notes
                const { data: notes } = await supabaseAuth
                    .from('class_notes')
                    .select('*')
                    .eq('classroom_id', cls.id)
                    .order('created_at', { ascending: false });
                setClassNotes(notes || []);
            }

            // 3. Fetch Assignments and Submissions (assignment_students)
            if (classroomId) {
                const { data: rawAssignments } = await supabaseAuth
                    .from('assignments')
                    .select('*')
                    .eq('classroom_id', classroomId)
                    .order('created_at', { ascending: false });

                const { data: submissions } = await supabaseAuth
                    .from('assignment_students')
                    .select('*')
                    .eq('student_id', userId);

                const enriched: EnrichedAssignment[] = (rawAssignments || [])
                    .map((asg: any) => {
                        const sub = (submissions || []).find((s: any) => s.assignment_id === asg.id);
                        // Filter out individual assignments not allocated to this student
                        if (asg.target_type === 'individual' && !sub) {
                            return null;
                        }

                        return {
                            id: asg.id,
                            title: asg.title,
                            description: asg.description || '',
                            due_date: asg.due_date || '',
                            file_url: asg.file_url,
                            file_name: asg.file_name,
                            file_size: asg.file_size,
                            status: sub?.status || 'pending',
                            score: sub?.score,
                            proficiency_level: sub?.proficiency_level,
                            feedback_text: sub?.feedback_text,
                            video_url: sub?.video_url,
                            submitted_at: sub?.submitted_at
                        };
                    })
                    .filter(Boolean) as EnrichedAssignment[];

                setAssignments(enriched);
            }

            // 4. Fetch Attendance logs
            const { data: att } = await supabaseAuth
                .from('attendance')
                .select('*')
                .eq('student_id', userId)
                .order('date', { ascending: false });
            setAttendance(att || []);

            // Fetch classroom session logs
            if (classroomId) {
                const { data: logs, error: logsErr } = await supabaseAuth
                    .from('classroom_session_logs')
                    .select('*')
                    .eq('classroom_id', classroomId)
                    .order('started_at', { ascending: false });
                if (!logsErr) {
                    setSessionLogs(logs || []);
                }
            }

            // 5. Fetch Messages (Broadcasts) targeted to this student or classroom
            const { data: broadcastsData } = await supabaseAuth
                .from('broadcasts')
                .select('*')
                .order('created_at', { ascending: false });

            const studentBroadcasts = (broadcastsData || []).filter((b: any) => {
                return b.recipients?.some((r: any) => 
                    (r.type === 'global') ||
                    (r.type === 'student' && r.id === userId) ||
                    (r.type === 'class' && r.id === classroomId)
                );
            });
            setBroadcasts(studentBroadcasts);

            // 6. Fetch Curriculum and Progress data
            const { data: modules } = await supabaseAuth.from('course_modules').select('*').order('module_number', { ascending: true });
            const { data: chapters } = await supabaseAuth.from('course_chapters').select('*').order('chapter_number', { ascending: true });
            const { data: lessons } = await supabaseAuth.from('course_lessons').select('*').order('lesson_number', { ascending: true });
            setCourseModules(modules || []);
            setCourseChapters(chapters || []);
            setCourseLessons(lessons || []);

            const { data: progress } = await supabaseAuth
                .from('student_topic_progress')
                .select('*')
                .eq('student_id', userId);
            setStudentProgress(progress || []);

            if (classroomId) {
                const { data: allocations } = await supabaseAuth
                    .from('classroom_inventory_allocation')
                    .select('*')
                    .eq('classroom_id', classroomId);
                setClassroomInventoryAllocations(allocations || []);
            }

        } catch (err) {
            console.error('Error fetching dashboard data:', err);
        }
    };

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await refreshData();
            setLoading(false);
        };
        init();
    }, [router]);

    // Merged logs for rendering past sessions - placed before conditional early returns
    const mergedLogs = useMemo(() => {
        const logsMap = new Map<string, any>();
        sessionLogs.forEach(log => {
            logsMap.set(log.session_date, log);
        });

        const allDates = new Set<string>([
            ...sessionLogs.map(log => log.session_date),
            ...attendance.map(a => a.date)
        ]);

        const sortedDates = Array.from(allDates).sort((a, b) => b.localeCompare(a));

        return sortedDates.map(dateStr => {
            const log = logsMap.get(dateStr);
            const att = attendance.find(a => a.date === dateStr);
            return {
                date: dateStr,
                id: log?.id || att?.id || dateStr,
                started_at: log?.started_at || null,
                duration_seconds: log?.duration_seconds || null,
                session_type: log?.session_type || null,
                status: att?.status || 'unmarked'
            };
        });
    }, [sessionLogs, attendance]);

    const handleLogout = async () => {
        if (audioRef.current) {
            audioRef.current.pause();
        }
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    // Voice message player helper
    const playVoiceNote = (id: string, audioAttachment: string) => {
        if (audioRef.current) {
            audioRef.current.pause();
        }

        if (playingAudioId === id) {
            setPlayingAudioId(null);
            return;
        }

        const audio = new Audio(audioAttachment);
        audioRef.current = audio;
        setPlayingAudioId(id);

        audio.play().catch(err => {
            console.error('Error playing audio note:', err);
            setPlayingAudioId(null);
        });

        audio.onended = () => {
            setPlayingAudioId(null);
        };
    };

    // Toggle lesson completed status
    const handleToggleLessonComplete = async (lessonId: string, currentStatus: string) => {
        if (!profile || !classroom) return;
        
        const nextStatus = currentStatus === 'completed' ? 'unlocked' : 'completed';
        const completedAt = nextStatus === 'completed' ? new Date().toISOString() : null;

        try {
            const { error } = await supabaseAuth
                .from('student_topic_progress')
                .upsert({
                    student_id: profile.id,
                    classroom_id: classroom.id,
                    lesson_id: lessonId,
                    status: nextStatus,
                    unlocked_by: 'student',
                    completed_at: completedAt
                }, { onConflict: 'student_id, lesson_id' });

            if (error) throw error;

            // Update local state
            setStudentProgress(prev => {
                const existing = prev.find(p => p.lesson_id === lessonId);
                if (existing) {
                    return prev.map(p => p.lesson_id === lessonId ? { ...p, status: nextStatus, completed_at: completedAt } : p);
                } else {
                    return [...prev, { student_id: profile.id, classroom_id: classroom.id, lesson_id: lessonId, status: nextStatus, completed_at: completedAt }];
                }
            });
        } catch (err: any) {
            console.error('Error toggling topic progress:', err);
            alert(`Failed to update progress: ${err.message}`);
        }
    };

    // Submit assignment practice video URL
    const handleSubmitTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile || !selectedAssignment || isSubmittingTask) return;

        const videoUrlStr = submitVideoUrl.trim();
        if (!videoUrlStr) {
            alert('Please provide a recording link!');
            return;
        }

        setIsSubmittingTask(true);

        try {
            // Check if there is an existing assignment_students row
            const { data: existingMapping } = await supabaseAuth
                .from('assignment_students')
                .select('*')
                .eq('assignment_id', selectedAssignment.id)
                .eq('student_id', profile.id)
                .maybeSingle();

            let dbError = null;

            if (existingMapping) {
                const { error } = await supabaseAuth
                    .from('assignment_students')
                    .update({
                        status: 'submitted',
                        video_url: videoUrlStr,
                        submitted_at: new Date().toISOString()
                    })
                    .eq('id', existingMapping.id);
                dbError = error;
            } else {
                const { error } = await supabaseAuth
                    .from('assignment_students')
                    .insert({
                        assignment_id: selectedAssignment.id,
                        student_id: profile.id,
                        status: 'submitted',
                        video_url: videoUrlStr,
                        submitted_at: new Date().toISOString()
                    });
                dbError = error;
            }

            if (dbError) throw dbError;

            alert('Practice recording submitted successfully!');

            // Refresh data
            await refreshData();
            
            // Close modal
            setSelectedAssignment(null);
            setSubmitVideoUrl('');
        } catch (err: any) {
            console.error('Error submitting assignment:', err);
            alert(`Failed to submit practice recording: ${err.message}`);
        } finally {
            setIsSubmittingTask(false);
        }
    };

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8fafc]">
                <Loader2 className="w-10 h-10 animate-spin text-[#d46211] mb-4" />
                <p className="font-semibold text-slate-600 animate-pulse" style={{ fontFamily: 'Lexend, sans-serif' }}>Syncing Academy Files...</p>
            </div>
        );
    }

    // Attendance stats
    const attendanceStats = {
        total: attendance.length,
        present: attendance.filter(a => a.status === 'present').length,
        late: attendance.filter(a => a.status === 'late').length,
        absent: attendance.filter(a => a.status === 'absent').length,
        excused: attendance.filter(a => a.status === 'excused').length,
    };
    const attendancePct = attendanceStats.total > 0
        ? Math.round(((attendanceStats.present + attendanceStats.late) / attendanceStats.total) * 100)
        : null;

    const levelLabel = profile?.level
        ? profile.level.charAt(0).toUpperCase() + profile.level.slice(1)
        : 'Beginner';

    // Curriculum Helper: check lesson status
    const getLessonStatus = (lessonId: string, chapterId: string, moduleId: string): 'locked' | 'unlocked' | 'completed' => {
        const progress = studentProgress.find(p => p.lesson_id === lessonId);
        if (progress) {
            return progress.status as 'locked' | 'unlocked' | 'completed';
        }

        // Check if explicitly unlocked via inventory allocations
        const isAllocated = classroomInventoryAllocations.some(a => 
            (a.lesson_id === lessonId) || 
            (a.chapter_id === chapterId) || 
            (a.module_id === moduleId)
        );

        return isAllocated ? 'unlocked' : 'locked';
    };

    // Calculate completed lessons vs total allocated lessons
    const totalAllocatedLessons = courseLessons.filter(l => 
        classroomInventoryAllocations.some(a => 
            (a.lesson_id === l.id) || 
            (a.chapter_id === l.chapter_id) || 
            (a.module_id === l.module_id)
        )
    ).length;

    const completedLessonsCount = studentProgress.filter(p => p.status === 'completed').length;

    const recentFeedback = assignments.find(a => a.feedback_text);

    return (
        <>
        {showPracticeSuite && (
            <PracticeSuiteModal 
                defaultTab={practiceSuiteTab} 
                onClose={() => setShowPracticeSuite(false)} 
            />
        )}
        
        <div className="flex min-h-screen bg-[#f8fafc]" style={{ fontFamily: 'Lexend, sans-serif' }}>
            {/* Google Fonts */}
            <link href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" rel="stylesheet" />

            {/* Sidebar Navigation */}
            <aside className="w-72 border-r border-slate-200 bg-white flex flex-col shrink-0 sticky top-0 h-screen hidden md:flex">
                <div className="p-6 flex flex-col justify-center border-b border-slate-150">
                    <h1 className="font-black text-xl leading-tight text-slate-950 select-none">
                        Krishna Flute
                    </h1>
                    <p className="text-xs font-semibold text-[#b45309] mt-0.5 uppercase tracking-wider select-none">
                        Academy Portal
                    </p>
                </div>

                {/* Sidebar Profile Card */}
                <div className="p-4 border-b border-slate-150 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#ecb613]/25 to-amber-50 flex items-center justify-center overflow-hidden border border-slate-100 shadow-xs">
                            {profile?.profile_pic_url ? (
                                <img src={profile.profile_pic_url} alt={profile.name} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-[#d46211] text-base font-extrabold">{profile?.name?.charAt(0)}</span>
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="font-extrabold text-xs text-slate-800 truncate">{profile?.name}</p>
                            <p className="text-[10px] font-semibold text-slate-400 truncate mt-0.5">{profile?.email}</p>
                        </div>
                    </div>
                </div>

                {/* Sidebar Navigation Options */}
                <nav className="p-4 flex-1 space-y-1.5 overflow-y-auto">
                    {[
                        { id: 'overview', label: 'Overview', icon: BarChart2 },
                        { id: 'curriculum', label: 'Curriculum Progress', icon: BookOpen },
                        { id: 'tasks', label: 'Tasks & Submissions', icon: ClipboardList },
                        { id: 'messages', label: 'Message Center', icon: Mail },
                        { id: 'attendance', label: 'Attendance logs', icon: Calendar },
                        { id: 'library', label: 'Library & Tools', icon: FileText },
                    ].map((item) => {
                        const Icon = item.icon;
                        const active = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id as any)}
                                className={`w-full flex items-center gap-3 py-3 transition-all relative ${
                                    active 
                                        ? 'bg-gradient-to-r from-amber-500/10 to-amber-500/0 text-[#b45309] font-black border-l-4 border-[#d46211] pl-3.5 pr-4 rounded-r-2xl' 
                                        : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-800 px-4 rounded-xl'
                                }`}
                            >
                                <Icon className={`w-[22px] h-[22px] shrink-0 ${active ? 'text-[#d46211]' : 'text-slate-400'}`} />
                                <span className="text-sm font-semibold">{item.label}</span>
                                {item.id === 'tasks' && assignments.filter(a => a.status === 'pending').length > 0 && (
                                    <span className="ml-auto w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center">
                                        {assignments.filter(a => a.status === 'pending').length}
                                    </span>
                                )}
                                {item.id === 'messages' && broadcasts.length > 0 && (
                                    <span className="ml-auto w-2 h-2 rounded-full bg-orange-500"></span>
                                )}
                            </button>
                        );
                    })}
                </nav>

                {/* Logout Button Footer */}
                <div className="p-4 border-t border-slate-150">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-red-600 hover:bg-red-50 transition-colors"
                    >
                        <LogOut className="w-[22px] h-[22px] shrink-0 text-red-500" />
                        <span className="text-sm font-semibold">Logout</span>
                    </button>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="flex-1 flex flex-col min-w-0">
                <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 md:px-8 sticky top-0 z-35 md:z-10">
                    <div className="flex items-center gap-3">
                        <div className="md:hidden w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white">
                            <Music className="w-4.5 h-4.5" />
                        </div>
                        <h2 className="text-slate-800 font-extrabold tracking-tight capitalize text-sm md:text-base">
                            {activeTab === 'library' ? 'Library & Tools' : activeTab === 'tasks' ? 'Tasks & Submissions' : activeTab}
                        </h2>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Status badge for quick view */}
                        <div className="hidden sm:flex items-center gap-1.5 bg-amber-50 border border-amber-100 rounded-full px-3 py-1">
                            <Award className="w-3.5 h-3.5 text-amber-500" />
                            <span className="text-[10px] font-black text-amber-700 tracking-wide uppercase">{levelLabel} Level</span>
                        </div>

                        {profile?.profile_pic_url ? (
                            <img src={profile.profile_pic_url} alt={profile.name} className="w-8 h-8 rounded-xl object-cover border border-slate-100 shadow-xs" />
                        ) : (
                            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[#d46211] font-bold text-xs">
                                {profile?.name?.charAt(0) || 'S'}
                            </div>
                        )}
                        
                        <button onClick={handleLogout} className="md:hidden text-rose-500">
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </header>

                {/* Main Content Area */}
                <main className="flex-1 p-6 md:p-8 max-w-6xl mx-auto w-full">
                    {/* ──── OVERVIEW TAB ──── */}
                    {activeTab === 'overview' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            {/* Welcome Glassmorphic Banner */}
                            <div className="bg-gradient-to-r from-amber-400 via-orange-500 to-orange-600 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-lg shadow-orange-500/10">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-12 translate-x-12"></div>
                                <div className="relative z-10 space-y-4 max-w-xl">
                                    <span className="bg-white/20 text-white border border-white/20 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">Flute Academy Student Portal</span>
                                    <h1 className="text-2xl md:text-4xl font-black tracking-tight leading-tight">Welcome back, {profile?.name?.split(' ')[0]}!</h1>
                                    <p className="text-sm font-medium text-white/80 leading-relaxed">
                                        "Practice makes perfect. Find regular time to warm up your breathing, rehearse Alankars, and explore your repertoire."
                                    </p>
                                    {classroom && (
                                        <div className="flex items-center gap-1.5 text-xs font-semibold bg-black/10 w-fit px-3 py-1.5 rounded-xl border border-white/10 backdrop-blur-xs">
                                            <Users className="w-3.5 h-3.5" />
                                            Enrolled: {classroom.name} · Instructor: {classroom.teacher_name}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Summary Metrics Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                                {/* Level Card */}
                                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
                                        <Award className="w-6 h-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Proficiency</p>
                                        <h3 className="font-extrabold text-base text-slate-800 truncate mt-0.5">{levelLabel}</h3>
                                        <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Scale & Finger training</p>
                                    </div>
                                </div>

                                {/* Class/Batch Card */}
                                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
                                        <Users className="w-6 h-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">My Batch</p>
                                        <h3 className="font-extrabold text-base text-slate-800 truncate mt-0.5">{classroom?.name || 'Not Enrolled'}</h3>
                                        <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Active Class Session</p>
                                    </div>
                                </div>

                                {/* Attendance Percentage */}
                                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0">
                                        <Calendar className="w-6 h-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Attendance</p>
                                        <h3 className="font-extrabold text-lg text-slate-800 mt-0.5">{attendancePct !== null ? `${attendancePct}%` : '—'}</h3>
                                        <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{attendanceStats.total} marked sessions</p>
                                    </div>
                                </div>

                                {/* Pending Tasks count */}
                                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0">
                                        <ClipboardList className="w-6 h-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Pending Tasks</p>
                                        <h3 className="font-extrabold text-lg text-slate-800 mt-0.5">{assignments.filter(a => a.status === 'pending').length} Tasks</h3>
                                        <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Needs practice video</p>
                                    </div>
                                </div>
                            </div>

                            {/* Core Dashboard split sections */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Left/Center column: Recent assignments & Feedback */}
                                <div className="lg:col-span-2 space-y-6">
                                    {/* Recent Pending Assignment */}
                                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
                                        <div className="flex items-center justify-between mb-5">
                                            <h3 className="font-extrabold text-slate-800 text-sm md:text-base flex items-center gap-2">
                                                <ClipboardList className="w-5 h-5 text-amber-500" />
                                                Upcoming Assignments
                                            </h3>
                                            <button onClick={() => setActiveTab('tasks')} className="text-xs font-bold text-amber-500 hover:text-amber-600 transition-colors flex items-center gap-0.5">
                                                View All <ChevronRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        {assignments.filter(a => a.status === 'pending').length === 0 ? (
                                            <div className="py-8 border border-dashed border-slate-100 rounded-2xl text-center bg-slate-50/50">
                                                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                                                <p className="text-xs font-bold text-slate-700">All tasks completed!</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">Enjoy your flute practice sessions.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {assignments.filter(a => a.status === 'pending').slice(0, 2).map((asg) => (
                                                    <div key={asg.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                        <div className="min-w-0 flex-1">
                                                            <h4 className="font-extrabold text-xs text-slate-800 truncate">{asg.title}</h4>
                                                            <p className="text-[10px] text-slate-500 truncate mt-0.5">{asg.description || 'No instruction notes'}</p>
                                                            {asg.due_date && (
                                                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-2">
                                                                    <Clock className="w-3 h-3" /> Due: {new Date(asg.due_date).toLocaleDateString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button 
                                                            onClick={() => {
                                                                setSelectedAssignment(asg);
                                                                setSubmitVideoUrl(asg.video_url || '');
                                                            }}
                                                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors shrink-0 flex items-center gap-1.5 justify-center"
                                                        >
                                                            <Video className="w-3.5 h-3.5" />
                                                            Submit Recording
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Latest Teacher Feedback */}
                                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
                                        <h3 className="font-extrabold text-slate-800 text-sm md:text-base flex items-center gap-2 mb-5">
                                            <Award className="w-5 h-5 text-amber-500" />
                                            Latest Teacher Review
                                        </h3>

                                        {recentFeedback ? (
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 uppercase">
                                                        {classroom?.teacher_name?.charAt(0) || 'T'}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-800">{classroom?.teacher_name}</p>
                                                        <p className="text-[10px] text-slate-400">Classroom instructor</p>
                                                    </div>
                                                    {recentFeedback.score !== undefined && recentFeedback.score !== null && (
                                                        <span className="ml-auto bg-emerald-50 border border-emerald-100 text-emerald-700 font-extrabold text-xs px-3 py-1 rounded-full">
                                                            Score: {recentFeedback.score}/10
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 relative">
                                                    <span className="absolute -top-2.5 -left-1 text-amber-500/15 text-5xl font-serif">“</span>
                                                    <p className="text-xs font-medium text-slate-600 leading-relaxed italic relative z-10 pl-2">
                                                        "{recentFeedback.feedback_text}"
                                                    </p>
                                                    {recentFeedback.proficiency_level && (
                                                        <p className="text-[9px] font-bold text-amber-700 uppercase tracking-widest mt-2">
                                                            Topic Assessment: {recentFeedback.proficiency_level}
                                                        </p>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-slate-400">Assigned task: <span className="font-bold text-slate-500">{recentFeedback.title}</span></p>
                                            </div>
                                        ) : (
                                            <div className="py-8 border border-dashed border-slate-100 rounded-2xl text-center bg-slate-50/50">
                                                <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                                <p className="text-xs font-bold text-slate-700">No review feedback yet.</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">Teacher feedback on your submitted recordings will show here.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right column: Quick Tools & Recent Messages */}
                                <div className="space-y-6">
                                    {/* Interactive Quick Tools */}
                                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
                                        <h3 className="font-extrabold text-slate-800 text-sm md:text-base flex items-center gap-2 mb-4">
                                            <Music className="w-5 h-5 text-amber-500" />
                                            Practice Tools
                                        </h3>
                                        <div className="grid grid-cols-4 gap-2">
                                            <button 
                                                onClick={() => {
                                                    setPracticeSuiteTab('metronome');
                                                    setShowPracticeSuite(true);
                                                }} 
                                                className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-amber-500/5 hover:border-amber-500/30 flex flex-col items-center justify-center gap-1.5 transition-all group shrink-0"
                                            >
                                                <Volume2 className="w-6 h-6 text-amber-500 group-hover:scale-115 transition-transform" />
                                                <span className="text-[9px] font-extrabold text-slate-600">Metronome</span>
                                            </button>
 
                                            <button 
                                                onClick={() => {
                                                    setPracticeSuiteTab('metronome');
                                                    setShowPracticeSuite(true);
                                                }} 
                                                className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-amber-500/5 hover:border-amber-500/30 flex flex-col items-center justify-center gap-1.5 transition-all group shrink-0"
                                            >
                                                <Music className="w-6 h-6 text-amber-500 group-hover:scale-115 transition-transform" />
                                                <span className="text-[9px] font-extrabold text-slate-600">Tanpura</span>
                                            </button>
 
                                            <button 
                                                onClick={() => {
                                                    setPracticeSuiteTab('drums');
                                                    setShowPracticeSuite(true);
                                                }} 
                                                className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-amber-500/5 hover:border-amber-500/30 flex flex-col items-center justify-center gap-1.5 transition-all group shrink-0"
                                            >
                                                <span className="material-symbols-outlined text-amber-500 text-2xl group-hover:scale-115 transition-transform w-6 h-6 flex items-center justify-center">album</span>
                                                <span className="text-[9px] font-extrabold text-slate-600">Drum Beats</span>
                                            </button>

                                            <button 
                                                onClick={() => setActiveTab('library')}
                                                className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-amber-500/5 hover:border-amber-500/30 flex flex-col items-center justify-center gap-1.5 transition-all group shrink-0"
                                            >
                                                <FileText className="w-6 h-6 text-amber-500 group-hover:scale-115 transition-transform" />
                                                <span className="text-[9px] font-extrabold text-slate-600">Library</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Latest Alerts/Announcements timeline */}
                                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-extrabold text-slate-800 text-sm md:text-base flex items-center gap-2">
                                                <Mail className="w-5 h-5 text-amber-500" />
                                                Recent Notices
                                            </h3>
                                            <button onClick={() => setActiveTab('messages')} className="text-xs font-bold text-amber-500 hover:text-amber-600 transition-colors">
                                                All
                                            </button>
                                        </div>

                                        {broadcasts.length === 0 ? (
                                            <div className="py-8 text-center text-slate-400">
                                                <p className="text-[11px] font-medium">No notices posted.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {broadcasts.slice(0, 3).map((b) => (
                                                    <div key={b.id} className="text-left border-l-2 border-amber-500 pl-3 py-0.5">
                                                        <h4 className="text-[11px] font-extrabold text-slate-800 truncate">{b.subject}</h4>
                                                        <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{b.content}</p>
                                                        <span className="text-[8px] font-bold text-slate-400 block mt-1">{new Date(b.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ──── CLASSROOM & CURRICULUM TAB ──── */}
                    {activeTab === 'curriculum' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            {/* Classroom Header Summary */}
                            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row justify-between gap-6">
                                <div className="space-y-2 max-w-xl text-left">
                                    <span className="bg-orange-50 border border-orange-100 text-orange-600 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">Classroom Hub</span>
                                    <h2 className="text-xl md:text-2xl font-black text-slate-900 leading-tight">{classroom?.name || 'Not Enrolled'}</h2>
                                    <p className="text-xs text-slate-500 leading-relaxed">{classroom?.description || 'Active practice batch directory. Work through dynamic syllabus modules below.'}</p>
                                </div>
                                <div className="border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 flex flex-col justify-center shrink-0 text-left">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Your Instructor</p>
                                    <p className="font-extrabold text-sm text-slate-800 mt-1">{classroom?.teacher_name}</p>
                                    <p className="text-xs text-slate-400">{classroom?.teacher_email}</p>
                                </div>
                            </div>

                            {/* Split layout: classmates on right, curriculum tree on left */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                                {/* Left: Curriculum Syllabus Tree */}
                                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs text-left">
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h3 className="font-extrabold text-slate-800 text-base">Academy Syllabus</h3>
                                            <p className="text-xs text-slate-500 mt-0.5">Allocated lessons. Mark completed to record your learning.</p>
                                        </div>
                                        <div className="bg-amber-500/10 text-amber-700 text-xs font-extrabold px-3 py-1.5 rounded-full">
                                            Completed: {completedLessonsCount} / {totalAllocatedLessons || courseLessons.length}
                                        </div>
                                    </div>

                                    {courseModules.length === 0 ? (
                                        <div className="py-12 text-center text-slate-400">
                                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-slate-300" />
                                            <p className="text-xs">Loading course modules...</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {courseModules.map((module) => {
                                                const isModExpanded = !!expandedModules[module.id];
                                                const chapters = courseChapters.filter(c => c.module_id === module.id);
                                                
                                                return (
                                                    <div key={module.id} className="border border-slate-150 rounded-2xl overflow-hidden transition-all shadow-xs">
                                                        {/* Module Row */}
                                                        <button 
                                                            onClick={() => setExpandedModules(prev => ({ ...prev, [module.id]: !prev[module.id] }))}
                                                            className="w-full flex items-center justify-between px-5 py-4 bg-slate-50/50 hover:bg-slate-50 text-left border-b border-slate-100"
                                                        >
                                                            <div className="min-w-0 flex-1 pr-4">
                                                                <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Module {module.module_number}</span>
                                                                <h4 className="font-extrabold text-xs md:text-sm text-slate-800 mt-0.5 truncate">{module.title}</h4>
                                                                <p className="text-[10px] text-slate-400 mt-0.5 truncate">{module.description}</p>
                                                            </div>
                                                            <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${isModExpanded ? 'rotate-90' : ''}`} />
                                                        </button>

                                                        {/* Module Chapters (Collapsed/Expanded) */}
                                                        {isModExpanded && (
                                                            <div className="p-4 bg-white space-y-3">
                                                                {chapters.length === 0 ? (
                                                                    <p className="text-[10px] text-slate-400 py-2">No chapters published in this module.</p>
                                                                ) : (
                                                                    chapters.map((chapter) => {
                                                                        const isChapExpanded = !!expandedChapters[chapter.id];
                                                                        const lessons = courseLessons.filter(l => l.chapter_id === chapter.id);

                                                                        return (
                                                                            <div key={chapter.id} className="border border-slate-100 rounded-xl overflow-hidden">
                                                                                {/* Chapter Row */}
                                                                                <button
                                                                                    onClick={() => setExpandedChapters(prev => ({ ...prev, [chapter.id]: !prev[chapter.id] }))}
                                                                                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/20 hover:bg-slate-50/60 text-left border-b border-slate-100"
                                                                                >
                                                                                    <div className="min-w-0 flex-1 pr-4">
                                                                                        <h5 className="font-bold text-xs text-slate-800 truncate">Chapter {chapter.chapter_number}: {chapter.title}</h5>
                                                                                    </div>
                                                                                    <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${isChapExpanded ? 'rotate-90' : ''}`} />
                                                                                </button>

                                                                                {/* Chapter Lessons */}
                                                                                {isChapExpanded && (
                                                                                    <div className="p-2 bg-white space-y-1">
                                                                                        {lessons.length === 0 ? (
                                                                                            <p className="text-[10px] text-slate-400 p-2">No lessons published in this chapter.</p>
                                                                                        ) : (
                                                                                            lessons.map((lesson) => {
                                                                                                const status = getLessonStatus(lesson.id, chapter.id, module.id);
                                                                                                const isCompleted = status === 'completed';
                                                                                                const isLocked = status === 'locked';

                                                                                                return (
                                                                                                    <div 
                                                                                                        key={lesson.id}
                                                                                                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                                                                                                            isCompleted
                                                                                                                ? 'bg-emerald-50/40 border-emerald-100/50'
                                                                                                                : isLocked
                                                                                                                    ? 'bg-slate-50/30 border-slate-100 opacity-60'
                                                                                                                    : 'bg-white border-slate-100 shadow-2xs'
                                                                                                        }`}
                                                                                                    >
                                                                                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                                                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                                                                                                                isCompleted
                                                                                                                    ? 'bg-emerald-50 border-emerald-100 text-emerald-500'
                                                                                                                    : isLocked
                                                                                                                        ? 'bg-slate-100 border-slate-200 text-slate-400'
                                                                                                                        : 'bg-amber-50 border-amber-100 text-amber-500'
                                                                                                            }`}>
                                                                                                                {isCompleted ? <Check className="w-4 h-4" /> : <Music className="w-4 h-4" />}
                                                                                                            </div>
                                                                                                            <div className="min-w-0 flex-1">
                                                                                                                <h6 className="font-extrabold text-[11px] text-slate-800 truncate">
                                                                                                                    {lesson.lesson_number}. {lesson.title}
                                                                                                                </h6>
                                                                                                                <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                                                                                                    {lesson.duration || '5 mins'} · {lesson.difficulty || 'Easy'}
                                                                                                                </p>
                                                                                                            </div>
                                                                                                        </div>

                                                                                                        {/* Mark Completed/Locked state trigger */}
                                                                                                        {isLocked ? (
                                                                                                            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md shrink-0">
                                                                                                                Locked
                                                                                                            </span>
                                                                                                        ) : (
                                                                                                            <button
                                                                                                                onClick={() => handleToggleLessonComplete(lesson.id, status)}
                                                                                                                className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all shrink-0 ${
                                                                                                                    isCompleted
                                                                                                                        ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                                                                                                                        : 'bg-slate-100 hover:bg-amber-500/10 hover:text-amber-600 text-slate-600 border border-slate-200/50'
                                                                                                                }`}
                                                                                                            >
                                                                                                                {isCompleted ? 'Completed ✓' : 'Mark Complete'}
                                                                                                            </button>
                                                                                                        )}
                                                                                                    </div>
                                                                                                );
                                                                                            })
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Right: Classmates List */}
                                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs text-left">
                                    <h3 className="font-extrabold text-slate-800 text-sm md:text-base flex items-center gap-2 mb-4">
                                        <Users className="w-5 h-5 text-amber-500" />
                                        Batch Classmates ({classmates.length})
                                    </h3>

                                    {classmates.length === 0 ? (
                                        <div className="py-6 text-center text-slate-400">
                                            <p className="text-xs">No classmates enrolled yet.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {classmates.map((mate) => (
                                                <div key={mate.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                                                    <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                                                        {mate.profile_pic_url ? (
                                                            <img src={mate.profile_pic_url} alt={mate.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-[#d46211] text-sm font-extrabold">{mate.name.charAt(0)}</span>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <h5 className="font-bold text-xs text-slate-800 truncate">{mate.name}</h5>
                                                        <span className="inline-block bg-slate-100 text-slate-500 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase mt-0.5">
                                                            {mate.level}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ──── TASKS & SUBMISSIONS TAB ──── */}
                    {activeTab === 'tasks' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Filter Section Tabs */}
                            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs text-left">
                                <div className="flex items-center justify-between mb-5">
                                    <div>
                                        <h3 className="font-extrabold text-slate-800 text-base">Assignments</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">Practice list assigned by your instructor</p>
                                    </div>
                                </div>

                                {assignments.length === 0 ? (
                                    <div className="py-12 text-center text-slate-400">
                                        <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                        <p className="text-xs font-bold text-slate-700">No assignments assigned.</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Your teacher has not uploaded any tasks yet.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {assignments.map((asg) => {
                                            const statusClass = 
                                                asg.status === 'approved' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                                                asg.status === 'reviewed' ? 'bg-blue-50 border-blue-100 text-blue-700' :
                                                asg.status === 'submitted' ? 'bg-indigo-50 border-indigo-100 text-indigo-700' :
                                                'bg-amber-50 border-amber-100 text-amber-700';

                                            return (
                                                <div 
                                                    key={asg.id} 
                                                    className="bg-white border border-slate-150 rounded-2xl p-5 hover:shadow-xs transition-shadow flex flex-col justify-between text-left"
                                                >
                                                    <div>
                                                        <div className="flex justify-between items-start gap-4">
                                                            <h4 className="font-extrabold text-xs md:text-sm text-slate-800 line-clamp-1">{asg.title}</h4>
                                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shrink-0 ${statusClass}`}>
                                                                {asg.status === 'submitted' ? 'Submitted (Pending)' : asg.status}
                                                            </span>
                                                        </div>

                                                        <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                                                            {asg.description || 'No detailed instructions.'}
                                                        </p>

                                                        {asg.file_url && (
                                                            <a 
                                                                href={asg.file_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 text-[10px] font-bold text-[#ecb613] bg-amber-50 border border-amber-100 rounded-md px-2 py-1 mt-3.5 hover:bg-amber-100 transition-colors"
                                                            >
                                                                <Download className="w-3.5 h-3.5" />
                                                                {asg.file_name || 'View Attachment'}
                                                            </a>
                                                        )}
                                                    </div>

                                                    <div className="border-t border-slate-100 pt-4 mt-4 flex items-center justify-between gap-4">
                                                        <span className="text-[10px] text-slate-400 font-semibold">
                                                            {asg.due_date ? `Due: ${new Date(asg.due_date).toLocaleDateString()}` : 'No due date'}
                                                        </span>

                                                        <button 
                                                            onClick={() => {
                                                                setSelectedAssignment(asg);
                                                                setSubmitVideoUrl(asg.video_url || '');
                                                            }}
                                                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-1 ${
                                                                asg.status === 'approved' || asg.status === 'reviewed'
                                                                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                                    : 'bg-amber-500 hover:bg-amber-600 text-white shadow-2xs'
                                                            }`}
                                                        >
                                                            <Video className="w-3.5 h-3.5" />
                                                            {asg.status === 'pending' ? 'Submit' : 'Update'}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ──── MESSAGES TAB ──── */}
                    {activeTab === 'messages' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs text-left">
                                <h3 className="font-extrabold text-slate-800 text-base mb-1">Message Center</h3>
                                <p className="text-xs text-slate-500 mb-6">Timeline of announcements and practice alerts sent by the teacher</p>

                                {broadcasts.length === 0 ? (
                                    <div className="py-12 border border-dashed border-slate-100 rounded-2xl text-center bg-slate-50/50">
                                        <Mail className="w-10 h-10 text-slate-350 mx-auto mb-2" />
                                        <p className="text-xs font-bold text-slate-700">Inbox empty.</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">You don't have any messages yet.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {broadcasts.map((b) => (
                                            <div 
                                                key={b.id} 
                                                className="bg-slate-50/40 border border-slate-150 rounded-2xl p-5 hover:bg-slate-50/80 transition-all flex flex-col justify-between gap-4 text-left"
                                            >
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                                    <div>
                                                        <h4 className="font-extrabold text-xs md:text-sm text-slate-800">{b.subject}</h4>
                                                        <span className="inline-block text-[8px] font-black text-amber-600 bg-amber-50 rounded px-1.5 py-0.5 mt-1 uppercase tracking-wider">
                                                            Channel: {b.channel}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                                                        {new Date(b.created_at).toLocaleDateString()} at {new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>

                                                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                                                    {b.content}
                                                </p>

                                                {/* Audio Note attachment */}
                                                {b.audio_attachment && (
                                                    <div className="pt-2">
                                                        <button 
                                                            onClick={() => playVoiceNote(b.id, b.audio_attachment!)}
                                                            className={`inline-flex items-center gap-2 px-4 py-2 border rounded-full text-xs font-extrabold transition-all shadow-2xs ${
                                                                playingAudioId === b.id 
                                                                    ? 'bg-amber-500 text-white border-amber-600'
                                                                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                                                            }`}
                                                        >
                                                            {playingAudioId === b.id ? (
                                                                <>
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    Playing Audio...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Volume2 className="w-3.5 h-3.5 text-amber-500" />
                                                                    Listen to Voice Note / Flute Tone
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ──── ATTENDANCE TAB ──── */}
                    {activeTab === 'attendance' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Attendance statistics */}
                            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs text-left">
                                <h3 className="font-extrabold text-slate-800 text-base mb-1">Attendance Tracker</h3>
                                <p className="text-xs text-slate-500 mb-6">Total attendance stats and class record history</p>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                                    <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-2xl p-4 text-center shrink-0">
                                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block">Present</span>
                                        <h4 className="font-extrabold text-xl text-slate-800 mt-1">{attendanceStats.present} Classes</h4>
                                    </div>
                                    <div className="bg-amber-50/50 border border-amber-100/50 rounded-2xl p-4 text-center shrink-0">
                                        <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest block">Late</span>
                                        <h4 className="font-extrabold text-xl text-slate-800 mt-1">{attendanceStats.late} Classes</h4>
                                    </div>
                                    <div className="bg-rose-50/50 border border-rose-100/50 rounded-2xl p-4 text-center shrink-0">
                                        <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest block">Absent</span>
                                        <h4 className="font-extrabold text-xl text-slate-800 mt-1">{attendanceStats.absent} Classes</h4>
                                    </div>
                                    <div className="bg-blue-50/50 border border-blue-100/50 rounded-2xl p-4 text-center shrink-0">
                                        <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest block">Excused</span>
                                        <h4 className="font-extrabold text-xl text-slate-800 mt-1">{attendanceStats.excused} Classes</h4>
                                    </div>
                                </div>

                                {mergedLogs.length === 0 ? (
                                    <div className="py-12 border border-dashed border-slate-100 rounded-2xl text-center bg-slate-50/50">
                                        <Calendar className="w-10 h-10 text-slate-350 mx-auto mb-2" />
                                        <p className="text-xs font-bold text-slate-700">No classroom logs found.</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Your teacher has not logged any classroom sessions yet.</p>
                                    </div>
                                ) : (
                                    <div className="border border-slate-150 rounded-2xl overflow-hidden">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 text-left border-b border-slate-150">
                                                    <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date & Start Time</th>
                                                    <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Class Type</th>
                                                    <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Duration</th>
                                                    <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">My Attendance</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {mergedLogs.map((row) => {
                                                    const badgeClass =
                                                        row.status === 'present' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                        row.status === 'late' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                        row.status === 'absent' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                        row.status === 'excused' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        'bg-slate-50 text-slate-500 border-slate-200';

                                                    const formattedDate = row.started_at
                                                        ? new Date(row.started_at).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                                                        : new Date(row.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                                                    
                                                    const formattedTime = row.started_at
                                                        ? new Date(row.started_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                                                        : null;

                                                    let durationStr = '—';
                                                    if (row.duration_seconds !== null) {
                                                        const durationMins = Math.floor(row.duration_seconds / 60);
                                                        const durationHrs = Math.floor(durationMins / 60);
                                                        const remMins = durationMins % 60;
                                                        durationStr = durationHrs > 0 
                                                            ? `${durationHrs}h ${remMins}m`
                                                            : `${durationMins} min${durationMins !== 1 ? 's' : ''}`;
                                                    }

                                                    return (
                                                        <tr key={row.id} className="hover:bg-slate-50/30">
                                                            <td className="px-5 py-3.5 text-xs font-bold text-slate-800">
                                                                <div>{formattedDate}</div>
                                                                {formattedTime && (
                                                                    <div className="text-[10px] text-slate-400 font-semibold mt-0.5">at {formattedTime}</div>
                                                                )}
                                                            </td>
                                                            <td className="px-5 py-3.5 text-xs">
                                                                {row.session_type === 'online' ? (
                                                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-full font-black text-[9px] uppercase tracking-wider">
                                                                        Online Video Class
                                                                    </span>
                                                                ) : row.session_type === 'offline' ? (
                                                                    <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-full font-black text-[9px] uppercase tracking-wider">
                                                                        In-Person Class
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-2 py-0.5 bg-slate-50 text-slate-500 border border-slate-200 rounded-full font-black text-[9px] uppercase tracking-wider">
                                                                        Manual Entry
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-5 py-3.5 text-xs font-bold text-slate-600">
                                                                {durationStr}
                                                            </td>
                                                            <td className="px-5 py-3.5">
                                                                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider ${badgeClass}`}>
                                                                    {row.status}
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
                        </div>
                    )}

                    {/* ──── LIBRARY & TOOLS TAB ──── */}
                    {activeTab === 'library' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Class Notes board */}
                            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs text-left">
                                <h3 className="font-extrabold text-slate-800 text-base mb-1">Class Notes & Materials</h3>
                                <p className="text-xs text-slate-500 mb-6">Resources and reference material uploaded by your instructor</p>

                                {classNotes.length === 0 ? (
                                    <div className="py-12 border border-dashed border-slate-100 rounded-2xl text-center bg-slate-50/50">
                                        <FileText className="w-10 h-10 text-slate-350 mx-auto mb-2" />
                                        <p className="text-xs font-bold text-slate-700">No notes found.</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Your teacher has not posted class notes yet.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                                        {classNotes.map((note) => {
                                            // Dynamic note color styling
                                            const bgClass =
                                                note.color === 'blue' ? 'bg-blue-50/50 border-blue-105/50' :
                                                note.color === 'green' ? 'bg-emerald-50/50 border-emerald-105/50' :
                                                note.color === 'rose' ? 'bg-rose-50/50 border-rose-105/50' :
                                                'bg-amber-50/40 border-amber-105/40';

                                            return (
                                                <div 
                                                    key={note.id} 
                                                    className={`border rounded-2xl p-5 hover:shadow-xs transition-shadow flex flex-col justify-between gap-4 text-left ${bgClass}`}
                                                >
                                                    <div>
                                                        <h4 className="font-extrabold text-xs md:text-sm text-slate-800">{note.title}</h4>
                                                        <p className="text-[11px] text-slate-500 mt-2 line-clamp-4 leading-relaxed whitespace-pre-wrap">
                                                            {note.content}
                                                        </p>
                                                    </div>

                                                    <div className="pt-3 border-t border-slate-150/40 flex items-center justify-between">
                                                        <span className="text-[8px] font-bold text-slate-400">
                                                            {new Date(note.created_at).toLocaleDateString()}
                                                        </span>

                                                        {note.file_url && (
                                                            <a 
                                                                href={note.file_url} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-white border border-slate-200 px-2 py-1 rounded-md hover:bg-slate-50 transition-colors"
                                                            >
                                                                <Download className="w-3 h-3" /> Download
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Practice Tools */}
                            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs text-left">
                                <h3 className="font-extrabold text-slate-800 text-base mb-1">Practice Tools</h3>
                                <p className="text-xs text-slate-500 mb-6">Interactive instruments to support your flute rehearsal sessions</p>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="border border-slate-150 rounded-2xl p-5 hover:shadow-xs transition-shadow flex flex-col justify-between items-start gap-4 bg-slate-50/20">
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0 border border-amber-100">
                                                <Volume2 className="w-5 h-5" />
                                            </div>
                                            <div className="text-left">
                                                <h4 className="font-extrabold text-xs md:text-sm text-slate-800">Practice Metronome</h4>
                                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                                    Keep perfect time with speed adjustments, custom beats, subdivisions, and ramp acceleration modes.
                                                </p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                setPracticeSuiteTab('metronome');
                                                setShowPracticeSuite(true);
                                            }}
                                            className="px-4 py-2 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-900 font-extrabold text-xs rounded-xl shadow-xs transition-colors mt-2"
                                        >
                                            Open Metronome
                                        </button>
                                    </div>
 
                                    <div className="border border-slate-150 rounded-2xl p-5 hover:shadow-xs transition-shadow flex flex-col justify-between items-start gap-4 bg-slate-50/20">
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#d46211] flex items-center justify-center shrink-0 border border-orange-100">
                                                <Music className="w-5 h-5" />
                                            </div>
                                            <div className="text-left">
                                                <h4 className="font-extrabold text-xs md:text-sm text-slate-800">Tanpura Drone</h4>
                                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                                    A plucked Indian classical string drone to align your shruti (pitch scales) and tune your flute.
                                                </p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                setPracticeSuiteTab('metronome');
                                                setShowPracticeSuite(true);
                                            }}
                                            className="px-4 py-2 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-900 font-extrabold text-xs rounded-xl shadow-xs transition-colors mt-2"
                                        >
                                            Open Tanpura
                                        </button>
                                    </div>
 
                                    <div className="border border-slate-150 rounded-2xl p-5 hover:shadow-xs transition-shadow flex flex-col justify-between items-start gap-4 bg-slate-50/20">
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-[#d46211]/10 text-[#d46211] flex items-center justify-center shrink-0 border border-[#d46211]/20">
                                                <span className="material-symbols-outlined text-xl font-bold">album</span>
                                            </div>
                                            <div className="text-left">
                                                <h4 className="font-extrabold text-xs md:text-sm text-slate-800">Drum Beats Sequencer</h4>
                                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                                    An interactive step sequencer featuring synthesized Kick, Snare, Hi-hat, and Shaker drums to practice flute play-along grooves.
                                                </p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                setPracticeSuiteTab('drums');
                                                setShowPracticeSuite(true);
                                            }}
                                            className="px-4 py-2 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-900 font-extrabold text-xs rounded-xl shadow-xs transition-colors mt-2"
                                        >
                                            Open Drum Beats
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Submit Recording Draw Drawer Modal */}
            {selectedAssignment && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 text-left">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
                            <div>
                                <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest block">Submit Practice Recording</span>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1.5 line-clamp-1">{selectedAssignment.title}</h3>
                            </div>
                            <button 
                                onClick={() => {
                                    setSelectedAssignment(null);
                                    setSubmitVideoUrl('');
                                }} 
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 dark:text-slate-500 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSubmitTask} className="p-6 space-y-4">
                            <div className="space-y-1 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Assignment Brief</h4>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-3 mt-1">
                                    {selectedAssignment.description || 'No instruction notes provided by the teacher.'}
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="video-url" className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Video / Recording Link</label>
                                <input 
                                    id="video-url"
                                    type="url"
                                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#ecb613] font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-405"
                                    placeholder="e.g., YouTube, Google Drive, Soundcloud, or Vimeo link"
                                    value={submitVideoUrl}
                                    onChange={(e) => setSubmitVideoUrl(e.target.value)}
                                    required
                                />
                                <p className="text-[9px] text-slate-400 mt-1">
                                    Upload your practice recording to Drive or YouTube (unlisted) and paste the link here.
                                </p>
                            </div>

                            {/* Existing Grade summary inside drawer */}
                            {(selectedAssignment.score !== undefined && selectedAssignment.score !== null) && (
                                <div className="p-4 bg-emerald-50/40 border border-emerald-100/50 rounded-2xl space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-widest">Graded Assessment</span>
                                        <span className="font-extrabold text-sm text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Score: {selectedAssignment.score}/10</span>
                                    </div>
                                    {selectedAssignment.feedback_text && (
                                        <p className="text-[11px] text-slate-600 leading-relaxed italic">
                                            "{selectedAssignment.feedback_text}"
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Footer / actions */}
                            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setSelectedAssignment(null);
                                        setSubmitVideoUrl('');
                                    }}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSubmittingTask}
                                    className="px-5 py-2 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-900 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-md hover:shadow-lg disabled:bg-stone-300 disabled:text-slate-500 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
                                >
                                    {isSubmittingTask ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />}
                                    {selectedAssignment.status === 'pending' ? 'Submit Recording' : 'Resubmit Recording'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
        </>
    );
}
