'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../src/lib/supabase-auth';
import { supabase } from '../../src/lib/supabase';
import { 
    Loader2, Plus, Users, Clock, ArrowRight, Lightbulb, Video, 
    LayoutDashboard, ClipboardList, Calendar, Trash2, Edit, 
    CheckCircle, AlertCircle, ChevronLeft, ChevronRight, X,
    MessageSquare, StickyNote, Wallet, Sparkles, Coins
} from 'lucide-react';
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

function getLocalDateString(d: Date) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

    // New state hooks for dashboard enhancements
    const [feesStats, setFeesStats] = useState({
        collectedThisMonth: 0,
        dueStudentsCount: 0
    });
    const [inquiries, setInquiries] = useState<any[]>([]);
    const [inquiriesLoading, setInquiriesLoading] = useState(true);
    const [notes, setNotes] = useState<any[]>([]);
    const [notesLoading, setNotesLoading] = useState(true);
    const [forgottenClasses, setForgottenClasses] = useState<any[]>([]);
    const [showNoteModal, setShowNoteModal] = useState(false);
    const [noteForm, setNoteForm] = useState({ id: '', title: '', content: '', color: 'yellow', classroom_id: '' });
    const [isSavingNote, setIsSavingNote] = useState(false);

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
            const dateStr = getLocalDateString(d);
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
            cells.push({ day: prevMonthLast - i, current: false, isToday: false, date: getLocalDateString(d), events: [] });
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const dt = new Date(year, month, d);
            const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            cells.push({ day: d, current: true, isToday, date: getLocalDateString(dt), events: getEventsForDate(dt) });
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
            setNotesLoading(true);
            setInquiriesLoading(true);
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

                // 3. Fetch Stats & Roster data in Parallel
                const today = getLocalDateString(new Date());

                const [studentRes, classroomRes, pendingRes] = await Promise.all([
                    supabaseAuth.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student').eq('teacher_id', userId),
                    supabaseAuth.from('classrooms').select('id, name').eq('teacher_id', userId),
                    supabaseAuth.from('task_attempts').select('id, users!student_id(teacher_id)', { count: 'exact', head: true }).eq('status', 'submitted').eq('users.teacher_id', userId)
                ]);

                const roomList = classroomRes.data || [];
                setClassrooms(roomList);

                // Fetch student profiles for fees due calculation
                const { data: teacherStudents } = await supabaseAuth
                    .from('users')
                    .select('id, name, fees_classes_paid, fees_collection_date, fees_basis')
                    .eq('role', 'student')
                    .eq('teacher_id', userId);

                const studentList = teacherStudents || [];
                setAllStudents(studentList.map(s => ({ id: s.id, name: s.name })));

                // Calculate stats counts
                setStats({
                    totalStudents: studentRes.count || 0,
                    activeClassrooms: roomList.length || 0,
                    pendingSubmissions: pendingRes.count || 0,
                    todayClasses: 0 // Will be set dynamically by today's classes list
                });

                // Fetch fees payments for this month
                const startOfMonth = new Date();
                startOfMonth.setDate(1);
                const startOfMonthStr = getLocalDateString(startOfMonth);
                const { data: paymentsData } = await supabaseAuth
                    .from('fees_payments')
                    .select('amount, student_id')
                    .gte('payment_date', startOfMonthStr);

                const studentIds = studentList.map(s => s.id);
                const totalCollected = (paymentsData || [])
                    .filter(p => studentIds.includes(p.student_id))
                    .reduce((sum, p) => sum + Number(p.amount), 0);

                const dueCount = studentList.filter(s => {
                    const classesPaid = s.fees_classes_paid ?? 0;
                    const isLowClasses = classesPaid <= 1;
                    const isPassDueDate = s.fees_basis === 'monthly' && s.fees_collection_date && s.fees_collection_date <= today;
                    return isLowClasses || isPassDueDate;
                }).length;

                setFeesStats({
                    collectedThisMonth: totalCollected,
                    dueStudentsCount: dueCount
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

                // 5. Fetch Batch Schedules (for calendar & today's schedule)
                const { data: schedData } = await supabaseAuth
                    .from('batch_schedules')
                    .select('id, classroom_id, day_of_week, start_time, end_time, classrooms(name, teacher_id)')
                    .eq('classrooms.teacher_id', userId);
                
                let loadedSchedules: BatchSchedule[] = [];
                if (schedData) {
                    loadedSchedules = (schedData as any[]).map(s => ({
                        id: s.id, classroom_id: s.classroom_id, day_of_week: s.day_of_week,
                        start_time: s.start_time, end_time: s.end_time,
                        classroom_name: s.classrooms?.name || 'Unknown'
                    }));
                    setBatchSchedules(loadedSchedules);
                }

                // 6. Fetch Temporary Classes (for calendar & today's schedule)
                const { data: tempData } = await supabaseAuth
                    .from('temporary_classes')
                    .select('id, classroom_id, title, class_date, start_time, end_time, classrooms(name)')
                    .eq('teacher_id', userId);
                
                let loadedTemps: TemporaryClass[] = [];
                if (tempData) {
                    loadedTemps = (tempData as any[]).map(t => ({
                        id: t.id, classroom_id: t.classroom_id, title: t.title,
                        class_date: t.class_date, start_time: t.start_time, end_time: t.end_time,
                        classroom_name: t.classrooms?.name || 'Standalone'
                    }));
                    setTempClasses(loadedTemps);
                }

                // 7. Calculate Today's Scheduled Classes
                const todayDow = new Date().getDay(); // 0 = Sunday, 1 = Monday...
                const todayRecurring = loadedSchedules.filter(s => s.day_of_week === todayDow);
                const todayTemporary = loadedTemps.filter(t => t.class_date === today);

                const formattedTodayClasses: UpcomingClass[] = [
                    ...todayRecurring.map(s => ({
                        id: s.id,
                        classroom_id: s.classroom_id,
                        session_date: today,
                        start_time: s.start_time,
                        end_time: s.end_time,
                        classroom_name: s.classroom_name,
                        students_joined: 0
                    })),
                    ...todayTemporary.map(t => ({
                        id: t.id,
                        classroom_id: t.classroom_id || '',
                        session_date: today,
                        start_time: t.start_time,
                        end_time: t.end_time,
                        classroom_name: t.title,
                        students_joined: 0
                    }))
                ].sort((a, b) => a.start_time.localeCompare(b.start_time));

                setUpcomingClasses(formattedTodayClasses);
                setStats(prev => ({
                    ...prev,
                    todayClasses: formattedTodayClasses.length
                }));

                // 8. Fetch Personal Notes (class_notes)
                const { data: notesData } = await supabaseAuth
                    .from('class_notes')
                    .select('id, title, content, color, classroom_id, created_at, classrooms(name)')
                    .eq('teacher_id', userId)
                    .order('created_at', { ascending: false });

                if (notesData) {
                    setNotes((notesData as any[]).map(n => ({
                        id: n.id,
                        title: n.title,
                        content: n.content,
                        color: n.color || 'yellow',
                        classroom_id: n.classroom_id,
                        classroom_name: n.classrooms?.name || 'General',
                        created_at: n.created_at
                    })));
                }

                // 9. Fetch inquiries from marketing DB
                const { data: inquiriesData } = await supabase
                    .from('inquiries')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(5);

                if (inquiriesData) {
                    setInquiries(inquiriesData);
                }

                // 10. Scan for Forgotten Attendance in the last 14 days
                const fourteenDaysAgo = new Date();
                fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
                const fourteenDaysAgoStr = getLocalDateString(fourteenDaysAgo);

                const roomIds = roomList.map(c => c.id);
                let markedSet = new Set<string>();

                if (roomIds.length > 0) {
                    const { data: attendanceData } = await supabaseAuth
                        .from('attendance')
                        .select('classroom_id, date')
                        .in('classroom_id', roomIds)
                        .gte('date', fourteenDaysAgoStr);

                    if (attendanceData) {
                        attendanceData.forEach((r: any) => {
                            const cleanDate = r.date.split('T')[0].split(' ')[0];
                            markedSet.add(`${r.classroom_id}_${cleanDate}`);
                        });
                    }
                }

                const forgotten: any[] = [];
                // Loop back 14 days
                for (let i = 1; i <= 14; i++) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    const dStr = getLocalDateString(d);
                    const dow = d.getDay();
                    const dayName = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

                    // Check recurring batch schedules
                    loadedSchedules.filter(s => s.day_of_week === dow).forEach(s => {
                        const key = `${s.classroom_id}_${dStr}`;
                        if (!markedSet.has(key)) {
                            if (!forgotten.some(f => f.classroom_id === s.classroom_id && f.date === dStr)) {
                                forgotten.push({
                                    classroom_id: s.classroom_id,
                                    classroom_name: s.classroom_name,
                                    date: dStr,
                                    dayName
                                });
                            }
                        }
                    });

                    // Check temporary classes
                    loadedTemps.filter(t => t.class_date === dStr).forEach(t => {
                        const key = `${t.classroom_id}_${dStr}`;
                        if (!markedSet.has(key)) {
                            if (!forgotten.some(f => f.classroom_id === t.classroom_id && f.date === dStr)) {
                                forgotten.push({
                                    classroom_id: t.classroom_id,
                                    classroom_name: t.classroom_name,
                                    date: dStr,
                                    dayName
                                });
                            }
                        }
                    });
                }
                setForgottenClasses(forgotten);

            } catch (err) {
                console.error('Critical Dashboard Error:', err);
            } finally {
                setLoading(false);
                setNotesLoading(false);
                setInquiriesLoading(false);
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
                } else if (evt.type === 'temporary' && evt.classroom_id) {
                    const { data } = await supabaseAuth
                        .from('session_student_overrides')
                        .select('users!student_id(id, name, profile_pic_url)')
                        .eq('target_classroom_id', evt.classroom_id)
                        .eq('override_date', dateStr);
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
            if (tempSelectedStudents.length > 0 && classroom) {
                const studentInserts = tempSelectedStudents.map(studentId => ({
                    student_id: studentId,
                    target_classroom_id: classroom.id,
                    override_date: tempModalDate,
                    reason: 'Temporary Class Session'
                }));
                await supabaseAuth.from('session_student_overrides').insert(studentInserts);
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

    const handleSaveNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!noteForm.title.trim() || !noteForm.classroom_id) {
            alert('Please fill out the title and select a classroom.');
            return;
        }
        setIsSavingNote(true);
        try {
            const userId = (await supabaseAuth.auth.getSession()).data.session?.user.id;
            if (!userId) return;

            const noteData = {
                title: noteForm.title.trim(),
                content: noteForm.content.trim(),
                color: noteForm.color,
                classroom_id: noteForm.classroom_id,
                teacher_id: userId,
                updated_at: new Date().toISOString()
            };

            if (noteForm.id) {
                // Update
                const { error } = await supabaseAuth
                    .from('class_notes')
                    .update(noteData)
                    .eq('id', noteForm.id);
                if (error) throw error;
            } else {
                // Insert
                const { error } = await supabaseAuth
                    .from('class_notes')
                    .insert([noteData]);
                if (error) throw error;
            }

            // Refresh notes
            const { data: notesData } = await supabaseAuth
                .from('class_notes')
                .select('id, title, content, color, classroom_id, created_at, classrooms(name)')
                .eq('teacher_id', userId)
                .order('created_at', { ascending: false });

            if (notesData) {
                setNotes((notesData as any[]).map(n => ({
                    id: n.id,
                    title: n.title,
                    content: n.content,
                    color: n.color || 'yellow',
                    classroom_id: n.classroom_id,
                    classroom_name: n.classrooms?.name || 'General',
                    created_at: n.created_at
                })));
            }
            setShowNoteModal(false);
            setNoteForm({ id: '', title: '', content: '', color: 'yellow', classroom_id: '' });
        } catch (err) {
            console.error('Error saving note:', err);
            alert('Failed to save note.');
        } finally {
            setIsSavingNote(false);
        }
    };

    const handleDeleteNote = async (noteId: string) => {
        if (!confirm('Are you sure you want to delete this note?')) return;
        try {
            const { error } = await supabaseAuth
                .from('class_notes')
                .delete()
                .eq('id', noteId);
            if (error) throw error;

            setNotes(prev => prev.filter(n => n.id !== noteId));
        } catch (err) {
            console.error('Error deleting note:', err);
            alert('Failed to delete note.');
        }
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
                                { label: 'Total Students', value: stats.totalStudents, icon: 'person', color: 'blue', status: 'Live', href: '/teacher-dashboard/students' },
                                { label: 'Active Classrooms', value: stats.activeClassrooms, icon: 'meeting_room', color: 'amber', status: 'Active', href: '/teacher-dashboard/classrooms' },
                                { label: 'Pending Submissions', value: stats.pendingSubmissions, icon: 'assignment_late', color: 'purple', status: 'Review', href: '/teacher-dashboard/submissions' },
                                { label: 'Fees Collection (Month)', value: `₹${feesStats.collectedThisMonth.toLocaleString('en-IN')}`, icon: 'payments', color: 'emerald', status: feesStats.dueStudentsCount > 0 ? `${feesStats.dueStudentsCount} Due` : 'Paid', href: '/teacher-dashboard/fees' }
                            ].map((stat, i) => (
                                <Link key={i} href={stat.href} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:scale-[1.02] hover:shadow-md block">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className={`p-2 bg-${stat.color === 'emerald' ? 'emerald-50 dark:bg-emerald-950/20 text-emerald-600' : `${stat.color}-50 dark:bg-${stat.color}-900/20 text-${stat.color}-600`} rounded-lg`}>
                                            <span className="material-symbols-outlined">{stat.icon}</span>
                                        </div>
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                            stat.label === 'Total Students' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 
                                            stat.label === 'Active Classrooms' ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' : 
                                            stat.label === 'Pending Submissions' ? 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' : 
                                            feesStats.dueStudentsCount > 0 ? 'text-rose-600 bg-rose-50 dark:bg-rose-900/20 animate-pulse' : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
                                        }`}>
                                            {stat.status}
                                        </span>
                                    </div>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{stat.label}</p>
                                    <h3 className="text-2xl font-bold mt-1">{stat.value}</h3>
                                </Link>
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

                                {/* 2-Column Grid: Notebook & Student Inquiries */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Personal Idea Notebook */}
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[480px]">
                                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
                                            <div className="flex items-center gap-2">
                                                <StickyNote className="w-5 h-5 text-[#ecb613]" />
                                                <h3 className="font-bold text-lg">Personal Idea Notebook</h3>
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    setNoteForm({ id: '', title: '', content: '', color: 'yellow', classroom_id: classrooms[0]?.id || '' });
                                                    setShowNoteModal(true);
                                                }}
                                                className="px-3 py-1.5 flex items-center gap-1 bg-[#ecb613]/10 hover:bg-[#ecb613]/20 text-[#ecb613] rounded-lg transition-colors text-xs font-bold"
                                            >
                                                <Plus size={14} /> Add Note
                                            </button>
                                        </div>
                                        
                                        <div className="p-6 flex-1 overflow-y-auto space-y-4 custom-scrollbar bg-slate-50/30 dark:bg-slate-900/10">
                                            {notesLoading ? (
                                                <div className="flex flex-col items-center justify-center h-full space-y-2">
                                                    <Loader2 className="w-6 h-6 animate-spin text-[#ecb613]" />
                                                    <p className="text-xs text-slate-400">Loading your ideas...</p>
                                                </div>
                                            ) : notes.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                                                    <Lightbulb className="w-8 h-8 text-slate-300 mb-2 animate-bounce" />
                                                    <p className="text-sm font-semibold text-slate-500">Your notebook is empty</p>
                                                    <p className="text-xs text-slate-400 max-w-[240px] mt-1 leading-relaxed">
                                                        Jot down class structures, concert plans, or teaching ideas.
                                                    </p>
                                                </div>
                                            ) : (
                                                notes.map(note => {
                                                    let colorClasses = 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30 text-amber-950 dark:text-amber-200';
                                                    if (note.color === 'blue') colorClasses = 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/30 text-blue-950 dark:text-blue-200';
                                                    if (note.color === 'green') colorClasses = 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30 text-emerald-950 dark:text-emerald-200';
                                                    if (note.color === 'pink') colorClasses = 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/30 text-rose-950 dark:text-rose-200';
                                                    
                                                    return (
                                                        <div key={note.id} className={`p-4 rounded-xl border shadow-xs transition-all hover:shadow-sm ${colorClasses}`}>
                                                            <div className="flex justify-between items-start">
                                                                <h4 className="font-bold text-sm leading-tight">{note.title}</h4>
                                                                <div className="flex items-center gap-1.5 ml-2">
                                                                    <button 
                                                                        onClick={() => {
                                                                            setNoteForm({
                                                                                id: note.id,
                                                                                title: note.title,
                                                                                content: note.content,
                                                                                color: note.color,
                                                                                classroom_id: note.classroom_id
                                                                            });
                                                                            setShowNoteModal(true);
                                                                        }} 
                                                                        className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors text-slate-600 dark:text-slate-400"
                                                                        title="Edit Note"
                                                                    >
                                                                        <Edit size={12} />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleDeleteNote(note.id)} 
                                                                        className="p-1 hover:bg-red-500/10 hover:text-red-500 rounded transition-colors text-slate-600 dark:text-slate-400"
                                                                        title="Delete Note"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <p className="text-xs mt-2 whitespace-pre-line leading-relaxed opacity-90">{note.content}</p>
                                                            <div className="flex items-center justify-between border-t border-black/5 dark:border-white/5 mt-3 pt-2 text-[9px] font-semibold uppercase tracking-wider opacity-75">
                                                                <span>Class: {note.classroom_name}</span>
                                                                <span>{new Date(note.created_at).toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>

                                    {/* Student Messages / Website Inquiries */}
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[480px]">
                                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
                                            <div className="flex items-center gap-2">
                                                <MessageSquare className="w-5 h-5 text-[#ecb613]" />
                                                <h3 className="font-bold text-lg">Student Inquiries & Messages</h3>
                                            </div>
                                            <Link className="text-xs font-bold text-[#ecb613] hover:underline" href="/teacher-dashboard/messages">Compose Reply</Link>
                                        </div>
                                        
                                        <div className="p-6 flex-1 overflow-y-auto space-y-4 custom-scrollbar bg-slate-50/30 dark:bg-slate-900/10">
                                            {inquiriesLoading ? (
                                                <div className="flex flex-col items-center justify-center h-full space-y-2">
                                                    <Loader2 className="w-6 h-6 animate-spin text-[#ecb613]" />
                                                    <p className="text-xs text-slate-400">Loading student messages...</p>
                                                </div>
                                            ) : inquiries.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                                                    <MessageSquare className="w-8 h-8 text-slate-300 mb-2 animate-pulse" />
                                                    <p className="text-sm font-semibold text-slate-500">No student messages</p>
                                                    <p className="text-xs text-slate-400 max-w-[240px] mt-1 leading-relaxed">
                                                        New inquiries from the website contact form will appear here.
                                                    </p>
                                                </div>
                                            ) : (
                                                inquiries.map(inq => {
                                                    const whatsappText = encodeURIComponent(`Hi ${inq.name}, thank you for contacting Krishna Flute Academy! This is Sri Krishna Gopal Bhaumik. I received your inquiry about the ${inq.course || 'Beginner Course'}.`);
                                                    const cleanPhone = (inq.phone || '').replace(/[^0-9]/g, '');
                                                    const whatsappUrl = `https://wa.me/${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}?text=${whatsappText}`;
                                                    
                                                    return (
                                                        <div key={inq.id} className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-xs space-y-2 hover:border-slate-200 dark:hover:border-slate-600 transition-colors">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">{inq.name}</h4>
                                                                    {inq.course && (
                                                                        <span className="inline-block px-2 py-0.5 mt-1 bg-yellow-50 dark:bg-yellow-950/20 text-[#a15912] dark:text-yellow-400 rounded-md text-[9px] font-bold uppercase border border-yellow-100 dark:border-yellow-900/30">
                                                                            {inq.course}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="text-[10px] text-slate-400 font-semibold">
                                                                    {inq.created_at ? new Date(inq.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Recent'}
                                                                </span>
                                                            </div>
                                                            {inq.message ? (
                                                                <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100/50 dark:border-slate-800/50 italic leading-relaxed whitespace-pre-line">
                                                                    "{inq.message}"
                                                                </p>
                                                            ) : (
                                                                <p className="text-xs text-slate-400 italic">No custom message provided.</p>
                                                            )}
                                                            <div className="flex items-center justify-between border-t border-slate-50 dark:border-slate-700/50 pt-2 mt-2">
                                                                <div className="flex flex-col text-[10px] text-slate-500">
                                                                    {inq.email && <a href={`mailto:${inq.email}`} className="hover:text-[#ecb613] hover:underline font-medium truncate max-w-[150px]">{inq.email}</a>}
                                                                    {inq.phone && <a href={`tel:${inq.phone}`} className="hover:text-[#ecb613] hover:underline font-bold mt-0.5">{inq.phone}</a>}
                                                                </div>
                                                                {inq.phone && (
                                                                    <a 
                                                                        href={whatsappUrl} 
                                                                        target="_blank" 
                                                                        rel="noopener noreferrer" 
                                                                        className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-[10px] font-bold transition-all flex items-center gap-1 shadow-sm shadow-emerald-500/10"
                                                                    >
                                                                        Chat via WhatsApp
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Sidebar: Upcoming Classes & Tasks */}
                            <section className="space-y-8">
                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                    <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                                        <h3 className="font-bold text-lg">Today's Classes</h3>
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
                                                <p className="text-slate-500 text-sm">No classes scheduled for today.</p>
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

                                            {/* Forgotten Attendance List */}
                                            {forgottenClasses.length > 0 && (
                                                <div className="space-y-2 mt-4">
                                                    <p className="text-xs font-bold text-teal-100/70 uppercase tracking-wider">Forgot Attendance ({forgottenClasses.length})</p>
                                                    <div className="max-h-[180px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                                        {forgottenClasses.map((item, idx) => (
                                                            <div key={idx} className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5 text-xs">
                                                                <div className="truncate pr-2">
                                                                    <p className="font-bold truncate">{item.classroom_name}</p>
                                                                    <p className="text-[10px] text-teal-100/60 mt-0.5">{item.dayName}</p>
                                                                </div>
                                                                <Link 
                                                                    href={`/teacher-dashboard/attendance?date=${item.date}&classId=${item.classroom_id}`}
                                                                    className="bg-[#ecb613] hover:bg-white text-slate-900 px-2.5 py-1 rounded font-bold transition-all flex items-center gap-1 flex-shrink-0"
                                                                >
                                                                    Mark
                                                                    <ArrowRight className="w-2.5 h-2.5" />
                                                                </Link>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
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
            {/* Note Editor Modal */}
            {showNoteModal && (
                <>
                    <div className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm" onClick={() => setShowNoteModal(false)} />
                    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-[60] p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-lg">{noteForm.id ? 'Edit Idea / Note' : 'Add New Idea / Note'}</h3>
                            <button onClick={() => setShowNoteModal(false)} className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveNote} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Note Title</label>
                                <input
                                    type="text"
                                    required
                                    value={noteForm.title}
                                    onChange={e => setNoteForm({ ...noteForm, title: e.target.value })}
                                    placeholder="e.g. Concert preparation ideas"
                                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 focus:ring-2 focus:ring-[#ecb613] focus:border-transparent outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Note Content</label>
                                <textarea
                                    value={noteForm.content}
                                    onChange={e => setNoteForm({ ...noteForm, content: e.target.value })}
                                    placeholder="Compose your thoughts, plans, or guidelines..."
                                    rows={4}
                                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 focus:ring-2 focus:ring-[#ecb613] focus:border-transparent outline-none resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select Classroom</label>
                                <select
                                    required
                                    value={noteForm.classroom_id}
                                    onChange={e => setNoteForm({ ...noteForm, classroom_id: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 focus:ring-2 focus:ring-[#ecb613] focus:border-transparent outline-none"
                                >
                                    <option value="" disabled>-- Select Classroom --</option>
                                    {classrooms.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Color Theme</label>
                                <div className="flex gap-4">
                                    {[
                                        { name: 'yellow', colorClass: 'bg-yellow-400 border-yellow-500' },
                                        { name: 'blue', colorClass: 'bg-blue-400 border-blue-500' },
                                        { name: 'green', colorClass: 'bg-emerald-400 border-emerald-500' },
                                        { name: 'pink', colorClass: 'bg-pink-400 border-pink-500' }
                                    ].map(colorOpt => (
                                        <button
                                            key={colorOpt.name}
                                            type="button"
                                            onClick={() => setNoteForm({ ...noteForm, color: colorOpt.name })}
                                            className={`size-8 rounded-full border-2 transition-all ${colorOpt.colorClass} ${
                                                noteForm.color === colorOpt.name ? 'ring-2 ring-slate-800 dark:ring-white scale-110 shadow-md' : 'opacity-80'
                                            }`}
                                        />
                                    ))}
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={isSavingNote}
                                className="mt-6 w-full py-3 bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900 font-bold rounded-xl transition-all shadow-lg shadow-[#ecb613]/20 text-sm flex items-center justify-center gap-2"
                            >
                                {isSavingNote && <Loader2 className="w-4 h-4 animate-spin" />}
                                {noteForm.id ? 'Update Note' : 'Save Note'}
                            </button>
                        </form>
                    </div>
                </>
            )}
        </div>
    );
}
