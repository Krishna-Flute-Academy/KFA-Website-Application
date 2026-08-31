'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabaseAuth } from '../../../../src/lib/supabase-auth';
import { 
    Loader2, ArrowLeft, Search, Bell, HelpCircle, Users, Video, 
    TrendingUp, Zap, Star, Edit3, PlusCircle, 
    PlayCircle, Plus, Clock, Trash2, Calendar, CheckCircle, 
    FileText, Film, Lock, Music, UserPlus, AlertTriangle, Sparkles, 
    X, BookOpen, Send, ClipboardList, Download, ExternalLink, Unlock, 
    MessageSquare, Share2, LogOut, Check, Info, FileIcon, Trash, Sliders,
    User, ChevronUp, ChevronDown, ChevronRight, Paperclip, Upload, StickyNote, Mic
} from 'lucide-react';
import Link from 'next/link';
import TeacherSidebar from '../../../../src/components/TeacherSidebar';
import { CourseCategory, INITIAL_CATEGORIES, INITIAL_MODULES, INITIAL_CHAPTERS, INITIAL_LESSONS } from '../../inventory/initial-data';
import { sendClassroomNotification } from '../../../../src/lib/notifications';
import { htmlToPlainText, sanitizeHtml } from '../../../../src/lib/text-utils';
import SecureCurriculumMaterial from '../../../../src/components/SecureCurriculumMaterial';
import AudioRecorderWidget from '../../../../src/components/AudioRecorderWidget';
import AutoLinkText from '../../../../src/components/common/AutoLinkText';

import dynamic from 'next/dynamic';

// Tab components
import OverviewTab from '../../../../src/components/classroom/OverviewTab';

const TabLoadingFallback = () => (
    <div className="w-full py-16 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-[#ecb613]" />
        <span className="text-xs font-semibold text-slate-400">Loading section...</span>
    </div>
);

const CurriculumTab = dynamic(
    () => import('../../../../src/components/classroom/CurriculumTab'),
    { ssr: false, loading: TabLoadingFallback }
);
const StudentsTab = dynamic(
    () => import('../../../../src/components/classroom/StudentsTab'),
    { ssr: false, loading: TabLoadingFallback }
);
const AssignmentsTab = dynamic(
    () => import('../../../../src/components/classroom/AssignmentsTab'),
    { ssr: false, loading: TabLoadingFallback }
);
const AttendanceTab = dynamic(
    () => import('../../../../src/components/classroom/AttendanceTab'),
    { ssr: false, loading: TabLoadingFallback }
);
const ClassLogsTab = dynamic(
    () => import('../../../../src/components/classroom/ClassLogsTab'),
    { ssr: false, loading: TabLoadingFallback }
);
const SettingsTab = dynamic(
    () => import('../../../../src/components/classroom/SettingsTab'),
    { ssr: false, loading: TabLoadingFallback }
);
const ClassroomChatTab = dynamic(
    () => import('../../../../src/components/classroom/ClassroomChatTab'),
    { ssr: false, loading: TabLoadingFallback }
);

interface ClassroomDetails {
    id: string;
    name: string;
    description: string;
    status: string;
    created_at: string;
    type?: string;
    class_date?: string;
    teacher_name?: string;
    start_time?: string;
    end_time?: string;
    is_live?: boolean;
    live_meeting_link?: string | null;
    live_session_started_at?: string | null;
}

interface ScheduleEntry {
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
}

interface EnrolledStudent {
    id: string; // classroom_students ID
    student_id: string; // real user ID
    name: string;
    profile_pic_url: string | null;
    joined_at: string;
    mock_score: number;
    mock_progress: number;
    mock_attendance: number;
    mock_submission: number;
    mock_milestone: string;
    mock_status: 'Consistent' | 'Improving' | 'At Risk';
    level?: string;
    is_makeup?: boolean;
    is_online?: boolean;
}

interface DirectoryStudent {
    id: string;
    name: string;
    profile_pic_url: string | null;
    status: string;
    is_online?: boolean;
}

interface ClassNote {
    id: string;
    classroom_id: string;
    teacher_id: string;
    title: string;
    content: string | null;
    file_url: string | null;
    file_name: string | null;
    file_size: number | null;
    color: string;
    created_at: string;
    updated_at: string;
}

interface Assignment {
    id: string;
    classroom_id: string;
    teacher_id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    target_type: 'all' | 'individual';
    file_url: string | null;
    file_name: string | null;
    file_size: number | null;
    created_at: string;
    inventory_ref_type?: 'module' | 'chapter' | 'lesson' | null;
    inventory_ref_id?: string | null;
    inventory_ref_title?: string | null;
    assignment_students?: AssignmentStudent[];
}

interface AssignmentStudent {
    id: string;
    assignment_id: string;
    student_id: string;
    status: 'pending' | 'submitted' | 'reviewed' | 'approved' | 'draft';
    score?: number | null;
    proficiency_level?: string | null;
    feedback_text?: string | null;
    video_url?: string | null;
    submitted_at?: string | null;
    student_name?: string;
    student_pic?: string | null;
}

export default function ClassroomDashboardPage({
    isMeetingView = false,
    sessionType = 'online',
    sessionDate = '',
    secondsElapsed = 0,
    onEndSession = () => {},
    onMinimizeSession = () => {}
}: {
    isMeetingView?: boolean;
    sessionType?: 'online' | 'offline';
    sessionDate?: string;
    secondsElapsed?: number;
    onEndSession?: () => void;
    onMinimizeSession?: () => void;
} = {}) {
    const router = useRouter();
    const params = useParams();
    const classroomId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string; role?: string } | null>(null);
    const [classroom, setClassroom] = useState<ClassroomDetails | null>(null);
    const [students, setStudents] = useState<EnrolledStudent[]>([]);
    const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
    const [activeTab, setActiveTab] = useState('Overview');
    const [currentPage, setCurrentPage] = useState(1);
    const [activeClassroomIds, setActiveClassroomIds] = useState<string[]>([classroomId]);
    const [classroomMessages, setClassroomMessages] = useState<any[]>([]);
    const [isSendingClassroomMessage, setIsSendingClassroomMessage] = useState(false);
    const [isEndingSession, setIsEndingSession] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const lastRefreshAtRef = useRef<number>(Date.now());
    const refreshInProgressRef = useRef<boolean>(false);

    const handleEndClassSessionInternal = async () => {
        if (isEndingSession) return;
        if (confirm('Are you sure you want to end this active class session?')) {
            setIsEndingSession(true);

            // Read active session parameters BEFORE removing from local storage
            const activeSessionStr = typeof window !== 'undefined' ? localStorage.getItem('active_class_session') : null;
            let startedAtTime = classroom?.live_session_started_at 
                ? new Date(classroom.live_session_started_at).getTime() 
                : Date.now() - Math.max(0, secondsElapsed || 0) * 1000;
            let activeDate = sessionDate || new Date().toISOString().split('T')[0];
            let activeType = sessionType || 'online';

            if (activeSessionStr) {
                try {
                    const parsed = JSON.parse(activeSessionStr);
                    if (parsed.startedAt && !isNaN(parsed.startedAt)) startedAtTime = parsed.startedAt;
                    if (parsed.sessionDate) activeDate = parsed.sessionDate;
                    if (parsed.sessionType) activeType = parsed.sessionType;
                } catch (e) {
                    console.error('Error parsing active session:', e);
                }
            }

            // Optimistically update local state & clear local storage for immediate UI feedback
            if (typeof window !== 'undefined') {
                localStorage.removeItem('active_class_session');
                window.dispatchEvent(new Event('storage'));
                window.dispatchEvent(new CustomEvent('class_session_ended', { detail: { classroomId } }));
            }
            setClassroom(prev => prev ? { ...prev, is_live: false, live_meeting_link: null, live_session_started_at: null } : null);

            try {
                const endedAtTime = Date.now();
                const durationSecs = Math.max(1, Math.floor((endedAtTime - startedAtTime) / 1000));

                try {
                    await supabaseAuth.rpc('end_classroom_session', {
                        p_classroom_id: classroomId,
                        p_session_date: activeDate,
                        p_session_type: activeType,
                        p_started_at: new Date(startedAtTime).toISOString(),
                        p_ended_at: new Date(endedAtTime).toISOString(),
                        p_duration_seconds: durationSecs
                    });
                } catch (rpcErr) {
                    console.warn('RPC end_classroom_session warning/error:', rpcErr);
                }

                // Always clear live state directly to guarantee persistence in Supabase
                await supabaseAuth
                    .from('classrooms')
                    .update({
                        is_live: false,
                        live_meeting_link: null,
                        live_session_started_at: null
                    })
                    .eq('id', classroomId);

                if (isMeetingView) {
                    router.push(`/teacher-dashboard/classrooms/${classroomId}`);
                } else {
                    setRefreshTrigger(prev => prev + 1);
                }
            } catch (err: any) {
                console.error('Error ending class session:', err);
            } finally {
                setIsEndingSession(false);
            }
        }
    };

    const effectiveEndSession = onEndSession && onEndSession.toString() !== '() => {}'
        ? onEndSession
        : handleEndClassSessionInternal;

    useEffect(() => {
        if (classroomId) {
            setActiveClassroomIds([classroomId]);
        }
    }, [classroomId]);

    // ── Temporary session overrides (Makeup Classes) states ─────────────────────
    const [sessionOverrides, setSessionOverrides] = useState<any[]>([]);
    const [showOverrideModal, setShowOverrideModal] = useState(false);
    const [editingOverrideId, setEditingOverrideId] = useState<string | null>(null);
    const [overrideForm, setOverrideForm] = useState({ studentId: '', date: new Date().toISOString().split('T')[0], reason: '' });
    const [isSavingOverride, setIsSavingOverride] = useState(false);
    const [isDeletingOverrideId, setIsDeletingOverrideId] = useState<string | null>(null);
    const [directoryStudentsForOverride, setDirectoryStudentsForOverride] = useState<any[]>([]);
    const [isOverrideRosterLoading, setIsOverrideRosterLoading] = useState(false);

    // Timezone-safe local date formatter
    const formatLocalDate = (dateStr: string): Date => {
        if (!dateStr) return new Date();
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const [year, month, day] = dateStr.split('-').map(Number);
            return new Date(year, month - 1, day);
        }
        return new Date(dateStr);
    };

    // ── Live session broadcast states ──────────────────────────────────────────
    const [messageSubject, setMessageSubject] = useState('');
    const [messageContent, setMessageContent] = useState('');
    const [isSendingMessage, setIsSendingMessage] = useState(false);
    const [classBroadcasts, setClassBroadcasts] = useState<any[]>([]);

    // Prefill broadcast subject
    useEffect(() => {
        if (classroom?.name && !messageSubject) {
            setMessageSubject(`Live Session Announcement - ${classroom.name}`);
        }
    }, [classroom, messageSubject]);

    const teacherProfileRef = useRef(teacherProfile);
    useEffect(() => {
        teacherProfileRef.current = teacherProfile;
    }, [teacherProfile]);

    const studentsRef = useRef(students);
    useEffect(() => {
        studentsRef.current = students;
    }, [students]);

    const sessionOverridesRef = useRef(sessionOverrides);
    useEffect(() => {
        sessionOverridesRef.current = sessionOverrides;
    }, [sessionOverrides]);

    // Fetch broadcasts for this class & listen to real-time updates
    useEffect(() => {
        if (!teacherProfile?.id || !classroomId) return;
        
        const fetchClassroomBroadcasts = async () => {
            try {
                const { data: broadcastsData } = await supabaseAuth
                    .from('broadcasts')
                    .select('*, sender:users!teacher_id(name, role)')
                    .contains('recipients', [{ id: classroomId }])
                    .order('created_at', { ascending: false });
                
                if (broadcastsData) {
                    setClassBroadcasts(broadcastsData);
                }
            } catch (e) {
                console.error('Failed to load classroom broadcasts:', e);
            }
        };

        fetchClassroomBroadcasts();

        const targetsClassroom = (recipients: any, targetRoomId: string): boolean => {
            if (!recipients || !targetRoomId) return false;
            if (Array.isArray(recipients)) {
                return recipients.some((r: any) => {
                    if (typeof r === 'string') return r === targetRoomId;
                    if (r && typeof r === 'object') return r.id === targetRoomId;
                    return false;
                });
            }
            if (typeof recipients === 'string') {
                try {
                    const parsed = JSON.parse(recipients);
                    return targetsClassroom(parsed, targetRoomId);
                } catch {
                    return recipients === targetRoomId;
                }
            }
            return false;
        };

        const channel = supabaseAuth
            .channel(`classroom-broadcasts-${classroomId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'broadcasts' },
                (payload) => {
                    if (payload.eventType === 'DELETE') {
                        const deletedId = (payload.old as any)?.id;
                        if (deletedId) {
                            setClassBroadcasts(prev => prev.filter(b => b.id !== deletedId));
                            setSelectedAnnouncement(prev => (prev?.id === deletedId ? null : prev));
                        }
                        return;
                    }

                    if (payload.eventType === 'UPDATE') {
                        const updatedRow = payload.new as any;
                        if (!updatedRow?.id) return;
                        const nowTargets = targetsClassroom(updatedRow.recipients, classroomId);

                        if (!nowTargets) {
                            // Case C: no longer belongs to this classroom -> remove locally
                            setClassBroadcasts(prev => prev.filter(b => b.id !== updatedRow.id));
                            setSelectedAnnouncement(prev => (prev?.id === updatedRow.id ? null : prev));
                            return;
                        }

                        // Case A & B: still or newly belongs to this classroom -> update or add locally
                        let senderObj = updatedRow.sender;
                        const currentTeacher = teacherProfileRef.current;
                        if (!senderObj) {
                            if (updatedRow.teacher_id === currentTeacher?.id) {
                                senderObj = {
                                    name: currentTeacher.name,
                                    role: currentTeacher.role || 'teacher'
                                };
                            }
                        }

                        const upsertBroadcast = (item: any) => {
                            setClassBroadcasts(prev => {
                                const exists = prev.some(b => b.id === item.id);
                                const updated = exists
                                    ? prev.map(b => b.id === item.id ? { ...b, ...item, sender: b.sender || item.sender } : b)
                                    : [item, ...prev];
                                return updated.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                            });
                            setSelectedAnnouncement(prev => (prev?.id === item.id ? { ...prev, ...item } : prev));
                        };

                        if (senderObj) {
                            upsertBroadcast({ ...updatedRow, sender: senderObj });
                        } else {
                            (async () => {
                                let fetchedSender = { name: 'Teacher', role: 'teacher' };
                                if (updatedRow.teacher_id) {
                                    try {
                                        const { data } = await supabaseAuth
                                            .from('users')
                                            .select('name, role')
                                            .eq('id', updatedRow.teacher_id)
                                            .maybeSingle();
                                        if (data) fetchedSender = data;
                                    } catch (e) {
                                        console.warn('Failed to fetch sender for updated broadcast:', e);
                                    }
                                }
                                upsertBroadcast({ ...updatedRow, sender: fetchedSender });
                            })();
                        }
                        return;
                    }

                    if (payload.eventType === 'INSERT') {
                        const newRow = payload.new as any;
                        if (!newRow?.id) return;
                        if (!targetsClassroom(newRow.recipients, classroomId)) return;

                        let senderObj = newRow.sender;
                        const currentTeacher = teacherProfileRef.current;
                        if (!senderObj) {
                            if (newRow.teacher_id === currentTeacher?.id) {
                                senderObj = {
                                    name: currentTeacher.name,
                                    role: currentTeacher.role || 'teacher'
                                };
                            }
                        }

                        const appendBroadcast = (item: any) => {
                            setClassBroadcasts(prev => {
                                if (prev.some(b => b.id === item.id)) {
                                    return prev.map(b => b.id === item.id ? { ...b, ...item, sender: b.sender || item.sender } : b);
                                }
                                const updated = [item, ...prev];
                                return updated.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                            });
                        };

                        if (senderObj) {
                            appendBroadcast({ ...newRow, sender: senderObj });
                        } else {
                            (async () => {
                                let fetchedSender = { name: 'Teacher', role: 'teacher' };
                                if (newRow.teacher_id) {
                                    try {
                                        const { data } = await supabaseAuth
                                            .from('users')
                                            .select('name, role')
                                            .eq('id', newRow.teacher_id)
                                            .maybeSingle();
                                        if (data) fetchedSender = data;
                                    } catch (e) {
                                        console.warn('Failed to fetch sender for new broadcast:', e);
                                    }
                                }
                                appendBroadcast({ ...newRow, sender: fetchedSender });
                            })();
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabaseAuth.removeChannel(channel);
        };
    }, [teacherProfile?.id, classroomId]);

    const fetchClassroomMessages = useCallback(async () => {
        if (!classroomId) return;
        try {
            const { data, error } = await supabaseAuth
                .from('classroom_messages')
                .select('*, sender:users!classroom_messages_sender_id_fkey(name, role, profile_pic_url)')
                .eq('classroom_id', classroomId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setClassroomMessages(data || []);
        } catch (error) {
            console.error('Failed to load classroom chat messages:', error);
        }
    }, [classroomId]);

    useEffect(() => {
        if (!teacherProfile?.id || !classroomId) return;

        fetchClassroomMessages();

        const channel = supabaseAuth
            .channel(`classroom-messages-${classroomId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'classroom_messages',
                    filter: `classroom_id=eq.${classroomId}`
                },
                (payload) => {
                    if (payload.eventType === 'DELETE') {
                        const deletedId = (payload.old as any)?.id;
                        if (deletedId) {
                            setClassroomMessages(prev => prev.filter(m => m.id !== deletedId));
                        }
                        return;
                    }

                    if (payload.eventType === 'UPDATE') {
                        const updatedRawMsg = payload.new as any;
                        if (updatedRawMsg?.id) {
                            setClassroomMessages(prev => prev.map(m => {
                                if (m.id === updatedRawMsg.id) {
                                    return {
                                        ...m,
                                        ...updatedRawMsg,
                                        sender: m.sender || updatedRawMsg.sender
                                    };
                                }
                                return m;
                            }));
                        }
                        return;
                    }

                    if (payload.eventType === 'INSERT') {
                        const newRawMsg = payload.new as any;
                        if (!newRawMsg?.id) return;

                        const currentTeacher = teacherProfileRef.current;
                        const currentStudents = studentsRef.current;

                        let senderObj = newRawMsg.sender;
                        if (!senderObj) {
                            if (newRawMsg.sender_id === currentTeacher?.id) {
                                senderObj = {
                                    name: currentTeacher.name,
                                    role: currentTeacher.role || 'teacher',
                                    profile_pic_url: null
                                };
                            } else {
                                const matchedStudent = currentStudents.find(s => s.student_id === newRawMsg.sender_id);
                                if (matchedStudent) {
                                    senderObj = {
                                        name: matchedStudent.name,
                                        role: 'student',
                                        profile_pic_url: matchedStudent.profile_pic_url
                                    };
                                }
                            }
                        }

                        const appendMessage = (enrichedMsg: any) => {
                            setClassroomMessages(prev => {
                                if (prev.some(m => m.id === enrichedMsg.id)) {
                                    return prev.map(m => m.id === enrichedMsg.id ? { ...m, ...enrichedMsg, sender: m.sender || enrichedMsg.sender } : m);
                                }
                                const updated = [...prev, enrichedMsg];
                                return updated.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                            });
                        };

                        if (senderObj) {
                            appendMessage({ ...newRawMsg, sender: senderObj });
                        } else {
                            // Targeted single-user lookup only when sender not found in local state
                            (async () => {
                                let fetchedSender = { name: 'Class member', role: 'student', profile_pic_url: null };
                                try {
                                    const { data } = await supabaseAuth
                                        .from('users')
                                        .select('name, role, profile_pic_url')
                                        .eq('id', newRawMsg.sender_id)
                                        .maybeSingle();
                                    if (data) fetchedSender = data;
                                } catch (e) {
                                    console.warn('Failed to fetch sender profile for single message:', e);
                                }
                                appendMessage({ ...newRawMsg, sender: fetchedSender });
                            })();
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabaseAuth.removeChannel(channel);
        };
    }, [teacherProfile?.id, classroomId, fetchClassroomMessages]);

    const handleSendClassroomChatMessage = async (messageText: string) => {
        if (!teacherProfile?.id || !classroomId || !messageText.trim()) return;

        setIsSendingClassroomMessage(true);
        try {
            const { data, error } = await supabaseAuth
                .from('classroom_messages')
                .insert({
                    classroom_id: classroomId,
                    sender_id: teacherProfile.id,
                    message_text: messageText.trim()
                })
                .select('*, sender:users!classroom_messages_sender_id_fkey(name, role, profile_pic_url)')
                .single();

            if (error) throw error;

            if (data) {
                const insertedMsg = {
                    ...data,
                    sender: data.sender || {
                        name: teacherProfile.name,
                        role: teacherProfile.role || 'teacher',
                        profile_pic_url: null
                    }
                };
                setClassroomMessages(prev => {
                    if (prev.some(m => m.id === insertedMsg.id)) return prev;
                    const updated = [...prev, insertedMsg];
                    return updated.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                });
            }

            // Notify enrolled students in notifications table so their Bell Icon highlights
            try {
                const { data: enrolledStudents } = await supabaseAuth
                    .from('classroom_students')
                    .select('student_id')
                    .eq('classroom_id', classroomId);

                if (enrolledStudents && enrolledStudents.length > 0) {
                    const targetStudentIds = enrolledStudents
                        .map((s: any) => s.student_id)
                        .filter((sid: string) => sid && sid !== teacherProfile.id);

                    if (targetStudentIds.length > 0) {
                        const notifPayloads = targetStudentIds.map((sid: string) => ({
                            user_id: sid,
                            type: 'classroom',
                            title: `New Message in ${classroom?.name || 'Classroom'}`,
                            message: `${teacherProfile.name || 'Instructor'}: ${htmlToPlainText(messageText).slice(0, 100)}`,
                            is_read: false
                        }));
                        await supabaseAuth.from('notifications').insert(notifPayloads);
                    }
                }
            } catch (notifErr) {
                console.warn('Failed to insert notifications for classroom chat:', notifErr);
            }
        } finally {
            setIsSendingClassroomMessage(false);
        }
    };

    const classroomChatParticipants = useMemo(() => {
        const teacher = teacherProfile
            ? [{ id: teacherProfile.id, name: teacherProfile.name || 'Teacher', role: teacherProfile.role || 'teacher' }]
            : [];

        const enrolled = students.map(student => ({
            id: student.student_id,
            name: student.name || 'Student',
            role: 'student',
            profile_pic_url: student.profile_pic_url
        }));

        return [...teacher, ...enrolled];
    }, [teacherProfile, students]);

    // Action handler to broadcast class messages
    const handleSendClassMessageAction = async () => {
        if (!messageContent.trim() || !teacherProfile || !classroom) return false;
        setIsSendingMessage(true);
        setMessageNotification(null);
        try {
            const payload = {
                teacher_id: teacherProfile.id,
                channel: 'classroom',
                recipients: [{ id: classroomId, name: classroom.name, type: 'class' }],
                subject: messageSubject.trim() || `Class Update - ${classroom.name}`,
                content: messageContent.trim(),
                created_at: new Date().toISOString()
            };
            const { data, error } = await supabaseAuth
                .from('broadcasts')
                .insert(payload)
                .select('*, sender:users!teacher_id(name, role)');
            if (error) throw error;
            
            if (data && data.length > 0) {
                const insertedBroadcast = {
                    ...data[0],
                    sender: data[0].sender || {
                        name: teacherProfile.name,
                        role: teacherProfile.role || 'teacher'
                    }
                };
                setClassBroadcasts(prev => {
                    if (prev.some(b => b.id === insertedBroadcast.id)) return prev;
                    const updated = [insertedBroadcast, ...prev];
                    return updated.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                });
                sendClassroomNotification({
                    teacherId: teacherProfile.id,
                    recipients: [{ id: classroomId, name: classroom.name, type: 'class' }],
                    title: messageSubject.trim() || `New Broadcast - ${classroom.name}`,
                    message: messageContent.trim()
                }).catch(err => console.error('Failed to send classroom notifications for broadcast:', err));
            }
            setMessageContent('');
            setMessageSubject('');
            setMessageNotification({
                type: 'success',
                text: 'Message successfully broadcast to all students in this class!'
            });
            setTimeout(() => {
                setMessageNotification(null);
            }, 4000);
            return true;
        } catch (err: any) {
            console.error('Error broadcasting message:', err);
            setMessageNotification({
                type: 'error',
                text: `Failed to send message: ${err.message || err}`
            });
            return false;
        } finally {
            setIsSendingMessage(false);
        }
    };

    // Send broadcast handler (backward compatible)
    const handleSendClassMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        await handleSendClassMessageAction();
    };

    const handleDeleteAnnouncement = async (broadcastId: string, subject: string, content: string) => {
        const confirmed = window.confirm('Are you sure you want to delete this announcement? It will be removed from all Admin, Teacher, and Student dashboards.');
        if (!confirmed) return;

        try {
            await supabaseAuth.from('broadcasts').delete().eq('id', broadcastId);
            await supabaseAuth.from('broadcast_reads').delete().eq('broadcast_id', broadcastId);
            await supabaseAuth.from('notifications').delete().eq('title', subject.trim()).eq('message', content.trim());

            setClassBroadcasts(prev => prev.filter(b => b.id !== broadcastId));
            setSelectedAnnouncement(null);
            setMessageNotification({
                type: 'success',
                text: 'Announcement deleted successfully across all dashboards.'
            });
            setTimeout(() => setMessageNotification(null), 4000);
        } catch (err: any) {
            console.error('Failed to delete classroom announcement:', err);
            setMessageNotification({
                type: 'error',
                text: `Failed to delete announcement: ${err.message || 'Error'}`
            });
            setTimeout(() => setMessageNotification(null), 4000);
        }
    };

    const formatDuration = (sec: number) => {
        const mins = Math.floor(sec / 60);
        const secs = sec % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Restore active tab from sessionStorage on mount
    useEffect(() => {
        if (typeof window !== 'undefined' && classroomId) {
            const savedTab = sessionStorage.getItem(`classroom_tab_${classroomId}`);
            if (savedTab && ['Overview', 'Curriculum', 'Students', 'Assignments', 'Attendance', 'Class Logs', 'Chat', 'Settings'].includes(savedTab)) {
                setActiveTab(savedTab);
            }
        }
    }, [classroomId]);

    // Save active tab to sessionStorage when it changes
    useEffect(() => {
        if (typeof window !== 'undefined' && classroomId && activeTab) {
            sessionStorage.setItem(`classroom_tab_${classroomId}`, activeTab);
        }
    }, [activeTab, classroomId]);
    const PAGE_SIZE = 10;

    // New schedule form state
    const [newSchedule, setNewSchedule] = useState({
        day: 0,
        start: '09:00',
        end: '10:30'
    });
    const [isSavingSchedule, setIsSavingSchedule] = useState(false);

    const [showDirectoryModal, setShowDirectoryModal] = useState(false);
    const [showMessageModal, setShowMessageModal] = useState(false);
    const [messageNotification, setMessageNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Auto-dismiss notification toast after 3 seconds
    useEffect(() => {
        if (messageNotification) {
            const timer = setTimeout(() => {
                setMessageNotification(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [messageNotification]);
    const [selectedAnnouncement, setSelectedAnnouncement] = useState<any | null>(null);
    const [announcementSearchQuery, setAnnouncementSearchQuery] = useState('');

    const filteredAnnouncements = useMemo(() => {
        const query = announcementSearchQuery.toLowerCase().trim();
        if (!query) return classBroadcasts;
        return classBroadcasts.filter(b => 
            b.subject.toLowerCase().includes(query) || 
            (b.content && b.content.toLowerCase().includes(query))
        );
    }, [classBroadcasts, announcementSearchQuery]);

    const [directoryStudents, setDirectoryStudents] = useState<DirectoryStudent[]>([]);
    const [directorySearch, setDirectorySearch] = useState('');
    const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
    const [isAddingStudents, setIsAddingStudents] = useState(false);
    const [directoryLoading, setDirectoryLoading] = useState(false);

    // ── Remove-from-class ─────────────────────────────────────────────────────
    const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);

    // ── Classroom metadata edit ───────────────────────────────────────────────
    const [metadataForm, setMetadataForm] = useState<{
        name: string;
        description: string;
        delivery_format: 'online' | 'offline';
        status: string;
        class_date: string;
        start_time: string;
        end_time: string;
    }>({
        name: '',
        description: '',
        delivery_format: 'offline',
        status: 'active',
        class_date: '',
        start_time: '10:00',
        end_time: '11:00'
    });
    const [isSavingMetadata, setIsSavingMetadata] = useState(false);
    const [metadataSaved, setMetadataSaved] = useState(false);
    const [metadataError, setMetadataError] = useState('');

    // ── Assignments ───────────────────────────────────────────────────────────
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [classroomInventoryAllocations, setClassroomInventoryAllocations] = useState<any[]>([]);
    const [classroomAttendance, setClassroomAttendance] = useState<any[]>([]);
    const [classroomAssignmentsStudents, setClassroomAssignmentsStudents] = useState<any[]>([]);
    const [assignmentsLoading, setAssignmentsLoading] = useState(false);
    const [expandedAssignmentId, setExpandedAssignmentId] = useState<string | null>(null);
    const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'all_students' | 'individual'>('all');
    
    // Course Curriculum DB states
    const [categories, setCategories] = useState<CourseCategory[]>([]);
    const [courseModules, setCourseModules] = useState<any[]>([]);
    const [courseChapters, setCourseChapters] = useState<any[]>([]);
    const [courseLessons, setCourseLessons] = useState<any[]>([]);
    const [studentProgress, setStudentProgress] = useState<any[]>([]);
    const [curriculumTab, setCurriculumTab] = useState<'classwide' | 'individual'>('classwide');
    const [selectedStudentForCurriculum, setSelectedStudentForCurriculum] = useState<EnrolledStudent | null>(null);
    const [isUpdatingProgress, setIsUpdatingProgress] = useState<string | null>(null);
    const [isInventoryDrawerOpen, setIsInventoryDrawerOpen] = useState(false);
    const [inventorySearchQuery, setInventorySearchQuery] = useState('');
    const [inventoryActiveTab, setInventoryActiveTab] = useState<string>('Proficiency Levels');
    const [expandedInventoryModules, setExpandedInventoryModules] = useState<Record<string, boolean>>({});
    const [importingItemId, setImportingItemId] = useState<string | null>(null);
    const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
    const [expandedHeadlines, setExpandedHeadlines] = useState<Record<string, boolean>>({});
    const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
    const [curriculumSearchQuery, setCurriculumSearchQuery] = useState('');
    const [mediaPreview, setMediaPreview] = useState<{ type: string; url: string; title: string } | null>(null);
    const [selectedTopic, setSelectedTopic] = useState<any | null>(null);

    // Allocation Manager Drawer states
    const [isAllocationDrawerOpen, setIsAllocationDrawerOpen] = useState(false);
    const [unlockModalTarget, setUnlockModalTarget] = useState<{ type: 'level' | 'chapter' | 'topic'; item: any; action: 'unlock' | 'lock' } | null>(null);
    const [allocationTargetLesson, setAllocationTargetLesson] = useState<any | null>(null);
    const [allocationTargetItemType, setAllocationTargetItemType] = useState<'level' | 'chapter' | 'topic'>('topic');
    const [allocationTargetType, setAllocationTargetType] = useState<'classwide' | 'individual'>('classwide');
    const [allocationStatus, setAllocationStatus] = useState<'locked' | 'unlocked' | 'completed'>('locked');
    const [allocationSelectedStudents, setAllocationSelectedStudents] = useState<string[]>([]);
    const [allocationSearchQuery, setAllocationSearchQuery] = useState('');
    const [isSavingAllocation, setIsSavingAllocation] = useState(false);

    const openUnlockModal = (type: 'level' | 'chapter' | 'topic', item: any) => {
        const isLocked = getIsLocked(type, item.id);
        setUnlockModalTarget({
            type,
            item,
            action: isLocked ? 'unlock' : 'lock'
        });
    };

    const getStudentsWithStatus = (status: 'locked' | 'unlocked' | 'completed', lessonId: string) => {
        if (status === 'locked') {
            return students
                .map(s => s.student_id)
                .filter(id => {
                    const progressObj = studentProgress.find(p => p.student_id === id && p.lesson_id === lessonId);
                    return !progressObj || progressObj.status === 'locked';
                });
        } else if (status === 'unlocked') {
            return studentProgress
                .filter(p => p.lesson_id === lessonId && (p.status === 'unlocked' || p.status === 'completed') && p.student_id !== 'classwide_default')
                .map(p => p.student_id);
        } else {
            return studentProgress
                .filter(p => p.lesson_id === lessonId && p.status === 'completed' && p.student_id !== 'classwide_default')
                .map(p => p.student_id);
        }
    };

    const openAllocationDrawer = (type: 'level' | 'chapter' | 'topic', item: any) => {
        setAllocationTargetLesson(item);
        setAllocationTargetItemType(type);
        const targetType = 'individual';
        setAllocationTargetType(targetType);

        let affectedLessonIds: string[] = [];
        if (type === 'level') {
            const chaptersInMod = courseChapters.filter(c => c.module_id === item.id);
            const chapterIds = chaptersInMod.map(c => c.id);
            const lessonsInMod = courseLessons.filter(l => chapterIds.includes(l.chapter_id));
            affectedLessonIds = lessonsInMod.map(l => l.id);
        } else if (type === 'chapter') {
            const lessonsInChap = courseLessons.filter(l => l.chapter_id === item.id);
            affectedLessonIds = lessonsInChap.map(l => l.id);
        } else if (type === 'topic') {
            affectedLessonIds = [item.id];
        }

        let initialStatus: 'locked' | 'unlocked' | 'completed' = 'locked';
        const progressForLessons = studentProgress.filter(p => affectedLessonIds.includes(p.lesson_id));
        
        if (selectedStudentForCurriculum) {
            const studentProgressRows = progressForLessons.filter(p => p.student_id === selectedStudentForCurriculum.student_id);
            if (studentProgressRows.length > 0) {
                const hasUnlocked = studentProgressRows.some(p => p.status === 'unlocked' || p.status === 'completed');
                const allCompleted = affectedLessonIds.length > 0 && affectedLessonIds.every(id => 
                    studentProgressRows.some(p => p.lesson_id === id && p.status === 'completed')
                );
                if (allCompleted) {
                    initialStatus = 'completed';
                } else if (hasUnlocked) {
                    initialStatus = 'unlocked';
                }
            }
        }

        setAllocationStatus(initialStatus);

        const studentStatuses = getStudentStatuses(type, item.id);
        const allocatedOrCompletedStudents = studentStatuses
            .filter(s => s.status === 'completed' || s.status === 'in_progress' || s.status === 'locked')
            .map(s => s.studentId);

        const currentSelected = selectedStudentForCurriculum
            ? Array.from(new Set([
                selectedStudentForCurriculum.student_id,
                ...allocatedOrCompletedStudents
              ]))
            : allocatedOrCompletedStudents;

        setAllocationSelectedStudents(currentSelected);
        setIsAllocationDrawerOpen(true);
    };
    const [showAssignmentModal, setShowAssignmentModal] = useState(false);
    const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
    const [showAssignmentAudioRecorder, setShowAssignmentAudioRecorder] = useState(false);
    const [showNoteAudioRecorder, setShowNoteAudioRecorder] = useState(false);
    const [isSavingAssignment, setIsSavingAssignment] = useState(false);
    const [assignmentForm, setAssignmentForm] = useState({
        title: '',
        description: '',
        due_date: '',
        target_type: 'all' as 'all' | 'individual',
        selectedStudentIds: new Set<string>(),
        file_url: null as string | null,
        file_name: null as string | null,
        file_size: null as number | null,
    });
    const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
    const [deletingAssignmentId, setDeletingAssignmentId] = useState<string | null>(null);
    const assignmentFileRef = useRef<HTMLInputElement>(null);
    const [isDraggingOverAssignments, setIsDraggingOverAssignments] = useState(false);

    // Previous tasks reuse state
    const [previousTasks, setPreviousTasks] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedPreviousTaskId, setSelectedPreviousTaskId] = useState<string | null>(null);

    const filteredPreviousTasks = useMemo(() => {
        const seen = new Set<string>();
        const unique: any[] = [];
        previousTasks.forEach(task => {
            const normalizedTitle = (task.title || '').toLowerCase().trim();
            if (normalizedTitle && !seen.has(normalizedTitle)) {
                seen.add(normalizedTitle);
                unique.push(task);
            }
        });

        if (!assignmentForm.title.trim()) return unique;
        const lowerTitle = assignmentForm.title.toLowerCase();
        return unique.filter(t => t.title?.toLowerCase().includes(lowerTitle));
    }, [previousTasks, assignmentForm.title]);

    const handleSelectPreviousTask = (task: any) => {
        setAssignmentForm(prev => ({
            ...prev,
            title: task.title || '',
            description: task.description || '',
            due_date: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '',
            file_url: task.file_url || null,
            file_name: task.file_name || null,
            file_size: task.file_size || null,
        }));
        setAssignmentFile(null);
        setSelectedPreviousTaskId(task.id);
        setShowSuggestions(false);
    };

    const handleAssignmentTitleChange = (newTitle: string) => {
        setAssignmentForm(prev => ({ ...prev, title: newTitle }));
        if (selectedPreviousTaskId) {
            const matched = previousTasks.find(t => t.id === selectedPreviousTaskId);
            if (matched && matched.title !== newTitle) {
                setSelectedPreviousTaskId(null);
            }
        }
        setShowSuggestions(true);
    };

    // Student Task Review Dialog states
    const [selectedReviewStudent, setSelectedReviewStudent] = useState<AssignmentStudent | null>(null);
    const [selectedReviewAssignment, setSelectedReviewAssignment] = useState<Assignment | null>(null);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [reviewScore, setReviewScore] = useState<number | ''>('');
    const [reviewProficiency, setReviewProficiency] = useState<string>('');
    const [reviewFeedback, setReviewFeedback] = useState<string>('');
    const [reviewReassign, setReviewReassign] = useState<boolean>(false);
    const [isSavingReview, setIsSavingReview] = useState<boolean>(false);

    const parseModuleCategory = (mod: any) => {
        if (mod.category_id) {
            const matchedCat = categories.find(c => c.id === mod.category_id);
            if (matchedCat) {
                let cleanDesc = mod.description || '';
                const match = cleanDesc.match(/^\[(.*?)\]\s*([\s\S]*)$/);
                if (match) {
                    cleanDesc = match[2].trim();
                }
                return {
                    category: matchedCat.name,
                    description: cleanDesc
                };
            }
        }

        if (!mod.description) {
            return {
                category: mod.module_number < 100 ? 'Proficiency Levels' : 'Specialized Modules',
                description: ''
            };
        }
        const match = mod.description.match(/^\[(.*?)\]\s*([\s\S]*)$/);
        if (match) {
            return {
                category: match[1].trim(),
                description: match[2].trim()
            };
        }
        return {
            category: mod.module_number < 100 ? 'Proficiency Levels' : 'Specialized Modules',
            description: mod.description
        };
    };

    const getImporterCategories = () => {
        const categoriesSet = new Set<string>();
        courseModules.forEach(mod => {
            const parsed = parseModuleCategory(mod);
            categoriesSet.add(parsed.category);
        });
        const categories = Array.from(categoriesSet);
        return categories.sort((a, b) => {
            if (a === 'Proficiency Levels') return -1;
            if (b === 'Proficiency Levels') return 1;
            if (a === 'Specialized Modules') return -1;
            if (b === 'Specialized Modules') return 1;
            return a.localeCompare(b);
        });
    };

    const getCategoryAbbreviation = (category: string) => {
        if (category === 'Proficiency Levels') return 'PL';
        if (category === 'Specialized Modules') return 'SM';
        const clean = category.replace(/[^a-zA-Z0-9\s]/g, '');
        const words = clean.trim().split(/\s+/);
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase();
        }
        if (words.length === 1 && words[0].length >= 2) {
            return words[0].substring(0, 2).toUpperCase();
        }
        return category.substring(0, 2).toUpperCase() || 'SP';
    };

    const closeAssignmentModal = () => {
        setShowAssignmentModal(false);
        setEditingAssignmentId(null);
        setAssignmentForm({
            title: '',
            description: '',
            due_date: '',
            target_type: 'all',
            selectedStudentIds: new Set<string>(),
            file_url: null,
            file_name: null,
            file_size: null,
        });
        setAssignmentFile(null);
        setAssignmentError('');
        setSelectedPreviousTaskId(null);
        setShowSuggestions(false);
    };

    const handleEditAssignment = (asg: any) => {
        setEditingAssignmentId(asg.id);
        const assignedStudentIds = new Set<string>(
            (asg.assignment_students || []).map((s: any) => s.student_id)
        );
        let formattedDate = '';
        if (asg.due_date) {
            const str = String(asg.due_date).trim();
            formattedDate = str.includes('T') ? str.split('T')[0] : str;
        }
        setAssignmentForm({
            title: asg.title || '',
            description: asg.description || '',
            due_date: formattedDate,
            target_type: asg.target_type || (assignedStudentIds.size > 0 && assignedStudentIds.size < students.length ? 'individual' : 'all'),
            selectedStudentIds: assignedStudentIds.size > 0 ? assignedStudentIds : new Set(students.map(s => s.student_id)),
            file_url: asg.file_url || null,
            file_name: asg.file_name || null,
            file_size: asg.file_size ? Number(asg.file_size) : null,
        });
        setShowAssignmentModal(true);
    };

    const fetchPreviousTasks = useCallback(async () => {
        if (!teacherProfile?.id) return;
        try {
            let prevTasksQuery = supabaseAuth
                .from('assignments')
                .select('id, title, description, due_date, classroom_id, target_type, status, inventory_ref_type, inventory_ref_id, inventory_ref_title, file_url, file_name, file_size');
            
            if (teacherProfile.role !== 'admin') {
                prevTasksQuery = prevTasksQuery.eq('teacher_id', teacherProfile.id);
            }
            const { data: prevTasksData } = await prevTasksQuery.order('created_at', { ascending: false });

            if (prevTasksData) {
                const manualPrevTasks = prevTasksData.filter((t: any) => {
                    const isAutoCurriculum = t.inventory_ref_type && t.title === t.inventory_ref_title;
                    return !isAutoCurriculum;
                });
                setPreviousTasks(manualPrevTasks);
            }
        } catch (err) {
            console.error('Error fetching previous tasks:', err);
        }
    }, [teacherProfile?.id, teacherProfile?.role]);

    useEffect(() => {
        if (showAssignmentModal) {
            fetchPreviousTasks();
        }
    }, [showAssignmentModal, fetchPreviousTasks]);

    const handleDragStart = (e: React.DragEvent, note: ClassNote) => {
        e.dataTransfer.setData('application/json', JSON.stringify(note));
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handleDropNote = (e: React.DragEvent) => {
        e.preventDefault();
        try {
            const noteData = e.dataTransfer.getData('application/json');
            if (noteData) {
                const note = JSON.parse(noteData) as ClassNote;
                setAssignmentForm({
                    title: note.title,
                    description: note.content || '',
                    due_date: '',
                    target_type: 'all',
                    selectedStudentIds: new Set<string>(),
                    file_url: note.file_url || null,
                    file_name: note.file_name || null,
                    file_size: note.file_size || null,
                });
                setAssignmentFile(null);
                setShowAssignmentModal(true);
            }
        } catch (err) {
            console.error('Error parsing dropped note data:', err);
        }
    };

    // ── Class Notes Board ─────────────────────────────────────────────────────
    const [classNotes, setClassNotes] = useState<ClassNote[]>([]);
    const [notesLoading, setNotesLoading] = useState(false);
    const [showNoteEditor, setShowNoteEditor] = useState(false);
    const [editingNote, setEditingNote] = useState<ClassNote | null>(null);
    const [noteForm, setNoteForm] = useState({ title: '', content: '', color: 'yellow' });
    const [noteFile, setNoteFile] = useState<File | null>(null);
    const [isSavingNote, setIsSavingNote] = useState(false);
    const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
    const noteFileRef = useRef<HTMLInputElement>(null);

    // ── Attendance Tab State ──────────────────────────────────────────────────
    const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().split('T')[0]);

    // Sync sessionDate from props to attendanceDate state (so overrides resolve correctly in meeting mode)
    useEffect(() => {
        if (sessionDate) {
            setAttendanceDate(sessionDate);
        }
    }, [sessionDate]);
    const [attendanceRecords, setAttendanceRecords] = useState<Record<string, 'present' | 'absent' | 'late' | 'excused'>>({});
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [isSavingAttendanceMap, setIsSavingAttendanceMap] = useState<Record<string, boolean>>({});

    // ── Session Logs State ──
    const [sessionLogs, setSessionLogs] = useState<any[]>([]);
    const [sessionLogsLoading, setSessionLogsLoading] = useState(false);

    const normalizeDateStr = (dateVal: any): string => {
        if (!dateVal) return '';
        if (typeof dateVal === 'string') {
            return dateVal.split('T')[0].trim();
        }
        if (dateVal instanceof Date) {
            return dateVal.toISOString().split('T')[0];
        }
        return String(dateVal).split('T')[0].trim();
    };

    const activeAttendanceRoster = useMemo(() => {
        const list = [...students];
        const targetDate = normalizeDateStr(attendanceDate);

        const matchingOverrides = (sessionOverrides || []).filter(
            o => o && o.override_date && normalizeDateStr(o.override_date) === targetDate
        );

        matchingOverrides.forEach(o => {
            const isAlreadyInList = list.some(s => s.student_id === o.student_id);
            if (!isAlreadyInList) {
                const level = o.users?.level || 'Level 1';
                const mock_score = 8.0;
                const mock_progress = 75;
                const mock_attendance = 90;
                const mock_submission = 85;
                const avg = Math.round((mock_progress + mock_submission + mock_attendance + (mock_score * 10)) / 4);
                let mock_status: 'Consistent' | 'Improving' | 'At Risk' = 'At Risk';
                if (avg >= 80) mock_status = 'Consistent';
                else if (avg >= 65) mock_status = 'Improving';

                list.push({
                    id: `override-${o.id}`,
                    student_id: o.student_id,
                    name: `${o.users?.name || 'Unknown'} (Makeup)`,
                    profile_pic_url: o.users?.profile_pic_url || null,
                    level: level,
                    joined_at: o.override_date,
                    mock_score,
                    mock_progress,
                    mock_attendance,
                    mock_submission,
                    mock_milestone: 'Makeup Session',
                    mock_status,
                    is_makeup: true
                });
            }
        });
        return list;
    }, [students, sessionOverrides, attendanceDate]);

    // ── Error states ──────────────────────────────────────────────────────────
    const [dbSetupError, setDbSetupError] = useState(false);
    const [assignmentError, setAssignmentError] = useState('');
    const [noteError, setNoteError] = useState('');

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab]);

    const fetchOnlineStudentIds = async (targetStudentIds: string[]): Promise<Set<string>> => {
        if (!targetStudentIds || targetStudentIds.length === 0) {
            return new Set<string>();
        }
        try {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            const { data: activeSessions, error } = await supabaseAuth
                .from('user_sessions')
                .select('user_id')
                .in('user_id', targetStudentIds)
                .is('logout_at', null)
                .gt('last_activity_at', fiveMinutesAgo);

            if (error) {
                console.warn('Error fetching online user sessions:', error);
                return new Set<string>();
            }

            return new Set<string>((activeSessions || []).map(sess => sess.user_id));
        } catch (e) {
            console.error('Failed to fetch online status:', e);
            return new Set<string>();
        }
    };

    const reEvaluateOnlineStatus = async () => {
        try {
            const currentStudents = studentsRef.current || [];
            const currentOverrides = sessionOverridesRef.current || [];
            const targetStudentIds = Array.from(new Set([
                ...currentStudents.map(s => s.student_id),
                ...currentOverrides.map(o => o.student_id)
            ])).filter(Boolean);

            if (targetStudentIds.length === 0) return;

            const onlineUserIds = await fetchOnlineStudentIds(targetStudentIds);

            setStudents(prev => prev.map(s => ({
                ...s,
                is_online: onlineUserIds.has(s.student_id)
            })));
        } catch (e) {
            console.error('Error re-evaluating online status in classroom:', e);
        }
    };

    useEffect(() => {
        if (!classroomId) return;
        
        reEvaluateOnlineStatus();

        const sessionsChannel = supabaseAuth
            .channel(`classroom-sessions-${classroomId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'user_sessions' },
                () => {
                    reEvaluateOnlineStatus();
                }
            )
            .subscribe();

        const timer = setInterval(reEvaluateOnlineStatus, 30000);

        return () => {
            supabaseAuth.removeChannel(sessionsChannel);
            clearInterval(timer);
        };
    }, [classroomId]);

    useEffect(() => {
        const fetchData = async () => {
            if (!classroomId) return;
            // Only set loading to true on initial render when classroom is null
            if (!classroom) {
                setLoading(true);
            }
            try {
                // 1. Authenticate
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (!session) {
                    router.push('/login?type=teacher');
                    return;
                }

                // 2. Fetch Teacher Profile and Classroom details in parallel
                const [profileRes, roomRes] = await Promise.all([
                    supabaseAuth.from('users').select('id, name, email, role').eq('id', session.user.id).single(),
                    supabaseAuth.from('classrooms').select('*').eq('id', classroomId).single()
                ]);

                const profile = profileRes.data;
                const roomData = roomRes.data;
                const roomError = roomRes.error;

                const cachedRole = typeof window !== 'undefined' ? localStorage.getItem('kfa-user-role') : null;
                const userRole = cachedRole || profile?.role;
                setTeacherProfile(profile ? { ...profile, role: userRole } : null);
                if (!profile) return;
                if (roomError) throw roomError;

                // Authorization check
                if (userRole !== 'admin' && roomData.teacher_id !== profile.id) {
                    throw new Error('Unauthorized classroom access');
                }

                // Fetch minimal teacher name and temporary class info in parallel if needed
                const [teacherRes, tempClassRes] = await Promise.all([
                    roomData.teacher_id
                        ? supabaseAuth.from('users').select('name').eq('id', roomData.teacher_id).maybeSingle()
                        : Promise.resolve({ data: null }),
                    roomData.type === 'temporary'
                        ? supabaseAuth.from('temporary_classes').select('id, class_date, start_time, end_time').eq('classroom_id', classroomId).maybeSingle()
                        : Promise.resolve({ data: null })
                ]);

                const teacherName = teacherRes.data?.name || '';
                const tempClassData = tempClassRes.data;

                const classroomData = { 
                    ...roomData, 
                    status: roomData.status || 'active',
                    teacher_name: teacherName,
                    ...(roomData.type === 'temporary' && tempClassData ? {
                        class_date: tempClassData.class_date,
                        start_time: tempClassData.start_time,
                        end_time: tempClassData.end_time
                    } : {})
                };
                setClassroom(classroomData);

                // Process metadata edit form
                const cleanDesc = (roomData.description || '')
                    .replace(/\[delivery_format:(online|offline)\]/g, '')
                    .trim();
                const format = ((roomData.description || '').includes('[delivery_format:online]') ? 'online' : 'offline') as 'online' | 'offline';

                setMetadataForm({
                    name: roomData.name || '',
                    description: cleanDesc,
                    delivery_format: format,
                    status: roomData.status || 'active',
                    class_date: classroomData.class_date || '',
                    start_time: classroomData.start_time ? classroomData.start_time.slice(0, 5) : '10:00',
                    end_time: classroomData.end_time ? classroomData.end_time.slice(0, 5) : '11:00',
                });

                // Progressive Rendering: Minimum critical data ready, unblock dashboard shell immediately
                setLoading(false);

                // 3. Load secondary data in background (non-blocking)
                loadSecondaryData(roomData, tempClassData);

            } catch (err) {
                console.error('Error fetching classroom data:', err);
                router.push('/teacher-dashboard/classrooms');
                setLoading(false);
            }
        };

        const loadSecondaryData = async (roomData: any, tempClassData: any) => {
            if (refreshInProgressRef.current) return;
            refreshInProgressRef.current = true;
            try {
                // Phase 2 background parallel queries
                const [
                    rosterRes,
                    overridesRes,
                    schedulesRes,
                    categoriesRes,
                    modulesRes,
                    chaptersRes,
                    lessonsRes,
                    asgRes
                ] = await Promise.all([
                    roomData.type === 'temporary'
                        ? supabaseAuth.from('session_student_overrides').select(`
                            id,
                            student_id,
                            users!student_id(name, profile_pic_url, level)
                          `).eq('target_classroom_id', classroomId)
                        : supabaseAuth.from('classroom_students').select(`
                            id,
                            student_id,
                            joined_at,
                            users!student_id(name, profile_pic_url, level)
                          `).eq('classroom_id', classroomId),
                    supabaseAuth.from('session_student_overrides').select(`
                        id,
                        student_id,
                        override_date,
                        reason,
                        users!student_id(name, profile_pic_url, level)
                    `).eq('target_classroom_id', classroomId).order('override_date', { ascending: true }),
                    supabaseAuth.from('batch_schedules').select('*').eq('classroom_id', classroomId).order('day_of_week', { ascending: true }).order('start_time', { ascending: true }),
                    supabaseAuth.from('course_categories').select('*').order('category_order', { ascending: true }),
                    supabaseAuth.from('course_modules').select('*').order('module_number', { ascending: true }),
                    supabaseAuth.from('course_chapters').select('*').order('chapter_number', { ascending: true }),
                    supabaseAuth.from('course_lessons').select('id, chapter_id, lesson_number, title, description, material_type, material_url, bullet_points').order('lesson_number', { ascending: true }),
                    supabaseAuth.from('assignments').select('*').eq('classroom_id', classroomId).order('created_at', { ascending: false })
                ]);

                const roster = rosterRes.data || [];
                const overridesData = overridesRes.data || [];
                const allClassStudentIds = Array.from(new Set([
                    ...roster.map((r: any) => r.student_id),
                    ...overridesData.map((o: any) => o.student_id)
                ])).filter(Boolean);

                const onlineUserIds = await fetchOnlineStudentIds(allClassStudentIds);

                // Map temporary classes date onto roster if temporary
                const finalRoster = (roomData.type === 'temporary' && tempClassData)
                    ? roster.map((r: any) => ({ ...r, joined_at: tempClassData.class_date }))
                    : roster;

                // Build Enrolled Students with Mock metrics
                const milestoneOptions = ['Alankars Mastery', 'Breath Control II', 'Fingering Basics', 'Rhythm Training', 'Raag Yaman Intros'];
                const formattedRoster = finalRoster.map((r: any, idx: number) => {
                    const seed = parseInt(r.id.substring(0, 8), 16) || idx;
                    const rawLevel = r.users?.level || 'Level 1';
                    const formattedLevel = rawLevel.toLowerCase().startsWith('level')
                        ? (rawLevel.charAt(0).toUpperCase() + rawLevel.slice(1))
                        : (rawLevel.charAt(0).toUpperCase() + rawLevel.slice(1));

                    const mock_score = 6 + ((seed % 40) / 10);
                    const mock_progress = 50 + (seed % 50);
                    const mock_attendance = 70 + (seed % 30);
                    const mock_submission = 65 + (seed % 30);
                    
                    const scorePct = mock_score * 10;
                    const avg = Math.round((mock_progress + mock_submission + mock_attendance + scorePct) / 4);
                    let mock_status: 'Consistent' | 'Improving' | 'At Risk' = 'At Risk';
                    if (avg >= 80) mock_status = 'Consistent';
                    else if (avg >= 65) mock_status = 'Improving';

                    return {
                        id: r.id,
                        student_id: r.student_id,
                        name: r.users?.name || 'Unknown',
                        profile_pic_url: r.users?.profile_pic_url || null,
                        level: formattedLevel,
                        joined_at: r.joined_at,
                        mock_score,
                        mock_progress,
                        mock_attendance,
                        mock_submission,
                        mock_milestone: milestoneOptions[seed % milestoneOptions.length],
                        mock_status,
                        is_online: onlineUserIds.has(r.student_id)
                    };
                });
                setStudents(formattedRoster);
                setSessionOverrides(overridesData);
                setSchedules(schedulesRes.data || []);

                // Categories & Curriculum loading / fallback seeding
                let loadedCats = INITIAL_CATEGORIES;
                if (categoriesRes.data && categoriesRes.data.length > 0) {
                    loadedCats = categoriesRes.data;
                }
                setCategories(loadedCats);

                let dbModulesData: any[] = modulesRes.data || [];
                let dbChaptersData: any[] = chaptersRes.data || [];
                let dbLessonsData: any[] = lessonsRes.data || [];

                if (dbModulesData.length === 0) {
                    try {
                        await supabaseAuth.from('course_modules').insert(INITIAL_MODULES);
                        await supabaseAuth.from('course_chapters').insert(INITIAL_CHAPTERS);
                        await supabaseAuth.from('course_lessons').insert(INITIAL_LESSONS);

                        const [seedModules, seedChapters, seedLessons] = await Promise.all([
                            supabaseAuth.from('course_modules').select('*').order('module_number', { ascending: true }),
                            supabaseAuth.from('course_chapters').select('*').order('chapter_number', { ascending: true }),
                            supabaseAuth.from('course_lessons').select('id, chapter_id, lesson_number, title, description, material_type, material_url, bullet_points').order('lesson_number', { ascending: true })
                        ]);

                        dbModulesData = seedModules.data || [];
                        dbChaptersData = seedChapters.data || [];
                        dbLessonsData = seedLessons.data || [];
                    } catch (seedingErr) {
                        console.error('Failed to auto-seed course curriculum data:', seedingErr);
                        dbModulesData = INITIAL_MODULES;
                        dbChaptersData = INITIAL_CHAPTERS;
                        dbLessonsData = INITIAL_LESSONS;
                    }
                }
                // Normalize courseChapters module_id to match dbModulesData module IDs
                const normalizedChapters = (dbChaptersData || []).map((chap: any) => {
                    if (dbModulesData.some((m: any) => m.id === chap.module_id)) {
                        return chap;
                    }
                    const initMod = INITIAL_MODULES.find(im => im.id === chap.module_id);
                    if (initMod) {
                        const matchingModule = dbModulesData.find((m: any) => 
                            m.module_number === initMod.module_number ||
                            m.title?.toLowerCase() === initMod.title?.toLowerCase()
                        );
                        if (matchingModule) {
                            return { ...chap, module_id: matchingModule.id };
                        }
                    }
                    return chap;
                });

                const normalizedLessons = (dbLessonsData || []).map((les: any) => {
                    if (normalizedChapters.some((c: any) => c.id === les.chapter_id)) {
                        return les;
                    }
                    const initChap = INITIAL_CHAPTERS.find(ic => ic.id === les.chapter_id);
                    if (initChap) {
                        const matchingChap = normalizedChapters.find((c: any) => 
                            c.chapter_number === initChap.chapter_number ||
                            c.title?.toLowerCase() === initChap.title?.toLowerCase()
                        );
                        if (matchingChap) {
                            return { ...les, chapter_id: matchingChap.id };
                        }
                    }
                    return les;
                });

                if (dbModulesData.length === INITIAL_MODULES.length) {
                    setCategories(INITIAL_CATEGORIES);
                }
                setCourseModules(dbModulesData);
                setCourseChapters(normalizedChapters);
                setCourseLessons(normalizedLessons);

                // Determine Home Classroom IDs of all students (so we can get curriculum allocations)
                let classroomIds = [classroomId];
                const studentIds = [
                    ...formattedRoster.map(s => s.student_id),
                    ...(overridesData || []).map((o: any) => o.student_id)
                ];

                // Check if any makeup/override student has a different home classroom
                const permanentStudentIds = new Set(formattedRoster.map(s => s.student_id));
                const externalOverrideStudentIds = (overridesData || [])
                    .map((o: any) => o.student_id)
                    .filter((id: string) => id && !permanentStudentIds.has(id));

                if (externalOverrideStudentIds.length > 0) {
                    try {
                        const { data: homeRooms } = await supabaseAuth
                            .from('classroom_students')
                            .select('classroom_id')
                            .in('student_id', externalOverrideStudentIds);
                        if (homeRooms) {
                            const ids = homeRooms.map(r => r.classroom_id).filter(Boolean);
                            classroomIds = Array.from(new Set([classroomId, ...ids]));
                        }
                    } catch (e) {
                        console.error('Failed to load external home classrooms:', e);
                    }
                }
                setActiveClassroomIds(classroomIds);

                // Phase 3 Parallel Fetches (Dependent on Student IDs / Classroom IDs list)
                const phase3Promises: Promise<any>[] = [
                    // progressQuery
                    (async () => {
                        try {
                            const progressQuery = studentIds.length > 0
                                ? supabaseAuth.from('student_topic_progress').select('*').in('student_id', studentIds)
                                : supabaseAuth.from('student_topic_progress').select('*').eq('classroom_id', classroomId);
                            const { data, error } = await progressQuery;
                            if (error) throw error;
                            setStudentProgress(data || []);
                        } catch (pe) {
                            console.warn('Could not fetch student_topic_progress:', pe);
                            setStudentProgress([]);
                        }
                    })(),

                    // Consolidated Assignments & Assignment-Students query
                    (async () => {
                        try {
                            const asgData = asgRes.data || [];
                            let allAsData: any[] = [];

                            if (studentIds.length > 0) {
                                const { data: asData, error } = await supabaseAuth
                                    .from('assignment_students')
                                    .select('*')
                                    .in('student_id', studentIds);

                                if (!error && asData) {
                                    allAsData = asData;
                                    setClassroomAssignmentsStudents(asData);
                                }
                            } else {
                                setClassroomAssignmentsStudents([]);
                            }

                            const enriched = asgData.map((a: Assignment) => {
                                if (a.target_type === 'individual') {
                                    const matchingRows = allAsData.filter((as: any) => as.assignment_id === a.id);
                                    const enrichedStudents = matchingRows.map((as: AssignmentStudent) => {
                                        const match = formattedRoster.find(s => s.student_id === as.student_id);
                                        return { ...as, student_name: match?.name || 'Unknown', student_pic: match?.profile_pic_url || null };
                                    });
                                    return { ...a, assignment_students: enrichedStudents };
                                }
                                return { ...a, assignment_students: [] };
                            });
                            setAssignments(enriched);
                        } catch (ae) {
                            console.warn('Could not enrich assignments:', ae);
                        }
                    })(),

                    // Fetch classroom allocations
                    (async () => {
                        try {
                            const classAllocReq = supabaseAuth
                                .from('classroom_inventory_allocation')
                                .select('*')
                                .in('classroom_id', classroomIds);

                            let curriculumData: any[] = [];
                            let curriculumError: any = null;

                            if (studentIds.length > 0) {
                                const studentAllocReq = supabaseAuth
                                    .from('classroom_inventory_allocation')
                                    .select('*')
                                    .in('allocated_to_student_id', studentIds);

                                const [res1, res2] = await Promise.all([classAllocReq, studentAllocReq]);
                                curriculumError = res1.error || res2.error || null;
                                const combinedMap = new Map<string, any>();
                                (res1.data || []).forEach((item: any) => combinedMap.set(item.id, item));
                                (res2.data || []).forEach((item: any) => combinedMap.set(item.id, item));
                                curriculumData = Array.from(combinedMap.values());
                            } else {
                                const res = await classAllocReq;
                                curriculumData = res.data || [];
                                curriculumError = res.error;
                            }

                            if (!curriculumError && curriculumData) {
                                setClassroomInventoryAllocations(curriculumData);
                            } else if (curriculumError) {
                                console.error('Fetch classroom_inventory_allocation error:', curriculumError);
                                setDbSetupError(true);
                            }
                        } catch (ce) {
                            console.warn('Could not fetch classroom_inventory_allocation:', ce);
                        }
                    })(),

                    // Fetch all attendance records for this classroom
                    (async () => {
                        try {
                            const { data, error } = await supabaseAuth
                                .from('attendance')
                                .select('student_id, date, status')
                                .eq('classroom_id', classroomId);
                            if (!error) {
                                setClassroomAttendance(data || []);
                            }
                        } catch (e) {
                            console.warn('Could not fetch classroom attendance logs:', e);
                        }
                    })()
                ];

                await Promise.all(phase3Promises);

            } catch (bgErr) {
                console.error('Error fetching secondary classroom data:', bgErr);
            } finally {
                lastRefreshAtRef.current = Date.now();
                refreshInProgressRef.current = false;
            }
        };

        fetchData();
    }, [classroomId, router, refreshTrigger]);

    // Re-sync classroom data on window focus or visibility change (throttled to at most once per 5 minutes)
    useEffect(() => {
        const handleFocusOrVisible = () => {
            const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
            const now = Date.now();
            if (now - lastRefreshAtRef.current >= COOLDOWN_MS && !refreshInProgressRef.current) {
                console.log('[Teacher Sync] Window focused or visible (after 5m cooldown). Triggering dashboard background refresh...');
                setRefreshTrigger(prev => prev + 1);
            }
        };

        window.addEventListener('focus', handleFocusOrVisible);
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                handleFocusOrVisible();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            window.removeEventListener('focus', handleFocusOrVisible);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, []);

    // ── Fetch Assignments Callback ─────────────────────────────────────────────
    const fetchAssignments = useCallback(async () => {
        if (!classroomId) return;
        setAssignmentsLoading(true);
        setDbSetupError(false);
        try {
            const { data: asgData, error } = await supabaseAuth
                .from('assignments')
                .select('*')
                .eq('classroom_id', classroomId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching assignments:', error.message);
                setDbSetupError(true);
                return;
            }

            const asgList = asgData || [];
            const asgIds = asgList.map((a: Assignment) => a.id);
            let allAsData: any[] = [];
            if (asgIds.length > 0) {
                const { data: asData } = await supabaseAuth
                    .from('assignment_students')
                    .select('*')
                    .in('assignment_id', asgIds);
                allAsData = asData || [];
            }

            const enriched = asgList.map((a: Assignment) => {
                const existingRows = allAsData.filter(row => row.assignment_id === a.id);

                if (a.target_type === 'individual') {
                    const enrichedStudents = existingRows.map((as: AssignmentStudent) => {
                        const match = students.find(s => s.student_id === as.student_id);
                        return { 
                            ...as, 
                            student_name: match?.name || 'Unknown', 
                            student_pic: match?.profile_pic_url || null 
                        };
                    });
                    return { ...a, assignment_students: enrichedStudents };
                } else {
                    const enrichedStudents = students.map(s => {
                        const existing = existingRows.find(row => row.student_id === s.student_id);
                        if (existing) {
                            return {
                                ...existing,
                                student_name: s.name,
                                student_pic: s.profile_pic_url || null
                            };
                        } else {
                            return {
                                id: `temp-impl-${a.id}-${s.student_id}`,
                                assignment_id: a.id,
                                student_id: s.student_id,
                                status: 'pending' as const,
                                score: null,
                                proficiency_level: null,
                                feedback_text: null,
                                video_url: null,
                                submitted_at: null,
                                student_name: s.name,
                                student_pic: s.profile_pic_url || null
                            };
                        }
                    });
                    return { ...a, assignment_students: enrichedStudents };
                }
            });

            setAssignments(enriched);
        } catch (err: any) {
            console.error('Error fetching assignments (exception):', err?.message || err);
            setDbSetupError(true);
        } finally {
            setAssignmentsLoading(false);
        }
    }, [classroomId, students]);

    const fetchCurriculumAllocations = useCallback(async () => {
        if (!classroomId) return;
        try {
            const classAllocReq = supabaseAuth
                .from('classroom_inventory_allocation')
                .select('*')
                .in('classroom_id', activeClassroomIds);

            const studentIds = students.map(s => s.student_id);
            let curriculumData: any[] = [];
            let curriculumError: any = null;

            if (studentIds.length > 0) {
                const studentAllocReq = supabaseAuth
                    .from('classroom_inventory_allocation')
                    .select('*')
                    .in('allocated_to_student_id', studentIds);

                const [res1, res2] = await Promise.all([classAllocReq, studentAllocReq]);
                curriculumError = res1.error || res2.error || null;
                const combinedMap = new Map<string, any>();
                (res1.data || []).forEach((item: any) => combinedMap.set(item.id, item));
                (res2.data || []).forEach((item: any) => combinedMap.set(item.id, item));
                curriculumData = Array.from(combinedMap.values());
            } else {
                const res = await classAllocReq;
                curriculumData = res.data || [];
                curriculumError = res.error;
            }

            if (!curriculumError && curriculumData) {
                setClassroomInventoryAllocations(curriculumData);
            }
        } catch (err: any) {
            console.error('Error fetching curriculum allocations (exception):', err?.message || err);
        }
    }, [classroomId, activeClassroomIds, students]);

    const handleOpenReviewModal = (student: AssignmentStudent, assignment: Assignment) => {
        setSelectedReviewStudent(student);
        setSelectedReviewAssignment(assignment);
        setReviewScore(student.score !== undefined && student.score !== null ? student.score : '');
        setReviewProficiency(student.proficiency_level || '');
        setReviewFeedback(student.feedback_text || '');
        setReviewReassign(student.status === 'reviewed');
        setIsReviewModalOpen(true);
    };

    const handleSaveStudentReview = async () => {
        if (!selectedReviewStudent || !selectedReviewAssignment) return;
        setIsSavingReview(true);

        try {
            const newStatus = reviewReassign ? 'reviewed' : 'approved';
            const updates = {
                status: newStatus,
                score: reviewScore === '' ? null : Number(reviewScore),
                proficiency_level: reviewProficiency,
                feedback_text: reviewFeedback,
                submitted_at: new Date().toISOString()
            };

            const isTemp = selectedReviewStudent.id.startsWith('temp-impl-');
            let dbError;
            let finalId = selectedReviewStudent.id;

            if (isTemp) {
                const { data: newRow, error: insertError } = await supabaseAuth
                    .from('assignment_students')
                    .insert({
                        assignment_id: selectedReviewAssignment.id,
                        student_id: selectedReviewStudent.student_id,
                        ...updates
                    })
                    .select()
                    .single();
                
                dbError = insertError;
                if (!insertError && newRow) {
                    finalId = newRow.id;
                }
            } else {
                const { error: updateError } = await supabaseAuth
                    .from('assignment_students')
                    .update(updates)
                    .eq('id', selectedReviewStudent.id);
                
                dbError = updateError;
            }

            if (dbError) {
                console.warn('Columns on assignment_students table might be missing, running fallback save...', dbError);
                if (isTemp) {
                    const { data: newRow, error: fallbackError } = await supabaseAuth
                        .from('assignment_students')
                        .insert({
                            assignment_id: selectedReviewAssignment.id,
                            student_id: selectedReviewStudent.student_id,
                            status: newStatus
                        })
                        .select()
                        .single();
                    if (fallbackError) throw fallbackError;
                    if (newRow) finalId = newRow.id;
                } else {
                    const { error: fallbackError } = await supabaseAuth
                        .from('assignment_students')
                        .update({ status: newStatus })
                        .eq('id', selectedReviewStudent.id);
                    if (fallbackError) throw fallbackError;
                }
            }

            setAssignments(prevAssignments => {
                return prevAssignments.map(asg => {
                    if (asg.id !== selectedReviewAssignment.id) return asg;
                    
                    const updatedStudents = (asg.assignment_students || []).map(stud => {
                        if (stud.student_id !== selectedReviewStudent.student_id) return stud;
                        return {
                            ...stud,
                            id: finalId,
                            status: newStatus as any,
                            score: reviewScore === '' ? null : Number(reviewScore),
                            proficiency_level: reviewProficiency,
                            feedback_text: reviewFeedback,
                            submitted_at: updates.submitted_at
                        };
                    });
                    
                    return { ...asg, assignment_students: updatedStudents };
                });
            });

            setIsReviewModalOpen(false);
            alert('Review saved successfully');

        } catch (error: any) {
            console.error('Error updating review:', error);
            alert(`Failed to save review: ${error.message || 'Unknown error'}`);
        } finally {
            setIsSavingReview(false);
        }
    };

    // ── Fetch Class Notes ──────────────────────────────────────────────────────
    const fetchClassNotes = useCallback(async () => {
        if (!classroomId) return;
        setNotesLoading(true);
        try {
            const { data, error } = await supabaseAuth
                .from('class_notes')
                .select('*')
                .eq('classroom_id', classroomId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching class notes:', error.message);
                if (!assignments.length) setDbSetupError(true);
                return;
            }
            setClassNotes(data || []);
        } catch (err: any) {
            console.error('Error fetching class notes (exception):', err?.message || err);
        } finally {
            setNotesLoading(false);
        }
    }, [classroomId, assignments.length]);

    // Fetch tab-specific data
    useEffect(() => {
        if (activeTab === 'Assignments' || activeTab === 'Curriculum') {
            fetchAssignments();
            if (activeTab === 'Assignments') {
                fetchClassNotes();
            }
            if (activeTab === 'Curriculum') {
                fetchCurriculumAllocations();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    // ── Fetch Classroom Attendance ─────────────────────────────────────────────
    const fetchClassroomAttendance = useCallback(async () => {
        if (!classroomId) return;
        setAttendanceLoading(true);
        try {
            const [attRes, overridesRes] = await Promise.all([
                supabaseAuth
                    .from('attendance')
                    .select('student_id, status')
                    .eq('classroom_id', classroomId)
                    .eq('date', attendanceDate),
                supabaseAuth
                    .from('session_student_overrides')
                    .select(`
                        id,
                        student_id,
                        override_date,
                        reason,
                        users!student_id(name, profile_pic_url, level)
                    `)
                    .eq('target_classroom_id', classroomId)
                    .order('override_date', { ascending: true })
            ]);

            if (overridesRes.data) {
                setSessionOverrides(overridesRes.data);
            }

            if (attRes.error) {
                console.error('Error fetching classroom attendance:', attRes.error.message);
                return;
            }

            const recordsMap: Record<string, 'present' | 'absent' | 'late' | 'excused'> = {};
            (attRes.data || []).forEach((row: any) => {
                recordsMap[row.student_id] = row.status;
            });
            setAttendanceRecords(recordsMap);
        } catch (err: any) {
            console.error('Error fetching classroom attendance (exception):', err?.message || err);
        } finally {
            setAttendanceLoading(false);
        }
    }, [classroomId, attendanceDate]);

    // Fetch when switching to Attendance tab or when attendanceDate changes
    useEffect(() => {
        if (activeTab === 'Attendance') {
            fetchClassroomAttendance();
        }
    }, [activeTab, attendanceDate, fetchClassroomAttendance]);

    // ── Fetch Classroom Session Logs ──
    const fetchSessionLogs = useCallback(async () => {
        if (!classroomId) return;
        setSessionLogsLoading(true);
        try {
            const { data, error } = await supabaseAuth
                .from('classroom_session_logs')
                .select('*')
                .eq('classroom_id', classroomId)
                .order('started_at', { ascending: false });

            if (error) throw error;
            setSessionLogs(data || []);
        } catch (err: any) {
            console.error('Error fetching classroom session logs:', err?.message || err);
        } finally {
            setSessionLogsLoading(false);
        }
    }, [classroomId]);

    useEffect(() => {
        if (activeTab === 'Class Logs') {
            fetchSessionLogs();
        }
    }, [activeTab, fetchSessionLogs]);

    // ── Mark Classroom Attendance Handler ──────────────────────────────────────
    const handleUnmarkClassroomAttendance = async (studentId: string) => {
        if (!classroomId || !teacherProfile) return;

        const prevStatus = attendanceRecords[studentId];

        // Optimistically remove from state
        setAttendanceRecords(prev => {
            const next = { ...prev };
            delete next[studentId];
            return next;
        });
        setClassroomAttendance(prev => prev.filter(a => !(a.student_id === studentId && a.date === attendanceDate)));
        setIsSavingAttendanceMap(prev => ({ ...prev, [studentId]: true }));

        try {
            const { error } = await supabaseAuth
                .from('attendance')
                .delete()
                .eq('student_id', studentId)
                .eq('classroom_id', classroomId)
                .eq('date', attendanceDate);

            if (error) throw error;
        } catch (err: any) {
            console.error('Error unmarking attendance:', err);
            alert(`Failed to unmark attendance: ${err.message || err}`);
            if (prevStatus) {
                setAttendanceRecords(prev => ({ ...prev, [studentId]: prevStatus }));
                setClassroomAttendance(prev => [...prev, { student_id: studentId, date: attendanceDate, status: prevStatus }]);
            }
        } finally {
            setIsSavingAttendanceMap(prev => ({ ...prev, [studentId]: false }));
        }
    };

    const handleMarkClassroomAttendance = async (studentId: string, status: string) => {
        if (!classroomId || !teacherProfile) return;

        // If clicking the already selected status, unmark it
        if (attendanceRecords[studentId] === status) {
            await handleUnmarkClassroomAttendance(studentId);
            return;
        }

        // Optimistically update status
        setAttendanceRecords(prev => ({ ...prev, [studentId]: status as any }));
        setClassroomAttendance(prev => {
            const idx = prev.findIndex(a => a.student_id === studentId && a.date === attendanceDate);
            if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], status: status.toLowerCase() };
                return updated;
            }
            return [...prev, { student_id: studentId, date: attendanceDate, status: status.toLowerCase() }];
        });
        setIsSavingAttendanceMap(prev => ({ ...prev, [studentId]: true }));

        try {
            const { error } = await supabaseAuth
                .from('attendance')
                .upsert({
                    student_id: studentId,
                    classroom_id: classroomId,
                    date: attendanceDate,
                    status: status.toLowerCase(),
                    marked_by: teacherProfile.id
                }, { onConflict: 'student_id, classroom_id, date' });

            if (error) throw error;
        } catch (err: any) {
            console.error('Error marking attendance:', err);
            alert(`Failed to save attendance: ${err.message || err}`);
            fetchClassroomAttendance();
        } finally {
            setIsSavingAttendanceMap(prev => ({ ...prev, [studentId]: false }));
        }
    };

    const openMakeupModal = async () => {
        if (!teacherProfile) return;
        setEditingOverrideId(null);
        setShowOverrideModal(true);
        setIsOverrideRosterLoading(true);
        setOverrideForm({ studentId: '', date: new Date().toISOString().split('T')[0], reason: '' });
        try {
            const enrolledIds = new Set(students.map(s => s.student_id));
            const usersQuery = supabaseAuth
                .from('users')
                .select('id, name, profile_pic_url, level')
                .or('role.eq.student,role.eq.pending,role.eq.mentor');

            const { data, error } = teacherProfile.role === 'admin'
                ? await usersQuery.order('name', { ascending: true })
                : await usersQuery.eq('teacher_id', teacherProfile.id).order('name', { ascending: true });

            if (error) throw error;
            const available = (data || []).filter((s: any) => !enrolledIds.has(s.id));
            setDirectoryStudentsForOverride(available);
            if (available.length > 0) {
                setOverrideForm(prev => ({ ...prev, studentId: available[0].id }));
            }
        } catch (err) {
            console.error('Error fetching directory for override:', err);
        } finally {
            setIsOverrideRosterLoading(false);
        }
    };

    const openRescheduleModal = async (override: any) => {
        if (!teacherProfile) return;
        setEditingOverrideId(override.id);
        setShowOverrideModal(true);
        setIsOverrideRosterLoading(true);
        setOverrideForm({
            studentId: override.student_id,
            date: override.override_date,
            reason: override.reason || ''
        });
        try {
            const enrolledIds = new Set(students.map(s => s.student_id));
            const usersQuery = supabaseAuth
                .from('users')
                .select('id, name, profile_pic_url, level')
                .or('role.eq.student,role.eq.pending,role.eq.mentor');

            const { data, error } = teacherProfile.role === 'admin'
                ? await usersQuery.order('name', { ascending: true })
                : await usersQuery.eq('teacher_id', teacherProfile.id).order('name', { ascending: true });

            if (error) throw error;
            const available = (data || []).filter((s: any) => !enrolledIds.has(s.id));
            if (override.student_id && !available.some((s: any) => s.id === override.student_id)) {
                available.push({
                    id: override.student_id,
                    name: override.users?.name || 'Unknown Student',
                    level: override.users?.level || 'Beginner',
                    profile_pic_url: override.users?.profile_pic_url || null
                });
            }
            setDirectoryStudentsForOverride(available);
        } catch (err) {
            console.error('Error fetching directory for override:', err);
        } finally {
            setIsOverrideRosterLoading(false);
        }
    };

    const handleSaveOverride = async () => {
        if (!overrideForm.studentId || !overrideForm.date) {
            alert('Please select a student and date.');
            return;
        }
        setIsSavingOverride(true);
        try {
            if (editingOverrideId) {
                const { data, error } = await supabaseAuth
                    .from('session_student_overrides')
                    .update({
                        student_id: overrideForm.studentId,
                        override_date: overrideForm.date,
                        reason: overrideForm.reason || null
                    })
                    .eq('id', editingOverrideId)
                    .select(`
                        id,
                        student_id,
                        override_date,
                        reason,
                        users!student_id(name, profile_pic_url, level)
                    `)
                    .single();

                if (error) throw error;

                setSessionOverrides(prev =>
                    prev.map(o => o.id === editingOverrideId ? data : o)
                        .sort((a, b) => a.override_date.localeCompare(b.override_date))
                );
                setShowOverrideModal(false);
                setEditingOverrideId(null);
            } else {
                const { data, error } = await supabaseAuth
                    .from('session_student_overrides')
                    .insert([{
                        student_id: overrideForm.studentId,
                        target_classroom_id: classroomId,
                        override_date: overrideForm.date,
                        reason: overrideForm.reason || null
                    }])
                    .select(`
                        id,
                        student_id,
                        override_date,
                        reason,
                        users!student_id(name, profile_pic_url, level)
                    `)
                    .single();

                if (error) throw error;

                setSessionOverrides(prev => [...prev, data].sort((a, b) => a.override_date.localeCompare(b.override_date)));
                setShowOverrideModal(false);
            }
        } catch (err: any) {
            console.error('Error saving override:', err);
            alert(`Failed to save makeup: ${err.message || err}`);
        } finally {
            setIsSavingOverride(false);
        }
    };

    const handleDeleteOverride = async (overrideId: string) => {
        if (!window.confirm('Are you sure you want to cancel this temporary makeup class allocation?')) return;
        setIsDeletingOverrideId(overrideId);
        try {
            const { error } = await supabaseAuth
                .from('session_student_overrides')
                .delete()
                .eq('id', overrideId);

            if (error) throw error;

            setSessionOverrides(prev => prev.filter(o => o.id !== overrideId));
        } catch (err: any) {
            console.error('Error deleting override:', err);
            alert(`Failed to cancel makeup: ${err.message || err}`);
        } finally {
            setIsDeletingOverrideId(null);
        }
    };

    // ── Fetch teacher's directory students ──────────────────────────────────────
    const openDirectoryModal = async () => {
        if (!teacherProfile) return;
        setShowDirectoryModal(true);
        setDirectoryLoading(true);
        setSelectedToAdd(new Set());
        setDirectorySearch('');
        try {
            const enrolledIds = new Set(students.map(s => s.student_id));
            const usersQuery = supabaseAuth
                .from('users')
                .select('id, name, profile_pic_url, status')
                .or('role.eq.student,role.eq.pending,role.eq.mentor');

            const { data, error } = teacherProfile.role === 'admin'
                ? await usersQuery
                : await usersQuery.eq('teacher_id', teacherProfile.id);

            if (error) throw error;

            const availableUserIds = (data || []).map((u: any) => u.id).filter(Boolean);
            const onlineUserIds = await fetchOnlineStudentIds(availableUserIds);

            const available = (data || [])
                .map((s: any) => ({
                    ...s,
                    is_online: onlineUserIds.has(s.id)
                }))
                .filter((s: any) => !enrolledIds.has(s.id));

            setDirectoryStudents(available);
        } catch (err) {
            console.error('Error fetching directory:', err);
        } finally {
            setDirectoryLoading(false);
        }
    };

    // ── Add selected students to this classroom ───────────────────────────────
    const handleAddStudents = async () => {
        if (selectedToAdd.size === 0) return;
        setIsAddingStudents(true);
        try {
            if (classroom?.type === 'temporary') {
                const rows = Array.from(selectedToAdd).map(studentId => ({
                    student_id: studentId,
                    target_classroom_id: classroomId,
                    override_date: classroom.class_date || new Date().toISOString().split('T')[0],
                    reason: 'Temporary Class Session'
                }));

                const { error } = await supabaseAuth
                    .from('session_student_overrides')
                    .insert(rows);

                if (error) throw error;
            } else {
                const studentIds = Array.from(selectedToAdd);
                
                await supabaseAuth
                    .from('classroom_students')
                    .delete()
                    .in('student_id', studentIds);

                const rows = studentIds.map(studentId => ({
                    classroom_id: classroomId,
                    student_id: studentId,
                    joined_at: new Date().toISOString(),
                }));

                const { error } = await supabaseAuth
                    .from('classroom_students')
                    .insert(rows);

                if (error) throw error;
            }

            const milestoneOptions = ['Alankars Mastery', 'Breath Control II', 'Fingering Basics', 'Rhythm Training', 'Raag Yaman Intros'];
            const addedStudentObjects = directoryStudents
                .filter(ds => selectedToAdd.has(ds.id))
                .map((ds, idx) => {
                    const seed = parseInt(ds.id.substring(0, 8), 16) || idx;
                    const mock_score = 6 + ((seed % 40) / 10);
                    const mock_progress = 50 + (seed % 50);
                    const mock_attendance = 70 + (seed % 30);
                    const mock_submission = 65 + (seed % 30);
                    
                    const scorePct = mock_score * 10;
                    const avg = Math.round((mock_progress + mock_submission + mock_attendance + scorePct) / 4);
                    let mock_status: 'Consistent' | 'Improving' | 'At Risk' = 'At Risk';
                    if (avg >= 80) mock_status = 'Consistent';
                    else if (avg >= 65) mock_status = 'Improving';

                    return {
                        id: `temp-${ds.id}`,
                        student_id: ds.id,
                        name: ds.name,
                        profile_pic_url: ds.profile_pic_url,
                        joined_at: classroom?.class_date || new Date().toISOString(),
                        mock_score,
                        mock_progress,
                        mock_attendance,
                        mock_submission,
                        mock_milestone: milestoneOptions[seed % milestoneOptions.length],
                        mock_status,
                    };
                });

            setStudents(prev => [...prev, ...addedStudentObjects]);
            setShowDirectoryModal(false);
        } catch (err) {
            console.error('Error adding students:', err);
            alert('Failed to add students.');
        } finally {
            setIsAddingStudents(false);
        }
    };

    // ── Remove a student from this classroom ──────────────────────────────────
    const handleRemoveStudent = async (enrolledStudent: EnrolledStudent) => {
        if (!window.confirm(`Remove "${enrolledStudent.name}" from this classroom? Their student record will be kept.`)) return;
        setRemovingStudentId(enrolledStudent.id);
        try {
            if (classroom?.type === 'temporary') {
                const { error } = await supabaseAuth
                    .from('session_student_overrides')
                    .delete()
                    .eq('target_classroom_id', classroomId)
                    .eq('student_id', enrolledStudent.student_id);

                if (error) throw error;
            } else {
                const { error } = await supabaseAuth
                    .from('classroom_students')
                    .delete()
                    .eq('classroom_id', classroomId)
                    .eq('student_id', enrolledStudent.student_id);

                if (error) throw error;
            }
            setStudents(prev => prev.filter(s => s.id !== enrolledStudent.id));
        } catch (err) {
            console.error('Error removing student:', err);
            alert('Failed to remove student from classroom.');
        } finally {
            setRemovingStudentId(null);
        }
    };

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    // ── Create or Update Assignment ───────────────────────────────────────────
    const handleCreateAssignment = async () => {
        if (!assignmentForm.title.trim() || !teacherProfile) return;
        setIsSavingAssignment(true);
        setAssignmentError('');
        try {
            let file_url: string | null = assignmentForm.file_url || null;
            let file_name: string | null = assignmentForm.file_name || null;
            let file_size: number | null = assignmentForm.file_size || null;

            if (assignmentFile) {
                const filePath = `assignments/${classroomId}/${Date.now()}_${assignmentFile.name}`;
                const { error: uploadErr } = await supabaseAuth.storage
                    .from('class_notes')
                    .upload(filePath, assignmentFile);
                if (uploadErr) {
                    console.warn('File upload skipped:', uploadErr.message);
                } else {
                    const { data: urlData } = supabaseAuth.storage.from('class_notes').getPublicUrl(filePath);
                    file_url = urlData.publicUrl;
                    file_name = assignmentFile.name;
                    file_size = assignmentFile.size;
                }
            }

            let studentIdsToAssign: string[] = [];
            if (assignmentForm.target_type === 'all') {
                studentIdsToAssign = students.map(s => s.student_id);
            } else if (assignmentForm.target_type === 'individual') {
                studentIdsToAssign = Array.from(assignmentForm.selectedStudentIds);
            }

            if (editingAssignmentId) {
                // UPDATE existing assignment
                const { error: updateError } = await supabaseAuth
                    .from('assignments')
                    .update({
                        title: assignmentForm.title.trim(),
                        description: assignmentForm.description.trim() || null,
                        due_date: assignmentForm.due_date || null,
                        target_type: assignmentForm.target_type,
                        file_url,
                        file_name,
                        file_size,
                    })
                    .eq('id', editingAssignmentId);

                if (updateError) {
                    setAssignmentError(`Failed to update assignment: ${updateError.message}`);
                    return;
                }

                // Sync assignment_students safely (do not delete submissions)
                const { data: currentMappings } = await supabaseAuth
                    .from('assignment_students')
                    .select('id, student_id, status, video_url, feedback_text')
                    .eq('assignment_id', editingAssignmentId);

                const existingMap = new Map((currentMappings || []).map(m => [m.student_id, m]));
                const existingStudentIds = new Set(existingMap.keys());
                const targetStudentIds = new Set(studentIdsToAssign);

                // Students to remove (only delete if no submission or review exists)
                const toRemove: string[] = [];
                for (const studentId of existingStudentIds) {
                    if (!targetStudentIds.has(studentId)) {
                        const rec = existingMap.get(studentId);
                        const hasSubmission = rec && (rec.status !== 'pending' || rec.video_url || rec.feedback_text);
                        if (!hasSubmission) {
                            toRemove.push(studentId);
                        }
                    }
                }

                if (toRemove.length > 0) {
                    await supabaseAuth
                        .from('assignment_students')
                        .delete()
                        .eq('assignment_id', editingAssignmentId)
                        .in('student_id', toRemove);
                }

                // Students to add
                const toAdd = studentIdsToAssign.filter(id => !existingStudentIds.has(id));
                if (toAdd.length > 0) {
                    const rows = toAdd.map(sid => ({
                        assignment_id: editingAssignmentId,
                        student_id: sid,
                        status: 'pending',
                    }));
                    await supabaseAuth.from('assignment_students').insert(rows);
                }

                // Fetch refreshed mappings
                const { data: updatedMappings } = await supabaseAuth
                    .from('assignment_students')
                    .select('*')
                    .eq('assignment_id', editingAssignmentId);

                const updatedAssignedStudents = (updatedMappings || []).map((as: AssignmentStudent) => {
                    const match = students.find(s => s.student_id === as.student_id);
                    return { ...as, student_name: match?.name || 'Unknown', student_pic: match?.profile_pic_url || null };
                });

                setAssignments(prev => prev.map(a => 
                    a.id === editingAssignmentId 
                        ? {
                            ...a,
                            title: assignmentForm.title.trim(),
                            description: assignmentForm.description.trim() || null,
                            due_date: assignmentForm.due_date || null,
                            target_type: assignmentForm.target_type,
                            file_url,
                            file_name,
                            file_size,
                            assignment_students: updatedAssignedStudents
                        }
                        : a
                ));

                closeAssignmentModal();
            } else {
                // CREATE new assignment
                const { data: newAsg, error } = await supabaseAuth
                    .from('assignments')
                    .insert([{
                        classroom_id: classroomId,
                        teacher_id: teacherProfile.id,
                        title: assignmentForm.title.trim(),
                        description: assignmentForm.description.trim() || null,
                        due_date: assignmentForm.due_date || null,
                        target_type: assignmentForm.target_type,
                        file_url,
                        file_name,
                        file_size,
                    }])
                    .select()
                    .single();

                if (error) {
                    setAssignmentError(`Failed to create assignment: ${error.message}`);
                    return;
                }

                let assignedStudents: AssignmentStudent[] = [];

                if (studentIdsToAssign.length > 0) {
                    const rows = studentIdsToAssign.map(sid => ({
                        assignment_id: newAsg.id,
                        student_id: sid,
                        status: 'pending',
                    }));
                    const { data: asData, error: asError } = await supabaseAuth
                        .from('assignment_students')
                        .insert(rows)
                        .select();
                    if (asError) {
                        console.warn('Could not insert assignment_students:', asError.message);
                    }
                    assignedStudents = (asData || []).map((as: AssignmentStudent) => {
                        const match = students.find(s => s.student_id === as.student_id);
                        return { ...as, student_name: match?.name || 'Unknown', student_pic: match?.profile_pic_url || null };
                    });
                }

                const fullAssignment: Assignment = { ...newAsg, assignment_students: assignedStudents };
                setAssignments(prev => [fullAssignment, ...prev]);
                setPreviousTasks(prev => [fullAssignment, ...prev]);

                closeAssignmentModal();
            }
        } catch (err: any) {
            console.error('Error saving assignment:', err);
            setAssignmentError(`Unexpected error: ${err?.message || err}`);
        } finally {
            setIsSavingAssignment(false);
        }
    };

    // ── Delete Assignment ──────────────────────────────────────────────────────
    const handleDeleteAssignment = async (id: string) => {
        if (!window.confirm('Delete this assignment?')) return;
        setDeletingAssignmentId(id);
        try {
            await supabaseAuth.from('assignment_students').delete().eq('assignment_id', id);
            const { error } = await supabaseAuth.from('assignments').delete().eq('id', id);
            if (error) throw error;
            setAssignments(prev => prev.filter(a => a.id !== id));
            if (expandedAssignmentId === id) setExpandedAssignmentId(null);
        } catch (err) {
            console.error('Error deleting assignment:', err);
        } finally {
            setDeletingAssignmentId(null);
        }
    };

    // ── Save Class Note ────────────────────────────────────────────────────────
    const handleSaveNote = async () => {
        if (!noteForm.title.trim() || !teacherProfile) return;
        setIsSavingNote(true);
        setNoteError('');
        try {
            let file_url: string | null = editingNote?.file_url || null;
            let file_name: string | null = editingNote?.file_name || null;
            let file_size: number | null = editingNote?.file_size || null;

            if (noteFile) {
                const filePath = `notes/${classroomId}/${Date.now()}_${noteFile.name}`;
                const { error: uploadErr } = await supabaseAuth.storage
                    .from('class_notes')
                    .upload(filePath, noteFile);
                if (uploadErr) {
                    console.warn('File upload skipped:', uploadErr.message);
                } else {
                    const { data: urlData } = supabaseAuth.storage.from('class_notes').getPublicUrl(filePath);
                    file_url = urlData.publicUrl;
                    file_name = noteFile.name;
                    file_size = noteFile.size;
                }
            }

            if (editingNote) {
                const { data, error } = await supabaseAuth
                    .from('class_notes')
                    .update({ title: noteForm.title.trim(), content: noteForm.content.trim() || null, color: noteForm.color, file_url, file_name, file_size, updated_at: new Date().toISOString() })
                    .eq('id', editingNote.id)
                    .select()
                    .single();
                if (error) {
                    setNoteError(`Failed to update note: ${error.message}`);
                    return;
                }
                setClassNotes(prev => prev.map(n => n.id === editingNote.id ? data : n));
            } else {
                const { data, error } = await supabaseAuth
                    .from('class_notes')
                    .insert([{ classroom_id: classroomId, teacher_id: teacherProfile.id, title: noteForm.title.trim(), content: noteForm.content.trim() || null, color: noteForm.color, file_url, file_name, file_size }])
                    .select()
                    .single();
                if (error) {
                    setNoteError(`Failed to save note: ${error.message}`);
                    return;
                }
                setClassNotes(prev => [data, ...prev]);
            }

            setShowNoteEditor(false);
            setEditingNote(null);
            setNoteForm({ title: '', content: '', color: 'yellow' });
            setNoteFile(null);
            setNoteError('');
        } catch (err: any) {
            console.error('Error saving note:', err);
            setNoteError(`Unexpected error: ${err?.message || err}`);
        } finally {
            setIsSavingNote(false);
        }
    };

    // ── Delete Class Note ──────────────────────────────────────────────────────
    const handleDeleteNote = async (id: string) => {
        if (!window.confirm('Delete this note?')) return;
        setDeletingNoteId(id);
        try {
            const { error } = await supabaseAuth.from('class_notes').delete().eq('id', id);
            if (error) throw error;
            setClassNotes(prev => prev.filter(n => n.id !== id));
        } catch (err) {
            console.error('Error deleting note:', err);
        } finally {
            setDeletingNoteId(null);
        }
    };

    const openEditNote = (note: ClassNote) => {
        setEditingNote(note);
        setNoteForm({ title: note.title, content: note.content || '', color: note.color || 'yellow' });
        setNoteFile(null);
        setShowNoteEditor(true);
    };

    const openNewNote = () => {
        setEditingNote(null);
        setNoteForm({ title: '', content: '', color: 'yellow' });
        setNoteFile(null);
        setShowNoteEditor(true);
    };

    const formatFileSize = (bytes: number | null): string => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const isAutoCurriculum = (a: any) => 
        !!(a.inventory_ref_type && a.title === a.inventory_ref_title);

    const filteredAssignments = useMemo(() => {
        const nonAutoAssignments = assignments.filter(a => !isAutoCurriculum(a));
        if (assignmentFilter === 'all') return nonAutoAssignments;
        if (assignmentFilter === 'all_students') return nonAutoAssignments.filter(a => a.target_type === 'all');
        return nonAutoAssignments.filter(a => a.target_type === 'individual');
    }, [assignments, assignmentFilter]);

    const allocatedInventoryItems = useMemo(() => {
        const activeStudentIds = new Set(students.map(s => s.student_id));

        return classroomInventoryAllocations
            .filter(item => {
                if (item.classroom_id !== classroomId) return false;
                if (curriculumTab === 'classwide') {
                    if (!item.allocated_to_student_id) return true;
                    return activeStudentIds.has(item.allocated_to_student_id);
                } else {
                    if (!selectedStudentForCurriculum) return false;
                    if (!item.allocated_to_student_id) return true;
                    return item.allocated_to_student_id === selectedStudentForCurriculum.student_id;
                }
            })
            .map(item => {
                let type: 'module' | 'chapter' | 'lesson' = 'module';
                let refId = '';
                let title = '';
                let description = '';

                if (item.module_id) {
                    type = 'module';
                    refId = item.module_id;
                    const mod = courseModules.find(m => m.id === refId);
                    title = mod?.title || 'Unknown Module';
                    description = mod?.description || '';
                } else if (item.chapter_id) {
                    type = 'chapter';
                    refId = item.chapter_id;
                    const chap = courseChapters.find(c => c.id === refId);
                    title = chap?.title || 'Unknown Chapter';
                    description = chap?.description || '';
                } else if (item.lesson_id) {
                    type = 'lesson';
                    refId = item.lesson_id;
                    const les = courseLessons.find(l => l.id === refId);
                    title = les?.title || 'Unknown Lesson';
                    description = les?.description || '';
                }

                return {
                    id: item.id,
                    classroom_id: item.classroom_id,
                    teacher_id: item.allocated_by,
                    title,
                    description,
                    due_date: null,
                    target_type: item.allocated_to_student_id ? 'individual' : 'all',
                    created_at: item.created_at,
                    inventory_ref_type: type,
                    inventory_ref_id: refId,
                    inventory_ref_title: title,
                    assignment_students: item.allocated_to_student_id ? [{ student_id: item.allocated_to_student_id }] : []
                };
            });
    }, [classroomInventoryAllocations, classroomId, curriculumTab, students, selectedStudentForCurriculum, courseModules, courseChapters, courseLessons]);

    const getStudentStatuses = useCallback((
        itemType: 'level' | 'chapter' | 'topic',
        itemId: string
    ) => {
        const activeRoster = students.map(s => ({
            student_id: s.student_id,
            name: s.name || 'Student',
            profile_pic_url: s.profile_pic_url || null
        }));

        return activeRoster.map(student => {
            const studentId = student.student_id;
            
            // Check if item is allocated to this student
            let isAllocated = false;
            if (itemType === 'level') {
                isAllocated = classroomInventoryAllocations.some(
                    a => a.module_id === itemId && a.allocated_to_student_id === studentId
                ) || classroomInventoryAllocations.some(
                    a => a.module_id === itemId && !a.allocated_to_student_id
                );
            } else if (itemType === 'chapter') {
                const chap = courseChapters.find(c => c.id === itemId);
                const modId = chap?.module_id;
                isAllocated = classroomInventoryAllocations.some(
                    a => (a.chapter_id === itemId || (modId && a.module_id === modId)) && 
                         (a.allocated_to_student_id === studentId || !a.allocated_to_student_id)
                );
            } else if (itemType === 'topic') {
                const lesson = courseLessons.find(l => l.id === itemId);
                const chap = courseChapters.find(c => c.id === lesson?.chapter_id);
                const modId = chap?.module_id;
                isAllocated = classroomInventoryAllocations.some(
                    a => (a.lesson_id === itemId || (lesson && a.chapter_id === lesson.chapter_id) || (modId && a.module_id === modId)) && 
                         (a.allocated_to_student_id === studentId || !a.allocated_to_student_id)
                );
            }

            // Also check implicit allocations from studentProgress
            if (!isAllocated) {
                if (itemType === 'topic') {
                    isAllocated = studentProgress.some(p => p.student_id === studentId && p.lesson_id === itemId);
                } else if (itemType === 'chapter') {
                    const lessonsInChap = courseLessons.filter(l => l.chapter_id === itemId).map(l => l.id);
                    isAllocated = studentProgress.some(p => p.student_id === studentId && lessonsInChap.includes(p.lesson_id));
                } else if (itemType === 'level') {
                    const chapsInMod = courseChapters.filter(c => c.module_id === itemId).map(c => c.id);
                    const lessonsInMod = courseLessons.filter(l => chapsInMod.includes(l.chapter_id)).map(l => l.id);
                    isAllocated = studentProgress.some(p => p.student_id === studentId && lessonsInMod.includes(p.lesson_id));
                }
            }

            // Check completion and unlock status
            let isCompleted = false;
            let isUnlocked = false;

            if (itemType === 'topic') {
                const prog = studentProgress.find(p => p.student_id === studentId && p.lesson_id === itemId);
                if (prog) {
                    isCompleted = prog.status === 'completed';
                    isUnlocked = prog.status === 'unlocked';
                }
            } else if (itemType === 'chapter') {
                const lessonsInChap = courseLessons.filter(l => l.chapter_id === itemId);
                const progressForChap = studentProgress.filter(p => p.student_id === studentId && lessonsInChap.some(l => l.id === p.lesson_id));
                
                const completedCount = progressForChap.filter(p => p.status === 'completed').length;
                const unlockedCount = progressForChap.filter(p => p.status === 'unlocked').length;
                
                isCompleted = lessonsInChap.length > 0 && completedCount === lessonsInChap.length;
                isUnlocked = !isCompleted && (completedCount > 0 || unlockedCount > 0);
            } else if (itemType === 'level') {
                const chaptersInMod = courseChapters.filter(c => c.module_id === itemId);
                const lessonsInMod = courseLessons.filter(l => chaptersInMod.some(c => c.id === l.chapter_id));
                const progressForMod = studentProgress.filter(p => p.student_id === studentId && lessonsInMod.some(l => l.id === p.lesson_id));
                
                const completedCount = progressForMod.filter(p => p.status === 'completed').length;
                const unlockedCount = progressForMod.filter(p => p.status === 'unlocked').length;

                isCompleted = lessonsInMod.length > 0 && completedCount === lessonsInMod.length;
                isUnlocked = !isCompleted && (completedCount > 0 || unlockedCount > 0);
            }

            let status: 'completed' | 'in_progress' | 'locked' | 'not_allocated' = 'not_allocated';
            if (isAllocated) {
                if (isCompleted) status = 'completed';
                else if (isUnlocked) status = 'in_progress';
                else status = 'locked';
            }

            return {
                studentId,
                name: student.name || 'Student',
                profilePic: student.profile_pic_url,
                status
            };
        });
    }, [students, sessionOverrides, attendanceDate, classroomInventoryAllocations, studentProgress, courseChapters, courseLessons]);

    const getClassSummary = useCallback((
        itemType: 'level' | 'chapter' | 'topic',
        itemId: string
    ): 'not_allocated' | 'locked_for_all' | 'unlocked_for_all' | 'partially_unlocked' | 'in_progress' | 'completed_by_all' => {
        const studentStatuses = getStudentStatuses(itemType, itemId);
        if (studentStatuses.length === 0) return 'not_allocated';

        const allocatedStudents = studentStatuses.filter(s => s.status !== 'not_allocated');
        if (allocatedStudents.length === 0) return 'not_allocated';

        const completedCount = allocatedStudents.filter(s => s.status === 'completed').length;
        const inProgressCount = allocatedStudents.filter(s => s.status === 'in_progress').length;
        const lockedCount = allocatedStudents.filter(s => s.status === 'locked').length;

        if (completedCount === allocatedStudents.length && allocatedStudents.length > 0) {
            return 'completed_by_all';
        }

        if (lockedCount === allocatedStudents.length) {
            return 'locked_for_all';
        }

        if (inProgressCount + completedCount === allocatedStudents.length) {
            return 'unlocked_for_all';
        }

        if (inProgressCount > 0 || completedCount > 0) {
            return 'partially_unlocked';
        }

        return 'locked_for_all';
    }, [getStudentStatuses]);

    const selectedStudentPermissions = useMemo(() => {
        const completed = new Set<string>();
        const unlocked = new Set<string>();

        if (selectedStudentForCurriculum) {
            const studentId = selectedStudentForCurriculum.student_id;
            
            // Map progress status explicitly set for this student
            const progressMap = new Map<string, string>();
            studentProgress.forEach(p => {
                if (p.student_id === studentId) {
                    progressMap.set(p.lesson_id, p.status);
                    if (p.status === 'completed') {
                        completed.add(p.lesson_id);
                        unlocked.add(p.lesson_id);
                    } else if (p.status === 'unlocked') {
                        unlocked.add(p.lesson_id);
                    }
                }
            });
        }

        return {
            completedLessons: completed,
            unlockedLessons: unlocked
        };
    }, [selectedStudentForCurriculum, studentProgress]);

    const getLessonPacingStatus = useCallback((lessonId: string) => {
        let isCompleted = false;
        let isUnlocked = false;
        let statusLabel = "Locked for Class";
        let cardBorder = "border-slate-200/60 dark:border-slate-800/60 bg-slate-50/10 dark:bg-slate-900/[0.02] opacity-70 transition-all duration-300";

        if (curriculumTab === 'individual' && selectedStudentForCurriculum) {
            isCompleted = selectedStudentPermissions.completedLessons.has(lessonId);
            isUnlocked = selectedStudentPermissions.unlockedLessons.has(lessonId);
            if (isCompleted) {
                statusLabel = "Completed";
                cardBorder = "border-emerald-500/30 dark:border-emerald-500/20 bg-emerald-50/[0.1] dark:bg-emerald-950/[0.03] shadow-[0_2px_8px_rgba(16,185,129,0.01)] hover:border-emerald-500/50 transition-all duration-300";
            } else if (isUnlocked) {
                statusLabel = "Unlocked";
                cardBorder = "border-amber-500/30 dark:border-[#ecb613]/25 bg-amber-50/[0.1] dark:bg-[#ecb613]/[0.01] shadow-[0_2px_8px_rgba(245,158,11,0.01)] hover:border-amber-500/50 hover:border-[#ecb613]/50 transition-all duration-300";
            } else {
                statusLabel = "Locked";
            }
        } else {
            const classSummary = getClassSummary('topic', lessonId);
            if (classSummary === 'completed_by_all') {
                statusLabel = "Completed by All";
                cardBorder = "border-emerald-500/30 dark:border-emerald-500/20 bg-emerald-50/[0.1] dark:bg-emerald-950/[0.03] shadow-[0_2px_8px_rgba(16,185,129,0.01)] hover:border-emerald-500/50 transition-all duration-300";
                isCompleted = true;
            } else if (classSummary === 'unlocked_for_all') {
                statusLabel = "Unlocked for Class";
                cardBorder = "border-amber-500/30 dark:border-[#ecb613]/25 bg-amber-50/[0.1] dark:bg-[#ecb613]/[0.01] shadow-[0_2px_8px_rgba(245,158,11,0.01)] hover:border-amber-500/50 hover:border-[#ecb613]/50 transition-all duration-300";
                isUnlocked = true;
            } else if (classSummary === 'in_progress') {
                statusLabel = "In Progress";
                cardBorder = "border-amber-500/30 dark:border-[#ecb613]/25 bg-amber-50/[0.1] dark:bg-[#ecb613]/[0.01] shadow-[0_2px_8px_rgba(245,158,11,0.01)] hover:border-amber-500/50 hover:border-[#ecb613]/50 transition-all duration-300";
                isUnlocked = true;
            } else if (classSummary === 'partially_unlocked') {
                const studentStatuses = getStudentStatuses('topic', lessonId);
                const unlockedCount = studentStatuses.filter(s => s.status === 'in_progress' || s.status === 'completed').length;
                statusLabel = `Unlocked (${unlockedCount}/${studentStatuses.length})`;
                cardBorder = "border-sky-500/30 dark:border-sky-500/25 bg-sky-50/[0.1] dark:bg-sky-950/[0.01] transition-all duration-300";
                isUnlocked = true;
            } else {
                statusLabel = "Locked for Class";
                cardBorder = "border-slate-200/60 dark:border-slate-800/60 bg-slate-50/10 dark:bg-slate-900/[0.02] opacity-70 transition-all duration-300";
                isUnlocked = false;
            }
        }

        const badgeStyle = statusLabel.includes("Completed")
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30"
            : statusLabel.includes("Unlocked") || statusLabel === "In Progress"
            ? "bg-amber-500/10 text-amber-600 dark:text-[#ecb613] border-amber-500/20 dark:border-[#ecb613]/30"
            : statusLabel.includes("Partially") || statusLabel.startsWith("Unlocked (")
            ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 dark:border-sky-500/30"
            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-slate-700/60";

        const textStyle = statusLabel.includes("Completed")
            ? "text-emerald-600 dark:text-emerald-400"
            : statusLabel.includes("Unlocked") || statusLabel === "In Progress"
            ? "text-amber-600 dark:text-[#ecb613]"
            : statusLabel.includes("Partially") || statusLabel.startsWith("Unlocked (")
            ? "text-sky-600 dark:text-sky-400"
            : "text-slate-500 dark:text-slate-400";

        return {
            statusLabel,
            cardBorder,
            badgeStyle,
            textStyle,
            isLocked: !isUnlocked && !isCompleted,
            isUnlocked,
            isCompleted
        };
    }, [curriculumTab, selectedStudentForCurriculum, selectedStudentPermissions, getClassSummary, getStudentStatuses]);

    const getIsLocked = useCallback((itemType: 'level' | 'chapter' | 'topic', itemId: string): boolean => {
        if (curriculumTab === 'individual') {
            if (!selectedStudentForCurriculum) return true;
            const studentId = selectedStudentForCurriculum.student_id;
            
            let lessonsToCheck: string[] = [];
            if (itemType === 'topic') {
                lessonsToCheck = [itemId];
            } else if (itemType === 'chapter') {
                lessonsToCheck = courseLessons.filter(l => l.chapter_id === itemId).map(l => l.id);
            } else {
                const chapters = courseChapters.filter(c => c.module_id === itemId);
                const chapterIds = chapters.map(c => c.id);
                lessonsToCheck = courseLessons.filter(l => chapterIds.includes(l.chapter_id)).map(l => l.id);
            }
            if (lessonsToCheck.length === 0) return false;
            
            return lessonsToCheck.every(lessonId => {
                const prog = studentProgress.find(p => p.student_id === studentId && p.lesson_id === lessonId);
                return !prog || prog.status === 'locked';
            });
        } else {
            const summary = getClassSummary(itemType, itemId);
            return summary === 'locked_for_all' || summary === 'not_allocated';
        }
    }, [curriculumTab, selectedStudentForCurriculum, studentProgress, courseLessons, courseChapters, getClassSummary]);

    const visibleCurriculum = useMemo(() => {
        const query = curriculumSearchQuery.toLowerCase().trim();
        const categoriesMap: Record<string, {
            categoryName: string;
            categoryOrder: number;
            modules: any[];
        }> = {};

        const getCategoryInfo = (moduleObj: any) => {
            const parsed = parseModuleCategory(moduleObj);
            let categoryName = parsed.category || 'Specialized Modules';
            let categoryOrder = 2;

            const cat = categories.find(c => c.name === categoryName);
            if (cat) {
                categoryOrder = cat.category_order;
            } else {
                const initCat = INITIAL_CATEGORIES.find(c => c.name === categoryName);
                if (initCat) categoryOrder = initCat.category_order;
            }
            return { categoryName, categoryOrder };
        };

        courseModules.forEach(mod => {
            const modAlloc = allocatedInventoryItems.find(a => a.inventory_ref_type === 'module' && a.inventory_ref_id === mod.id);

            const { categoryName, categoryOrder } = getCategoryInfo(mod);
            const isCategoryMatch = query ? categoryName.toLowerCase().includes(query) : false;
            const isModuleMatch = query ? mod.title.toLowerCase().includes(query) : false;

            const modChapters = courseChapters.filter(c => c.module_id === mod.id);
            const chapterNodes: any[] = [];

            modChapters.forEach(chap => {
                const chapAlloc = allocatedInventoryItems.find(a => a.inventory_ref_type === 'chapter' && a.inventory_ref_id === chap.id);

                const isChapterMatch = query ? (
                    chap.title.toLowerCase().includes(query) ||
                    `ch${chap.chapter_number}`.includes(query) ||
                    `chapter ${chap.chapter_number}`.includes(query)
                ) : false;

                const chapLessons = courseLessons.filter(l => l.chapter_id === chap.id);
                const lessonNodes: any[] = [];

                chapLessons.forEach(lesson => {
                    const lessonAlloc = allocatedInventoryItems.find(a => a.inventory_ref_type === 'lesson' && a.inventory_ref_id === lesson.id);

                    const isLessonAllocated = !!lessonAlloc || !!chapAlloc || !!modAlloc;

                    if (isLessonAllocated) {
                        const isLessonMatch = query ? (
                            lesson.title.toLowerCase().includes(query) ||
                            (lesson.description || '').toLowerCase().includes(query) ||
                            `topic ${lesson.lesson_number}`.includes(query)
                        ) : false;

                        const matchesSearch = !query || isCategoryMatch || isModuleMatch || isChapterMatch || isLessonMatch;

                        if (matchesSearch) {
                            lessonNodes.push({
                                ...lesson,
                                allocationId: lessonAlloc ? lessonAlloc.id : (chapAlloc ? chapAlloc.id : (modAlloc ? modAlloc.id : null)),
                                isExplicit: !!lessonAlloc
                            });
                        }
                    }
                });

                const isChapterVisible = lessonNodes.length > 0 || !!chapAlloc;

                if (isChapterVisible && (!query || isCategoryMatch || isModuleMatch || isChapterMatch || lessonNodes.length > 0)) {
                    chapterNodes.push({
                        ...chap,
                        allocationId: chapAlloc ? chapAlloc.id : (modAlloc ? modAlloc.id : null),
                        isExplicit: !!chapAlloc,
                        lessons: lessonNodes.sort((a, b) => a.lesson_number - b.lesson_number)
                    });
                }
            });

            const isModuleVisible = chapterNodes.length > 0 || !!modAlloc;

            if (isModuleVisible && (!query || isCategoryMatch || isModuleMatch || chapterNodes.length > 0)) {
                if (!categoriesMap[categoryName]) {
                    categoriesMap[categoryName] = {
                        categoryName,
                        categoryOrder,
                        modules: []
                    };
                }

                categoriesMap[categoryName].modules.push({
                    ...mod,
                    allocationId: modAlloc ? modAlloc.id : null,
                    isExplicit: !!modAlloc,
                    chapters: chapterNodes.sort((a, b) => a.chapter_number - b.chapter_number)
                });
            }
        });

        return Object.values(categoriesMap)
            .sort((a, b) => a.categoryOrder - b.categoryOrder)
            .map(cat => ({
                ...cat,
                modules: cat.modules.sort((a, b) => a.module_number - b.module_number)
            }));
    }, [allocatedInventoryItems, courseModules, courseChapters, courseLessons, categories, curriculumTab, selectedStudentForCurriculum, selectedStudentPermissions, curriculumSearchQuery]);

    const syllabusLessons = useMemo(() => {
        const lessonsSet = new Set<string>();
        const uniqueLessons: any[] = [];

        allocatedInventoryItems.forEach(item => {
            const isIndividualMode = curriculumTab === 'individual';
            
            const filterLesson = (lessonId: string) => {
                if (isIndividualMode && selectedStudentForCurriculum) {
                    const isCompleted = selectedStudentPermissions.completedLessons.has(lessonId);
                    const isUnlocked = selectedStudentPermissions.unlockedLessons.has(lessonId);
                    return isCompleted || isUnlocked;
                }
                return true;
            };

            if (item.inventory_ref_type === 'module') {
                const chapters = courseChapters.filter(c => c.module_id === item.inventory_ref_id);
                const chapterIds = new Set(chapters.map(c => c.id));
                const lessons = courseLessons.filter(l => chapterIds.has(l.chapter_id));
                lessons.forEach(l => {
                    if (!lessonsSet.has(l.id) && filterLesson(l.id)) {
                        lessonsSet.add(l.id);
                        uniqueLessons.push(l);
                    }
                });
            } else if (item.inventory_ref_type === 'chapter') {
                const lessons = courseLessons.filter(l => l.chapter_id === item.inventory_ref_id);
                lessons.forEach(l => {
                    if (!lessonsSet.has(l.id) && filterLesson(l.id)) {
                        lessonsSet.add(l.id);
                        uniqueLessons.push(l);
                    }
                });
            } else if (item.inventory_ref_type === 'lesson') {
                const lesson = courseLessons.find(l => l.id === item.inventory_ref_id);
                if (lesson && !lessonsSet.has(lesson.id) && filterLesson(lesson.id)) {
                    lessonsSet.add(lesson.id);
                    uniqueLessons.push(lesson);
                }
            }
        });

        if (curriculumTab === 'individual' && selectedStudentForCurriculum) {
            studentProgress.forEach(p => {
                if (p.student_id === selectedStudentForCurriculum.student_id && (p.status === 'completed' || p.status === 'unlocked')) {
                    const lesson = courseLessons.find(l => l.id === p.lesson_id);
                    if (lesson && !lessonsSet.has(lesson.id)) {
                        lessonsSet.add(lesson.id);
                        uniqueLessons.push(lesson);
                    }
                }
            });
        }

        return uniqueLessons.sort((a, b) => a.lesson_number - b.lesson_number);
    }, [allocatedInventoryItems, courseChapters, courseLessons, curriculumTab, selectedStudentForCurriculum, selectedStudentPermissions, studentProgress]);

    const getRealStudentProgress = useCallback((studentId: string, defaultMockVal: number) => {
        const studentUnlockedLessons = syllabusLessons.filter(lesson => {
            const row = studentProgress.find(p => p.student_id === studentId && p.lesson_id === lesson.id);
            return row && row.status !== 'locked';
        });

        if (studentUnlockedLessons.length === 0) return 0;

        const completedCount = studentUnlockedLessons.filter(lesson => {
            const row = studentProgress.find(p => p.student_id === studentId && p.lesson_id === lesson.id);
            return row && row.status === 'completed';
        }).length;

        return Math.round((completedCount / studentUnlockedLessons.length) * 100);
    }, [syllabusLessons, studentProgress]);

    const livePreviewData = useMemo(() => {
        if (!selectedStudentForCurriculum) return null;

        const unlockedLessons = syllabusLessons.filter(l => selectedStudentPermissions.unlockedLessons.has(l.id));
        const totalLessons = unlockedLessons.length;
        const completedCount = unlockedLessons.filter(l => selectedStudentPermissions.completedLessons.has(l.id)).length;
        const progressPercentage = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

        const currentlyLearning = syllabusLessons.find(l => 
            selectedStudentPermissions.unlockedLessons.has(l.id) && 
            !selectedStudentPermissions.completedLessons.has(l.id)
        );

        const allocatedTopics = syllabusLessons;

        return {
            progressPercentage,
            currentlyLearning,
            allocatedTopics
        };
    }, [selectedStudentForCurriculum, syllabusLessons, selectedStudentPermissions]);

    const hasAnyVisibleModule = useMemo(() => {
        if (curriculumTab === 'classwide') return true;
        if (!selectedStudentForCurriculum) return false;
        return visibleCurriculum.length > 0;
    }, [curriculumTab, selectedStudentForCurriculum, visibleCurriculum]);

    const handleExpandAllCurriculum = () => {
        setExpandedHeadlines({});
        setExpandedModules({});
        setExpandedChapters({});
    };

    const handleCollapseAllCurriculum = () => {
        const headlines: Record<string, boolean> = {};
        const modules: Record<string, boolean> = {};
        const chapters: Record<string, boolean> = {};

        visibleCurriculum.forEach(group => {
            headlines[group.categoryName] = false;
            group.modules.forEach((mod: any) => {
                modules[mod.id] = false;
                mod.chapters.forEach((chap: any) => {
                    chapters[chap.id] = false;
                });
            });
        });

        setExpandedHeadlines(headlines);
        setExpandedModules(modules);
        setExpandedChapters(chapters);
    };

    const handleToggleTopicLock = async (studentId: string, lessonId: string, newStatus: 'locked' | 'unlocked' | 'completed') => {
        if (!classroomId) return;
        setIsUpdatingProgress(lessonId);

        const fallbackRow = {
            student_id: studentId,
            classroom_id: classroomId,
            lesson_id: lessonId,
            status: newStatus,
            unlocked_by: 'manual',
            unlocked_at: newStatus !== 'locked' ? new Date().toISOString() : null,
            completed_at: newStatus === 'completed' ? new Date().toISOString() : null
        };

        try {
            const { error } = await supabaseAuth
                .from('student_topic_progress')
                .upsert(fallbackRow, {
                    onConflict: 'student_id,lesson_id'
                });
            if (error) {
                console.warn('[Pacing] Individual database upsert failed, using in-memory fallback:', error.message);
                setStudentProgress(prev => {
                    const filtered = prev.filter(p => !(p.student_id === studentId && p.lesson_id === lessonId));
                    return [...filtered, fallbackRow];
                });
            } else {
                const studentIds = [
                    ...students.map(s => s.student_id),
                    ...sessionOverrides.map(o => o.student_id)
                ];
                let progressQuery = supabaseAuth
                    .from('student_topic_progress')
                    .select('*');
                if (studentIds.length > 0) {
                    progressQuery = progressQuery.in('student_id', studentIds);
                } else {
                    progressQuery = progressQuery.eq('classroom_id', classroomId);
                }
                const { data: progressData, error: fetchError } = await progressQuery;
                if (fetchError) throw fetchError;
                setStudentProgress(progressData || []);
            }
        } catch (err: any) {
            console.warn('[Pacing] Individual exception during upsert, using in-memory fallback:', err);
            setStudentProgress(prev => {
                const filtered = prev.filter(p => !(p.student_id === studentId && p.lesson_id === lessonId));
                return [...filtered, fallbackRow];
            });
        } finally {
            setIsUpdatingProgress(null);
        }
    };

    const handleToggleTopicLockClasswide = async (lessonId: string, newStatus: 'locked' | 'unlocked' | 'completed') => {
        if (!classroomId) return;
        setIsUpdatingProgress(lessonId);

        if (activeAttendanceRoster.length === 0) {
            const fallbackRow = {
                student_id: 'classwide_default',
                classroom_id: classroomId,
                lesson_id: lessonId,
                status: newStatus,
                unlocked_by: 'manual',
                unlocked_at: newStatus !== 'locked' ? new Date().toISOString() : null,
                completed_at: newStatus === 'completed' ? new Date().toISOString() : null
            };
            setStudentProgress(prev => {
                const filtered = prev.filter(p => p.lesson_id !== lessonId);
                return [...filtered, fallbackRow];
            });
            setIsUpdatingProgress(null);
            return;
        }

        const rows = activeAttendanceRoster.map(s => {
            const existingRow = studentProgress.find(p => p.student_id === s.student_id && p.lesson_id === lessonId);
            const existingStatus = existingRow ? existingRow.status : 'locked';
            
            let status = newStatus;
            if (newStatus === 'unlocked' && existingStatus === 'completed') {
                status = 'completed';
            }

            return {
                student_id: s.student_id,
                classroom_id: classroomId,
                lesson_id: lessonId,
                status: status,
                unlocked_by: 'manual',
                unlocked_at: status !== 'locked' ? (existingRow?.unlocked_at || new Date().toISOString()) : null,
                completed_at: status === 'completed' ? (existingRow?.completed_at || new Date().toISOString()) : null
            };
        });

        try {
            const { error } = await supabaseAuth
                .from('student_topic_progress')
                .upsert(rows, {
                    onConflict: 'student_id,lesson_id'
                });
            if (error) {
                console.warn('[Pacing] Class-wide database upsert failed, using in-memory fallback:', error.message);
                setStudentProgress(prev => {
                    const filtered = prev.filter(p => p.lesson_id !== lessonId);
                    return [...filtered, ...rows];
                });
            } else {
                const studentIds = [
                    ...students.map(s => s.student_id),
                    ...sessionOverrides.map(o => o.student_id)
                ];
                let progressQuery = supabaseAuth
                    .from('student_topic_progress')
                    .select('*');
                if (studentIds.length > 0) {
                    progressQuery = progressQuery.in('student_id', studentIds);
                } else {
                    progressQuery = progressQuery.eq('classroom_id', classroomId);
                }
                const { data: progressData, error: fetchError } = await progressQuery;
                if (fetchError) throw fetchError;
                setStudentProgress(progressData || []);
            }
        } catch (err: any) {
            console.warn('[Pacing] Class-wide exception during upsert, using in-memory fallback:', err);
            setStudentProgress(prev => {
                const filtered = prev.filter(p => p.lesson_id !== lessonId);
                return [...filtered, ...rows];
            });
        } finally {
            setIsUpdatingProgress(null);
        }
    };

    const handleSaveAllocation = async () => {
        if (!allocationTargetLesson || !classroomId) return;
        setIsSavingAllocation(true);
        const targetId = allocationTargetLesson.id;
        const itemType = allocationTargetItemType;

        const activeStudentIds = [
            ...students.map(s => s.student_id),
            ...sessionOverrides.filter(o => o.override_date === attendanceDate).map(o => o.student_id)
        ];

        let targetStudentIds: string[] = [];
        if (allocationTargetType === 'classwide') {
            targetStudentIds = activeStudentIds;
        } else {
            targetStudentIds = allocationSelectedStudents;
        }

        if (targetStudentIds.length === 0) {
            alert('Please select at least one student.');
            setIsSavingAllocation(false);
            return;
        }

        let affectedLessonIds: string[] = [];
        if (itemType === 'level') {
            const chaptersInMod = courseChapters.filter(c => c.module_id === targetId);
            const chapterIds = chaptersInMod.map(c => c.id);
            const lessonsInMod = courseLessons.filter(l => chapterIds.includes(l.chapter_id));
            affectedLessonIds = lessonsInMod.map(l => l.id);
        } else if (itemType === 'chapter') {
            const lessonsInChap = courseLessons.filter(l => l.chapter_id === targetId);
            affectedLessonIds = lessonsInChap.map(l => l.id);
        } else if (itemType === 'topic') {
            affectedLessonIds = [targetId];
        }

        if (affectedLessonIds.length === 0) {
            alert('No topics found in this item.');
            setIsSavingAllocation(false);
            return;
        }

        const itemTypeName = itemType === 'level' ? 'level' : itemType === 'chapter' ? 'chapter' : 'topic';

        if (allocationStatus === 'completed') {
            if (allocationTargetType === 'classwide') {
                targetStudentIds = targetStudentIds.filter(studentId => {
                    const statuses = getStudentStatuses(itemType, targetId);
                    const match = statuses.find(s => s.studentId === studentId);
                    return match && match.status !== 'not_allocated';
                });

                if (targetStudentIds.length === 0) {
                    alert(`No students in this class have this ${itemTypeName} allocated to them.`);
                    setIsSavingAllocation(false);
                    return;
                }
            }
        }

        try {
            const rows: any[] = [];
            targetStudentIds.forEach(studentId => {
                affectedLessonIds.forEach(lessonId => {
                    if (allocationStatus === 'completed') {
                        const isAlloc = getStudentStatuses('topic', lessonId).find(s => s.studentId === studentId)?.status !== 'not_allocated';
                        if (!isAlloc) return;
                    }

                    const existingRow = studentProgress.find(p => p.student_id === studentId && p.lesson_id === lessonId);
                    rows.push({
                        student_id: studentId,
                        classroom_id: classroomId,
                        lesson_id: lessonId,
                        status: allocationStatus,
                        unlocked_by: 'manual',
                        unlocked_at: allocationStatus !== 'locked' ? (existingRow?.unlocked_at || new Date().toISOString()) : null,
                        completed_at: allocationStatus === 'completed' ? (existingRow?.completed_at || new Date().toISOString()) : null
                    });
                });
            });

            if (rows.length === 0) {
                alert('No student topic progress records to update.');
                setIsSavingAllocation(false);
                return;
            }

            const { error } = await supabaseAuth
                .from('student_topic_progress')
                .upsert(rows, {
                    onConflict: 'student_id,lesson_id'
                });

            if (error) {
                console.warn('[Pacing] Database upsert failed, updating in-memory only:', error.message);
                setStudentProgress(prev => {
                    const affectedPairs = new Set(rows.map(r => `${r.student_id}_${r.lesson_id}`));
                    const filtered = prev.filter(p => !affectedPairs.has(`${p.student_id}_${p.lesson_id}`));
                    return [...filtered, ...rows];
                });
            } else {
                const studentIds = [
                    ...students.map(s => s.student_id),
                    ...sessionOverrides.map(o => o.student_id)
                ];
                let progressQuery = supabaseAuth
                    .from('student_topic_progress')
                    .select('*');
                if (studentIds.length > 0) {
                    progressQuery = progressQuery.in('student_id', studentIds);
                } else {
                    progressQuery = progressQuery.eq('classroom_id', classroomId);
                }
                const { data: progressData, error: fetchError } = await progressQuery;
                if (fetchError) throw fetchError;
                setStudentProgress(progressData || []);
            }
            alert('Pacing allocations updated successfully!');
            setIsAllocationDrawerOpen(false);
        } catch (err: any) {
            console.error('Error saving pacing allocations:', err);
            alert(`Failed to save pacing allocations: ${err.message || err}`);
        } finally {
            setIsSavingAllocation(false);
        }
    };

    const handleUpdatePacingState = async (
        targetType: 'level' | 'chapter' | 'topic',
        targetId: string,
        newStatus: 'locked' | 'unlocked' | 'completed',
        forcedScope?: 'classwide' | 'individual'
    ) => {
        if (!classroomId) return;

        const activeStudentIds = [
            ...students.map(s => s.student_id),
            ...sessionOverrides.filter(o => o.override_date === attendanceDate).map(o => o.student_id)
        ];

        const effectiveTab = forcedScope || curriculumTab;
        let targetStudentIds: string[] = [];
        if (effectiveTab === 'classwide') {
            targetStudentIds = activeStudentIds;
        } else {
            if (!selectedStudentForCurriculum) {
                alert('Please select a student first.');
                return;
            }
            targetStudentIds = [selectedStudentForCurriculum.student_id];
        }

        if (targetStudentIds.length === 0) {
            alert('No active students to update.');
            return;
        }

        let affectedLessonIds: string[] = [];
        if (targetType === 'level') {
            const chaptersInMod = courseChapters.filter(c => c.module_id === targetId);
            const chapterIds = chaptersInMod.map(c => c.id);
            const lessonsInMod = courseLessons.filter(l => chapterIds.includes(l.chapter_id));
            affectedLessonIds = lessonsInMod.map(l => l.id);
        } else if (targetType === 'chapter') {
            const lessonsInChap = courseLessons.filter(l => l.chapter_id === targetId);
            affectedLessonIds = lessonsInChap.map(l => l.id);
        } else if (targetType === 'topic') {
            affectedLessonIds = [targetId];
        }

        if (affectedLessonIds.length === 0) {
            return;
        }

        if (newStatus === 'completed') {
            if (curriculumTab === 'classwide') {
                targetStudentIds = targetStudentIds.filter(studentId => {
                    const statuses = getStudentStatuses(targetType, targetId);
                    const match = statuses.find(s => s.studentId === studentId);
                    return match && match.status !== 'not_allocated';
                });

                if (targetStudentIds.length === 0) {
                    alert('No students in this class have this item allocated to them.');
                    return;
                }
            }
        }

        setIsUpdatingProgress(targetId);

        const rows: any[] = [];
        targetStudentIds.forEach(studentId => {
            affectedLessonIds.forEach(lessonId => {
                if (newStatus === 'completed') {
                    const isAlloc = getStudentStatuses('topic', lessonId).find(s => s.studentId === studentId)?.status !== 'not_allocated';
                    if (!isAlloc) return;
                }

                const existingRow = studentProgress.find(p => p.student_id === studentId && p.lesson_id === lessonId);
                const existingStatus = existingRow ? existingRow.status : 'locked';

                let status = newStatus;
                if (newStatus === 'unlocked' && existingStatus === 'completed') {
                    status = 'completed';
                }

                rows.push({
                    student_id: studentId,
                    classroom_id: classroomId,
                    lesson_id: lessonId,
                    status: status,
                    unlocked_by: 'manual',
                    unlocked_at: status !== 'locked' ? (existingRow?.unlocked_at || new Date().toISOString()) : null,
                    completed_at: status === 'completed' ? (existingRow?.completed_at || new Date().toISOString()) : null
                });
            });
        });

        if (rows.length === 0) {
            setIsUpdatingProgress(null);
            return;
        }

        try {
            const { error } = await supabaseAuth
                .from('student_topic_progress')
                .upsert(rows, {
                    onConflict: 'student_id,lesson_id'
                });

            if (error) {
                console.warn('[Pacing] Database upsert failed, updating in-memory only:', error.message);
                setStudentProgress(prev => {
                    const affectedPairs = new Set(rows.map(r => `${r.student_id}_${r.lesson_id}`));
                    const filtered = prev.filter(p => !affectedPairs.has(`${p.student_id}_${p.lesson_id}`));
                    return [...filtered, ...rows];
                });
            } else {
                const studentIds = [
                    ...students.map(s => s.student_id),
                    ...sessionOverrides.map(o => o.student_id)
                ];
                let progressQuery = supabaseAuth
                    .from('student_topic_progress')
                    .select('*');
                if (studentIds.length > 0) {
                    progressQuery = progressQuery.in('student_id', studentIds);
                } else {
                    progressQuery = progressQuery.eq('classroom_id', classroomId);
                }
                const { data: progressData, error: fetchError } = await progressQuery;
                if (fetchError) throw fetchError;
                setStudentProgress(progressData || []);
            }
        } catch (err: any) {
            console.error('Error saving pacing allocations:', err);
            alert(`Failed to save pacing allocations: ${err.message || err}`);
        } finally {
            setIsUpdatingProgress(null);
        }
    };

    const handleAllocateItem = async (
        type: 'module' | 'chapter' | 'lesson',
        id: string,
        title: string,
        description: string
    ) => {
        if (!classroomId || !teacherProfile) return;

        const activeStudentIds = [
            ...students.map(s => s.student_id),
            ...sessionOverrides.filter(o => o.override_date === attendanceDate).map(o => o.student_id)
        ];

        if (activeStudentIds.length === 0) {
            alert('No active students in this classroom to allocate to.');
            return;
        }

        let targetStudentIds: string[] = [];
        if (curriculumTab === 'classwide') {
            targetStudentIds = activeStudentIds;
        } else {
            if (!selectedStudentForCurriculum) {
                alert('Please select a student first.');
                return;
            }
            targetStudentIds = [selectedStudentForCurriculum.student_id];
        }

        let allocateChapters = false;
        let allocateLessons = false;

        if (type === 'module') {
            // Allocating from Level (module) automatically allocates all chapters and lessons under it.
            allocateChapters = true;
            allocateLessons = true;
        } else if (type === 'chapter') {
            // Allocating from Chapter automatically allocates all topics/lessons inside it.
            allocateLessons = true;
        }

        setImportingItemId(id);
        try {
            const itemsToAllocate: { refType: 'module' | 'chapter' | 'lesson'; refId: string }[] = [
                { refType: type, refId: id }
            ];

            if (type === 'module' && allocateChapters) {
                const chapters = courseChapters.filter(c => c.module_id === id);
                chapters.forEach(c => {
                    itemsToAllocate.push({ refType: 'chapter', refId: c.id });
                    if (allocateLessons) {
                        const lessons = courseLessons.filter(l => l.chapter_id === c.id);
                        lessons.forEach(l => {
                            itemsToAllocate.push({ refType: 'lesson', refId: l.id });
                        });
                    }
                });
            } else if (type === 'chapter' && allocateLessons) {
                const lessons = courseLessons.filter(l => l.chapter_id === id);
                lessons.forEach(l => {
                    itemsToAllocate.push({ refType: 'lesson', refId: l.id });
                });
            }

            const insertRows: any[] = [];

            if (curriculumTab === 'classwide') {
                // 1. Insert classwide allocations (allocated_to_student_id: null)
                itemsToAllocate.forEach(item => {
                    const isAlreadyClasswide = classroomInventoryAllocations.some(a => {
                        const sameId = a.module_id === item.refId || a.chapter_id === item.refId || a.lesson_id === item.refId;
                        return sameId && a.classroom_id === classroomId && !a.allocated_to_student_id;
                    });
                    if (!isAlreadyClasswide) {
                        const row: any = {
                            classroom_id: classroomId,
                            allocated_by: teacherProfile.id,
                            allocated_to_student_id: null
                        };
                        if (item.refType === 'module') row.module_id = item.refId;
                        else if (item.refType === 'chapter') row.chapter_id = item.refId;
                        else if (item.refType === 'lesson') row.lesson_id = item.refId;
                        insertRows.push(row);
                    }
                });

                // 2. Insert for active enrolled students
                targetStudentIds.forEach(studentId => {
                    itemsToAllocate.forEach(item => {
                        const isAlready = classroomInventoryAllocations.some(a => {
                            const sameId = a.module_id === item.refId || a.chapter_id === item.refId || a.lesson_id === item.refId;
                            return sameId && a.allocated_to_student_id === studentId;
                        });
                        if (!isAlready) {
                            const row: any = {
                                classroom_id: classroomId,
                                allocated_by: teacherProfile.id,
                                allocated_to_student_id: studentId
                            };
                            if (item.refType === 'module') row.module_id = item.refId;
                            else if (item.refType === 'chapter') row.chapter_id = item.refId;
                            else if (item.refType === 'lesson') row.lesson_id = item.refId;
                            insertRows.push(row);
                        }
                    });
                });
            } else {
                // Individual student allocation
                targetStudentIds.forEach(studentId => {
                    itemsToAllocate.forEach(item => {
                        const isAlready = classroomInventoryAllocations.some(a => {
                            const sameId = a.module_id === item.refId || a.chapter_id === item.refId || a.lesson_id === item.refId;
                            return sameId && a.allocated_to_student_id === studentId;
                        });
                        if (!isAlready) {
                            const row: any = {
                                classroom_id: classroomId,
                                allocated_by: teacherProfile.id,
                                allocated_to_student_id: studentId
                            };
                            if (item.refType === 'module') row.module_id = item.refId;
                            else if (item.refType === 'chapter') row.chapter_id = item.refId;
                            else if (item.refType === 'lesson') row.lesson_id = item.refId;
                            insertRows.push(row);
                        }
                    });
                });
            }

            if (insertRows.length > 0) {
                const { error } = await supabaseAuth
                    .from('classroom_inventory_allocation')
                    .insert(insertRows);
                if (error) throw error;

                // Also insert default locked progress records for all allocated lessons for active students
                const lessonItems = itemsToAllocate.filter(i => i.refType === 'lesson');
                const progressRows: any[] = [];
                targetStudentIds.forEach(studentId => {
                    lessonItems.forEach(item => {
                        const existing = studentProgress.find(p => p.student_id === studentId && p.lesson_id === item.refId);
                        if (!existing) {
                            progressRows.push({
                                student_id: studentId,
                                classroom_id: classroomId,
                                lesson_id: item.refId,
                                status: 'locked',
                                unlocked_by: 'system',
                                unlocked_at: null,
                                completed_at: null
                            });
                        }
                    });
                });

                if (progressRows.length > 0) {
                    const { error: progErr } = await supabaseAuth
                        .from('student_topic_progress')
                        .upsert(progressRows, { onConflict: 'student_id,lesson_id' });
                    if (progErr) {
                        console.warn('Could not insert default locked progress:', progErr.message);
                    }
                }
            }

            await fetchCurriculumAllocations();
        } catch (err) {
            console.error('Failed to allocate item:', err);
            alert('Failed to allocate item from inventory.');
        } finally {
            setImportingItemId(null);
        }
    };

    const handleDeallocateItem = async (typeOrId: 'level' | 'chapter' | 'topic' | string, itemParam?: any) => {
        let type: 'level' | 'chapter' | 'topic' = 'topic';
        let item: any = itemParam;

        if (typeOrId === 'level' || typeOrId === 'chapter' || typeOrId === 'topic') {
            type = typeOrId;
        } else {
            // fallback for passing an ID string
            const alloc = classroomInventoryAllocations.find(a => a.id === typeOrId);
            if (alloc) {
                if (alloc.module_id) {
                    type = 'level';
                    item = courseModules.find(m => m.id === alloc.module_id) || { id: alloc.module_id };
                } else if (alloc.chapter_id) {
                    type = 'chapter';
                    item = courseChapters.find(c => c.id === alloc.chapter_id) || { id: alloc.chapter_id };
                } else if (alloc.lesson_id) {
                    type = 'topic';
                    item = courseLessons.find(l => l.id === alloc.lesson_id) || { id: alloc.lesson_id };
                }
            } else {
                item = { id: typeOrId };
            }
        }

        if (!item || !item.id) return;

        const itemName = item.title || (type === 'level' ? 'Level' : (type === 'chapter' ? 'Chapter' : 'Topic'));
        if (!window.confirm(`Are you sure you want to remove "${itemName}" from this classroom?`)) return;

        const itemId = item.id;
        setDeletingAssignmentId(itemId);

        try {
            const isIndividual = curriculumTab === 'individual' && selectedStudentForCurriculum;
            const targetStudentIds = isIndividual 
                ? [selectedStudentForCurriculum.student_id] 
                : students.map(s => s.student_id);

            let affectedLessonIds: string[] = [];
            const rowsToInsert: any[] = [];
            const allocIdsToDelete: string[] = [];

            if (type === 'level') {
                const chaps = courseChapters.filter(c => c.module_id === itemId);
                const chapIds = chaps.map(c => c.id);
                const lessons = courseLessons.filter(l => chapIds.includes(l.chapter_id));
                affectedLessonIds = lessons.map(l => l.id);

                classroomInventoryAllocations.forEach(a => {
                    if (isIndividual && a.allocated_to_student_id && a.allocated_to_student_id !== selectedStudentForCurriculum.student_id) return;
                    if (a.module_id === itemId || (a.chapter_id && chapIds.includes(a.chapter_id)) || (a.lesson_id && affectedLessonIds.includes(a.lesson_id))) {
                        allocIdsToDelete.push(a.id);
                    }
                });
            } else if (type === 'chapter') {
                const chap = courseChapters.find(c => c.id === itemId);
                const parentModuleId = chap?.module_id;
                const lessons = courseLessons.filter(l => l.chapter_id === itemId);
                affectedLessonIds = lessons.map(l => l.id);

                // If parent module was allocated directly, explode into remaining sibling chapters
                if (parentModuleId) {
                    const siblingChapters = courseChapters.filter(c => c.module_id === parentModuleId && c.id !== itemId);
                    const parentModAllocs = classroomInventoryAllocations.filter(a => {
                        if (isIndividual && a.allocated_to_student_id && a.allocated_to_student_id !== selectedStudentForCurriculum.student_id) return false;
                        return a.module_id === parentModuleId;
                    });

                    parentModAllocs.forEach(parentAlloc => {
                        allocIdsToDelete.push(parentAlloc.id);
                        siblingChapters.forEach(sc => {
                            rowsToInsert.push({
                                classroom_id: classroomId,
                                chapter_id: sc.id,
                                allocated_by: teacherProfile.id,
                                allocated_to_student_id: parentAlloc.allocated_to_student_id || null
                            });
                        });
                    });
                }

                classroomInventoryAllocations.forEach(a => {
                    if (isIndividual && a.allocated_to_student_id && a.allocated_to_student_id !== selectedStudentForCurriculum.student_id) return;
                    if (a.chapter_id === itemId || (a.lesson_id && affectedLessonIds.includes(a.lesson_id))) {
                        allocIdsToDelete.push(a.id);
                    }
                });
            } else {
                // Topic / Lesson
                affectedLessonIds = [itemId];
                const les = courseLessons.find(l => l.id === itemId);
                const parentChapId = les?.chapter_id;
                const parentChap = courseChapters.find(c => c.id === parentChapId);
                const parentModuleId = parentChap?.module_id;

                // If parent chapter was allocated directly, explode into remaining sibling lessons
                if (parentChapId) {
                    const siblingLessons = courseLessons.filter(l => l.chapter_id === parentChapId && l.id !== itemId);
                    const parentChapAllocs = classroomInventoryAllocations.filter(a => {
                        if (isIndividual && a.allocated_to_student_id && a.allocated_to_student_id !== selectedStudentForCurriculum.student_id) return false;
                        return a.chapter_id === parentChapId;
                    });

                    parentChapAllocs.forEach(parentAlloc => {
                        allocIdsToDelete.push(parentAlloc.id);
                        siblingLessons.forEach(sl => {
                            rowsToInsert.push({
                                classroom_id: classroomId,
                                lesson_id: sl.id,
                                allocated_by: teacherProfile.id,
                                allocated_to_student_id: parentAlloc.allocated_to_student_id || null
                            });
                        });
                    });
                }

                // If parent module was allocated directly, explode into remaining chapters and sibling lessons
                if (parentModuleId && parentChapId) {
                    const siblingChapters = courseChapters.filter(c => c.module_id === parentModuleId && c.id !== parentChapId);
                    const siblingLessons = courseLessons.filter(l => l.chapter_id === parentChapId && l.id !== itemId);
                    const parentModAllocs = classroomInventoryAllocations.filter(a => {
                        if (isIndividual && a.allocated_to_student_id && a.allocated_to_student_id !== selectedStudentForCurriculum.student_id) return false;
                        return a.module_id === parentModuleId;
                    });

                    parentModAllocs.forEach(parentAlloc => {
                        allocIdsToDelete.push(parentAlloc.id);
                        siblingChapters.forEach(sc => {
                            rowsToInsert.push({
                                classroom_id: classroomId,
                                chapter_id: sc.id,
                                allocated_by: teacherProfile.id,
                                allocated_to_student_id: parentAlloc.allocated_to_student_id || null
                            });
                        });
                        siblingLessons.forEach(sl => {
                            rowsToInsert.push({
                                classroom_id: classroomId,
                                lesson_id: sl.id,
                                allocated_by: teacherProfile.id,
                                allocated_to_student_id: parentAlloc.allocated_to_student_id || null
                            });
                        });
                    });
                }

                classroomInventoryAllocations.forEach(a => {
                    if (isIndividual && a.allocated_to_student_id && a.allocated_to_student_id !== selectedStudentForCurriculum.student_id) return;
                    if (a.lesson_id === itemId) {
                        allocIdsToDelete.push(a.id);
                    }
                });
            }

            // 1. Delete matching allocations from database
            if (allocIdsToDelete.length > 0) {
                await supabaseAuth
                    .from('classroom_inventory_allocation')
                    .delete()
                    .in('id', allocIdsToDelete);
            }

            // 2. Insert any exploded replacement allocations (e.g. remaining topics in chapter)
            if (rowsToInsert.length > 0) {
                await supabaseAuth
                    .from('classroom_inventory_allocation')
                    .insert(rowsToInsert);
            }

            // 3. Delete progress for affected lessons
            if (affectedLessonIds.length > 0) {
                if (targetStudentIds.length > 0) {
                    await supabaseAuth
                        .from('student_topic_progress')
                        .delete()
                        .in('student_id', targetStudentIds)
                        .in('lesson_id', affectedLessonIds);
                }
                await supabaseAuth
                    .from('student_topic_progress')
                    .delete()
                    .eq('classroom_id', classroomId)
                    .in('lesson_id', affectedLessonIds);
            }

            // 4. Also delete student session overrides
            try {
                if (affectedLessonIds.length > 0 && targetStudentIds.length > 0) {
                    await supabaseAuth
                        .from('session_student_overrides')
                        .delete()
                        .in('student_id', targetStudentIds)
                        .in('lesson_id', affectedLessonIds);
                }
            } catch (e) {
                // ignore
            }

            // 5. Update local studentProgress state
            if (affectedLessonIds.length > 0) {
                setStudentProgress(prev => prev.filter(p => {
                    if (isIndividual) {
                        if (p.student_id === selectedStudentForCurriculum.student_id && affectedLessonIds.includes(p.lesson_id)) {
                            return false;
                        }
                        return true;
                    }
                    if (targetStudentIds.includes(p.student_id) && affectedLessonIds.includes(p.lesson_id)) {
                        return false;
                    }
                    if (p.classroom_id === classroomId && affectedLessonIds.includes(p.lesson_id)) {
                        return false;
                    }
                    return true;
                }));
            }

            // 6. Refresh allocations from DB
            await fetchCurriculumAllocations();
        } catch (err: any) {
            console.error('Error deallocating item:', err);
            alert(`Failed to remove item: ${err?.message || err}`);
        } finally {
            setDeletingAssignmentId(null);
        }
    };

    const handleSaveMetadata = async () => {
        if (!metadataForm.name.trim()) {
            setMetadataError('Class name is required.');
            return;
        }
        if (classroom?.type === 'temporary') {
            if ((metadataForm as any).end_time <= (metadataForm as any).start_time) {
                setMetadataError('End time must be after start time.');
                return;
            }
        }
        setIsSavingMetadata(true);
        setMetadataError('');
        setMetadataSaved(false);
        try {
            const formatTag = `[delivery_format:${(metadataForm as any).delivery_format || 'offline'}]`;
            const finalDesc = `${metadataForm.description.trim()} ${formatTag}`;

            let { error } = await supabaseAuth
                .from('classrooms')
                .update({
                    name: metadataForm.name.trim(),
                    description: finalDesc,
                    status: metadataForm.status,
                })
                .eq('id', classroomId);

            if (error && (error.message?.includes('status') && (error.message?.includes('schema cache') || error.message?.includes('does not exist') || error.code === 'PGRST205'))) {
                const retryResult = await supabaseAuth
                    .from('classrooms')
                    .update({
                        name: metadataForm.name.trim(),
                        description: finalDesc,
                    })
                    .eq('id', classroomId);
                error = retryResult.error;
            }

            if (error) throw error;

            if (classroom?.type === 'temporary') {
                const { error: tempErr } = await supabaseAuth
                    .from('temporary_classes')
                    .update({
                        title: metadataForm.name.trim(),
                        class_date: (metadataForm as any).class_date,
                        start_time: (metadataForm as any).start_time,
                        end_time: (metadataForm as any).end_time,
                    })
                    .eq('classroom_id', classroomId);
                
                if (tempErr) throw tempErr;
            }

            setClassroom(prev => prev ? {
                ...prev,
                name: metadataForm.name.trim(),
                description: metadataForm.description.trim(),
                status: metadataForm.status,
                class_date: classroom?.type === 'temporary' ? (metadataForm as any).class_date : prev.class_date,
                start_time: classroom?.type === 'temporary' ? (metadataForm as any).start_time : prev.start_time,
                end_time: classroom?.type === 'temporary' ? (metadataForm as any).end_time : prev.end_time,
            } : prev);

            setMetadataSaved(true);
            setTimeout(() => setMetadataSaved(false), 3000);
        } catch (err: any) {
            console.error('Error saving metadata:', err);
            setMetadataError(err.message || 'Failed to save changes. Please try again.');
        } finally {
            setIsSavingMetadata(false);
        }
    };

    const formatTime12hr = (time24: string) => {
        if (!time24) return '';
        const [h, m] = time24.split(':');
        let hours = parseInt(h, 10);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        return `${hours}:${m} ${ampm}`;
    };

    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

    const totalPages = Math.ceil(students.length / PAGE_SIZE);
    const paginatedStudents = students.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const avgAttendance = useMemo(() => {
        if (!classroomAttendance || classroomAttendance.length === 0) {
            return '100.0';
        }
        const presentOrLateCount = classroomAttendance.filter(
            att => att.status === 'present' || att.status === 'late'
        ).length;
        return ((presentOrLateCount / classroomAttendance.length) * 100).toFixed(1);
    }, [classroomAttendance]);

    const filteredDirectory = useMemo(() => {
        if (!directorySearch.trim()) return directoryStudents;
        const q = directorySearch.toLowerCase();
        return directoryStudents.filter(s => s.name.toLowerCase().includes(q));
    }, [directoryStudents, directorySearch]);

    if (loading || !classroom) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8f8f6] dark:bg-[#221d10]">
                <Loader2 className="w-10 h-10 animate-spin text-[#ecb613] mb-4" />
                <p className="font-medium text-slate-650 tracking-wide uppercase text-xs">Loading Classroom Dashboard...</p>
            </div>
        );
    }

    const handleSaveSchedule = async () => {
        if (!classroomId) return;

        const isDuplicate = schedules.some(s =>
            s.day_of_week === newSchedule.day &&
            s.start_time.startsWith(newSchedule.start)
        );

        if (isDuplicate) {
            alert('This schedule slot already exists for this class.');
            return;
        }

        setIsSavingSchedule(true);
        try {
            const { data, error } = await supabaseAuth
                .from('batch_schedules')
                .insert([{
                    classroom_id: classroomId,
                    day_of_week: newSchedule.day,
                    start_time: newSchedule.start,
                    end_time: newSchedule.end
                }])
                .select();

            if (error) {
                if (error.code === '23505') {
                    alert('This schedule slot already exists.');
                    return;
                }
                throw error;
            }

            if (data) {
                setSchedules(prev => [...prev, data[0]].sort((a, b) => a.day_of_week - b.day_of_week));
                setNewSchedule({ day: 0, start: '09:00', end: '10:30' });
            }
        } catch (err) {
            console.error('Error saving schedule:', err);
            alert('Failed to save schedule');
        } finally {
            setIsSavingSchedule(false);
        }
    };

    const handleDeleteSchedule = async (id: string) => {
        try {
            const { error } = await supabaseAuth
                .from('batch_schedules')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setSchedules(prev => prev.filter(s => s.id !== id));
        } catch (err) {
            console.error('Error deleting schedule:', err);
            alert('Failed to delete schedule');
        }
    };

    return (
        <div className="flex min-h-screen bg-[#f8f8f6] dark:bg-[#221d10] text-slate-905 dark:text-slate-100 font-sans">
            
            {/* ── Add from Directory Modal ─────────────────────────────────────── */}
            {showDirectoryModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-205 dark:border-slate-800 w-full max-w-lg flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[#ecb613]/10 flex items-center justify-center">
                                    <UserPlus className="w-5 h-5 text-[#ecb613]" />
                                </div>
                                <div className="text-left">
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Add from Student Directory</h3>
                                    <p className="text-xs text-slate-500">Select students to enroll in <span className="font-semibold">{classroom?.name}</span></p>
                                </div>
                            </div>
                            <button onClick={() => setShowDirectoryModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-655 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-405" />
                                <input
                                    type="text"
                                    placeholder="Search students..."
                                    value={directorySearch}
                                    onChange={e => setDirectorySearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#ecb613]/25 focus:border-[#ecb613] outline-none transition-all text-slate-800 dark:text-slate-100"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5 custom-scrollbar">
                            {directoryLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-7 h-7 animate-spin text-[#ecb613]" />
                                </div>
                            ) : filteredDirectory.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
                                    <p className="text-sm font-semibold text-slate-500">
                                        {directoryStudents.length === 0
                                            ? 'All your students are already in this classroom.'
                                            : 'No students match your search.'}
                                    </p>
                                    {directoryStudents.length === 0 && (
                                        <Link
                                            href="/teacher-dashboard/students/add"
                                            className="mt-3 text-xs font-bold text-[#ecb613] hover:underline"
                                        >
                                            + Add a new student to your directory
                                        </Link>
                                    )}
                                </div>
                            ) : (
                                filteredDirectory.map(s => {
                                    const isSelected = selectedToAdd.has(s.id);
                                    return (
                                        <button
                                            key={s.id}
                                            onClick={() => setSelectedToAdd(prev => {
                                                const next = new Set(prev);
                                                isSelected ? next.delete(s.id) : next.add(s.id);
                                                return next;
                                            })}
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left cursor-pointer ${
                                                isSelected
                                                    ? 'border-[#ecb613] bg-[#ecb613]/5 dark:bg-[#ecb613]/10'
                                                    : 'border-slate-100 dark:border-slate-800 hover:border-slate-205 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                            }`}
                                        >
                                            <div className="w-10 h-10 rounded-full bg-[#ecb613]/10 flex items-center justify-center overflow-hidden border-2 border-white dark:border-slate-800 shadow-sm flex-shrink-0">
                                                {s.profile_pic_url ? (
                                                    <img src={s.profile_pic_url} alt={s.name || 'Student'} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-sm font-bold text-[#ecb613]">{(s.name || 'S').charAt(0)}</span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0 text-left">
                                                <p className="text-sm font-bold text-slate-905 dark:text-white truncate">{s.name}</p>
                                                {s.is_online && (
                                                    <p className="text-xs text-slate-500 flex items-center">
                                                        <span className="inline-block w-1.5 h-1.5 rounded-full mr-1 bg-green-500 animate-pulse" />
                                                        Active
                                                    </p>
                                                )}
                                            </div>
                                            <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                                                isSelected
                                                    ? 'bg-[#ecb613] border-[#ecb613]'
                                                    : 'border-slate-300 dark:border-slate-600'
                                            }`}>
                                                {isSelected && (
                                                    <svg className="w-3 h-3 text-slate-900" fill="none" viewBox="0 0 12 12">
                                                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-shrink-0">
                            <span className="text-xs font-semibold text-slate-500">
                                {selectedToAdd.size > 0 ? `${selectedToAdd.size} student${selectedToAdd.size !== 1 ? 's' : ''} selected` : 'Click students to select'}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowDirectoryModal(false)}
                                    className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-205 dark:hover:bg-slate-705 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddStudents}
                                    disabled={selectedToAdd.size === 0 || isAddingStudents}
                                    className="px-4 py-2 rounded-lg text-sm font-bold bg-[#ecb613] text-slate-900 hover:bg-[#ecb613]/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                                >
                                    {isAddingStudents ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                                    {isAddingStudents ? 'Adding...' : `Add ${selectedToAdd.size > 0 ? selectedToAdd.size : ''} to Class`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Schedule Makeup Modal ─────────────────────────────────────────── */}
            {showOverrideModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-205 dark:border-slate-800 w-full max-w-md flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-600">
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                        {editingOverrideId ? 'Reschedule Makeup Allocation' : 'Schedule Makeup Allocation'}
                                    </h3>
                                    <p className="text-xs text-slate-505">
                                        {editingOverrideId ? 'Update details or reschedule class date' : 'Allocate a temporary student for a specific date'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowOverrideModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {isOverrideRosterLoading ? (
                                <div className="flex flex-col items-center justify-center py-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-emerald-605 mb-2" />
                                    <p className="text-xs text-slate-500 font-bold">Loading available students...</p>
                                </div>
                            ) : directoryStudentsForOverride.length === 0 ? (
                                <div className="text-center py-6">
                                    <p className="text-sm font-medium text-slate-505">No other students available.</p>
                                    <p className="text-xs text-slate-400 mt-1">All your students are already permanently enrolled in this classroom.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="text-left">
                                        <label className="block text-xs font-bold text-slate-505 dark:text-slate-400 uppercase tracking-wider mb-2">Select Student</label>
                                        <select
                                            value={overrideForm.studentId}
                                            onChange={e => setOverrideForm(f => ({ ...f, studentId: e.target.value }))}
                                            disabled={!!editingOverrideId}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all cursor-pointer text-slate-800 dark:text-slate-100"
                                        >
                                            {directoryStudentsForOverride.map(s => (
                                                <option key={s.id} value={s.id}>{s.name} ({s.level || 'Beginner'})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="text-left">
                                        <label className="block text-xs font-bold text-slate-505 dark:text-slate-400 uppercase tracking-wider mb-2">Class Session Date</label>
                                        <input
                                            type="date"
                                            value={overrideForm.date}
                                            onChange={e => setOverrideForm(f => ({ ...f, date: e.target.value }))}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-slate-800 dark:text-slate-100"
                                        />
                                    </div>
                                    <div className="text-left">
                                        <label className="block text-xs font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider mb-2">Reason / Private Notes</label>
                                        <textarea
                                            value={overrideForm.reason}
                                            onChange={e => setOverrideForm(f => ({ ...f, reason: e.target.value }))}
                                            placeholder="e.g. Makeup session for missed class on Monday"
                                            rows={3}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all resize-none text-slate-800 dark:text-slate-100"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                            <button
                                onClick={() => setShowOverrideModal(false)}
                                className="px-4 py-2 text-sm font-semibold text-slate-655 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveOverride}
                                disabled={isSavingOverride || directoryStudentsForOverride.length === 0}
                                className="px-5 py-2 text-sm font-bold bg-[#ecb613] text-slate-900 hover:bg-amber-500 shadow-md shadow-amber-500/10 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                            >
                                {isSavingOverride ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                {isSavingOverride ? 'Saving...' : editingOverrideId ? 'Save Changes' : 'Confirm Makeup'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Message to Class Modal ─────────────────────────────────────────── */}
            {showMessageModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-205 dark:border-slate-800 w-full max-w-lg flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 text-left">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[#ecb613]/10 flex items-center justify-center">
                                    <MessageSquare className="w-5 h-5 text-[#ecb613]" />
                                </div>
                                <div className="text-left">
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Message All Students</h3>
                                    <p className="text-xs text-slate-500">Send an announcement broadcast to <span className="font-semibold">{classroom?.name}</span></p>
                                </div>
                            </div>
                            <button onClick={() => setShowMessageModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            if (!messageContent.trim() || !messageSubject.trim()) return;
                            const success = await handleSendClassMessageAction();
                            if (success) {
                                setShowMessageModal(false);
                            }
                        }} className="p-6 space-y-4 overflow-y-auto">
                            <div>
                                <label className="block text-xs font-black text-slate-505 uppercase tracking-wide mb-2">Subject</label>
                                <input
                                    type="text"
                                    value={messageSubject}
                                    onChange={(e) => setMessageSubject(e.target.value)}
                                    placeholder="e.g. Important Class Update"
                                    required
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#ecb613] focus:border-[#ecb613] outline-none transition-all placeholder:text-slate-400 text-slate-808 dark:text-slate-100"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-505 uppercase tracking-wide mb-2">Message Content</label>
                                <textarea
                                    rows={5}
                                    value={messageContent}
                                    onChange={(e) => setMessageContent(e.target.value)}
                                    placeholder="Type your message here... All enrolled students will see this in their Portal."
                                    required
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#ecb613] focus:border-[#ecb613] outline-none transition-all placeholder:text-slate-400 font-medium text-slate-808 dark:text-slate-100"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-105 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowMessageModal(false)}
                                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-355 rounded-lg text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSendingMessage || !messageContent.trim() || !messageSubject.trim()}
                                    className="px-5 py-2 rounded-lg text-sm font-bold bg-[#ecb613] text-slate-900 hover:bg-[#ecb613]/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                                >
                                    {isSendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    {isSendingMessage ? 'Sending...' : 'Send Message'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Announcement Details Modal ────────────────────────────────────── */}
            {selectedAnnouncement && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-205 dark:border-slate-800 w-full max-w-lg flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 text-left">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[#ecb613]/10 flex items-center justify-center">
                                    <MessageSquare className="w-5 h-5 text-[#ecb613]" />
                                </div>
                                <div className="text-left">
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Announcement Details</h3>
                                    <p className="text-xs text-slate-500">Sent on {new Date(selectedAnnouncement.created_at).toLocaleString()}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedAnnouncement(null)} className="p-1.5 rounded-lg text-slate-450 hover:text-slate-655 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-left">
                            <div className="text-left">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Subject</span>
                                <h4 className="text-md font-extrabold text-slate-900 dark:text-white leading-snug">{selectedAnnouncement.subject}</h4>
                            </div>

                            <div className="text-left">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Message Body</span>
                                <div className="p-4 bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap select-text">
                                    {selectedAnnouncement.content}
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => handleDeleteAnnouncement(selectedAnnouncement.id, selectedAnnouncement.subject, selectedAnnouncement.content)}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete Announcement
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedAnnouncement(null)}
                                className="px-4 py-2 border border-slate-202 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setMessageSubject(selectedAnnouncement.subject);
                                    setMessageContent(selectedAnnouncement.content);
                                    setSelectedAnnouncement(null);
                                    if (isMeetingView) {
                                        const textarea = document.querySelector('textarea[placeholder*="Hi Class"]');
                                        if (textarea) {
                                            (textarea as HTMLElement).focus();
                                        }
                                    } else {
                                        setShowMessageModal(true);
                                    }
                                }}
                                className="px-5 py-2 rounded-lg text-sm font-bold bg-[#ecb613] text-slate-900 hover:bg-[#ecb613]/90 transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                            >
                                <Edit3 className="w-4 h-4" />
                                Edit & Resend
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

            <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
                {isMeetingView ? (
                    <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-905/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between px-8 py-4 gap-4 flex-shrink-0 shadow-sm">
                        <div className="flex items-center gap-3 text-left">
                            <button onClick={onMinimizeSession || onEndSession} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer animate-in fade-in" title="Minimize and go back to dashboard">
                                <ArrowLeft size={18} />
                            </button>
                            <div className="text-left">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest text-left">Active Class Session</span>
                                    {sessionType === 'online' ? (
                                        <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded-full">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Live Online</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                            <span className="text-[10px] font-bold text-[#ecb613] uppercase tracking-wider">In-Person</span>
                                        </div>
                                    )}
                                </div>
                                <h2 className="text-xl font-extrabold text-slate-905 dark:text-white mt-0.5 text-left">{classroom?.name || 'Classroom'}</h2>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800">
                                <Clock className="w-4 h-4 text-[#ecb613] animate-spin" style={{ animationDuration: '6s' }} />
                                <div className="text-xs text-left">
                                    <span className="text-slate-400 font-semibold mr-1">Session Duration:</span>
                                    <span className="font-mono font-bold text-slate-905 dark:text-slate-100">{formatDuration(secondsElapsed)}</span>
                                </div>
                            </div>
                            <button
                                disabled={isEndingSession}
                                onClick={effectiveEndSession}
                                className="px-5 py-2.5 bg-red-500 hover:bg-red-655 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-red-200 dark:shadow-none hover:scale-[1.02] active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isEndingSession ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <LogOut size={14} />}
                                {isEndingSession ? 'Ending...' : 'End Active Class'}
                            </button>
                        </div>
                    </header>
                ) : (
                    <header className="flex justify-between items-center px-8 h-16 w-full max-w-full mx-auto bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
                        <div className="flex items-center gap-4">
                            <Link href="/teacher-dashboard/classrooms" className="text-slate-405 hover:text-slate-905 dark:hover:text-white transition-colors">
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <h2 className="text-xl font-bold text-[#ecb613] dark:text-[#ecb613]">{classroom?.name || 'Classroom'}</h2>
                            <span className="px-2 py-1 bg-[#ecb613]/10 text-[#ecb613] dark:bg-[#ecb613]/20 dark:text-[#ecb613] text-[10px] font-bold rounded uppercase tracking-wider select-none">{classroom?.status || 'Active'}</span>
                            {classroom?.type === 'temporary' && classroom.class_date && (
                                <span className="hidden sm:flex px-2.5 py-1 bg-amber-50 dark:bg-amber-955/20 text-amber-600 dark:text-amber-400 text-xs font-bold rounded items-center gap-1.5 border border-amber-200/50 dark:border-amber-900/30">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {formatLocalDate(classroom.class_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    {classroom.start_time && ` (${formatTime12hr(classroom.start_time.slice(0,5))} – ${formatTime12hr(classroom.end_time?.slice(0,5) || '')})`}
                                </span>
                            )}
                            {classroom?.type === 'permanent' && schedules.length > 0 && (
                                <span className="hidden sm:flex px-2.5 py-1 bg-blue-50 dark:bg-blue-955/20 text-blue-600 dark:text-blue-400 text-xs font-bold rounded items-center gap-1.5 border border-blue-200/50 dark:border-blue-900/30">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {schedules.map(s => `${DAY_NAMES[s.day_of_week].slice(0,3)} at ${formatTime12hr(s.start_time.slice(0,5))}`).join(', ')}
                                </span>
                            )}
                            {classroom?.teacher_name && (
                                <span className="hidden md:flex px-2.5 py-1 bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 dark:text-emerald-450 text-xs font-bold rounded items-center gap-1.5 border border-emerald-200/50 dark:border-emerald-900/30">
                                    <User className="w-3.5 h-3.5" />
                                    Instructor: {classroom.teacher_name}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="relative hidden md:block">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input 
                                    className="pl-10 pr-4 py-1.5 bg-slate-100 dark:bg-slate-800 border-none rounded-full text-sm w-64 focus:ring-2 focus:ring-[#ecb613] outline-none transition-all placeholder:text-slate-400 text-slate-800 dark:text-slate-100" 
                                    placeholder="Search students, tasks..." 
                                    type="text" 
                                />
                            </div>
                            <div className="flex items-center gap-4">
                                <button className="text-slate-500 hover:text-[#ecb613] transition-colors cursor-pointer">
                                    <Bell className="w-5 h-5" />
                                </button>
                                <button className="text-slate-500 hover:text-[#ecb613] transition-colors cursor-pointer">
                                    <HelpCircle className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </header>
                )}

                <div className="p-4 sm:p-6 md:p-8 w-full flex-1 overflow-y-auto custom-scrollbar">
                    {classroom?.is_live && !isMeetingView && (
                        <div className="mb-6 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-l-4 border-[#ecb613] p-4 rounded-r-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in">
                            <div className="flex items-center gap-3">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                </span>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        Class Session is Currently Live
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Students can currently see the live banner and meeting access link.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2.5 w-full sm:w-auto">
                                <Link
                                    href={`/teacher-dashboard/classrooms/${classroomId}/meeting`}
                                    className="flex-1 sm:flex-initial px-4 py-2 bg-[#ecb613] hover:bg-amber-500 text-slate-950 text-xs font-extrabold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    <Video className="w-3.5 h-3.5" />
                                    Join Live View
                                </Link>
                                <button
                                    disabled={isEndingSession}
                                    onClick={effectiveEndSession}
                                    className="flex-1 sm:flex-initial px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isEndingSession ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <LogOut size={14} />}
                                    {isEndingSession ? 'Ending...' : 'End Class'}
                                </button>
                            </div>
                        </div>
                    )}
                    {/* Row-wise Tabs */}
                    <div className="flex items-center gap-1 sm:gap-2 border-b border-slate-200 dark:border-slate-800 mb-6 sm:mb-8 overflow-x-auto scrollbar-none whitespace-nowrap snap-x pb-1">
                        {['Overview', 'Curriculum', 'Students', 'Assignments', 'Attendance', 'Class Logs', 'Chat', 'Settings'].map((tab) => (
                            <button 
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-extrabold transition-all border-b-2 cursor-pointer shrink-0 snap-start select-none ${
                                    activeTab === tab 
                                        ? 'text-[#ecb613] dark:text-[#ecb613] border-[#ecb613] dark:border-[#ecb613] bg-amber-500/10 dark:bg-amber-500/15 rounded-t-xl' 
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-t-xl'
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Dynamic Tab Views */}
                    {activeTab === 'Overview' && (
                        <OverviewTab 
                            isMeetingView={isMeetingView}
                            handleSendClassMessage={handleSendClassMessage}
                            messageSubject={messageSubject}
                            setMessageSubject={setMessageSubject}
                            messageContent={messageContent}
                            setMessageContent={setMessageContent}
                            isSendingMessage={isSendingMessage}
                            classBroadcasts={classBroadcasts}
                            setSelectedAnnouncement={setSelectedAnnouncement}
                            students={students}
                            avgAttendance={avgAttendance}
                            schedules={schedules}
                            getRealStudentProgress={getRealStudentProgress}
                            openDirectoryModal={openDirectoryModal}
                            paginatedStudents={paginatedStudents}
                            removingStudentId={removingStudentId}
                            handleRemoveStudent={handleRemoveStudent}
                            currentPage={currentPage}
                            setCurrentPage={setCurrentPage}
                            totalPages={totalPages}
                            PAGE_SIZE={PAGE_SIZE}
                            setShowMessageModal={setShowMessageModal}
                            classroomId={classroomId}
                            classroom={classroom}
                            DAY_NAMES={DAY_NAMES}
                            formatTime12hr={formatTime12hr}
                            formatLocalDate={formatLocalDate}
                            classroomInventoryAllocations={classroomInventoryAllocations}
                            courseModules={courseModules}
                            courseChapters={courseChapters}
                            courseLessons={courseLessons}
                            classroomAttendance={classroomAttendance}
                            classroomAssignmentsStudents={classroomAssignmentsStudents}
                            assignments={assignments}
                            studentProgress={studentProgress}
                            announcementSearchQuery={announcementSearchQuery}
                            setAnnouncementSearchQuery={setAnnouncementSearchQuery}
                            filteredAnnouncements={filteredAnnouncements}
                        />
                    )}

                    {activeTab === 'Curriculum' && (
                        <CurriculumTab 
                            curriculumTab={curriculumTab}
                            setCurriculumTab={setCurriculumTab}
                            activeAttendanceRoster={activeAttendanceRoster}
                            selectedStudentForCurriculum={selectedStudentForCurriculum}
                            setSelectedStudentForCurriculum={setSelectedStudentForCurriculum}
                            allocatedInventoryItems={allocatedInventoryItems}
                            hasAnyVisibleModule={hasAnyVisibleModule}
                            curriculumSearchQuery={curriculumSearchQuery}
                            setCurriculumSearchQuery={setCurriculumSearchQuery}
                            handleExpandAllCurriculum={handleExpandAllCurriculum}
                            handleCollapseAllCurriculum={handleCollapseAllCurriculum}
                            visibleCurriculum={visibleCurriculum}
                            expandedHeadlines={expandedHeadlines}
                            setExpandedHeadlines={setExpandedHeadlines}
                            expandedModules={expandedModules}
                            setExpandedModules={setExpandedModules}
                            expandedChapters={expandedChapters}
                            setExpandedChapters={setExpandedChapters}
                            handleDeallocateItem={handleDeallocateItem}
                            deletingAssignmentId={deletingAssignmentId}
                            isUpdatingProgress={isUpdatingProgress}
                            getLessonPacingStatus={getLessonPacingStatus}
                            setSelectedTopic={setSelectedTopic}
                            openAllocationDrawer={openAllocationDrawer}
                            livePreviewData={livePreviewData}
                            selectedStudentPermissions={selectedStudentPermissions}
                            syllabusLessons={syllabusLessons}
                            setIsInventoryDrawerOpen={setIsInventoryDrawerOpen}
                            handleUpdatePacingState={handleUpdatePacingState}
                            getClassSummary={getClassSummary}
                            getStudentStatuses={getStudentStatuses}
                            getIsLocked={getIsLocked}
                            openUnlockModal={openUnlockModal}
                        />
                    )}

                    {activeTab === 'Students' && (
                        <StudentsTab 
                            students={students}
                            classroom={classroom}
                            openMakeupModal={openMakeupModal}
                            openDirectoryModal={openDirectoryModal}
                            paginatedStudents={paginatedStudents}
                            getRealStudentProgress={getRealStudentProgress}
                            handleRemoveStudent={handleRemoveStudent}
                            removingStudentId={removingStudentId}
                            currentPage={currentPage}
                            setCurrentPage={setCurrentPage}
                            PAGE_SIZE={PAGE_SIZE}
                            totalPages={totalPages}
                            sessionOverrides={sessionOverrides}
                            formatLocalDate={formatLocalDate}
                            openRescheduleModal={openRescheduleModal}
                            handleDeleteOverride={handleDeleteOverride}
                            isDeletingOverrideId={isDeletingOverrideId}
                            avgAttendance={parseFloat(avgAttendance)}
                            classroomInventoryAllocations={classroomInventoryAllocations}
                            courseModules={courseModules}
                            courseChapters={courseChapters}
                            courseLessons={courseLessons}
                            classroomAttendance={classroomAttendance}
                            classroomAssignmentsStudents={classroomAssignmentsStudents}
                            assignments={assignments}
                            studentProgress={studentProgress}
                        />
                    )}

                    {activeTab === 'Assignments' && (
                        <AssignmentsTab 
                            showAssignmentModal={showAssignmentModal}
                            setShowAssignmentModal={setShowAssignmentModal}
                            classroom={classroom}
                            closeAssignmentModal={closeAssignmentModal}
                            assignmentForm={assignmentForm}
                            setAssignmentForm={setAssignmentForm}
                            students={students}
                            assignmentFileRef={assignmentFileRef}
                            assignmentFile={assignmentFile}
                            setAssignmentFile={setAssignmentFile}
                            formatFileSize={formatFileSize}
                            assignmentError={assignmentError}
                            isSavingAssignment={isSavingAssignment}
                            handleCreateAssignment={handleCreateAssignment}
                            showNoteEditor={showNoteEditor}
                            editingNote={editingNote}
                            setShowNoteEditor={setShowNoteEditor}
                            setEditingNote={setEditingNote}
                            noteForm={noteForm}
                            setNoteForm={setNoteForm}
                            noteFileRef={noteFileRef}
                            noteFile={noteFile}
                            setNoteFile={setNoteFile}
                            noteError={noteError}
                            setNoteError={setNoteError}
                            handleSaveNote={handleSaveNote}
                            isSavingNote={isSavingNote}
                            dbSetupError={dbSetupError}
                            setDbSetupError={setDbSetupError}
                            classNotes={classNotes}
                            openNewNote={openNewNote}
                            notesLoading={notesLoading}
                            handleDragStart={handleDragStart}
                            openEditNote={openEditNote}
                            handleDeleteNote={handleDeleteNote}
                            deletingNoteId={deletingNoteId}
                            isDraggingOverAssignments={isDraggingOverAssignments}
                            setIsDraggingOverAssignments={setIsDraggingOverAssignments}
                            handleDropNote={handleDropNote}
                            assignments={assignments}
                            assignmentsLoading={assignmentsLoading}
                            filteredAssignments={filteredAssignments}
                            setAssignmentFilter={setAssignmentFilter}
                            assignmentFilter={assignmentFilter}
                            expandedAssignmentId={expandedAssignmentId}
                            setExpandedAssignmentId={setExpandedAssignmentId}
                            deletingAssignmentId={deletingAssignmentId}
                            handleDeleteAssignment={handleDeleteAssignment}
                            handleOpenReviewModal={handleOpenReviewModal}
                            handleEditAssignment={handleEditAssignment}
                        />
                    )}

                    {activeTab === 'Attendance' && (
                        <AttendanceTab 
                            attendanceDate={attendanceDate}
                            setAttendanceDate={setAttendanceDate}
                            attendanceRecords={attendanceRecords}
                            activeAttendanceRoster={activeAttendanceRoster}
                            attendanceLoading={attendanceLoading}
                            isSavingAttendanceMap={isSavingAttendanceMap}
                            handleMarkClassroomAttendance={handleMarkClassroomAttendance}
                            handleUnmarkClassroomAttendance={handleUnmarkClassroomAttendance}
                            formatLocalDate={formatLocalDate}
                        />
                    )}

                    {activeTab === 'Class Logs' && (
                        <ClassLogsTab 
                            sessionLogs={sessionLogs}
                            sessionLogsLoading={sessionLogsLoading}
                            fetchSessionLogs={fetchSessionLogs}
                        />
                    )}

                    {activeTab === 'Chat' && (
                        <ClassroomChatTab
                            classroom={classroom}
                            currentUser={teacherProfile}
                            messages={classroomMessages}
                            participants={classroomChatParticipants}
                            sending={isSendingClassroomMessage}
                            onSendMessage={handleSendClassroomChatMessage}
                        />
                    )}

                    {activeTab === 'Settings' && (
                        <SettingsTab 
                            schedules={schedules}
                            DAY_NAMES={DAY_NAMES}
                            formatTime12hr={formatTime12hr}
                            handleDeleteSchedule={handleDeleteSchedule}
                            newSchedule={newSchedule}
                            setNewSchedule={setNewSchedule}
                            TIME_OPTIONS={TIME_OPTIONS}
                            handleSaveSchedule={handleSaveSchedule}
                            isSavingSchedule={isSavingSchedule}
                            metadataForm={metadataForm}
                            setMetadataForm={setMetadataForm}
                            metadataError={metadataError}
                            metadataSaved={metadataSaved}
                            classroom={classroom}
                            handleSaveMetadata={handleSaveMetadata}
                            isSavingMetadata={isSavingMetadata}
                        />
                    )}
                </div>

                {/* ── MODALS & DRAWER LAYOUT ────────────────────────────────────────── */}

                {/* 1. MEDIA PREVIEW MODAL */}
                {mediaPreview && (
                    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-3xl w-full max-w-4xl p-6 shadow-2xl flex flex-col items-center justify-center relative animate-in zoom-in-95 duration-300">
                            <div className="w-full flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                                <h3 className="font-extrabold text-slate-905 dark:text-white text-md truncate leading-tight font-mono">{mediaPreview.title}</h3>
                                <button 
                                    onClick={() => setMediaPreview(null)} 
                                    className="p-1.5 rounded-lg text-slate-455 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                                >
                                    <X className="size-5" />
                                </button>
                            </div>
                            
                            <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center relative">
                                {mediaPreview.type === 'video' ? (
                                    <video src={mediaPreview.url} controls className="w-full h-full object-contain" autoPlay />
                                ) : mediaPreview.type === 'audio' ? (
                                    <div className="w-full p-8 flex flex-col items-center justify-center gap-4 bg-slate-950/40 h-full">
                                        <Music className="size-16 text-amber-500 animate-pulse" />
                                        <audio src={mediaPreview.url} controls className="w-full max-w-md" autoPlay />
                                    </div>
                                ) : mediaPreview.type === 'pdf' ? (
                                    <embed src={mediaPreview.url} type="application/pdf" className="w-full h-full" />
                                ) : mediaPreview.type === 'image' ? (
                                    <img src={mediaPreview.url} alt={mediaPreview.title} className="w-full h-full object-contain" />
                                ) : (
                                    <div className="text-center p-8 space-y-4">
                                        <FileText className="size-16 text-slate-655 mx-auto" />
                                        <p className="text-xs text-slate-400 max-w-sm">No interactive simulation available for generic files. Open details below:</p>
                                        <a 
                                            href={mediaPreview.url} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-full text-xs transition-all uppercase tracking-wider cursor-pointer"
                                        >
                                            <span>Open File Attachment</span>
                                            <ExternalLink className="size-3.5" />
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. CURRICULUM TOPIC DETAILS DIALOG */}
                {selectedTopic && (() => {
                    const chap = courseChapters.find(c => c.id === selectedTopic.chapter_id);
                    const mod = chap ? courseModules.find(m => m.id === chap.module_id) : null;
                    
                    const isAudio = selectedTopic.material_type === 'audio';
                    const isVideo = selectedTopic.material_type === 'video';
                    const isPdf = selectedTopic.material_type === 'pdf';
                    const isImage = selectedTopic.material_type === 'image';
                    const hasMaterial = !!selectedTopic.material_url;
                    
                    const styleConfig = isVideo ? {
                        badge: 'bg-amber-505/10 text-amber-600 dark:text-amber-400 border border-amber-505/20',
                        icon: <Film className="size-5 text-[#ecb613]" />,
                        label: 'Video Tutorial'
                    } : isAudio ? {
                        badge: 'bg-amber-505/10 text-amber-600 dark:text-amber-455 border border-amber-505/20',
                        icon: <Music className="size-5 text-amber-500 animate-pulse" />,
                        label: 'Audio Guide'
                    } : isPdf ? {
                        badge: 'bg-amber-505/10 text-amber-600 dark:text-amber-455 border border-amber-505/20',
                        icon: <FileText className="size-5 text-[#ecb613]" />,
                        label: 'PDF Sheet Music'
                    } : {
                        badge: 'bg-amber-505/10 text-amber-600 dark:text-amber-455 border border-amber-505/20',
                        icon: <BookOpen className="size-5 text-amber-500" />,
                        label: 'Interactive Guide'
                    };

                    return (
                        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                            <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl text-slate-800 dark:text-slate-100 overflow-hidden animate-in zoom-in-95 duration-300 select-none" onCopy={(event) => event.preventDefault()} onCut={(event) => event.preventDefault()} onContextMenu={(event) => event.preventDefault()}>
                                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex-shrink-0">
                                    <div className="flex items-center gap-3 text-left">
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                            {styleConfig.icon}
                                        </div>
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-black text-slate-905 dark:text-white text-sm md:text-base tracking-tight leading-none">{selectedTopic.title}</h3>
                                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${styleConfig.badge}`}>
                                                    {styleConfig.label}
                                                </span>
                                            </div>
                                            {(mod || chap) && (
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-bold uppercase tracking-wider">
                                                    {mod ? `Module ${mod.module_number}: ${mod.title}` : ''} {chap ? `> Chapter ${chap.chapter_number}: ${chap.title}` : ''}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedTopic(null)} 
                                        className="p-1.5 rounded-lg text-slate-455 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                                    <div className="space-y-3 text-left">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none font-mono">1. Lesson Overview</h4>
                                        <div className="p-5 rounded-2xl bg-slate-50/60 dark:bg-slate-950/20 border border-slate-200/50 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold leading-relaxed tutorial-content max-w-none">
                                            {selectedTopic.description ? (
                                                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedTopic.description) }} />
                                            ) : (
                                                'No detailed instructions uploaded. Follow general study guides for this level.'
                                            )}
                                        </div>
                                    </div>

                                    {selectedTopic.bullet_points && selectedTopic.bullet_points.length > 0 && (
                                        <div className="space-y-3 text-left">
                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none font-mono">2. Learning Objectives</h4>
                                            <div className="p-5 rounded-2xl bg-slate-50/60 dark:bg-slate-955/20 border border-slate-200/50 dark:border-slate-800 space-y-3.5">
                                                <ul className="space-y-2.5">
                                                    {selectedTopic.bullet_points.map((pt: string, idx: number) => (
                                                        <li key={idx} className="flex items-start gap-2.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                                            <div className="w-4 h-4 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5 text-[#ecb613] font-black text-[8px]">
                                                                ✓
                                                            </div>
                                                            <span className="leading-tight"><AutoLinkText text={pt} /></span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-3 text-left">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none font-mono">3. View Attachments & Material Player</h4>
                                        {hasMaterial ? (
                                            <div className={`w-full ${
                                                selectedTopic?.material_type === 'pdf' || 
                                                selectedTopic?.material_type === 'image' || 
                                                /\.(pdf|png|jpe?g|gif|svg|webp)$/i.test((selectedTopic?.material_url || '').toLowerCase().split('?')[0]) 
                                                    ? 'h-[700px]' 
                                                    : 'aspect-video'
                                            } bg-black rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex items-center justify-center relative shadow-inner`}>
                                                {true ? (
                                                    <SecureCurriculumMaterial url={selectedTopic.material_url} title={selectedTopic.title} materialType={selectedTopic.material_type} viewerName={teacherProfile?.name} viewerEmail={teacherProfile?.email} showWatermark={false} />
                                                ) : isVideo ? (
                                                    <video src={selectedTopic.material_url} controls className="w-full h-full object-contain" autoPlay />
                                                ) : isAudio ? (
                                                    <div className="w-full p-8 flex flex-col items-center justify-center gap-4 bg-slate-950/40 h-full">
                                                        <Music className="size-16 text-amber-500 animate-pulse" />
                                                        <audio src={selectedTopic.material_url} controls className="w-full max-w-md" autoPlay />
                                                    </div>
                                                ) : isPdf ? (
                                                    <embed src={selectedTopic.material_url} type="application/pdf" className="w-full h-full" />
                                                ) : isImage ? (
                                                    <img src={selectedTopic.material_url} alt={selectedTopic.title} className="w-full h-full object-contain" />
                                                ) : (
                                                    <div className="text-center p-8 space-y-4">
                                                        <FileText className="size-16 text-slate-600 mx-auto" />
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">No interactive simulation available for generic files. Download or open in a new tab:</p>
                                                        <a 
                                                            href={selectedTopic.material_url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-955 font-black rounded-full text-xs transition-all uppercase tracking-wider cursor-pointer"
                                                        >
                                                            <span>Open File Attachment</span>
                                                            <ExternalLink className="size-3.5" />
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="w-full p-8 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60 flex flex-col items-center justify-center text-center space-y-3">
                                                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-[#ecb613]">
                                                    <Sparkles className="size-6 text-[#ecb613]" />
                                                </div>
                                                <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">Interactive Syllabus Node</h4>
                                                <p className="text-xs text-slate-505 dark:text-slate-400 max-w-md leading-relaxed">
                                                    This is a theoretical study and conceptual topic block. Read the instructions and checklist objectives above to complete the learning phase.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-950/20 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 flex-shrink-0">
                                    <button 
                                        onClick={() => setSelectedTopic(null)} 
                                        className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors tracking-wider uppercase cursor-pointer"
                                    >
                                        Back to Curriculum
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* 3. ALLOCATE FROM INVENTORY SLIDING DRAWER */}
                {isInventoryDrawerOpen && (
                    <div className="fixed inset-0 z-[600] flex justify-end animate-in fade-in duration-300">
                        <div 
                            onClick={() => setIsInventoryDrawerOpen(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer animate-in fade-in"
                        ></div>

                        <div className="relative w-full max-w-xl h-full bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-350">
                            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-905/45">
                                <div className="flex items-center gap-2.5 text-left">
                                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-505">
                                        <BookOpen className="size-4.5 text-amber-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-extrabold text-slate-905 dark:text-white text-base tracking-tight leading-none">Allocate from Inventory</h3>
                                        <p className="text-[10px] text-slate-455 font-bold uppercase font-mono tracking-wider mt-1">Classroom Learning Materials</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setIsInventoryDrawerOpen(false)}
                                    className="p-1.5 rounded-lg text-slate-450 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                                    type="button"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-5 border-b border-slate-200 dark:border-slate-800 space-y-4">
                                <div className="relative">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
                                    <input
                                        type="text"
                                        value={inventorySearchQuery}
                                        onChange={(e) => setInventorySearchQuery(e.target.value)}
                                        placeholder="Search levels, chapters, or lessons..."
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-900 border border-transparent dark:border-slate-800 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-5 space-y-6 text-left custom-scrollbar">
                                {(() => {
                                    const sortedCategories = getImporterCategories();
                                    let totalRenderedModules = 0;

                                    const renderedCategories = sortedCategories.map(category => {
                                        const filteredModules = courseModules
                                            .filter(m => parseModuleCategory(m).category === category)
                                            .filter(m => {
                                                const query = inventorySearchQuery.toLowerCase();
                                                if (!query) return true;
                                                if (m.title.toLowerCase().includes(query)) return true;
                                                const modChaps = courseChapters.filter(c => c.module_id === m.id);
                                                const hasMatchingChap = modChaps.some(c => c.title.toLowerCase().includes(query));
                                                if (hasMatchingChap) return true;
                                                const chapIds = new Set(modChaps.map(c => c.id));
                                                return courseLessons.filter(l => chapIds.has(l.chapter_id)).some(l => l.title.toLowerCase().includes(query));
                                            });

                                        if (filteredModules.length === 0) return null;
                                        totalRenderedModules += filteredModules.length;

                                        return (
                                            <div key={category} className="space-y-3">
                                                <div className="flex items-center gap-2 select-none border-b border-slate-200 dark:border-slate-800 pb-1.5 pt-1">
                                                    <span className="w-1.5 h-3.5 bg-[#ecb613] rounded-full" />
                                                    <h6 className="font-extrabold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">
                                                        {category}
                                                    </h6>
                                                    <span className="text-[9px] font-bold text-slate-400 font-mono bg-slate-100 dark:bg-slate-800/60 px-1.5 py-0.2 rounded-md">
                                                        {filteredModules.length} Modules
                                                    </span>
                                                </div>

                                                <div className="space-y-3">
                                                    {filteredModules.map(mod => {
                                                        const isExpanded = !!expandedInventoryModules[mod.id];
                                                        const modChapters = courseChapters.filter(c => c.module_id === mod.id);
                                                        const isImporting = importingItemId === mod.id;
                                                        const isAllocated = curriculumTab === 'individual' && selectedStudentForCurriculum
                                                            ? classroomInventoryAllocations.some(a => a.module_id === mod.id && a.allocated_to_student_id === selectedStudentForCurriculum.student_id)
                                                            : classroomInventoryAllocations.some(a => a.module_id === mod.id);

                                                        return (
                                                            <div key={mod.id} className="rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden bg-slate-50/[0.2] dark:bg-slate-900/10">
                                                                <div 
                                                                    onClick={() => setExpandedInventoryModules(prev => ({ ...prev, [mod.id]: !isExpanded }))}
                                                                    className="px-5 py-4 bg-slate-50/50 dark:bg-slate-900/60 hover:bg-slate-100/60 dark:hover:bg-slate-900/80 transition-all flex items-center justify-between cursor-pointer select-none gap-4"
                                                                >
                                                                    <div className="flex items-center gap-3 text-left min-w-0 flex-1">
                                                                        <div className="w-8.5 h-8.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 text-[10px] font-black uppercase font-mono shrink-0">
                                                                            {getCategoryAbbreviation(category)}
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <h5 className="text-xs font-black text-slate-800 dark:text-slate-100 leading-tight truncate">{mod.title}</h5>
                                                                            <p className="text-[9px] text-slate-455 dark:text-slate-555 font-bold uppercase mt-1 tracking-wider font-mono">
                                                                                {modChapters.length} CHAPTERS • {category}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                                                                        <button
                                                                            disabled={isImporting || isAllocated}
                                                                            onClick={() => handleAllocateItem('module', mod.id, mod.title, mod.description)}
                                                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${
                                                                                isAllocated
                                                                                    ? 'bg-slate-105 dark:bg-slate-800 text-slate-505 cursor-not-allowed shadow-none'
                                                                                    : 'bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-950 hover:-translate-y-0.5'
                                                                            }`}
                                                                            type="button"
                                                                        >
                                                                            {isImporting ? (
                                                                                <Loader2 className="size-3 animate-spin" />
                                                                            ) : isAllocated ? (
                                                                                <CheckCircle className="size-3" />
                                                                            ) : (
                                                                                <Plus className="size-3 stroke-[3]" />
                                                                            )}
                                                                            <span>{isAllocated ? 'Added to Class' : 'Add Module'}</span>
                                                                        </button>
                                                                        <div 
                                                                            onClick={() => setExpandedInventoryModules(prev => ({ ...prev, [mod.id]: !isExpanded }))}
                                                                            className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center text-slate-405 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                                                                        >
                                                                            {isExpanded ? (
                                                                                <ChevronUp className="size-4" />
                                                                            ) : (
                                                                                <ChevronDown className="size-4" />
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {isExpanded && (
                                                                    <div className="p-4 bg-white dark:bg-slate-950/20 border-t border-slate-200 dark:border-slate-800 space-y-4">
                                                                        {modChapters.length === 0 ? (
                                                                            <p className="text-xs text-slate-400 italic text-center py-2">No chapters defined.</p>
                                                                        ) : (
                                                                            modChapters.map(chap => {
                                                                                const isChapImporting = importingItemId === chap.id;
                                                                                const isChapAllocated = isAllocated || (curriculumTab === 'individual' && selectedStudentForCurriculum
                                                                                    ? classroomInventoryAllocations.some(a => a.chapter_id === chap.id && (a.allocated_to_student_id === selectedStudentForCurriculum.student_id || !a.allocated_to_student_id))
                                                                                    : classroomInventoryAllocations.some(a => a.chapter_id === chap.id));
                                                                                const chapLessons = courseLessons.filter(l => l.chapter_id === chap.id);

                                                                                return (
                                                                                    <div key={chap.id} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-805 bg-slate-50/[0.1] dark:bg-slate-900/5 space-y-3">
                                                                                        <div className="flex items-start justify-between gap-3">
                                                                                            <div className="text-left">
                                                                                                <span className="text-[8px] font-black text-amber-550 font-mono uppercase tracking-widest leading-none">CHAPTER LEVEL</span>
                                                                                                <h6 className="text-xs font-black text-slate-808 dark:text-slate-200 mt-1 leading-tight">{chap.title}</h6>
                                                                                            </div>
                                                                                            <button
                                                                                                disabled={isChapImporting || isChapAllocated}
                                                                                                onClick={() => handleAllocateItem('chapter', chap.id, chap.title, chap.description)}
                                                                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer ${
                                                                                                    isChapAllocated
                                                                                                        ? 'bg-slate-105 dark:bg-slate-800 text-slate-505 cursor-not-allowed shadow-none'
                                                                                                        : 'bg-white dark:bg-slate-800 hover:bg-[#ecb613] hover:text-slate-950 border border-slate-200 dark:border-slate-700 hover:border-transparent'
                                                                                                }`}
                                                                                                type="button"
                                                                                            >
                                                                                                {isChapImporting ? (
                                                                                                    <Loader2 className="size-3 animate-spin" />
                                                                                                ) : isChapAllocated ? (
                                                                                                    <CheckCircle className="size-3" />
                                                                                                ) : (
                                                                                                    <Plus className="size-3 stroke-[3]" />
                                                                                                )}
                                                                                                <span>{isChapAllocated ? 'Added' : 'Add Chapter'}</span>
                                                                                            </button>
                                                                                        </div>

                                                                                        {chapLessons.length > 0 && (
                                                                                            <div className="pl-3 border-l border-slate-200 dark:border-slate-800 space-y-2 mt-2">
                                                                                                {chapLessons.map(lesson => {
                                                                                                    const isLessonImporting = importingItemId === lesson.id;
                                                                                                    const isLessonAllocated = curriculumTab === 'individual' && selectedStudentForCurriculum
                                                                                                        ? classroomInventoryAllocations.some(a => a.lesson_id === lesson.id && a.allocated_to_student_id === selectedStudentForCurriculum.student_id)
                                                                                                        : classroomInventoryAllocations.some(a => a.lesson_id === lesson.id);

                                                                                                    return (
                                                                                                        <div key={lesson.id} className="flex items-center justify-between gap-3 py-1.5">
                                                                                                            <div className="flex items-center gap-2 min-w-0">
                                                                                                                <div className="w-5.5 h-5.5 rounded bg-slate-105 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                                                                                                    {lesson.material_type === 'video' ? (
                                                                                                                        <Film className="size-3 text-amber-555" />
                                                                                                                    ) : lesson.material_type === 'audio' ? (
                                                                                                                        <Music className="size-3 text-amber-555 animate-pulse" />
                                                                                                                    ) : (
                                                                                                                        <FileText className="size-3 text-slate-400" />
                                                                                                                    )}
                                                                                                                </div>
                                                                                                                <span className="text-[11px] font-bold text-slate-655 dark:text-slate-355 truncate leading-none mt-0.5">{lesson.title}</span>
                                                                                                            </div>
                                                                                                            <button
                                                                                                                disabled={isLessonImporting || isLessonAllocated}
                                                                                                                onClick={() => handleAllocateItem('lesson', lesson.id, lesson.title, lesson.description)}
                                                                                                                className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                                                                                                                    isLessonAllocated
                                                                                                                        ? 'bg-slate-105 dark:bg-slate-800 text-slate-505 cursor-not-allowed shadow-none'
                                                                                                                        : 'bg-white dark:bg-slate-800 hover:bg-[#ecb613] hover:text-slate-950 border border-slate-200 dark:border-slate-700 hover:border-transparent'
                                                                                                                }`}
                                                                                                                type="button"
                                                                                                            >
                                                                                                                {isLessonImporting ? (
                                                                                                                    <Loader2 className="size-2.5 animate-spin" />
                                                                                                                ) : isLessonAllocated ? (
                                                                                                                    <CheckCircle className="size-2.5" />
                                                                                                                ) : (
                                                                                                                    <Plus className="size-2.5 stroke-[3]" />
                                                                                                                )}
                                                                                                                <span>{isLessonAllocated ? 'Added' : 'Add Topic'}</span>
                                                                                                            </button>
                                                                                                        </div>
                                                                                                    );
                                                                                                })}
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
                                            </div>
                                        );
                                    });

                                    if (totalRenderedModules === 0) {
                                        return <p className="text-xs text-slate-400 italic text-center py-8">No learning materials found.</p>;
                                    }

                                    return renderedCategories;
                                })()}
                            </div>
                        </div>
                    </div>
                )}

                {/* UNLOCK / LOCK CONFIRMATION MODAL */}
                {unlockModalTarget && (
                    <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                        <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 text-left animate-in zoom-in-95 duration-200">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border shrink-0 ${
                                        unlockModalTarget.action === 'unlock' 
                                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' 
                                            : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                                    }`}>
                                        {unlockModalTarget.action === 'unlock' ? <Unlock className="size-5" /> : <Lock className="size-5" />}
                                    </div>
                                    <div>
                                        <h3 className="font-extrabold text-base text-slate-900 dark:text-white leading-tight">
                                            {unlockModalTarget.action === 'unlock' ? 'Unlock Tutorial Material' : 'Lock Tutorial Material'}
                                        </h3>
                                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-xs">
                                            {unlockModalTarget.item?.title || unlockModalTarget.item?.name}
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setUnlockModalTarget(null)}
                                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                    <X className="size-4" />
                                </button>
                            </div>

                            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                                {unlockModalTarget.action === 'unlock'
                                    ? 'How would you like to unlock this material for your classroom?'
                                    : 'How would you like to lock this material for your classroom?'
                                }
                            </p>

                            <div className="space-y-3">
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const target = unlockModalTarget;
                                        setUnlockModalTarget(null);
                                        await handleUpdatePacingState(target.type, target.item.id, target.action === 'unlock' ? 'unlocked' : 'locked', 'classwide');
                                    }}
                                    className="w-full p-4 rounded-2xl bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-950 font-extrabold text-xs flex items-center justify-between transition-all shadow-md shadow-[#ecb613]/10 hover:-translate-y-0.5 cursor-pointer border border-[#ecb613]/20"
                                >
                                    <div className="flex items-center gap-3">
                                        <Users className="size-4 stroke-[2.5]" />
                                        <div className="text-left">
                                            <span className="block font-black uppercase tracking-wider text-[10px]">
                                                {unlockModalTarget.action === 'unlock' ? 'Unlock for Entire Class' : 'Lock for Entire Class'}
                                            </span>
                                            <span className="block text-[10px] opacity-80 font-normal">Apply change to all active students in classroom</span>
                                        </div>
                                    </div>
                                    <ChevronRight className="size-4" />
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        const target = unlockModalTarget;
                                        setUnlockModalTarget(null);
                                        openAllocationDrawer(target.type, target.item);
                                    }}
                                    className="w-full p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-100 font-extrabold text-xs flex items-center justify-between transition-all cursor-pointer border border-slate-200/80 dark:border-slate-700/60"
                                >
                                    <div className="flex items-center gap-3">
                                        <UserPlus className="size-4 text-amber-500" />
                                        <div className="text-left">
                                            <span className="block font-black uppercase tracking-wider text-[10px]">
                                                {unlockModalTarget.action === 'unlock' ? 'Unlock for Particular Student(s)' : 'Lock for Particular Student(s)'}
                                            </span>
                                            <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-normal">Select specific students to receive access</span>
                                        </div>
                                    </div>
                                    <ChevronRight className="size-4 text-slate-400" />
                                </button>
                            </div>

                            <div className="pt-2 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setUnlockModalTarget(null)}
                                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. PACING ALLOCATION MANAGER DRAWER */}
                {isAllocationDrawerOpen && (
                    <div className="fixed inset-0 z-[600] flex justify-end animate-in fade-in duration-300">
                        <div 
                            onClick={() => setIsAllocationDrawerOpen(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
                        ></div>

                        <div className="relative w-full max-w-md h-full bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300 text-left">
                            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
                                <div className="flex items-center gap-2.5 text-left">
                                    <div className="w-9 h-9 rounded-xl bg-[#ecb613]/10 border border-[#ecb613]/20 flex items-center justify-center text-[#ecb613]">
                                        <Sliders className="size-4.5 text-[#ecb613]" />
                                    </div>
                                    <div>
                                        <h3 className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight leading-none">Allocation Manager</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase font-mono tracking-wider mt-1 font-semibold">Curriculum Pace & Targets</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setIsAllocationDrawerOpen(false)}
                                    className="p-1.5 rounded-lg text-slate-450 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-left custom-scrollbar">
                                <div className="space-y-2">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-[#ecb613] font-mono font-semibold">Current Target</span>
                                    <div className="p-4 rounded-2xl bg-amber-500/[0.02] border border-amber-500/10 dark:bg-slate-900/60 dark:border-slate-800 space-y-1">
                                        <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 leading-tight">
                                            {allocationTargetLesson?.title || allocationTargetLesson?.name || 'No target selected'}
                                        </h4>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold leading-none capitalize">
                                            {allocationTargetItemType === 'level' ? `Level ${allocationTargetLesson?.module_number || ''}` :
                                             allocationTargetItemType === 'chapter' ? `Chapter ${allocationTargetLesson?.chapter_number || ''}` :
                                             `Topic ${allocationTargetLesson?.lesson_number || ''}`}
                                        </p>
                                    </div>
                                </div>

                                {/* Target Choice Selector */}
                                <div className="space-y-3">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">Target Audience</span>
                                    <div className="flex bg-slate-105 dark:bg-slate-900 p-1 rounded-xl">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAllocationTargetType('classwide');
                                                const activeStudentIds = [
                                                    ...students.map(s => s.student_id),
                                                    ...sessionOverrides.filter(o => o.override_date === attendanceDate).map(o => o.student_id)
                                                ];
                                                setAllocationSelectedStudents(activeStudentIds);
                                            }}
                                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center ${
                                                allocationTargetType === 'classwide'
                                                    ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-xs'
                                                    : 'text-slate-400 hover:text-slate-655'
                                            }`}
                                        >
                                            Entire Class
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAllocationTargetType('individual');
                                                const studentStatuses = getStudentStatuses(allocationTargetItemType, allocationTargetLesson?.id);
                                                const allocatedOrCompletedStudentIds = studentStatuses
                                                    .filter(s => s.status === 'completed' || s.status === 'in_progress' || s.status === 'locked')
                                                    .map(s => s.studentId);
                                                setAllocationSelectedStudents(
                                                    selectedStudentForCurriculum 
                                                        ? Array.from(new Set([selectedStudentForCurriculum.student_id, ...allocatedOrCompletedStudentIds]))
                                                        : allocatedOrCompletedStudentIds
                                                );
                                            }}
                                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center ${
                                                allocationTargetType === 'individual'
                                                    ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-xs'
                                                    : 'text-slate-400 hover:text-slate-655'
                                            }`}
                                        >
                                            Selected Students
                                        </button>
                                    </div>
                                </div>

                                {allocationTargetType === 'classwide' ? (
                                    <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                                            <Users className="w-5 h-5 text-amber-500" />
                                        </div>
                                        <div className="text-left">
                                            <span className="text-[9px] font-black uppercase text-amber-500 font-mono tracking-wider">Setting Pacing For</span>
                                            <h5 className="text-xs font-black text-slate-855 dark:text-slate-200 mt-0.5 leading-none">
                                                All Class Students ({students.length + sessionOverrides.filter(o => o.override_date === attendanceDate).length})
                                            </h5>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">Select Students</span>
                                        <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl p-2 space-y-1 bg-slate-50/50 dark:bg-slate-900/10 custom-scrollbar">
                                            {allocationTargetLesson && getStudentStatuses(allocationTargetItemType, allocationTargetLesson.id).map(student => {
                                                const isChecked = allocationSelectedStudents.includes(student.studentId);
                                                return (
                                                    <label 
                                                        key={student.studentId}
                                                        className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100/60 dark:hover:bg-slate-800/40 cursor-pointer transition-all select-none"
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-300 dark:border-slate-700">
                                                                {student.profilePic ? (
                                                                    <img src={student.profilePic} alt={student.name || 'Student'} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span className="text-[10px] font-black text-slate-500">{(student.name || 'S').charAt(0)}</span>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col text-left">
                                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-350">{student.name}</span>
                                                                <span className={`text-[9px] font-black uppercase mt-0.5 flex items-center gap-1 ${
                                                                    student.status === 'completed' ? 'text-emerald-600 dark:text-emerald-400' :
                                                                    student.status === 'in_progress' ? 'text-amber-600 dark:text-amber-400' :
                                                                    student.status === 'locked' ? 'text-slate-505 dark:text-slate-400' :
                                                                    'text-slate-400 dark:text-slate-500'
                                                                }`}>
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                                                        student.status === 'completed' ? 'bg-emerald-500' :
                                                                        student.status === 'in_progress' ? 'bg-amber-500' :
                                                                        student.status === 'locked' ? 'bg-slate-400' :
                                                                        'bg-slate-300'
                                                                    }`} />
                                                                    {student.status.replace('_', ' ')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <input 
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => {
                                                                if (isChecked) {
                                                                    setAllocationSelectedStudents(prev => prev.filter(id => id !== student.studentId));
                                                                } else {
                                                                    setAllocationSelectedStudents(prev => [...prev, student.studentId]);
                                                                }
                                                            }}
                                                            className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500 h-4.5 w-4.5 cursor-pointer accent-[#ecb613]"
                                                        />
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">
                                        Change {allocationTargetItemType === 'level' ? 'Level' : allocationTargetItemType === 'chapter' ? 'Chapter' : 'Topic'} Pacing State
                                    </span>
                                    <div className="grid grid-cols-3 gap-2">
                                        {([
                                            { key: 'locked', label: `Lock ${allocationTargetItemType === 'level' ? 'Level' : allocationTargetItemType === 'chapter' ? 'Chapter' : 'Topic'}`, border: 'border-slate-200 dark:border-slate-800', active: 'bg-slate-100 border-slate-400 text-slate-700 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300' },
                                            { key: 'unlocked', label: 'Unlock/Active', border: 'border-amber-200 dark:border-amber-850', active: 'bg-amber-50 border-amber-400 text-amber-700 dark:bg-amber-955/20 dark:border-amber-600 dark:text-amber-300' },
                                            { key: 'completed', label: 'Mark Complete', border: 'border-emerald-200 dark:border-emerald-850', active: 'bg-emerald-50 border-emerald-400 text-emerald-700 dark:bg-emerald-955/10 dark:border-emerald-600 dark:text-emerald-350' }
                                        ] as const).map(opt => {
                                            const isActive = allocationStatus === opt.key;
                                            return (
                                                <button
                                                    key={opt.key}
                                                    type="button"
                                                    onClick={() => setAllocationStatus(opt.key)}
                                                    className={`py-3 px-2 text-[10px] font-black uppercase tracking-wider rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center ${
                                                        isActive 
                                                            ? opt.active 
                                                            : `${opt.border} bg-white dark:bg-slate-900 text-slate-455 hover:border-slate-300 dark:hover:border-slate-750`
                                                    }`}
                                                >
                                                    <span className={`w-2 h-2 rounded-full ${
                                                        opt.key === 'locked' ? 'bg-slate-400' : opt.key === 'unlocked' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'
                                                    }`} />
                                                    {opt.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-900/40">
                                <button
                                    type="button"
                                    disabled={isSavingAllocation}
                                    onClick={handleSaveAllocation}
                                    className="flex-1 py-3 bg-[#ecb613] hover:bg-amber-500 disabled:bg-slate-105 dark:disabled:bg-slate-800 text-slate-950 disabled:text-slate-400 font-black rounded-xl text-xs transition-all hover:scale-[1.02] active:scale-[0.98] tracking-widest uppercase flex items-center justify-center gap-2 shadow-md shadow-amber-500/10 cursor-pointer"
                                >
                                    {isSavingAllocation ? (
                                        <>
                                            <Loader2 className="size-3.5 animate-spin" />
                                            <span>Saving Changes...</span>
                                        </>
                                    ) : (
                                        <span>Save Changes</span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. REVIEW TASK MODAL */}
                {isReviewModalOpen && selectedReviewStudent && selectedReviewAssignment && (
                    <div className="fixed inset-0 z-[350] flex items-end sm:items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                                <div className="flex items-center gap-3 text-left">
                                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-600 shrink-0">
                                        {selectedReviewStudent.student_pic ? (
                                            <img src={selectedReviewStudent.student_pic} alt={selectedReviewStudent.student_name} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-sm font-bold text-slate-500">{(selectedReviewStudent.student_name || 'U').charAt(0)}</span>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight font-mono">Review: {selectedReviewStudent.student_name}</h3>
                                        <p className="text-[11px] text-[#ecb613] font-bold mt-0.5 max-w-[285px] truncate" title={selectedReviewAssignment.title}>
                                            Task: {selectedReviewAssignment.title}
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setIsReviewModalOpen(false)} 
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-655 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-left">
                                {selectedReviewStudent.video_url && (
                                    <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 min-w-0">
                                            <PlayCircle className="w-4 h-4 shrink-0 text-indigo-650" />
                                            <span className="text-xs font-bold truncate">Submission Video URL</span>
                                        </div>
                                        <a 
                                            href={selectedReviewStudent.video_url} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="inline-flex items-center gap-1 text-[11px] font-black text-[#ecb613] hover:underline shrink-0 cursor-pointer"
                                        >
                                            <ExternalLink className="w-3 h-3" /> View
                                        </a>
                                    </div>
                                )}

                                {(selectedReviewAssignment.file_url || selectedReviewAssignment.inventory_ref_id) && (
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-202 dark:border-slate-700 rounded-xl flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 text-slate-655 dark:text-slate-405 min-w-0">
                                            {selectedReviewAssignment.inventory_ref_id ? (
                                                <BookOpen className="w-4 h-4 shrink-0 text-[#ecb613]" />
                                            ) : (
                                                <Paperclip className="w-4 h-4 shrink-0" />
                                            )}
                                            <span className="text-xs font-bold truncate" title={selectedReviewAssignment.inventory_ref_id ? selectedReviewAssignment.inventory_ref_title || 'Topic' : selectedReviewAssignment.file_name || 'Material'}>
                                                {selectedReviewAssignment.inventory_ref_id ? `Topic: ${selectedReviewAssignment.inventory_ref_title}` : (selectedReviewAssignment.file_name || 'Learning Material')}
                                            </span>
                                        </div>
                                        {selectedReviewAssignment.file_url ? (
                                            <a 
                                                href={selectedReviewAssignment.file_url} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="inline-flex items-center gap-1 text-[11px] font-black text-[#ecb613] hover:underline shrink-0 cursor-pointer"
                                            >
                                                <Download className="w-3 h-3" /> Download
                                            </a>
                                        ) : (
                                            <span className="text-[10px] text-amber-600 dark:text-amber-500 font-bold uppercase tracking-wider font-mono select-none">Curriculum</span>
                                        )}
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-505 dark:text-slate-400 uppercase tracking-widest mb-1.5">Score (Out of 10)</label>
                                        <input 
                                            className="w-full rounded-xl border border-slate-202 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-xs font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#ecb613]/25 focus:border-[#ecb613] outline-none transition-all text-slate-800 dark:text-slate-100" 
                                            type="number" 
                                            min="0" max="10" step="0.5" 
                                            placeholder="e.g. 8.5"
                                            value={reviewScore}
                                            onChange={(e) => setReviewScore(e.target.value === '' ? '' : Number(e.target.value))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-widest mb-1.5">Proficiency</label>
                                        <select 
                                            className="w-full rounded-xl border border-slate-202 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5 text-xs font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#ecb613]/25 focus:border-[#ecb613] outline-none transition-all text-slate-800 dark:text-slate-100 cursor-pointer"
                                            value={reviewProficiency}
                                            onChange={(e) => setReviewProficiency(e.target.value)}
                                        >
                                            <option value="">Select Level</option>
                                            <option value="Beginner">Beginner</option>
                                            <option value="Developing">Developing</option>
                                            <option value="Proficient">Proficient</option>
                                            <option value="Exemplary">Exemplary</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-505 dark:text-slate-400 uppercase tracking-widest mb-1.5">Feedback / Comments</label>
                                    <textarea 
                                        className="w-full rounded-xl border border-slate-202 dark:border-slate-700 bg-slate-50 dark:bg-slate-805/50 px-4 py-2.5 text-xs font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#ecb613]/25 focus:border-[#ecb613] outline-none transition-all resize-none text-slate-800 dark:text-slate-100" 
                                        rows={3} 
                                        placeholder="Add encouragement, areas of improvement..."
                                        value={reviewFeedback}
                                        onChange={(e) => setReviewFeedback(e.target.value)}
                                    ></textarea>
                                </div>

                                <div className="flex items-center gap-3 p-3.5 bg-rose-50 dark:bg-rose-955/10 rounded-xl border border-rose-100 dark:border-rose-900/40">
                                    <input 
                                        className="rounded text-rose-600 focus:ring-rose-500 h-4 w-4 border-slate-355 dark:border-slate-600 cursor-pointer" 
                                        type="checkbox" 
                                        id="review-reassign"
                                        checked={reviewReassign}
                                        onChange={(e) => setReviewReassign(e.target.checked)}
                                    />
                                    <label className="text-xs font-bold text-rose-808 dark:text-rose-455 flex flex-col cursor-pointer select-none" htmlFor="review-reassign text-left">
                                        Re-assign Task
                                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-455 mt-0.5 text-left">Mark as incomplete to request a resubmission.</span>
                                    </label>
                                </div>
                            </div>

                            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 flex-shrink-0">
                                <button
                                    onClick={() => setIsReviewModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-505 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveStudentReview}
                                    disabled={isSavingReview}
                                    className="px-5 py-2.5 rounded-xl text-xs font-black bg-[#ecb613] text-slate-900 hover:bg-amber-500 shadow-md shadow-[#ecb613]/10 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                                >
                                    {isSavingReview ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                    {isSavingReview ? 'Saving...' : 'Save Review'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 6. ASSIGNMENT COMPOSER MODAL */}
                {showAssignmentModal && (
                    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/10 flex-shrink-0">
                                <div className="flex items-center gap-2.5 text-left">
                                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-505">
                                        <ClipboardList className="size-5 text-[#ecb613]" />
                                    </div>
                                    <div>
                                        <h3 className="font-extrabold text-slate-905 dark:text-white text-base tracking-tight leading-none">{editingAssignmentId ? 'Edit Homework Assignment' : 'Create Homework Assignment'}</h3>
                                        <p className="text-[9px] text-slate-455 font-bold uppercase tracking-wider mt-1">{editingAssignmentId ? 'Update practice details & assignees' : 'Assign Practice Tasks & Checklists'}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={closeAssignmentModal} 
                                    className="p-1.5 rounded-lg text-slate-455 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                                >
                                    <X className="size-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-left custom-scrollbar">
                                <div className="space-y-1.5 text-left relative">
                                    <label className="block text-xs font-black text-slate-505 uppercase tracking-wide">Assignment Title *</label>
                                    <div className="relative flex items-center">
                                        <input 
                                            type="text" 
                                            placeholder="e.g., practice middle C scale, 20 mins daily"
                                            value={assignmentForm.title}
                                            onChange={e => handleAssignmentTitleChange(e.target.value)}
                                            onFocus={() => setShowSuggestions(true)}
                                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 pr-10 text-sm font-semibold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#ecb613]/25 focus:border-[#ecb613] outline-none transition-all text-slate-800 dark:text-slate-100"
                                        />
                                        <button
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => setShowSuggestions(prev => !prev)}
                                            className="absolute right-3 p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                                            title="Show previous tasks"
                                        >
                                            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showSuggestions ? 'rotate-180' : ''}`} />
                                        </button>
                                    </div>

                                    {showSuggestions && filteredPreviousTasks.length > 0 && (
                                        <div 
                                            onMouseDown={(e) => e.preventDefault()}
                                            className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50"
                                        >
                                            <div className="px-4 py-2 text-[10px] font-black text-slate-400 dark:text-slate-505 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/10 flex items-center justify-between">
                                                <span>Previous Tasks (Click to Reuse)</span>
                                                <span className="text-[9px] font-normal text-slate-400">{filteredPreviousTasks.length} available</span>
                                            </div>
                                            {filteredPreviousTasks.map(task => (
                                                <button
                                                    key={task.id}
                                                    type="button"
                                                    onClick={() => handleSelectPreviousTask(task)}
                                                    className="w-full text-left px-4 py-3 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 flex items-center justify-between transition-colors group cursor-pointer"
                                                >
                                                    <div className="flex-1 min-w-0 pr-4">
                                                        <div className="font-bold text-sm text-slate-800 dark:text-slate-205 truncate group-hover:text-amber-600 transition-colors">
                                                            {task.title}
                                                        </div>
                                                        {task.description && (
                                                            <div className="text-xs text-slate-505 dark:text-slate-400 truncate mt-0.5">
                                                                {task.description}
                                                            </div>
                                                        )}
                                                        {(task.file_name || task.file_url) && (
                                                            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1 mt-1">
                                                                <Paperclip className="w-3 h-3" />
                                                                <span className="truncate">{task.file_name || 'Attached Material / Voice Note'}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {task.status === 'draft' && (
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-505 tracking-wider shrink-0">Draft</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1.5 text-left">
                                    <label className="block text-xs font-black text-slate-505 uppercase tracking-wide">Instructions / Description</label>
                                    <textarea 
                                        rows={4}
                                        placeholder="Add instructions, helpful links, performance checklists..."
                                        value={assignmentForm.description}
                                        onChange={e => setAssignmentForm(prev => ({ ...prev, description: e.target.value }))}
                                        className="w-full rounded-xl border border-slate-202 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-sm font-semibold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#ecb613]/25 focus:border-[#ecb613] outline-none transition-all resize-none text-slate-800 dark:text-slate-100"
                                    ></textarea>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5 text-left">
                                        <label className="block text-xs font-black text-slate-505 uppercase tracking-wide">Due Date</label>
                                        <input 
                                            type="date"
                                            value={assignmentForm.due_date}
                                            onChange={e => setAssignmentForm(prev => ({ ...prev, due_date: e.target.value }))}
                                            className="w-full rounded-xl border border-slate-202 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-sm font-semibold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#ecb613]/25 focus:border-[#ecb613] outline-none transition-all text-slate-850 dark:text-slate-100"
                                        />
                                    </div>
                                    <div className="space-y-1.5 text-left">
                                        <label className="block text-xs font-black text-slate-550 uppercase tracking-wide">Assign To</label>
                                        <select 
                                            value={assignmentForm.target_type}
                                            onChange={e => setAssignmentForm(prev => ({ ...prev, target_type: e.target.value as any }))}
                                            className="w-full rounded-xl border border-slate-202 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-sm font-semibold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#ecb613]/25 focus:border-[#ecb613] outline-none transition-all text-slate-850 dark:text-slate-100 cursor-pointer"
                                        >
                                            <option value="all">All Enrolled Students</option>
                                            <option value="individual">Select Students</option>
                                        </select>
                                    </div>
                                </div>

                                {assignmentForm.target_type === 'individual' && students.length > 0 && (
                                    <div className="space-y-2 animate-in fade-in duration-200">
                                        <span className="block text-xs font-black text-slate-505 uppercase tracking-wide">Select Students *</span>
                                        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-202 dark:border-slate-750 max-h-[140px] overflow-y-auto space-y-1.5 custom-scrollbar">
                                            {students.map(s => {
                                                const isSelected = assignmentForm.selectedStudentIds.has(s.student_id);
                                                return (
                                                    <div 
                                                        key={s.id}
                                                        onClick={() => setAssignmentForm(prev => {
                                                            const ids = new Set(prev.selectedStudentIds);
                                                            if (isSelected) ids.delete(s.student_id);
                                                            else ids.add(s.student_id);
                                                            return { ...prev, selectedStudentIds: ids };
                                                        })}
                                                        className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-805 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg cursor-pointer select-none"
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                                                                {s.profile_pic_url ? (
                                                                    <img src={s.profile_pic_url} alt={s.name || 'Student'} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span className="text-[10px] font-bold text-slate-500">{(s.name || 'S').charAt(0)}</span>
                                                                )}
                                                            </div>
                                                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{s.name}</span>
                                                        </div>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={isSelected}
                                                            onChange={() => {}}
                                                            className="rounded text-amber-500 focus:ring-amber-400 size-3.5 cursor-pointer"
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2 text-left">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-xs font-black text-slate-505 uppercase tracking-wide">Attach Learning Material / Voice Note</label>
                                        <button 
                                            type="button"
                                            onClick={() => setShowAssignmentAudioRecorder(prev => !prev)}
                                            className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                                        >
                                            <Mic className="w-3.5 h-3.5" />
                                            {showAssignmentAudioRecorder ? 'Close Voice Recorder' : 'Record Voice Note'}
                                        </button>
                                    </div>

                                    {showAssignmentAudioRecorder && (
                                        <AudioRecorderWidget
                                            onAudioRecorded={(file) => {
                                                setAssignmentFile(file);
                                                setShowAssignmentAudioRecorder(false);
                                            }}
                                            onCancel={() => setShowAssignmentAudioRecorder(false)}
                                            label="Record Assignment Voice Note"
                                        />
                                    )}

                                    <div 
                                        onClick={() => assignmentFileRef.current?.click()}
                                        className="border-2 border-dashed border-slate-205 dark:border-slate-700/80 hover:border-[#ecb613]/50 rounded-2xl p-5 text-center cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-all flex flex-col items-center justify-center gap-1.5 group select-none"
                                    >
                                        <input 
                                            type="file" 
                                            className="hidden" 
                                            ref={assignmentFileRef} 
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    setAssignmentFile(e.target.files[0]);
                                                }
                                            }}
                                        />
                                        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:scale-105 transition-all">
                                            <Upload className="size-5" />
                                        </div>
                                        {assignmentFile ? (
                                            <div className="space-y-1">
                                                <p className="text-xs font-extrabold text-[#ecb613] truncate max-w-[320px]">{assignmentFile.name}</p>
                                                <p className="text-[10px] text-slate-405 font-mono">Size: {formatFileSize(assignmentFile.size)}</p>
                                            </div>
                                        ) : assignmentForm.file_url ? (
                                            <div className="space-y-1">
                                                <p className="text-xs font-extrabold text-[#ecb613] truncate max-w-[320px]">{assignmentForm.file_name || 'Attached Material / Voice Note'}</p>
                                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-center gap-1">
                                                    <CheckCircle className="w-3 h-3" /> Reused attachment from previous task
                                                </p>
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-355 group-hover:text-[#ecb613] transition-colors">Choose local file or drop here</p>
                                                <p className="text-[10px] text-slate-405 mt-0.5">PDF sheet music, audio tracks, lesson videos up to 50MB</p>
                                            </div>
                                        )}
                                    </div>
                                    {(assignmentFile || assignmentForm.file_url) && (
                                        <div className="mt-1 text-center">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setAssignmentFile(null);
                                                    setAssignmentForm(prev => ({ ...prev, file_url: null, file_name: null, file_size: null }));
                                                }}
                                                className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-700 hover:underline cursor-pointer"
                                            >
                                                <X className="w-3.5 h-3.5" /> Clear Attachment
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {assignmentError && (
                                    <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-955/20 border border-rose-200 dark:border-rose-800 rounded-xl">
                                        <AlertTriangle className="size-4 text-rose-500 flex-shrink-0" />
                                        <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{assignmentError}</p>
                                    </div>
                                )}
                            </div>

                            <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-950/20 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 flex-shrink-0">
                                <button
                                    onClick={closeAssignmentModal}
                                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-550 dark:text-slate-300 font-black rounded-xl text-[10px] tracking-wider uppercase transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateAssignment}
                                    disabled={isSavingAssignment || !assignmentForm.title.trim() || (assignmentForm.target_type === 'individual' && assignmentForm.selectedStudentIds.size === 0)}
                                    className="px-5 py-2.5 rounded-xl text-[10px] font-black tracking-wider uppercase bg-[#ecb613] hover:bg-amber-500 text-slate-900 shadow-md shadow-[#ecb613]/25 hover:shadow-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                                >
                                    {isSavingAssignment ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5 stroke-[3]" />}
                                    <span>{isSavingAssignment ? 'Saving...' : (editingAssignmentId ? 'Save Changes' : 'Assign Task')}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 7. CLASS NOTE EDITOR MODAL */}
                {showNoteEditor && (
                    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/10 flex-shrink-0">
                                <div className="flex items-center gap-2.5 text-left">
                                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-505">
                                        <StickyNote className="size-5 text-[#ecb613]" />
                                    </div>
                                    <div>
                                        <h3 className="font-extrabold text-slate-905 dark:text-white text-base tracking-tight leading-none">{editingNote ? 'Edit Practice Guideline' : 'Post Practice Guideline'}</h3>
                                        <p className="text-[9px] text-slate-455 font-bold uppercase tracking-wider mt-1">Classroom Board & Feed Notes</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setShowNoteEditor(false)} 
                                    className="p-1.5 rounded-lg text-slate-455 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                                >
                                    <X className="size-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-left custom-scrollbar">
                                <div className="space-y-1.5 text-left">
                                    <label className="block text-xs font-black text-slate-550 uppercase tracking-wide">Headline Title *</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. Raag Yaman Alankar daily exercises"
                                        value={noteForm.title}
                                        onChange={e => setNoteForm(prev => ({ ...prev, title: e.target.value }))}
                                        className="w-full rounded-xl border border-slate-202 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-sm font-semibold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#ecb613]/25 focus:border-[#ecb613] outline-none transition-all text-slate-808 dark:text-slate-100"
                                    />
                                </div>

                                <div className="space-y-1.5 text-left">
                                    <label className="block text-xs font-black text-slate-550 uppercase tracking-wide">Detailed Guidelines / Checklist</label>
                                    <textarea 
                                        rows={4}
                                        placeholder="Write instructions, pointers, scale references, metronome speeds..."
                                        value={noteForm.content}
                                        onChange={e => setNoteForm(prev => ({ ...prev, content: e.target.value }))}
                                        className="w-full rounded-xl border border-slate-202 dark:border-slate-700 bg-slate-50 dark:bg-slate-805/50 px-4 py-2.5 text-sm font-semibold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#ecb613]/25 focus:border-[#ecb613] outline-none transition-all resize-none text-slate-808 dark:text-slate-100"
                                    ></textarea>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5 text-left">
                                        <label className="block text-xs font-black text-slate-550 uppercase tracking-wide">Board Color Category</label>
                                        <div className="flex items-center gap-2">
                                            {([
                                                { key: 'yellow', label: 'Yellow', dot: 'bg-amber-400', border: 'border-amber-400' },
                                                { key: 'blue', label: 'Blue', dot: 'bg-blue-400', border: 'border-blue-400' },
                                                { key: 'green', label: 'Green', dot: 'bg-emerald-500', border: 'border-emerald-500' },
                                                { key: 'pink', label: 'Pink', dot: 'bg-pink-400', border: 'border-pink-405' },
                                            ] as const).map(colorOpt => {
                                                const isActive = noteForm.color === colorOpt.key;
                                                return (
                                                    <button
                                                        key={colorOpt.key}
                                                        type="button"
                                                        onClick={() => setNoteForm(prev => ({ ...prev, color: colorOpt.key }))}
                                                        className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center cursor-pointer ${
                                                            isActive ? colorOpt.border : 'border-transparent bg-slate-100 dark:bg-slate-800'
                                                        }`}
                                                        title={colorOpt.label}
                                                    >
                                                        <span className={`w-3.5 h-3.5 rounded-full ${colorOpt.dot}`} />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2 text-left">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-xs font-black text-slate-550 uppercase tracking-wide">Attach Learning Sheet / PDF / Voice Note</label>
                                        <button 
                                            type="button"
                                            onClick={() => setShowNoteAudioRecorder(prev => !prev)}
                                            className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                                        >
                                            <Mic className="w-3.5 h-3.5" />
                                            {showNoteAudioRecorder ? 'Close Voice Recorder' : 'Record Voice Note'}
                                        </button>
                                    </div>

                                    {showNoteAudioRecorder && (
                                        <AudioRecorderWidget
                                            onAudioRecorded={(file) => {
                                                setNoteFile(file);
                                                setShowNoteAudioRecorder(false);
                                            }}
                                            onCancel={() => setShowNoteAudioRecorder(false)}
                                            label="Record Board Voice Note"
                                        />
                                    )}

                                    <div 
                                        onClick={() => noteFileRef.current?.click()}
                                        className="border-2 border-dashed border-slate-205 dark:border-slate-700/80 hover:border-[#ecb613]/50 rounded-2xl p-5 text-center cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-all flex flex-col items-center justify-center gap-1.5 group select-none"
                                    >
                                        <input 
                                            type="file" 
                                            className="hidden" 
                                            ref={noteFileRef} 
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    setNoteFile(e.target.files[0]);
                                                }
                                            }}
                                        />
                                        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-405 dark:text-slate-500 group-hover:scale-105 transition-all">
                                            <Upload className="size-5" />
                                        </div>
                                        {noteFile ? (
                                            <div className="space-y-1">
                                                <p className="text-xs font-extrabold text-[#ecb613] truncate max-w-[320px]">{noteFile.name}</p>
                                                <p className="text-[10px] text-slate-405 font-mono">Size: {formatFileSize(noteFile.size)}</p>
                                            </div>
                                        ) : editingNote?.file_url ? (
                                            <div className="space-y-1">
                                                <p className="text-xs font-extrabold text-[#ecb613] truncate max-w-[320px]">{editingNote.file_name || 'Keep current attached resource'}</p>
                                                <p className="text-[10px] text-slate-405 font-mono">Size: {formatFileSize(editingNote.file_size)}</p>
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-355 group-hover:text-[#ecb613] transition-colors">Choose local file or drop here</p>
                                                <p className="text-[10px] text-slate-405 mt-0.5">PDF sheet music, audio tracks, lesson videos up to 50MB</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {noteError && (
                                    <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-955/20 border border-rose-200 dark:border-rose-800 rounded-xl">
                                        <AlertTriangle className="size-4 text-rose-505 flex-shrink-0" />
                                        <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{noteError}</p>
                                    </div>
                                )}
                            </div>

                            <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-955/20 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 flex-shrink-0">
                                <button
                                    onClick={() => setShowNoteEditor(false)}
                                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-202 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-550 dark:text-slate-305 font-black rounded-xl text-[10px] tracking-wider uppercase transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveNote}
                                    disabled={isSavingNote || !noteForm.title.trim()}
                                    className="px-5 py-2.5 rounded-xl text-[10px] font-black tracking-wider uppercase bg-[#ecb613] hover:bg-amber-500 text-slate-900 shadow-md shadow-[#ecb613]/25 hover:shadow-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                                >
                                    {isSavingNote ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                                    <span>{isSavingNote ? 'Saving...' : editingNote ? 'Save Guideline' : 'Post Guideline'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 8. DATABASE SETUP WARNING */}
                {dbSetupError && (
                    <div className="fixed bottom-6 left-6 z-[300] bg-rose-50 dark:bg-rose-955/25 border-2 border-rose-200 dark:border-rose-900/60 p-5 rounded-2xl max-w-md shadow-xl flex gap-3.5 text-left animate-in slide-in-from-bottom-4 duration-300">
                        <AlertTriangle className="w-6 h-6 text-rose-505 flex-shrink-0 mt-0.5" />
                        <div className="space-y-1.5">
                            <h4 className="text-xs font-black text-rose-905 dark:text-rose-455 uppercase tracking-wide">Supabase Database Out of Sync</h4>
                            <p className="text-[11px] text-slate-655 dark:text-slate-300 leading-relaxed font-semibold">
                                The database tables for assignments, student progress, or class logs may not have been created or migration is incomplete.
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                Please check your Supabase migrations or execute local schema setup files.
                            </p>
                        </div>
                    </div>
                )}

                {/* Global floating message toast */}
                {messageNotification && (
                    <div className="fixed bottom-6 right-6 z-[300] bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-800 dark:border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-sm select-text">
                        {messageNotification.type === 'success' ? (
                            <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                        ) : (
                            <Info className="w-5 h-5 text-red-500 shrink-0" />
                        )}
                        <p className="text-xs font-bold leading-relaxed">{messageNotification.text}</p>
                    </div>
                )}
            </main>
        </div>
    );
}
