'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../lib/supabase-auth';
import { supabase } from '../../lib/supabase';
import { 
    Loader2, Plus, Users, Clock, ArrowRight, Lightbulb, Video, 
    LayoutDashboard, ClipboardList, Calendar, Trash2, Edit, 
    CheckCircle, AlertCircle, ChevronLeft, ChevronRight, X,
    MessageSquare, StickyNote, Wallet, Sparkles, Coins, Search
} from 'lucide-react';
import TeacherSidebar from '../TeacherSidebar';
import TeacherHeader from '../TeacherHeader';
import Link from 'next/link';
import { useToast } from '../../lib/ToastContext';
import { getStudentFeeStatus } from '../../lib/fee-utils';

// Import subcomponents
import StatsSummary from './StatsSummary';
import SubmissionsWidget from './SubmissionsWidget';
import AnnouncementsWidget from './AnnouncementsWidget';
import CalendarWidget from './CalendarWidget';
import PersonalNotebookWidget from './PersonalNotebookWidget';
import MessagesWidget from './MessagesWidget';
import ClassesListWidget from './ClassesListWidget';
import PriorityTasksWidget from './PriorityTasksWidget';

// --- Types ---
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
    day_of_week: number;
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

interface PersonalNote {
    id: string;
    title: string;
    content: string;
    color: string;
    classroom_id: string;
    classroom_name?: string;
    created_at: string;
}

interface Inquiry {
    id: string;
    name: string;
    email: string;
    phone: string;
    message: string;
    course?: string;
    created_at: string;
}

// --- Helper Functions ---
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
    return `${hours}:${m} ${ampm}`;
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
};
const TIME_OPTIONS = generateTimeOptions();

function addOneHour(timeStr: string): string {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length < 2) return '';
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return '';
    const newHour = (h + 1) % 24;
    return `${String(newHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * TeacherDashboardContainer is the master container for the teacher overview.
 * Manages database fetching, calendar calculations, notes saving, and modal displays.
 */
export default function TeacherDashboardContainer() {
    const router = useRouter();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/');
    };
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string; role?: string } | null>(null);
    
    // Core metrics
    const [stats, setStats] = useState({ totalStudents: 0, activeClassrooms: 0, pendingSubmissions: 0 });
    const [feesStats, setFeesStats] = useState({ collectedThisMonth: 0, dueStudentsCount: 0 });
    const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
    
    // Calendar & scheduling
    const [calendarDate, setCalendarDate] = useState(new Date());
    const [classroomSchedules, setClassroomSchedules] = useState<BatchSchedule[]>([]);
    const [temporaryClasses, setTemporaryClasses] = useState<TemporaryClass[]>([]);
    const [upcomingClasses, setUpcomingClasses] = useState<UpcomingClass[]>([]);
    const [forgottenClasses, setForgottenClasses] = useState<any[]>([]);
    const [classrooms, setClassrooms] = useState<any[]>([]);

    // Side panel (calendar click details)
    const [sidePanelOpen, setSidePanelOpen] = useState(false);
    const [selectedDateStr, setSelectedDateStr] = useState('');
    const [selectedDateEvents, setSelectedDateEvents] = useState<CalendarEvent[]>([]);
    const [panelClassStudents, setPanelClassStudents] = useState<Record<string, PanelStudent[]>>({});

    // Notes
    const [notes, setNotes] = useState<PersonalNote[]>([]);
    const [notesLoading, setNotesLoading] = useState(true);
    const [showNoteModal, setShowNoteModal] = useState(false);
    const [noteForm, setNoteForm] = useState({ id: '', title: '', content: '', color: 'yellow', classroom_id: '' });
    const [isSavingNote, setIsSavingNote] = useState(false);

    // Inquiries
    const [inquiries, setInquiries] = useState<Inquiry[]>([]);
    const [inquiriesLoading, setInquiriesLoading] = useState(true);

    // Temporary class scheduler modal
    const [showTempModal, setShowTempModal] = useState(false);
    const [tempModalDate, setTempModalDate] = useState('');
    const [allStudents, setAllStudents] = useState<{ id: string; name: string }[]>([]);
    const [tempSelectedStudents, setTempSelectedStudents] = useState<string[]>([]);
    const [tempForm, setTempForm] = useState({ title: '', start_time: '10:00', end_time: '11:00', classroom_id: '', teacher_id: '', delivery_format: 'offline' });
    const [studentSearchQuery, setStudentSearchQuery] = useState('');
    
    // Admin features
    const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);

    // Admin Priority Tasks details
    const [unassignedStudents, setUnassignedStudents] = useState<{ id: string; name: string }[]>([]);
    const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);
    const [pendingPayments, setPendingPayments] = useState<any[]>([]);
    const [dueStudents, setDueStudents] = useState<any[]>([]);
    const [pendingSubmissionsList, setPendingSubmissionsList] = useState<any[]>([]);

    const isAdmin = teacherProfile?.role === 'admin';

    const loadDashboardData = async () => {
        try {
            const { data: { session } } = await supabaseAuth.auth.getSession();
            if (!session) { router.push('/login?type=teacher'); return; }

            const userId = session.user.id;

            // 1. Profile
            const { data: profile } = await supabaseAuth
                .from('users')
                .select('id, name, email, role')
                .eq('id', userId)
                .single();

            if (!profile || profile.role === 'student') {
                router.push('/');
                return;
            }
            setTeacherProfile(profile);

            // If Admin, load teacher listing for dropdown
            if (profile.role === 'admin') {
                const { data: teacherUsers } = await supabaseAuth
                    .from('users')
                    .select('id, name')
                    .eq('role', 'teacher');
                setTeachers(teacherUsers || []);
            }

            // 2. Classrooms (All classrooms for Admin, assigned classrooms for Teachers)
            let classQuery = supabaseAuth.from('classrooms').select('id, name, description, teacher_id');
            if (profile.role !== 'admin') {
                classQuery = classQuery.eq('teacher_id', userId);
            }
            const { data: dbClassrooms } = await classQuery;
            const classIds = (dbClassrooms || []).map(c => c.id);
            setClassrooms(dbClassrooms || []);

            // 3. Stats & Submissions
            // Core stats count
            let studentsCount = 0;
            if (classIds.length > 0) {
                const { count } = await supabaseAuth
                    .from('classroom_students')
                    .select('*', { count: 'exact', head: true })
                    .in('classroom_id', classIds);
                studentsCount = count || 0;
            }

            // Fetch assignments list for these classrooms once to resolve mapping without DB joins
            let assignmentIds: string[] = [];
            let assignmentsList: any[] = [];
            if (classIds.length > 0) {
                const { data: dbAsgs } = await supabaseAuth
                    .from('assignments')
                    .select('id, title, classroom_id')
                    .in('classroom_id', classIds);
                assignmentsList = dbAsgs || [];
                assignmentIds = assignmentsList.map(a => a.id);
            }

            let pendingSubmissionsCount = 0;
            if (assignmentIds.length > 0) {
                const { count } = await supabaseAuth
                    .from('assignment_students')
                    .select('id', { count: 'exact' })
                    .in('assignment_id', assignmentIds)
                    .eq('status', 'submitted');
                pendingSubmissionsCount = count || 0;
            }

            setStats({
                totalStudents: studentsCount,
                activeClassrooms: classIds.length,
                pendingSubmissions: pendingSubmissionsCount
            });

            // Fees Stats (Admin only)
            if (profile.role === 'admin') {
                const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
                
                const { data: collections } = await supabaseAuth
                    .from('fees_payments')
                    .select('amount')
                    .eq('status', 'approved')
                    .gte('payment_date', startOfMonth);
                
                const totalCollected = (collections || []).reduce((acc, row) => acc + (Number(row.amount) || 0), 0);

                // Fetch due students count by running the calculation locally
                const { data: allStudsForStats } = await supabaseAuth
                    .from('users')
                    .select('id, name, fees_basis, fees_amount, fees_collection_date, fees_classes_paid')
                    .eq('role', 'student');

                const { data: allPayForStats } = await supabaseAuth
                    .from('fees_payments')
                    .select('id, student_id, amount, payment_date, status');

                let localDueCount = 0;
                if (allStudsForStats) {
                    for (const student of allStudsForStats) {
                        if (Number(student.fees_amount) > 0) {
                            const studentPayments = (allPayForStats || []).filter(p => p.student_id === student.id);
                            const classesCompleted = (student.fees_classes_paid || 0) <= 0;
                            let isFeeDue = false;

                            if (student.fees_basis === 'monthly' && student.fees_collection_date) {
                                const feeStatus = getStudentFeeStatus(
                                    student.fees_basis,
                                    Number(student.fees_collection_date),
                                    studentPayments
                                );
                                if (feeStatus) {
                                    isFeeDue = feeStatus.status === 'overdue' || feeStatus.status === 'due' || classesCompleted;
                                }
                            } else {
                                if (classesCompleted) {
                                    isFeeDue = true;
                                }
                            }

                            if (isFeeDue) {
                                localDueCount++;
                            }
                        }
                    }
                }

                setFeesStats({
                    collectedThisMonth: totalCollected,
                    dueStudentsCount: localDueCount
                });
            }

            // Recent Submissions
            if (assignmentIds.length > 0) {
                const { data: attempts } = await supabaseAuth
                    .from('assignment_students')
                    .select('id, submitted_at, status, student_id, video_url, assignment_id')
                    .in('assignment_id', assignmentIds)
                    .order('submitted_at', { ascending: false })
                    .limit(5);

                const attemptsList = attempts || [];
                const studentIds = Array.from(new Set(attemptsList.map((att: any) => att.student_id)));

                let studentLookup = new Map();
                if (studentIds.length > 0) {
                    const { data: studentUsers } = await supabaseAuth
                        .from('users')
                        .select('id, name, profile_pic_url')
                        .in('id', studentIds);
                    studentLookup = new Map(studentUsers?.map(u => [u.id, u]) || []);
                }

                const assignmentLookup = new Map(assignmentsList.map(a => [a.id, a]));

                const formattedAttempts: Submission[] = attemptsList.map((att: any) => {
                    const student = studentLookup.get(att.student_id);
                    const assignment = assignmentLookup.get(att.assignment_id);
                    return {
                        id: att.id,
                        student_name: student?.name || 'Student',
                        student_profile_pic_url: student?.profile_pic_url || undefined,
                        task_title: assignment?.title || 'Assignment Task',
                        status: att.status || 'submitted',
                        video_url: att.video_url,
                        submitted_at: att.submitted_at 
                            ? new Date(att.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) 
                            : 'Recent'
                    };
                });
                setRecentSubmissions(formattedAttempts);
            } else {
                setRecentSubmissions([]);
            }

            // 4. Calendar data: Recurring Schedules & Temporary Classes
            let localSchedules: BatchSchedule[] = [];
            let localTemps: TemporaryClass[] = [];

            if (classIds.length > 0) {
                const { data: schedules } = await supabaseAuth
                    .from('batch_schedules')
                    .select('id, classroom_id, classrooms(name), day_of_week, start_time, end_time')
                    .in('classroom_id', classIds);

                const formattedSchedules: BatchSchedule[] = (schedules || []).map((sch: any) => ({
                    id: sch.id,
                    classroom_id: sch.classroom_id,
                    classroom_name: sch.classrooms?.name || 'Classroom',
                    day_of_week: sch.day_of_week,
                    start_time: sch.start_time,
                    end_time: sch.end_time
                }));
                setClassroomSchedules(formattedSchedules);
                localSchedules = formattedSchedules;

                // Fetch temporary classes
                const { data: temps } = await supabaseAuth
                    .from('temporary_classes')
                    .select('id, classroom_id, classrooms(name), title, class_date, start_time, end_time')
                    .in('classroom_id', classIds);

                const formattedTemps: TemporaryClass[] = (temps || []).map((t: any) => ({
                    id: t.id,
                    classroom_id: t.classroom_id,
                    classroom_name: t.classrooms?.name || t.title || 'Special Session',
                    title: t.title || 'Temporary Class',
                    class_date: t.class_date,
                    start_time: t.start_time,
                    end_time: t.end_time
                }));
                setTemporaryClasses(formattedTemps);
                localTemps = formattedTemps;
            }

            // 5. Today's Classes List (Sunday=0, Monday=1, ... in batch_schedules)
            if (classIds.length > 0) {
                const todayDow = new Date().getDay(); // Sunday=0, Monday=1, ...
                const todaySchedules = localSchedules.filter(sch => sch.day_of_week === todayDow);
                const todayDateStr = getLocalDateString(new Date());
                const todayTemps = localTemps.filter(t => t.class_date === todayDateStr);

                const unifiedClasses: UpcomingClass[] = [];

                // Recurring classes
                for (const sch of todaySchedules) {
                    const { data: studentList } = await supabaseAuth
                        .from('classroom_students')
                        .select('student_id')
                        .eq('classroom_id', sch.classroom_id);
                    
                    unifiedClasses.push({
                        id: `rec-${sch.id}`,
                        classroom_id: sch.classroom_id,
                        session_date: todayDateStr,
                        start_time: sch.start_time,
                        end_time: sch.end_time,
                        classroom_name: sch.classroom_name,
                        students_joined: studentList?.length || 0
                    });
                }

                // Temporary classes
                for (const t of todayTemps) {
                    const { data: overrideList } = await supabaseAuth
                        .from('session_student_overrides')
                        .select('student_id')
                        .eq('target_classroom_id', t.classroom_id)
                        .eq('override_date', todayDateStr);

                    unifiedClasses.push({
                        id: `temp-${t.id}`,
                        classroom_id: t.classroom_id || '',
                        session_date: todayDateStr,
                        start_time: t.start_time,
                        end_time: t.end_time,
                        classroom_name: t.classroom_name,
                        students_joined: overrideList?.length || 0
                    });
                }

                // Sort by time
                unifiedClasses.sort((a, b) => a.start_time.localeCompare(b.start_time));
                setUpcomingClasses(unifiedClasses);
            }

            // 6. Forgotten Attendance
            if (classIds.length > 0) {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                const weekAgoStr = getLocalDateString(weekAgo);
                const yesterdayStr = getLocalDateString(new Date(Date.now() - 86400000));

                const scheduleMap: Record<number, BatchSchedule[]> = {};
                localSchedules.forEach(sch => {
                    if (!scheduleMap[sch.day_of_week]) scheduleMap[sch.day_of_week] = [];
                    scheduleMap[sch.day_of_week].push(sch);
                });

                const forgottenList: any[] = [];
                let loopDate = new Date(weekAgo);
                const yesterdayObj = new Date(yesterdayStr);

                while (loopDate <= yesterdayObj) {
                    const loopDateStr = getLocalDateString(loopDate);
                    const dow = loopDate.getDay(); // Sunday=0, Monday=1, ...
                    const dayName = loopDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });

                    const activeSchedules = scheduleMap[dow] || [];
                    for (const sch of activeSchedules) {
                        const { data: attendanceRecord } = await supabaseAuth
                            .from('attendance')
                            .select('id')
                            .eq('classroom_id', sch.classroom_id)
                            .eq('date', loopDateStr)
                            .limit(1);

                        if (!attendanceRecord || attendanceRecord.length === 0) {
                            forgottenList.push({
                                classroom_id: sch.classroom_id,
                                classroom_name: sch.classroom_name,
                                date: loopDateStr,
                                dayName: dayName
                            });
                        }
                    }
                    loopDate.setDate(loopDate.getDate() + 1);
                }
                setForgottenClasses(forgottenList);
            }

            // 7. Load all students listing for temporary assignment modal
            const { data: studentsList } = await supabaseAuth
                .from('users')
                .select('id, name')
                .eq('role', 'student')
                .eq('status', 'active')
                .order('name', { ascending: true });
            setAllStudents(studentsList || []);

            // 8. Fetch active students not assigned to any classroom
            const { data: activeStudents } = await supabaseAuth
                .from('users')
                .select('id, name')
                .eq('role', 'student')
                .eq('status', 'active');

            const { data: classroomStudents } = await supabaseAuth
                .from('classroom_students')
                .select('student_id');

            const assignedSet = new Set((classroomStudents || []).map((cs: any) => cs.student_id));
            const unassignedList = (activeStudents || []).filter((s: any) => !assignedSet.has(s.id));
            setUnassignedStudents(unassignedList);

            // 9. Fetch pending Leave/Excuse Requests
            let leaveQuery = supabaseAuth
                .from('leave_requests')
                .select('id, class_date, reason, status, student_id, users!student_id(name), classroom_id, classrooms(name)')
                .eq('status', 'pending');
            if (profile.role !== 'admin' && classIds.length > 0) {
                leaveQuery = leaveQuery.in('classroom_id', classIds);
            }
            const { data: dbLeaves } = await leaveQuery;
            const formattedLeaves = (dbLeaves || []).map((lr: any) => ({
                id: lr.id,
                student_name: lr.users?.name || 'Student',
                classroom_name: lr.classrooms?.name || 'Classroom',
                class_date: lr.class_date,
                reason: lr.reason || 'No reason provided'
            }));
            setPendingLeaves(formattedLeaves);

            // 10. Fetch pending Payments & calculate Due Students for priority widget
            const { data: allStuds } = await supabaseAuth
                .from('users')
                .select('id, name, fees_basis, fees_amount, fees_collection_date, fees_classes_paid')
                .eq('role', 'student');

            const { data: allPay } = await supabaseAuth
                .from('fees_payments')
                .select('id, student_id, amount, payment_date, status');

            const pList: any[] = [];
            const dList: any[] = [];

            if (allStuds) {
                for (const student of allStuds) {
                    const studentPayments = (allPay || []).filter(p => p.student_id === student.id);
                    
                    const hasPendingApproval = studentPayments.some(p => p.status === 'pending_approval');
                    if (hasPendingApproval) {
                        const pendingPay = studentPayments.find(p => p.status === 'pending_approval');
                        if (pendingPay) {
                            pList.push({
                                id: pendingPay.id,
                                student_id: student.id,
                                student_name: student.name,
                                amount: pendingPay.amount,
                                payment_date: pendingPay.payment_date
                            });
                        }
                    }

                    if (Number(student.fees_amount) > 0) {
                        const classesCompleted = (student.fees_classes_paid || 0) <= 0;
                        let isFeeDue = false;
                        let dueReason = '';

                        if (student.fees_basis === 'monthly' && student.fees_collection_date) {
                            const feeStatus = getStudentFeeStatus(
                                student.fees_basis,
                                Number(student.fees_collection_date),
                                studentPayments
                            );
                            if (feeStatus) {
                                const dateIsDue = feeStatus.status === 'overdue' || feeStatus.status === 'due';
                                if (dateIsDue && classesCompleted) {
                                    isFeeDue = true;
                                    dueReason = 'Overdue date & class balance';
                                } else if (classesCompleted) {
                                    isFeeDue = true;
                                    dueReason = 'Class balance completed';
                                } else if (feeStatus.status === 'overdue') {
                                    isFeeDue = true;
                                    dueReason = `Monthly fee overdue since ${feeStatus.formattedDueDate}`;
                                } else if (feeStatus.status === 'due') {
                                    isFeeDue = true;
                                    dueReason = `Monthly fee due today (${feeStatus.formattedDueDate})`;
                                }
                            }
                        } else {
                            if (classesCompleted) {
                                isFeeDue = true;
                                dueReason = 'Prepaid classes finished';
                            }
                        }

                        if (isFeeDue) {
                            dList.push({
                                student_id: student.id,
                                student_name: student.name,
                                reason: dueReason,
                                fees_amount: Number(student.fees_amount)
                            });
                        }
                    }
                }
            }
            setPendingPayments(pList);
            setDueStudents(dList);

            // 11. Fetch pending submissions list for task validation
            if (assignmentIds.length > 0) {
                const { data: pendingAttempts } = await supabaseAuth
                    .from('assignment_students')
                    .select('id, submitted_at, student_id, assignment_id')
                    .in('assignment_id', assignmentIds)
                    .eq('status', 'submitted')
                    .order('submitted_at', { ascending: false });
                
                const pendingAttemptsList = pendingAttempts || [];
                const studentIds = Array.from(new Set(pendingAttemptsList.map((att: any) => att.student_id)));

                let studentLookup = new Map();
                if (studentIds.length > 0) {
                    const { data: studentUsers } = await supabaseAuth
                        .from('users')
                        .select('id, name')
                        .in('id', studentIds);
                    studentLookup = new Map(studentUsers?.map(u => [u.id, u]) || []);
                }

                const assignmentLookup = new Map(assignmentsList.map(a => [a.id, a]));

                const formattedPending = pendingAttemptsList.map((att: any) => {
                    const student = studentLookup.get(att.student_id);
                    const assignment = assignmentLookup.get(att.assignment_id);
                    return {
                        id: att.id,
                        student_name: student?.name || 'Student',
                        task_title: assignment?.title || 'Assignment Task',
                        submitted_at: att.submitted_at
                    };
                });
                setPendingSubmissionsList(formattedPending);
            } else {
                setPendingSubmissionsList([]);
            }

        } catch (e) {
            console.error('Failed to load dashboard:', e);
        }
    };

    const loadNotesData = async () => {
        try {
            setNotesLoading(true);
            const { data: { session } } = await supabaseAuth.auth.getSession();
            if (!session) return;

            // Load notes. Admin sees all notes, teachers see their own notes.
            let query = supabaseAuth
                .from('personal_notes')
                .select('*, classrooms(name)');
            
            if (teacherProfile?.role !== 'admin') {
                query = query.eq('teacher_id', session.user.id);
            }
            
            const { data: notesData } = await query.order('created_at', { ascending: false });

            const formatted: PersonalNote[] = (notesData || []).map((n: any) => ({
                id: n.id,
                title: n.title,
                content: n.content,
                color: n.color || 'yellow',
                classroom_id: n.classroom_id,
                classroom_name: n.classrooms?.name || 'General',
                created_at: n.created_at
            }));

            setNotes(formatted);
        } catch (e) {
            console.error('Failed to load notes:', e);
        } finally {
            setNotesLoading(false);
        }
    };

    const loadInquiriesData = async () => {
        try {
            setInquiriesLoading(true);
            // Admin or Teachers can read contact inquiries
            const { data: inqs } = await supabaseAuth
                .from('contact_inquiries')
                .select('*')
                .order('created_at', { ascending: false });
            setInquiries(inqs || []);
        } catch (e) {
            console.error('Failed to load inquiries:', e);
        } finally {
            setInquiriesLoading(false);
        }
    };

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await loadDashboardData();
            setLoading(false);
        };
        init();
    }, [router]);

    // Secondary data fetches once profile is ready
    useEffect(() => {
        if (teacherProfile) {
            loadNotesData();
            loadInquiriesData();
        }
    }, [teacherProfile]);

    const handleSaveNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSavingNote || !teacherProfile) return;
        setIsSavingNote(true);

        try {
            const userId = teacherProfile.id;
            const payload = {
                title: noteForm.title,
                content: noteForm.content,
                color: noteForm.color,
                classroom_id: noteForm.classroom_id || null,
                teacher_id: userId
            };

            if (noteForm.id) {
                // Update
                const { error } = await supabaseAuth
                    .from('personal_notes')
                    .update(payload)
                    .eq('id', noteForm.id);
                if (error) throw error;
                showToast('Sticky note updated!', 'success');
            } else {
                // Insert
                const { error } = await supabaseAuth
                    .from('personal_notes')
                    .insert([payload]);
                if (error) throw error;
                showToast('Sticky note added!', 'success');
            }

            setShowNoteModal(false);
            setNoteForm({ id: '', title: '', content: '', color: 'yellow', classroom_id: classrooms[0]?.id || '' });
            await loadNotesData();
        } catch (err: any) {
            console.error(err);
            alert(`Failed to save note: ${err.message}`);
        } finally {
            setIsSavingNote(false);
        }
    };

    const handleDeleteNote = async (noteId: string) => {
        if (!confirm('Are you sure you want to delete this note?')) return;
        try {
            const { error } = await supabaseAuth
                .from('personal_notes')
                .delete()
                .eq('id', noteId);
            if (error) throw error;
            showToast('Note deleted successfully!', 'success');
            await loadNotesData();
        } catch (e: any) {
            console.error(e);
            alert(`Failed to delete note: ${e.message}`);
        }
    };

    const handleCreateTempClass = async () => {
        if (!tempForm.title.trim()) {
            alert('Please fill out all required fields!');
            return;
        }

        if (tempForm.end_time <= tempForm.start_time) {
            alert('End time must be after start time!');
            return;
        }

        try {
            const selectedTeacherId = tempForm.teacher_id || teacherProfile?.id;
            if (!selectedTeacherId) {
                alert('No teacher assigned!');
                return;
            }

            const formatTag = `[delivery_format:${tempForm.delivery_format || 'offline'}]`;
            const finalDescription = `Special makeup/extra class for date ${tempModalDate} ${formatTag}`;

            // 1. Create classroom
            const { data: newClassroom, error: classError } = await supabaseAuth
                .from('classrooms')
                .insert([{
                    name: tempForm.title,
                    description: finalDescription,
                    teacher_id: selectedTeacherId,
                    type: 'temporary',
                    status: 'active'
                }])
                .select()
                .single();

            if (classError) throw classError;

            // 2. Schedule record
            const { error: tempClassError } = await supabaseAuth
                .from('temporary_classes')
                .insert([{
                    classroom_id: newClassroom.id,
                    teacher_id: selectedTeacherId,
                    title: tempForm.title,
                    class_date: tempModalDate,
                    start_time: tempForm.start_time,
                    end_time: tempForm.end_time
                }]);

            if (tempClassError) throw tempClassError;

            // 3. Add student overrides
            if (tempSelectedStudents.length > 0) {
                const overrideRows = tempSelectedStudents.map(studentId => ({
                    student_id: studentId,
                    target_classroom_id: newClassroom.id,
                    override_date: tempModalDate,
                    reason: `Assigned to temporary makeup session: ${tempForm.title}`
                }));

                const { error: overrideError } = await supabaseAuth
                    .from('session_student_overrides')
                    .insert(overrideRows);

                if (overrideError) throw overrideError;
            }

            showToast('Makeup class scheduled successfully!', 'success');
            setShowTempModal(false);
            setTempSelectedStudents([]);
            await loadDashboardData();
        } catch (err: any) {
            console.error(err);
            alert(`Failed to schedule makeup class: ${err.message}`);
        }
    };

    // Calendar Calculations
    const calendarMonth = useMemo(() => {
        return calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    }, [calendarDate]);

    const calendarDays = useMemo(() => {
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();

        const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0, Sun=6
        const totalDays = new Date(year, month + 1, 0).getDate();
        const prevTotalDays = new Date(year, month, 0).getDate();

        const cells: any[] = [];
        const todayStr = getLocalDateString(new Date());

        // Previous month padding
        for (let i = firstDayIndex - 1; i >= 0; i--) {
            const dayNum = prevTotalDays - i;
            const dMonth = month === 0 ? 11 : month - 1;
            const dYear = month === 0 ? year - 1 : year;
            const dDateStr = `${dYear}-${String(dMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            cells.push({ day: dayNum, current: false, date: dDateStr, isToday: dDateStr === todayStr, events: [] });
        }

        // Current month days
        for (let i = 1; i <= totalDays; i++) {
            const dDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            cells.push({ day: i, current: true, date: dDateStr, isToday: dDateStr === todayStr, events: [] });
        }

        // Next month padding
        const remainingCells = 42 - cells.length;
        for (let i = 1; i <= remainingCells; i++) {
            const dMonth = month === 11 ? 0 : month + 1;
            const dYear = month === 11 ? year + 1 : year;
            const dDateStr = `${dYear}-${String(dMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            cells.push({ day: i, current: false, date: dDateStr, isToday: dDateStr === todayStr, events: [] });
        }

        // Bind events to cells
        cells.forEach(cell => {
            const cellDate = new Date(cell.date);
            const cellDow = (cellDate.getDay() + 6) % 7;

            // Bind recurring classes matching Day Of Week
            const matchingSchedules = classroomSchedules.filter(sch => sch.day_of_week === cellDow);
            matchingSchedules.forEach(sch => {
                cell.events.push({
                    id: `rec-${sch.id}`,
                    type: 'recurring',
                    name: sch.classroom_name,
                    time: `${formatTime12hr(sch.start_time.slice(0, 5))} - ${formatTime12hr(sch.end_time.slice(0, 5))}`,
                    date: cell.date,
                    classroom_id: sch.classroom_id
                });
            });

            // Bind temporary/makeup classes matching date
            const matchingTemps = temporaryClasses.filter(t => t.class_date === cell.date);
            matchingTemps.forEach(t => {
                cell.events.push({
                    id: `temp-${t.id}`,
                    type: 'temporary',
                    name: t.classroom_name,
                    time: `${formatTime12hr(t.start_time.slice(0, 5))} - ${formatTime12hr(t.end_time.slice(0, 5))}`,
                    date: cell.date,
                    classroom_id: t.classroom_id
                });
            });

            // Sort cell events by time
            cell.events.sort((a: any, b: any) => a.time.localeCompare(b.time));
        });

        return cells;
    }, [calendarDate, classroomSchedules, temporaryClasses]);

    const handleEventClick = async (events: CalendarEvent[], dateStr: string) => {
        setSelectedDateStr(dateStr);
        setSelectedDateEvents(events);
        setSidePanelOpen(true);

        // Fetch students lists for each classroom in the clicked day
        const studentMap: Record<string, PanelStudent[]> = {};
        for (const evt of events) {
            if (evt.classroom_id) {
                const { data } = await supabaseAuth
                    .from('classroom_students')
                    .select('student_id, users!student_id(name, profile_pic_url)')
                    .eq('classroom_id', evt.classroom_id);
                
                studentMap[evt.classroom_id] = (data || []).map((row: any) => ({
                    id: row.student_id,
                    name: row.users?.name || 'Student',
                    profile_pic_url: row.users?.profile_pic_url || undefined
                }));
            }
        }
        setPanelClassStudents(studentMap);
    };

    const filteredStudents = allStudents.filter(s => s.name.toLowerCase().includes(studentSearchQuery.toLowerCase()));

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
        <div className="bg-[#f8f8f6] dark:bg-[#1a1608] text-slate-900 dark:text-slate-100 font-sans min-h-screen">
            <div className="flex min-h-screen">
                <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

                <main className="flex-1 flex flex-col">
                    <TeacherHeader title={isAdmin ? "Admin-dashboard" : "Dashboard Overview"} />

                    <div className="p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8 w-full flex-1">
                        {/* Stats Widgets */}
                        <StatsSummary 
                            stats={stats} 
                            feesStats={feesStats} 
                            isAdmin={isAdmin} 
                        />

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Main Content: Submissions & Announcements */}
                            <section className="lg:col-span-2 space-y-8 order-2 lg:order-1">
                                <SubmissionsWidget recentSubmissions={recentSubmissions} />
                                
                                <AnnouncementsWidget onAddAnnouncement={() => {}} />

                                <CalendarWidget 
                                    calendarDate={calendarDate}
                                    calendarMonth={calendarMonth}
                                    calendarDays={calendarDays}
                                    setCalendarDate={setCalendarDate}
                                    handleEventClick={handleEventClick}
                                />
                            </section>

                            {/* Sidebar Widgets: Today's Classes & Priority Tasks */}
                            <section className="space-y-8 order-1 lg:order-2">
                                <ClassesListWidget 
                                    upcomingClasses={upcomingClasses} 
                                    formatTime12hr={formatTime12hr} 
                                />

                                <PriorityTasksWidget 
                                    stats={stats} 
                                    forgottenClasses={forgottenClasses} 
                                    isAdmin={isAdmin}
                                    unassignedStudents={unassignedStudents}
                                    pendingLeaves={pendingLeaves}
                                    pendingPayments={pendingPayments}
                                    dueStudents={dueStudents}
                                    pendingSubmissionsList={pendingSubmissionsList}
                                />
                            </section>
                        </div>
                    </div>
                </main>
            </div>

            {/* Student Info Side Panel */}
            {sidePanelOpen && (
                <>
                    <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={() => setSidePanelOpen(false)} />
                    <div className="fixed right-0 top-0 h-full w-full sm:w-[450px] bg-white dark:bg-slate-900 z-50 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col animate-in slide-in-from-right text-left">
                        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                            <div>
                                <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">Classes for {selectedDateStr}</h3>
                                <p className="text-xs text-slate-505 mt-1">{selectedDateEvents.length} class(es) scheduled</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => {
                                        setTempModalDate(selectedDateStr);
                                        setTempSelectedStudents([]);
                                        setTempForm({ title: '', start_time: '10:00', end_time: '11:00', classroom_id: '', teacher_id: teacherProfile?.id || '', delivery_format: 'offline' });
                                        setStudentSearchQuery('');
                                        setShowTempModal(true);
                                    }} 
                                    className="p-2 bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900 rounded-lg text-xs font-bold transition-all"
                                    title="Add Makeup Class"
                                >
                                    <Plus size={16} />
                                </button>
                                <button onClick={() => setSidePanelOpen(false)} className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                            {selectedDateEvents.length > 0 ? (
                                selectedDateEvents.map((evt, idx) => (
                                    <div key={idx} className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800 space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-bold text-sm text-slate-900 dark:text-white">{evt.name}</h4>
                                                <p className="text-xs text-slate-550 mt-1 flex items-center gap-1"><Clock size={12} /> {evt.time}</p>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                                evt.type === 'recurring'
                                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30'
                                                    : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30'
                                            }`}>
                                                {evt.type}
                                            </span>
                                        </div>

                                        <div className="border-t border-slate-100 dark:border-slate-700/50 pt-3">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Student Roster</p>
                                            {evt.classroom_id && panelClassStudents[evt.classroom_id] ? (
                                                <div className="grid grid-cols-2 gap-2">
                                                    {panelClassStudents[evt.classroom_id].map(s => (
                                                        <div key={s.id} className="flex items-center gap-2 p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-150 dark:border-slate-800">
                                                            <div className="size-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 shadow-sm">
                                                                {s.profile_pic_url ? (
                                                                    <img src={s.profile_pic_url} alt={s.name} className="w-full h-full object-cover rounded-full" />
                                                                ) : (
                                                                    <span className="text-[9px] font-bold">{s.name.charAt(0)}</span>
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
                                    <p className="text-sm font-medium text-slate-550">No classes scheduled for this day.</p>
                                    <button 
                                        onClick={() => {
                                            setTempModalDate(selectedDateStr);
                                            setTempSelectedStudents([]);
                                            setTempForm({ title: '', start_time: '10:00', end_time: '11:00', classroom_id: '', teacher_id: teacherProfile?.id || '', delivery_format: 'offline' });
                                            setStudentSearchQuery('');
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
                    <div className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm" onClick={() => { setShowTempModal(false); setStudentSearchQuery(''); }} />
                    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[420px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-[60] p-6 text-left">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">Add Temporary Class</h3>
                            <button onClick={() => { setShowTempModal(false); setTempSelectedStudents([]); setStudentSearchQuery(''); }} className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-4">Date: {tempModalDate}</p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-1.5">Title</label>
                                <input
                                    type="text"
                                    value={tempForm.title}
                                    onChange={e => setTempForm({ ...tempForm, title: e.target.value })}
                                    placeholder="e.g. Extra Practice Session"
                                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-850 focus:ring-2 focus:ring-[#ecb613] focus:border-transparent outline-none"
                                />
                            </div>
                            {isAdmin && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-1.5">Assign Instructor (Teacher)</label>
                                    <select
                                        required
                                        value={tempForm.teacher_id}
                                        onChange={e => setTempForm({ ...tempForm, teacher_id: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-850 focus:ring-2 focus:ring-[#ecb613] focus:border-transparent outline-none"
                                    >
                                        <option value="">Select a Teacher</option>
                                        {teachers.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-1.5">Start Time</label>
                                    <input
                                        type="time"
                                        value={tempForm.start_time}
                                        onChange={e => {
                                            const newStart = e.target.value;
                                            setTempForm(prev => ({
                                                ...prev,
                                                start_time: newStart,
                                                end_time: addOneHour(newStart)
                                            }));
                                        }}
                                        className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-855 focus:ring-2 focus:ring-[#ecb613] focus:border-transparent outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-1.5">End Time</label>
                                    <input
                                        type="time"
                                        value={tempForm.end_time}
                                        onChange={e => setTempForm(prev => ({ ...prev, end_time: e.target.value }))}
                                        className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-855 focus:ring-2 focus:ring-[#ecb613] focus:border-transparent outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Delivery Format</label>
                                <div className="flex gap-3">
                                    {(['offline', 'online'] as const).map(df => (
                                        <button
                                            key={df}
                                            type="button"
                                            onClick={() => setTempForm({ ...tempForm, delivery_format: df })}
                                            className={`flex-1 py-2.5 px-3 border rounded-xl font-bold text-xs transition-all cursor-pointer text-center ${tempForm.delivery_format === df ? (df === 'online' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400' : 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400') : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                        >
                                            {df === 'online' ? 'Online' : 'Offline (In-Person)'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-1.5">Select Students</label>
                                <div className="relative mb-2">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
                                    <input
                                        type="text"
                                        value={studentSearchQuery}
                                        onChange={e => setStudentSearchQuery(e.target.value)}
                                        placeholder="Search students..."
                                        className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-850 focus:ring-2 focus:ring-[#ecb613] focus:border-transparent outline-none"
                                    />
                                </div>
                                <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-2 space-y-1 bg-slate-50 dark:bg-slate-850/50">
                                    {filteredStudents.length > 0 ? filteredStudents.map(s => (
                                        <label key={s.id} className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-slate-80 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
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
                    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[450px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-[60] p-6 animate-in fade-in zoom-in duration-200 text-left">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">{noteForm.id ? 'Edit Idea / Note' : 'Add New Idea / Note'}</h3>
                            <button onClick={() => setShowNoteModal(false)} className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveNote} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-1.5">Note Title</label>
                                <input
                                    type="text"
                                    required
                                    value={noteForm.title}
                                    onChange={e => setNoteForm({ ...noteForm, title: e.target.value })}
                                    placeholder="e.g. Concert preparation ideas"
                                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-850 focus:ring-2 focus:ring-[#ecb613] focus:border-transparent outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-1.5">Note Content</label>
                                <textarea
                                    value={noteForm.content}
                                    onChange={e => setNoteForm({ ...noteForm, content: e.target.value })}
                                    placeholder="Compose your thoughts, plans, or guidelines..."
                                    rows={4}
                                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-850 focus:ring-2 focus:ring-[#ecb613] focus:border-transparent outline-none resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-1.5">Select Classroom</label>
                                <select
                                    required
                                    value={noteForm.classroom_id}
                                    onChange={e => setNoteForm({ ...noteForm, classroom_id: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-850 focus:ring-2 focus:ring-[#ecb613] focus:border-transparent outline-none"
                                >
                                    <option value="" disabled>-- Select Classroom --</option>
                                    {classrooms.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-2">Color Theme</label>
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
