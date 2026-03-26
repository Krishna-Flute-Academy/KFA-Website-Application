'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabaseAuth } from '../../../../src/lib/supabase-auth';
import { Loader2, ArrowLeft, PlayCircle, Clock, Mail, Edit, Music, Award, Calendar, Mic, Plus } from 'lucide-react';
import TeacherSidebar from '../../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../../src/components/TeacherHeader';
import Link from 'next/link';

interface StudentInfo {
    id: string;
    user_id: string;
    name: string;
    email: string;
    phone: string;
    profile_pic_url?: string;
    join_date: string;
    level: string;
    notes: string;
    batch_name: string;
}

interface Submission {
    id: string;
    status: string;
    submitted_at: string;
    video_url: string;
    task_title: string;
    thumbnail_url?: string;
}

interface AttendanceRecord {
    date: string;
    status: 'present' | 'absent';
}

export default function StudentProfilePage() {
    const router = useRouter();
    const params = useParams();
    const studentId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<{ name: string; email: string } | null>(null);
    const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [activeTab, setActiveTab] = useState('profile'); // profile, history, attendance

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Get Teacher Session
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (!session) {
                    router.push('/login?type=teacher');
                    return;
                }

                // 2. Fetch Teacher Profile
                const { data: profile } = await supabaseAuth
                    .from('users')
                    .select('name, email')
                    .eq('id', session.user.id)
                    .single();
                setTeacherProfile(profile);

                // 3. Fetch Student Details directly from users table
                const { data: userData, error: userError } = await supabaseAuth
                    .from('users')
                    .select(`
                        id, 
                        name,
                        email,
                        phone,
                        join_date, 
                        level, 
                        notes,
                        profile_pic_url,
                        classroom_students(classrooms(name))
                    `)
                    .eq('id', studentId)
                    .eq('role', 'student')
                    .single();

                if (userError || !userData) {
                    console.error('Error fetching student:', userError);
                    return;
                }

                const studentClassroom = userData.classroom_students?.[0]?.classrooms as any;
                const batch_name = Array.isArray(studentClassroom) ? studentClassroom[0]?.name : studentClassroom?.name;

                setStudentInfo({
                    id: userData.id,
                    user_id: userData.id,
                    name: userData.name || 'Unknown',
                    email: userData.email || '',
                    phone: userData.phone || '',
                    join_date: userData.join_date,
                    level: userData.level || 'beginner',
                    notes: userData.notes || '',
                    profile_pic_url: userData.profile_pic_url,
                    batch_name: batch_name || 'Unassigned'
                });

                // 4. Fetch Submissions
                const { data: subData } = await supabaseAuth
                    .from('submissions')
                    .select(`
                        id, 
                        status, 
                        submitted_at, 
                        video_url, 
                        tasks(title)
                    `)
                    .eq('student_id', studentId)
                    .order('submitted_at', { ascending: false });

                if (subData) {
                    setSubmissions(subData.map((s: any) => ({
                        id: s.id,
                        status: s.status,
                        submitted_at: s.submitted_at,
                        video_url: s.video_url,
                        task_title: s.tasks?.title || 'Untitled Task',
                        thumbnail_url: `https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop` // Placeholder
                    })));
                }

                // 5. Fetch Attendance
                const { data: attData } = await supabaseAuth
                    .from('attendance')
                    .select('date, status')
                    .eq('student_id', studentId);

                if (attData) {
                    setAttendance(attData as AttendanceRecord[]);
                }

            } catch (err) {
                console.error('Error in profile:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [studentId, router]);

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    if (loading || !studentInfo) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8f8f6]">
                <Loader2 className="w-10 h-10 animate-spin text-[#ecb613] mb-4" />
                <p className="font-medium text-slate-600 tracking-wide uppercase text-xs">Syncing Performance Data...</p>
            </div>
        );
    }

    const attendanceStats = {
        present: attendance.filter(a => a.status === 'present').length,
        total: attendance.length || 1,
    };
    const presencePercentage = Math.round((attendanceStats.present / attendanceStats.total) * 100);

    return (
        <div className="flex min-h-screen bg-[#f8fafc]">
            <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

            <main className="flex-1 flex flex-col min-w-0">
                <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-20">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div className="h-6 w-[1px] bg-slate-200"></div>
                        <h2 className="text-slate-800 font-bold tracking-tight">Student Profile</h2>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative hidden lg:block">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                            <input
                                className="pl-10 pr-4 py-2 bg-slate-100 border-transparent rounded-full text-sm w-72 focus:ring-2 focus:ring-[#ecb613] focus:bg-white transition-all outline-none"
                                placeholder="Search submissions, attendance..."
                                type="text"
                            />
                        </div>
                        <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
                            <span className="material-symbols-outlined">notifications</span>
                            <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 border-2 border-white rounded-full"></span>
                        </button>
                    </div>
                </header>

                <div className="p-8 max-w-7xl mx-auto w-full">
                    {/* Hero Card */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
                        <div className="flex gap-6 items-center">
                            <div className="relative">
                                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#ecb613]/20 to-[#ecb613]/5 flex items-center justify-center overflow-hidden ring-4 ring-slate-50">
                                    {studentInfo.profile_pic_url ? (
                                        <img 
                                            src={studentInfo.profile_pic_url} 
                                            alt={studentInfo.name} 
                                            className="w-full h-full object-cover rounded-2xl"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <span className="text-[#ecb613] text-3xl font-bold">{studentInfo.name.charAt(0)}</span>
                                    )}
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 border-4 border-white rounded-full"></div>
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <h1 className="text-2xl font-bold text-slate-900 leading-none">{studentInfo.name}</h1>
                                    <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">ID: #{studentInfo.id.slice(0, 4).toUpperCase()}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                                    <span className="flex items-center gap-1.5 font-medium"><Music className="size-4" /> {studentInfo.batch_name}</span>
                                    <span className="flex items-center gap-1.5 font-medium"><Award className="size-4" /> Level: {studentInfo.level.charAt(0).toUpperCase() + studentInfo.level.slice(1)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button className="px-5 py-2.5 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-all text-sm flex items-center gap-2 shadow-sm">
                                <Mail className="size-4" /> Message
                            </button>
                            <Link 
                                href={`/teacher-dashboard/students/${studentId}/edit`}
                                className="px-5 py-2.5 bg-[#ecb613] text-white font-bold rounded-xl hover:bg-[#ecb613]/90 shadow-lg shadow-[#ecb613]/20 transition-all text-sm flex items-center gap-2"
                            >
                                <Edit className="size-4" /> Edit Profile
                            </Link>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex border-b border-slate-200 gap-8 mb-8 overflow-x-auto scrollbar-hide">
                        <button
                            onClick={() => setActiveTab('profile')}
                            className={`pb-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'profile' ? 'border-[#ecb613] text-[#ecb613]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            Profile Info
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`pb-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'history' ? 'border-[#ecb613] text-[#ecb613]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            Submission History
                        </button>
                        <button
                            onClick={() => setActiveTab('attendance')}
                            className={`pb-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'attendance' ? 'border-[#ecb613] text-[#ecb613]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            Attendance & Feedback
                        </button>
                    </div>

                    <div className="space-y-10">
                        {/* Profile Info Section */}
                        {activeTab === 'profile' && (
                            <section>
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="w-1.5 h-6 bg-[#ecb613] rounded-full"></span>
                                    <h3 className="text-lg font-bold text-slate-800 tracking-tight">Contact & Enrolment</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Email Address</p>
                                        <p className="font-bold text-slate-700">{studentInfo.email}</p>
                                    </div>
                                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Phone Number</p>
                                        <p className="font-bold text-slate-700">{studentInfo.phone || 'Not Provided'}</p>
                                    </div>
                                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Joining Date</p>
                                        <p className="font-bold text-slate-700">{new Date(studentInfo.join_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                                    </div>
                                </div>

                                <div className="mt-8">
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="w-1.5 h-6 bg-[#ecb613] rounded-full"></span>
                                        <h3 className="text-lg font-bold text-slate-800 tracking-tight">Learning Notes</h3>
                                    </div>
                                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm min-h-[120px]">
                                        <p className="text-slate-600 leading-relaxed italic">
                                            {studentInfo.notes || '"No specific performance notes recorded yet. Add your first observation to track progress."'}
                                        </p>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Submission History Section */}
                        {activeTab === 'history' && (
                            <section>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="w-1.5 h-6 bg-[#ecb613] rounded-full"></span>
                                        <h3 className="text-lg font-bold text-slate-800 tracking-tight">Practice Recordings</h3>
                                    </div>
                                </div>
                                {submissions.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {submissions.map((sub) => (
                                            <div key={sub.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden group hover:shadow-md transition-all shadow-sm">
                                                <div className="relative aspect-video bg-slate-100 flex items-center justify-center">
                                                    <img className="w-full h-full object-cover" src={sub.thumbnail_url} alt={sub.task_title} />
                                                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <PlayCircle className="text-white size-12 shadow-xl" />
                                                    </div>
                                                    <div className={`absolute top-2 right-2 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight shadow-sm ${sub.status === 'pending' ? 'bg-amber-500' : 'bg-green-500'
                                                        }`}>
                                                        {sub.status.replace('_', ' ')}
                                                    </div>
                                                </div>
                                                <div className="p-4">
                                                    <p className="font-bold text-sm text-slate-800 truncate mb-1">{sub.task_title}</p>
                                                    <p className="text-xs text-slate-400 mb-4 flex items-center gap-1 font-medium">
                                                        <Clock className="size-3" /> {new Date(sub.submitted_at).toLocaleDateString()}
                                                    </p>
                                                    <button className={`w-full py-2.5 font-bold rounded-lg text-xs transition-all ${sub.status === 'pending'
                                                        ? 'bg-[#ecb613] text-white hover:bg-[#ecb613]/90'
                                                        : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                                                        }`}>
                                                        {sub.status === 'pending' ? 'Review Submission' : 'View Feedback'}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
                                        <div className="size-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <PlayCircle className="text-slate-300 size-8" />
                                        </div>
                                        <h4 className="font-bold text-slate-900">No practice recordings yet</h4>
                                        <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">Student hasn't submitted any tasks for review in the current module.</p>
                                    </div>
                                )}
                            </section>
                        )}

                        {/* Attendance Section */}
                        {activeTab === 'attendance' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <section>
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="w-1.5 h-6 bg-[#ecb613] rounded-full"></span>
                                        <h3 className="text-lg font-bold text-slate-800 tracking-tight">Monthly Attendance</h3>
                                    </div>
                                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                                        <div className="flex items-center justify-between mb-8">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-slate-900">October 2023</p>
                                                <span className="bg-green-50 text-green-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-100">{presencePercentage}% Presence</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <button className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors"><span className="material-symbols-outlined text-lg leading-none">chevron_left</span></button>
                                                <button className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors"><span className="material-symbols-outlined text-lg leading-none">chevron_right</span></button>
                                            </div>
                                        </div>

                                        {/* Simplified Calendar Grid */}
                                        <div className="grid grid-cols-7 gap-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">
                                            <div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div><div>Sun</div>
                                        </div>
                                        <div className="grid grid-cols-7 gap-3">
                                            {[...Array(31)].map((_, i) => {
                                                const day = i + 1;
                                                const isPresent = day % 3 === 0; // Simulated
                                                const isAbsent = day === 8; // Simulated
                                                const isToday = day === 11; // Simulated

                                                return (
                                                    <div key={i} className={`aspect-square flex items-center justify-center text-xs font-bold rounded-xl border transition-all ${isToday ? 'bg-[#ecb613] text-white border-[#ecb613] shadow-md shadow-[#ecb613]/20' :
                                                        isPresent ? 'bg-green-50 text-green-600 border-green-100' :
                                                            isAbsent ? 'bg-red-50 text-red-600 border-red-100' :
                                                                'bg-slate-50 text-slate-400 border-transparent hover:border-slate-200'
                                                        }`}>
                                                        {day}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="mt-10 flex flex-wrap gap-6 pt-6 border-t border-slate-50">
                                            <div className="flex items-center gap-2.5">
                                                <div className="size-2.5 bg-green-500 rounded-full"></div>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Present</span>
                                            </div>
                                            <div className="flex items-center gap-2.5">
                                                <div className="size-2.5 bg-red-500 rounded-full"></div>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Absent</span>
                                            </div>
                                            <div className="flex items-center gap-2.5">
                                                <div className="size-2.5 bg-[#ecb613] rounded-full"></div>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Today</span>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className="w-1.5 h-6 bg-[#ecb613] rounded-full"></span>
                                            <h3 className="text-lg font-bold text-slate-800 tracking-tight">Recent Feedback</h3>
                                        </div>
                                        <button className="bg-[#ecb613] hover:bg-[#ecb613]/90 text-white p-2 rounded-xl transition-all shadow-lg shadow-[#ecb613]/20">
                                            <Plus size={20} />
                                        </button>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-[#ecb613]/30 transition-all shadow-sm">
                                            <div className="flex items-center justify-between mb-4">
                                                <span className="text-[9px] font-bold bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full border border-blue-100 uppercase tracking-widest">Text Feedback</span>
                                                <span className="text-[10px] text-slate-400 flex items-center gap-1.5 font-bold uppercase tracking-tight">
                                                    <Calendar className="size-3" /> Oct 09, 2023
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                                Great progress on the lower octave notes. Focus more on consistent airflow during transitions between G and A.
                                            </p>
                                        </div>

                                        <div className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-[#ecb613]/30 transition-all shadow-sm">
                                            <div className="flex items-center justify-between mb-4">
                                                <span className="text-[9px] font-bold bg-purple-50 text-purple-600 px-2.5 py-1 rounded-full border border-purple-100 uppercase tracking-widest">Audio Note</span>
                                                <span className="text-[10px] text-slate-400 flex items-center gap-1.5 font-bold uppercase tracking-tight">
                                                    <Calendar className="size-3" /> Oct 05, 2023
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 p-3.5 rounded-2xl">
                                                <button className="size-10 rounded-full bg-[#ecb613] flex items-center justify-center text-white shadow-lg shadow-[#ecb613]/25 hover:scale-110 transition-transform active:scale-95">
                                                    <PlayCircle className="size-6" />
                                                </button>
                                                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden relative">
                                                    <div className="absolute left-0 top-0 h-full w-1/3 bg-[#ecb613]"></div>
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-500 font-mono tracking-tighter">0:45 / 1:20</span>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
