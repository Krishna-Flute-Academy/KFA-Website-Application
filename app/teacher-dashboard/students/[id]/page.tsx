'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabaseAuth } from '../../../../src/lib/supabase-auth';
import { Loader2, ArrowLeft, PlayCircle, Clock, Mail, Edit, Music, Award, Calendar, Mic, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
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
    status: 'present' | 'absent' | 'late' | 'excused';
    classroom_id?: string;
    classrooms?: { name: string } | { name: string }[] | null;
    classroom_name?: string;
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
    const [viewDate, setViewDate] = useState(new Date()); // Calendar view month
    const [activeTab, setActiveTab] = useState('profile'); // profile, history, attendance

    const formatDate = (date: Date) => {
        const d = new Date(date);
        let month = '' + (d.getMonth() + 1);
        let day = '' + d.getDate();
        const year = d.getFullYear();

        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;

        return [year, month, day].join('-');
    };

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
                    .select(`
                        date, 
                        status, 
                        classroom_id,
                        classrooms(name)
                    `)
                    .eq('student_id', studentId)
                    .order('date', { ascending: false });

                if (attData) {
                    const resolved = await Promise.all((attData || []).map(async (row: any) => {
                        let name = Array.isArray(row.classrooms) 
                            ? row.classrooms[0]?.name 
                            : row.classrooms?.name;
                        
                        if (!name && row.classroom_id) {
                            const { data: tc } = await supabaseAuth
                                .from('temporary_classes')
                                .select('title')
                                .eq('id', row.classroom_id)
                                .maybeSingle();
                            if (tc) name = tc.title;
                        }
                        
                        return {
                            ...row,
                            classroom_name: name || 'Classroom Session'
                        };
                    }));
                    setAttendance(resolved as AttendanceRecord[]);
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
        present: attendance.filter(a => a.status === 'present' || a.status === 'late').length,
        total: attendance.length,
    };
    const presencePercentage = attendanceStats.total > 0
        ? Math.round((attendanceStats.present / attendanceStats.total) * 100)
        : 100;

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
                                                <p className="font-bold text-slate-900">
                                                    {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                                </p>
                                                <span className="bg-green-50 text-green-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-100">{presencePercentage}% Presence</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <button 
                                                    onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
                                                    className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors"
                                                >
                                                    <ChevronLeft size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
                                                    className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors"
                                                >
                                                    <ChevronRight size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Simplified Calendar Grid */}
                                        <div className="grid grid-cols-7 gap-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">
                                            <div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div><div>Sun</div>
                                        </div>
                                        <div className="grid grid-cols-7 gap-3">
                                            {getDaysInMonth(viewDate).map((day, i) => {
                                                if (!day) return <div key={`empty-${i}`} className="aspect-square" />;
                                                
                                                const dateStr = formatDate(day);
                                                const dayRecords = attendance.filter(a => a.date === dateStr);
                                                const isToday = formatDate(new Date()) === dateStr;

                                                const hasPresence = dayRecords.some(r => r.status === 'present' || r.status === 'late');
                                                const hasAbsence = dayRecords.some(r => r.status === 'absent');
                                                const hasExcused = dayRecords.some(r => r.status === 'excused');

                                                return (
                                                    <div 
                                                        key={i} 
                                                        className={`aspect-square flex flex-col items-center justify-center text-xs font-bold rounded-xl border transition-all relative group cursor-pointer ${
                                                            isToday 
                                                                ? 'border-[#ecb613] ring-1 ring-[#ecb613]' 
                                                                : 'border-transparent'
                                                        } ${
                                                            hasPresence 
                                                                ? 'bg-green-50 text-green-600 border-green-100 dark:bg-green-950/20' 
                                                                : hasAbsence 
                                                                ? 'bg-red-50 text-red-650 border-red-105 dark:bg-red-950/20' 
                                                                : hasExcused 
                                                                ? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800'
                                                                : 'bg-slate-50 text-slate-400 border-transparent hover:border-slate-200'
                                                        }`}
                                                    >
                                                        <span className={dayRecords.length > 0 ? 'mb-1' : ''}>{day.getDate()}</span>
                                                        
                                                        {/* Session-specific indicator dots */}
                                                        {dayRecords.length > 0 && (
                                                            <div className="absolute bottom-1.5 flex gap-1 justify-center w-full">
                                                                {dayRecords.map((r, idx) => (
                                                                    <span 
                                                                        key={idx} 
                                                                        className={`w-1 h-1 rounded-full ${
                                                                            r.status === 'present'
                                                                                ? 'bg-emerald-500'
                                                                                : r.status === 'late'
                                                                                ? 'bg-amber-500'
                                                                                : r.status === 'absent'
                                                                                ? 'bg-rose-500'
                                                                                : 'bg-slate-400'
                                                                        }`}
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Today dot indicator */}
                                                        {isToday && !dayRecords.length && (
                                                            <span className="absolute bottom-1 w-1 h-1 bg-[#ecb613] rounded-full"></span>
                                                        )}

                                                        {/* Class-basis Premium Tooltip */}
                                                        {dayRecords.length > 0 && (
                                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900/95 backdrop-blur-sm text-white text-[10px] p-2.5 rounded-xl shadow-xl border border-slate-700/50 hidden group-hover:flex flex-col gap-1.5 z-20 pointer-events-none transition-all duration-200">
                                                                <p className="font-extrabold text-[9px] border-b border-slate-700 pb-1 text-slate-400 tracking-wider uppercase text-left">
                                                                    {day.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} Classes
                                                                </p>
                                                                {dayRecords.map((r, idx) => (
                                                                    <div key={idx} className="flex justify-between items-center gap-2">
                                                                        <span className="font-bold text-slate-200 truncate flex-1 text-left">
                                                                            {r.classroom_name}
                                                                        </span>
                                                                        <span className={`px-1.5 py-0.5 rounded-md font-extrabold text-[8px] uppercase tracking-wider ${
                                                                            r.status === 'present'
                                                                                ? 'bg-emerald-500/20 text-emerald-300'
                                                                                : r.status === 'absent'
                                                                                ? 'bg-rose-500/20 text-rose-300'
                                                                                : r.status === 'late'
                                                                                ? 'bg-amber-500/20 text-amber-300'
                                                                                : r.status === 'excused'
                                                                                ? 'bg-slate-500/20 text-slate-300'
                                                                                : 'bg-slate-500/20 text-slate-350'
                                                                        }`}>
                                                                            {r.status}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="mt-10 flex flex-wrap gap-6 pt-6 border-t border-slate-50">
                                            <div className="flex items-center gap-2.5">
                                                <div className="size-2.5 bg-emerald-500 rounded-full"></div>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Present / Late</span>
                                            </div>
                                            <div className="flex items-center gap-2.5">
                                                <div className="size-2.5 bg-rose-500 rounded-full"></div>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Absent</span>
                                            </div>
                                            <div className="flex items-center gap-2.5">
                                                <div className="size-2.5 bg-slate-400 rounded-full"></div>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Excused</span>
                                            </div>
                                            <div className="flex items-center gap-2.5">
                                                <div className="size-2.5 border border-[#ecb613] rounded-full"></div>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Today</span>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className="w-1.5 h-6 bg-[#ecb613] rounded-full"></span>
                                            <h3 className="text-lg font-bold text-slate-800 tracking-tight">Recent Attendance Log</h3>
                                        </div>
                                    </div>
                                    <div className="space-y-4 max-h-[380px] overflow-y-auto custom-scrollbar">
                                        {attendance.length > 0 ? (
                                            attendance.map((log, idx) => (
                                                <div 
                                                    key={idx} 
                                                    className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-[#ecb613]/30 transition-all shadow-sm flex items-center justify-between"
                                                >
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                                                log.status === 'present'
                                                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                                    : log.status === 'absent'
                                                                    ? 'bg-[#fef2f2] text-red-650 border border-[#fee2e2]'
                                                                    : log.status === 'late'
                                                                    ? 'bg-[#fffbeb] text-amber-600 border border-[#fef3c7]'
                                                                    : log.status === 'excused'
                                                                    ? 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                                                    : 'bg-slate-100 text-slate-600'
                                                            }`}>
                                                                {log.status}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                                                {new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm font-extrabold text-slate-800 leading-relaxed">
                                                            {(Array.isArray(log.classrooms) ? log.classrooms[0]?.name : log.classrooms?.name) || 'Classroom Session'}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
                                                <div className="size-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                                    <Calendar className="text-slate-350 size-6" />
                                                </div>
                                                <h4 className="font-bold text-slate-800">No attendance history</h4>
                                                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">This student has no marked attendance logs yet.</p>
                                            </div>
                                        )}
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
