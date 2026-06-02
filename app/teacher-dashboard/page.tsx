'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../src/lib/supabase-auth';
import { Loader2, Plus, Users, Clock, ArrowRight, Lightbulb, Video, LayoutDashboard, ClipboardList, Calendar, Trash2, Edit, CheckCircle, AlertCircle, ChevronLeft, ChevronRight, X } from 'lucide-react';
import TeacherSidebar from '../../src/components/TeacherSidebar';
import TeacherHeader from '../../src/components/TeacherHeader';
import Link from 'next/link';

interface Submission {
    id: string;
    student_name: string;
    student_profile_pic_url?: string;
    task_title: string;
    status: string;
    submitted_at: string;
}

interface UpcomingClass {
    id: string;
    classroom_id: string;
    session_date: string;
    start_time: string;
    end_time: string;
    classroom_name: string;
    students_joined: number;
}

interface BatchSchedule {
    id: string;
    classroom_id: string;
    classroom_name: string;
    day_of_week: number; // 0=Mon, 6=Sun
    start_time: string;
    end_time: string;
}

interface TemporaryClass {
    id: string;
    classroom_id: string | null;
    classroom_name: string;
    title: string;
    class_date: string;
    start_time: string;
    end_time: string;
}

interface CalendarEvent {
    id: string;
    type: 'recurring' | 'temporary';
    name: string;
    time: string;
    date: string;
    classroom_id: string | null;
}

interface PanelStudent {
    id: string;
    name: string;
    profile_pic_url?: string;
}

function formatTime12hr(time24: string) {
    if (!time24) return '';
    const [h, m] = time24.split(':');
    let hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hStr = hours.toString().padStart(2, '0');
    return `${hStr}:${m} ${ampm}`;
}

const generateTimeOptions = () => {
    const options = [];
    for (let h = 6; h <= 22; h++) {
        for (let m = 0; m < 60; m += 15) {
            const hStr = h.toString().padStart(2, '0');
            const mStr = m.toString().padStart(2, '0');
            const value = `${hStr}:${mStr}`;
            options.push({ value, label: formatTime12hr(value) });
        }
    }
    return options;
};
const TIME_OPTIONS = generateTimeOptions();

export default function TeacherDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<{ name: string; email: string } | null>(null);
    const [stats, setStats] = useState({
        totalStudents: 0,
        activeClassrooms: 0,
        pendingSubmissions: 0,
        todayClasses: 0
    });
    const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
    const [upcomingClasses, setUpcomingClasses] = useState<UpcomingClass[]>([]);
    const [batchSchedules, setBatchSchedules] = useState<BatchSchedule[]>([]);
    const [tempClasses, setTempClasses] = useState<TemporaryClass[]>([]);
    const [calendarDate, setCalendarDate] = useState(new Date());
    const [sidePanelOpen, setSidePanelOpen] = useState(false);
    const [selectedDateEvents, setSelectedDateEvents] = useState<CalendarEvent[]>([]);
    const [selectedDateStr, setSelectedDateStr] = useState<string>('');
    const [panelStudentsMap, setPanelStudentsMap] = useState<{ [key: string]: PanelStudent[] }>({});
    const [panelLoading, setPanelLoading] = useState(false);
    const [showTempModal, setShowTempModal] = useState(false);
    const [tempModalDate, setTempModalDate] = useState('');
    const [tempForm, setTempForm] = useState({ title: '', start_time: '10:00', end_time: '11:00', classroom_id: '' });
    const [classrooms, setClassrooms] = useState<{ id: string; name: string }[]>([]);
    const [allStudents, setAllStudents] = useState<{ id: string; name: string }[]>([]);
    const [tempSelectedStudents, setTempSelectedStudents] = useState<string[]>([]);

    const calendarMonth = calendarDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    // Build calendar cells with events
    const calendarDays = (() => {
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDow = (firstDay.getDay() + 6) % 7; // Mon=0
        const daysInMonth = lastDay.getDate();
        const prevMonthLast = new Date(year, month, 0).getDate();
        const today = new Date();

        const cells: { day: number; current: boolean; isToday: boolean; date: string; events: CalendarEvent[] }[] = [];

        const getEventsForDate = (d: Date): CalendarEvent[] => {
            const evts: CalendarEvent[] = [];
            const dow = d.getDay(); // 0=Sun matches DB convention
            const dateStr = d.toISOString().split('T')[0];
            // Recurring
            batchSchedules.filter(s => s.day_of_week === dow).forEach(s => {
                evts.push({ id: s.id, type: 'recurring', name: s.classroom_name, time: `${formatTime12hr(s.start_time.slice(0,5))} – ${formatTime12hr(s.end_time.slice(0,5))}`, date: dateStr, classroom_id: s.classroom_id });
            });
            // Temporary
            tempClasses.filter(t => t.class_date === dateStr).forEach(t => {
                evts.push({ id: t.id, type: 'temporary', name: t.title, time: `${formatTime12hr(t.start_time.slice(0,5))} – ${formatTime12hr(t.end_time.slice(0,5))}`, date: dateStr, classroom_id: t.classroom_id });
            });
            return evts;
        };

        for (let i = startDow - 1; i >= 0; i--) {
            const d = new Date(year, month - 1, prevMonthLast - i);
            cells.push({ day: prevMonthLast - i, current: false, isToday: false, date: d.toISOString().split('T')[0], events: [] });
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const dt = new Date(year, month, d);
            const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            cells.push({ day: d, current: true, isToday, date: dt.toISOString().split('T')[0], events: getEventsForDate(dt) });
        }
        while (cells.length % 7 !== 0) {
            const nextDay = cells.length - (startDow + daysInMonth) + 1;
            cells.push({ day: nextDay, current: false, isToday: false, date: '', events: [] });
        }
        return cells;
    })();

    useEffect(() => {
        const loadDashboardData = async () => {
            setLoading(true);
            try {
                // 1. Check Session
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (!session) {
                    router.push('/login?type=teacher');
                    return;
                }

                const userId = session.user.id;

                // 2. Verify Teacher Role & Profile
                const { data: profile, error: profileError } = await supabaseAuth
                    .from('users')
                    .select('name, email, role')
                    .eq('id', userId)
                    .single();

                if (profileError || profile?.role !== 'teacher') {
                    console.error('Access denied: User is not a teacher or error fetching profile');
                    router.push('/');
                    return;
                }

                setTeacherProfile({ name: profile.name, email: profile.email });

                // 3. Fetch Stats in Parallel
                const today = new Date().toISOString().split('T')[0];

                const [studentRes, classroomRes, pendingRes, todayRes] = await Promise.all([
                    supabaseAuth.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student').eq('teacher_id', userId),
                    supabaseAuth.from('classrooms').select('*', { count: 'exact', head: true }).eq('teacher_id', userId),
                    supabaseAuth.from('task_attempts').select('id, users!student_id(teacher_id)', { count: 'exact', head: true }).eq('status', 'submitted').eq('users.teacher_id', userId),
                    supabaseAuth.from('class_sessions').select('id, classrooms!classroom_id(teacher_id)', { count: 'exact', head: true }).eq('session_date', today).eq('classrooms.teacher_id', userId)
                ]);

                setStats({
                    totalStudents: studentRes.count || 0,
                    activeClassrooms: classroomRes.count || 0,
                    pendingSubmissions: pendingRes.count || 0,
                    todayClasses: todayRes.count || 0
                });

                // 4. Fetch Recent Submissions
                const { data: submissionsData, error: subErr } = await supabaseAuth
                    .from('task_attempts')
                    .select(`
                        id,
                        status,
                        submitted_at,
                        users!student_id(name, teacher_id, profile_pic_url),
                        tasks!task_id(title)
                    `)
                    .eq('users.teacher_id', userId)
                    .order('submitted_at', { ascending: false })
                    .limit(5);

                if (!subErr && submissionsData) {
                    const formatted: Submission[] = (submissionsData as any[]).map(s => ({
                        id: s.id,
                        student_name: s.users?.name || 'Unknown',
                        student_profile_pic_url: s.users?.profile_pic_url,
                        task_title: s.tasks?.title || 'Unknown Task',
                        status: s.status,
                        submitted_at: s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : 'N/A'
                    }));
                    setRecentSubmissions(formatted);
                }

                // 5. Fetch Upcoming Classes
                const { data: classesData, error: clErr } = await supabaseAuth
                    .from('class_sessions')
                    .select(`
                        id,
                        classroom_id,
                        session_date,
                        start_time,
                        end_time,
                        classrooms!classroom_id(name, teacher_id)
                    `)
                    .gte('session_date', today)
                    .eq('classrooms.teacher_id', userId)
                    .order('session_date', { ascending: true })
                    .order('start_time', { ascending: true })
                    .limit(3);

                if (!clErr && classesData) {
                    const formatted: UpcomingClass[] = (classesData as any[]).map(c => ({
                        id: c.id,
                        classroom_id: c.classroom_id,
                        session_date: c.session_date,
                        start_time: c.start_time,
                        end_time: c.end_time,
                        classroom_name: c.classrooms?.name || 'Unknown Class',
                        students_joined: 0
                    }));
                    setUpcomingClasses(formatted);
                }

                // 6. Fetch Batch Schedules (for calendar)
                const { data: schedData } = await supabaseAuth
                    .from('batch_schedules')
                    .select('id, classroom_id, day_of_week, start_time, end_time, classrooms(name, teacher_id)')
                    .eq('classrooms.teacher_id', userId);
                if (schedData) {
                    setBatchSchedules((schedData as any[]).map(s => ({
                        id: s.id, classroom_id: s.classroom_id, day_of_week: s.day_of_week,
                        start_time: s.start_time, end_time: s.end_time,
                        classroom_name: s.classrooms?.name || 'Unknown'
                    })));
                }

                // 7. Fetch Temporary Classes (for calendar)
                const { data: tempData } = await supabaseAuth
                    .from('temporary_classes')
                    .select('id, classroom_id, title, class_date, start_time, end_time, classrooms(name)')
                    .eq('teacher_id', userId);
                if (tempData) {
                    setTempClasses((tempData as any[]).map(t => ({
                        id: t.id, classroom_id: t.classroom_id, title: t.title,
                        class_date: t.class_date, start_time: t.start_time, end_time: t.end_time,
                        classroom_name: t.classrooms?.name || 'Standalone'
                    })));
                }

                // 8. Fetch classrooms list for temp class modal
                const { data: roomList } = await supabaseAuth
                    .from('classrooms')
                    .select('id, name')
                    .eq('teacher_id', userId);
                if (roomList) setClassrooms(roomList);

                // 9. Fetch all students for the current teacher
                const { data: studentsData } = await supabaseAuth
                    .from('users')
                    .select('id, name')
                    .eq('role', 'student')
                    .eq('teacher_id', userId);
                if (studentsData) setAllStudents(studentsData);

            } catch (err) {
                console.error('Critical Dashboard Error:', err);
            } finally {
                setLoading(false);
            }
        };

        loadDashboardData();
    }, [router]);

    const handleEventClick = async (evts: CalendarEvent[], dateStr: string) => {
        setSelectedDateEvents(evts);
        setSelectedDateStr(dateStr);
        setSidePanelOpen(true);
        setPanelStudentsMap({});
        setPanelLoading(true);
        try {
            const results: { [key: string]: PanelStudent[] } = {};
            await Promise.all(evts.map(async (evt) => {
                if (evt.type === 'recurring' && evt.classroom_id) {
                    const { data: enrolledData } = await supabaseAuth
                        .from('classroom_students')
                        .select('users!student_id(id, name, profile_pic_url)')
                        .eq('classroom_id', evt.classroom_id);
                    
                    const { data: overrideData } = await supabaseAuth
                        .from('session_student_overrides')
                        .select('users!student_id(id, name, profile_pic_url)')
                        .eq('target_classroom_id', evt.classroom_id)
                        .eq('override_date', dateStr);

                    const enrolledList = (enrolledData as any[] || []).map(d => ({
                        id: d.users?.id || '',
                        name: d.users?.name || 'Unknown',
                        profile_pic_url: d.users?.profile_pic_url
                    }));

                    const overrideList = (overrideData as any[] || []).map(d => ({
                        id: d.users?.id || '',
                        name: `${d.users?.name || 'Unknown'} (Makeup)`,
                        profile_pic_url: d.users?.profile_pic_url
                    }));

                    results[evt.id] = [...enrolledList, ...overrideList];
                } else if (evt.type === 'temporary' && evt.id) {
                    const { data } = await supabaseAuth
                        .from('temporary_class_students')
                        .select('users!student_id(id, name, profile_pic_url)')
                        .eq('temporary_class_id', evt.id);
                    if (data) {
                        results[evt.id] = (data as any[]).map(d => ({
                            id: d.users?.id || '',
                            name: d.users?.name || 'Unknown',
                            profile_pic_url: d.users?.profile_pic_url
                        }));
                    }
                }
            }));
            setPanelStudentsMap(results);
        } catch (e) {
            console.error('Error fetching panel students:', e);
        } finally {
            setPanelLoading(false);
        }
    };

    const handleCreateTempClass = async () => {
        try {
            const { data: { session } } = await supabaseAuth.auth.getSession();
            if (!session) return;
            // 1. Create a shadow classroom first
            const { data: classroom, error: clError } = await supabaseAuth
                .from('classrooms')
                .insert([{
                    teacher_id: session.user.id,
                    name: tempForm.title || 'Temporary Class',
                    description: 'Temporary class session',
                    type: 'temporary'
                }])
                .select()
                .single();

            if (clError) {
                console.error('Error creating shadow classroom:', clError);
                alert('Failed to create temporary class (shadow classroom error).');
                return;
            }

            // 2. Create the Temporary Class record linking to it
            const { data: tempClassData, error } = await supabaseAuth.from('temporary_classes').insert({
                teacher_id: session.user.id,
                classroom_id: classroom.id,
                title: tempForm.title || 'Temporary Class',
                class_date: tempModalDate,
                start_time: tempForm.start_time,
                end_time: tempForm.end_time
            }).select().single();
            if (error) { console.error('Error creating temp class:', error); alert('Failed to create temporary class.'); return; }
            
            // Insert selected students
            if (tempSelectedStudents.length > 0 && tempClassData) {
                const studentInserts = tempSelectedStudents.map(studentId => ({
                    temporary_class_id: tempClassData.id,
                    student_id: studentId
                }));
                await supabaseAuth.from('temporary_class_students').insert(studentInserts);
            }

            // Refresh temp classes
            const { data: tempData } = await supabaseAuth
                .from('temporary_classes')
                .select('id, classroom_id, title, class_date, start_time, end_time, classrooms(name)')
                .eq('teacher_id', session.user.id);
            if (tempData) {
                setTempClasses((tempData as any[]).map(t => ({
                    id: t.id, classroom_id: t.classroom_id, title: t.title,
                    class_date: t.class_date, start_time: t.start_time, end_time: t.end_time,
                    classroom_name: t.classrooms?.name || 'Standalone'
                })));
            }
            setShowTempModal(false);
            setTempForm({ title: '', start_time: '10:00', end_time: '11:00', classroom_id: '' });
            setTempSelectedStudents([]);
        } catch (e) { console.error(e); }
    };

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8f8f6] dark:bg-[#1a1608]">
                <Loader2 className="w-10 h-10 animate-spin text-[#ecb613] mb-4" />
                <p className="font-medium text-slate-600 dark:text-slate-400">Loading your teacher portal...</p>
            </div>
        );
    }

    return (
        <div className="bg-[#f8f8f6] dark:bg-[#1a1608] text-slate-900 dark:text-slate-100 font-sans min-h-screen">
            <div className="flex min-h-screen">
                <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

                <main className="flex-1 flex flex-col">
                    <TeacherHeader title="Dashboard Overview" />

                    <div className="p-8 space-y-8 max-w-[1400px] mx-auto w-full">
                        {/* Stats Section */}
                        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                                { label: 'Total Students', value: stats.totalStudents, icon: 'person', color: 'blue', status: 'Live' },
                                { label: 'Active Classrooms', value: stats.activeClassrooms, icon: 'meeting_room', color: 'amber', status: 'Active' },
                                { label: 'Submissions', value: stats.pendingSubmissions, icon: 'assignment_late', color: 'purple', status: 'Pending' },
                                { label: "Today's Classes", value: stats.todayClasses, icon: 'schedule', color: 'rose', status: 'Today' }
                            ].map((stat, i) => (
                                <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-transform hover:scale-[1.02]">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className={`p-2 bg-${stat.color}-50 dark:bg-${stat.color}-900/20 text-${stat.color}-600 rounded-lg`}>
                                            <span className="material-symbols-outlined">{stat.icon}</span>
                                        </div>
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                            stat.status === 'Live' ? 'text-emerald-600 bg-emerald-50' : 
                                            stat.status === 'Active' ? 'text-amber-600 bg-amber-50' : 
                                            stat.status === 'Pending' ? 'text-purple-600 bg-purple-50' : 
                                            'text-slate-500 bg-slate-50'
                                        }`}>
                                            {stat.status}
                                        </span>
                                    </div>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{stat.label}</p>
                                    <h3 className="text-2xl font-bold mt-1">{stat.value}</h3>
                                </div>
                            ))}
                        </section>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Main Content: Submissions & Announcements */}
                            <section className="lg:col-span-2 space-y-8">
                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                    <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                        <h3 className="font-bold text-lg">Recent Student Submissions</h3>
                                        <Link className="text-sm font-semibold text-[#ecb613] hover:underline" href="/teacher-dashboard/submissions">View All</Link>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="text-xs font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider">
                                                    <th className="px-6 py-4">Student</th>
                                                    <th className="px-6 py-4">Task</th>
                                                    <th className="px-6 py-4">Status</th>
                                                    <th className="px-6 py-4 text-right">Date</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                                {recentSubmissions.map((sub) => (
                                                    <tr key={sub.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
                                                                    {sub.student_profile_pic_url ? (
                                                                        <img 
                                                                            src={sub.student_profile_pic_url} 
                                                                            alt={sub.student_name} 
                                                                            className="w-full h-full object-cover rounded-full"
                                                                            loading="lazy"
                                                                        />
                                                                    ) : (
                                                                        <span className="text-[10px] font-bold">{sub.student_name.charAt(0)}</span>
                                                                    )}
                                                                </div>
                                                                <span className="text-sm font-medium">{sub.student_name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{sub.task_title}</td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                                sub.status === 'approved'
                                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                                }`}>
                                                                {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-slate-500 text-right">{sub.submitted_at}</td>
                                                    </tr>
                                                ))}
                                                {recentSubmissions.length === 0 && (
                                                    <tr>
                                                        <td colSpan={4} className="px-6 py-10 text-center text-slate-500">
                                                            No recent submissions found.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden text-[#5a5e0d] dark:text-[#ecb613]">
                                    <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                        <h3 className="font-bold text-lg">Recent Announcements</h3>
                                        <button className="size-8 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-[#ecb613] hover:text-white transition-all">
                                            <span className="material-symbols-outlined text-xl">add</span>
                                        </button>
                                    </div>
                                    <div className="p-6 space-y-4">
                                        <div className="flex gap-4 p-4 rounded-xl bg-[#ecb613]/5 border border-[#ecb613]/10">
                                            <span className="material-symbols-outlined text-[#ecb613] text-2xl">campaign</span>
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Upcoming Annual Concert</h4>
                                                <p className="text-xs text-slate-500 mt-0.5">Posted 2 hours ago • All Students</p>
                                                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Registration for the 'Venu Nad' concert is now open. Teachers please prepare your intermediate batches.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Class Calendar */}
                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                    <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <h3 className="font-bold text-lg">Class Calendar</h3>
                                            <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider">
                                                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-blue-500"></span> Recurring</span>
                                                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-orange-500"></span> Temporary</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))} className="size-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                                <ChevronLeft size={18} />
                                            </button>
                                            <span className="text-sm font-bold px-2">{calendarMonth}</span>
                                            <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))} className="size-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                                <ChevronRight size={18} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-6">
                                        <div className="grid grid-cols-7 gap-px bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800">
                                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                                <div key={day} className="bg-slate-50 dark:bg-slate-900 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                    {day}
                                                </div>
                                            ))}
                                            {calendarDays.map((cell, i) => (
                                                <div
                                                    key={i}
                                                    onClick={() => {
                                                        if (cell.current) {
                                                            handleEventClick(cell.events, cell.date);
                                                        }
                                                    }}
                                                    className={`bg-white dark:bg-slate-900 h-24 p-2 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ${
                                                        cell.current ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-300 dark:text-slate-600'
                                                    } ${cell.isToday ? 'ring-2 ring-[#ecb613] ring-inset bg-[#ecb613]/5' : ''}`}
                                                >
                                                    <span className={`text-xs ${cell.isToday ? 'text-[#ecb613] font-bold' : ''}`}>{cell.day}</span>
                                                    <div className="mt-1 space-y-1 overflow-hidden">
                                                        {cell.events.slice(0, 2).map((evt, j) => (
                                                            <div
                                                                key={j}
                                                                className={`w-full text-left text-[9px] font-bold px-1.5 py-0.5 rounded truncate ${
                                                                    evt.type === 'recurring'
                                                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                                                        : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                                                                }`}
                                                            >
                                                                {evt.name}
                                                            </div>
                                                        ))}
                                                        {cell.events.length > 2 && (
                                                            <span className="text-[9px] text-slate-400 font-bold">+{cell.events.length - 2} more</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Sidebar: Upcoming Classes & Tasks */}
                            <section className="space-y-8">
                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                    <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                                        <h3 className="font-bold text-lg">Upcoming Classes</h3>
                                        <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold">
                                            {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                        </p>
                                    </div>
                                    <div className="p-6 space-y-6">
                                        {upcomingClasses.map((cl, idx) => (
                                            <div key={cl.id} className={`relative pl-6 border-l-2 ${idx === 0 ? 'border-[#ecb613]' : 'border-slate-200 dark:border-slate-700'}`}>
                                                <div className={`absolute -left-[9px] top-0 size-4 rounded-full border-2 ${idx === 0 ? 'border-[#ecb613]' : 'border-slate-200 dark:border-slate-700'} bg-white dark:bg-slate-900`}></div>
                                                <p className={`text-xs font-bold ${idx === 0 ? 'text-[#ecb613]' : 'text-slate-400'} uppercase tracking-wider`}>
                                                    {formatTime12hr(cl.start_time.slice(0, 5))} - {formatTime12hr(cl.end_time.slice(0, 5))}
                                                </p>
                                                <h4 className={`text-sm font-bold mt-1 ${idx === 0 ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>{cl.classroom_name}</h4>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className="material-symbols-outlined text-base text-slate-400">group</span>
                                                    <span className="text-xs text-slate-500">{cl.students_joined} Students joined</span>
                                                </div>
                                                {idx === 0 && (
                                                    <Link 
                                                        href={`/teacher-dashboard/classrooms/${cl.classroom_id}/meeting`}
                                                        className="mt-4 w-full py-2 bg-[#ecb613] text-slate-900 text-xs font-bold rounded-lg hover:bg-[#ecb613]/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#ecb613]/20"
                                                    >
                                                        <Video className="w-4 h-4" /> Start Session
                                                    </Link>
                                                )}
                                            </div>
                                        ))}
                                        {upcomingClasses.length === 0 && (
                                            <div className="text-center py-6">
                                                <p className="text-slate-500 text-sm">No upcoming classes today.</p>
                                                 <Link href="/teacher-dashboard/classrooms" className="text-xs text-[#ecb613] font-bold mt-2 inline-block hover:underline">Manage Classrooms</Link>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-[#0d5e5b] p-6 rounded-2xl shadow-xl shadow-[#0d5e5b]/20 text-white relative overflow-hidden group">
                                    <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                                        <AlertCircle className="w-24 h-24" />
                                    </div>
                                    <div className="relative z-10">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="font-bold text-lg">Priority Tasks</h4>
                                            <span className="bg-red-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">Urgent</span>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/5">
                                                <div>
                                                    <p className="text-2xl font-bold">{stats.pendingSubmissions}</p>
                                                    <p className="text-[11px] font-medium text-teal-100/70 uppercase tracking-wide">Pending Reviews</p>
                                                </div>
                                                <Link className="bg-[#ecb613] text-slate-900 px-4 py-2 rounded-lg text-xs font-bold hover:bg-white transition-all flex items-center gap-2" href="/teacher-dashboard/submissions">
                                                    Review
                                                    <ArrowRight className="w-3 h-3" />
                                                </Link>
                                            </div>
                                        </div>
                                        <div className="mt-8 pt-6 border-t border-white/10">
                                            <div className="flex items-center gap-3 mb-3">
                                                <Lightbulb className="w-4 h-4 text-[#ecb613]" />
                                                <span className="text-xs font-bold tracking-wide uppercase">Teacher's Tip</span>
                                            </div>
                                            <p className="text-sm text-teal-50/90 leading-relaxed italic">
                                                "Consistency is the key to mastering the flute. Encourage students to practice for at least 15 minutes daily."
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                </main>
            </div>

            {/* Student Info Side Panel */}
            {sidePanelOpen && (
                <>
                    <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={() => setSidePanelOpen(false)} />
                    <div className="fixed right-0 top-0 h-full w-[450px] bg-white dark:bg-slate-900 z-50 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col animate-in slide-in-from-right">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                            <div>
                                <h3 className="font-bold text-lg">Classes for {selectedDateStr}</h3>
                                <p className="text-xs text-slate-500 mt-1">{selectedDateEvents.length} class(es) scheduled</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => {
                                        setTempModalDate(selectedDateStr);
                                        setTempSelectedStudents([]);
                                        setShowTempModal(true);
                                    }} 
                                    className="px-3 py-1.5 flex items-center gap-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 transition-colors text-xs font-bold"
                                >
                                    <Plus size={14} /> Add Class
                                </button>
                                <button onClick={() => setSidePanelOpen(false)} className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto space-y-6">
                            {panelLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                    <Loader2 className="w-8 h-8 animate-spin text-[#ecb613]" />
                                    <p className="text-sm font-medium text-slate-500">Loading student rosters...</p>
                                </div>
                            ) : selectedDateEvents.length > 0 ? (
                                selectedDateEvents.map((evt, idx) => (
                                    <div key={evt.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                            <div>
                                                <h4 className="font-bold text-sm text-slate-900 dark:text-white">{evt.name}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                                        evt.type === 'recurring' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                                                    }`}>
                                                        {evt.type}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                        <Clock size={12} /> {evt.time}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-bold text-[#ecb613]">{panelStudentsMap[evt.id]?.length || 0}</p>
                                                <p className="text-[9px] text-slate-400 font-bold uppercase">Students</p>
                                            </div>
                                        </div>
                                        <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50">
                                            {panelStudentsMap[evt.id]?.length > 0 ? (
                                                <div className="grid grid-cols-1 gap-2">
                                                    {panelStudentsMap[evt.id]?.map(s => (
                                                        <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-xs">
                                                            <div className="size-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                                                                {s.profile_pic_url ? (
                                                                    <img src={s.profile_pic_url} alt={s.name} className="w-full h-full object-cover rounded-full" />
                                                                ) : (
                                                                    <span className="text-[10px] font-bold">{s.name.charAt(0)}</span>
                                                                )}
                                                            </div>
                                                            <span className="text-xs font-medium truncate">{s.name}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-[10px] text-slate-400 text-center py-2 italic font-medium">No students enrolled yet.</p>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12">
                                    <Calendar size={48} className="mx-auto text-slate-200 mb-4" />
                                    <p className="text-sm font-medium text-slate-500">No classes scheduled for this day.</p>
                                    <button 
                                        onClick={() => {
                                            setTempModalDate(selectedDateStr);
                                            setTempSelectedStudents([]);
                                            setShowTempModal(true);
                                        }}
                                        className="mt-4 text-xs font-bold text-[#ecb613] hover:underline"
                                    >
                                        + Schedule a Temporary Class
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Temporary Class Modal */}
            {showTempModal && (
                <>
                    <div className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm" onClick={() => setShowTempModal(false)} />
                    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-[60] p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-lg">Add Temporary Class</h3>
                            <button onClick={() => { setShowTempModal(false); setTempSelectedStudents([]); }} className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-4">Date: {tempModalDate}</p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Title</label>
                                <input
                                    type="text"
                                    value={tempForm.title}
                                    onChange={e => setTempForm({ ...tempForm, title: e.target.value })}
                                    placeholder="e.g. Extra Practice Session"
                                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 focus:ring-2 focus:ring-[#ecb613] focus:border-transparent outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Start Time</label>
                                    <select
                                        value={tempForm.start_time}
                                        onChange={e => setTempForm({ ...tempForm, start_time: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 focus:ring-2 focus:ring-[#ecb613] focus:border-transparent outline-none"
                                    >
                                        {TIME_OPTIONS.map(opt => (
                                            <option key={`start-${opt.value}`} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">End Time</label>
                                    <select
                                        value={tempForm.end_time}
                                        onChange={e => setTempForm({ ...tempForm, end_time: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 focus:ring-2 focus:ring-[#ecb613] focus:border-transparent outline-none"
                                    >
                                        {TIME_OPTIONS.map(opt => (
                                            <option key={`end-${opt.value}`} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select Students</label>
                                <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-2 space-y-1 bg-slate-50 dark:bg-slate-800/50">
                                    {allStudents.length > 0 ? allStudents.map(s => (
                                        <label key={s.id} className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
                                            <input 
                                                type="checkbox" 
                                                checked={tempSelectedStudents.includes(s.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setTempSelectedStudents(prev => [...prev, s.id]);
                                                    else setTempSelectedStudents(prev => prev.filter(id => id !== s.id));
                                                }}
                                                className="w-4 h-4 rounded border-slate-300 text-[#ecb613] focus:ring-[#ecb613]"
                                            />
                                            <span className="text-sm font-medium">{s.name}</span>
                                        </label>
                                    )) : (
                                        <p className="text-xs text-slate-500 p-2 text-center">No students available.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={handleCreateTempClass}
                            className="mt-6 w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-500/20 text-sm"
                        >
                            Create Temporary Class
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
