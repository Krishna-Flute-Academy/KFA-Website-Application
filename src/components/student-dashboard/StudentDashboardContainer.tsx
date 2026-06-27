'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../lib/supabase-auth';
import { 
    Loader2, BookOpen, Calendar, Mail, FileText, CheckCircle, 
    Clock, Video, Play, Music, Award, Users, Search, PlayCircle, 
    Send, X, ClipboardList, Info, BarChart2, Plus, Volume2, 
    HelpCircle, ChevronRight, Download, LogOut, Check, Menu,
    Sparkles
} from 'lucide-react';
import dynamic from 'next/dynamic';

const PracticeSuiteModal = dynamic(() => import('../PracticeSuiteModal'), { ssr: false });

import OverviewTab from './OverviewTab';
import CurriculumTab from './CurriculumTab';
import TasksTab from './TasksTab';
import MessagesTab from './MessagesTab';
import AttendanceTab from './AttendanceTab';
import LibraryTab from './LibraryTab';
import ClassroomTab from './ClassroomTab';

// --- Interfaces ---
interface StudentProfile {
    id: string;
    name: string;
    email: string;
    level?: string;
    profile_pic_url?: string;
    role?: string;
    teacher_id?: string | null;
    fees_basis?: 'monthly' | 'class' | null;
    fees_amount?: number | null;
    fees_classes_paid?: number | null;
    fees_collection_date?: number | null;
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
    is_live?: boolean;
    live_meeting_link?: string | null;
    live_session_started_at?: string | null;
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
    sender?: {
        name: string;
        role: string;
    } | null;
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

/**
 * StudentDashboardContainer is the master state and layout container for the student portal.
 * It manages page routing, authentication callback checks, state syncing with Supabase,
 * and distributes props down to contextual tabs.
 */
export default function StudentDashboardContainer() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<StudentProfile | null>(null);
    const [payments, setPayments] = useState<any[]>([]);
    const [classroom, setClassroom] = useState<ClassroomInfo | null>(null);
    const [classmates, setClassmates] = useState<Classmate[]>([]);
    const [assignments, setAssignments] = useState<EnrichedAssignment[]>([]);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [sessionLogs, setSessionLogs] = useState<any[]>([]);
    const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
    const [classNotes, setClassNotes] = useState<ClassNote[]>([]);
    
    // Classroom schedules & direct messaging states
    const [batchSchedules, setBatchSchedules] = useState<any[]>([]);
    const [makeupSchedules, setMakeupSchedules] = useState<any[]>([]);
    const [directMessages, setDirectMessages] = useState<any[]>([]);
    const [admins, setAdmins] = useState<any[]>([]);

    const [notifications, setNotifications] = useState<any[]>([]);
    const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
    const [pushPermission, setPushPermission] = useState<boolean | null>(null);
    const notifDropdownRef = useRef<HTMLDivElement>(null);

    // Curriculum states
    const [courseModules, setCourseModules] = useState<any[]>([]);
    const [courseChapters, setCourseChapters] = useState<any[]>([]);
    const [courseLessons, setCourseLessons] = useState<any[]>([]);
    const [studentProgress, setStudentProgress] = useState<any[]>([]);
    const [selectedTopic, setSelectedTopic] = useState<any | null>(null);
    const [showMaterialPopup, setShowMaterialPopup] = useState(false);
    const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
    const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});

    // UI Navigation state
    const [activeTab, setActiveTab] = useState<'overview' | 'classroom' | 'curriculum' | 'tasks' | 'messages' | 'attendance' | 'library'>('overview');
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [showPracticeSuite, setShowPracticeSuite] = useState(false);
    const [practiceSuiteTab, setPracticeSuiteTab] = useState<'metronome' | 'drums'>('metronome');

    // Submission modal/drawer states
    const [selectedAssignment, setSelectedAssignment] = useState<EnrichedAssignment | null>(null);
    const [submitVideoUrl, setSubmitVideoUrl] = useState('');
    const [isSubmittingTask, setIsSubmittingTask] = useState(false);

    // Audio voice broadcast states
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [audioCurrentTime, setAudioCurrentTime] = useState(0);
    const [audioDuration, setAudioDuration] = useState(0);
    const [isAudioPaused, setIsAudioPaused] = useState(false);
    const [audioVolume, setAudioVolume] = useState(0.8);

    // Excuse Request Modal states
    const [showExcuseModal, setShowExcuseModal] = useState(false);
    const [excuseDate, setExcuseDate] = useState('');
    const [excuseReason, setExcuseReason] = useState('');
    const [isSubmittingExcuse, setIsSubmittingExcuse] = useState(false);

    // Track dismissed admin broadcasts in local storage to toggle highlights
    const [dismissedAdminBroadcasts, setDismissedAdminBroadcasts] = useState<string[]>([]);

    const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    const subscribeToWebPush = async (registration: ServiceWorkerRegistration, studentId: string) => {
        try {
            const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
            if (!publicVapidKey) {
                console.warn('Missing Public VAPID Key. Web push subscription skipped.');
                return;
            }

            const convertedVapidKey = urlBase64ToUint8Array(publicVapidKey);
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });

            console.log('Web Push subscription active:', subscription);

            const { error } = await supabaseAuth
                .from('push_subscriptions')
                .upsert({
                    user_id: studentId,
                    endpoint: subscription.endpoint,
                    subscription_json: JSON.parse(JSON.stringify(subscription))
                }, { onConflict: 'endpoint' });

            if (error) {
                console.error('Failed to save push subscription to DB:', error);
            } else {
                console.log('Push subscription saved to DB successfully.');
            }
        } catch (e) {
            console.error('Error subscribing to web push:', e);
        }
    };

    const requestPushPermission = async () => {
        if ('Notification' in window && 'serviceWorker' in navigator && profile?.id) {
            try {
                const permission = await Notification.requestPermission();
                setPushPermission(permission === 'granted');
                if (permission === 'granted') {
                    const registration = await navigator.serviceWorker.ready;
                    await subscribeToWebPush(registration, profile.id);
                }
            } catch (e) {
                console.error('Error requesting notification permission:', e);
            }
        }
    };

    const markAllNotificationsAsRead = async () => {
        if (!profile?.id) return;
        try {
            const { error } = await supabaseAuth
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', profile.id)
                .eq('is_read', false);
            if (error) throw error;
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (err) {
            console.error('Error marking notifications as read:', err);
        }
    };

    const refreshData = async () => {
        try {
            const { data: { session } } = await supabaseAuth.auth.getSession();
            if (!session) { router.push('/login'); return; }

            const userId = session.user.id;

            // 1. Fetch student profile
            const { data: user } = await supabaseAuth
                .from('users')
                .select('id, name, email, level, profile_pic_url, role, teacher_id, fees_basis, fees_amount, fees_classes_paid, fees_collection_date')
                .eq('id', userId)
                .maybeSingle();

            if (!user || user.role === 'teacher') { router.push('/'); return; }
            setProfile(user);

            // Fetch student payments
            const { data: payData } = await supabaseAuth
                .from('fees_payments')
                .select('*')
                .eq('student_id', userId)
                .order('payment_date', { ascending: false });
            setPayments(payData || []);

            // 2. Fetch classroom mapping
            let csData: any = null;
            const { data: initialData, error: csError } = await supabaseAuth
                .from('classroom_students')
                .select('classroom_id, classrooms(id, name, description, teacher_id, is_live, live_meeting_link, live_session_started_at, users!classrooms_teacher_id_fkey(name, email))')
                .eq('student_id', userId);
            
            csData = initialData;

            if (csError || !initialData || initialData.length === 0) {
                // Try fallback query without users join
                const { data: fallbackData } = await supabaseAuth
                    .from('classroom_students')
                    .select('classroom_id, classrooms(id, name, description, teacher_id, is_live, live_meeting_link, live_session_started_at)')
                    .eq('student_id', userId);
                
                if (fallbackData && fallbackData.length > 0) {
                    csData = fallbackData;
                } else if (user.teacher_id) {
                    // Ultimate fallback
                    const { data: directClassrooms } = await supabaseAuth
                        .from('classrooms')
                        .select('id, name, description, teacher_id, is_live, live_meeting_link, live_session_started_at')
                        .eq('teacher_id', user.teacher_id);
                    
                    if (directClassrooms && directClassrooms.length > 0) {
                        csData = [{
                            classroom_id: directClassrooms[0].id,
                            classrooms: directClassrooms[0]
                        }];
                    } else {
                        const { data: teacherUser } = await supabaseAuth
                            .from('users')
                            .select('name, email')
                            .eq('id', user.teacher_id)
                            .maybeSingle();

                        csData = [{
                            classroom_id: 'synthetic-classroom',
                            classrooms: {
                                id: 'synthetic-classroom',
                                name: 'My Assigned Batch',
                                teacher_id: user.teacher_id,
                                users: teacherUser
                            }
                        }];
                    }
                }
            }

            const cs = csData && csData.length > 0 ? csData[0] : null;

            let classroomId = '';
            if (cs?.classrooms) {
                const cls = Array.isArray(cs.classrooms) ? cs.classrooms[0] : cs.classrooms;
                if (cls) {
                    classroomId = cls.id;
                    let teacherUser = Array.isArray(cls.users) ? cls.users[0] : cls.users;
                    
                    // If fallback was used, fetch teacher info
                    if (!teacherUser && cls.teacher_id) {
                        const { data: tData } = await supabaseAuth
                            .from('users')
                            .select('name, email')
                            .eq('id', cls.teacher_id)
                            .maybeSingle();
                        if (tData) teacherUser = tData;
                    }

                    setClassroom({
                        id: cls.id,
                        name: cls.name,
                        description: cls.description || '',
                        teacher_id: cls.teacher_id,
                        teacher_name: teacherUser?.name || 'Academy Instructor',
                        teacher_email: teacherUser?.email || '',
                        is_live: cls.is_live || false,
                        live_meeting_link: cls.live_meeting_link,
                        live_session_started_at: cls.live_session_started_at
                    });

                    // Fetch classmates
                    let classmatesList = [];
                    if (classroomId === 'synthetic-classroom') {
                        const { data } = await supabaseAuth
                            .from('users')
                            .select('id, name, level, profile_pic_url')
                            .eq('teacher_id', cls.teacher_id)
                            .eq('role', 'student')
                            .neq('id', userId);
                        if (data) classmatesList = data.map(u => ({ student_id: u.id, users: u }));
                    } else {
                        const { data } = await supabaseAuth
                            .from('classroom_students')
                            .select('student_id, users!student_id(id, name, level, profile_pic_url)')
                            .eq('classroom_id', cls.id)
                            .neq('student_id', userId);
                        if (data) classmatesList = data;
                    }

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
            }

            // 3. Fetch student assignment mappings (without join)
            const { data: studentAssignments } = await supabaseAuth
                .from('assignment_students')
                .select('id, assignment_id, status, feedback_text, score, submitted_at, video_url')
                .eq('student_id', userId);

            const studentAssignmentMap = new Map<string, any>();
            (studentAssignments || []).forEach((sa: any) => {
                if (sa.assignment_id) studentAssignmentMap.set(sa.assignment_id, sa);
            });

            // Fetch classroom assignments
            let classroomAssignments: any[] = [];
            if (classroomId && classroomId !== 'synthetic-classroom') {
                const { data: caData } = await supabaseAuth
                    .from('assignments')
                    .select('*')
                    .eq('classroom_id', classroomId)
                    .order('created_at', { ascending: false });
                if (caData) classroomAssignments = caData;
            }

            // Fetch individual assignments that are assigned to this student but might not match classroomId
            let individualAssignments: any[] = [];
            const studentAssignmentIds = (studentAssignments || [])
                .map((sa: any) => sa.assignment_id)
                .filter(Boolean);

            if (studentAssignmentIds.length > 0) {
                const { data: iaData } = await supabaseAuth
                    .from('assignments')
                    .select('*')
                    .in('id', studentAssignmentIds);
                if (iaData) individualAssignments = iaData;
            }

            const assignmentMap = new Map<string, any>();
            classroomAssignments.forEach(a => assignmentMap.set(a.id, a));
            individualAssignments.forEach(a => assignmentMap.set(a.id, a));

            const enriched: EnrichedAssignment[] = Array.from(assignmentMap.values())
                .filter((asg: any) => {
                    // For individual assignments, only show them to students who are explicitly assigned to them
                    if (asg.target_type === 'individual') {
                        return studentAssignmentMap.has(asg.id);
                    }
                    return true;
                })
                .map((asg: any) => {
                    const studentAsg = studentAssignmentMap.get(asg.id);
                    return {
                        id: asg.id,
                        title: asg.title || 'Assignment',
                        description: asg.description || '',
                        due_date: asg.due_date || '',
                        file_url: asg.file_url,
                        file_name: asg.file_name,
                        file_size: asg.file_size,
                        status: studentAsg?.status || 'pending',
                        score: studentAsg?.score ?? null,
                        feedback_text: studentAsg?.feedback_text ?? null,
                        submitted_at: studentAsg?.submitted_at ?? null,
                        video_url: studentAsg?.video_url ?? '',
                    };
                });

            enriched.sort((a, b) => {
                if (a.status === 'pending' && b.status !== 'pending') return -1;
                if (a.status !== 'pending' && b.status === 'pending') return 1;
                return new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime();
            });

            setAssignments(enriched);

            // 4. Fetch Attendance
            const { data: att } = await supabaseAuth
                .from('attendance')
                .select('*')
                .eq('student_id', userId)
                .order('date', { ascending: false });
            setAttendance(att || []);

            // Fetch session logs
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

            // 5. Fetch broadcasts
            const { data: broadcastsData } = await supabaseAuth
                .from('broadcasts')
                .select('*, sender:users!teacher_id(name, role)')
                .order('created_at', { ascending: false });

            const studentBroadcasts = (broadcastsData || []).filter((b: any) => {
                return b.recipients?.some((r: any) => 
                    (r.type === 'global') ||
                    (r.type === 'student' && r.id === userId) ||
                    (r.type === 'class' && r.id === classroomId)
                );
            });
            setBroadcasts(studentBroadcasts);

            // Fetch notifications
            const { data: notifData, error: notifError } = await supabaseAuth
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (!notifError) {
                setNotifications(notifData || []);
            }

            // 6. Fetch Curriculum Progress
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

            // 7. Fetch Batch Schedules, Overrides, and Direct Messages
            let schedulesData: any[] = [];
            if (classroomId && classroomId !== 'synthetic-classroom') {
                const { data: sData } = await supabaseAuth
                    .from('batch_schedules')
                    .select('*')
                    .eq('classroom_id', classroomId);
                schedulesData = sData || [];
            }
            setBatchSchedules(schedulesData);

            let overridesData: any[] = [];
            if (classroomId && classroomId !== 'synthetic-classroom') {
                const { data: oData } = await supabaseAuth
                    .from('session_student_overrides')
                    .select(`
                        id,
                        student_id,
                        override_date,
                        reason,
                        target_classroom_id
                    `)
                    .eq('target_classroom_id', classroomId);
                overridesData = oData || [];
            }
            setMakeupSchedules(overridesData);

            let messagesData: any[] = [];
            try {
                const { data: mData } = await supabaseAuth
                    .from('messages')
                    .select('*')
                    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
                    .order('created_at', { ascending: true });
                messagesData = mData || [];
            } catch (me) {
                console.warn('Failed to load messages from DB:', me);
            }
            setDirectMessages(messagesData);

            let adminsList: any[] = [];
            try {
                const { data: aData } = await supabaseAuth
                    .from('users')
                    .select('id, name, email')
                    .eq('role', 'admin');
                adminsList = aData || [];
            } catch (ae) {
                console.warn('Failed to load admins from DB:', ae);
            }
            setAdmins(adminsList);

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

    // Check and request default notifications permission
    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'default') {
                Notification.requestPermission().then(permission => {
                    setPushPermission(permission === 'granted');
                });
            } else {
                setPushPermission(Notification.permission === 'granted');
            }
        }
    }, []);

    // Realtime subscriptions for live classrooms & notifications
    useEffect(() => {
        if (!profile?.id) return;

        // 1. Subscribe to new notifications
        const notifChannel = supabaseAuth
            .channel(`public:notifications:user_id=eq.${profile.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${profile.id}`
                },
                (payload) => {
                    console.log('Realtime notification payload received:', payload);
                    const newNotif = payload.new;
                    setNotifications(prev => [newNotif, ...prev]);

                    // Play a soft flute-like chime sound using the browser's Web Audio API
                    try {
                        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                        if (AudioContext) {
                            const ctx = new AudioContext();
                            const now = ctx.currentTime;
                            
                            // Fundamental note (pleasant triangle wave)
                            const osc1 = ctx.createOscillator();
                            osc1.type = 'triangle';
                            osc1.frequency.setValueAtTime(587.33, now); // D5
                            osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.15); // slide up to A5
                            
                            const gainNode = ctx.createGain();
                            gainNode.gain.setValueAtTime(0, now);
                            gainNode.gain.linearRampToValueAtTime(0.25, now + 0.05); // fade in
                            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.65); // fade out
                            
                            osc1.connect(gainNode);
                            gainNode.connect(ctx.destination);
                            
                            osc1.start(now);
                            osc1.stop(now + 0.7);
                        }
                    } catch (e) {
                        console.warn('Web Audio chime playback failed:', e);
                    }

                    // Show native browser notification if allowed
                    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                        new Notification(newNotif.title, {
                            body: newNotif.message,
                            icon: '/favicon.png'
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabaseAuth.removeChannel(notifChannel);
        };
    }, [profile?.id]);

    useEffect(() => {
        if (!classroom?.id || classroom.id === 'synthetic-classroom') return;

        // 2. Subscribe to changes on student's classroom
        const classroomChannel = supabaseAuth
            .channel(`public:classrooms:id=eq.${classroom.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'classrooms',
                    filter: `id=eq.${classroom.id}`
                },
                (payload) => {
                    console.log('Realtime classroom payload received:', payload);
                    const updatedRoom = payload.new;
                    setClassroom(prev => {
                        if (!prev) return null;
                        return {
                            ...prev,
                            is_live: updatedRoom.is_live,
                            live_meeting_link: updatedRoom.live_meeting_link,
                            live_session_started_at: updatedRoom.live_session_started_at
                        };
                    });
                }
            )
            .subscribe();

        return () => {
            supabaseAuth.removeChannel(classroomChannel);
        };
    }, [classroom?.id]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target as Node)) {
                setShowNotificationsDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Dismiss keys
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setShowMaterialPopup(false);
                setShowExcuseModal(false);
                setSelectedAssignment(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Load dismissed alerts
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const dismissed = JSON.parse(localStorage.getItem('kfa_dismissed_admin_messages') || '[]');
            setDismissedAdminBroadcasts(dismissed);
        }
    }, []);

    // Merged classroom session/attendance logs
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

    const handleSendDirectMessage = async (receiverId: string, text: string) => {
        if (!profile?.id || !text.trim()) return;
        try {
            const payload = {
                sender_id: profile.id,
                receiver_id: receiverId,
                message_text: text.trim(),
                created_at: new Date().toISOString()
            };
            const { data, error } = await supabaseAuth
                .from('messages')
                .insert([payload])
                .select();
            
            if (error) throw error;
            if (data) {
                setDirectMessages(prev => [...prev, data[0]]);
            }
        } catch (e) {
            console.error('Failed to send direct message:', e);
            alert('Failed to send message.');
        }
    };

    // Voice player methods
    const playVoiceNote = (id: string, audioAttachment: string) => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.onplay = null;
            audioRef.current.onpause = null;
            audioRef.current.ontimeupdate = null;
            audioRef.current.onloadedmetadata = null;
            audioRef.current.onended = null;
        }

        if (playingAudioId === id) {
            setPlayingAudioId(null);
            setIsAudioPaused(false);
            setAudioCurrentTime(0);
            return;
        }

        const audio = new Audio(audioAttachment);
        audio.volume = audioVolume;
        audioRef.current = audio;
        setPlayingAudioId(id);
        setIsAudioPaused(false);

        audio.play().catch(err => {
            console.error('Error playing audio note:', err);
            setPlayingAudioId(null);
        });

        audio.onloadedmetadata = () => {
            setAudioDuration(audio.duration);
        };

        audio.ontimeupdate = () => {
            setAudioCurrentTime(audio.currentTime);
        };

        audio.onplay = () => {
            setIsAudioPaused(false);
        };

        audio.onpause = () => {
            setIsAudioPaused(true);
        };

        audio.onended = () => {
            setPlayingAudioId(null);
            setIsAudioPaused(false);
            setAudioCurrentTime(0);
        };
    };

    const togglePlayback = () => {
        if (!audioRef.current) return;
        if (audioRef.current.paused) {
            audioRef.current.play().catch(err => console.error(err));
        } else {
            audioRef.current.pause();
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!audioRef.current) return;
        const newTime = parseFloat(e.target.value);
        audioRef.current.currentTime = newTime;
        setAudioCurrentTime(newTime);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setAudioVolume(val);
        if (audioRef.current) {
            audioRef.current.volume = val;
        }
    };

    const formatAudioTime = (secs: number) => {
        if (isNaN(secs) || !isFinite(secs)) return '00:00';
        const mins = Math.floor(secs / 60);
        const remainSecs = Math.floor(secs % 60);
        return `${mins.toString().padStart(2, '0')}:${remainSecs.toString().padStart(2, '0')}`;
    };

    // Toggle Complete Syllabus lesson
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

    // Submit assignment
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

            await refreshData();
            
            setSelectedAssignment(null);
            setSubmitVideoUrl('');
        } catch (err: any) {
            console.error('Error submitting assignment:', err);
            alert(`Failed to submit practice recording: ${err.message}`);
        } finally {
            setIsSubmittingTask(false);
        }
    };

    // Excuse absence request
    const handleSubmitExcuse = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile || !classroom || isSubmittingExcuse) return;

        const dateStr = excuseDate.trim();
        if (!dateStr) {
            alert('Please select a date!');
            return;
        }

        // Rule check: at least 1 day before the class date
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const selectedClassDate = new Date(dateStr);
        selectedClassDate.setHours(0, 0, 0, 0);

        const diffTime = selectedClassDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 1) {
            alert('Leaves must be requested at least 1 day in advance. For same-day or past absences, please contact your teacher directly.');
            return;
        }

        setIsSubmittingExcuse(true);

        try {
            // Insert leave request
            const { error: leaveError } = await supabaseAuth
                .from('leave_requests')
                .insert({
                    student_id: profile.id,
                    classroom_id: classroom.id,
                    class_date: dateStr,
                    reason: excuseReason.trim() || null,
                    status: 'pending'
                });

            if (leaveError) throw leaveError;

            const { data: admins, error: adminsError } = await supabaseAuth
                .from('users')
                .select('id')
                .eq('role', 'admin');

            if (adminsError) {
                console.error('Error fetching admin users:', adminsError);
            }

            const notificationTitle = `Leave Request: ${profile.name}`;
            const notificationMsg = `${profile.name} requested leave for class on ${dateStr}.${excuseReason.trim() ? ` Reason: ${excuseReason.trim()}` : ''}`;
            
            const notificationInserts: any[] = [];
            
            if (classroom.teacher_id) {
                notificationInserts.push({
                    user_id: classroom.teacher_id,
                    title: notificationTitle,
                    message: notificationMsg,
                    type: 'reminder'
                });
            }

            (admins || []).forEach((adm: any) => {
                if (adm.id !== classroom.teacher_id) {
                    notificationInserts.push({
                        user_id: adm.id,
                        title: notificationTitle,
                        message: notificationMsg,
                        type: 'reminder'
                    });
                }
            });

            if (notificationInserts.length > 0) {
                const { error: notifError } = await supabaseAuth
                    .from('notifications')
                    .insert(notificationInserts);
                if (notifError) {
                    console.error('Error writing notifications:', notifError);
                }
            }

            alert('Leave request submitted successfully! Your teacher will review and approve/reject it.');

            await refreshData();

            setExcuseDate('');
            setExcuseReason('');
            setShowExcuseModal(false);
        } catch (err: any) {
            console.error('Error submitting leave request:', err);
            alert(`Failed to submit leave request: ${err.message}`);
        } finally {
            setIsSubmittingExcuse(false);
        }
    };

    const handleDismissAdminBroadcast = (id: string) => {
        const updated = [...dismissedAdminBroadcasts, id];
        setDismissedAdminBroadcasts(updated);
        localStorage.setItem('kfa_dismissed_admin_messages', JSON.stringify(updated));
    };

    // Helpers
    const getLessonStatus = (lessonId: string, chapterId: string, moduleId?: string): 'locked' | 'unlocked' | 'completed' => {
        const progress = studentProgress.find(p => p.lesson_id === lessonId);
        if (progress) {
            return progress.status as 'locked' | 'unlocked' | 'completed';
        }
        return 'locked';
    };

    const attendanceStats = useMemo(() => ({
        total: attendance.length,
        present: attendance.filter(a => a.status === 'present').length,
        late: attendance.filter(a => a.status === 'late').length,
        absent: attendance.filter(a => a.status === 'absent').length,
        excused: attendance.filter(a => a.status === 'excused').length,
    }), [attendance]);

    const attendancePct = useMemo(() => {
        return attendanceStats.total > 0
            ? Math.round(((attendanceStats.present + attendanceStats.late) / attendanceStats.total) * 100)
            : null;
    }, [attendanceStats]);

    const levelLabel = useMemo(() => {
        return profile?.level
            ? profile.level.charAt(0).toUpperCase() + profile.level.slice(1)
            : 'Beginner';
    }, [profile]);

    const totalAllocatedLessons = useMemo(() => {
        return courseLessons.filter(l => 
            getLessonStatus(l.id, l.chapter_id) !== 'locked'
        ).length;
    }, [courseLessons, studentProgress]);

    const completedLessonsCount = useMemo(() => {
        return studentProgress.filter(p => p.status === 'completed').length;
    }, [studentProgress]);

    const featuredLesson = useMemo(() => {
        if (courseLessons.length === 0) return null;
        for (const lesson of courseLessons) {
            const status = getLessonStatus(lesson.id, lesson.chapter_id);
            if (status === 'unlocked') {
                return lesson;
            }
        }
        return courseLessons[0] || null;
    }, [courseLessons, studentProgress]);

    useEffect(() => {
        if (featuredLesson && !selectedTopic) {
            setSelectedTopic(featuredLesson);
        }
    }, [featuredLesson, selectedTopic]);

    const getTopicBreadcrumbs = (topic: any) => {
        const chap = courseChapters.find(c => c.id === topic.chapter_id);
        const mod = courseModules.find(m => m.id === chap?.module_id);
        if (mod && chap) {
            return `Module ${mod.module_number} · Chapter ${chap.chapter_number}`;
        }
        if (chap) {
            return `Chapter ${chap.chapter_number}`;
        }
        return '';
    };

    const getYouTubeEmbedUrl = (url: string) => {
        if (!url) return '';
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        if (match && match[2].length === 11) {
            return `https://www.youtube.com/embed/${match[2]}`;
        }
        return url;
    };

    const unreadAdminBroadcasts = useMemo(() => {
        return broadcasts.filter(b => b.sender?.role === 'admin' && !dismissedAdminBroadcasts.includes(b.id));
    }, [broadcasts, dismissedAdminBroadcasts]);

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8fafc]">
                <Loader2 className="w-10 h-10 animate-spin text-[#d46211] mb-4" />
                <p className="font-semibold text-slate-655 animate-pulse" style={{ fontFamily: 'Lexend, sans-serif' }}>Syncing Academy Files...</p>
            </div>
        );
    }

    if (!classroom) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8fafc] text-center p-6" style={{ fontFamily: 'Lexend, sans-serif' }}>
                <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mb-6 border border-amber-100 shadow-sm">
                    <Clock className="w-12 h-12 text-amber-500" />
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-800 mb-3 tracking-tight">Account Pending Assignment</h1>
                <p className="text-slate-600 max-w-md font-medium leading-relaxed">
                    Welcome to the Krishna Flute Academy! You have successfully created your account.
                    Please wait for your instructor to assign you to a batch. You will have full access to your curriculum and dashboard once assigned.
                </p>
                <button onClick={handleLogout} className="mt-8 px-6 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2">
                    <LogOut className="w-5 h-5" /> Sign Out
                </button>
            </div>
        );
    }

    return (
        <>
            {showPracticeSuite && (
                <PracticeSuiteModal 
                    defaultTab={practiceSuiteTab} 
                    onClose={() => setShowPracticeSuite(false)} 
                />
            )}
            
            <div className="flex min-h-screen bg-[#FAF6F0]" style={{ fontFamily: 'Lexend, sans-serif' }}>
                {/* Google Fonts */}
                <link href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
                <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" rel="stylesheet" />

                {/* Sidebar Overlay Backdrop for Mobile */}
                {mobileSidebarOpen && (
                    <div 
                        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden"
                        onClick={() => setMobileSidebarOpen(false)}
                    />
                )}

                {/* Sidebar Navigation */}
                <aside className={`
                    w-72 border-r border-[#E6E1DA] bg-white flex flex-col shrink-0 z-40 transition-transform duration-300
                    fixed md:sticky top-0 left-0 h-screen
                    ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                `}>
                    <div className="p-6 flex flex-col justify-center border-b border-slate-150">
                        <h1 className="font-black text-xl leading-tight text-slate-950 select-none">
                            Krishna Flute
                        </h1>
                        <p className="text-xs font-semibold text-[#b45309] mt-0.5 uppercase tracking-wider select-none">
                            Academy Portal
                        </p>
                    </div>

                    {/* Sidebar Profile Card */}
                    <div className="p-4 border-b border-slate-150 bg-slate-50/55">
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
                            { id: 'classroom', label: 'My Classroom', icon: Users },
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
                                    onClick={() => {
                                        setActiveTab(item.id as any);
                                        setMobileSidebarOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-3 py-3 transition-all relative ${
                                        active 
                                            ? 'bg-[#FAF5EE] text-[#7C5E3F] font-black border-l-4 border-[#7C5E3F] pl-3.5 pr-4 rounded-r-2xl' 
                                            : 'text-[#5C5852] hover:bg-[#FAF5EE]/50 hover:text-[#7C5E3F] px-4 rounded-xl'
                                    }`}
                                >
                                    <Icon className={`w-[22px] h-[22px] shrink-0 ${active ? 'text-[#7C5E3F]' : 'text-slate-400'}`} />
                                    <span className="text-sm font-semibold">{item.label}</span>
                                    {item.id === 'tasks' && assignments.filter(a => a.status === 'pending').length > 0 && (
                                        <span className="ml-auto w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center animate-in scale-in duration-200">
                                            {assignments.filter(a => a.status === 'pending').length}
                                        </span>
                                    )}
                                    {item.id === 'classroom' && classroom?.is_live && (
                                        <span className="ml-auto px-2 py-0.5 text-[8px] font-black uppercase bg-red-500 text-white rounded-full animate-pulse tracking-wide shadow-xs shrink-0 select-none">
                                            Live
                                        </span>
                                    )}
                                    {item.id === 'messages' && (
                                        unreadAdminBroadcasts.length > 0 ? (
                                            <span className="ml-auto flex h-2 w-2 relative shrink-0">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#d49900] opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#d49900]"></span>
                                            </span>
                                        ) : broadcasts.length > 0 ? (
                                            <span className="ml-auto w-2 h-2 rounded-full bg-orange-500 shrink-0"></span>
                                        ) : null
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
                    <header className="h-16 bg-[#FAF6F0]/85 backdrop-blur-md border-b border-[#E6E1DA] flex items-center justify-between px-4 sm:px-6 md:px-8 sticky top-0 z-30">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <button
                                onClick={() => setMobileSidebarOpen(true)}
                                className="md:hidden p-2 -ml-2 rounded-lg text-slate-700 hover:bg-[#FAF5EE] transition-colors"
                                aria-label="Open Menu"
                            >
                                <Menu className="w-5.5 h-5.5 text-[#5C5852]" />
                            </button>
                            <div className="hidden md:flex text-[#7C5E3F]">
                                <Music className="w-5 h-5" />
                            </div>
                            <h2 className="text-[#3E3A35] font-extrabold tracking-tight capitalize text-sm md:text-base">
                                {activeTab === 'library' ? 'Library & Tools' : activeTab === 'tasks' ? 'Tasks & Submissions' : activeTab}
                            </h2>
                        </div>

                        <div className="flex items-center gap-4 text-[#5C5852]">
                            <div className="relative flex" ref={notifDropdownRef}>
                                <button 
                                    onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                                    className="p-1.5 hover:bg-[#FAF5EE] rounded-full transition-colors relative focus:outline-hidden"
                                >
                                    <span className="material-symbols-outlined text-xl text-[#5C5852]">notifications</span>
                                    {notifications.filter(n => !n.is_read).length > 0 && (
                                        <span className="absolute top-1 right-1 w-2 h-2 bg-[#d49900] rounded-full"></span>
                                    )}
                                </button>
                                
                                {showNotificationsDropdown && (
                                    <div className="absolute right-0 mt-8 w-80 bg-[#FAF6F0] rounded-xl border border-[#E6E1DA] shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="px-4 py-2 border-b border-[#E6E1DA] flex items-center justify-between">
                                            <span className="font-bold text-sm text-[#3E3A35]">Notifications</span>
                                            {notifications.filter(n => !n.is_read).length > 0 && (
                                                <button 
                                                    onClick={markAllNotificationsAsRead}
                                                    className="text-xs text-[#7C5E3F] hover:underline font-semibold"
                                                >
                                                    Mark all as read
                                                </button>
                                            )}
                                        </div>
                                        
                                        {pushPermission === false && (
                                            <div className="mx-4 my-2 p-3 bg-[#FAF5EE] rounded-lg border border-[#d49900]/20 flex flex-col gap-1.5">
                                                <div className="flex gap-2">
                                                    <span className="material-symbols-outlined text-base text-[#d49900] shrink-0">notifications_active</span>
                                                    <div className="flex flex-col text-left">
                                                        <span className="text-[11px] font-bold text-[#3E3A35]">Enable Web Alerts</span>
                                                        <span className="text-[9px] text-slate-500 leading-normal">Get pop-up and sound alerts on this device when classes start.</span>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={requestPushPermission}
                                                    className="w-full py-1 text-center bg-[#7C5E3F] hover:bg-[#6A4E31] text-white font-semibold text-[10px] rounded-md transition-colors"
                                                >
                                                    Allow Alerts
                                                </button>
                                            </div>
                                        )}

                                        <div className="max-h-64 overflow-y-auto">
                                            {notifications.length === 0 ? (
                                                <div className="px-4 py-6 text-center text-slate-400 text-xs">
                                                    No notifications yet.
                                                </div>
                                            ) : (
                                                notifications.map((notif) => (
                                                    <div 
                                                        key={notif.id} 
                                                        className={`px-4 py-2.5 hover:bg-[#FAF1E6]/50 transition-colors border-b border-[#F5EFE6] last:border-b-0 flex flex-col gap-0.5 text-left ${!notif.is_read ? 'bg-[#FAF5EE]/70 font-medium' : ''}`}
                                                    >
                                                        <div className="flex justify-between items-start gap-1">
                                                            <span className={`text-xs text-[#3E3A35] ${!notif.is_read ? 'font-bold' : ''}`}>{notif.title}</span>
                                                            <span className="text-[10px] text-slate-400 shrink-0">
                                                                {new Date(notif.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                            </span>
                                                        </div>
                                                        <span className="text-xs text-slate-655 line-clamp-2 leading-relaxed">{notif.message}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <button onClick={() => {
                                setPracticeSuiteTab('metronome');
                                setShowPracticeSuite(true);
                            }} className="p-1.5 hover:bg-[#FAF5EE] rounded-full transition-colors">
                                <span className="material-symbols-outlined text-xl">settings</span>
                            </button>

                            <div className="h-6 w-[1px] bg-[#E6E1DA] hidden sm:block"></div>

                            {profile?.profile_pic_url ? (
                                <img src={profile.profile_pic_url} alt={profile.name} className="w-8 h-8 rounded-xl object-cover border border-[#E6E1DA] shadow-xs" />
                            ) : (
                                <div className="w-8 h-8 rounded-xl bg-[#FAF5EE] border border-[#E6E1DA] flex items-center justify-center text-[#7C5E3F] font-bold text-xs">
                                    {profile?.name?.charAt(0) || 'S'}
                                </div>
                            )}
                            
                            <button onClick={handleLogout} className="md:hidden text-rose-500 p-2">
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    </header>

                    {/* Main Content Area */}
                    <main className="flex-1 p-3 sm:p-6 md:p-8 w-full max-w-[1400px]">
                        {activeTab === 'overview' && (
                            <OverviewTab 
                                profile={profile}
                                payments={payments}
                                classroom={classroom}
                                assignments={assignments}
                                broadcasts={broadcasts}
                                unreadAdminBroadcasts={unreadAdminBroadcasts}
                                setActiveTab={setActiveTab}
                                handleDismissAdminBroadcast={handleDismissAdminBroadcast}
                                levelLabel={levelLabel}
                                attendancePct={attendancePct}
                                attendanceStats={attendanceStats}
                                featuredLesson={featuredLesson}
                                setSelectedTopic={setSelectedTopic}
                                setShowMaterialPopup={setShowMaterialPopup}
                                setPracticeSuiteTab={setPracticeSuiteTab}
                                setShowPracticeSuite={setShowPracticeSuite}
                                classmates={classmates}
                            />
                        )}

                        {activeTab === 'classroom' && (
                            <ClassroomTab 
                                classroom={classroom}
                                classmates={classmates}
                                mergedLogs={mergedLogs}
                                profile={profile}
                                batchSchedules={batchSchedules}
                                makeupSchedules={makeupSchedules}
                                refreshData={refreshData}
                                classNotes={classNotes}
                                assignments={assignments}
                            />
                        )}

                        {activeTab === 'curriculum' && (
                            <CurriculumTab 
                                classroom={classroom}
                                courseModules={courseModules}
                                courseChapters={courseChapters}
                                courseLessons={courseLessons}
                                completedLessonsCount={completedLessonsCount}
                                totalAllocatedLessons={totalAllocatedLessons}
                                expandedModules={expandedModules}
                                setExpandedModules={setExpandedModules}
                                expandedChapters={expandedChapters}
                                setExpandedChapters={setExpandedChapters}
                                getLessonStatus={getLessonStatus}
                                selectedTopic={selectedTopic}
                                setSelectedTopic={setSelectedTopic}
                                handleToggleLessonComplete={handleToggleLessonComplete}
                                getTopicBreadcrumbs={getTopicBreadcrumbs}
                                setShowMaterialPopup={setShowMaterialPopup}
                                classmates={classmates}
                            />
                        )}

                        {activeTab === 'tasks' && (
                            <TasksTab 
                                assignments={assignments}
                                selectedAssignment={selectedAssignment}
                                setSelectedAssignment={setSelectedAssignment}
                                submitVideoUrl={submitVideoUrl}
                                setSubmitVideoUrl={setSubmitVideoUrl}
                                isSubmittingTask={isSubmittingTask}
                                handleSubmitTask={handleSubmitTask}
                            />
                        )}

                        {activeTab === 'messages' && (
                            <MessagesTab 
                                broadcasts={broadcasts}
                                playVoiceNote={playVoiceNote}
                                playingAudioId={playingAudioId}
                                classroom={classroom}
                                classmates={classmates}
                                directMessages={directMessages}
                                onSendDirectMessage={handleSendDirectMessage}
                                profile={profile}
                                admins={admins}
                            />
                        )}

                        {activeTab === 'attendance' && (
                            <AttendanceTab 
                                attendanceStats={attendanceStats}
                                mergedLogs={mergedLogs}
                                showExcuseModal={showExcuseModal}
                                setShowExcuseModal={setShowExcuseModal}
                                excuseDate={excuseDate}
                                setExcuseDate={setExcuseDate}
                                excuseReason={excuseReason}
                                setExcuseReason={setExcuseReason}
                                isSubmittingExcuse={isSubmittingExcuse}
                                handleSubmitExcuse={handleSubmitExcuse}
                            />
                        )}

                        {activeTab === 'library' && (
                            <LibraryTab 
                                setPracticeSuiteTab={setPracticeSuiteTab}
                                setShowPracticeSuite={setShowPracticeSuite}
                            />
                        )}
                    </main>
                </div>
            </div>

            {/* Topic Material Popup Modal */}
            {showMaterialPopup && selectedTopic && (
                <div 
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 md:p-6 animate-in fade-in duration-200"
                    onClick={() => setShowMaterialPopup(false)}
                >
                    <div 
                        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-5xl w-full h-[80vh] md:h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 text-left"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-4 md:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850/40">
                            <div>
                                <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest block">Topic Material</span>
                                <h3 className="text-sm md:text-lg font-black text-slate-900 dark:text-white mt-1">
                                    Topic {selectedTopic.lesson_number}: {selectedTopic.title}
                                </h3>
                            </div>
                            <div className="flex items-center gap-3">
                                {(selectedTopic.material_url || selectedTopic.link_url) && (
                                    <a
                                        href={selectedTopic.material_url || selectedTopic.link_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-350 text-[10px] md:text-xs font-bold rounded-lg transition-colors"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        Open in New Tab
                                    </a>
                                )}
                                <button 
                                    onClick={() => setShowMaterialPopup(false)} 
                                    className="p-1.5 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>
                        </div>

                        {/* Content Viewer */}
                        <div className="flex-1 bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center overflow-hidden relative">
                            {(() => {
                                const url = selectedTopic.material_url || selectedTopic.link_url;
                                if (!url) {
                                    return (
                                        <div className="text-center p-6 text-slate-400">
                                            <Info className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No URL or material file available for this topic.</p>
                                        </div>
                                    );
                                }

                                const lowerUrl = url.toLowerCase();
                                const isYouTube = lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be');
                                const isPdf = selectedTopic.material_type === 'pdf' || lowerUrl.endsWith('.pdf');
                                const isAudio = selectedTopic.material_type === 'audio' || lowerUrl.endsWith('.mp3') || lowerUrl.endsWith('.wav') || lowerUrl.endsWith('.m4a') || lowerUrl.endsWith('.ogg');
                                const isVideo = selectedTopic.material_type === 'video' || lowerUrl.endsWith('.mp4') || lowerUrl.endsWith('.webm') || lowerUrl.endsWith('.ogv');
                                const isImage = lowerUrl.endsWith('.png') || lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg') || lowerUrl.endsWith('.gif') || lowerUrl.endsWith('.svg') || lowerUrl.endsWith('.webp');

                                if (isYouTube) {
                                    return (
                                        <iframe 
                                            src={getYouTubeEmbedUrl(url)} 
                                            className="w-full h-full border-0" 
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                            allowFullScreen 
                                            title={selectedTopic.title}
                                        />
                                    );
                                }

                                if (isPdf) {
                                    return (
                                        <iframe 
                                            src={`${url}#toolbar=1`} 
                                            className="w-full h-full border-0 bg-white" 
                                            title={selectedTopic.title}
                                        />
                                    );
                                }

                                if (isAudio) {
                                    return (
                                        <div className="w-full max-w-xl p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col items-center gap-6 mx-4">
                                            <div className="w-16 h-16 bg-amber-50 dark:bg-amber-955 rounded-full flex items-center justify-center border border-amber-100 dark:border-amber-900 shadow-sm animate-pulse">
                                                <Music className="w-8 h-8 text-amber-550" />
                                            </div>
                                            <div className="text-center">
                                                <h4 className="font-bold text-slate-800 dark:text-white text-base">{selectedTopic.title}</h4>
                                                <p className="text-xs text-slate-500 mt-1">Audio Material Player</p>
                                            </div>
                                            <audio src={url} controls className="w-full" controlsList="nodownload" />
                                        </div>
                                    );
                                }

                                if (isVideo) {
                                    return (
                                        <video src={url} controls className="w-full h-full object-contain bg-black" controlsList="nodownload" />
                                    );
                                }

                                if (isImage) {
                                    return (
                                        <div className="w-full h-full p-4 flex items-center justify-center overflow-auto bg-slate-900/5 dark:bg-slate-950">
                                            <img src={url} alt={selectedTopic.title} className="max-w-full max-h-full object-contain rounded-lg shadow-md" />
                                        </div>
                                    );
                                }

                                return (
                                    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-slate-900">
                                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center border border-slate-100 dark:border-slate-700 shadow-sm mb-4">
                                            <FileText className="w-8 h-8 text-slate-400" />
                                        </div>
                                        <h4 className="font-bold text-slate-800 dark:text-white text-base mb-2">Generic File Link</h4>
                                        <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
                                            This file material cannot be securely previewed inside the dashboard popup. Click below to open/download it in a new window.
                                        </p>
                                        <a
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 px-6 py-3 bg-[#7C5E3F] hover:bg-[#634a31] text-white text-xs font-black rounded-xl transition-all shadow-md hover:shadow-lg"
                                        >
                                            <Download className="w-4 h-4" />
                                            Open Material File
                                        </a>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Audio Player Bar */}
            {playingAudioId && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-[#E6E1DA] rounded-full py-3 px-6 shadow-xl flex items-center justify-between gap-4 animate-in slide-in-from-bottom-10 duration-300">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button 
                            type="button"
                            onClick={togglePlayback}
                            className="w-10 h-10 rounded-full bg-[#7C5E3F] text-white hover:bg-[#634a31] flex items-center justify-center shrink-0 shadow-md transition-colors"
                        >
                            {isAudioPaused ? (
                                <Play className="w-4 h-4 fill-white translate-x-0.5" />
                            ) : (
                                <span className="material-symbols-outlined text-lg">pause</span>
                            )}
                        </button>
                        <div className="min-w-0 text-left">
                            <p className="text-[8px] font-extrabold text-[#7C5E3F] uppercase tracking-widest leading-none">Now Practicing</p>
                            <h4 className="text-xs font-black text-[#3E3A35] truncate mt-1">
                                {broadcasts.find(b => b.id === playingAudioId)?.subject || 'Bansuri Audio Rehearsal'}
                            </h4>
                        </div>
                    </div>

                    <div className="hidden sm:flex items-center gap-3 flex-2 px-4 w-full">
                        <span className="text-[9px] font-bold text-slate-400 shrink-0">
                            {formatAudioTime(audioCurrentTime)}
                        </span>
                        <input 
                            type="range"
                            min={0}
                            max={audioDuration || 100}
                            value={audioCurrentTime}
                            onChange={handleSeek}
                            className="w-full h-1 bg-[#F1EFEB] hover:bg-[#E6E1DA] rounded-lg appearance-none cursor-pointer accent-[#7C5E3F] transition-all"
                        />
                        <span className="text-[9px] font-bold text-slate-400 shrink-0">
                            {formatAudioTime(audioDuration)}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <span className="material-symbols-outlined text-[#7C5E3F] text-lg select-none">
                            {audioVolume === 0 ? 'volume_off' : audioVolume < 0.5 ? 'volume_down' : 'volume_up'}
                        </span>
                        <input 
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={audioVolume}
                            onChange={handleVolumeChange}
                            className="w-16 h-1 bg-[#E6E1DA] rounded-lg appearance-none cursor-pointer accent-[#7C5E3F]"
                        />
                        <button 
                            type="button"
                            onClick={() => {
                                if (audioRef.current) {
                                    audioRef.current.pause();
                                }
                                setPlayingAudioId(null);
                                setIsAudioPaused(false);
                            }}
                            className="p-1 text-[#9A958E] hover:text-[#7C5E3F] transition-colors ml-1"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
