'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabaseAuth } from '../../../../src/lib/supabase-auth';
import { Loader2, ArrowLeft, Search, Bell, HelpCircle, Users, Mail, Video, TrendingUp, Zap, Star, MoreVertical, Lightbulb, Edit3, PlusCircle, FileUp, Plus, GripVertical, CheckCircle, Circle, FileText, Film, Lock, Music, UserPlus, AlertTriangle, Sparkles, BarChart2 } from 'lucide-react';
import Link from 'next/link';
import TeacherSidebar from '../../../../src/components/TeacherSidebar';

interface ClassroomDetails {
    id: string;
    name: string;
    description: string;
    status: string;
    created_at: string;
}

interface EnrolledStudent {
    id: string; // classroom_students ID
    student_id: string; // real user ID
    name: string;
    profile_pic_url: string | null;
    joined_at: string;
    // Mock metrics for UI
    mock_score: number;
    mock_progress: number;
    mock_attendance: number;
    mock_milestone: string;
    mock_status: 'Consistent' | 'Improving' | 'At Risk';
}

export default function ClassroomDashboardPage() {
    const router = useRouter();
    const params = useParams();
    const classroomId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string } | null>(null);
    const [classroom, setClassroom] = useState<ClassroomDetails | null>(null);
    const [students, setStudents] = useState<EnrolledStudent[]>([]);
    const [activeTab, setActiveTab] = useState('Overview');

    useEffect(() => {
        const fetchData = async () => {
            if (!classroomId) return;
            setLoading(true);
            try {
                // 1. Authenticate
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (!session) {
                    router.push('/login?type=teacher');
                    return;
                }

                // 2. Fetch Teacher Profile
                const { data: profile } = await supabaseAuth
                    .from('users')
                    .select('id, name, email')
                    .eq('id', session.user.id)
                    .single();
                setTeacherProfile(profile);

                if (!profile) return;

                // 3. Fetch Classroom
                const { data: roomData, error: roomError } = await supabaseAuth
                    .from('classrooms')
                    .select('*')
                    .eq('id', classroomId)
                    .eq('teacher_id', profile.id)
                    .single();
                
                if (roomError) throw roomError;
                setClassroom({
                    ...roomData,
                    status: 'Active'
                });

                // 4. Fetch Enrolled Students
                const { data: roster, error: rosterError } = await supabaseAuth
                    .from('classroom_students')
                    .select(`
                        id,
                        student_id,
                        joined_at,
                        users!student_id(name, profile_pic_url)
                    `)
                    .eq('classroom_id', classroomId);

                if (rosterError) throw rosterError;

                // 5. Build Enrolled Students with Mock metrics for the UI
                const statusOptions: ('Consistent' | 'Improving' | 'At Risk')[] = ['Consistent', 'Improving', 'At Risk'];
                const milestoneOptions = ['Alankars Mastery', 'Breath Control II', 'Fingering Basics', 'Rhythm Training', 'Raag Yaman Intros'];
                
                const formattedRoster = (roster || []).map((r: any, idx) => {
                    const seed = parseInt(r.id.substring(0, 8), 16) || idx; // Pseudo-random determinism
                    return {
                        id: r.id,
                        student_id: r.student_id,
                        name: r.users?.name || 'Unknown',
                        profile_pic_url: r.users?.profile_pic_url || null,
                        joined_at: r.joined_at,
                        mock_score: 6 + ((seed % 40) / 10), // 6.0 to 9.9
                        mock_progress: 50 + (seed % 50), // 50 to 99
                        mock_attendance: 70 + (seed % 30), // 70 to 99
                        mock_milestone: milestoneOptions[seed % milestoneOptions.length],
                        mock_status: idx % 3 === 0 ? 'Consistent' : (idx % 2 === 0 ? 'Improving' : 'At Risk') as any
                    };
                });

                setStudents(formattedRoster);

            } catch (err) {
                console.error('Error fetching classroom data:', err);
                router.push('/teacher-dashboard/classrooms');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [classroomId, router]);

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    if (loading || !classroom) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8f8f6]">
                <Loader2 className="w-10 h-10 animate-spin text-[#ecb613] mb-4" />
                <p className="font-medium text-slate-600 tracking-wide uppercase text-xs">Loading Classroom Dashboard...</p>
            </div>
        );
    }

    // Helper metric calculations
    const avgAttendance = students.length > 0
        ? (students.reduce((acc, curr) => acc + curr.mock_attendance, 0) / students.length).toFixed(1)
        : '0.0';

    const getStatusColor = (status: string) => {
        if (status === 'Consistent') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
        if (status === 'Improving') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
        return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
    };
    
    const getProgressBarColor = (status: string) => {
        if (status === 'Consistent') return 'bg-emerald-500';
        if (status === 'Improving') return 'bg-amber-500';
        return 'bg-rose-500';
    };

    const getGrade = (score: number) => {
        if (score >= 9.5) return 'A+';
        if (score >= 8.5) return 'A';
        if (score >= 7.5) return 'B+';
        if (score >= 6.5) return 'B';
        return 'C';
    };

    return (
        <div className="flex min-h-screen bg-[#f8f8f6] dark:bg-[#221d10] text-slate-900 dark:text-slate-100 font-sans">
            <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0">
                {/* TopAppBar */}
                <header className="flex justify-between items-center px-8 h-16 w-full max-w-full mx-auto bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <Link href="/teacher-dashboard/classrooms" className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <h2 className="text-xl font-bold text-[#ecb613] dark:text-[#ecb613]">{classroom.name}</h2>
                        <span className="px-2 py-1 bg-[#ecb613]/10 text-[#ecb613] dark:bg-[#ecb613]/20 dark:text-[#ecb613] text-[10px] font-bold rounded uppercase tracking-wider">{classroom.status}</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="relative hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input 
                                className="pl-10 pr-4 py-1.5 bg-slate-100 dark:bg-slate-800 border-none rounded-full text-sm w-64 focus:ring-2 focus:ring-[#ecb613] outline-none transition-all placeholder:text-slate-400" 
                                placeholder="Search students, tasks..." 
                                type="text" 
                            />
                        </div>
                        <div className="flex items-center gap-4">
                            <button className="text-slate-500 hover:text-[#ecb613] transition-colors">
                                <Bell className="w-5 h-5" />
                            </button>
                            <button className="text-slate-500 hover:text-[#ecb613] transition-colors">
                                <HelpCircle className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </header>

                <div className="p-8 max-w-7xl mx-auto w-full flex-1 overflow-y-auto">
                    {/* Row-wise Tabs (Contextual Navigation) */}
                    <div className="flex items-center gap-8 border-b border-slate-200 dark:border-slate-800 mb-8 overflow-x-auto custom-scrollbar whitespace-nowrap">
                        {['Overview', 'Curriculum', 'Students', 'Assignments', 'Settings'].map((tab) => (
                            <button 
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`pb-4 font-semibold transition-colors border-b-2 ${
                                    activeTab === tab 
                                        ? 'text-[#ecb613] dark:text-[#ecb613] border-[#ecb613] dark:border-[#ecb613]' 
                                        : 'text-slate-500 dark:text-slate-400 hover:text-[#ecb613]/80 border-transparent'
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'Overview' ? (
                        <div className="grid grid-cols-12 gap-6">
                            {/* Progress Summary Card */}
                            <div className="col-span-12 lg:col-span-8 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Individual Progress Summary</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Milestone tracking for the current week</p>
                                    </div>
                                    <button className="text-[#ecb613] text-sm font-semibold hover:underline">View Detailed Analytics</button>
                                </div>
                                <div className="space-y-6">
                                    {students.slice(0, 4).map(student => (
                                        <div key={student.id} className="flex items-center gap-4 group">
                                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700">
                                                {student.profile_pic_url ? (
                                                    <img alt={student.name} className="w-full h-full object-cover" src={student.profile_pic_url} loading="lazy" />
                                                ) : (
                                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{student.name.charAt(0)}</span>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#ecb613] transition-colors">{student.name}</span>
                                                    <span className={`text-xs font-bold ${
                                                        student.mock_status === 'Consistent' ? 'text-emerald-500' : (student.mock_status === 'Improving' ? 'text-[#ecb613]' : 'text-rose-500')
                                                    }`}>{student.mock_milestone}</span>
                                                </div>
                                                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                                    <div className={`h-full ${getProgressBarColor(student.mock_status)}`} style={{ width: `${student.mock_progress}%` }}></div>
                                                </div>
                                            </div>
                                            <span className="text-xs font-bold text-slate-400 w-8 text-right">{student.mock_progress}%</span>
                                        </div>
                                    ))}
                                    {students.length === 0 && (
                                        <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                            <p className="text-slate-500 text-sm font-medium">No students enrolled yet.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Stats Card */}
                            <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                                <div className="bg-[#ecb613] dark:bg-[#ecb613]/90 p-6 rounded-2xl text-slate-900 relative overflow-hidden shadow-lg shadow-[#ecb613]/20">
                                    <div className="absolute -right-4 -bottom-4 opacity-10">
                                        <Users className="w-32 h-32" />
                                    </div>
                                    <h4 className="text-slate-900/70 text-sm font-black uppercase tracking-wider mb-2">Class Attendance</h4>
                                    <div className="flex items-end gap-2 relative z-10">
                                        <span className="text-4xl font-black">{avgAttendance}%</span>
                                        <span className="text-slate-900/80 text-sm font-bold mb-1 pb-1 flex items-center">
                                            <TrendingUp className="w-4 h-4 mr-1 stroke-[3]" />
                                            +2.1%
                                        </span>
                                    </div>
                                    <p className="mt-4 text-xs text-slate-900/80 leading-relaxed font-semibold relative z-10">
                                        Average attendance across recent sessions. Overall class consistency is looking good!
                                    </p>
                                </div>

                                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between flex-1">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Quick Actions</h4>
                                        <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button className="p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-[#ecb613]/10 rounded-xl text-center transition-all group border border-slate-200 dark:border-slate-700 hover:border-[#ecb613]/30 flex flex-col items-center justify-center">
                                            <Mail className="w-6 h-6 text-[#ecb613] mb-2 group-hover:scale-110 transition-transform" />
                                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white uppercase tracking-wide">Email All</span>
                                        </button>
                                        <Link 
                                            href={`/teacher-dashboard/classrooms/${classroomId}/meeting`}
                                            className="p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-[#ecb613]/10 rounded-xl text-center transition-all group border border-slate-200 dark:border-slate-700 hover:border-[#ecb613]/30 flex flex-col items-center justify-center"
                                        >
                                            <Video className="w-6 h-6 text-[#ecb613] mb-2 group-hover:scale-110 transition-transform" />
                                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white uppercase tracking-wide">Start Session</span>
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* Student Roster Table */}
                            <div className="col-span-12 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden mt-2">
                                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Student Roster</h3>
                                    <div className="flex gap-3">
                                        <button className="px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">Export PDF</button>
                                        <Link href="/teacher-dashboard/students/add">
                                            <button className="px-4 py-2 bg-[#ecb613] shadow-md shadow-[#ecb613]/20 hover:bg-[#ecb613]/90 text-slate-900 rounded-xl text-xs font-bold transition-colors">Add Student</button>
                                        </Link>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                                            <tr>
                                                <th className="px-6 py-4">Student Name</th>
                                                <th className="px-6 py-4">Status</th>
                                                <th className="px-6 py-4">Avg. Score</th>
                                                <th className="px-6 py-4">Attendance</th>
                                                <th className="px-6 py-4">Joined Date</th>
                                                <th className="px-6 py-4 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {students.map(student => (
                                                <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-600">
                                                                {student.profile_pic_url ? (
                                                                    <img alt={student.name} className="w-full h-full object-cover" src={student.profile_pic_url} loading="lazy" />
                                                                ) : (
                                                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{student.name.charAt(0)}</span>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <Link href={`/teacher-dashboard/students/${student.student_id}`} className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#ecb613] transition-colors">{student.name}</Link>
                                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">ID: {student.student_id.substring(0, 8)}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wide inline-block border ${getStatusColor(student.mock_status)} border-transparent dark:border-current/20`}>
                                                            {student.mock_status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-sm font-bold text-slate-900 dark:text-white">{student.mock_score.toFixed(1)}</span>
                                                            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm font-bold text-slate-600 dark:text-slate-300">
                                                        {student.mock_attendance}%
                                                    </td>
                                                    <td className="px-6 py-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                                                        {new Date(student.joined_at).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button className="text-slate-400 hover:text-[#ecb613] focus:text-[#ecb613] p-1.5 rounded-lg hover:bg-[#ecb613]/10 transition-all">
                                                            <MoreVertical className="w-5 h-5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {students.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-12 text-center bg-slate-50 dark:bg-slate-800/30">
                                                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No students found. Add some students to start tracking progress.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center rounded-b-2xl">
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Showing {students.length} students</span>
                                    <div className="flex gap-2">
                                        <button className="px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50">Previous</button>
                                        <button className="px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50">Next</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'Curriculum' ? (
                        <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Section 1: Lesson Plan / Syllabus Roadmap */}
                            <section className="mb-12">
                                <div className="flex justify-between items-end mb-6">
                                    <div>
                                        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Syllabus Roadmap</h2>
                                        <p className="text-slate-500 dark:text-slate-400 mt-1">Foundational Flute Techniques & Repertoire</p>
                                    </div>
                                    <button className="bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all shadow-sm">
                                        <Edit3 className="w-5 h-5" />
                                        Edit Roadmap
                                    </button>
                                </div>
                                <div className="relative grid grid-cols-1 md:grid-cols-4 gap-4">
                                    {/* Progress Connection Line (Dashed) */}
                                    <div className="absolute top-1/2 left-0 w-full h-0.5 border-t-2 border-dashed border-slate-200 dark:border-slate-700 -z-10 hidden md:block"></div>
                                    
                                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
                                        <div className="w-8 h-8 bg-[#ecb613] text-slate-900 rounded-full flex items-center justify-center font-black text-xs mb-3 shadow-md shadow-[#ecb613]/20">01</div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">Breath Control</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">Week 1-2</p>
                                        <div className="mt-4 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-[#ecb613] w-full"></div>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
                                        <div className="w-8 h-8 bg-[#ecb613] text-slate-900 rounded-full flex items-center justify-center font-black text-xs mb-3 shadow-md shadow-[#ecb613]/20">02</div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">Embouchure</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">Week 3-4</p>
                                        <div className="mt-4 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-[#ecb613] w-full"></div>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
                                        <div className="w-8 h-8 bg-[#ecb613]/20 dark:bg-[#ecb613]/10 text-[#ecb613] rounded-full flex items-center justify-center font-black text-xs mb-3">03</div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">First Scale</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">Week 5-8</p>
                                        <div className="mt-4 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-[#ecb613] w-1/3"></div>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-slate-50 dark:bg-slate-800/30 p-5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-2 group cursor-pointer hover:border-[#ecb613] hover:bg-[#ecb613]/5 transition-all">
                                        <PlusCircle className="w-8 h-8 text-slate-300 dark:text-slate-600 group-hover:text-[#ecb613] transition-colors" />
                                        <span className="text-sm font-bold text-slate-400 group-hover:text-[#ecb613] transition-colors">Add Milestone</span>
                                    </div>
                                </div>
                            </section>

                            {/* Section 2 & 3: Modules and Materials */}
                            <section className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Curriculum Modules</h2>
                                    <div className="flex gap-3">
                                        <button className="text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm">
                                            <FileUp className="w-4 h-4" />
                                            Upload Resource
                                        </button>
                                        <button className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-sm">
                                            <Plus className="w-4 h-4" />
                                            Add Module
                                        </button>
                                    </div>
                                </div>

                                {/* Module 1 */}
                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm group">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-800">
                                        <div className="flex items-center gap-4">
                                            <GripVertical className="w-5 h-5 text-slate-400 cursor-move opacity-50 group-hover:opacity-100 transition-opacity" />
                                            <div>
                                                <h3 className="font-bold text-slate-900 dark:text-white text-lg">Module 1: Introduction to Flute</h3>
                                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">3 Lessons • 2 Resources • 1 Assignment</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-widest">Active</span>
                                            <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                                                <MoreVertical className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                                        {/* Module Lessons */}
                                        <div className="md:col-span-2 space-y-3">
                                            <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl hover:shadow-md hover:border-[#ecb613]/30 transition-all cursor-pointer group/lesson">
                                                <div className="flex items-center gap-4">
                                                    <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-300 group-hover/lesson:bg-[#ecb613] group-hover/lesson:text-slate-900 transition-colors">1.1</span>
                                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover/lesson:text-slate-900 dark:group-hover/lesson:text-white">Assembling your Instrument</span>
                                                </div>
                                                <CheckCircle className="w-5 h-5 text-emerald-500 fill-emerald-100 dark:fill-emerald-900/40" />
                                            </div>
                                            <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl hover:shadow-md hover:border-[#ecb613]/30 transition-all cursor-pointer group/lesson">
                                                <div className="flex items-center gap-4">
                                                    <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-300 group-hover/lesson:bg-[#ecb613] group-hover/lesson:text-slate-900 transition-colors">1.2</span>
                                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover/lesson:text-slate-900 dark:group-hover/lesson:text-white">Posture and Hand Position</span>
                                                </div>
                                                <CheckCircle className="w-5 h-5 text-emerald-500 fill-emerald-100 dark:fill-emerald-900/40" />
                                            </div>
                                            <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl hover:shadow-md hover:border-[#ecb613]/30 transition-all cursor-pointer group/lesson">
                                                <div className="flex items-center gap-4">
                                                    <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-300 group-hover/lesson:bg-[#ecb613]/50 group-hover/lesson:text-slate-900 transition-colors">1.3</span>
                                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover/lesson:text-slate-900 dark:group-hover/lesson:text-white">The Headjoint Exercise</span>
                                                </div>
                                                <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 stroke-[3]" />
                                            </div>
                                        </div>
                                        {/* Module Materials */}
                                        <div className="bg-slate-50 dark:bg-slate-800/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                            <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Attached Materials</h4>
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-red-500/30 transition-colors cursor-pointer group/mat">
                                                    <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg flex items-center justify-center group-hover/mat:bg-red-100 transition-colors">
                                                        <FileText className="w-5 h-5" />
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate group-hover/mat:text-slate-900 dark:group-hover/mat:text-white">Assembly_Guide.pdf</p>
                                                        <p className="text-[10px] font-medium text-slate-400 mt-0.5">1.2 MB</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500/30 transition-colors cursor-pointer group/mat">
                                                    <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center group-hover/mat:bg-blue-100 transition-colors">
                                                        <Film className="w-5 h-5" />
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate group-hover/mat:text-slate-900 dark:group-hover/mat:text-white">Embouchure_Demo.mp4</p>
                                                        <p className="text-[10px] font-medium text-slate-400 mt-0.5">45.8 MB</p>
                                                    </div>
                                                </div>
                                                <button className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 transition-all flex items-center justify-center gap-2">
                                                    <Plus className="w-4 h-4" /> Add Material
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Module 2 */}
                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm group">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-800">
                                        <div className="flex items-center gap-4">
                                            <GripVertical className="w-5 h-5 text-slate-400 cursor-move opacity-50 group-hover:opacity-100 transition-opacity" />
                                            <div>
                                                <h3 className="font-bold text-slate-900 dark:text-white text-lg">Module 2: Basic Fingerings</h3>
                                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">4 Lessons • 3 Resources • 2 Assignments</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="bg-[#ecb613]/20 text-[#ecb613] text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-widest">In Progress</span>
                                            <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                                                <MoreVertical className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8 opacity-75">
                                        {/* Module Lessons */}
                                        <div className="md:col-span-2 space-y-3">
                                            <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                                                <div className="flex items-center gap-4 opacity-70">
                                                    <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-500">2.1</span>
                                                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Notes B, A, and G</span>
                                                </div>
                                                <Lock className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                                            </div>
                                            <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                                                <div className="flex items-center gap-4 opacity-70">
                                                    <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-500">2.2</span>
                                                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Reading Music Notation</span>
                                                </div>
                                                <Lock className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                                            </div>
                                        </div>
                                        {/* Module Materials */}
                                        <div className="bg-slate-50 dark:bg-slate-800/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                            <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Attached Materials</h4>
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                                    <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg flex items-center justify-center">
                                                        <Music className="w-5 h-5" />
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-400 truncate">Scale_Practice_Track.wav</p>
                                                        <p className="text-[10px] font-medium text-slate-400 mt-0.5">8.4 MB</p>
                                                    </div>
                                                </div>
                                                <button className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                                                    <Plus className="w-4 h-4" /> Add Material
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Empty state for next module */}
                                <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl py-12 flex flex-col items-center justify-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group">
                                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <PlusCircle className="w-6 h-6 text-slate-400 dark:text-slate-500 group-hover:text-[#ecb613] transition-colors" />
                                    </div>
                                    <div className="text-center">
                                        <h4 className="font-bold text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">Create Module 3</h4>
                                        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-1">Define the next steps for your students</p>
                                    </div>
                                </div>
                            </section>
                        </div>
                    ) : activeTab === 'Students' ? (
                        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Actions Header */}
                            <div className="flex justify-between items-end">
                                <div>
                                    <h3 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Student Roster</h3>
                                    <p className="text-slate-500 dark:text-slate-400 mt-1">Managing {students.length} students in {classroom.name}</p>
                                </div>
                                <div className="flex gap-3">
                                    <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm">
                                        <Mail className="w-5 h-5" />
                                        Message All
                                    </button>
                                    <Link href="/teacher-dashboard/students/add">
                                        <button className="flex items-center gap-2 px-4 py-2 bg-[#ecb613] text-slate-900 rounded-lg font-semibold hover:bg-[#ecb613]/90 transition-all shadow-md shadow-[#ecb613]/20">
                                            <UserPlus className="w-5 h-5" />
                                            Add Student to Class
                                        </button>
                                    </Link>
                                </div>
                            </div>

                            {/* Student Table / Roster */}
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mt-2">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Student</th>
                                                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                                                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Progress</th>
                                                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Attendance</th>
                                                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Grade</th>
                                                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                            {students.map(student => (
                                                <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border border-slate-200 dark:border-slate-600 flex items-center justify-center">
                                                                {student.profile_pic_url ? (
                                                                    <img alt={student.name} className="w-full h-full object-cover" src={student.profile_pic_url} loading="lazy" />
                                                                ) : (
                                                                    <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{student.name.charAt(0)}</span>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <Link href={`/teacher-dashboard/students/${student.student_id}`} className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#ecb613] transition-colors">{student.name}</Link>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400">{student.name.toLowerCase().replace(' ', '.')}@academy.edu</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${student.mock_status === 'At Risk' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400' : getStatusColor(student.mock_status)}`}>
                                                            {student.mock_status === 'At Risk' ? 'Needs Attention' : student.mock_status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="w-32">
                                                            <div className="flex justify-between mb-1">
                                                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{student.mock_progress}% Complete</span>
                                                            </div>
                                                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 flex overflow-hidden">
                                                                <div className={`h-1.5 rounded-full ${student.mock_status === 'At Risk' ? 'bg-rose-500' : 'bg-[#ecb613]'}`} style={{ width: `${student.mock_progress}%` }}></div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm font-medium text-slate-700 dark:text-slate-300">{student.mock_attendance}%</td>
                                                    <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{getGrade(student.mock_score)}</td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button className="text-slate-400 hover:text-[#ecb613] transition-colors p-1 rounded-lg">
                                                            <MoreVertical className="w-5 h-5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {students.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-12 text-center bg-slate-50 dark:bg-slate-800/30">
                                                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No students found. Add some students to see them in this roster.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center rounded-b-xl">
                                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Showing {Math.min(students.length, 24)} of {students.length} students</p>
                                    <div className="flex gap-2">
                                        <button className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">Previous</button>
                                        <button className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">Next</button>
                                    </div>
                                </div>
                            </div>

                            {/* Focus Tasks / Assistant View */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:grid-cols-3">
                                <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/50 p-6 rounded-xl shadow-sm">
                                    <div className="flex items-center gap-3 mb-4 text-rose-800 dark:text-rose-400">
                                        <AlertTriangle className="w-5 h-5" />
                                        <h4 className="font-bold">Urgent Attention Needed</h4>
                                    </div>
                                    <p className="text-sm text-rose-700 dark:text-rose-300 mb-4">Julian Chen has missed 3 consecutive classes and hasn't submitted the 'Bach Invention No. 4' assignment.</p>
                                    <button className="w-full py-2 bg-rose-600 dark:bg-rose-700 text-white rounded-lg font-bold text-sm hover:bg-rose-700 dark:hover:bg-rose-600 transition-colors">
                                        Message Guardian
                                    </button>
                                </div>
                                <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/50 p-6 rounded-xl shadow-sm">
                                    <div className="flex items-center gap-3 mb-4 text-indigo-800 dark:text-indigo-400">
                                        <Sparkles className="w-5 h-5" />
                                        <h4 className="font-bold">Next Milestone</h4>
                                    </div>
                                    <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-4">The Mid-Term Performance Exam is in 8 days. 18/{students.length || 24} students have already signed up for their time slots.</p>
                                    <button className="w-full py-2 bg-indigo-600 dark:bg-indigo-700 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors">
                                        Review Exam Schedule
                                    </button>
                                </div>
                                <div className="p-6 rounded-xl shadow-lg relative overflow-hidden text-slate-900 flex flex-col justify-between" style={{ backgroundColor: '#ecb613' }}>
                                    <div>
                                        <BarChart2 className="w-8 h-8 mb-4 opacity-80" />
                                        <h4 className="text-sm font-bold opacity-80 uppercase tracking-wider text-slate-900/80">Avg. Attendance</h4>
                                        <p className="text-4xl font-black mt-1 text-slate-900">{avgAttendance}%</p>
                                    </div>
                                    <div className="pt-4 border-t border-slate-900/20 mt-4">
                                        <p className="text-xs font-semibold italic text-slate-900/80">"Strongest participation on Wednesdays."</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                            <div className="text-center">
                                <Lightbulb className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Coming Soon</h3>
                                <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">The {activeTab} section is currently under development. Please check back later.</p>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
