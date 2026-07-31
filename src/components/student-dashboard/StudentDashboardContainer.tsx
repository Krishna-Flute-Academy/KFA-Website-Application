'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../lib/supabase-auth';
import { 
    Loader2, BookOpen, Calendar, Mail, FileText, CheckCircle, 
    Clock, Video, Play, Music, Award, Users, Search, PlayCircle, 
    Send, X, ClipboardList, Info, BarChart2, Plus, Volume2, 
    HelpCircle, ChevronRight, Download, LogOut, Check, Menu,
    Sparkles, AlertTriangle, CreditCard, Scroll, User
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
import FeesTab from './FeesTab';
import PoliciesTab from './PoliciesTab';
import AcademyPolicies from '../AcademyPolicies';
import SettingsTab from './SettingsTab';
import SecureCurriculumMaterial from '../SecureCurriculumMaterial';
import BlogNotification from './BlogNotification';
import { getStudentFeeStatus } from '../../lib/fee-utils';

interface StudentProfile {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
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
    created_at?: string;
    classroom_id?: string;
    classroom_name?: string;
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
    live_classroom_name?: string | null;
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
    classroom_id?: string;
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
    classroom_id: string;
    title: string;
    content?: string;
    file_url?: string;
    file_name?: string;
    file_size?: number;
    color?: string;
    created_at: string;
    classroom_name?: string;
    classroom_status?: string;
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
    const [classroomMessages, setClassroomMessages] = useState<any[]>([]);
    const [isSendingClassroomMessage, setIsSendingClassroomMessage] = useState(false);
    const [admins, setAdmins] = useState<any[]>([]);
    const [activeRooms, setActiveRooms] = useState<any[]>([]);

    const [notifications, setNotifications] = useState<any[]>([]);
    const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
    const [pushPermission, setPushPermission] = useState<boolean | null>(null);
    const notifDropdownRef = useRef<HTMLDivElement>(null);
    const refreshDataRef = useRef<() => Promise<void>>(null as any);
    const classroomIdsRef = useRef<string[]>([]);
    const audioCtxRef = useRef<any>(null);
    useEffect(() => {
        refreshDataRef.current = refreshData;
    });

    // Mobile Audio Unlock: Create AudioContext on first user interaction so it isn't blocked by mobile browsers
    useEffect(() => {
        const unlockAudio = () => {
            if (!audioCtxRef.current) {
                const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                if (AudioContext) {
                    audioCtxRef.current = new AudioContext();
                    // Resume state if suspended
                    if (audioCtxRef.current.state === 'suspended') {
                        audioCtxRef.current.resume();
                    }
                }
            }
            window.removeEventListener('touchstart', unlockAudio);
            window.removeEventListener('click', unlockAudio);
        };
        window.addEventListener('touchstart', unlockAudio, { once: true });
        window.addEventListener('click', unlockAudio, { once: true });
        return () => {
            window.removeEventListener('touchstart', unlockAudio);
            window.removeEventListener('click', unlockAudio);
        };
    }, []);

    // Curriculum states
    const [courseModules, setCourseModules] = useState<any[]>([]);
    const [courseChapters, setCourseChapters] = useState<any[]>([]);
    const [courseLessons, setCourseLessons] = useState<any[]>([]);
    const [studentProgress, setStudentProgress] = useState<any[]>([]);
    const [studentAllocations, setStudentAllocations] = useState<any[]>([]);
    const [selectedTopic, setSelectedTopic] = useState<any | null>(null);
    const [showMaterialPopup, setShowMaterialPopup] = useState(false);
    const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
    const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});

    const allocatedModuleIds = useMemo(() => {
        return new Set(studentAllocations.map(a => a.module_id).filter(Boolean));
    }, [studentAllocations]);

    const allocatedChapterIds = useMemo(() => {
        const direct = studentAllocations.map(a => a.chapter_id).filter(Boolean);
        const fromModules = courseChapters.filter(c => allocatedModuleIds.has(c.module_id)).map(c => c.id);
        return new Set([...direct, ...fromModules]);
    }, [studentAllocations, courseChapters, allocatedModuleIds]);

    const allocatedLessonIds = useMemo(() => {
        const direct = studentAllocations.map(a => a.lesson_id).filter(Boolean);
        const fromChapters = courseLessons.filter(l => allocatedChapterIds.has(l.chapter_id)).map(l => l.id);
        const fromProgress = studentProgress.map(p => p.lesson_id);
        return new Set([...direct, ...fromChapters, ...fromProgress]);
    }, [studentAllocations, courseLessons, allocatedChapterIds, studentProgress]);

    const allocatedLessons = useMemo(() => {
        return courseLessons.filter(l => allocatedLessonIds.has(l.id));
    }, [courseLessons, allocatedLessonIds]);

    const allocatedChapters = useMemo(() => {
        return courseChapters.filter(c => 
            allocatedChapterIds.has(c.id) || 
            courseLessons.some(l => l.chapter_id === c.id && allocatedLessonIds.has(l.id))
        );
    }, [courseChapters, allocatedChapterIds, courseLessons, allocatedLessonIds]);

    const allocatedModules = useMemo(() => {
        return courseModules.filter(m => 
            allocatedModuleIds.has(m.id) || 
            courseChapters.some(c => c.module_id === m.id && (allocatedChapterIds.has(c.id) || courseLessons.some(l => l.chapter_id === c.id && allocatedLessonIds.has(l.id))))
        );
    }, [courseModules, allocatedModuleIds, courseChapters, allocatedChapterIds, courseLessons, allocatedLessonIds]);

    const [activeTab, setActiveTab] = useState<'overview' | 'classroom' | 'curriculum' | 'tasks' | 'messages' | 'attendance' | 'library' | 'fees' | 'policies' | 'settings'>('overview');
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [showPracticeSuite, setShowPracticeSuite] = useState(false);
    const [practiceSuiteTab, setPracticeSuiteTab] = useState<'metronome' | 'tanpura' | 'drums' | 'combosetup'>('metronome');

    // Defer rendering of non-active tabs to prevent main-thread blocking on initial load
    const [renderBackgroundTabs, setRenderBackgroundTabs] = useState(false);
    useEffect(() => {
        if (!loading) {
            const timer = setTimeout(() => {
                setRenderBackgroundTabs(true);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [loading]);

    // Submission modal/drawer states
    const [selectedAssignment, setSelectedAssignment] = useState<EnrichedAssignment | null>(null);
    const [submissionType, setSubmissionType] = useState<'link' | 'audio'>('link');
    const [submitVideoUrl, setSubmitVideoUrl] = useState('');
    const [submitAudioBlob, setSubmitAudioBlob] = useState<Blob | null>(null);
    const [isSubmittingTask, setIsSubmittingTask] = useState(false);

    // Fee Notification State
    const feeStatus = useMemo(() => {
        if (!profile) return null;
        return getStudentFeeStatus(profile.fees_basis, profile.fees_collection_date, payments);
    }, [profile, payments]);

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
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'denied') {
                alert('Notifications are blocked by your browser settings. Please enable them in your browser/device settings to receive alerts.');
                return;
            }
        }

        if ('Notification' in window && 'serviceWorker' in navigator && profile?.id) {
            try {
                const permission = await Notification.requestPermission();
                setPushPermission(permission === 'granted');
                if (permission === 'granted') {
                    let registration: ServiceWorkerRegistration | undefined;
                    try {
                        registration = await Promise.race([
                            navigator.serviceWorker.ready,
                            new Promise((_, reject) => setTimeout(() => reject(new Error('SW Ready Timeout')), 3000))
                        ]) as ServiceWorkerRegistration;
                    } catch (e) {
                        console.warn('[Web Push] SW ready timeout, trying direct registration:', e);
                        registration = await navigator.serviceWorker.register('/sw.js');
                    }
                    if (registration) {
                        await subscribeToWebPush(registration, profile.id);
                    }
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
        refreshDataRef.current = refreshData;
        try {
            const { data: { session } } = await supabaseAuth.auth.getSession();
            if (!session) { router.push('/login'); return; }

            const userId = session.user.id;

            // Phase 1 Parallel Fetch (Queries dependent only on userId or static data)
            const [
                userRes,
                payRes,
                csRes,
                overridesRes,
                attRes,
                broadcastsRes,
                notifRes,
                modulesRes,
                chaptersRes,
                lessonsRes,
                progressRes,
                messagesRes,
                studentAssignmentsRes,
                adminsRes
            ] = await Promise.all([
                // 1. Profile
                supabaseAuth.from('users').select('id, name, email, phone, level, profile_pic_url, role, teacher_id, fees_basis, fees_amount, fees_classes_paid, fees_collection_date').eq('id', userId).maybeSingle(),
                
                // 2. Payments
                supabaseAuth.from('fees_payments').select('*').eq('student_id', userId).order('payment_date', { ascending: false }),
                
                // 3. Classroom Mapping
                supabaseAuth.from('classroom_students').select('classroom_id, classrooms(id, name, type, description, teacher_id, is_live, live_meeting_link, live_session_started_at, status, users!classrooms_teacher_id_fkey(name, email))').eq('student_id', userId),
                
                // 4. Overrides
                supabaseAuth.from('session_student_overrides').select('id, student_id, override_date, reason, target_classroom_id, classrooms (id, name, description, status)').eq('student_id', userId),
                
                // 5. Attendance
                supabaseAuth.from('attendance').select('*').eq('student_id', userId).order('date', { ascending: false }).limit(100),
                
                // 6. Broadcasts
                supabaseAuth.from('broadcasts').select('*, sender:users!teacher_id(name, role)').order('created_at', { ascending: false }),
                
                // 7. Notifications
                supabaseAuth.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
                
                // 8. Modules
                supabaseAuth.from('course_modules').select('*').order('module_number', { ascending: true }),
                
                // 9. Chapters
                supabaseAuth.from('course_chapters').select('*').order('chapter_number', { ascending: true }),
                
                // 10. Lessons
                supabaseAuth.from('course_lessons').select('*').order('lesson_number', { ascending: true }),
                
                // 11. Curriculum Progress
                supabaseAuth.from('student_topic_progress').select('*').eq('student_id', userId),
                
                // 12. Direct Messages
                supabaseAuth.from('messages').select('*').or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).order('created_at', { ascending: false }).limit(100),

                // 13. Student Assignment mappings
                supabaseAuth.from('assignment_students').select('id, assignment_id, status, feedback_text, score, submitted_at, video_url').eq('student_id', userId),

                // 14. Admins list
                supabaseAuth.from('users').select('id, name, email').eq('role', 'admin')
            ]);

            const user = userRes.data;
            if (!user || user.role === 'teacher') { router.push('/'); return; }
            setProfile(user);
            setPayments(payRes.data || []);
            setAttendance(attRes.data || []);
            setNotifications(notifRes.data || []);
            setCourseModules(modulesRes.data || []);
            setCourseChapters(chaptersRes.data || []);
            setCourseLessons(lessonsRes.data || []);
            setStudentProgress(progressRes.data || []);
            const rawMessages = messagesRes.data || [];
            setDirectMessages([...rawMessages].reverse());
            
            // Mark incoming messages as delivered when loaded
            const undeliveredMessages = rawMessages.filter(m => m.receiver_id === userId && (!m.status || m.status === 'sent'));
            if (undeliveredMessages.length > 0) {
                supabaseAuth
                    .from('messages')
                    .update({ status: 'delivered' })
                    .in('id', undeliveredMessages.map(m => m.id))
                    .then();
            }
            setAdmins(adminsRes.data || []);

            // Process classroom mapping fallbacks if empty
            let csData: any = csRes.data;
            const csError = csRes.error;

            if (csError || !csData || csData.length === 0) {
                csData = [];
            }

            const filteredCsData = (csData || []).filter((row: any) => {
                const roomInfo = Array.isArray(row.classrooms) ? row.classrooms[0] : row.classrooms;
                if (row.classroom_id === 'synthetic-classroom') return true;
                return roomInfo && roomInfo.status !== 'inactive' && roomInfo.status !== 'archived';
            });
            const cs = filteredCsData.length > 0 ? filteredCsData[0] : null;

            let classroomId = '';
            let cls: any = null;
            if (cs?.classrooms) {
                cls = Array.isArray(cs.classrooms) ? cs.classrooms[0] : cs.classrooms;
                if (cls) {
                    classroomId = cls.id;
                }
            }

            // Session student overrides
            const overridesData = overridesRes.data || [];
            const activeOverrides = overridesData.filter((o: any) => {
                const roomInfo = Array.isArray(o.classrooms) ? o.classrooms[0] : o.classrooms;
                return roomInfo && roomInfo.status !== 'inactive' && roomInfo.status !== 'archived';
            });

            const targetClassroomIds = activeOverrides.map(o => o.target_classroom_id).filter(Boolean);
            const memberClassroomIds = filteredCsData
                .map((row: any) => {
                    const r = Array.isArray(row.classrooms) ? row.classrooms[0] : row.classrooms;
                    return row.classroom_id || r?.id;
                })
                .filter(Boolean);

            const allClassroomIds = Array.from(new Set([
                classroomId,
                ...memberClassroomIds,
                ...targetClassroomIds
            ])).filter(id => id && id !== 'synthetic-classroom');
            classroomIdsRef.current = allClassroomIds;

            // Student Assignments Map setup
            const studentAssignments = studentAssignmentsRes.data || [];
            const studentAssignmentMap = new Map<string, any>();
            studentAssignments.forEach((sa: any) => {
                if (sa.assignment_id) studentAssignmentMap.set(sa.assignment_id, sa);
            });
            const studentAssignmentIds = studentAssignments.map((sa: any) => sa.assignment_id).filter(Boolean);

            // Phase 2 Parallel Fetch (Classroom & Batch specific details)
            const promisesPhase2: any[] = [
                // P0: temporary_classes details
                targetClassroomIds.length > 0
                    ? supabaseAuth.from('temporary_classes').select('*').in('classroom_id', targetClassroomIds)
                    : Promise.resolve({ data: [] }),

                // P1: classrooms details
                allClassroomIds.length > 0
                    ? supabaseAuth.from('classrooms').select('id, name, type, status, description, teacher_id, is_live, live_meeting_link, live_session_started_at, users!classrooms_teacher_id_fkey(name, email)').in('id', allClassroomIds)
                    : Promise.resolve({ data: [] }),

                // P2: classmates
                cls && classroomId !== 'synthetic-classroom'
                    ? supabaseAuth.from('classroom_students').select('student_id, users!student_id(id, name, level, profile_pic_url)').eq('classroom_id', cls.id).neq('student_id', userId)
                    : cls && classroomId === 'synthetic-classroom'
                    ? supabaseAuth.from('users').select('id, name, level, profile_pic_url').eq('teacher_id', cls.teacher_id).eq('role', 'student').neq('id', userId)
                    : Promise.resolve({ data: [] }),

                // P3: class_notes
                allClassroomIds.length > 0
                    ? supabaseAuth.from('class_notes').select('*').in('classroom_id', allClassroomIds).order('created_at', { ascending: false })
                    : Promise.resolve({ data: [] }),

                // P4: classroom assignments
                allClassroomIds.length > 0
                    ? supabaseAuth.from('assignments').select('*').in('classroom_id', allClassroomIds).order('created_at', { ascending: false })
                    : Promise.resolve({ data: [] }),

                // P5: individual assignments
                studentAssignmentIds.length > 0
                    ? supabaseAuth.from('assignments').select('*').in('id', studentAssignmentIds)
                    : Promise.resolve({ data: [] }),

                // P6: classroom_session_logs
                allClassroomIds.length > 0
                    ? supabaseAuth.from('classroom_session_logs').select('*').in('classroom_id', allClassroomIds).order('started_at', { ascending: false }).limit(50)
                    : Promise.resolve({ data: [] }),

                // P7: batch_schedules
                classroomId && classroomId !== 'synthetic-classroom'
                    ? supabaseAuth.from('batch_schedules').select('*').eq('classroom_id', classroomId)
                    : Promise.resolve({ data: [] }),

                // P8: classroom_messages
                allClassroomIds.length > 0
                    ? supabaseAuth.from('classroom_messages').select('*, sender:users!classroom_messages_sender_id_fkey(name, role, profile_pic_url)').in('classroom_id', allClassroomIds).order('created_at', { ascending: false }).limit(100)
                    : Promise.resolve({ data: [] }),

                // P9: Curriculum allocations (student-specific and class-wide)
                allClassroomIds.length > 0
                    ? supabaseAuth.from('classroom_inventory_allocation')
                        .select('*')
                        .in('classroom_id', allClassroomIds)
                        .or(`allocated_to_student_id.eq.${userId},allocated_to_student_id.is.null`)
                    : Promise.resolve({ data: [] })
            ];

            const [
                tempClassesRes,
                activeRoomsRes,
                classmatesRes,
                notesRes,
                caRes,
                iaRes,
                logsRes,
                schedulesRes,
                cmRes,
                allocationsRes
            ] = await Promise.all(promisesPhase2);

            setStudentAllocations(allocationsRes.data || []);

            // Process Phase 2
            const tempClasses = tempClassesRes.data || [];
            const activeRooms = (activeRoomsRes.data || []).filter((r: any) => r.status !== 'inactive' && r.status !== 'archived');

            // 1. Identify classrooms missing teacher details in PostgREST join
            const missingTeacherIds = activeRooms
                .filter((r: any) => {
                    const teacherUser = Array.isArray(r.users) ? r.users[0] : r.users;
                    return !teacherUser && r.teacher_id;
                })
                .map((r: any) => r.teacher_id);

            // 2. Fetch missing teacher profiles in one bulk query
            const teacherMap = new Map<string, { name: string; email: string }>();
            if (missingTeacherIds.length > 0) {
                const { data: teachersData } = await supabaseAuth
                    .from('users')
                    .select('id, name, email')
                    .in('id', missingTeacherIds);
                teachersData?.forEach((t: any) => {
                    teacherMap.set(t.id, { name: t.name, email: t.email });
                });
            }

            // 3. Map activeRooms synchronously
            const enrichedActiveRooms = activeRooms.map((r: any) => {
                let teacherUser = Array.isArray(r.users) ? r.users[0] : r.users;
                if (!teacherUser && r.teacher_id) {
                    teacherUser = teacherMap.get(r.teacher_id);
                }
                return {
                    id: r.id,
                    name: r.name,
                    type: r.type || 'permanent',
                    description: r.description || '',
                    teacher_id: r.teacher_id,
                    teacher_name: teacherUser?.name || 'Academy Instructor',
                    teacher_email: teacherUser?.email || '',
                    is_live: r.is_live,
                    live_meeting_link: r.live_meeting_link || null,
                    live_session_started_at: r.live_session_started_at || null,
                    live_classroom_name: r.is_live ? r.name : null
                };
            });
            const primaryRooms = enrichedActiveRooms.filter(r => r.type !== 'temporary');
            setActiveRooms(primaryRooms);

            const liveRoom = primaryRooms.find(r => r.is_live);
            const primaryRoom = cls ? (primaryRooms.find(r => r.id === cls.id) || primaryRooms[0]) : primaryRooms[0];
            const defaultRoom = liveRoom || primaryRoom;
            
            if (defaultRoom) {
                setClassroom(prev => {
                    if (prev) {
                        const stillExists = primaryRooms.find(r => r.id === prev.id);
                        if (stillExists) return stillExists;
                    }
                    return defaultRoom;
                });
            } else {
                setClassroom(null);
            }

            // Process classmates
            const classmatesList = classmatesRes.data || [];
            const formattedClassmates = (cls && classroomId === 'synthetic-classroom')
                ? classmatesList.map((u: any) => ({
                    id: u.id,
                    name: u.name || 'Classmate',
                    level: u.level || 'Beginner',
                    profile_pic_url: u.profile_pic_url || null
                  }))
                : classmatesList.map((c: any) => ({
                    id: c.users?.id || c.student_id,
                    name: c.users?.name || 'Classmate',
                    level: c.users?.level || 'Beginner',
                    profile_pic_url: c.users?.profile_pic_url || null
                  }));
            setClassmates(formattedClassmates);

            // Process class notes
            const notes = notesRes.data || [];
            const enrichedNotes = notes.map((note: any) => {
                const room = activeRooms.find(r => r.id === note.classroom_id);
                return {
                    ...note,
                    classroom_name: room?.name || 'Classroom',
                    classroom_status: room?.status || 'Active'
                };
            });
            setClassNotes(enrichedNotes);

            // Process assignments enrichment
            const classroomAssignments = caRes.data || [];
            const individualAssignments = iaRes.data || [];

            const assignmentMap = new Map<string, any>();
            classroomAssignments.forEach(a => assignmentMap.set(a.id, a));
            individualAssignments.forEach(a => assignmentMap.set(a.id, a));

            const enriched = Array.from(assignmentMap.values())
                .filter((asg: any) => {
                    if (asg.target_type === 'individual') {
                        return studentAssignmentMap.has(asg.id);
                    }
                    return true;
                })
                .map((asg: any) => {
                    const studentAsg = studentAssignmentMap.get(asg.id);
                    const room = activeRooms.find(r => r.id === asg.classroom_id);
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
                        created_at: asg.created_at || '',
                        classroom_id: asg.classroom_id || '',
                        classroom_name: room?.name || 'Classroom',
                    };
                });

            enriched.sort((a, b) => {
                if (a.status === 'pending' && b.status !== 'pending') return -1;
                if (a.status !== 'pending' && b.status === 'pending') return 1;
                return new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime();
            });
            setAssignments(enriched);

            // Process logs
            setSessionLogs(logsRes.data || []);

            // Process broadcasts filtering
            const broadcastsData = broadcastsRes.data || [];
            const studentBroadcasts = broadcastsData.filter((b: any) => {
                return b.recipients?.some((r: any) => 
                    (r.type === 'global') ||
                    (r.type === 'student' && r.id === userId) ||
                    (r.type === 'class' && allClassroomIds.includes(r.id))
                );
            });
            setBroadcasts(studentBroadcasts);

            // Set schedules & overrides
            setBatchSchedules(schedulesRes.data || []);
            
            // Enrich makeup overrides
            const enrichedOverrides = activeOverrides.map(o => {
                const tc = tempClasses.find(t => t.classroom_id === o.target_classroom_id);
                const roomInfo = Array.isArray(o.classrooms) ? o.classrooms[0] : o.classrooms;
                return {
                    ...o,
                    title: tc?.title || roomInfo?.name || 'Temporary Class',
                    start_time: tc?.start_time || null,
                    end_time: tc?.end_time || null,
                };
            });
            setMakeupSchedules(enrichedOverrides);

            // Classroom messages (Reversed for chronological order)
            setClassroomMessages([...(cmRes.data || [])].reverse());

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
    }, []);

    // Check and update notification permission status on mount
    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setPushPermission(Notification.permission === 'granted');
        } else {
            setPushPermission(false);
        }
    }, []);

    // Register and update Web Push Service Worker on mount
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            console.log('[Web Push] Service Worker registration skipped in development mode');
            return;
        }

        if (profile?.id && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
            const initSW = async () => {
                try {
                    const registration = await navigator.serviceWorker.register('/sw.js');
                    await registration.update();
                    console.log('[Web Push] Service Worker registered and updated successfully');
                    
                    // If permission is already granted, verify/sync subscription in DB
                    if (Notification.permission === 'granted') {
                        await subscribeToWebPush(registration, profile.id);
                    }
                } catch (err) {
                    console.error('[Web Push] Service Worker registration failed:', err);
                }
            };
            initSW();
        }
    }, [profile?.id]);

    // Realtime subscriptions for live classrooms & notifications
    useEffect(() => {
        if (!profile?.id) return;

        // 1. Subscribe to new notifications
        const notifChannel = supabaseAuth
            .channel(`public:notifications:user_id=eq.${profile.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${profile.id}`
                },
                (payload) => {
                    console.log('Realtime notification payload received:', payload);
                    if (payload.eventType === 'INSERT') {
                        const newNotif = payload.new;
                        setNotifications(prev => {
                            if (prev.some(n => n.id === newNotif.id)) return prev;
                            return [newNotif, ...prev];
                        });

                        // Auto-refresh data if notification is related to fees/payments
                        if (newNotif.title && (newNotif.title.includes('Fee') || newNotif.title.includes('Payment'))) {
                            refreshDataRef.current();
                        }

                        // Play a soft flute-like chime sound using the browser's Web Audio API
                        try {
                            const ctx = audioCtxRef.current;
                            if (ctx) {
                                if (ctx.state === 'suspended') ctx.resume();
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
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedNotif = payload.new;
                        setNotifications(prev => prev.map(n => n.id === updatedNotif.id ? updatedNotif : n));
                    } else if (payload.eventType === 'DELETE') {
                        const deletedNotif = payload.old;
                        setNotifications(prev => prev.filter(n => n.id !== deletedNotif.id));
                    }
                }
            )
            .subscribe();

        return () => {
            supabaseAuth.removeChannel(notifChannel);
        };
    }, [profile?.id]);

    useEffect(() => {
        if (!profile?.id) return;
        const userId = profile.id;

        // Unified realtime channel for dashboard-wide instant sync
        const dashboardChannel = supabaseAuth
            .channel('student-dashboard-realtime-sync')
            // Listen to classrooms (any INSERT, UPDATE, DELETE)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'classrooms' },
                (payload) => {
                    console.log('Realtime classroom payload received:', payload);
                    const updatedRoom = payload.new as any;
                    if (updatedRoom) {
                        setClassroom(prev => {
                            if (!prev || prev.id !== updatedRoom.id) return prev;
                            return {
                                ...prev,
                                is_live: updatedRoom.is_live,
                                live_meeting_link: updatedRoom.live_meeting_link,
                                live_session_started_at: updatedRoom.live_session_started_at,
                                live_classroom_name: updatedRoom.is_live ? updatedRoom.name : null
                            };
                        });

                        setActiveRooms(prevRooms => 
                            prevRooms.map(r => r.id === updatedRoom.id ? {
                                ...r,
                                is_live: updatedRoom.is_live,
                                live_meeting_link: updatedRoom.live_meeting_link,
                                live_session_started_at: updatedRoom.live_session_started_at,
                                live_classroom_name: updatedRoom.is_live ? updatedRoom.name : null
                            } : r)
                        );
                    }
                    // Introduce a 500ms delay before calling refreshData() to ensure that the
                    // write transaction has fully committed and replica lag does not cause stale data read.
                    setTimeout(() => {
                        if (refreshDataRef.current) refreshDataRef.current();
                    }, 500);
                }
            )
            // Listen to classroom_students changes (which affects enrollment/dashboard list)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'classroom_students' },
                (payload) => {
                    const newRecord = payload.new as any;
                    const oldRecord = payload.old as any;
                    const isRelevant = 
                        (newRecord && newRecord.student_id === userId) ||
                        (oldRecord && oldRecord.student_id === userId);
                    console.log('Realtime classroom_students payload received:', payload, 'Is relevant:', isRelevant);
                    if (isRelevant && refreshDataRef.current) {
                        refreshDataRef.current();
                    }
                }
            )
            // Listen to messages (direct messages/chat between student and teacher/admin)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'messages' },
                (payload) => {
                    const newMsg = payload.new as any;
                    const oldMsg = payload.old as any;
                    const isRelevant = 
                        (newMsg && (newMsg.sender_id === userId || newMsg.receiver_id === userId)) ||
                        (oldMsg && (oldMsg.sender_id === userId || oldMsg.receiver_id === userId));
                    console.log('Realtime message payload received:', payload, 'Is relevant:', isRelevant);
                    if (isRelevant) {
                        if (payload.eventType === 'INSERT' && newMsg) {
                            setDirectMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
                            
                            // Auto-mark as delivered if student is the receiver
                            if (newMsg.receiver_id === userId) {
                                supabaseAuth
                                    .from('messages')
                                    .update({ status: 'delivered' })
                                    .eq('id', newMsg.id)
                                    .then(({ error }) => {
                                        if (!error) {
                                            setDirectMessages(prev => prev.map(m => 
                                                m.id === newMsg.id ? { ...m, status: 'delivered' } : m
                                            ));
                                        }
                                    });

                                // Trigger refreshData to fetch the new notification and keep counts in-sync
                                setTimeout(() => {
                                    if (refreshDataRef.current) refreshDataRef.current();
                                }, 500);
                            }
                        } else if (payload.eventType === 'UPDATE' && newMsg) {
                            setDirectMessages(prev => prev.map(m => m.id === newMsg.id ? { ...m, ...newMsg } : m));
                        } else if (payload.eventType === 'DELETE' && oldMsg) {
                            setDirectMessages(prev => prev.filter(m => m.id !== oldMsg.id));
                        } else {
                            setTimeout(() => {
                                if (refreshDataRef.current) refreshDataRef.current();
                            }, 500);
                        }
                    }
                }
            )
            // Listen to shared classroom chat messages
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'classroom_messages' },
                (payload) => {
                    const newMsg = payload.new as any;
                    const oldMsg = payload.old as any;
                    const targetClassroomId = newMsg?.classroom_id || oldMsg?.classroom_id;
                    const isRelevant = targetClassroomId && classroomIdsRef.current.includes(targetClassroomId);
                    console.log('Realtime classroom message payload received:', payload, 'Is relevant:', isRelevant);
                    if (isRelevant && refreshDataRef.current) {
                        setTimeout(() => {
                            if (refreshDataRef.current) refreshDataRef.current();
                        }, 500);
                    }
                }
            )
            // Listen to broadcasts
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'broadcasts' },
                (payload) => {
                    console.log('Realtime broadcast payload received:', payload);
                    if (refreshDataRef.current) {
                        setTimeout(() => {
                            if (refreshDataRef.current) refreshDataRef.current();
                        }, 500);
                    }
                }
            )
            // Listen to class notes
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'class_notes' },
                (payload) => {
                    const newRecord = payload.new as any;
                    const oldRecord = payload.old as any;
                    const targetClassroomId = newRecord?.classroom_id || oldRecord?.classroom_id;
                    const isRelevant = targetClassroomId && classroomIdsRef.current.includes(targetClassroomId);
                    console.log('Realtime class_notes payload received:', payload, 'Is relevant:', isRelevant);
                    if (isRelevant && refreshDataRef.current) {
                        refreshDataRef.current();
                    }
                }
            )
            // Listen to assignments
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'assignments' },
                (payload) => {
                    const newRecord = payload.new as any;
                    const oldRecord = payload.old as any;
                    const targetClassroomId = newRecord?.classroom_id || oldRecord?.classroom_id;
                    const isRelevant = !targetClassroomId || classroomIdsRef.current.includes(targetClassroomId) || newRecord?.target_type === 'individual';
                    console.log('Realtime assignments payload received:', payload, 'Is relevant:', isRelevant);
                    if (isRelevant && refreshDataRef.current) {
                        refreshDataRef.current();
                    }
                }
            )
            // Listen to student-assignment mapping updates (grades, status, feedback)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'assignment_students' },
                (payload) => {
                    const newRecord = payload.new as any;
                    const oldRecord = payload.old as any;
                    const isRelevant = 
                        (newRecord && newRecord.student_id === userId) ||
                        (oldRecord && oldRecord.student_id === userId);
                    console.log('Realtime assignment_students payload received:', payload, 'Is relevant:', isRelevant);
                    if (isRelevant && refreshDataRef.current) {
                        refreshDataRef.current();
                    }
                }
            )
            // Listen to session student overrides (makeup classes)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'session_student_overrides' },
                (payload) => {
                    const newRecord = payload.new as any;
                    const oldRecord = payload.old as any;
                    const isRelevant = 
                        (newRecord && newRecord.student_id === userId) ||
                        (oldRecord && oldRecord.student_id === userId);
                    console.log('Realtime session_student_overrides payload received:', payload, 'Is relevant:', isRelevant);
                    if (isRelevant && refreshDataRef.current) {
                        refreshDataRef.current();
                    }
                }
            )
            // Listen to classroom session logs
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'classroom_session_logs' },
                (payload) => {
                    const newRecord = payload.new as any;
                    const oldRecord = payload.old as any;
                    const targetClassroomId = newRecord?.classroom_id || oldRecord?.classroom_id;
                    const isRelevant = targetClassroomId && classroomIdsRef.current.includes(targetClassroomId);
                    console.log('Realtime classroom_session_logs payload received:', payload, 'Is relevant:', isRelevant);
                    if (isRelevant && refreshDataRef.current) {
                        refreshDataRef.current();
                    }
                }
            )
            // Listen to student pacing/topic progress updates
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'student_topic_progress' },
                (payload) => {
                    const newRecord = payload.new as any;
                    const oldRecord = payload.old as any;
                    const isRelevant = 
                        (newRecord && (newRecord.student_id === userId || newRecord.student_id === 'classwide_default')) ||
                        (oldRecord && (oldRecord.student_id === userId || oldRecord.student_id === 'classwide_default'));
                    console.log('Realtime student_topic_progress payload received:', payload, 'Is relevant:', isRelevant);
                    if (isRelevant && refreshDataRef.current) {
                        refreshDataRef.current();
                    }
                }
            )
            .subscribe();

        return () => {
            supabaseAuth.removeChannel(dashboardChannel);
        };
    }, [profile?.id]);

    // Re-sync data on window focus or visibility change ONLY if the page was hidden for 5+ minutes.
    // Realtime subscriptions keep data live for shorter absences — no need to hammer the DB every tab switch.
    useEffect(() => {
        let hiddenAt: number | null = null;
        const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                hiddenAt = Date.now();
            } else if (document.visibilityState === 'visible') {
                if (hiddenAt !== null && Date.now() - hiddenAt >= REFRESH_THRESHOLD_MS) {
                    if (refreshDataRef.current) {
                        refreshDataRef.current();
                    }
                }
                hiddenAt = null;
            }
        };

        const handleFocus = () => {
            if (hiddenAt !== null && Date.now() - hiddenAt >= REFRESH_THRESHOLD_MS) {
                if (refreshDataRef.current) {
                    refreshDataRef.current();
                }
                hiddenAt = null;
            }
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Background poll every 5 minutes as a fallback for missed realtime events
        const intervalId = setInterval(() => {
            if (document.visibilityState === 'visible' && refreshDataRef.current) {
                refreshDataRef.current();
            }
        }, 300000); // 5 minutes

        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearInterval(intervalId);
        };
    }, []);

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

    // Auto-mark loaded broadcasts as read in the DB for the student
    useEffect(() => {
        if (broadcasts.length > 0 && profile?.id) {
            const markBroadcastsAsRead = async () => {
                try {
                    // Fetch existing read receipts for this student
                    const { data: readData, error } = await supabaseAuth
                        .from('broadcast_reads')
                        .select('broadcast_id')
                        .eq('user_id', profile.id);
                    if (error) {
                        return; // Gracefully ignore if the table is not created yet
                    }
                    
                    const readIds = new Set(readData?.map((r: any) => r.broadcast_id) || []);
                    const unreadBroadcasts = broadcasts.filter((b: any) => !readIds.has(b.id));
                    
                    if (unreadBroadcasts.length > 0) {
                        const insertData = unreadBroadcasts.map((b: any) => ({
                            broadcast_id: b.id,
                            user_id: profile.id
                        }));
                        await supabaseAuth
                            .from('broadcast_reads')
                            .insert(insertData);
                    }
                } catch (e) {
                    console.error('Failed to mark broadcasts as read in DB:', e);
                }
            };
            markBroadcastsAsRead();
        }
    }, [broadcasts, profile?.id]);

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

        const roomNameMap = new Map<string, string>();
        activeRooms.forEach(r => {
            roomNameMap.set(r.id, r.name);
        });

        return sortedDates.map(dateStr => {
            const log = logsMap.get(dateStr);
            const att = attendance.find(a => a.date === dateStr);
            const targetClassroomId = log?.classroom_id || att?.classroom_id;
            return {
                date: dateStr,
                id: log?.id || att?.id || dateStr,
                started_at: log?.started_at || null,
                duration_seconds: log?.duration_seconds || null,
                session_type: log?.session_type || null,
                status: att?.status || 'unmarked',
                classroom_id: targetClassroomId || null,
                classroom_name: targetClassroomId ? (roomNameMap.get(targetClassroomId) || 'Classroom') : 'Classroom'
            };
        });
    }, [sessionLogs, attendance, activeRooms]);

    const handleSelectAssignmentFromOtherTab = (asg: any) => {
        setSelectedAssignment(asg);
        setActiveTab('tasks');
    };

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
                status: 'sent',
                created_at: new Date().toISOString()
            };
            const { data, error } = await supabaseAuth
                .from('messages')
                .insert([payload])
                .select();
            
            if (error) throw error;
            if (data) {
                setDirectMessages(prev => prev.some(m => m.id === data[0].id) ? prev : [...prev, data[0]]);
                
                // Send notification to the recipient of the message
                try {
                    await supabaseAuth.from('notifications').insert({
                        user_id: receiverId,
                        title: `New Message: ${profile.name}`,
                        message: text.trim().length > 60 ? `${text.trim().substring(0, 60)}...` : text.trim(),
                        type: 'messages',
                        is_read: false
                    });
                } catch (err) {
                    console.error('Failed to create notification for direct message:', err);
                }
            }
        } catch (e) {
            console.error('Failed to send direct message:', e);
            alert('Failed to send message.');
        }
    };

    const handleSendClassroomMessage = async (messageText: string) => {
        if (!profile?.id || !classroom?.id || !messageText.trim()) return;

        setIsSendingClassroomMessage(true);
        try {
            const { error } = await supabaseAuth
                .from('classroom_messages')
                .insert({
                    classroom_id: classroom.id,
                    sender_id: profile.id,
                    message_text: messageText.trim()
                });

            if (error) throw error;

            // Send notification to teacher and admins
            try {
                const { data: admins } = await supabaseAuth
                    .from('users')
                    .select('id')
                    .eq('role', 'admin');

                const recipientIds = new Set<string>();
                if (classroom.teacher_id) {
                    recipientIds.add(classroom.teacher_id);
                }
                if (admins) {
                    admins.forEach((admin: any) => recipientIds.add(admin.id));
                }
                recipientIds.delete(profile.id); // Don't notify the sender

                if (recipientIds.size > 0) {
                    const notificationsToInsert = Array.from(recipientIds).map(uid => ({
                        user_id: uid,
                        title: `New Classroom Message: ${profile.name}`,
                        message: messageText.trim().length > 60 ? `${messageText.trim().substring(0, 60)}...` : messageText.trim(),
                        type: 'messages',
                        is_read: false
                    }));

                    await supabaseAuth.from('notifications').insert(notificationsToInsert);
                }
            } catch (notifErr) {
                console.error('Failed to create notifications for classroom message:', notifErr);
            }

            await refreshData();
        } catch (error) {
            console.error('Failed to send classroom message:', error);
            alert('Failed to send classroom message.');
            throw error;
        } finally {
            setIsSendingClassroomMessage(false);
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

        let finalSubmissionUrl = '';

        if (submissionType === 'link') {
            const videoUrlStr = submitVideoUrl.trim();
            if (!videoUrlStr) {
                alert('Please provide a recording link!');
                return;
            }
            finalSubmissionUrl = videoUrlStr;
        } else {
            if (!submitAudioBlob) {
                alert('Please record audio first!');
                return;
            }
        }

        setIsSubmittingTask(true);

        try {
            if (submissionType === 'audio' && submitAudioBlob) {
                // Limit audio file to 20MB (roughly 20-30 mins of audio) to save storage
                const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
                if (submitAudioBlob.size > MAX_FILE_SIZE) {
                    alert('Your recording is too large (max 20MB). Please record a shorter practice session.');
                    setIsSubmittingTask(false);
                    return;
                }

                // Determine file extension and content type based on the recorded blob's MIME type
                const mimeType = submitAudioBlob.type || 'audio/webm';
                let fileExt = 'webm';
                if (mimeType.includes('mp4')) {
                    fileExt = 'mp4';
                } else if (mimeType.includes('mpeg')) {
                    fileExt = 'mp3';
                } else if (mimeType.includes('ogg')) {
                    fileExt = 'ogg';
                } else if (mimeType.includes('wav')) {
                    fileExt = 'wav';
                }

                // Upload blob to Supabase storage in inventory_materials bucket under submissions folder prefix
                const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
                const filePath = `submissions/${fileName}`;
                const { error: uploadError } = await supabaseAuth.storage
                    .from('inventory_materials')
                    .upload(filePath, submitAudioBlob, { contentType: mimeType });

                if (uploadError) throw uploadError;

                const { data } = supabaseAuth.storage
                    .from('inventory_materials')
                    .getPublicUrl(filePath);

                finalSubmissionUrl = data.publicUrl;
            }

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
                        video_url: finalSubmissionUrl,
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
                        video_url: finalSubmissionUrl,
                        submitted_at: new Date().toISOString()
                    });
                dbError = error;
            }

            if (dbError) throw dbError;

            // Send notification to teacher and admins
            try {
                let teacherId = classroom?.id === selectedAssignment.classroom_id ? classroom.teacher_id : null;
                if (!teacherId && selectedAssignment.classroom_id) {
                    const { data: classData } = await supabaseAuth
                        .from('classrooms')
                        .select('teacher_id')
                        .eq('id', selectedAssignment.classroom_id)
                        .maybeSingle();
                    teacherId = classData?.teacher_id || null;
                }

                const { data: admins } = await supabaseAuth
                    .from('users')
                    .select('id')
                    .eq('role', 'admin');

                const notificationTitle = `Task Submission: ${profile.name}`;
                const notificationMsg = `${profile.name} submitted their response for task "${selectedAssignment.title}".`;
                
                const notificationInserts: any[] = [];
                
                if (teacherId) {
                    notificationInserts.push({
                        user_id: teacherId,
                        title: notificationTitle,
                        message: notificationMsg,
                        type: 'tasks'
                    });
                }

                (admins || []).forEach((adm: any) => {
                    if (adm.id !== teacherId) {
                        notificationInserts.push({
                            user_id: adm.id,
                            title: notificationTitle,
                            message: notificationMsg,
                            type: 'tasks'
                        });
                    }
                });

                if (notificationInserts.length > 0) {
                    const { error: notifError } = await supabaseAuth
                        .from('notifications')
                        .insert(notificationInserts);
                    if (notifError) {
                        console.error('Error writing task submission notifications:', notifError);
                    }
                }
            } catch (notifErr) {
                console.error('Failed to create notifications for task submission:', notifErr);
            }

            alert('Practice recording submitted successfully!');

            await refreshData();
            
            setSelectedAssignment(null);
            setSubmitVideoUrl('');
            setSubmitAudioBlob(null);
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
        return allocatedLessons.filter(l => 
            getLessonStatus(l.id, l.chapter_id) !== 'locked'
        ).length;
    }, [allocatedLessons, studentProgress]);

    const completedLessonsCount = useMemo(() => {
        return studentProgress.filter(p => p.status === 'completed').length;
    }, [studentProgress]);

    const featuredLesson = useMemo(() => {
        if (allocatedLessons.length === 0) return null;
        for (const lesson of allocatedLessons) {
            const status = getLessonStatus(lesson.id, lesson.chapter_id);
            if (status === 'unlocked') {
                return lesson;
            }
        }
        return allocatedLessons[0] || null;
    }, [allocatedLessons, studentProgress]);

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

    const unreadMessageCount = useMemo(() => {
        return notifications.filter(n => {
            if (n.is_read) return false;
            
            // Check if it matches an active broadcast announcement
            const matchesBroadcast = broadcasts.some(b => n.title === b.subject || n.message === b.content);
            if (matchesBroadcast) return true;

            // Check if it is a direct chat message (messages type and doesn't match a broadcast)
            if (n.type === 'messages' && !matchesBroadcast) return true;

            return false;
        }).length;
    }, [notifications, broadcasts]);

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
                            { id: 'library', label: 'Tools', icon: FileText },
                            { id: 'fees', label: 'Fees & Payments', icon: CreditCard },
                            { id: 'policies', label: 'Academy Policies', icon: Scroll },
                            { id: 'settings', label: 'Profile Settings', icon: User },
                        ].map((item) => {
                            const Icon = item.icon;
                            const active = activeTab === item.id;
                            const hasUnreadMessages = item.id === 'messages' && unreadMessageCount > 0;
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
                                            : hasUnreadMessages
                                                ? 'bg-[#FAF5EE]/45 text-[#7C5E3F] font-bold border-l-4 border-amber-400/80 pl-3.5 pr-4 rounded-r-2xl shadow-3xs'
                                                : 'text-[#5C5852] hover:bg-[#FAF5EE]/50 hover:text-[#7C5E3F] px-4 rounded-xl'
                                    }`}
                                >
                                    <Icon className={`w-[22px] h-[22px] shrink-0 ${active ? 'text-[#7C5E3F]' : hasUnreadMessages ? 'text-amber-500' : 'text-slate-400'}`} />
                                    <span className="text-sm font-semibold">{item.label}</span>
                                    {item.id === 'tasks' && assignments.filter(a => a.status === 'pending').length > 0 && (
                                        <span className="ml-auto w-5 h-5 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center shrink-0 animate-in scale-in duration-200">
                                            {assignments.filter(a => a.status === 'pending').length}
                                        </span>
                                    )}
                                    {item.id === 'classroom' && classroom?.is_live && (
                                        <span className="ml-auto px-2 py-0.5 text-[8px] font-black uppercase bg-red-500 text-white rounded-full animate-pulse tracking-wide shadow-xs shrink-0 select-none">
                                            Live
                                        </span>
                                    )}
                                    {item.id === 'messages' && unreadMessageCount > 0 && (
                                        <span className="ml-auto w-5 h-5 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center shrink-0 animate-in scale-in duration-200">
                                            {unreadMessageCount}
                                        </span>
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
                                {activeTab === 'library' ? 'Tools' : activeTab === 'tasks' ? 'Tasks & Submissions' : activeTab === 'settings' ? 'Profile Settings' : activeTab}
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
                                        <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-[#d49900] text-white text-[9px] font-black leading-none shadow-sm animate-in scale-in duration-200">
                                            {notifications.filter(n => !n.is_read).length}
                                        </span>
                                    )}
                                </button>
                                
                                {showNotificationsDropdown && (
                                    <div className="fixed right-4 top-16 w-[calc(100vw-2rem)] max-w-[320px] sm:max-w-sm md:absolute md:-right-2 md:top-full md:mt-2 md:w-96 bg-[#FAF6F0] rounded-xl border border-[#E6E1DA] shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
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
                        {/* Live Class Notification & Join Banner (Global for non-overview tabs) */}
                        {activeTab !== 'overview' && classroom?.is_live && (
                            <div className="mb-6 bg-gradient-to-r from-red-600 via-[#d49900] to-amber-500 rounded-2xl p-4 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-300 border border-red-500/20 text-left">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center shrink-0 animate-pulse">
                                        <span className="material-symbols-outlined text-xl animate-bounce">video_call</span>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[8px] font-black uppercase tracking-wider bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse font-mono">● Live</span>
                                            {classroom.live_classroom_name && (
                                                <span className="text-xs font-black truncate max-w-[120px] sm:max-w-xs">{classroom.live_classroom_name}</span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-white/90 leading-tight font-medium mt-0.5">
                                            Your instructor has started an active classroom session. Join now!
                                        </p>
                                    </div>
                                </div>
                                {classroom.live_meeting_link && (
                                    <a
                                        href={classroom.live_meeting_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-4 py-2 bg-white text-red-600 hover:text-red-700 hover:bg-slate-50 transition-all font-black rounded-xl text-[10px] shadow-sm flex items-center justify-center gap-1.5 shrink-0 font-sans uppercase tracking-wider cursor-pointer"
                                    >
                                        <PlayCircle className="w-3.5 h-3.5 text-red-600" />
                                        Join Class
                                    </a>
                                )}
                            </div>
                        )}

                        {/* Fee Notification Banner */}
                        {feeStatus && activeTab !== 'fees' && profile && (
                            <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
                                {(() => {
                                    const classesLeft = profile.fees_classes_paid || 0;
                                    
                                    // Hide notifications if there is a pending payment reported by the student
                                    if (feeStatus.hasPendingPayment) return null;
                                    
                                    let bannerType: 'overdue' | 'due' | 'warning' | 'upcoming' | null = null;
                                    let bannerTitle = '';
                                    let bannerMessage = '';
                                    let showButton = true;
                                    
                                    if (classesLeft <= 0) {
                                        bannerType = 'overdue';
                                        bannerTitle = 'Action Required: 4 Classes Completed';
                                        bannerMessage = 'Your 4 classes are over. Please pay your fees to continue attending.';
                                    } else if (feeStatus.status === 'overdue') {
                                        bannerType = 'overdue';
                                        bannerTitle = 'Action Required: Fee Overdue';
                                        bannerMessage = 'Your monthly fee is overdue. Please submit your fees to keep your account active.';
                                    } else if (feeStatus.status === 'due') {
                                        bannerType = 'due';
                                        bannerTitle = 'Reminder: Fee Due Today';
                                        bannerMessage = 'Your monthly fee is due today. Please make a payment to continue classes.';
                                    } else if (classesLeft === 1) {
                                        bannerType = 'warning';
                                        bannerTitle = 'Reminder: 1 Class Remaining';
                                        bannerMessage = 'You have exactly 1 class left in your balance. Please pay your fees soon to ensure you can continue.';
                                    } else if (feeStatus.status === 'upcoming') {
                                        bannerType = 'upcoming';
                                        bannerTitle = 'Upcoming Fee Payment';
                                        bannerMessage = `Your monthly fee is due on ${feeStatus.formattedDueDate}.`;
                                    }
                                    
                                    if (!bannerType) return null;
                                    
                                    let bgClass = '';
                                    let borderClass = '';
                                    let titleColor = '';
                                    let msgColor = '';
                                    let btnClass = '';
                                    let iconColor = '';
                                    let Icon = Clock;
                                    
                                    if (bannerType === 'overdue') {
                                        bgClass = 'bg-rose-50';
                                        borderClass = 'border-rose-500';
                                        titleColor = 'text-rose-800';
                                        msgColor = 'text-rose-600/90';
                                        btnClass = 'bg-rose-600 hover:bg-rose-700 text-white';
                                        iconColor = 'text-rose-600 bg-rose-100';
                                        Icon = AlertTriangle;
                                    } else if (bannerType === 'due' || bannerType === 'warning') {
                                        bgClass = 'bg-amber-50';
                                        borderClass = 'border-amber-500';
                                        titleColor = 'text-amber-800';
                                        msgColor = 'text-amber-700/90';
                                        btnClass = 'bg-amber-600 hover:bg-amber-700 text-white';
                                        iconColor = 'text-amber-600 bg-amber-100';
                                        Icon = Clock;
                                    } else { // upcoming
                                        bgClass = 'bg-[#FAF5EE]';
                                        borderClass = 'border-amber-300';
                                        titleColor = 'text-amber-900';
                                        msgColor = 'text-amber-700/90';
                                        btnClass = 'bg-[#a15912] hover:bg-[#8a4b0f] text-white';
                                        iconColor = 'text-amber-700 bg-amber-50 border border-amber-100';
                                        Icon = Clock;
                                    }
                                    
                                    return (
                                        <div className={`${bgClass} border border-l-4 ${borderClass} py-2.5 px-4 rounded-xl flex items-center justify-between gap-4 shadow-xs relative overflow-hidden`}>
                                            <div className="flex items-center gap-3 min-w-0 text-left">
                                                <div className={`p-1.5 ${iconColor} rounded-full shrink-0 relative z-10`}>
                                                    <Icon className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={`text-xs font-bold ${titleColor} leading-none`}>{bannerTitle}</p>
                                                    <p className={`text-[11px] mt-0.5 font-medium truncate ${msgColor}`}>
                                                        {bannerMessage}
                                                    </p>
                                                </div>
                                            </div>
                                            {showButton && (
                                                <button 
                                                    onClick={() => setActiveTab('fees')}
                                                    className={`text-[10px] font-black px-3.5 py-1.5 rounded-lg transition-all active:scale-95 shadow-xs shrink-0 inline-flex items-center gap-1 uppercase tracking-wider ${btnClass}`}
                                                >
                                                    Pay Now <ChevronRight className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {(renderBackgroundTabs || activeTab === 'overview') && (
                            <div style={{ display: activeTab === 'overview' ? 'block' : 'none' }}>
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
                                studentAllocations={studentAllocations}
                                studentProgress={studentProgress}
                                courseLessons={courseLessons}
                                courseChapters={courseChapters}
                                courseModules={courseModules}
                                attendance={attendance}
                                
                            />
                        </div>
                        )}

                        {(renderBackgroundTabs || activeTab === 'classroom') && (
                            <div style={{ display: activeTab === 'classroom' ? 'block' : 'none' }}>
                                <ClassroomTab 
                                    classroom={classroom}
                                activeRooms={activeRooms}
                                setClassroom={setClassroom}
                                classmates={classmates}
                                mergedLogs={mergedLogs}
                                profile={profile}
                                batchSchedules={batchSchedules}
                                makeupSchedules={makeupSchedules}
                                refreshData={refreshData}
                                classNotes={classNotes}
                                assignments={assignments}
                                broadcasts={broadcasts}
                                classroomMessages={classroomMessages.filter(message => message.classroom_id === classroom?.id)}
                                isSendingClassroomMessage={isSendingClassroomMessage}
                                onSendClassroomMessage={handleSendClassroomMessage}
                                onSelectAssignment={setSelectedAssignment}
                            />
                        </div>
                        )}

                        {(renderBackgroundTabs || activeTab === 'curriculum') && (
                            <div style={{ display: activeTab === 'curriculum' ? 'block' : 'none' }}>
                                <CurriculumTab 
                                    classroom={classroom}
                                courseModules={allocatedModules}
                                courseChapters={allocatedChapters}
                                courseLessons={allocatedLessons}
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
                        </div>
                        )}

                        {(renderBackgroundTabs || activeTab === 'tasks') && (
                            <div style={{ display: activeTab === 'tasks' ? 'block' : 'none' }}>
                                <TasksTab 
                                    assignments={assignments}
                                selectedAssignment={selectedAssignment}
                                setSelectedAssignment={setSelectedAssignment}
                                submitVideoUrl={submitVideoUrl}
                                setSubmitVideoUrl={setSubmitVideoUrl}
                                submissionType={submissionType}
                                setSubmissionType={setSubmissionType}
                                submitAudioBlob={submitAudioBlob}
                                setSubmitAudioBlob={setSubmitAudioBlob}
                                isSubmittingTask={isSubmittingTask}
                                handleSubmitTask={handleSubmitTask}
                            />
                        </div>
                        )}

                        {(renderBackgroundTabs || activeTab === 'messages') && (
                            <div style={{ display: activeTab === 'messages' ? 'block' : 'none' }}>
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
                                    notifications={notifications}
                                    setNotifications={setNotifications}
                                />
                            </div>
                        )}

                        {(renderBackgroundTabs || activeTab === 'attendance') && (
                            <div style={{ display: activeTab === 'attendance' ? 'block' : 'none' }}>
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
                        </div>
                        )}

                        {(renderBackgroundTabs || activeTab === 'library') && (
                            <div style={{ display: activeTab === 'library' ? 'block' : 'none' }}>
                                <LibraryTab 
                                    setPracticeSuiteTab={setPracticeSuiteTab}
                                    setShowPracticeSuite={setShowPracticeSuite}
                            />
                        </div>
                        )}

                        {profile && (renderBackgroundTabs || activeTab === 'fees') && (
                            <div style={{ display: activeTab === 'fees' ? 'block' : 'none' }}>
                                <FeesTab 
                                    profile={profile}
                                    payments={payments}
                                    refreshData={refreshData}
                                />
                            </div>
                        )}

                        {(renderBackgroundTabs || activeTab === 'policies') && (
                            <div style={{ display: activeTab === 'policies' ? 'block' : 'none' }}>
                                <AcademyPolicies />
                            </div>
                        )}

                        {(renderBackgroundTabs || activeTab === 'settings') && (
                            <div style={{ display: activeTab === 'settings' ? 'block' : 'none' }}>
                                <SettingsTab profile={profile} refreshData={refreshData} />
                            </div>
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
                        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-5xl w-full h-[80vh] md:h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 text-left select-none"
                        onClick={(e) => e.stopPropagation()}
                        onCopy={(e) => e.preventDefault()}
                        onCut={(e) => e.preventDefault()}
                        onContextMenu={(e) => e.preventDefault()}
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
                                {false && (selectedTopic.material_url || selectedTopic.link_url) && (
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
                                return <SecureCurriculumMaterial url={selectedTopic.material_url || selectedTopic.link_url} title={selectedTopic.title} materialType={selectedTopic.material_type} viewerName={profile?.name} viewerEmail={profile?.email} getYouTubeEmbedUrl={getYouTubeEmbedUrl} />;
                                /* Legacy renderer retained temporarily for data-shape compatibility. */
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

            {/* Blog Post Notification — popup on first login for new posts, then corner banner */}
            {profile && (
                <BlogNotification studentId={profile.id} />
            )}
        </>
    );
}
