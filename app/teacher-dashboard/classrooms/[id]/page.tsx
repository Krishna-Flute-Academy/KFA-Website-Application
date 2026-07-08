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
    User, ChevronUp, ChevronDown, Paperclip, Upload, StickyNote
} from 'lucide-react';
import Link from 'next/link';
import TeacherSidebar from '../../../../src/components/TeacherSidebar';
import { CourseCategory, INITIAL_CATEGORIES, INITIAL_MODULES, INITIAL_CHAPTERS, INITIAL_LESSONS } from '../../inventory/initial-data';
import { sendClassroomNotification } from '../../../../src/lib/notifications';

// Tab components
import OverviewTab from '../../../../src/components/classroom/OverviewTab';
import CurriculumTab from '../../../../src/components/classroom/CurriculumTab';
import StudentsTab from '../../../../src/components/classroom/StudentsTab';
import AssignmentsTab from '../../../../src/components/classroom/AssignmentsTab';
import AttendanceTab from '../../../../src/components/classroom/AttendanceTab';
import ClassLogsTab from '../../../../src/components/classroom/ClassLogsTab';
import SettingsTab from '../../../../src/components/classroom/SettingsTab';
import ClassroomChatTab from '../../../../src/components/classroom/ClassroomChatTab';

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
    mock_milestone: string;
    mock_status: 'Consistent' | 'Improving' | 'At Risk';
    level?: string;
    is_makeup?: boolean;
}

interface DirectoryStudent {
    id: string;
    name: string;
    profile_pic_url: string | null;
    status: string;
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
    const [refreshTrigger, setRefreshTrigger] = useState(0);

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

    // Fetch broadcasts for this class & listen to real-time updates
    useEffect(() => {
        if (!teacherProfile || !classroomId) return;
        
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

        const channel = supabaseAuth
            .channel(`classroom-broadcasts-${classroomId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'broadcasts' },
                () => {
                    fetchClassroomBroadcasts();
                }
            )
            .subscribe();

        return () => {
            supabaseAuth.removeChannel(channel);
        };
    }, [teacherProfile, classroomId]);

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
        if (!teacherProfile || !classroomId) return;

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
                () => {
                    fetchClassroomMessages();
                }
            )
            .subscribe();

        return () => {
            supabaseAuth.removeChannel(channel);
        };
    }, [teacherProfile, classroomId, fetchClassroomMessages]);

    const handleSendClassroomChatMessage = async (messageText: string) => {
        if (!teacherProfile?.id || !classroomId || !messageText.trim()) return;

        setIsSendingClassroomMessage(true);
        try {
            const { error } = await supabaseAuth
                .from('classroom_messages')
                .insert({
                    classroom_id: classroomId,
                    sender_id: teacherProfile.id,
                    message_text: messageText.trim()
                });

            if (error) throw error;
            await fetchClassroomMessages();
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
                .select();
            if (error) throw error;
            
            if (data && data.length > 0) {
                setClassBroadcasts(prev => [data[0], ...prev]);
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
    const [allocationTargetLesson, setAllocationTargetLesson] = useState<any | null>(null);
    const [allocationTargetType, setAllocationTargetType] = useState<'classwide' | 'individual'>('classwide');
    const [allocationStatus, setAllocationStatus] = useState<'locked' | 'unlocked' | 'completed'>('locked');
    const [allocationSelectedStudents, setAllocationSelectedStudents] = useState<string[]>([]);
    const [allocationSearchQuery, setAllocationSearchQuery] = useState('');
    const [isSavingAllocation, setIsSavingAllocation] = useState(false);

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

    const openAllocationDrawer = (lesson: any) => {
        setAllocationTargetLesson(lesson);
        const targetType = curriculumTab === 'individual' ? 'individual' : 'classwide';
        setAllocationTargetType(targetType);

        let initialStatus: 'locked' | 'unlocked' | 'completed' = 'locked';
        const progressForLesson = studentProgress.filter(p => p.lesson_id === lesson.id);
        if (students.length === 0) {
            const classwideRow = progressForLesson.find(p => p.student_id === 'classwide_default');
            if (classwideRow) {
                if (classwideRow.status === 'completed') initialStatus = 'completed';
                else if (classwideRow.status === 'unlocked') initialStatus = 'unlocked';
            }
        } else {
            const completedCount = progressForLesson.filter(p => p.status === 'completed' && p.student_id !== 'classwide_default').length;
            const unlockedCount = progressForLesson.filter(p => p.status === 'unlocked' && p.student_id !== 'classwide_default').length;
            if (completedCount === students.length) {
                initialStatus = 'completed';
            } else if (completedCount > 0 || unlockedCount > 0) {
                initialStatus = 'unlocked';
            }
        }

        setAllocationStatus(initialStatus);

        const currentSelected = (curriculumTab === 'individual' && selectedStudentForCurriculum)
            ? [selectedStudentForCurriculum.student_id]
            : getStudentsWithStatus(initialStatus, lesson.id);

        setAllocationSelectedStudents(currentSelected);
        setIsAllocationDrawerOpen(true);
    };
    const [showAssignmentModal, setShowAssignmentModal] = useState(false);
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
    };

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

    const activeAttendanceRoster = useMemo(() => {
        const list = [...students];
        const matchingOverrides = sessionOverrides.filter(
            o => o.override_date === attendanceDate
        );
        matchingOverrides.forEach(o => {
            if (!list.some(s => s.student_id === o.student_id)) {
                const level = o.users?.level || 'Level 1';
                list.push({
                    id: `override-${o.id}`,
                    student_id: o.student_id,
                    name: `${o.users?.name || 'Unknown'} (Makeup)`,
                    profile_pic_url: o.users?.profile_pic_url || null,
                    level: level,
                    joined_at: o.override_date,
                    mock_score: 8.0,
                    mock_progress: 75,
                    mock_attendance: 90,
                    mock_milestone: 'Makeup Session',
                    mock_status: 'Consistent',
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

                setTeacherProfile(profile);
                if (!profile) return;
                if (roomError) throw roomError;

                // Authorization check
                if (profile.role !== 'admin' && roomData.teacher_id !== profile.id) {
                    throw new Error('Unauthorized classroom access');
                }

                // 3. Run Core Queries in Parallel (Phase 2)
                const promises: any[] = [
                    // P0: Teacher name if teacher_id is set
                    roomData.teacher_id
                        ? supabaseAuth.from('users').select('name').eq('id', roomData.teacher_id).maybeSingle()
                        : Promise.resolve({ data: null }),

                    // P1: Roster check
                    roomData.type === 'temporary'
                        ? supabaseAuth.from('temporary_classes').select('id, class_date, start_time, end_time').eq('classroom_id', classroomId).maybeSingle()
                        : Promise.resolve({ data: null }),

                    // P2: Enrolled students list
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

                    // P3: Session Student Overrides list
                    supabaseAuth.from('session_student_overrides').select(`
                        id,
                        student_id,
                        override_date,
                        reason,
                        users!student_id(name, profile_pic_url, level)
                    `).eq('target_classroom_id', classroomId).order('override_date', { ascending: true }),

                    // P4: Batch schedules
                    supabaseAuth.from('batch_schedules').select('*').eq('classroom_id', classroomId).order('day_of_week', { ascending: true }).order('start_time', { ascending: true }),

                    // P5: Categories
                    supabaseAuth.from('course_categories').select('*').order('category_order', { ascending: true }),

                    // P6: Modules
                    supabaseAuth.from('course_modules').select('*').order('module_number', { ascending: true }),

                    // P7: Chapters
                    supabaseAuth.from('course_chapters').select('*').order('chapter_number', { ascending: true }),

                    // P8: Lessons
                    supabaseAuth.from('course_lessons').select('*').order('lesson_number', { ascending: true }),

                    // P9: Assignments
                    supabaseAuth.from('assignments').select('*').eq('classroom_id', classroomId).order('created_at', { ascending: false })
                ];

                const [
                    teacherRes,
                    tempClassRes,
                    rosterRes,
                    overridesRes,
                    schedulesRes,
                    categoriesRes,
                    modulesRes,
                    chaptersRes,
                    lessonsRes,
                    asgRes
                ] = await Promise.all(promises);

                // Process P0 (Teacher Name)
                const teacherName = teacherRes.data?.name || '';
                const tempClassData = tempClassRes.data;
                const roster = rosterRes.data || [];
                const overridesData = overridesRes.data || [];

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

                // Map temporary classes date onto roster if temporary
                const finalRoster = (roomData.type === 'temporary' && tempClassData)
                    ? roster.map((r: any) => ({ ...r, joined_at: tempClassData.class_date }))
                    : roster;

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

                // Build Enrolled Students with Mock metrics
                const milestoneOptions = ['Alankars Mastery', 'Breath Control II', 'Fingering Basics', 'Rhythm Training', 'Raag Yaman Intros'];
                const formattedRoster = finalRoster.map((r: any, idx: number) => {
                    const seed = parseInt(r.id.substring(0, 8), 16) || idx;
                    const rawLevel = r.users?.level || 'Level 1';
                    const formattedLevel = rawLevel.toLowerCase().startsWith('level')
                        ? (rawLevel.charAt(0).toUpperCase() + rawLevel.slice(1))
                        : (rawLevel.charAt(0).toUpperCase() + rawLevel.slice(1));

                    return {
                        id: r.id,
                        student_id: r.student_id,
                        name: r.users?.name || 'Unknown',
                        profile_pic_url: r.users?.profile_pic_url || null,
                        level: formattedLevel,
                        joined_at: r.joined_at,
                        mock_score: 6 + ((seed % 40) / 10),
                        mock_progress: 50 + (seed % 50),
                        mock_attendance: 70 + (seed % 30),
                        mock_milestone: milestoneOptions[seed % milestoneOptions.length],
                        mock_status: idx % 3 === 0 ? 'Consistent' : (idx % 2 === 0 ? 'Improving' : 'At Risk') as any
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

                let dbModulesData = modulesRes.data || [];
                let dbChaptersData = chaptersRes.data || [];
                let dbLessonsData = lessonsRes.data || [];

                if (dbModulesData.length === 0) {
                    try {
                        await supabaseAuth.from('course_modules').insert(INITIAL_MODULES);
                        await supabaseAuth.from('course_chapters').insert(INITIAL_CHAPTERS);
                        await supabaseAuth.from('course_lessons').insert(INITIAL_LESSONS);

                        const [seedModules, seedChapters, seedLessons] = await Promise.all([
                            supabaseAuth.from('course_modules').select('*').order('module_number', { ascending: true }),
                            supabaseAuth.from('course_chapters').select('*').order('chapter_number', { ascending: true }),
                            supabaseAuth.from('course_lessons').select('*').order('lesson_number', { ascending: true })
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
                if (dbModulesData.length === INITIAL_MODULES.length) {
                    setCategories(INITIAL_CATEGORIES);
                }
                setCourseModules(dbModulesData);
                setCourseChapters(dbChaptersData);
                setCourseLessons(dbLessonsData);

                // 4. Fetch Home Classroom IDs of all students (so we can get curriculum allocations)
                let classroomIds = [classroomId];
                const studentIds = [
                    ...formattedRoster.map(s => s.student_id),
                    ...(overridesData || []).map((o: any) => o.student_id)
                ];
                
                if (studentIds.length > 0) {
                    try {
                        const { data: homeRooms } = await supabaseAuth
                            .from('classroom_students')
                            .select('classroom_id')
                            .in('student_id', studentIds);
                        if (homeRooms) {
                            const ids = homeRooms.map(r => r.classroom_id).filter(Boolean);
                            classroomIds = Array.from(new Set([classroomId, ...ids]));
                        }
                    } catch (e) {
                        console.error('Failed to load home classrooms:', e);
                    }
                }
                setActiveClassroomIds(classroomIds);

                // 5. Phase 3 Parallel Fetches (Dependent on Student IDs / Classroom IDs list)
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

                    // Enriched Assignments query
                    (async () => {
                        try {
                            const asgData = asgRes.data || [];
                            const enriched = await Promise.all(asgData.map(async (a: Assignment) => {
                                if (a.target_type === 'individual') {
                                    const { data: asData } = await supabaseAuth
                                        .from('assignment_students')
                                        .select('*')
                                        .eq('assignment_id', a.id);
                                    const enrichedStudents = (asData || []).map((as: AssignmentStudent) => {
                                        const match = formattedRoster.find(s => s.student_id === as.student_id);
                                        return { ...as, student_name: match?.name || 'Unknown', student_pic: match?.profile_pic_url || null };
                                    });
                                    return { ...a, assignment_students: enrichedStudents };
                                }
                                return { ...a, assignment_students: [] };
                            }));
                            setAssignments(enriched);
                        } catch (ae) {
                            console.warn('Could not enrich assignments:', ae);
                        }
                    })(),

                    // Fetch classroom allocations
                    (async () => {
                        try {
                            const { data: curriculumData, error: curriculumError } = await supabaseAuth
                                .from('classroom_inventory_allocation')
                                .select('*')
                                .in('classroom_id', classroomIds);
                            if (!curriculumError && curriculumData) {
                                setClassroomInventoryAllocations(curriculumData);
                            } else if (curriculumError) {
                                console.error('Fetch classroom_inventory_allocation error:', curriculumError);
                                setDbSetupError(true);
                            }
                        } catch (ce) {
                            console.warn('Could not fetch classroom_inventory_allocation:', ce);
                        }
                    })()
                ];

                await Promise.all(phase3Promises);

            } catch (err) {
                console.error('Error fetching classroom data:', err);
                router.push('/teacher-dashboard/classrooms');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [classroomId, router, refreshTrigger]);

    // Re-sync classroom data on window focus, visibility change, or periodic background poll
    useEffect(() => {
        const handleFocusOrVisible = () => {
            console.log('[Teacher Sync] Window focused or visible. Triggering dashboard refresh...');
            setRefreshTrigger(prev => prev + 1);
        };

        window.addEventListener('focus', handleFocusOrVisible);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                handleFocusOrVisible();
            }
        });

        // Periodic background poll every 60 seconds as an ultimate fallback
        const intervalId = setInterval(() => {
            console.log('[Teacher Sync] Running periodic background poll...');
            setRefreshTrigger(prev => prev + 1);
        }, 60000);

        return () => {
            window.removeEventListener('focus', handleFocusOrVisible);
            document.removeEventListener('visibilitychange', handleFocusOrVisible);
            clearInterval(intervalId);
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

            const enriched = await Promise.all((asgData || []).map(async (a: Assignment) => {
                const { data: asData } = await supabaseAuth
                    .from('assignment_students')
                    .select('*')
                    .eq('assignment_id', a.id);
                
                const existingRows = asData || [];

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
            }));

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
            const { data, error } = await supabaseAuth
                .from('classroom_inventory_allocation')
                .select('*')
                .in('classroom_id', activeClassroomIds);
            if (error) {
                console.error('Error fetching curriculum allocations:', error.message);
                setDbSetupError(true);
                return;
            }
            setClassroomInventoryAllocations(data || []);
        } catch (err: any) {
            console.error('Error fetching curriculum allocations (exception):', err?.message || err);
        }
    }, [classroomId, activeClassroomIds]);

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
            const { data, error } = await supabaseAuth
                .from('attendance')
                .select('student_id, status')
                .eq('classroom_id', classroomId)
                .eq('date', attendanceDate);

            if (error) {
                console.error('Error fetching classroom attendance:', error.message);
                return;
            }

            const recordsMap: Record<string, 'present' | 'absent' | 'late' | 'excused'> = {};
            (data || []).forEach((row: any) => {
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
    const handleMarkClassroomAttendance = async (studentId: string, status: string) => {
        if (!classroomId || !teacherProfile) return;

        // Optimistically update status
        setAttendanceRecords(prev => ({ ...prev, [studentId]: status as any }));
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
                .eq('role', 'student');

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
                .eq('role', 'student');

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
                .eq('role', 'student');

            const { data, error } = teacherProfile.role === 'admin'
                ? await usersQuery
                : await usersQuery.eq('teacher_id', teacherProfile.id);

            if (error) throw error;
            const available = (data || []).filter((s: any) => !enrolledIds.has(s.id));
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
                    return {
                        id: `temp-${ds.id}`,
                        student_id: ds.id,
                        name: ds.name,
                        profile_pic_url: ds.profile_pic_url,
                        joined_at: classroom?.class_date || new Date().toISOString(),
                        mock_score: 6 + ((seed % 40) / 10),
                        mock_progress: 50 + (seed % 50),
                        mock_attendance: 70 + (seed % 30),
                        mock_milestone: milestoneOptions[seed % milestoneOptions.length],
                        mock_status: idx % 3 === 0 ? 'Consistent' : (idx % 2 === 0 ? 'Improving' : 'At Risk') as any,
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

    // ── Create Assignment ──────────────────────────────────────────────────────
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
            let studentIdsToAssign: string[] = [];

            if (assignmentForm.target_type === 'all') {
                studentIdsToAssign = students.map(s => s.student_id);
            } else if (assignmentForm.target_type === 'individual') {
                studentIdsToAssign = Array.from(assignmentForm.selectedStudentIds);
            }

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

            closeAssignmentModal();
        } catch (err: any) {
            console.error('Error creating assignment:', err);
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
        const inventoryItems = classroomInventoryAllocations.map(item => {
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
                title: title,
                description: description,
                due_date: null,
                target_type: item.allocated_to_student_id ? 'individual' : 'all',
                created_at: item.created_at,
                inventory_ref_type: type,
                inventory_ref_id: refId,
                inventory_ref_title: title,
                assignment_students: item.allocated_to_student_id ? [{ student_id: item.allocated_to_student_id }] : []
            };
        });

        if (curriculumTab === 'classwide') {
            return inventoryItems.filter(a => a.target_type === 'all');
        } else {
            if (!selectedStudentForCurriculum) return [];
            return inventoryItems.filter(a => {
                if (a.target_type === 'all') return true;
                return a.assignment_students?.some(
                    s => s.student_id === selectedStudentForCurriculum.student_id
                );
            });
        }
    }, [classroomInventoryAllocations, curriculumTab, selectedStudentForCurriculum, courseModules, courseChapters, courseLessons]);

    const selectedStudentPermissions = useMemo(() => {
        const completed = new Set<string>();
        const unlocked = new Set<string>();

        if (selectedStudentForCurriculum) {
            const studentId = selectedStudentForCurriculum.student_id;
            studentProgress.forEach(p => {
                if (p.student_id === studentId) {
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
        let statusLabel = "Locked";
        let cardBorder = "border-slate-200/60 dark:border-slate-800/60 bg-slate-50/10 dark:bg-slate-900/[0.02] opacity-60 hover:opacity-100 transition-all duration-300";

        if (curriculumTab === 'individual' && selectedStudentForCurriculum) {
            isCompleted = selectedStudentPermissions.completedLessons.has(lessonId);
            isUnlocked = selectedStudentPermissions.unlockedLessons.has(lessonId);
            if (isCompleted) {
                statusLabel = "Completed";
                cardBorder = "border-emerald-500/30 dark:border-emerald-500/20 bg-emerald-50/[0.1] dark:bg-emerald-950/[0.03] shadow-[0_2px_8px_rgba(16,185,129,0.01)] hover:border-emerald-500/50 transition-all duration-300";
            } else if (isUnlocked) {
                statusLabel = "Unlocked";
                cardBorder = "border-amber-500/30 dark:border-[#ecb613]/25 bg-amber-50/[0.1] dark:bg-[#ecb613]/[0.01] shadow-[0_2px_8px_rgba(245,158,11,0.01)] hover:border-amber-500/50 hover:border-[#ecb613]/50 transition-all duration-300";
            }
        } else {
            const progressForLesson = studentProgress.filter(p => p.lesson_id === lessonId);
            if (students.length === 0) {
                const classwideRow = progressForLesson.find(p => p.student_id === 'classwide_default');
                if (classwideRow) {
                    if (classwideRow.status === 'completed') {
                        statusLabel = "Completed";
                        cardBorder = "border-emerald-500/30 dark:border-emerald-500/20 bg-emerald-50/[0.1] dark:bg-emerald-950/[0.03] shadow-[0_2px_8px_rgba(16,185,129,0.01)] hover:border-emerald-500/50 transition-all duration-300";
                    } else if (classwideRow.status === 'unlocked') {
                        statusLabel = "Unlocked";
                        cardBorder = "border-amber-500/30 dark:border-[#ecb613]/25 bg-amber-50/[0.1] dark:bg-[#ecb613]/[0.01] shadow-[0_2px_8px_rgba(245,158,11,0.01)] hover:border-amber-500/50 hover:border-[#ecb613]/50 transition-all duration-300";
                    } else {
                        statusLabel = "Locked";
                    }
                } else {
                    statusLabel = "Locked";
                }
            } else {
                const completedCount = progressForLesson.filter(p => p.status === 'completed' && p.student_id !== 'classwide_default').length;
                const unlockedCount = progressForLesson.filter(p => p.status === 'unlocked' && p.student_id !== 'classwide_default').length;

                if (completedCount === students.length) {
                    statusLabel = "Completed";
                    cardBorder = "border-emerald-500/30 dark:border-emerald-500/20 bg-emerald-50/[0.1] dark:bg-emerald-950/[0.03] shadow-[0_2px_8px_rgba(16,185,129,0.01)] hover:border-emerald-500/50 transition-all duration-300";
                } else if (completedCount > 0 || unlockedCount > 0) {
                    statusLabel = completedCount > 0 ? `Unlocked (${completedCount}/${students.length} Done)` : "Unlocked";
                    cardBorder = "border-amber-500/30 dark:border-[#ecb613]/25 bg-amber-50/[0.1] dark:bg-[#ecb613]/[0.01] shadow-[0_2px_8px_rgba(245,158,11,0.01)] hover:border-amber-500/50 hover:border-[#ecb613]/50 transition-all duration-300";
                } else {
                    statusLabel = "Locked";
                    cardBorder = "border-slate-200/60 dark:border-slate-800/60 bg-slate-50/10 dark:bg-slate-900/[0.02] opacity-60 hover:opacity-100 transition-all duration-300";
                }
            }
        }

        const isCompletedLabel = statusLabel === "Completed";
        const isUnlockedLabel = statusLabel === "Unlocked" || statusLabel.startsWith("Unlocked");

        const badgeStyle = isCompletedLabel
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30"
            : isUnlockedLabel
            ? "bg-amber-500/10 text-amber-600 dark:text-[#ecb613] border-amber-500/20 dark:border-[#ecb613]/30"
            : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200/60 dark:border-slate-700/60";

        const textStyle = isCompletedLabel
            ? "text-emerald-600 dark:text-emerald-400"
            : isUnlockedLabel
            ? "text-amber-600 dark:text-[#ecb613]"
            : "text-slate-400 dark:text-slate-500";

        return {
            statusLabel,
            cardBorder,
            badgeStyle,
            textStyle,
            isLocked: statusLabel === "Locked",
            isUnlocked: isUnlockedLabel,
            isCompleted: isCompletedLabel
        };
    }, [curriculumTab, selectedStudentForCurriculum, selectedStudentPermissions, studentProgress, students]);

    const visibleCurriculum = useMemo(() => {
        const categoriesMap: Record<string, {
            categoryName: string;
            categoryOrder: number;
            modules: any[];
        }> = {};

        const query = curriculumSearchQuery.toLowerCase().trim();

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

        const filterLesson = (lessonId: string) => {
            if (curriculumTab === 'individual' && selectedStudentForCurriculum) {
                const isCompleted = selectedStudentPermissions.completedLessons.has(lessonId);
                const isUnlocked = selectedStudentPermissions.unlockedLessons.has(lessonId);
                return isCompleted || isUnlocked;
            }
            return true;
        };

        courseModules.forEach(mod => {
            const modAlloc = allocatedInventoryItems.find(
                a => a.inventory_ref_type === 'module' && a.inventory_ref_id === mod.id
            );

            const { categoryName, categoryOrder } = getCategoryInfo(mod);
            const isCategoryMatch = query ? categoryName.toLowerCase().includes(query) : false;
            const isModuleMatch = query ? mod.title.toLowerCase().includes(query) : false;

            const modChapters = courseChapters.filter(c => c.module_id === mod.id);
            const chapterNodes: any[] = [];

            modChapters.forEach(chap => {
                const chapAlloc = allocatedInventoryItems.find(
                    a => a.inventory_ref_type === 'chapter' && a.inventory_ref_id === chap.id
                );

                const isChapterMatch = query ? (
                    chap.title.toLowerCase().includes(query) ||
                    `ch${chap.chapter_number}`.includes(query) ||
                    `chapter ${chap.chapter_number}`.includes(query)
                ) : false;

                const chapLessons = courseLessons.filter(l => l.chapter_id === chap.id);
                const lessonNodes: any[] = [];

                chapLessons.forEach(lesson => {
                    const lessonAlloc = allocatedInventoryItems.find(
                        a => a.inventory_ref_type === 'lesson' && a.inventory_ref_id === lesson.id
                    );

                    const isLessonAllocated = !!modAlloc || !!chapAlloc || !!lessonAlloc;

                    if (isLessonAllocated && filterLesson(lesson.id)) {
                        const isLessonMatch = query ? (
                            lesson.title.toLowerCase().includes(query) ||
                            (lesson.description || '').toLowerCase().includes(query) ||
                            `topic ${lesson.lesson_number}`.includes(query)
                        ) : false;

                        const matchesSearch = !query || isCategoryMatch || isModuleMatch || isChapterMatch || isLessonMatch;

                        if (matchesSearch) {
                            lessonNodes.push({
                                ...lesson,
                                allocationId: lessonAlloc ? lessonAlloc.id : null,
                                isExplicit: !!lessonAlloc
                            });
                        }
                    }
                });

                const isChapterVisible = !!modAlloc || !!chapAlloc || lessonNodes.length > 0;

                if (isChapterVisible && (!query || isCategoryMatch || isModuleMatch || isChapterMatch || lessonNodes.length > 0)) {
                    chapterNodes.push({
                        ...chap,
                        allocationId: chapAlloc ? chapAlloc.id : null,
                        isExplicit: !!chapAlloc,
                        lessons: lessonNodes.sort((a, b) => a.lesson_number - b.lesson_number)
                    });
                }
            });

            const isModuleVisible = !!modAlloc || chapterNodes.length > 0;

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
        if (syllabusLessons.length === 0) return defaultMockVal;
        const completedCount = syllabusLessons.filter(lesson => {
            const row = studentProgress.find(p => p.student_id === studentId && p.lesson_id === lesson.id);
            return row && row.status === 'completed';
        }).length;
        return Math.round((completedCount / syllabusLessons.length) * 100);
    }, [syllabusLessons, studentProgress]);

    const livePreviewData = useMemo(() => {
        if (!selectedStudentForCurriculum) return null;

        const totalLessons = syllabusLessons.length;
        const completedCount = syllabusLessons.filter(l => selectedStudentPermissions.completedLessons.has(l.id)).length;
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
        const lessonId = allocationTargetLesson.id;

        try {
            if (allocationTargetType === 'classwide') {
                await handleToggleTopicLockClasswide(lessonId, allocationStatus);
            } else {
                if (activeAttendanceRoster.length === 0) {
                    const fallbackRow = {
                        student_id: 'classwide_default',
                        classroom_id: classroomId,
                        lesson_id: lessonId,
                        status: allocationStatus,
                        unlocked_by: 'manual',
                        unlocked_at: allocationStatus !== 'locked' ? new Date().toISOString() : null,
                        completed_at: allocationStatus === 'completed' ? new Date().toISOString() : null
                    };
                    setStudentProgress(prev => {
                        const filtered = prev.filter(p => p.lesson_id !== lessonId);
                        return [...filtered, fallbackRow];
                    });
                    alert('Classroom has no students. Pacing saved to default setting in-memory!');
                    setIsAllocationDrawerOpen(false);
                    return;
                }

                const targetStudentIds = (curriculumTab === 'individual' && selectedStudentForCurriculum)
                    ? [selectedStudentForCurriculum.student_id]
                    : activeAttendanceRoster.map(s => s.student_id);

                const rows = activeAttendanceRoster
                    .filter(s => targetStudentIds.includes(s.student_id))
                    .map(s => {
                        const isSelected = allocationSelectedStudents.includes(s.student_id);
                        const existingRow = studentProgress.find(p => p.student_id === s.student_id && p.lesson_id === lessonId);
                        const existingStatus = existingRow ? existingRow.status : 'locked';
                        
                        let status = existingStatus;
                        if (curriculumTab === 'individual' && selectedStudentForCurriculum) {
                            status = allocationStatus;
                        } else {
                            if (allocationStatus === 'unlocked') {
                                if (isSelected) {
                                    status = (existingStatus === 'completed') ? 'completed' : 'unlocked';
                                } else {
                                    status = 'locked';
                                }
                            } else if (allocationStatus === 'completed') {
                                if (isSelected) {
                                    status = 'completed';
                                } else {
                                    status = existingStatus;
                                }
                            } else if (allocationStatus === 'locked') {
                                if (isSelected) {
                                    status = 'locked';
                                } else {
                                    status = existingStatus;
                                }
                            }
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

                const { error } = await supabaseAuth
                    .from('student_topic_progress')
                    .upsert(rows, {
                        onConflict: 'student_id,lesson_id'
                    });

                if (error) {
                    console.warn('[Pacing] Database upsert failed, updating in-memory only:', error.message);
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
                alert('Pacing allocations updated successfully!');
            }
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
        newStatus: 'locked' | 'unlocked' | 'completed'
    ) => {
        if (!classroomId) return;
        setIsUpdatingProgress(targetId);

        // 1. Determine affected topics (lessons)
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
            setIsUpdatingProgress(null);
            return;
        }

        // 2. Determine target student IDs
        const isIndividual = (curriculumTab === 'individual' && selectedStudentForCurriculum);
        const targetStudentIds = isIndividual
            ? [selectedStudentForCurriculum.student_id]
            : activeAttendanceRoster.map(s => s.student_id);

        // 3. Construct upsert rows
        const rows: any[] = [];
        if (targetStudentIds.length === 0) {
            affectedLessonIds.forEach(lessonId => {
                rows.push({
                    student_id: 'classwide_default',
                    classroom_id: classroomId,
                    lesson_id: lessonId,
                    status: newStatus,
                    unlocked_by: 'manual',
                    unlocked_at: newStatus !== 'locked' ? new Date().toISOString() : null,
                    completed_at: newStatus === 'completed' ? new Date().toISOString() : null
                });
            });
        } else {
            targetStudentIds.forEach(studentId => {
                affectedLessonIds.forEach(lessonId => {
                    const existingRow = studentProgress.find(p => p.student_id === studentId && p.lesson_id === lessonId);
                    const existingStatus = existingRow ? existingRow.status : 'locked';

                    let status = newStatus;
                    // Preserve completed state if unlocking
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
        
        const isAlreadyAllocated = classroomInventoryAllocations.some(a => {
            const refId = a.module_id || a.chapter_id || a.lesson_id;
            return refId === id && !a.allocated_to_student_id;
        });
        if (isAlreadyAllocated) {
            alert(`"${title}" is already allocated to this classroom.`);
            return;
        }

        setImportingItemId(id);
        try {
            const insertData: any = {
                classroom_id: classroomId,
                allocated_by: teacherProfile.id,
                allocated_to_student_id: null
            };
            if (type === 'module') insertData.module_id = id;
            else if (type === 'chapter') insertData.chapter_id = id;
            else if (type === 'lesson') insertData.lesson_id = id;

            const { error } = await supabaseAuth
                .from('classroom_inventory_allocation')
                .insert([insertData]);

            if (error) throw error;
            await fetchCurriculumAllocations();
        } catch (err) {
            console.error('Failed to allocate item:', err);
            alert('Failed to allocate item from inventory.');
        } finally {
            setImportingItemId(null);
        }
    };

    const handleDeallocateItem = async (id: string) => {
        if (!window.confirm('Deallocate this item from the classroom?')) return;
        setDeletingAssignmentId(id);
        try {
            const { error } = await supabaseAuth
                .from('classroom_inventory_allocation')
                .delete()
                .eq('id', id);
            if (error) throw error;
            setClassroomInventoryAllocations(prev => prev.filter(a => a.id !== id));
        } catch (err) {
            console.error('Error deallocating item:', err);
            alert('Failed to deallocate item.');
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

    const avgAttendance = students.length > 0
        ? (students.reduce((acc, curr) => acc + curr.mock_attendance, 0) / students.length).toFixed(1)
        : '0.0';

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
                                                    <img src={s.profile_pic_url} alt={s.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-sm font-bold text-[#ecb613]">{s.name.charAt(0)}</span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0 text-left">
                                                <p className="text-sm font-bold text-slate-905 dark:text-white truncate">{s.name}</p>
                                                <p className="text-xs text-slate-500">
                                                    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${s.status === 'active' ? 'bg-green-500' : 'bg-slate-400'}`} />
                                                    {s.status === 'active' ? 'Active' : 'Inactive'}
                                                </p>
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

            <main className="flex-1 flex flex-col min-w-0">
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
                                onClick={onEndSession}
                                className="px-5 py-2.5 bg-red-500 hover:bg-red-655 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-red-200 dark:shadow-none hover:scale-[1.02] active:scale-98 cursor-pointer"
                            >
                                <LogOut size={14} /> End Active Class
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
                    {/* Row-wise Tabs */}
                    <div className="flex items-center gap-8 border-b border-slate-205 dark:border-slate-800 mb-8 overflow-x-auto custom-scrollbar whitespace-nowrap">
                        {['Overview', 'Curriculum', 'Students', 'Assignments', 'Attendance', 'Class Logs', 'Chat', 'Settings'].map((tab) => (
                            <button 
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`pb-4 font-extrabold transition-colors border-b-2 cursor-pointer ${
                                    activeTab === tab 
                                        ? 'text-[#ecb613] dark:text-[#ecb613] border-[#ecb613] dark:border-[#ecb613]' 
                                        : 'text-slate-505 dark:text-slate-400 hover:text-[#ecb613]/85 border-transparent'
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
                            <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl text-slate-800 dark:text-slate-100 overflow-hidden animate-in zoom-in-95 duration-300">
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
                                        <div className="p-5 rounded-2xl bg-slate-50/60 dark:bg-slate-950/20 border border-slate-200/50 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold leading-relaxed whitespace-pre-wrap">
                                            {selectedTopic.description || 'No detailed instructions uploaded. Follow general study guides for this level.'}
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
                                                            <span className="leading-tight">{pt}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-3 text-left">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none font-mono">3. View Attachments & Material Player</h4>
                                        {hasMaterial ? (
                                            <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex items-center justify-center relative shadow-inner">
                                                {isVideo ? (
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
                                                        const isAllocated = classroomInventoryAllocations.some(a => a.module_id === mod.id && !a.allocated_to_student_id);

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
                                                                            <span>{isAllocated ? 'Allocated' : 'Allocate Module'}</span>
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
                                                                                const isChapAllocated = classroomInventoryAllocations.some(a => a.chapter_id === chap.id && !a.allocated_to_student_id);
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
                                                                                                <span>{isChapAllocated ? 'Allocated' : 'Allocate'}</span>
                                                                                            </button>
                                                                                        </div>

                                                                                        {chapLessons.length > 0 && (
                                                                                            <div className="pl-3 border-l border-slate-200 dark:border-slate-800 space-y-2 mt-2">
                                                                                                {chapLessons.map(lesson => {
                                                                                                    const isLessonImporting = importingItemId === lesson.id;
                                                                                                    const isLessonAllocated = classroomInventoryAllocations.some(a => a.lesson_id === lesson.id && !a.allocated_to_student_id);

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
                                                                                                                <span>{isLessonAllocated ? 'Allocated' : 'Allocate'}</span>
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
                                            {allocationTargetLesson?.title || 'No target selected'}
                                        </h4>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold leading-none">
                                            Topic {allocationTargetLesson?.lesson_number || ''} • Level 1
                                        </p>
                                    </div>
                                </div>

                                <div className="flex bg-slate-105 dark:bg-slate-900 p-1 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setAllocationTargetType('classwide')}
                                        className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                                            allocationTargetType === 'classwide'
                                                ? 'bg-[#ecb613] text-slate-950 shadow-sm'
                                                : 'text-slate-450 hover:text-slate-800 dark:hover:text-slate-100'
                                        }`}
                                    >
                                        Classwide
                                    </button>
                                    <button
                                        type="button"
                                        disabled={curriculumTab === 'individual' && !!selectedStudentForCurriculum}
                                        onClick={() => setAllocationTargetType('individual')}
                                        className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer disabled:opacity-50 ${
                                            allocationTargetType === 'individual'
                                                ? 'bg-[#ecb613] text-slate-950 shadow-sm'
                                                : 'text-slate-450 hover:text-slate-800 dark:hover:text-slate-100'
                                        }`}
                                    >
                                        Individual Pacing
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono font-semibold">Change Topic Pacing State</span>
                                    <div className="grid grid-cols-3 gap-2">
                                        {([
                                            { key: 'locked', label: 'Lock Topic', border: 'border-slate-200 dark:border-slate-800', active: 'bg-slate-100 border-slate-400 text-slate-700 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300' },
                                            { key: 'unlocked', label: 'Unlock/Active', border: 'border-amber-200 dark:border-amber-850', active: 'bg-amber-50 border-amber-400 text-amber-700 dark:bg-amber-955/20 dark:border-amber-600 dark:text-amber-300' },
                                            { key: 'completed', label: 'Mark Complete', border: 'border-emerald-200 dark:border-emerald-850', active: 'bg-emerald-50 border-emerald-400 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-600 dark:text-emerald-300' }
                                        ] as const).map(opt => {
                                            const isActive = allocationStatus === opt.key;
                                            return (
                                                <button
                                                    key={opt.key}
                                                    type="button"
                                                    onClick={() => {
                                                        setAllocationStatus(opt.key);
                                                        if (allocationTargetType === 'classwide') {
                                                            setAllocationSelectedStudents(students.map(s => s.student_id));
                                                        } else {
                                                            setAllocationSelectedStudents(getStudentsWithStatus(opt.key, allocationTargetLesson.id));
                                                        }
                                                    }}
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

                                {allocationTargetType === 'individual' && students.length > 0 && (
                                    <div className="space-y-3 animate-in fade-in duration-300">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono font-semibold">Assign Students</span>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setAllocationSelectedStudents(students.map(s => s.student_id))}
                                                    className="text-[9px] font-black uppercase text-[#ecb613] hover:underline"
                                                >
                                                    Select All
                                                </button>
                                                <span className="text-slate-300">|</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setAllocationSelectedStudents([])}
                                                    className="text-[9px] font-black uppercase text-slate-455 hover:underline"
                                                >
                                                    Clear All
                                                </button>
                                            </div>
                                        </div>

                                        <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-2xl max-h-[220px] overflow-y-auto space-y-2">
                                            {students.map(stud => {
                                                const isSelected = allocationSelectedStudents.includes(stud.student_id);
                                                return (
                                                    <div 
                                                        key={stud.id}
                                                        onClick={() => {
                                                            setAllocationSelectedStudents(prev => 
                                                                isSelected 
                                                                    ? prev.filter(id => id !== stud.student_id) 
                                                                    : [...prev, stud.student_id]
                                                            );
                                                        }}
                                                        className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-950/40 border border-slate-100 dark:border-slate-805 hover:bg-slate-50 dark:hover:bg-slate-900/80 rounded-xl cursor-pointer select-none transition-colors"
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div className="w-7.5 h-7.5 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                                                                {stud.profile_pic_url ? (
                                                                    <img src={stud.profile_pic_url} alt={stud.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span className="text-[11px] font-bold text-slate-500">{stud.name.charAt(0)}</span>
                                                                )}
                                                            </div>
                                                            <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 truncate">{stud.name}</span>
                                                        </div>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={isSelected}
                                                            onChange={() => {}}
                                                            className="rounded text-amber-500 focus:ring-amber-400 size-4 border-slate-300 dark:border-slate-700 cursor-pointer"
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
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
                                        <h3 className="font-extrabold text-slate-905 dark:text-white text-base tracking-tight leading-none">Create Homework Assignment</h3>
                                        <p className="text-[9px] text-slate-455 font-bold uppercase tracking-wider mt-1">Assign Practice Tasks & Checklists</p>
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
                                <div className="space-y-1.5 text-left">
                                    <label className="block text-xs font-black text-slate-505 uppercase tracking-wide">Assignment Title *</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g., practice middle C scale, 20 mins daily"
                                        value={assignmentForm.title}
                                        onChange={e => setAssignmentForm(prev => ({ ...prev, title: e.target.value }))}
                                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-sm font-semibold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#ecb613]/25 focus:border-[#ecb613] outline-none transition-all text-slate-800 dark:text-slate-100"
                                    />
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
                                                            <div className="w-6.5 h-6.5 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                                                                {s.profile_pic_url ? (
                                                                    <img src={s.profile_pic_url} alt={s.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span className="text-[10px] font-bold text-slate-500">{s.name.charAt(0)}</span>
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

                                <div className="space-y-1.5 text-left">
                                    <label className="block text-xs font-black text-slate-505 uppercase tracking-wide">Attach Learning Material (File/Video)</label>
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
                                            <div className="space-y-0.5">
                                                <p className="text-xs font-extrabold text-[#ecb613] truncate max-w-[320px]">{assignmentFile.name}</p>
                                                <p className="text-[10px] text-slate-405 font-mono">Size: {formatFileSize(assignmentFile.size)}</p>
                                            </div>
                                        ) : assignmentForm.file_url ? (
                                            <div className="space-y-0.5">
                                                <p className="text-xs font-extrabold text-[#ecb613] truncate max-w-[320px]">{assignmentForm.file_name || 'Linked Resource Attachment'}</p>
                                                <p className="text-[10px] text-slate-400 font-mono">Linked from Class Note board</p>
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-355 group-hover:text-[#ecb613] transition-colors">Choose local file or drop here</p>
                                                <p className="text-[10px] text-slate-405 mt-0.5">PDF sheet music, audio tracks, lesson videos up to 50MB</p>
                                            </div>
                                        )}
                                    </div>
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
                                    <span>{isSavingAssignment ? 'Creating...' : 'Assign Task'}</span>
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

                                <div className="space-y-1.5 text-left">
                                    <label className="block text-xs font-black text-slate-550 uppercase tracking-wide">Attach Learning Sheet / PDF / Audio Track</label>
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
                                            <div className="space-y-0.5">
                                                <p className="text-xs font-extrabold text-[#ecb613] truncate max-w-[320px]">{noteFile.name}</p>
                                                <p className="text-[10px] text-slate-405 font-mono">Size: {formatFileSize(noteFile.size)}</p>
                                            </div>
                                        ) : editingNote?.file_url ? (
                                            <div className="space-y-0.5">
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
