'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../src/lib/supabase-auth';
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

const MetronomeModal = dynamic(() => import('../../src/components/MetronomeModal'), { ssr: false });

interface StudentProfile {
    id: string;
    name: string;
    email: string;
    level?: string;
    profile_pic_url?: string;
    role?: string;
}

interface TaskItem {
    id: string;
    title: string;
    description?: string;
    due_date?: string;
    status: string;
}

interface ClassroomInfo {
    name: string;
    teacher_name?: string;
}

export default function StudentDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<StudentProfile | null>(null);
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [classroom, setClassroom] = useState<ClassroomInfo | null>(null);
    const [attendancePct, setAttendancePct] = useState<number | null>(null);
    const [pendingCount, setPendingCount] = useState(0);
    const [latestFeedback, setLatestFeedback] = useState<{ text: string; teacher: string; date: string } | null>(null);
    const [showMetronome, setShowMetronome] = useState(false);

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabaseAuth.auth.getSession();
            if (!session) { router.push('/login'); return; }

            const userId = session.user.id;

            // 1. Fetch student profile
            const { data: user } = await supabaseAuth
                .from('users')
                .select('id, name, email, level, profile_pic_url, role')
                .eq('id', userId)
                .maybeSingle();

            if (!user || user.role === 'teacher') { router.push('/'); return; }
            setProfile(user);

            // 2. Fetch classroom
            const { data: cs } = await supabaseAuth
                .from('classroom_students')
                .select('classrooms(name, teacher_id, users!teacher_id(name))')
                .eq('student_id', userId)
                .maybeSingle();

            if (cs?.classrooms) {
                const cls = cs.classrooms as any;
                setClassroom({ name: cls.name, teacher_name: cls.users?.name });
            }

            // 3. Fetch tasks assigned to this student
            const { data: attempts } = await supabaseAuth
                .from('task_attempts')
                .select('id, status, tasks!task_id(id, title, description)')
                .eq('student_id', userId)
                .order('id', { ascending: false })
                .limit(10);

            if (attempts) {
                const formatted: TaskItem[] = attempts.map((a: any) => ({
                    id: a.tasks?.id || a.id,
                    title: a.tasks?.title || 'Task',
                    description: a.tasks?.description,
                    status: a.status,
                }));
                setTasks(formatted);
                setPendingCount(formatted.filter(t => t.status === 'pending' || t.status === 'submitted').length);
            }

            // 4. Fetch attendance
            const { data: att } = await supabaseAuth
                .from('attendance')
                .select('status')
                .eq('student_id', userId);

            if (att && att.length > 0) {
                const present = att.filter((a: any) => a.status === 'present').length;
                setAttendancePct(Math.round((present / att.length) * 100));
            }

            // 5. Latest feedback
            const { data: feedbackData } = await supabaseAuth
                .from('task_attempts')
                .select('attempt_files(feedback_text), tasks!task_id(title)')
                .eq('student_id', userId)
                .not('attempt_files', 'is', null)
                .order('id', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (feedbackData) {
                const files = (feedbackData as any).attempt_files;
                const text = Array.isArray(files) ? files[0]?.feedback_text : files?.feedback_text;
                if (text) {
                    setLatestFeedback({
                        text,
                        teacher: (cs?.classrooms as any)?.users?.name || 'Your Teacher',
                        date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
                    });
                }
            }

            setLoading(false);
        };
        init();
    }, [router]);

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8f7f6]">
                <Loader2 className="w-10 h-10 animate-spin text-[#d46211] mb-4" />
                <p className="font-medium text-slate-600" style={{ fontFamily: 'Lexend, sans-serif' }}>Loading your dashboard...</p>
            </div>
        );
    }

    const levelLabel = profile?.level
        ? profile.level.charAt(0).toUpperCase() + profile.level.slice(1)
        : 'Beginner';

    const attDisplay = attendancePct !== null ? `${attendancePct}%` : '—';

    return (
        <>
        {showMetronome && <MetronomeModal onClose={() => setShowMetronome(false)} />}
        <div className="bg-[#f8f7f6] text-slate-900 min-h-screen" style={{ fontFamily: 'Lexend, sans-serif' }}>
            {/* Google Fonts */}
            <link href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" rel="stylesheet" />

            {/* Header */}
            <header className="flex items-center justify-between px-6 md:px-16 py-4 bg-white border-b border-[#d46211]/10 sticky top-0 z-40 shadow-sm">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-3 text-[#d46211]">
                        <span className="material-symbols-outlined text-3xl">music_note</span>
                        <h2 className="text-slate-900 text-xl font-bold tracking-tight">Krishna Flute Academy</h2>
                    </div>
                    <nav className="hidden lg:flex items-center gap-8">
                        <span className="text-[#d46211] font-semibold text-sm border-b-2 border-[#d46211] pb-1">Dashboard</span>
                        <span className="text-slate-500 text-sm font-medium cursor-pointer hover:text-[#d46211] transition-colors">My Tasks</span>
                        <span className="text-slate-500 text-sm font-medium cursor-pointer hover:text-[#d46211] transition-colors">Schedule</span>
                    </nav>
                </div>
                <div className="flex items-center gap-4">
                    <button className="relative text-slate-500 hover:text-[#d46211] transition-colors">
                        <span className="material-symbols-outlined text-2xl">notifications</span>
                        {pendingCount > 0 && (
                            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[#d46211] text-white text-[10px] font-bold flex items-center justify-center">{pendingCount}</span>
                        )}
                    </button>
                    {profile?.profile_pic_url ? (
                        <img src={profile.profile_pic_url} alt={profile.name} className="size-10 rounded-full object-cover border-2 border-[#d46211]/20" />
                    ) : (
                        <div className="size-10 rounded-full bg-[#d46211]/10 border-2 border-[#d46211]/20 flex items-center justify-center text-[#d46211] font-bold text-lg">
                            {profile?.name?.charAt(0) || 'S'}
                        </div>
                    )}
                    <button onClick={handleLogout} className="text-sm text-slate-500 hover:text-[#d46211] transition-colors font-medium hidden md:block">Logout</button>
                </div>
            </header>

            <main className="px-6 md:px-16 py-8 max-w-[1440px] mx-auto w-full">
                {/* Welcome Section */}
                <section className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <div className="flex items-center gap-6">
                        <div className="size-24 md:size-28 rounded-full border-4 border-white shadow-lg bg-[#d46211]/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {profile?.profile_pic_url ? (
                                <img src={profile.profile_pic_url} alt={profile.name} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-[#d46211] text-4xl font-bold">{profile?.name?.charAt(0)}</span>
                            )}
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold leading-tight">Welcome back, {profile?.name?.split(' ')[0]}!</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="material-symbols-outlined text-[#d46211] text-xl">workspace_premium</span>
                                <p className="text-[#d46211] font-semibold">{levelLabel} Level</p>
                            </div>
                            {classroom && (
                                <p className="text-slate-500 text-sm mt-1">
                                    {classroom.name}{classroom.teacher_name ? ` · ${classroom.teacher_name}` : ''}
                                </p>
                            )}
                        </div>
                    </div>
                    <button onClick={handleLogout} className="md:hidden bg-[#d46211]/10 text-[#d46211] px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">logout</span>Logout
                    </button>
                </section>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    {/* Next Class */}
                    <div className="flex flex-col gap-2 rounded-xl p-6 bg-white border border-[#d46211]/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-orange-50 rounded-lg text-[#d46211]">
                                <span className="material-symbols-outlined">calendar_today</span>
                            </div>
                            <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">Batch</p>
                        </div>
                        <p className="text-slate-900 tracking-tight text-2xl font-bold">{classroom?.name || 'Not Enrolled'}</p>
                        <p className="text-slate-400 text-xs">{classroom?.teacher_name ? `With ${classroom.teacher_name}` : 'Contact teacher to enroll'}</p>
                    </div>

                    {/* Attendance */}
                    <div className="flex flex-col gap-2 rounded-xl p-6 bg-white border border-[#d46211]/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-green-50 rounded-lg text-green-600">
                                <span className="material-symbols-outlined">query_stats</span>
                            </div>
                            <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">Attendance</p>
                        </div>
                        <p className="text-slate-900 tracking-tight text-2xl font-bold">{attDisplay}</p>
                        {attendancePct !== null && (
                            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1">
                                <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${attendancePct}%` }} />
                            </div>
                        )}
                        {attendancePct === null && <p className="text-slate-400 text-xs">No attendance records yet</p>}
                    </div>

                    {/* Tasks */}
                    <div className="flex flex-col gap-2 rounded-xl p-6 bg-white border border-[#d46211]/10 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                <span className="material-symbols-outlined">assignment_late</span>
                            </div>
                            <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">Task Status</p>
                        </div>
                        <p className="text-slate-900 tracking-tight text-2xl font-bold">
                            {pendingCount > 0 ? `${pendingCount} Pending` : 'All Caught Up'}
                        </p>
                        <p className="text-slate-400 text-xs">{tasks.length} total tasks assigned</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Tasks Section */}
                    <div className="lg:col-span-2">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold tracking-tight">My Tasks</h2>
                        </div>

                        {tasks.length === 0 ? (
                            <div className="rounded-xl border border-[#d46211]/10 bg-white shadow-sm p-12 text-center">
                                <span className="material-symbols-outlined text-5xl text-slate-300 mb-3 block">assignment</span>
                                <p className="text-slate-500 font-medium">No tasks assigned yet.</p>
                                <p className="text-slate-400 text-sm mt-1">Your teacher will assign practice tasks here.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Priority task (first) */}
                                {tasks[0] && (
                                    <div className="flex flex-col overflow-hidden rounded-xl border border-[#d46211]/10 bg-white shadow-md">
                                        <div className="flex flex-col p-6">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="text-slate-900 text-xl font-bold">{tasks[0].title}</h3>
                                                    {tasks[0].description && (
                                                        <p className="text-slate-500 mt-2 leading-relaxed text-sm">{tasks[0].description}</p>
                                                    )}
                                                </div>
                                                <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase flex-shrink-0 ml-4 ${
                                                    tasks[0].status === 'reviewed' || tasks[0].status === 'approved'
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-[#d46211]/10 text-[#d46211]'
                                                }`}>
                                                    {tasks[0].status === 'submitted' ? 'Pending Review' : tasks[0].status}
                                                </span>
                                            </div>
                                            <div className="border-t border-slate-100 pt-4 flex justify-end">
                                                <button className="flex items-center justify-center gap-2 rounded-xl h-11 px-6 bg-[#d46211] text-white text-sm font-bold shadow-lg shadow-[#d46211]/20 hover:scale-[1.02] transition-transform">
                                                    <span className="material-symbols-outlined text-sm">video_call</span>
                                                    Upload Practice Video
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Remaining tasks */}
                                {tasks.slice(1).map(task => (
                                    <div key={task.id} className="p-5 rounded-xl border border-[#d46211]/5 bg-white flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-4">
                                            <div className="size-11 rounded-lg bg-[#d46211]/10 text-[#d46211] flex items-center justify-center flex-shrink-0">
                                                <span className="material-symbols-outlined">music_note</span>
                                            </div>
                                            <div>
                                                <h4 className="text-slate-900 font-bold text-sm">{task.title}</h4>
                                                <p className="text-slate-400 text-xs capitalize mt-0.5">{task.status === 'submitted' ? 'Pending review' : task.status}</p>
                                            </div>
                                        </div>
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                            task.status === 'reviewed' || task.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                        }`}>
                                            {task.status === 'reviewed' ? '✓ Reviewed' : task.status === 'approved' ? '✓ Approved' : 'Pending'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Side Panel */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-24 space-y-6">
                            {/* Teacher Feedback */}
                            <div>
                                <h2 className="text-2xl font-bold mb-5 tracking-tight">Teacher Feedback</h2>
                                <div className="bg-white rounded-xl p-6 border border-[#d46211]/10 shadow-sm">
                                    {latestFeedback ? (
                                        <>
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="size-10 rounded-full bg-[#d46211]/10 flex items-center justify-center text-[#d46211] font-bold">
                                                    {classroom?.teacher_name?.charAt(0) || 'T'}
                                                </div>
                                                <div>
                                                    <p className="text-slate-900 font-bold text-sm">{latestFeedback.teacher}</p>
                                                    <p className="text-slate-400 text-xs">{latestFeedback.date}</p>
                                                </div>
                                            </div>
                                            <div className="bg-[#d46211]/5 rounded-lg p-4 relative mb-4">
                                                <span className="material-symbols-outlined absolute -top-2 -left-2 text-[#d46211] opacity-20 text-3xl">format_quote</span>
                                                <p className="text-slate-700 text-sm leading-relaxed italic">"{latestFeedback.text}"</p>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center py-6">
                                            <span className="material-symbols-outlined text-4xl text-slate-300 block mb-2">rate_review</span>
                                            <p className="text-slate-500 text-sm font-medium">No feedback yet</p>
                                            <p className="text-slate-400 text-xs mt-1">Complete tasks to receive feedback from your teacher.</p>
                                        </div>
                                    )}

                                    {/* Progress bars */}
                                    <div className="mt-6 pt-6 border-t border-slate-100">
                                        <h4 className="text-slate-900 font-bold text-sm mb-4">My Progress</h4>
                                        <div className="space-y-4">
                                            <div>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-slate-500">Tasks Completed</span>
                                                    <span className="font-bold text-[#d46211]">
                                                        {tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'reviewed' || t.status === 'approved').length / tasks.length) * 100) : 0}%
                                                    </span>
                                                </div>
                                                <div className="w-full bg-slate-100 h-1.5 rounded-full">
                                                    <div className="bg-[#d46211] h-1.5 rounded-full transition-all" style={{
                                                        width: tasks.length > 0 ? `${Math.round((tasks.filter(t => t.status === 'reviewed' || t.status === 'approved').length / tasks.length) * 100)}%` : '0%'
                                                    }} />
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-slate-500">Attendance</span>
                                                    <span className="font-bold text-[#d46211]">{attDisplay}</span>
                                                </div>
                                                <div className="w-full bg-slate-100 h-1.5 rounded-full">
                                                    <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: attendancePct !== null ? `${attendancePct}%` : '0%' }} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Links */}
                            <div className="grid grid-cols-2 gap-4">
                                <button className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-[#d46211]/10 gap-2 hover:shadow-md transition-shadow">
                                    <span className="material-symbols-outlined text-[#d46211] text-3xl">library_music</span>
                                    <span className="text-xs font-bold text-slate-600">Sheet Music</span>
                                </button>
                                <button onClick={() => setShowMetronome(true)} className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-[#d46211]/10 gap-2 hover:shadow-md hover:border-[#d46211]/30 transition-all group">
                                    <span className="material-symbols-outlined text-[#d46211] text-3xl group-hover:scale-110 transition-transform">timer</span>
                                    <span className="text-xs font-bold text-slate-600">Metronome</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Mobile Bottom Bar */}
            <footer className="md:hidden sticky bottom-0 w-full bg-white border-t border-[#d46211]/10 p-4 flex justify-around items-center z-50">
                <button className="text-[#d46211] flex flex-col items-center gap-1">
                    <span className="material-symbols-outlined">home</span>
                    <span className="text-[10px] font-bold">Home</span>
                </button>
                <button className="text-slate-400 flex flex-col items-center gap-1">
                    <span className="material-symbols-outlined">assignment</span>
                    <span className="text-[10px] font-bold">Tasks</span>
                </button>
                <button className="bg-[#d46211] text-white size-12 rounded-full flex items-center justify-center -mt-8 shadow-lg">
                    <span className="material-symbols-outlined text-3xl">mic</span>
                </button>
                <button className="text-slate-400 flex flex-col items-center gap-1">
                    <span className="material-symbols-outlined">calendar_month</span>
                    <span className="text-[10px] font-bold">Schedule</span>
                </button>
                <button onClick={handleLogout} className="text-slate-400 flex flex-col items-center gap-1">
                    <span className="material-symbols-outlined">person</span>
                    <span className="text-[10px] font-bold">Profile</span>
                </button>
            </footer>
        </div>
        </>  
    );
}
