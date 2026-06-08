'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabaseAuth } from '../../../../src/lib/supabase-auth';
import { Loader2, ArrowLeft, Search, Bell, HelpCircle, Users, Mail, Video, TrendingUp, Zap, Star, MoreVertical, Lightbulb, Edit3, PlusCircle, PlayCircle, FileUp, Plus, Clock, Trash2, Calendar, GripVertical, CheckCircle, Circle, FileText, Film, Lock, Music, UserPlus, AlertTriangle, Sparkles, BarChart2, X, BookOpen, Upload, StickyNote, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Filter, Tag, User, UsersRound, Paperclip, Send, NotebookPen, ClipboardList, Download, ExternalLink, Unlock, Sliders, MessageSquare, Share2, LogOut, Check, Info } from 'lucide-react';
import Link from 'next/link';
import TeacherSidebar from '../../../../src/components/TeacherSidebar';
import { CourseCategory, INITIAL_CATEGORIES, INITIAL_MODULES, INITIAL_CHAPTERS, INITIAL_LESSONS } from '../../inventory/initial-data';

interface ClassroomDetails {
    id: string;
    name: string;
    description: string;
    status: string;
    created_at: string;
    type?: string;
    class_date?: string;
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
    // Mock metrics for UI
    mock_score: number;
    mock_progress: number;
    mock_attendance: number;
    mock_milestone: string;
    mock_status: 'Consistent' | 'Improving' | 'At Risk';
    level?: string;
    is_makeup?: boolean;
}

// Lightweight record from the teacher's student directory
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
    // inventory reference (set when assigned from Inventory Library)
    inventory_ref_type?: 'module' | 'chapter' | 'lesson' | null;
    inventory_ref_id?: string | null;
    inventory_ref_title?: string | null;
    // joined
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
    // joined
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
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string } | null>(null);
    const [classroom, setClassroom] = useState<ClassroomDetails | null>(null);
    const [students, setStudents] = useState<EnrolledStudent[]>([]);
    const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
    const [activeTab, setActiveTab] = useState('Overview');
    const [currentPage, setCurrentPage] = useState(1);
    const [activeClassroomIds, setActiveClassroomIds] = useState<string[]>([classroomId]);

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
        // Check if dateStr strictly matches YYYY-MM-DD format (no time part)
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

    // Fetch broadcasts for this class
    useEffect(() => {
        if (!teacherProfile || !classroomId) return;
        const fetchClassroomBroadcasts = async () => {
            try {
                const { data: broadcastsData } = await supabaseAuth
                    .from('broadcasts')
                    .select('*')
                    .eq('teacher_id', teacherProfile.id)
                    .order('created_at', { ascending: false });
                
                if (broadcastsData) {
                    const classroomBroads = broadcastsData.filter((b: any) => 
                        Array.isArray(b.recipients) && b.recipients.some((r: any) => r.id === classroomId)
                    );
                    setClassBroadcasts(classroomBroads);
                }
            } catch (e) {
                console.error('Failed to load classroom broadcasts:', e);
            }
        };
        fetchClassroomBroadcasts();
    }, [teacherProfile, classroomId]);

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
            if (savedTab && ['Overview', 'Curriculum', 'Students', 'Assignments', 'Attendance', 'Settings'].includes(savedTab)) {
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
    const [metadataForm, setMetadataForm] = useState({ name: '', description: '', status: 'active' });
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
    const [dbSetupError, setDbSetupError] = useState(false); // tables not created yet
    const [assignmentError, setAssignmentError] = useState('');
    const [noteError, setNoteError] = useState('');

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab]);

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
                const classroomData = { ...roomData, status: roomData.status || 'active' };
                setClassroom(classroomData);

                // 4. Fetch Enrolled Students
                let roster: any[] = [];
                let overridesData: any[] = [];
                if (classroomData.type === 'temporary') {
                    const { data: tempClassData } = await supabaseAuth
                        .from('temporary_classes')
                        .select('id, class_date')
                        .eq('classroom_id', classroomId)
                        .maybeSingle();

                    if (tempClassData) {
                        classroomData.class_date = tempClassData.class_date;
                        const { data: tempRoster, error: tempRosterError } = await supabaseAuth
                            .from('session_student_overrides')
                            .select(`
                                id,
                                student_id,
                                users!student_id(name, profile_pic_url, level)
                            `)
                            .eq('target_classroom_id', classroomId);
                        
                        if (tempRosterError) throw tempRosterError;
                        roster = (tempRoster || []).map(r => ({
                            ...r,
                            joined_at: tempClassData.class_date
                        }));
                    }
                } else {
                    const { data: permRoster, error: rosterError } = await supabaseAuth
                        .from('classroom_students')
                        .select(`
                            id,
                            student_id,
                            joined_at,
                            users!student_id(name, profile_pic_url, level)
                        `)
                        .eq('classroom_id', classroomId);

                    if (rosterError) throw rosterError;
                    roster = permRoster || [];
                }
                
                // Seed the metadata form with fetched values
                setMetadataForm({
                    name: roomData.name || '',
                    description: roomData.description || '',
                    status: roomData.status || 'active',
                });



                // 5. Build Enrolled Students with Mock metrics for the UI
                const statusOptions: ('Consistent' | 'Improving' | 'At Risk')[] = ['Consistent', 'Improving', 'At Risk'];
                const milestoneOptions = ['Alankars Mastery', 'Breath Control II', 'Fingering Basics', 'Rhythm Training', 'Raag Yaman Intros'];
                
                const formattedRoster = (roster || []).map((r: any, idx) => {
                    const seed = parseInt(r.id.substring(0, 8), 16) || idx; // Pseudo-random determinism
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
                        mock_score: 6 + ((seed % 40) / 10), // 6.0 to 9.9
                        mock_progress: 50 + (seed % 50), // 50 to 99
                        mock_attendance: 70 + (seed % 30), // 70 to 99
                        mock_milestone: milestoneOptions[seed % milestoneOptions.length],
                        mock_status: idx % 3 === 0 ? 'Consistent' : (idx % 2 === 0 ? 'Improving' : 'At Risk') as any
                    };
                });

                setStudents(formattedRoster);

                // 5b. Fetch Temporary Session Overrides
                try {
                    const { data } = await supabaseAuth
                        .from('session_student_overrides')
                        .select(`
                            id,
                            student_id,
                            override_date,
                            reason,
                            users!student_id(name, profile_pic_url, level)
                        `)
                        .eq('target_classroom_id', classroomId)
                        .order('override_date', { ascending: true });
                    
                    overridesData = data || [];
                    setSessionOverrides(overridesData);
                } catch (e) {
                    console.error('Failed to load session overrides:', e);
                }

                // 5c. Fetch home classroom IDs of all students (enrolled + overrides)
                let classroomIds = [classroomId];
                try {
                    const studentIds = [
                        ...formattedRoster.map(s => s.student_id),
                        ...(overridesData || []).map((o: any) => o.student_id)
                    ];
                    if (studentIds.length > 0) {
                        const { data: homeRooms } = await supabaseAuth
                            .from('classroom_students')
                            .select('classroom_id')
                            .in('student_id', studentIds);
                        if (homeRooms) {
                            const ids = homeRooms.map(r => r.classroom_id).filter(Boolean);
                            classroomIds = Array.from(new Set([classroomId, ...ids]));
                        }
                    }
                    setActiveClassroomIds(classroomIds);
                } catch (e) {
                    console.error('Failed to load home classrooms:', e);
                }

                // 6. Fetch Schedules
                const { data: scheduleData } = await supabaseAuth
                    .from('batch_schedules')
                    .select('*')
                    .eq('classroom_id', classroomId)
                    .order('day_of_week', { ascending: true })
                    .order('start_time', { ascending: true });
                
                setSchedules(scheduleData || []);

                // 7. Fetch Static Course Curriculum data
                let dbModulesData = [];
                let dbChaptersData = [];
                let dbLessonsData = [];

                // Load course categories safely
                let loadedCats = INITIAL_CATEGORIES;
                try {
                    const { data: dbCategories, error: catErr } = await supabaseAuth
                        .from('course_categories')
                        .select('*')
                        .order('category_order', { ascending: true });
                    if (!catErr && dbCategories && dbCategories.length > 0) {
                        loadedCats = dbCategories;
                    }
                } catch (e) {
                    console.warn('Failed to query course_categories, using fallbacks:', e);
                }
                setCategories(loadedCats);

                const { data: dbModules } = await supabaseAuth.from('course_modules').select('*').order('module_number', { ascending: true });
                
                if (dbModules && dbModules.length > 0) {
                    dbModulesData = dbModules;
                    const { data: dbChapters } = await supabaseAuth.from('course_chapters').select('*').order('chapter_number', { ascending: true });
                    const { data: dbLessons } = await supabaseAuth.from('course_lessons').select('*').order('lesson_number', { ascending: true });
                    dbChaptersData = dbChapters || [];
                    dbLessonsData = dbLessons || [];
                } else {
                    // Auto-seed Supabase database if tables are empty
                    try {
                        await supabaseAuth.from('course_modules').insert(INITIAL_MODULES);
                        await supabaseAuth.from('course_chapters').insert(INITIAL_CHAPTERS);
                        await supabaseAuth.from('course_lessons').insert(INITIAL_LESSONS);

                        const { data: seedModules } = await supabaseAuth.from('course_modules').select('*').order('module_number', { ascending: true });
                        const { data: seedChapters } = await supabaseAuth.from('course_chapters').select('*').order('chapter_number', { ascending: true });
                        const { data: seedLessons } = await supabaseAuth.from('course_lessons').select('*').order('lesson_number', { ascending: true });

                        dbModulesData = seedModules || [];
                        dbChaptersData = seedChapters || [];
                        dbLessonsData = seedLessons || [];
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

                try {
                    const studentIds = [
                        ...formattedRoster.map(s => s.student_id),
                        ...(overridesData || []).map((o: any) => o.student_id)
                    ];
                    
                    let progressQuery = supabaseAuth
                        .from('student_topic_progress')
                        .select('*');
                    
                    if (studentIds.length > 0) {
                        progressQuery = progressQuery.in('student_id', studentIds);
                    } else {
                        progressQuery = progressQuery.eq('classroom_id', classroomId);
                    }

                    const { data: progressData, error: progressError } = await progressQuery;
                    if (progressError) {
                        console.warn('Could not fetch student_topic_progress:', progressError);
                        if (progressError.code === 'PGRST205' || progressError.message?.includes('schema cache') || progressError.message?.includes('does not exist')) {
                            setDbSetupError(true);
                        }
                    }
                    setStudentProgress(progressData || []);
                } catch (pe) {
                    console.warn('Could not fetch student_topic_progress:', pe);
                    setStudentProgress([]);
                }

                // Fetch assignments immediately on mount so progress summary calculates correctly
                try {
                    const { data: asgData, error: asgError } = await supabaseAuth
                        .from('assignments')
                        .select('*')
                        .eq('classroom_id', classroomId)
                        .order('created_at', { ascending: false });

                    if (!asgError && asgData) {
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
                    }
                } catch (ae) {
                    console.warn('Could not pre-fetch assignments on mount:', ae);
                }

                // Fetch curriculum allocations immediately on mount
                try {
                    const { data: curriculumData, error: curriculumError } = await supabaseAuth
                        .from('classroom_inventory_allocation')
                        .select('*')
                        .in('classroom_id', classroomIds);
                    if (!curriculumError && curriculumData) {
                        setClassroomInventoryAllocations(curriculumData);
                    } else if (curriculumError) {
                        console.error('Mount pre-fetch classroom_inventory_allocation error:', curriculumError);
                        setDbSetupError(true);
                    }
                } catch (ce) {
                    console.warn('Could not pre-fetch classroom_inventory_allocation on mount (exception):', ce);
                }

            } catch (err) {
                console.error('Error fetching classroom data:', err);
                router.push('/teacher-dashboard/classrooms');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [classroomId, router]);

    // ── Fetch Assignments ──────────────────────────────────────────────────────
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
                // Log full details — Supabase error objects have non-enumerable props
                console.error('Error fetching assignments — code:', error.code, '| msg:', error.message, '| details:', error.details, '| hint:', error.hint);
                // ANY error here means the table doesn\'t exist or is misconfigured
                setDbSetupError(true);
                return;
            }

            // Fetch and enrich student progress/statuses for BOTH all and individual assignments
            const enriched = await Promise.all((asgData || []).map(async (a: Assignment) => {
                const { data: asData, error: asError } = await supabaseAuth
                    .from('assignment_students')
                    .select('*')
                    .eq('assignment_id', a.id);
                
                if (asError) {
                    console.error('Error fetching assignment students for a.id', a.id, asError);
                }

                const existingRows = asData || [];

                if (a.target_type === 'individual') {
                    // Only show students who have explicit assignment_students rows
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
                    // For 'all' assignments, show every student in the classroom.
                    // Map existing status/grading row or default to a virtual pending row.
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
                                id: `temp-impl-${a.id}-${s.student_id}`, // virtual ID
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
                console.error('Error fetching curriculum allocations — code:', error.code, '| msg:', error.message);
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
                // Insert a new row
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
                // Update existing row
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

            // Update local assignments state
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
                console.error('Error fetching class notes — code:', error.code, '| msg:', error.message);
                // Don\'t double-set dbSetupError; fetchAssignments handles it first
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

    // Fetch when switching to Assignments or Curriculum tab
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
    }, [activeTab, fetchAssignments, fetchClassNotes, fetchCurriculumAllocations]);

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
                console.error('Error fetching classroom attendance:', error.message || error);
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

    // ── Mark Classroom Attendance Handler ──────────────────────────────────────
    const handleMarkClassroomAttendance = async (studentId: string, status: 'present' | 'absent' | 'late' | 'excused') => {
        if (!classroomId || !teacherProfile) return;

        // Optimistically update status
        setAttendanceRecords(prev => ({ ...prev, [studentId]: status }));
        setIsSavingAttendanceMap(prev => ({ ...prev, [studentId]: true }));

        try {
            const { error } = await supabaseAuth
                .from('attendance')
                .upsert({
                    student_id: studentId,
                    classroom_id: classroomId,
                    date: attendanceDate,
                    status: (status as string).toLowerCase(),
                    marked_by: teacherProfile.id
                }, { onConflict: 'student_id, classroom_id, date' });

            if (error) throw error;
        } catch (err: any) {
            console.error('Error marking attendance:', err);
            alert(`Failed to save attendance: ${err.message || err}`);
            // Revert status on failure
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
            const { data, error } = await supabaseAuth
                .from('users')
                .select('id, name, profile_pic_url, level')
                .eq('role', 'student')
                .eq('teacher_id', teacherProfile.id)
                .order('name', { ascending: true });

            if (error) throw error;
            // Only show students who are not already permanently enrolled in this classroom
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
            const { data, error } = await supabaseAuth
                .from('users')
                .select('id, name, profile_pic_url, level')
                .eq('role', 'student')
                .eq('teacher_id', teacherProfile.id)
                .order('name', { ascending: true });

            if (error) throw error;
            // Only show students who are not already permanently enrolled in this classroom
            const available = (data || []).filter((s: any) => !enrolledIds.has(s.id));
            // Ensure the student being rescheduled is present in the list
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
                // UPDATE existing override
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
                // INSERT new override
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

    // ── Fetch teacher's directory students (excluding already-enrolled) ────────
    const openDirectoryModal = async () => {
        if (!teacherProfile) return;
        setShowDirectoryModal(true);
        setDirectoryLoading(true);
        setSelectedToAdd(new Set());
        setDirectorySearch('');
        try {
            const enrolledIds = new Set(students.map(s => s.student_id));
            const { data, error } = await supabaseAuth
                .from('users')
                .select('id, name, profile_pic_url, status')
                .eq('role', 'student')
                .eq('teacher_id', teacherProfile.id);

            if (error) throw error;
            // Filter out already-enrolled students
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
                const rows = Array.from(selectedToAdd).map(studentId => ({
                    classroom_id: classroomId,
                    student_id: studentId,
                    joined_at: new Date().toISOString(),
                }));

                const { error } = await supabaseAuth
                    .from('classroom_students')
                    .insert(rows);

                if (error) throw error;
            }

            // Optimistically add to local state with mock metrics
            const statusOptions: ('Consistent' | 'Improving' | 'At Risk')[] = ['Consistent', 'Improving', 'At Risk'];
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
            alert('Failed to add students. They may already be in this class.');
        } finally {
            setIsAddingStudents(false);
        }
    };

    // ── Remove a student from this classroom (not from the directory) ─────────
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
                    // Storage bucket may not exist — skip file upload, don't block
                    console.warn('File upload skipped (storage bucket may not exist):', uploadErr.message);
                }
                if (!uploadErr) {
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
                const msg = error.message || JSON.stringify(error);
                console.error('Supabase insert assignments error:', error);
                setAssignmentError(`Failed to create assignment: ${msg}`);
                return;
            }

            // Insert assignment_students for either all students in classroom or selected individual students
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

            // Reset
            closeAssignmentModal();
        } catch (err: any) {
            const msg = err?.message || String(err);
            console.error('Error creating assignment:', err);
            setAssignmentError(`Unexpected error: ${msg}`);
        } finally {
            setIsSavingAssignment(false);
        }
    };

    // ── Delete Assignment ──────────────────────────────────────────────────────
    const handleDeleteAssignment = async (id: string) => {
        if (!window.confirm('Delete this assignment?')) return;
        setDeletingAssignmentId(id);
        try {
            // First delete student mappings
            await supabaseAuth.from('assignment_students').delete().eq('assignment_id', id);

            // Then delete parent assignment
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
                    console.warn('File upload skipped (storage bucket may not exist):', uploadErr.message);
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
                    const msg = error.message || JSON.stringify(error);
                    console.error('Supabase update class_notes error:', error);
                    setNoteError(`Failed to update note: ${msg}`);
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
                    const msg = error.message || JSON.stringify(error);
                    console.error('Supabase insert class_notes error:', error);
                    setNoteError(`Failed to save note: ${msg}`);
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
            const msg = err?.message || String(err);
            console.error('Error saving note:', err);
            setNoteError(`Unexpected error: ${msg}`);
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

    const NOTE_COLORS: Record<string, { bg: string; border: string; header: string; dot: string }> = {
        yellow: { bg: 'bg-amber-50 dark:bg-amber-900/10', border: 'border-amber-200 dark:border-amber-700/50', header: 'bg-amber-100/80 dark:bg-amber-800/30', dot: 'bg-amber-400' },
        blue:   { bg: 'bg-blue-50 dark:bg-blue-900/10',   border: 'border-blue-200 dark:border-blue-700/50',   header: 'bg-blue-100/80 dark:bg-blue-800/30',   dot: 'bg-blue-400'   },
        green:  { bg: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-emerald-200 dark:border-emerald-700/50', header: 'bg-emerald-100/80 dark:bg-emerald-800/30', dot: 'bg-emerald-400' },
        pink:   { bg: 'bg-pink-50 dark:bg-pink-900/10',   border: 'border-pink-200 dark:border-pink-700/50',   header: 'bg-pink-100/80 dark:bg-pink-800/30',   dot: 'bg-pink-400'   },
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
            // Class-wide: Only show allocations targeted to all students
            return inventoryItems.filter(a => a.target_type === 'all');
        } else {
            // Individual pacing: Filter to only show allocations active for the selected student
            if (!selectedStudentForCurriculum) return [];
            return inventoryItems.filter(a => {
                if (a.target_type === 'all') return true;
                return a.assignment_students?.some(
                    s => s.student_id === selectedStudentForCurriculum.student_id
                );
            });
        }
    }, [classroomInventoryAllocations, curriculumTab, selectedStudentForCurriculum, courseModules, courseChapters, courseLessons]);

    const groupedAllocations = useMemo(() => {
        const categoriesMap: Record<string, {
            categoryName: string;
            categoryOrder: number;
            modulesMap: Record<string, {
                moduleName: string;
                moduleOrder: number;
                allocations: typeof allocatedInventoryItems;
            }>;
        }> = {};

        allocatedInventoryItems.forEach(asg => {
            let categoryName = 'Specialized Modules';
            let categoryOrder = 2;
            let moduleName = 'Other';
            let moduleOrder = 999;
            let moduleId = 'unknown';

            if (asg.inventory_ref_type === 'module') {
                const mod = courseModules.find(m => m.id === asg.inventory_ref_id);
                if (mod) {
                    const parsed = parseModuleCategory(mod);
                    categoryName = parsed.category;
                    moduleName = mod.title;
                    moduleId = mod.id;
                    moduleOrder = mod.module_number;
                }
            } else if (asg.inventory_ref_type === 'chapter') {
                const chap = courseChapters.find(c => c.id === asg.inventory_ref_id);
                const mod = chap ? courseModules.find(m => m.id === chap.module_id) : null;
                if (mod) {
                    const parsed = parseModuleCategory(mod);
                    categoryName = parsed.category;
                    moduleName = mod.title;
                    moduleId = mod.id;
                    moduleOrder = mod.module_number;
                }
            } else if (asg.inventory_ref_type === 'lesson') {
                const lesson = courseLessons.find(l => l.id === asg.inventory_ref_id);
                const chap = lesson ? courseChapters.find(c => c.id === lesson.chapter_id) : null;
                const mod = chap ? courseModules.find(m => m.id === chap.module_id) : null;
                if (mod) {
                    const parsed = parseModuleCategory(mod);
                    categoryName = parsed.category;
                    moduleName = mod.title;
                    moduleId = mod.id;
                    moduleOrder = mod.module_number;
                }
            }

            // Lookup category order
            const cat = categories.find(c => c.name === categoryName);
            if (cat) {
                categoryOrder = cat.category_order;
            } else {
                // Check in INITIAL_CATEGORIES
                const initCat = INITIAL_CATEGORIES.find(c => c.name === categoryName);
                if (initCat) categoryOrder = initCat.category_order;
            }

            // Initialize category map if needed
            if (!categoriesMap[categoryName]) {
                categoriesMap[categoryName] = {
                    categoryName,
                    categoryOrder,
                    modulesMap: {}
                };
            }

            // Initialize module map if needed
            if (!categoriesMap[categoryName].modulesMap[moduleId]) {
                categoriesMap[categoryName].modulesMap[moduleId] = {
                    moduleName,
                    moduleOrder,
                    allocations: []
                };
            }

            categoriesMap[categoryName].modulesMap[moduleId].allocations.push(asg);
        });

        // Convert to sorted array representation
        const sortedCategories = Object.values(categoriesMap)
            .sort((a, b) => a.categoryOrder - b.categoryOrder)
            .map(cat => {
                const sortedModules = Object.entries(cat.modulesMap).map(([id, modInfo]) => ({
                    id,
                    moduleName: modInfo.moduleName,
                    moduleOrder: modInfo.moduleOrder,
                    allocations: modInfo.allocations
                })).sort((a, b) => a.moduleOrder - b.moduleOrder);

                return {
                    categoryName: cat.categoryName,
                    modules: sortedModules
                };
            });

        return sortedCategories;
    }, [allocatedInventoryItems, courseModules, courseChapters, courseLessons, categories]);

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

        // Also add any lessons the selected student has progress on (completed or unlocked)
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
        
        return groupedAllocations.some(group => 
            group.modules.some(modGroup => 
                modGroup.allocations.some(asg => {
                    if (asg.target_type === 'individual') return true;
                    if (asg.inventory_ref_type === 'module') {
                        const modChapters = courseChapters.filter(c => c.module_id === asg.inventory_ref_id);
                        return modChapters.some(chap => {
                            const chapLessons = courseLessons.filter(l => l.chapter_id === chap.id);
                            return chapLessons.some(lesson => 
                                selectedStudentPermissions.completedLessons.has(lesson.id) ||
                                selectedStudentPermissions.unlockedLessons.has(lesson.id)
                            );
                        });
                    } else if (asg.inventory_ref_type === 'chapter') {
                        const chapLessons = courseLessons.filter(l => l.chapter_id === asg.inventory_ref_id);
                        return chapLessons.some(lesson => 
                            selectedStudentPermissions.completedLessons.has(lesson.id) ||
                            selectedStudentPermissions.unlockedLessons.has(lesson.id)
                        );
                    } else if (asg.inventory_ref_type === 'lesson') {
                        return selectedStudentPermissions.completedLessons.has(asg.inventory_ref_id) ||
                               selectedStudentPermissions.unlockedLessons.has(asg.inventory_ref_id);
                    }
                    return false;
                })
            )
        );
    }, [curriculumTab, selectedStudentForCurriculum, groupedAllocations, courseChapters, courseLessons, selectedStudentPermissions]);

    const handleToggleTopicLock = async (studentId: string, lessonId: string, newStatus: 'locked' | 'unlocked' | 'completed') => {
        if (!classroomId) return;
        console.log(`[Pacing Debug] Toggle Individual pacing clicked for studentId: ${studentId}, lessonId: ${lessonId}, newStatus: ${newStatus}`);
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
        console.log(`[Pacing Debug] Toggle Classwide pacing clicked for lessonId: ${lessonId}, newStatus: ${newStatus}`);
        console.log(`[Pacing Debug] Current student count: ${students.length}`);
        
        setIsUpdatingProgress(lessonId);

        // If there are no students enrolled or attending, write in-memory with 'classwide_default' key
        if (activeAttendanceRoster.length === 0) {
            console.log('[Pacing] Classroom is empty, updating pacing in-memory only.');
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
            console.log(`[Pacing Debug] Upserting ${rows.length} rows to student_topic_progress:`, rows);
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
                    // Empty classroom in-memory fallback
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
                                    // Preserve completed status to avoid accidental downgrades to 'unlocked'
                                    status = (existingStatus === 'completed') ? 'completed' : 'unlocked';
                                } else {
                                    status = 'locked';
                                }
                            } else if (allocationStatus === 'completed') {
                                if (isSelected) {
                                    status = 'completed';
                                } else {
                                    // Preserve existing status for unselected students
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

    const handleAllocateItem = async (
        type: 'module' | 'chapter' | 'lesson',
        id: string,
        title: string,
        description: string
    ) => {
        if (!classroomId || !teacherProfile) return;
        
        // Prevent duplicate allocation
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

            // Refresh allocations list
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

    const statusColors: Record<string, string> = {
        pending: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
        submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        reviewed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    };

    // ── Save classroom metadata ───────────────────────────────────────────────
    const handleSaveMetadata = async () => {
        if (!metadataForm.name.trim()) {
            setMetadataError('Class name is required.');
            return;
        }
        setIsSavingMetadata(true);
        setMetadataError('');
        setMetadataSaved(false);
        try {
            let { error } = await supabaseAuth
                .from('classrooms')
                .update({
                    name: metadataForm.name.trim(),
                    description: metadataForm.description.trim(),
                    status: metadataForm.status,
                })
                .eq('id', classroomId);

            // If update fails because the 'status' column doesn't exist in the database, retry without it
            if (error && (error.message?.includes('status') && (error.message?.includes('schema cache') || error.message?.includes('does not exist') || error.code === 'PGRST205'))) {
                console.warn('[Classroom Metadata] "status" column missing in database, retrying update without status...');
                const retryResult = await supabaseAuth
                    .from('classrooms')
                    .update({
                        name: metadataForm.name.trim(),
                        description: metadataForm.description.trim(),
                    })
                    .eq('id', classroomId);
                error = retryResult.error;
            }

            if (error) throw error;

            // Update local classroom state so the header reflects the new name
            setClassroom(prev => prev ? {
                ...prev,
                name: metadataForm.name.trim(),
                description: metadataForm.description.trim(),
                status: metadataForm.status,
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

    // ── Helper functions (defined before early return so hooks order is stable) ─
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

    const formatTime12hr = (time24: string) => {
        if (!time24) return '';
        const [h, m] = time24.split(':');
        let hours = parseInt(h, 10);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const hStr = hours.toString().padStart(2, '0');
        return `${hStr}:${m} ${ampm}`;
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

    // ── useMemo MUST be above any early return (Rules of Hooks) ──────────────
    const filteredDirectory = useMemo(() => {
        if (!directorySearch.trim()) return directoryStudents;
        const q = directorySearch.toLowerCase();
        return directoryStudents.filter(s => s.name.toLowerCase().includes(q));
    }, [directoryStudents, directorySearch]);

    if (loading || !classroom) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8f8f6]">
                <Loader2 className="w-10 h-10 animate-spin text-[#ecb613] mb-4" />
                <p className="font-medium text-slate-600 tracking-wide uppercase text-xs">Loading Classroom Dashboard...</p>
            </div>
        );
    }

    const handleSaveSchedule = async () => {
        if (!classroomId) return;

        // Local check for duplicates
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
                // Handle Supabase unique constraint violation
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
        <div className="flex min-h-screen bg-[#f8f8f6] dark:bg-[#221d10] text-slate-900 dark:text-slate-100 font-sans">

            {/* ── Add from Directory Modal ─────────────────────────────────────── */}
            {showDirectoryModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[#ecb613]/10 flex items-center justify-center">
                                    <UserPlus className="w-5 h-5 text-[#ecb613]" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Add from Student Directory</h3>
                                    <p className="text-xs text-slate-500">Select students to enroll in <span className="font-semibold">{classroom?.name}</span></p>
                                </div>
                            </div>
                            <button onClick={() => setShowDirectoryModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search students..."
                                    value={directorySearch}
                                    onChange={e => setDirectorySearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Student list */}
                        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
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
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                                                isSelected
                                                    ? 'border-[#ecb613] bg-[#ecb613]/5 dark:bg-[#ecb613]/10'
                                                    : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                            }`}
                                        >
                                            <div className="w-10 h-10 rounded-full bg-[#ecb613]/10 flex items-center justify-center overflow-hidden border-2 border-white dark:border-slate-800 shadow-sm flex-shrink-0">
                                                {s.profile_pic_url ? (
                                                    <img src={s.profile_pic_url} alt={s.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-sm font-bold text-[#ecb613]">{s.name.charAt(0)}</span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{s.name}</p>
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

                        {/* Footer */}
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-shrink-0">
                            <span className="text-xs font-semibold text-slate-500">
                                {selectedToAdd.size > 0 ? `${selectedToAdd.size} student${selectedToAdd.size !== 1 ? 's' : ''} selected` : 'Click students to select'}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowDirectoryModal(false)}
                                    className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddStudents}
                                    disabled={selectedToAdd.size === 0 || isAddingStudents}
                                    className="px-4 py-2 rounded-lg text-sm font-bold bg-[#ecb613] text-slate-900 hover:bg-[#ecb613]/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md flex flex-col animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-600">
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                        {editingOverrideId ? 'Reschedule Makeup Allocation' : 'Schedule Makeup Allocation'}
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        {editingOverrideId ? 'Update details or reschedule class date' : 'Allocate a temporary student for a specific date'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowOverrideModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        {/* Body */}
                        <div className="p-6 space-y-4">
                            {isOverrideRosterLoading ? (
                                <div className="flex flex-col items-center justify-center py-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-2" />
                                    <p className="text-xs text-slate-500 font-bold">Loading available students...</p>
                                </div>
                            ) : directoryStudentsForOverride.length === 0 ? (
                                <div className="text-center py-6">
                                    <p className="text-sm font-medium text-slate-500">No other students available.</p>
                                    <p className="text-xs text-slate-400 mt-1">All your students are already permanently enrolled in this classroom.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Student Selector */}
                                    <div className="text-left">
                                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Select Student</label>
                                        <select
                                            value={overrideForm.studentId}
                                            onChange={e => setOverrideForm(f => ({ ...f, studentId: e.target.value }))}
                                            disabled={!!editingOverrideId}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                                        >
                                            {directoryStudentsForOverride.map(s => (
                                                <option key={s.id} value={s.id}>{s.name} ({s.level || 'Beginner'})</option>
                                            ))}
                                        </select>
                                    </div>
                                    {/* Override Date */}
                                    <div className="text-left">
                                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Class Session Date</label>
                                        <input
                                            type="date"
                                            value={overrideForm.date}
                                            onChange={e => setOverrideForm(f => ({ ...f, date: e.target.value }))}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                        />
                                    </div>
                                    {/* Reason / Notes */}
                                    <div className="text-left">
                                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Reason / Private Notes</label>
                                        <textarea
                                            value={overrideForm.reason}
                                            onChange={e => setOverrideForm(f => ({ ...f, reason: e.target.value }))}
                                            placeholder="e.g. Makeup session for missed class on Monday"
                                            rows={3}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all resize-none"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                            <button
                                onClick={() => setShowOverrideModal(false)}
                                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-150 dark:hover:bg-slate-800 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveOverride}
                                disabled={isSavingOverride || directoryStudentsForOverride.length === 0}
                                className="px-5 py-2 text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/25 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
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
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 text-left">
                        {/* Header */}
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
                            <button onClick={() => setShowMessageModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Composer Form */}
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            if (!messageContent.trim() || !messageSubject.trim()) return;
                            const success = await handleSendClassMessageAction();
                            if (success) {
                                setShowMessageModal(false);
                            }
                        }} className="p-6 space-y-4 overflow-y-auto">
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-wide mb-2">Subject</label>
                                <input
                                    type="text"
                                    value={messageSubject}
                                    onChange={(e) => setMessageSubject(e.target.value)}
                                    placeholder="e.g. Important Class Update"
                                    required
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#ecb613] focus:border-[#ecb613] outline-none transition-all placeholder:text-slate-400"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-wide mb-2">Message Content</label>
                                <textarea
                                    rows={5}
                                    value={messageContent}
                                    onChange={(e) => setMessageContent(e.target.value)}
                                    placeholder="Type your message here... All enrolled students will see this in their Portal."
                                    required
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#ecb613] focus:border-[#ecb613] outline-none transition-all placeholder:text-slate-400 font-medium"
                                />
                            </div>


                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowMessageModal(false)}
                                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSendingMessage || !messageContent.trim() || !messageSubject.trim()}
                                    className="px-5 py-2 rounded-lg text-sm font-bold bg-[#ecb613] text-slate-900 hover:bg-[#ecb613]/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 text-left">
                        {/* Header */}
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
                            <button onClick={() => setSelectedAnnouncement(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6 overflow-y-auto flex-1">
                            <div className="text-left">
                                <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest block mb-1">Subject</span>
                                <h4 className="text-md font-extrabold text-slate-900 dark:text-white leading-snug">{selectedAnnouncement.subject}</h4>
                            </div>

                            <div className="text-left">
                                <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest block mb-2">Message Body</span>
                                <div className="p-4 bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap select-text">
                                    {selectedAnnouncement.content}
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => setSelectedAnnouncement(null)}
                                className="px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
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
                                className="px-5 py-2 rounded-lg text-sm font-bold bg-[#ecb613] text-slate-900 hover:bg-[#ecb613]/90 transition-colors shadow-sm flex items-center gap-2"
                            >
                                <Edit3 className="w-4 h-4" />
                                Edit & Resend
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {!isMeetingView && (
                <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />
            )}

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                {isMeetingView ? (
                    <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between px-8 py-4 gap-4 flex-shrink-0 shadow-sm">
                        <div className="flex items-center gap-3 text-left">
                            <button onClick={onMinimizeSession || onEndSession} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Minimize and go back to dashboard">
                                <ArrowLeft size={18} />
                            </button>
                            <div className="text-left">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-left">Active Class Session</span>
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
                                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5 text-left">{classroom?.name || 'Classroom'}</h2>
                            </div>
                        </div>

                        {/* Live Timer and End Session */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800">
                                <Clock className="w-4 h-4 text-[#ecb613] animate-spin" style={{ animationDuration: '6s' }} />
                                <div className="text-xs text-left">
                                    <span className="text-slate-400 font-medium mr-1">Session Duration:</span>
                                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{formatDuration(secondsElapsed)}</span>
                                </div>
                            </div>
                            <button
                                onClick={onEndSession}
                                className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-red-200 dark:shadow-none hover:scale-[1.02] active:scale-98"
                            >
                                <LogOut size={14} /> End Active Class
                            </button>
                        </div>
                    </header>
                ) : (
                    <header className="flex justify-between items-center px-8 h-16 w-full max-w-full mx-auto bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
                        <div className="flex items-center gap-4">
                            <Link href="/teacher-dashboard/classrooms" className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <h2 className="text-xl font-bold text-[#ecb613] dark:text-[#ecb613]">{classroom?.name || 'Classroom'}</h2>
                            <span className="px-2 py-1 bg-[#ecb613]/10 text-[#ecb613] dark:bg-[#ecb613]/20 dark:text-[#ecb613] text-[10px] font-bold rounded uppercase tracking-wider">{classroom?.status || 'Active'}</span>
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
                )}


                <div className="p-8 max-w-7xl mx-auto w-full flex-1 overflow-y-auto">
                    {/* Row-wise Tabs (Contextual Navigation) */}
                    <div className="flex items-center gap-8 border-b border-slate-200 dark:border-slate-800 mb-8 overflow-x-auto custom-scrollbar whitespace-nowrap">
                        {['Overview', 'Curriculum', 'Students', 'Assignments', 'Attendance', 'Settings'].map((tab) => (
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
                        <div className="flex flex-col gap-6">
                            {isMeetingView && (
                                <div className="grid grid-cols-12 gap-6">
                                    {/* Broadcast Composer */}
                                    <div className="col-span-12 lg:col-span-8">
                                        <form onSubmit={handleSendClassMessage} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6 hover:shadow-md transition-shadow text-left">
                                            <div className="flex items-center justify-between">
                                                <h3 className="font-extrabold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                                                    <MessageSquare className="text-[#ecb613] size-5" />
                                                    Broadcast to Class
                                                </h3>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const meetLink = "Join Google Meet: https://meet.google.com/abc-defg-hij";
                                                        setMessageContent(prev => prev ? `${prev}\n\n${meetLink}` : meetLink);
                                                    }}
                                                    className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 hover:scale-[1.02] border border-blue-200/50 dark:border-blue-900/30"
                                                >
                                                    <Video size={14} /> 🔗 Share Meet Link
                                                </button>
                                            </div>

                                            <div className="space-y-4 text-left">
                                                <div>
                                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wide mb-2 text-left">Subject</label>
                                                    <input
                                                        type="text"
                                                        value={messageSubject}
                                                        onChange={(e) => setMessageSubject(e.target.value)}
                                                        placeholder="e.g. Google Meet URL - Classroom Session"
                                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#ecb613] focus:border-[#ecb613] outline-none transition-all placeholder:text-slate-400"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wide mb-2 text-left">Message Content</label>
                                                    <textarea
                                                        rows={4}
                                                        value={messageContent}
                                                        onChange={(e) => setMessageContent(e.target.value)}
                                                        placeholder="Hi Class, please join today's session via this link or prepare the A1 scale exercise..."
                                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#ecb613] focus:border-[#ecb613] outline-none transition-all placeholder:text-slate-400 font-medium"
                                                    />
                                                </div>
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={isSendingMessage || !messageContent.trim()}
                                                className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
                                                    messageContent.trim()
                                                        ? 'bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900 shadow-[#ecb613]/25 hover:scale-[1.01]'
                                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                }`}
                                            >
                                                {isSendingMessage ? (
                                                    <><Loader2 className="w-5 h-5 animate-spin" /> Broadcasting...</>
                                                ) : (
                                                    <><Send className="w-5 h-5" /> Send Announcement to Class</>
                                                )}
                                            </button>

                                            
                                        </form>
                                    </div>

                                    {/* Broadcast History */}
                                    <div className="col-span-12 lg:col-span-4">
                                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 hover:shadow-md transition-shadow h-full flex flex-col min-h-[385px] max-h-[385px] overflow-hidden text-left">
                                            <h4 className="font-extrabold text-slate-900 dark:text-white text-md mb-4 flex items-center gap-2 flex-shrink-0">
                                                <Share2 size={16} className="text-amber-500" />
                                                Recently Sent
                                            </h4>
                                            <div className="space-y-3.5 overflow-y-auto pr-1 flex-1">
                                                {classBroadcasts.map((b, i) => (
                                                    <div 
                                                        key={b.id || i} 
                                                        onClick={() => setSelectedAnnouncement(b)}
                                                        className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-100 dark:border-slate-800 text-xs hover:border-[#ecb613] transition-colors relative cursor-pointer text-left group"
                                                    >
                                                        <div className="flex justify-between items-center gap-2 mb-1.5 text-left">
                                                            <span className="font-bold text-slate-900 dark:text-white truncate group-hover:text-[#ecb613] transition-colors">{b.subject}</span>
                                                            <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                                                                {new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium line-clamp-3 whitespace-pre-wrap text-left">{b.content}</p>
                                                    </div>
                                                ))}
                                                {classBroadcasts.length === 0 && (
                                                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-8 italic font-semibold">
                                                        No broadcasts sent to this class yet.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!isMeetingView && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                    {/* Stat 1: Active Enrollment */}
                                    <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
                                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-violet-500/5 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500"></div>
                                        <div className="space-y-1.5 text-left relative z-10">
                                            <span className="text-2xl font-black text-slate-900 dark:text-white">{students.length}</span>
                                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Enrolled Students</p>
                                            <p className="text-[10px] text-slate-400 font-semibold">Active members of this class</p>
                                        </div>
                                        <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-500 shrink-0 relative z-10">
                                            <Users className="w-6 h-6" />
                                        </div>
                                    </div>

                                    {/* Stat 2: Consistency Index */}
                                    <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
                                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500"></div>
                                        <div className="space-y-1.5 text-left relative z-10">
                                            <span className="text-2xl font-black text-slate-900 dark:text-white">{avgAttendance}%</span>
                                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Average Attendance</p>
                                            <p className="text-[10px] text-slate-400 font-semibold">Consistent engagement rate</p>
                                        </div>
                                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0 relative z-10">
                                            <TrendingUp className="w-6 h-6" />
                                        </div>
                                    </div>

                                    {/* Stat 3: Weekly Sessions */}
                                    <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
                                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500"></div>
                                        <div className="space-y-1.5 text-left relative z-10">
                                            <span className="text-2xl font-black text-slate-900 dark:text-white">{schedules.length} Session(s)</span>
                                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Weekly Sessions</p>
                                            <p className="text-[10px] text-slate-400 font-semibold">Scheduled lesson slots</p>
                                        </div>
                                        <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0 relative z-10">
                                            <Clock className="w-6 h-6" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-12 gap-6">
                                {/* Left Column: Progress & Student Roster */}
                                <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
                                    {/* Progress Summary Card */}
                                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
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
                                                    {(() => {
                                                        const realProgress = getRealStudentProgress(student.student_id, student.mock_progress);
                                                        return (
                                                            <>
                                                                <div className="flex-1">
                                                                    <div className="flex justify-between mb-1">
                                                                        <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#ecb613] transition-colors">{student.name}</span>
                                                                        <span className="text-[10px] font-black tracking-wider uppercase text-amber-600 dark:text-[#ecb613] bg-amber-500/10 dark:bg-[#ecb613]/10 px-2 py-0.5 rounded-lg font-mono">
                                                                            {student.level}
                                                                        </span>
                                                                    </div>
                                                                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                                                        <div className={`h-full transition-all duration-500 ${
                                                                            realProgress >= 80 
                                                                                ? 'bg-emerald-500' 
                                                                                : (realProgress >= 40 ? 'bg-[#ecb613]' : 'bg-rose-500')
                                                                        }`} style={{ width: `${realProgress}%` }}></div>
                                                                    </div>
                                                                </div>
                                                                <span className="text-xs font-bold text-slate-400 w-8 text-right">{realProgress}%</span>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            ))}
                                            {students.length === 0 && (
                                                <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                                    <p className="text-slate-500 text-sm font-medium">No students enrolled yet.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Student Roster Table */}
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Student Roster</h3>
                                            <div className="flex gap-3">
                                                <button className="px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">Export PDF</button>
                                                <button
                                                    onClick={openDirectoryModal}
                                                    className="flex items-center gap-1.5 px-4 py-2 bg-[#ecb613] shadow-md shadow-[#ecb613]/20 hover:bg-[#ecb613]/90 text-slate-900 rounded-xl text-xs font-bold transition-colors"
                                                >
                                                    <UserPlus className="w-3.5 h-3.5" />
                                                    Add from Directory
                                                </button>
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
                                                        <th className="px-6 py-4 text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {paginatedStudents.map(student => (
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
                                                                <button
                                                                    onClick={() => handleRemoveStudent(student)}
                                                                    disabled={removingStudentId === student.id}
                                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg transition-all disabled:opacity-50"
                                                                    title="Remove from this classroom"
                                                                >
                                                                    {removingStudentId === student.id
                                                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                        : <Trash2 className="w-3.5 h-3.5" />}
                                                                    Remove
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {paginatedStudents.length === 0 && (
                                                        <tr>
                                                            <td colSpan={6} className="px-6 py-12 text-center bg-slate-50 dark:bg-slate-800/30">
                                                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-3">No students enrolled yet.</p>
                                                                <button
                                                                    onClick={openDirectoryModal}
                                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#ecb613] text-slate-900 rounded-xl text-xs font-bold hover:bg-[#ecb613]/90 transition-colors shadow-sm"
                                                                >
                                                                    <UserPlus className="w-4 h-4" /> Add from Directory
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center rounded-b-2xl">
                                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                Showing {paginatedStudents.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0} - {Math.min(currentPage * PAGE_SIZE, students.length)} of {students.length} students
                                            </span>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                    disabled={currentPage === 1}
                                                    className="px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50"
                                                >
                                                    Previous
                                                </button>
                                                <button 
                                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                                    disabled={currentPage === totalPages || totalPages === 0}
                                                    className="px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50"
                                                >
                                                    Next
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Quick Actions, Schedules, and Announcements */}
                                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                                    {!isMeetingView && (
                                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Quick Actions</h4>
                                                <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button 
                                                    onClick={() => setShowMessageModal(true)}
                                                    className="p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-[#ecb613]/10 rounded-xl text-center transition-all group border border-slate-200 dark:border-slate-700 hover:border-[#ecb613]/30 flex flex-col items-center justify-center"
                                                >
                                                    <MessageSquare className="w-6 h-6 text-[#ecb613] mb-2 group-hover:scale-110 transition-transform" />
                                                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white uppercase tracking-wide">Message All</span>
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
                                    )}

                                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Class Schedule</h4>
                                            <Clock className="w-5 h-5 text-[#ecb613]" />
                                        </div>
                                        <div className="space-y-3">
                                            {schedules.length === 0 ? (
                                                <p className="text-xs text-slate-400 italic">No schedule set</p>
                                            ) : (
                                                schedules.slice(0, 3).map(slot => (
                                                    <div key={slot.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{DAY_NAMES[slot.day_of_week]}</span>
                                                        <span className="text-xs font-medium text-[#ecb613]">{formatTime12hr(slot.start_time)} - {formatTime12hr(slot.end_time)}</span>
                                                    </div>
                                                ))
                                            )}
                                            {schedules.length > 3 && (
                                                <button onClick={() => setActiveTab('Settings')} className="text-[10px] font-bold text-[#ecb613] hover:underline w-full text-center mt-2">
                                                    View all {schedules.length} slots
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {!isMeetingView && (
                                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-4">
                                            <div className="flex flex-col gap-3">
                                                <div className="text-left">
                                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Class Announcements</h3>
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">Recent highlights broadcasted to this class</p>
                                                </div>
                                                <div className="relative w-full">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                                                    <input 
                                                        className="pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-xl text-xs w-full focus:ring-2 focus:ring-[#ecb613] outline-none transition-all placeholder:text-slate-400 font-bold" 
                                                        placeholder="Search announcements..." 
                                                        type="text" 
                                                        value={announcementSearchQuery}
                                                        onChange={(e) => setAnnouncementSearchQuery(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                                                {filteredAnnouncements.map((bc, idx) => (
                                                    <div 
                                                        key={bc.id || idx} 
                                                        onClick={() => setSelectedAnnouncement(bc)}
                                                        className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-100 dark:border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-[#ecb613] transition-colors relative cursor-pointer text-left group"
                                                    >
                                                        <div className="flex-1 min-w-0 text-left">
                                                            <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate block group-hover:text-[#ecb613] transition-colors">{bc.subject}</span>
                                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium line-clamp-1 mt-0.5">{bc.content}</p>
                                                        </div>
                                                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold shrink-0">
                                                            {new Date(bc.created_at).toLocaleDateString('en-US', {
                                                                month: 'short',
                                                                day: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </span>
                                                    </div>
                                                ))}
                                                {filteredAnnouncements.length === 0 && (
                                                    <div className="py-6 text-center bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                                        <p className="text-slate-400 text-xs font-semibold">
                                                            {announcementSearchQuery ? 'No announcements match your search.' : 'No announcements sent yet.'}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                    </div>
                ) : activeTab === 'Curriculum' ? (
                        <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
                            {/* Section 1: Dashboard Header */}
                            <section className="mb-8">
                                <div className="relative overflow-hidden p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md shadow-amber-500/[0.01]">
                                    {/* Decorative glowing gradient sphere */}
                                    <div className="absolute -right-16 -bottom-16 w-72 h-72 bg-gradient-to-tr from-amber-500/10 via-amber-500/[0.02] to-transparent rounded-full blur-3xl pointer-events-none select-none"></div>
                                    <div className="absolute left-1/3 top-0 w-64 h-64 bg-amber-500/[0.02] rounded-full blur-3xl pointer-events-none select-none"></div>
                                    
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                                        <div className="space-y-3 text-left">
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] text-amber-600 dark:text-amber-400 font-extrabold tracking-widest uppercase select-none">
                                                <Sparkles className="size-3 text-amber-500 animate-pulse" />
                                                <span>Classroom Learning Path</span>
                                            </div>
                                            <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-none text-slate-900 dark:text-white">
                                                Curriculum <span className="bg-gradient-to-r from-[#ecb613] to-amber-500 bg-clip-text text-transparent">Tutorials</span>
                                            </h1>
                                            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium max-w-xl leading-relaxed">
                                                An interactive learning roadmap. Students access these modules, audio files, sheet music PDFs, and step-by-step video guides directly in their student portals.
                                            </p>
                                        </div>
                                        <button 
                                            onClick={() => setIsInventoryDrawerOpen(true)}
                                            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-950 font-black text-xs tracking-wider uppercase transition-all shadow-md shadow-[#ecb613]/10 hover:-translate-y-0.5 active:translate-y-0 active:scale-98 self-start md:self-center shrink-0 border border-[#ecb613]/10"
                                        >
                                            <Plus className="size-4 stroke-[3]" />
                                            <span>Add from Inventory</span>
                                        </button>
                                    </div>

                                    {/* Class-wide vs Individual Sub-tabs */}
                                    <div className="flex border-b border-slate-200 dark:border-slate-800 gap-8 mt-6">
                                        <button
                                            onClick={() => setCurriculumTab('classwide')}
                                            className={`pb-3 text-xs font-black uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
                                                curriculumTab === 'classwide' 
                                                    ? 'border-[#ecb613] text-[#ecb613]' 
                                                    : 'border-transparent text-slate-400 hover:text-slate-605 dark:text-slate-500 dark:hover:text-slate-400'
                                            }`}
                                        >
                                            Class-wide Roster Lock
                                        </button>
                                        <button
                                            onClick={() => {
                                                setCurriculumTab('individual');
                                                if (!selectedStudentForCurriculum && activeAttendanceRoster.length > 0) {
                                                    setSelectedStudentForCurriculum(activeAttendanceRoster[0]);
                                                }
                                            }}
                                            className={`pb-3 text-xs font-black uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
                                                curriculumTab === 'individual' 
                                                    ? 'border-[#ecb613] text-[#ecb613]' 
                                                    : 'border-transparent text-slate-400 hover:text-slate-655 dark:text-slate-500 dark:hover:text-slate-400'
                                            }`}
                                        >
                                            Individual Override Pacing
                                        </button>
                                    </div>
                                </div>
                            </section>

                            {/* Section 2: Student Horizontal Scroll Bar for Individual Override Mode */}
                            {curriculumTab === 'individual' && (
                                <div className="flex items-center gap-3 overflow-x-auto py-4 px-4 scrollbar-hide border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl mb-8 shadow-sm">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider shrink-0">Select Student:</span>
                                    {activeAttendanceRoster.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic">No students in this classroom.</p>
                                    ) : (
                                        activeAttendanceRoster.map(s => {
                                            const isSelected = selectedStudentForCurriculum?.student_id === s.student_id;
                                            return (
                                                <button
                                                    key={s.id}
                                                    onClick={() => setSelectedStudentForCurriculum(s)}
                                                    className={`flex items-center gap-2.5 px-4 py-2 rounded-full transition-all shrink-0 border ${
                                                        isSelected 
                                                            ? 'bg-[#ecb613]/10 border-[#ecb613]/30 text-[#ecb613] shadow-sm font-bold scale-[1.02]' 
                                                            : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                    }`}
                                                >
                                                    <div className="w-6 h-6 rounded-full overflow-hidden bg-[#ecb613]/20 flex items-center justify-center shrink-0">
                                                        {s.profile_pic_url ? (
                                                            <img src={s.profile_pic_url} alt={s.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-[10px] text-[#ecb613] font-black">{s.name.charAt(0)}</span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs leading-none">{s.name}</span>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            )}

                            {/* Two-Column Responsive Grid */}
                            <div className="grid grid-cols-12 gap-8 items-start">
                                <div className={`${curriculumTab === 'individual' && selectedStudentForCurriculum ? 'col-span-12 lg:col-span-8' : 'col-span-12'} space-y-6`}>
                                    {allocatedInventoryItems.length === 0 ? (
                                        <div className="p-16 text-center bg-slate-50/50 dark:bg-slate-900/40 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/80 rounded-3xl shadow-sm text-slate-400 flex flex-col items-center justify-center min-h-[400px]">
                                            <div className="w-20 h-20 rounded-2xl bg-amber-500/10 dark:bg-amber-500/[0.05] border border-amber-500/20 flex items-center justify-center text-amber-500 mb-6 shadow-inner animate-bounce duration-1000">
                                                <BookOpen className="size-10 text-amber-500" />
                                            </div>
                                            <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">No Learning Path Set</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md leading-relaxed text-center">
                                                You haven't allocated any study materials yet. Open the Inventory Library to allocate levels, chapters, or individual lessons.
                                            </p>
                                            <button 
                                                onClick={() => setIsInventoryDrawerOpen(true)}
                                                className="mt-8 inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 text-xs font-black rounded-xl shadow-lg hover:shadow-amber-500/10 transition-all hover:-translate-y-0.5 uppercase tracking-wider"
                                            >
                                                <Sparkles className="size-4" /> Explore Inventory Library
                                            </button>
                                        </div>
                                    ) : !hasAnyVisibleModule ? (
                                        <div className="p-16 text-center bg-slate-50/50 dark:bg-slate-900/40 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/80 rounded-3xl shadow-sm text-slate-400 flex flex-col items-center justify-center min-h-[400px] border-dashed">
                                            <div className="w-20 h-20 rounded-2xl bg-amber-500/10 dark:bg-amber-500/[0.05] border border-amber-500/20 flex items-center justify-center text-amber-500 mb-6 shadow-inner animate-pulse">
                                                <Sliders className="size-10 text-amber-500" />
                                            </div>
                                            <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-105">No Allocated Topics</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md leading-relaxed text-center font-medium">
                                                This student has no active or unlocked study materials in their personalized learning path yet.
                                            </p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2.5 max-w-sm text-center leading-normal">
                                                You can switch to the <strong>Class-wide Roster Lock</strong> tab to unlock specific topics for them, or assign specialized materials individually from the Inventory Library.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-12">
                                            {groupedAllocations.map((group) => {
                                                const visibleModules = group.modules.filter(modGroup => {
                                                    if (curriculumTab === 'individual' && selectedStudentForCurriculum) {
                                                        return modGroup.allocations.some(asg => {
                                                            if (asg.target_type === 'individual') return true;
                                                            if (asg.inventory_ref_type === 'module') {
                                                                const modChapters = courseChapters.filter(c => c.module_id === asg.inventory_ref_id);
                                                                return modChapters.some(chap => {
                                                                    const chapLessons = courseLessons.filter(l => l.chapter_id === chap.id);
                                                                    return chapLessons.some(lesson => 
                                                                        selectedStudentPermissions.completedLessons.has(lesson.id) ||
                                                                        selectedStudentPermissions.unlockedLessons.has(lesson.id)
                                                                    );
                                                                });
                                                            } else if (asg.inventory_ref_type === 'chapter') {
                                                                const chapLessons = courseLessons.filter(l => l.chapter_id === asg.inventory_ref_id);
                                                                return chapLessons.some(lesson => 
                                                                    selectedStudentPermissions.completedLessons.has(lesson.id) ||
                                                                    selectedStudentPermissions.unlockedLessons.has(lesson.id)
                                                                );
                                                            } else if (asg.inventory_ref_type === 'lesson') {
                                                                return selectedStudentPermissions.completedLessons.has(asg.inventory_ref_id) ||
                                                                       selectedStudentPermissions.unlockedLessons.has(asg.inventory_ref_id);
                                                            }
                                                            return false;
                                                        });
                                                    }
                                                    return true;
                                                });

                                                if (visibleModules.length === 0) return null;

                                                const isHeadlineExpanded = expandedHeadlines[group.categoryName] !== false;
                                                return (
                                                    <div key={group.categoryName} className="space-y-6">
                                                        {/* Category / Headline Header */}
                                                        <div 
                                                            onClick={() => setExpandedHeadlines(prev => ({ ...prev, [group.categoryName]: !isHeadlineExpanded }))}
                                                            className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 pl-1 cursor-pointer select-none group/headline hover:border-[#ecb613]/40 transition-colors"
                                                        >
                                                            <div className="flex items-center gap-3 text-left">
                                                                <div className="w-2.5 h-6 rounded-full bg-[#ecb613]" />
                                                                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest font-mono group-hover/headline:text-[#ecb613] transition-colors">
                                                                    {group.categoryName}
                                                                </h3>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-black uppercase tracking-wider font-mono bg-[#ecb613]/10 text-[#ecb613] px-3 py-1 rounded-full border border-[#ecb613]/25">
                                                                    Section
                                                                </span>
                                                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover/headline:bg-[#ecb613]/10 group-hover/headline:text-[#ecb613] transition-all">
                                                                    {isHeadlineExpanded ? (
                                                                        <ChevronUp className="size-4" />
                                                                    ) : (
                                                                        <ChevronDown className="size-4" />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
 
                                                        {/* Modules Under This Category */}
                                                        {isHeadlineExpanded && (
                                                            <div className="space-y-8 pl-3 md:pl-6 border-l-2 border-slate-150 dark:border-slate-800 text-left">
                                                                {visibleModules.map((modGroup) => {
                                                                    const moduleAsg = modGroup.allocations.find(a => a.inventory_ref_type === 'module');
                                                                    const hasModuleAssignment = !!moduleAsg;
                                                                    const isModuleExpanded = expandedModules[modGroup.id] !== false;
                                                                    return (
                                                                        <div key={modGroup.id} className="space-y-4">
                                                                            {/* Collapsible Module/Level Header */}
                                                                            {hasModuleAssignment ? (
                                                                                <div 
                                                                                    onClick={() => setExpandedModules(prev => ({ ...prev, [modGroup.id]: !isModuleExpanded }))}
                                                                                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md shadow-amber-500/[0.01] hover:border-[#ecb613]/55 cursor-pointer select-none transition-all text-left group/level-capsule animate-in fade-in duration-300"
                                                                                >
                                                                                    <div className="flex items-center gap-4">
                                                                                        <div className="w-11 h-11 rounded-2xl bg-[#ecb613]/10 flex items-center justify-center text-[#ecb613] shadow-sm shrink-0 transition-transform group-hover/level-capsule:scale-105">
                                                                                            <BookOpen className="size-5" />
                                                                                        </div>
                                                                                        <div className="space-y-1 text-left">
                                                                                            <div className="flex items-center gap-2.5 flex-wrap">
                                                                                                <h3 className="font-extrabold text-base md:text-lg text-slate-900 dark:text-white leading-tight">
                                                                                                    {modGroup.moduleName}
                                                                                                </h3>
                                                                                                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-[#ecb613]/10 text-[#ecb613] border border-[#ecb613]/20">
                                                                                                    Level Allocated
                                                                                                </span>
                                                                                            </div>
                                                                                            {moduleAsg && (
                                                                                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase font-mono tracking-wider">
                                                                                                    Allocated on {new Date(moduleAsg.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                                                </p>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>

                                                                                    <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/80 pt-3 sm:pt-0" onClick={e => e.stopPropagation()}>
                                                                                        {moduleAsg && (
                                                                                            <button 
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    handleDeallocateItem(moduleAsg.id);
                                                                                                }}
                                                                                                disabled={deletingAssignmentId === moduleAsg.id}
                                                                                                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-black text-rose-500 hover:text-white bg-rose-500/10 hover:bg-rose-500 transition-all border border-transparent hover:border-rose-600/10 shadow-sm cursor-pointer"
                                                                                                title="Deallocate level from class"
                                                                                                type="button"
                                                                                            >
                                                                                                {deletingAssignmentId === moduleAsg.id ? (
                                                                                                    <Loader2 className="size-3.5 animate-spin" />
                                                                                                ) : (
                                                                                                    <Trash2 className="size-3.5" />
                                                                                                )}
                                                                                                <span>Remove</span>
                                                                                            </button>
                                                                                        )}
                                                                                        <div 
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                setExpandedModules(prev => ({ ...prev, [modGroup.id]: !isModuleExpanded }));
                                                                                            }}
                                                                                            className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-[#ecb613]/15 hover:text-[#ecb613] transition-all cursor-pointer"
                                                                                        >
                                                                                            {isModuleExpanded ? (
                                                                                                <ChevronUp className="size-4" />
                                                                                            ) : (
                                                                                                <ChevronDown className="size-4" />
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            ) : (
                                                                                <div 
                                                                                    onClick={() => setExpandedModules(prev => ({ ...prev, [modGroup.id]: !isModuleExpanded }))}
                                                                                    className="flex items-center justify-between cursor-pointer select-none group/module bg-slate-100/50 hover:bg-slate-200/50 dark:bg-slate-800/20 dark:hover:bg-slate-800/40 p-3 rounded-2xl transition-all"
                                                                                >
                                                                                    <div className="flex items-center gap-2">
                                                                                        <BookOpen className="size-4 text-[#ecb613]" />
                                                                                        <h4 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                                                                                            {modGroup.moduleName}
                                                                                        </h4>
                                                                                        <span className="px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider bg-slate-200 text-slate-500 dark:bg-slate-850 dark:text-slate-400 border border-slate-300/30">
                                                                                            Custom Pacing
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover/module:text-[#ecb613] transition-all">
                                                                                        {isModuleExpanded ? (
                                                                                            <ChevronUp className="size-3.5" />
                                                                                        ) : (
                                                                                            <ChevronDown className="size-3.5" />
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            )}

                                                                            {/* Assignments Under This Module */}
                                                                            {(isModuleExpanded || hasModuleAssignment) && (
                                                                                <div className="space-y-6">
                                                                    {modGroup.allocations.map((asg) => {
                                                                        const isDeleting = deletingAssignmentId === asg.id;
                                                                        const isAsgModule = asg.inventory_ref_type === 'module';
                                                                        
                                                                        // Define beautiful styles based on reference type
                                                                        const typeColors = {
                                                                            module: {
                                                                                bg: 'bg-amber-500/[0.01] dark:bg-amber-500/[0.005]',
                                                                                border: 'hover:border-amber-500/30 border-l-[#ecb613]',
                                                                                badge: 'bg-amber-550 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/10',
                                                                                iconBg: 'bg-[#ecb613]/10 text-[#ecb613]'
                                                                            },
                                                                            chapter: {
                                                                                bg: 'bg-amber-400/[0.01] dark:bg-amber-400/[0.005]',
                                                                                border: 'hover:border-amber-400/30 border-l-amber-400',
                                                                                badge: 'bg-amber-50/80 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300 border border-amber-150 dark:border-amber-400/15',
                                                                                iconBg: 'bg-amber-400/10 text-amber-500'
                                                                            },
                                                                            lesson: {
                                                                                bg: 'bg-amber-300/[0.01] dark:bg-amber-300/[0.005]',
                                                                                border: 'hover:border-amber-300/30 border-l-amber-300',
                                                                                badge: 'bg-amber-550/50 text-amber-500 dark:bg-amber-300/10 dark:text-amber-300 border border-amber-100 dark:border-amber-300/10',
                                                                                iconBg: 'bg-amber-300/10 text-amber-500'
                                                                            }
                                                                        }[asg.inventory_ref_type as 'module' | 'chapter' | 'lesson'] || {
                                                                            bg: 'bg-slate-500/[0.03]',
                                                                            border: 'hover:border-slate-500/30 border-l-slate-500',
                                                                            badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
                                                                            iconBg: 'bg-slate-100 text-slate-600'
                                                                        };

                                                                        return (
                                                                            <div 
                                                                                key={asg.id} 
                                                                                className={isAsgModule ? "space-y-6 text-left" : `group relative bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/70 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-lg ${typeColors.border} border-l-4 text-left`}
                                                                            >
                                                                                {/* Tutorial Header */}
                                                                                {!isAsgModule && (
                                                                                    <div 
                                                                                        onClick={isAsgModule ? () => setExpandedModules(prev => ({ ...prev, [modGroup.id]: !isModuleExpanded })) : undefined}
                                                                                        className={`px-6 py-5 bg-slate-50/50 dark:bg-slate-955/[0.15] border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-4 ${isAsgModule ? 'cursor-pointer select-none hover:bg-slate-100/60 dark:hover:bg-slate-850 transition-colors' : ''}`}
                                                                                    >
                                                                                        <div className="flex items-center gap-4 pl-2">
                                                                                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm ${typeColors.iconBg}`}>
                                                                                                {asg.inventory_ref_type === 'module' ? (
                                                                                                    <BookOpen className="size-5" />
                                                                                                ) : asg.inventory_ref_type === 'chapter' ? (
                                                                                                    <ClipboardList className="size-5" />
                                                                                                ) : (
                                                                                                    <Music className="size-5" />
                                                                                                )}
                                                                                            </div>
                                                                                            <div className="space-y-1">
                                                                                                <div className="flex items-center gap-2.5 flex-wrap">
                                                                                                    <h3 className="font-extrabold text-base md:text-lg text-slate-900 dark:text-white leading-tight">
                                                                                                        {asg.inventory_ref_title || asg.title}
                                                                                                    </h3>
                                                                                                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${typeColors.badge}`}>
                                                                                                        {asg.inventory_ref_type === 'module' ? (() => {
                                                                                                            const mod = courseModules.find(m => m.id === asg.inventory_ref_id);
                                                                                                            if (mod) {
                                                                                                                return parseModuleCategory(mod).category;
                                                                                                            }
                                                                                                            return 'Module';
                                                                                                        })() : asg.inventory_ref_type}
                                                                                                    </span>
                                                                                                </div>
                                                                                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase font-mono tracking-wider">
                                                                                                    Allocated on {new Date(asg.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                                                </p>
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-3">
                                                                                            <button 
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    handleDeallocateItem(asg.id);
                                                                                                }}
                                                                                                disabled={deletingAssignmentId === asg.id}
                                                                                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black text-rose-500 hover:text-white bg-rose-500/10 hover:bg-rose-500 transition-all border border-transparent hover:border-rose-600/10 shadow-sm"
                                                                                                title="Deallocate chapter from class"
                                                                                            >
                                                                                                {deletingAssignmentId === asg.id ? (
                                                                                                    <Loader2 className="size-3.5 animate-spin" />
                                                                                                ) : (
                                                                                                    <Trash2 className="size-3.5" />
                                                                                                )}
                                                                                                <span>Remove</span>
                                                                                            </button>
                                                                                            
                                                                                            {isAsgModule && (
                                                                                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-550 transition-all">
                                                                                                    {isModuleExpanded ? (
                                                                                                        <ChevronUp className="size-4" />
                                                                                                    ) : (
                                                                                                        <ChevronDown className="size-4" />
                                                                                                    )}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                )}

                                                                                {/* Tutorial Body */}
                                                                                {(!isAsgModule || isModuleExpanded) && (
                                                                                    <div className={isAsgModule ? "space-y-6" : "p-6 md:p-8 space-y-8"}>
                                                                                    {/* Description/Instructions */}
                                                                                    {asg.description && (
                                                                                        <div className="p-5 rounded-2xl bg-amber-500/[0.04] dark:bg-amber-500/[0.01] border border-amber-500/15 text-slate-700 dark:text-slate-300 flex items-start gap-4">
                                                                                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                                                                                                <Lightbulb className="size-4.5 text-amber-500" />
                                                                                            </div>
                                                                                            <div className="space-y-1.5 text-left">
                                                                                                <span className="text-[10px] font-black uppercase text-amber-500 tracking-widest font-mono">Teacher's Learning Instructions</span>
                                                                                                <p className="text-xs font-medium leading-relaxed whitespace-pre-wrap">{asg.description}</p>
                                                                                            </div>
                                                                                        </div>
                                                                                    )}

                                                                                    {/* Render Module details */}
                                                                                    {asg.inventory_ref_type === 'module' && (() => {
                                                                                        const mod = courseModules.find(m => m.id === asg.inventory_ref_id);
                                                                                        if (!mod) return <p className="text-xs text-slate-400 italic text-left pl-2">Curriculum Level data could not be loaded.</p>;
                                                                                        
                                                                                        const rawChapters = courseChapters.filter(c => c.module_id === mod.id);
                                                                                        const chaptersInMod = rawChapters.filter(chap => {
                                                                                            if (curriculumTab === 'individual' && selectedStudentForCurriculum && asg.target_type === 'all') {
                                                                                                const lessons = courseLessons.filter(l => l.chapter_id === chap.id);
                                                                                                return lessons.some(lesson => {
                                                                                                    const isCompleted = selectedStudentPermissions.completedLessons.has(lesson.id);
                                                                                                    const isUnlocked = selectedStudentPermissions.unlockedLessons.has(lesson.id);
                                                                                                    return isCompleted || isUnlocked;
                                                                                                });
                                                                                            }
                                                                                            return true;
                                                                                        });
                                                                                        return (
                                                                                            <div className="space-y-5">
                                                                                                <div className="border-b border-slate-100 dark:border-slate-800/80 pb-3 flex items-center justify-between pl-2">
                                                                                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none font-mono">
                                                                                                        {`${parseModuleCategory(mod).category} Syllabus Outline`}
                                                                                                    </h4>
                                                                                                    <span className="text-[10px] font-bold text-slate-400 font-mono bg-slate-100 dark:bg-slate-800/50 px-2 py-0.5 rounded">
                                                                                                        {chaptersInMod.length} Chapters
                                                                                                    </span>
                                                                                                </div>
                                                                                                {chaptersInMod.length === 0 ? (
                                                                                                    <p className="text-xs text-slate-400 italic text-left pl-2">No chapters defined in this level.</p>
                                                                                                ) : (
                                                                                                    <div className="space-y-4">
                                                                                                        {chaptersInMod.map(chap => {
                                                                                                            const isExpanded = !!expandedChapters[chap.id];
                                                                                                            const rawLessons = courseLessons.filter(l => l.chapter_id === chap.id);
                                                                                                            const chapLessons = rawLessons.filter(lesson => {
                                                                                                                if (curriculumTab === 'individual' && selectedStudentForCurriculum && asg.target_type === 'all') {
                                                                                                                    const isCompleted = selectedStudentPermissions.completedLessons.has(lesson.id);
                                                                                                                    const isUnlocked = selectedStudentPermissions.unlockedLessons.has(lesson.id);
                                                                                                                    return isCompleted || isUnlocked;
                                                                                                                }
                                                                                                                return true;
                                                                                                            });
                                                                                                            
                                                                                                            return (
                                                                                                                <div 
                                                                                                                    key={chap.id} 
                                                                                                                    className="rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden bg-slate-50/[0.2] dark:bg-slate-955/[0.05] transition-all duration-300 hover:border-slate-300 dark:hover:border-slate-700"
                                                                                                                >
                                                                                                                    {/* Chapter Header */}
                                                                                                                    <div 
                                                                                                                        onClick={() => setExpandedChapters(prev => ({ ...prev, [chap.id]: !isExpanded }))}
                                                                                                                        className="px-5 py-4 bg-slate-50/50 dark:bg-slate-955/[0.2] hover:bg-slate-100/60 dark:hover:bg-slate-955/[0.3] transition-all flex items-center justify-between cursor-pointer select-none"
                                                                                                                    >
                                                                                                                        <div className="flex items-center gap-4">
                                                                                                                            <div className="w-10 h-10 rounded-xl bg-[#ecb613]/10 border border-[#ecb613]/25 flex items-center justify-center text-[#ecb613] text-xs font-black font-mono">
                                                                                                                                Ch{chap.chapter_number}
                                                                                                                            </div>
                                                                                                                            <div className="text-left">
                                                                                                                                <h5 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 leading-tight">
                                                                                                                                    {chap.title}
                                                                                                                                </h5>
                                                                                                                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1 uppercase tracking-wider font-mono">
                                                                                                                                    {chapLessons.length} STUDY UNITS
                                                                                                                                </p>
                                                                                                                            </div>
                                                                                                                        </div>
                                                                                                                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-900/60 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                                                                                                                            {isExpanded ? (
                                                                                                                                <ChevronUp className="size-4" />
                                                                                                                            ) : (
                                                                                                                                <ChevronDown className="size-4" />
                                                                                                                            )}
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                    
                                                                                                                    {/* Chapter Lessons */}
                                                                                                                    {isExpanded && (
                                                                                                                        <div className="p-5 bg-white dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800/80 space-y-4">
                                                                                                                            {chapLessons.length === 0 ? (
                                                                                                                                <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl">No lesson materials uploaded for this chapter.</p>
                                                                                                                            ) : (
                                                                                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative pl-3 border-l border-slate-200/60 dark:border-slate-800">
                                                                                                                                    {chapLessons.map(lesson => {
                                                                                                                                         const isUpdating = isUpdatingProgress === lesson.id;
                                                                                                                                         
                                                                                                                                         let isCompleted = false;
                                                                                                                                         let isUnlocked = false;
                                                                                                                                         let statusLabel = "Locked";
                                                                                                                                         let cardBorder = "border-slate-200 dark:border-slate-800 bg-slate-50/30 opacity-70";
                                                                                                                                         
                                                                                                                                         if (curriculumTab === 'individual' && selectedStudentForCurriculum) {
                                                                                                                                             isCompleted = selectedStudentPermissions.completedLessons.has(lesson.id);
                                                                                                                                             isUnlocked = selectedStudentPermissions.unlockedLessons.has(lesson.id);
                                                                                                                                             if (isCompleted) {
                                                                                                                                                 statusLabel = "Completed";
                                                                                                                                                 cardBorder = "border-emerald-500 bg-emerald-50/[0.03] dark:bg-emerald-500/[0.02] shadow-xs";
                                                                                                                                             } else if (isUnlocked) {
                                                                                                                                                 statusLabel = "Unlocked";
                                                                                                                                                 cardBorder = "border-[#ecb613] bg-amber-500/[0.02] dark:bg-[#ecb613]/[0.01] shadow-xs";
                                                                                                                                             }
                                                                                                                                         } else {
                                                                                                                                             const progressForLesson = studentProgress.filter(p => p.lesson_id === lesson.id);
                                                                                                                                             if (students.length === 0) {
                                                                                                                                                 const classwideRow = progressForLesson.find(p => p.student_id === 'classwide_default');
                                                                                                                                                 if (classwideRow) {
                                                                                                                                                     if (classwideRow.status === 'completed') {
                                                                                                                                                         statusLabel = "Completed";
                                                                                                                                                         cardBorder = "border-emerald-500 bg-emerald-50/[0.03] dark:bg-emerald-500/[0.02] shadow-xs";
                                                                                                                                                     } else if (classwideRow.status === 'unlocked') {
                                                                                                                                                         statusLabel = "Unlocked";
                                                                                                                                                         cardBorder = "border-[#ecb613] bg-amber-500/[0.02] dark:bg-[#ecb613]/[0.01] shadow-xs";
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
                                                                                                                                                     cardBorder = "border-emerald-500 bg-emerald-50/[0.03] dark:bg-emerald-500/[0.02] shadow-xs";
                                                                                                                                                 } else if (completedCount > 0 || unlockedCount > 0) {
                                                                                                                                                     statusLabel = completedCount > 0 ? `Unlocked (${completedCount}/${students.length} Done)` : "Unlocked";
                                                                                                                                                     cardBorder = "border-[#ecb613] bg-amber-500/[0.02] dark:bg-[#ecb613]/[0.01] shadow-xs";
                                                                                                                                                 } else {
                                                                                                                                                     statusLabel = "Locked";
                                                                                                                                                     cardBorder = "border-slate-200 dark:border-slate-800 bg-slate-50/30 opacity-70";
                                                                                                                                                 }
                                                                                                                                             }
                                                                                                                                         }
                                                                                                                                         
                                                                                                                                         return (
                                                                                                                                             <div 
                                                                                                                                                 key={lesson.id} 
                                                                                                                                                 onClick={() => {
                                                                                                                          setSelectedTopic(lesson);
                                                                                                                      }}
                                                                                                                                                 className={`group rounded-2xl p-4 border flex items-center justify-between gap-4 cursor-pointer hover:border-[#ecb613]/40 hover:bg-slate-100/40 dark:hover:bg-slate-800/40 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 hover:shadow-md ${cardBorder}`}
                                                                                                                                             >
                                                                                                                                                 {/* Left side: Material Type Icon */}
                                                                                                                                                 <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                                                                                                                                     <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs border transition-colors ${
                                                                                                                                                         lesson.material_type === 'video' 
                                                                                                                                                             ? 'text-rose-500 bg-rose-500/10 border-rose-500/20' 
                                                                                                                                                             : lesson.material_type === 'audio' 
                                                                                                                                                             ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' 
                                                                                                                                                             : 'text-blue-500 bg-blue-500/10 border-blue-500/20'
                                                                                                                                                     }`}>
                                                                                                                                                         {lesson.material_type === 'video' ? (
                                                                                                                                                             <Film className="size-4.5" />
                                                                                                                                                         ) : lesson.material_type === 'audio' ? (
                                                                                                                                                             <Music className="size-4.5" />
                                                                                                                                                         ) : (
                                                                                                                                                             <FileText className="size-4.5" />
                                                                                                                                                         )}
                                                                                                                                                     </div>

                                                                                                                                                     {/* Middle: Details */}
                                                                                                                                                     <div className="text-left min-w-0 flex-1">
                                                                                                                                                         <div className="flex items-center gap-2">
                                                                                                                                                             <span className={`text-[9px] font-black uppercase tracking-wider font-mono ${
                                                                                                                                                                 statusLabel === 'Completed'
                                                                                                                                                                     ? 'text-emerald-600 dark:text-emerald-400' 
                                                                                                                                                                     : (statusLabel === 'Unlocked' || statusLabel.startsWith('Unlocked') ? 'text-amber-600 dark:text-[#ecb613]' : 'text-slate-400 dark:text-slate-500')
                                                                                                                                                             }`}>
                                                                                                                                                                 Topic {lesson.lesson_number}
                                                                                                                                                             </span>
                                                                                                                                                             {isUpdating && <Loader2 className="w-3 h-3 animate-spin text-amber-500" />}
                                                                                                                                                         </div>
                                                                                                                                                         <h5 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 leading-snug truncate mt-0.5">{lesson.title}</h5>
                                                                                                                                                         {lesson.description && (
                                                                                                                                                             <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 leading-relaxed font-semibold mt-0.5">{lesson.description}</p>
                                                                                                                                                         )}
                                                                                                                                                     </div>
                                                                                                                                                 </div>

                                                                                                                                                 {/* Right side: Status indicator & slider action */}
                                                                                                                                                 <div className="flex items-center gap-2 shrink-0">
                                                                                                                                                     <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 border ${
                                                                                                                                                         statusLabel === 'Completed'
                                                                                                                                                             ? 'bg-emerald-500/10 text-emerald-605 dark:text-emerald-400 border-emerald-500/25'
                                                                                                                                                             : (statusLabel === 'Unlocked' || statusLabel.startsWith('Unlocked'))
                                                                                                                                                             ? 'bg-amber-500/10 text-amber-600 dark:text-[#ecb613] border-amber-500/25'
                                                                                                                                                             : 'bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-100 border-transparent'
                                                                                                                                                     }`}>
                                                                                                                                                         {statusLabel === 'Locked' ? (
                                                                                                                                                             <Lock className="size-3" />
                                                                                                                                                         ) : (statusLabel === 'Unlocked' || statusLabel.startsWith('Unlocked')) ? (
                                                                                                                                                             <Unlock className="size-3" />
                                                                                                                                                         ) : (
                                                                                                                                                             <CheckCircle className="size-3" />
                                                                                                                                                         )}
                                                                                                                                                         <span>{statusLabel}</span>
                                                                                                                                                     </div>
                                                                                                                                                     <button
                                                                                              type="button"
                                                                                              title="Manage pacing overrides"
                                                                                              onClick={(e) => {
                                                                                                  e.stopPropagation();
                                                                                                  if (isUpdating) return;
                                                                                                  setAllocationTargetLesson(lesson);
                                                                                                  setAllocationTargetType(curriculumTab === 'individual' ? 'individual' : 'classwide');
                                                                                                  let initialStatus: 'locked' | 'unlocked' | 'completed' = 'unlocked';
                                                                                                  if (statusLabel === 'Completed') {
                                                                                                      initialStatus = 'completed';
                                                                                                  } else if (statusLabel === 'Unlocked' || statusLabel.startsWith('Unlocked')) {
                                                                                                      initialStatus = 'unlocked';
                                                                                                  } else if (statusLabel === 'Locked') {
                                                                                                      initialStatus = 'locked';
                                                                                                  }
                                                                                                  setAllocationStatus(initialStatus);
                                                                                                  const currentSelected = studentProgress
                                                                                                      .filter(p => p.lesson_id === lesson.id && p.status !== 'locked' && p.student_id !== 'classwide_default')
                                                                                                      .map(p => p.student_id);
                                                                                                  setAllocationSelectedStudents((curriculumTab === 'individual' && selectedStudentForCurriculum) ? [selectedStudentForCurriculum.student_id] : (currentSelected.length > 0 ? currentSelected : []));
                                                                                                  setIsAllocationDrawerOpen(true);
                                                                                              }}
                                                                                              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-850 hover:bg-[#ecb613]/10 hover:text-[#ecb613] hover:border-[#ecb613]/30 flex items-center justify-center text-slate-400 dark:text-slate-400 border border-transparent transition-all cursor-pointer"
                                                                                          >
                                                                                              <Sliders className="size-3.5" />
                                                                                          </button>
                                                                                                                                                 </div>
                                                                                                                                             </div>
                                                                                                                                         );
                                                                                                                                    })}
                                                                                                                                </div>
                                                                                                                            )}
                                                                                                                        </div>
                                                                                                                    )}
                                                                                                                </div>
                                                                                                            );
                                                                                                        })}
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        );
                                                                                    })()}

                                                                                    {/* Render Chapter details */}
                                                                                    {asg.inventory_ref_type === 'chapter' && (() => {
                                                                                        const chap = courseChapters.find(c => c.id === asg.inventory_ref_id);
                                                                                        if (!chap) return <p className="text-xs text-slate-400 italic text-left pl-2">Curriculum Chapter data could not be loaded.</p>;
                                                                                        
                                                                                        const rawLessons = courseLessons.filter(l => l.chapter_id === chap.id);
                                                                                        const chapLessons = rawLessons.filter(lesson => {
                                                                                            if (curriculumTab === 'individual' && selectedStudentForCurriculum && asg.target_type === 'all') {
                                                                                                const isCompleted = selectedStudentPermissions.completedLessons.has(lesson.id);
                                                                                                const isUnlocked = selectedStudentPermissions.unlockedLessons.has(lesson.id);
                                                                                                return isCompleted || isUnlocked;
                                                                                            }
                                                                                            return true;
                                                                                        });
                                                                                        return (
                                                                                            <div className="space-y-4">
                                                                                                <div className="border-b border-slate-150 dark:border-slate-800 pb-3 flex items-center justify-between pl-2">
                                                                                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none font-mono">Chapter Lesson Materials</h4>
                                                                                                    <span className="text-[10px] font-bold text-slate-400 font-mono bg-slate-100 dark:bg-slate-800/50 px-2 py-0.5 rounded">
                                                                                                        {chapLessons.length} Study Units
                                                                                                    </span>
                                                                                                </div>
                                                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-3 border-l border-slate-200/60 dark:border-slate-800">
                                                                                                    {chapLessons.length === 0 ? (
                                                                                                        <p className="text-xs text-slate-400 italic text-center py-6 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl w-full">No lesson materials defined in this chapter.</p>
                                                                                                    ) : (
                                                                                                        chapLessons.map(lesson => {
                                                                                                             const isUpdating = isUpdatingProgress === lesson.id;
                                                                                                             
                                                                                                             let isCompleted = false;
                                                                                                             let isUnlocked = false;
                                                                                                             let statusLabel = "Locked";
                                                                                                             let cardBorder = "border-slate-200 dark:border-slate-800 bg-slate-50/30 opacity-70";
                                                                                                             
                                                                                                             if (curriculumTab === 'individual' && selectedStudentForCurriculum) {
                                                                                                                 isCompleted = selectedStudentPermissions.completedLessons.has(lesson.id);
                                                                                                                 isUnlocked = selectedStudentPermissions.unlockedLessons.has(lesson.id);
                                                                                                                 if (isCompleted) {
                                                                                                                     statusLabel = "Completed";
                                                                                                                     cardBorder = "border-emerald-500 bg-emerald-50/[0.03] dark:bg-emerald-500/[0.02] shadow-xs";
                                                                                                                 } else if (isUnlocked) {
                                                                                                                     statusLabel = "Unlocked";
                                                                                                                     cardBorder = "border-[#ecb613] bg-amber-500/[0.02] dark:bg-[#ecb613]/[0.01] shadow-xs";
                                                                                                                 }
                                                                                                             } else {
                                                                                                                 const progressForLesson = studentProgress.filter(p => p.lesson_id === lesson.id);
                                                                                                                 if (students.length === 0) {
                                                                                                                     const classwideRow = progressForLesson.find(p => p.student_id === 'classwide_default');
                                                                                                                     if (classwideRow) {
                                                                                                                         if (classwideRow.status === 'completed') {
                                                                                                                             statusLabel = "Completed";
                                                                                                                             cardBorder = "border-emerald-500 bg-emerald-50/[0.03] dark:bg-emerald-500/[0.02] shadow-xs";
                                                                                                                         } else if (classwideRow.status === 'unlocked') {
                                                                                                                             statusLabel = "Unlocked";
                                                                                                                             cardBorder = "border-[#ecb613] bg-amber-500/[0.02] dark:bg-[#ecb613]/[0.01] shadow-xs";
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
                                                                                                                         cardBorder = "border-emerald-500 bg-emerald-50/[0.03] dark:bg-emerald-500/[0.02] shadow-xs";
                                                                                                                     } else if (unlockedCount === students.length) {
                                                                                                                         statusLabel = "Unlocked";
                                                                                                                         cardBorder = "border-[#ecb613] bg-amber-500/[0.02] dark:bg-[#ecb613]/[0.01] shadow-xs";
                                                                                                                     } else if (completedCount === 0 && unlockedCount === 0) {
                                                                                                                         statusLabel = "Locked";
                                                                                                                     } else {
                                                                                                                         statusLabel = `${completedCount}/${students.length} Done`;
                                                                                                                         cardBorder = "border-sky-500/50 bg-sky-500/[0.01] dark:bg-sky-500/[0.005]";
                                                                                                                     }
                                                                                                                 }
                                                                                                             }
                                                                                                             
                                                                                                             return (
                                                                                                                 <div 
                                                                                                                     key={lesson.id} 
                                                                                                                     onClick={() => {
                                                                                                                          setSelectedTopic(lesson);
                                                                                                                      }}
                                                                                                                     className={`group rounded-2xl p-4 border flex items-center justify-between gap-4 cursor-pointer hover:border-[#ecb613]/40 hover:bg-slate-100/40 dark:hover:bg-slate-800/40 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 hover:shadow-md ${cardBorder}`}
                                                                                                                 >
                                                                                                                     {/* Left side: Material Type Icon */}
                                                                                                                     <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                                                                                                         <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs border transition-colors ${
                                                                                                                             lesson.material_type === 'video' 
                                                                                                                                 ? 'text-rose-500 bg-rose-500/10 border-rose-500/20' 
                                                                                                                                 : lesson.material_type === 'audio' 
                                                                                                                                 ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' 
                                                                                                                                 : 'text-blue-500 bg-blue-500/10 border-blue-500/20'
                                                                                                                         }`}>
                                                                                                                             {lesson.material_type === 'video' ? (
                                                                                                                                 <Film className="size-4.5" />
                                                                                                                             ) : lesson.material_type === 'audio' ? (
                                                                                                                                 <Music className="size-4.5" />
                                                                                                                             ) : (
                                                                                                                                 <FileText className="size-4.5" />
                                                                                                                             )}
                                                                                                                         </div>

                                                                                                                         {/* Middle: Details */}
                                                                                                                         <div className="text-left min-w-0 flex-1">
                                                                                                                             <div className="flex items-center gap-2">
                                                                                                                                 <span className={`text-[9px] font-black uppercase tracking-wider font-mono ${
                                                                                                                                     statusLabel === 'Completed'
                                                                                                                                         ? 'text-emerald-600 dark:text-emerald-400' 
                                                                                                                                         : (statusLabel === 'Unlocked' || statusLabel.startsWith('Unlocked') ? 'text-amber-600 dark:text-[#ecb613]' : 'text-slate-400 dark:text-slate-500')
                                                                                                                                 }`}>
                                                                                                                                     Topic {lesson.lesson_number}
                                                                                                                                 </span>
                                                                                                                                 {isUpdating && <Loader2 className="w-3 h-3 animate-spin text-amber-500" />}
                                                                                                                             </div>
                                                                                                                             <h5 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 leading-snug truncate mt-0.5">{lesson.title}</h5>
                                                                                                                             {lesson.description && (
                                                                                                                                 <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 leading-relaxed font-semibold mt-0.5">{lesson.description}</p>
                                                                                                                             )}
                                                                                                                         </div>
                                                                                                                     </div>

                                                                                                                     {/* Right side: Status indicator & slider action */}
                                                                                                                     <div className="flex items-center gap-2 shrink-0">
                                                                                                                         <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 border ${
                                                                                                                             statusLabel === 'Completed'
                                                                                                                                 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                                                                                                                                 : (statusLabel === 'Unlocked' || statusLabel.startsWith('Unlocked'))
                                                                                                                                 ? 'bg-amber-500/10 text-amber-600 dark:text-[#ecb613] border-amber-500/25'
                                                                                                                                 : 'bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-100 border-transparent'
                                                                                                                         }`}>
                                                                                                                             {statusLabel === 'Locked' ? (
                                                                                                                                 <Lock className="size-3" />
                                                                                                                             ) : statusLabel === 'Unlocked' ? (
                                                                                                                                 <Unlock className="size-3" />
                                                                                                                             ) : (
                                                                                                                                 <CheckCircle className="size-3" />
                                                                                                                             )}
                                                                                                                             <span>{statusLabel}</span>
                                                                                                                         </div>
                                                                                                                         <button
                                                                                              type="button"
                                                                                              title="Manage pacing overrides"
                                                                                              onClick={(e) => {
                                                                                                  e.stopPropagation();
                                                                                                  if (isUpdating) return;
                                                                                                  setAllocationTargetLesson(lesson);
                                                                                                  setAllocationTargetType(curriculumTab === 'individual' ? 'individual' : 'classwide');
                                                                                                  let initialStatus: 'locked' | 'unlocked' | 'completed' = 'unlocked';
                                                                                                  if (statusLabel === 'Completed') {
                                                                                                      initialStatus = 'completed';
                                                                                                  } else if (statusLabel === 'Unlocked' || statusLabel.startsWith('Unlocked')) {
                                                                                                      initialStatus = 'unlocked';
                                                                                                  } else if (statusLabel === 'Locked') {
                                                                                                      initialStatus = 'locked';
                                                                                                  }
                                                                                                  setAllocationStatus(initialStatus);
                                                                                                  const currentSelected = studentProgress
                                                                                                      .filter(p => p.lesson_id === lesson.id && p.status !== 'locked' && p.student_id !== 'classwide_default')
                                                                                                      .map(p => p.student_id);
                                                                                                  setAllocationSelectedStudents((curriculumTab === 'individual' && selectedStudentForCurriculum) ? [selectedStudentForCurriculum.student_id] : (currentSelected.length > 0 ? currentSelected : []));
                                                                                                  setIsAllocationDrawerOpen(true);
                                                                                              }}
                                                                                              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-850 hover:bg-[#ecb613]/10 hover:text-[#ecb613] hover:border-[#ecb613]/30 flex items-center justify-center text-slate-400 dark:text-slate-400 border border-transparent transition-all cursor-pointer"
                                                                                          >
                                                                                              <Sliders className="size-3.5" />
                                                                                          </button>
                                                                                                                     </div>
                                                                                                                 </div>
                                                                                                             );
                                                                                                         })
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    })()}

                                                                                    {/* Render Lesson details */}
                                                                                    {asg.inventory_ref_type === 'lesson' && (() => {
                                                                                        const lesson = courseLessons.find(l => l.id === asg.inventory_ref_id);
                                                                                        if (!lesson) return <p className="text-xs text-slate-400 italic text-left pl-2">Curriculum Lesson data could not be loaded.</p>;
                                                                                        
                                                                                        // Filter out locked class-wide lessons in individual mode
                                                                                        if (curriculumTab === 'individual' && selectedStudentForCurriculum && asg.target_type === 'all') {
                                                                                            const isCompleted = selectedStudentPermissions.completedLessons.has(lesson.id);
                                                                                            const isUnlocked = selectedStudentPermissions.unlockedLessons.has(lesson.id);
                                                                                            if (!isCompleted && !isUnlocked) return null;
                                                                                        }
                                                                                        
                                                                                        const isAudio = lesson.material_type === 'audio';
                                                                                        const isVideo = lesson.material_type === 'video';
                                                                                        const isPdf = lesson.material_type === 'pdf';
                                                                                        
                                                                                        const highlightBorder = isVideo 
                                                                                            ? 'border-l-rose-500' 
                                                                                            : isAudio 
                                                                                            ? 'border-l-amber-500' 
                                                                                            : isPdf 
                                                                                            ? 'border-l-blue-500' 
                                                                                            : 'border-l-emerald-500';

                                                                                        const iconColor = isVideo 
                                                                                            ? 'text-rose-500 bg-rose-500/10' 
                                                                                            : isAudio 
                                                                                            ? 'text-amber-500 bg-amber-500/10' 
                                                                                            : isPdf 
                                                                                            ? 'text-blue-500 bg-blue-500/10' 
                                                                                            : 'text-emerald-500 bg-emerald-50/10';

                                                                                        const isUpdating = isUpdatingProgress === lesson.id;
                                                                                        
                                                                                        let isCompleted = false;
                                                                                        let isUnlocked = false;
                                                                                        let statusLabel = "Locked";
                                                                                        
                                                                                        if (curriculumTab === 'individual' && selectedStudentForCurriculum) {
                                                                                            isCompleted = selectedStudentPermissions.completedLessons.has(lesson.id);
                                                                                            isUnlocked = selectedStudentPermissions.unlockedLessons.has(lesson.id);
                                                                                            if (isCompleted) {
                                                                                                statusLabel = "Completed";
                                                                                            } else if (isUnlocked) {
                                                                                                statusLabel = "Unlocked";
                                                                                            }
                                                                                        } else {
                                                                                            const progressForLesson = studentProgress.filter(p => p.lesson_id === lesson.id);
                                                                                            if (students.length === 0) {
                                                                                                const classwideRow = progressForLesson.find(p => p.student_id === 'classwide_default');
                                                                                                if (classwideRow) {
                                                                                                    if (classwideRow.status === 'completed') {
                                                                                                        statusLabel = "Completed";
                                                                                                    } else if (classwideRow.status === 'unlocked') {
                                                                                                        statusLabel = "Unlocked";
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
                                                                                                } else if (completedCount > 0 || unlockedCount > 0) {
                                                                                                    statusLabel = completedCount > 0 ? `Unlocked (${completedCount}/${students.length} Done)` : "Unlocked";
                                                                                                } else {
                                                                                                    statusLabel = "Locked";
                                                                                                }
                                                                                            }
                                                                                        }

                                                                                        return (
                                                                                            <div className="space-y-4">
                                                                                                <div className="border-b border-slate-100 dark:border-slate-800 pb-3 pl-2 flex items-center justify-between">
                                                                                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none font-mono">Allocated Topic Study Guide</h4>
                                                                                                    <span className={`text-[9px] font-black uppercase tracking-wider font-mono ${
                                                                                                        statusLabel === 'Completed'
                                                                                                            ? 'text-emerald-600 dark:text-emerald-400' 
                                                                                                            : (statusLabel === 'Unlocked' || statusLabel.startsWith('Unlocked') ? 'text-amber-600 dark:text-[#ecb613]' : 'text-slate-400 dark:text-slate-500')
                                                                                                    }`}>
                                                                                                        {statusLabel}
                                                                                                    </span>
                                                                                                </div>
                                                                                                <div 
                                                                                                    className={`p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 border-l-4 ${highlightBorder} bg-slate-50/20 dark:bg-slate-900/40 flex flex-col gap-6 transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700`}
                                                                                                >
                                                                                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                                                                                        <div className="space-y-4 text-left max-w-xl">
                                                                                                            <div className="flex items-center gap-3">
                                                                                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${iconColor}`}>
                                                                                                                    {isVideo ? (
                                                                                                                        <Film className="size-5" />
                                                                                                                    ) : isAudio ? (
                                                                                                                        <Music className="size-5 animate-pulse" />
                                                                                                                    ) : isPdf ? (
                                                                                                                        <FileText className="size-5" />
                                                                                                                    ) : (
                                                                                                                        <BookOpen className="size-5" />
                                                                                                                    )}
                                                                                                                </div>
                                                                                                                <div>
                                                                                                                    <h5 className="font-extrabold text-base text-slate-900 dark:text-white leading-snug">{lesson.title}</h5>
                                                                                                                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 mt-1 inline-block">
                                                                                                                        {lesson.material_type || 'Guide'} Content
                                                                                                                    </span>
                                                                                                                </div>
                                                                                                            </div>
                                                                                                            {lesson.description && (
                                                                                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium pl-1">{lesson.description}</p>
                                                                                                            )}
                                                                                                            {lesson.bullet_points && lesson.bullet_points.length > 0 && (
                                                                                                                <div className="space-y-2 bg-white dark:bg-slate-955/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 pl-4">
                                                                                                                    {lesson.bullet_points.map((pt, i) => (
                                                                                                                        <div key={i} className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                                                                                                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                                                                                                                            <span className="font-medium">{pt}</span>
                                                                                                                        </div>
                                                                                                                    ))}
                                                                                                                </div>
                                                                                                            )}
                                                                                                        </div>
                                                                                                        <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                                                                                                            <div className="flex items-center gap-2">
                                                                                                                <button
                                                                                                                    type="button"
                                                                                                                    disabled={isUpdating}
                                                                                                                    onClick={() => {
                                                                                                                        setAllocationTargetLesson(lesson);
                                                                                                                        setAllocationTargetType(curriculumTab === 'individual' ? 'individual' : 'classwide');
                                                                                                                        let initialStatus: 'locked' | 'unlocked' | 'completed' = 'unlocked';
                                                                                                                        if (statusLabel === 'Completed') {
                                                                                                                            initialStatus = 'completed';
                                                                                                                        } else if (statusLabel === 'Unlocked' || statusLabel.startsWith('Unlocked')) {
                                                                                                                            initialStatus = 'unlocked';
                                                                                                                        } else if (statusLabel === 'Locked') {
                                                                                                                            initialStatus = 'locked';
                                                                                                                        }
                                                                                                                        setAllocationStatus(initialStatus);
                                                                                                                        const currentSelected = studentProgress
                                                                                                                            .filter(p => p.lesson_id === lesson.id && p.status !== 'locked' && p.student_id !== 'classwide_default')
                                                                                                                            .map(p => p.student_id);
                                                                                                                        setAllocationSelectedStudents((curriculumTab === 'individual' && selectedStudentForCurriculum) ? [selectedStudentForCurriculum.student_id] : (currentSelected.length > 0 ? currentSelected : []));
                                                                                                                        setIsAllocationDrawerOpen(true);
                                                                                                                    }}
                                                                                                                    className={`flex items-center gap-1.5 px-4.5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider border transition-all cursor-pointer ${
                                                                                                                        statusLabel === 'Completed'
                                                                                                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                                                                                                            : (statusLabel === 'Unlocked' || statusLabel.startsWith('Unlocked'))
                                                                                                                            ? 'bg-amber-500/10 text-amber-600 dark:text-[#ecb613] border-amber-500/20 hover:bg-[#ecb613]/20 text-[#ecb613]'
                                                                                                                            : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-750 border-transparent'
                                                                                                                    }`}
                                                                                                                >
                                                                                                                    {statusLabel === 'Locked' ? (
                                                                                                                        <Lock className="size-3" />
                                                                                                                    ) : (statusLabel === 'Unlocked' || statusLabel.startsWith('Unlocked')) ? (
                                                                                                                        <Unlock className="size-3" />
                                                                                                                    ) : (
                                                                                                                        <CheckCircle className="size-3" />
                                                                                                                    )}
                                                                                                                    <span>{statusLabel}</span>
                                                                                                                </button>
                                                                                                                <button
                                                                                                                    type="button"
                                                                                                                    disabled={isUpdating}
                                                                                                                    onClick={() => {
                                                                                                                        setAllocationTargetLesson(lesson);
                                                                                                                        setAllocationTargetType(curriculumTab === 'individual' ? 'individual' : 'classwide');
                                                                                                                        let initialStatus: 'locked' | 'unlocked' | 'completed' = 'unlocked';
                                                                                                                        if (statusLabel === 'Completed') {
                                                                                                                            initialStatus = 'completed';
                                                                                                                        } else if (statusLabel === 'Unlocked' || statusLabel.startsWith('Unlocked')) {
                                                                                                                            initialStatus = 'unlocked';
                                                                                                                        } else if (statusLabel === 'Locked') {
                                                                                                                            initialStatus = 'locked';
                                                                                                                        }
                                                                                                                        setAllocationStatus(initialStatus);
                                                                                                                        const currentSelected = studentProgress
                                                                                                                            .filter(p => p.lesson_id === lesson.id && p.status !== 'locked' && p.student_id !== 'classwide_default')
                                                                                                                            .map(p => p.student_id);
                                                                                                                        setAllocationSelectedStudents((curriculumTab === 'individual' && selectedStudentForCurriculum) ? [selectedStudentForCurriculum.student_id] : (currentSelected.length > 0 ? currentSelected : []));
                                                                                                                        setIsAllocationDrawerOpen(true);
                                                                                                                    }}
                                                                                                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 dark:text-slate-455 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer"
                                                                                                                >
                                                                                                                    <MoreVertical className="size-3.5" />
                                                                                                                </button>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    })()}
                                                                                </div>
                                                                            )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                                </div>

                                {/* Right Column Sticky Live Portal Simulation Card */}
                                {curriculumTab === 'individual' && selectedStudentForCurriculum && (
                                    <div className="col-span-12 lg:col-span-4 lg:sticky lg:top-20 space-y-6">
                                        {livePreviewData ? (
                                            <div className="bg-stone-50 border border-stone-200/80 rounded-[32px] p-6 text-stone-850 shadow-2xl ring-8 ring-stone-100/50 flex flex-col gap-6 relative overflow-hidden text-left animate-in fade-in duration-300">
                                                {/* Decorative subtle gradient background mesh */}
                                                <div className="absolute -right-24 -top-24 w-48 h-48 bg-gradient-to-tr from-[#ecb613]/10 via-emerald-500/5 to-rose-500/5 rounded-full blur-2xl pointer-events-none"></div>

                                                {/* Title / Status */}
                                                <div className="flex items-center justify-between border-b border-stone-200/80 pb-4 relative z-10">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
                                                        <span className="text-[10px] font-black tracking-widest uppercase text-stone-550 font-mono">STUDENT VIEW PREVIEW (LIVE)</span>
                                                    </div>
                                                    <span className="bg-[#ecb613]/15 text-amber-800 border border-[#ecb613]/20 text-[8px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider font-mono">
                                                        Mobile Portal
                                                    </span>
                                                </div>

                                                {/* Student Profile Info */}
                                                <div className="flex items-center gap-4 relative z-10">
                                                    <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center overflow-hidden ring-2 ring-stone-200 shadow-sm shrink-0">
                                                        {selectedStudentForCurriculum.profile_pic_url ? (
                                                            <img src={selectedStudentForCurriculum.profile_pic_url} alt={selectedStudentForCurriculum.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-[#ecb613] text-xl font-bold">{selectedStudentForCurriculum.name.charAt(0)}</span>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className="font-extrabold text-sm text-stone-900 leading-snug truncate">{selectedStudentForCurriculum.name}</h4>
                                                        <p className="text-[10px] text-stone-500 font-semibold leading-none mt-1 truncate">Syllabus Completion</p>
                                                    </div>
                                                </div>

                                                {/* Overall Syllabus Progress Bar */}
                                                <div className="space-y-2 relative z-10">
                                                    <div className="flex items-center justify-between text-xs font-bold">
                                                        <span className="text-stone-500 font-mono">{livePreviewData.progressPercentage}% Completed</span>
                                                        <span className="text-amber-705 font-mono">{syllabusLessons.filter(l => selectedStudentPermissions.completedLessons.has(l.id)).length} / {syllabusLessons.length} units</span>
                                                    </div>
                                                    <div className="w-full h-2.5 bg-stone-200 rounded-full overflow-hidden shadow-inner">
                                                        <div 
                                                            className="h-full bg-gradient-to-r from-emerald-500 to-[#ecb613] transition-all duration-500 rounded-full"
                                                            style={{ width: `${livePreviewData.progressPercentage}%` }}
                                                        ></div>
                                                    </div>
                                                </div>

                                                {/* Currently Learning Section (Green/White Accent) */}
                                                <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-5 space-y-4 relative z-10 shadow-sm transition-all hover:bg-emerald-50/80">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[9px] font-black uppercase text-emerald-800 tracking-wider font-mono">Currently Learning</span>
                                                        <span className="bg-emerald-100 text-emerald-805 border border-emerald-200 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                                                            Unlocked
                                                        </span>
                                                    </div>
                                                    {livePreviewData.currentlyLearning ? (
                                                        <div className="space-y-3">
                                                            <h5 className="font-extrabold text-sm text-emerald-950 leading-snug">{livePreviewData.currentlyLearning.title}</h5>
                                                            {livePreviewData.currentlyLearning.description && (
                                                                <p className="text-[11px] text-emerald-900/80 font-medium leading-relaxed line-clamp-3">{livePreviewData.currentlyLearning.description}</p>
                                                            )}
                                                            
                                                            {/* Media content indicator */}
                                                            <div className="flex items-center gap-2 pt-2.5 border-t border-emerald-100">
                                                                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-xs">
                                                                    {livePreviewData.currentlyLearning.material_type === 'video' ? (
                                                                        <Film className="size-3.5" />
                                                                    ) : livePreviewData.currentlyLearning.material_type === 'audio' ? (
                                                                        <Music className="size-3.5" />
                                                                    ) : (
                                                                        <FileText className="size-3.5" />
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <span className="text-[9px] font-black uppercase text-emerald-700/85 tracking-wider font-mono leading-none block font-semibold">STUDY MATERIAL</span>
                                                                    <span className="text-[10px] text-emerald-900 font-extrabold capitalize mt-0.5 leading-none block">
                                                                        {livePreviewData.currentlyLearning.material_type || 'Reading Guide'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-emerald-700 italic text-center py-2">No active learning topic.</p>
                                                    )}
                                                </div>

                                                {/* Allocated Curriculum Pathway */}
                                                <div className="space-y-3 relative z-10">
                                                    <span className="text-[9px] font-black uppercase text-stone-500 tracking-wider font-mono block">YOUR LEARNING PATHWAY</span>
                                                    {!livePreviewData.allocatedTopics || livePreviewData.allocatedTopics.length === 0 ? (
                                                        <div className="p-4 bg-stone-100 border border-stone-200/60 rounded-2xl text-center text-xs text-stone-400 font-medium italic">
                                                            No topics allocated yet.
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                                                            {livePreviewData.allocatedTopics.map((lesson, idx) => {
                                                                const isCompleted = selectedStudentPermissions.completedLessons.has(lesson.id);
                                                                return (
                                                                    <div key={lesson.id} className={`flex items-center gap-3 p-3 border rounded-xl shadow-xs transition-all ${
                                                                        isCompleted 
                                                                            ? "bg-emerald-50/30 border-emerald-100 hover:bg-emerald-50/50" 
                                                                            : "bg-white border-stone-200 hover:border-amber-400"
                                                                    }`}>
                                                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                                                            isCompleted 
                                                                                ? "bg-emerald-100 text-emerald-700" 
                                                                                : "bg-amber-100 text-amber-700"
                                                                        }`}>
                                                                            {isCompleted ? (
                                                                                <Check className="size-4" />
                                                                            ) : lesson.material_type === 'video' ? (
                                                                                <Film className="size-3.5" />
                                                                            ) : lesson.material_type === 'audio' ? (
                                                                                <Music className="size-3.5" />
                                                                            ) : (
                                                                                <FileText className="size-3.5" />
                                                                            )}
                                                                        </div>
                                                                        <div className="min-w-0 flex-1 text-left">
                                                                            <span className={`text-[8px] font-black tracking-wider font-mono block ${
                                                                                isCompleted ? "text-emerald-700" : "text-amber-700"
                                                                            }`}>
                                                                                {isCompleted ? "COMPLETED • DONE" : `UNLOCKED • TOPIC ${idx + 1}`}
                                                                            </span>
                                                                            <h6 className="text-[11px] font-bold text-stone-900 leading-tight truncate mt-0.5">{lesson.title}</h6>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-white border border-stone-200 rounded-[32px] p-8 text-center text-stone-400 text-xs shadow-sm flex flex-col items-center justify-center min-h-[250px] border-dashed">
                                                <UserPlus className="size-8 text-stone-300 mb-3 animate-pulse" />
                                                <span>Select a student to initialize live student view simulation.</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
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
                                    <button
                                        onClick={openMakeupModal}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-all shadow-md shadow-emerald-600/20"
                                    >
                                        <Calendar className="w-5 h-5" />
                                        Schedule Makeup
                                    </button>
                                    <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm">
                                        <Mail className="w-5 h-5" />
                                        Message All
                                    </button>
                                    <button
                                        onClick={openDirectoryModal}
                                        className="flex items-center gap-2 px-4 py-2 bg-[#ecb613] text-slate-900 rounded-lg font-semibold hover:bg-[#ecb613]/90 transition-all shadow-md shadow-[#ecb613]/20"
                                    >
                                        <UserPlus className="w-5 h-5" />
                                        Add from Directory
                                    </button>
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
                                            {paginatedStudents.map(student => (
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
                                                        {(() => {
                                                            const realProgress = getRealStudentProgress(student.student_id, student.mock_progress);
                                                            return (
                                                                <div className="w-32">
                                                                    <div className="flex justify-between mb-1">
                                                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{realProgress}% Complete</span>
                                                                    </div>
                                                                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 flex overflow-hidden">
                                                                        <div className={`h-1.5 rounded-full ${student.mock_status === 'At Risk' ? 'bg-rose-500' : 'bg-[#ecb613]'}`} style={{ width: `${realProgress}%` }}></div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm font-medium text-slate-700 dark:text-slate-300">{student.mock_attendance}%</td>
                                                    <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{getGrade(student.mock_score)}</td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => handleRemoveStudent(student)}
                                                            disabled={removingStudentId === student.id}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg transition-all disabled:opacity-50"
                                                            title="Remove from this classroom"
                                                        >
                                                            {removingStudentId === student.id
                                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                : <Trash2 className="w-3.5 h-3.5" />}
                                                            Remove
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {paginatedStudents.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-12 text-center bg-slate-50 dark:bg-slate-800/30">
                                                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-3">No students enrolled yet.</p>
                                                        <button
                                                            onClick={openDirectoryModal}
                                                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#ecb613] text-slate-900 rounded-xl text-xs font-bold hover:bg-[#ecb613]/90 transition-colors shadow-sm"
                                                        >
                                                            <UserPlus className="w-4 h-4" /> Add from Directory
                                                        </button>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center rounded-b-xl">
                                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                        Showing {paginatedStudents.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0} - {Math.min(currentPage * PAGE_SIZE, students.length)} of {students.length} students
                                    </p>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                            className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                                        >
                                            Previous
                                        </button>
                                        <button 
                                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                            disabled={currentPage === totalPages || totalPages === 0}
                                            className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Temporary Session overrides (Makeup Classes) Section */}
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mt-6">
                                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                    <div>
                                        <h4 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            <Calendar className="w-5 h-5 text-emerald-600" />
                                            Temporary Session Allocations / Makeups
                                        </h4>
                                        <p className="text-xs text-slate-500 mt-1">Students assigned to this classroom for a single class date (e.g. makeup sessions).</p>
                                    </div>
                                    <button
                                        onClick={openMakeupModal}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:hover:bg-emerald-950/40 font-bold text-xs transition-colors"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Add Makeup
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Student</th>
                                                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Class Date</th>
                                                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Reason / Notes</th>
                                                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                            {sessionOverrides.map(override => (
                                                <tr key={override.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border border-slate-200 dark:border-slate-600 flex items-center justify-center">
                                                                {override.users?.profile_pic_url ? (
                                                                    <img alt={override.users?.name} className="w-full h-full object-cover" src={override.users?.profile_pic_url} loading="lazy" />
                                                                ) : (
                                                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{override.users?.name?.charAt(0) || 'U'}</span>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <span className="text-sm font-bold text-slate-900 dark:text-white">{override.users?.name || 'Unknown'}</span>
                                                                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">{override.users?.level || 'Beginner'}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                                            {formatLocalDate(override.override_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-400 italic">
                                                        {override.reason || 'No details provided'}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex justify-end items-center gap-2">
                                                            <button
                                                                onClick={() => openRescheduleModal(override)}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 rounded-lg transition-all"
                                                                title="Reschedule makeup allocation"
                                                            >
                                                                <Calendar className="w-3.5 h-3.5" />
                                                                Reschedule
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteOverride(override.id)}
                                                                disabled={isDeletingOverrideId === override.id}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg transition-all disabled:opacity-50"
                                                                title="Cancel temporary allocation"
                                                            >
                                                                {isDeletingOverrideId === override.id
                                                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    : <Trash2 className="w-3.5 h-3.5" />}
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {sessionOverrides.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-12 text-center bg-slate-50 dark:bg-slate-800/30">
                                                        <p className="text-slate-500 dark:text-slate-400 text-xs italic">No temporary overrides or makeup bookings scheduled for this class.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
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
                    ) : activeTab === 'Assignments' ? (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

                            {/* ── Create Assignment Modal ───────────────────────────────────── */}
                            {showAssignmentModal && (
                                <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300">
                                        {/* Header */}
                                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-[#ecb613]/10 flex items-center justify-center">
                                                    <ClipboardList className="w-5 h-5 text-[#ecb613]" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-900 dark:text-white">Create Assignment</h3>
                                                    <p className="text-xs text-slate-500">for <span className="font-semibold">{classroom?.name}</span></p>
                                                </div>
                                            </div>
                                            <button onClick={closeAssignmentModal} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>

                                        {/* Body */}
                                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                                            {/* Title */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Title <span className="text-rose-500">*</span></label>
                                                <input
                                                    id="assignment-title-input"
                                                    type="text"
                                                    placeholder="e.g., Practice Raag Yaman — Sa Re Ga Ma"
                                                    value={assignmentForm.title}
                                                    onChange={e => setAssignmentForm(f => ({ ...f, title: e.target.value }))}
                                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#ecb613]/30 focus:border-[#ecb613] outline-none transition-all"
                                                />
                                            </div>

                                            {/* Description */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Description</label>
                                                <textarea
                                                    id="assignment-description-input"
                                                    rows={3}
                                                    placeholder="Describe what the student needs to do..."
                                                    value={assignmentForm.description}
                                                    onChange={e => setAssignmentForm(f => ({ ...f, description: e.target.value }))}
                                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#ecb613]/30 focus:border-[#ecb613] outline-none transition-all resize-none"
                                                />
                                            </div>

                                            {/* Due Date */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Due Date</label>
                                                <input
                                                    id="assignment-due-date"
                                                    type="date"
                                                    value={assignmentForm.due_date}
                                                    onChange={e => setAssignmentForm(f => ({ ...f, due_date: e.target.value }))}
                                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#ecb613]/30 focus:border-[#ecb613] outline-none transition-all"
                                                />
                                            </div>

                                            {/* Target Toggle */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Assign To</label>
                                                <div className="flex gap-2">
                                                    <button
                                                        id="target-all-btn"
                                                        onClick={() => setAssignmentForm(f => ({ ...f, target_type: 'all', selectedStudentIds: new Set() }))}
                                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-all flex-1 justify-center ${
                                                            assignmentForm.target_type === 'all'
                                                                ? 'border-[#ecb613] bg-[#ecb613]/10 text-[#ecb613]'
                                                                : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
                                                        }`}
                                                    >
                                                        <UsersRound className="w-4 h-4" />
                                                        All Students
                                                    </button>
                                                    <button
                                                        id="target-individual-btn"
                                                        onClick={() => setAssignmentForm(f => ({ ...f, target_type: 'individual' }))}
                                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-all flex-1 justify-center ${
                                                            assignmentForm.target_type === 'individual'
                                                                ? 'border-[#ecb613] bg-[#ecb613]/10 text-[#ecb613]'
                                                                : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
                                                        }`}
                                                    >
                                                        <User className="w-4 h-4" />
                                                        Individual
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Individual student picker */}
                                            {assignmentForm.target_type === 'individual' && (
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Select Students <span className="text-rose-500">*</span></label>
                                                    {students.length === 0 ? (
                                                        <p className="text-sm text-slate-500 italic text-center py-4">No students enrolled in this classroom.</p>
                                                    ) : (
                                                        <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-slate-700 rounded-xl p-2">
                                                            {students.map(s => {
                                                                const isSel = assignmentForm.selectedStudentIds.has(s.student_id);
                                                                return (
                                                                    <button
                                                                        key={s.student_id}
                                                                        onClick={() => setAssignmentForm(f => {
                                                                            const next = new Set(f.selectedStudentIds);
                                                                            isSel ? next.delete(s.student_id) : next.add(s.student_id);
                                                                            return { ...f, selectedStudentIds: next };
                                                                        })}
                                                                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left ${
                                                                            isSel
                                                                                ? 'bg-[#ecb613]/10 border-2 border-[#ecb613]'
                                                                                : 'bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent hover:border-slate-200'
                                                                        }`}
                                                                    >
                                                                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                                            {s.profile_pic_url
                                                                                ? <img src={s.profile_pic_url} alt={s.name} className="w-full h-full object-cover" />
                                                                                : <span className="text-xs font-bold text-slate-500">{s.name.charAt(0)}</span>
                                                                            }
                                                                        </div>
                                                                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex-1">{s.name}</span>
                                                                        <div className={`w-4 h-4 rounded flex items-center justify-center border-2 flex-shrink-0 ${
                                                                            isSel ? 'bg-[#ecb613] border-[#ecb613]' : 'border-slate-300 dark:border-slate-600'
                                                                        }`}>
                                                                            {isSel && <svg className="w-2.5 h-2.5 text-slate-900" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                                                        </div>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                    {assignmentForm.selectedStudentIds.size > 0 && (
                                                        <p className="text-xs font-semibold text-[#ecb613] mt-1.5">{assignmentForm.selectedStudentIds.size} student{assignmentForm.selectedStudentIds.size !== 1 ? 's' : ''} selected</p>
                                                    )}
                                                </div>
                                            )}

                                            {/* File Attachment */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Attach File <span className="text-slate-400 font-normal normal-case">(optional)</span></label>
                                                <input ref={assignmentFileRef} type="file" accept=".pdf,.doc,.docx,.mp3,.mp4,.wav,.jpg,.jpeg,.png" className="hidden" onChange={e => {
                                                    setAssignmentFile(e.target.files?.[0] || null);
                                                    if (e.target.files?.[0]) {
                                                        setAssignmentForm(f => ({ ...f, file_url: null, file_name: null, file_size: null }));
                                                    }
                                                }} />
                                                {assignmentFile || assignmentForm.file_url ? (
                                                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                                                        <Paperclip className="w-4 h-4 text-[#ecb613] flex-shrink-0" />
                                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex-1 truncate">
                                                            {assignmentFile ? assignmentFile.name : assignmentForm.file_name}
                                                        </span>
                                                        <span className="text-xs text-slate-400">
                                                            {formatFileSize(assignmentFile ? assignmentFile.size : assignmentForm.file_size)}
                                                        </span>
                                                        <button onClick={() => {
                                                            setAssignmentFile(null);
                                                            setAssignmentForm(f => ({ ...f, file_url: null, file_name: null, file_size: null }));
                                                        }} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><X className="w-3.5 h-3.5 text-slate-400" /></button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => assignmentFileRef.current?.click()}
                                                        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-500 hover:border-[#ecb613]/50 hover:text-[#ecb613] hover:bg-[#ecb613]/5 transition-all"
                                                    >
                                                        <Upload className="w-4 h-4" />
                                                        Click to attach a file
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Footer */}
                                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3 flex-shrink-0">
                                            {assignmentError && (
                                                <div className="flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl">
                                                    <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                                                    <p className="text-xs font-medium text-rose-700 dark:text-rose-400 break-all">{assignmentError}</p>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-end gap-3">
                                                <button
                                                    onClick={closeAssignmentModal}
                                                    className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                >Cancel</button>
                                                <button
                                                    id="create-assignment-submit-btn"
                                                    onClick={handleCreateAssignment}
                                                    disabled={isSavingAssignment || !assignmentForm.title.trim() || (assignmentForm.target_type === 'individual' && assignmentForm.selectedStudentIds.size === 0)}
                                                    className="px-5 py-2 rounded-lg text-sm font-bold bg-[#ecb613] text-slate-900 hover:bg-[#ecb613]/90 shadow-md shadow-[#ecb613]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                >
                                                    {isSavingAssignment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                                    {isSavingAssignment ? 'Creating...' : 'Create Assignment'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── Note Editor Modal ─────────────────────────────────────── */}
                            {showNoteEditor && (
                                <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-xl flex flex-col animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300">
                                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-[#ecb613]/10 flex items-center justify-center">
                                                    <StickyNote className="w-5 h-5 text-[#ecb613]" />
                                                </div>
                                                <h3 className="font-bold text-slate-900 dark:text-white">{editingNote ? 'Edit Note' : 'New Class Note'}</h3>
                                            </div>
                                            <button onClick={() => { setShowNoteEditor(false); setEditingNote(null); }} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div className="px-6 py-5 space-y-4">
                                            {/* Color picker */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Note Color</label>
                                                <div className="flex gap-2">
                                                    {Object.entries(NOTE_COLORS).map(([color, palette]) => (
                                                        <button
                                                            key={color}
                                                            onClick={() => setNoteForm(f => ({ ...f, color }))}
                                                            className={`w-8 h-8 rounded-full border-2 transition-all ${palette.dot} ${
                                                                noteForm.color === color ? 'border-slate-700 dark:border-white scale-110' : 'border-transparent'
                                                            }`}
                                                            title={color}
                                                        />
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Title */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Title <span className="text-rose-500">*</span></label>
                                                <input
                                                    id="note-title-input"
                                                    type="text"
                                                    placeholder="e.g., Week 3 Class Notes — Raga Bhairav"
                                                    value={noteForm.title}
                                                    onChange={e => setNoteForm(f => ({ ...f, title: e.target.value }))}
                                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#ecb613]/30 focus:border-[#ecb613] outline-none transition-all"
                                                />
                                            </div>

                                            {/* Content */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Content</label>
                                                <textarea
                                                    id="note-content-input"
                                                    rows={5}
                                                    placeholder="Write your class notes here..."
                                                    value={noteForm.content}
                                                    onChange={e => setNoteForm(f => ({ ...f, content: e.target.value }))}
                                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#ecb613]/30 focus:border-[#ecb613] outline-none transition-all resize-none"
                                                />
                                            </div>

                                            {/* File attachment */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Upload File <span className="text-slate-400 font-normal normal-case">(PDF, audio, image)</span></label>
                                                <input ref={noteFileRef} type="file" accept=".pdf,.doc,.docx,.mp3,.mp4,.wav,.jpg,.jpeg,.png" className="hidden" onChange={e => setNoteFile(e.target.files?.[0] || null)} />
                                                {noteFile || editingNote?.file_url ? (
                                                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                                                        <Paperclip className="w-4 h-4 text-[#ecb613] flex-shrink-0" />
                                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex-1 truncate">{noteFile?.name || editingNote?.file_name}</span>
                                                        <span className="text-xs text-slate-400">{formatFileSize(noteFile?.size || editingNote?.file_size || null)}</span>
                                                        <button onClick={() => { setNoteFile(null); if (editingNote) setEditingNote(prev => prev ? { ...prev, file_url: null, file_name: null } : null); }} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"><X className="w-3.5 h-3.5 text-slate-400" /></button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => noteFileRef.current?.click()}
                                                        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-500 hover:border-[#ecb613]/50 hover:text-[#ecb613] hover:bg-[#ecb613]/5 transition-all"
                                                    >
                                                        <Upload className="w-4 h-4" /> Attach a file
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3">
                                            {noteError && (
                                                <div className="flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl">
                                                    <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                                                    <p className="text-xs font-medium text-rose-700 dark:text-rose-400 break-all">{noteError}</p>
                                                </div>
                                            )}
                                            <div className="flex justify-end gap-3">
                                                <button onClick={() => { setShowNoteEditor(false); setEditingNote(null); setNoteError(''); }} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancel</button>
                                                <button
                                                    id="save-note-btn"
                                                    onClick={handleSaveNote}
                                                    disabled={isSavingNote || !noteForm.title.trim()}
                                                    className="px-5 py-2 rounded-lg text-sm font-bold bg-[#ecb613] text-slate-900 hover:bg-[#ecb613]/90 shadow-md shadow-[#ecb613]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                >
                                                    {isSavingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                                                    {isSavingNote ? 'Saving...' : (editingNote ? 'Update Note' : 'Save Note')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── DB Setup Error Banner ──────────────────────────────────── */}
                            {dbSetupError && (
                                <div className="mb-6 rounded-2xl border-2 border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/10 overflow-hidden">
                                    <div className="flex items-start gap-3 px-5 py-4">
                                        <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-rose-800 dark:text-rose-300 text-sm">Database setup required</h4>
                                            <p className="text-xs text-rose-700 dark:text-rose-400 mt-1 leading-relaxed">
                                                The <code className="font-mono bg-rose-100 dark:bg-rose-900/40 px-1 rounded">assignments</code>, <code className="font-mono bg-rose-100 dark:bg-rose-900/40 px-1 rounded">classroom_inventory_allocation</code>, <code className="font-mono bg-rose-100 dark:bg-rose-900/40 px-1 rounded">class_notes</code>, and <code className="font-mono bg-rose-150 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 px-1 rounded font-semibold">student_topic_progress</code> tables don&apos;t exist yet in your <strong>auth Supabase project</strong> (<code className="font-mono">sevtycwrmhzyfxvxkkgc</code>).
                                            </p>
                                            <p className="text-xs text-rose-700 dark:text-rose-400 mt-2">
                                                Go to <strong>Supabase Dashboard → sevtycwrmhzyfxvxkkgc → SQL Editor → New Query</strong> and paste the SQL below, then click Run.
                                            </p>
                                        </div>
                                        <button onClick={() => setDbSetupError(false)} className="p-1 rounded text-rose-400 hover:text-rose-600 flex-shrink-0"><X className="w-4 h-4" /></button>
                                    </div>
                                    <div className="mx-5 mb-4 relative">
                                        <pre className="text-[10px] font-mono bg-rose-900/10 dark:bg-rose-955/30 text-rose-900 dark:text-rose-200 p-4 rounded-xl overflow-x-auto leading-relaxed border border-rose-200 dark:border-rose-800 max-h-40 overflow-y-auto">{`-- Run in: Supabase Dashboard > sevtycwrmhzyfxvxkkgc > SQL Editor
CREATE TABLE IF NOT EXISTS public.class_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  classroom_id UUID NOT NULL, teacher_id UUID NOT NULL,
  title TEXT NOT NULL, content TEXT, file_url TEXT,
  file_name TEXT, file_size INTEGER, color TEXT DEFAULT 'yellow',
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  classroom_id UUID NOT NULL, teacher_id UUID NOT NULL,
  title TEXT NOT NULL, description TEXT, due_date DATE,
  target_type TEXT NOT NULL DEFAULT 'all',
  file_url TEXT, file_name TEXT, file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.assignment_students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL, student_id UUID NOT NULL,
  status TEXT DEFAULT 'pending', UNIQUE (assignment_id, student_id)
);
CREATE TABLE IF NOT EXISTS public.classroom_inventory_allocation (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.course_modules(id) ON DELETE SET NULL,
  chapter_id UUID REFERENCES public.course_chapters(id) ON DELETE SET NULL,
  lesson_id UUID REFERENCES public.course_lessons(id) ON DELETE SET NULL,
  allocated_by UUID REFERENCES public.users(id),
  allocated_to_student_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.student_topic_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'locked',
  unlocked_by TEXT NOT NULL DEFAULT 'system',
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (student_id, lesson_id)
);
ALTER TABLE public.class_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_inventory_allocation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_topic_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all class_notes" ON public.class_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all assignments" ON public.assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all assignment_students" ON public.assignment_students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all classroom_inventory_allocation" ON public.classroom_inventory_allocation FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all student_topic_progress" ON public.student_topic_progress FOR ALL USING (true) WITH CHECK (true);`}</pre>
                                        <button
                                            onClick={() => {
                                                const sql = `CREATE TABLE IF NOT EXISTS public.class_notes (\n  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n  classroom_id UUID NOT NULL, teacher_id UUID NOT NULL,\n  title TEXT NOT NULL, content TEXT, file_url TEXT,\n  file_name TEXT, file_size INTEGER, color TEXT DEFAULT 'yellow',\n  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()\n);\nCREATE TABLE IF NOT EXISTS public.assignments (\n  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n  classroom_id UUID NOT NULL, teacher_id UUID NOT NULL,\n  title TEXT NOT NULL, description TEXT, due_date DATE,\n  target_type TEXT NOT NULL DEFAULT 'all',\n  file_url TEXT, file_name TEXT, file_size INTEGER,\n  created_at TIMESTAMPTZ DEFAULT now()\n);\nCREATE TABLE IF NOT EXISTS public.assignment_students (\n  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n  assignment_id UUID NOT NULL, student_id UUID NOT NULL,\n  status TEXT DEFAULT 'pending', UNIQUE (assignment_id, student_id)\n);\nCREATE TABLE IF NOT EXISTS public.classroom_inventory_allocation (\n  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,\n  module_id UUID REFERENCES public.course_modules(id) ON DELETE SET NULL,\n  chapter_id UUID REFERENCES public.course_chapters(id) ON DELETE SET NULL,\n  lesson_id UUID REFERENCES public.course_lessons(id) ON DELETE SET NULL,\n  allocated_by UUID REFERENCES public.users(id),\n  allocated_to_student_id UUID REFERENCES public.users(id),\n  created_at TIMESTAMPTZ DEFAULT now()\n);\nCREATE TABLE IF NOT EXISTS public.student_topic_progress (\n  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,\n  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,\n  lesson_id UUID NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,\n  status TEXT NOT NULL DEFAULT 'locked',\n  unlocked_by TEXT NOT NULL DEFAULT 'system',\n  unlocked_at TIMESTAMPTZ DEFAULT now(),\n  completed_at TIMESTAMPTZ,\n  UNIQUE (student_id, lesson_id)\n);\nALTER TABLE public.class_notes ENABLE ROW LEVEL SECURITY;\nALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;\nALTER TABLE public.assignment_students ENABLE ROW LEVEL SECURITY;\nALTER TABLE public.classroom_inventory_allocation ENABLE ROW LEVEL SECURITY;\nALTER TABLE public.student_topic_progress ENABLE ROW LEVEL SECURITY;\nCREATE POLICY "Allow all class_notes" ON public.class_notes FOR ALL USING (true) WITH CHECK (true);\nCREATE POLICY "Allow all assignments" ON public.assignments FOR ALL USING (true) WITH CHECK (true);\nCREATE POLICY "Allow all assignment_students" ON public.assignment_students FOR ALL USING (true) WITH CHECK (true);\nCREATE POLICY "Allow all classroom_inventory_allocation" ON public.classroom_inventory_allocation FOR ALL USING (true) WITH CHECK (true);\nCREATE POLICY "Allow all student_topic_progress" ON public.student_topic_progress FOR ALL USING (true) WITH CHECK (true);`;
                                                navigator.clipboard.writeText(sql).then(() => alert('SQL copied to clipboard!'));
                                            }}
                                            className="absolute top-2 right-2 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded-lg transition-colors"
                                        >
                                            Copy SQL
                                        </button>
                                    </div>
                                    <div className="px-5 pb-4">
                                        <button
                                            onClick={() => { window.location.reload(); }}
                                            className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors"
                                        >
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Reload Page after running SQL
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ── Main Two-Panel Layout ─────────────────────────────────── */}
                            <div className="flex flex-col xl:flex-row gap-6">

                                {/* ══ LEFT: Notes Board ══════════════════════════════════════ */}
                                <div className="xl:w-96 flex-shrink-0 space-y-4">
                                    {/* Board Header */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <NotebookPen className="w-5 h-5 text-[#ecb613]" />
                                            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Notes Board</h3>
                                            {classNotes.length > 0 && (
                                                <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{classNotes.length}</span>
                                            )}
                                        </div>
                                        <button
                                            id="new-note-btn"
                                            onClick={openNewNote}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ecb613] text-slate-900 font-bold text-xs hover:bg-[#ecb613]/90 shadow-sm shadow-[#ecb613]/20 transition-all"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            New Note
                                        </button>
                                    </div>

                                    {/* Notes List */}
                                    {notesLoading ? (
                                        <div className="flex items-center justify-center py-16">
                                            <Loader2 className="w-7 h-7 animate-spin text-[#ecb613]" />
                                        </div>
                                    ) : classNotes.length === 0 ? (
                                        <button
                                            onClick={openNewNote}
                                            className="w-full flex flex-col items-center justify-center gap-3 py-14 border-2 border-dashed border-amber-200 dark:border-amber-700/30 rounded-2xl bg-amber-50/50 dark:bg-amber-900/5 hover:bg-amber-50 dark:hover:bg-amber-900/10 hover:border-amber-300 dark:hover:border-amber-600/50 transition-all group cursor-pointer text-center"
                                        >
                                            <StickyNote className="w-10 h-10 text-amber-300 dark:text-amber-600 group-hover:scale-110 transition-transform" />
                                            <div>
                                                <p className="font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200">No notes yet</p>
                                                <p className="text-xs text-slate-400 mt-1">Click to write your first class note</p>
                                            </div>
                                        </button>
                                    ) : (
                                        <div className="space-y-3">
                                            {classNotes.map(note => {
                                                const palette = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
                                                return (
                                                    <div
                                                        key={note.id}
                                                        draggable="true"
                                                        onDragStart={(e) => handleDragStart(e, note)}
                                                        className={`rounded-2xl border overflow-hidden shadow-sm group transition-shadow hover:shadow-md cursor-grab active:cursor-grabbing ${palette.bg} ${palette.border}`}
                                                    >
                                                        {/* Note header bar */}
                                                        <div className={`flex items-center justify-between px-4 py-2.5 ${palette.header}`}>
                                                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                                <GripVertical className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 cursor-grab active:cursor-grabbing opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                                                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate flex-1">{note.title}</h4>
                                                             </div>
                                                             <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                                <button
                                                                    onClick={() => openEditNote(note)}
                                                                    className="p-1.5 rounded-lg bg-white/70 dark:bg-slate-700/70 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                                                                    title="Edit note"
                                                                >
                                                                    <Edit3 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteNote(note.id)}
                                                                    disabled={deletingNoteId === note.id}
                                                                    className="p-1.5 rounded-lg bg-white/70 dark:bg-slate-700/70 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors"
                                                                    title="Delete note"
                                                                >
                                                                    {deletingNoteId === note.id
                                                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                                                                        : <Trash2 className="w-3.5 h-3.5 text-rose-500" />}
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Note body */}
                                                        <div className="px-4 py-3">
                                                            {note.content && (
                                                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap line-clamp-4">{note.content}</p>
                                                            )}
                                                            {/* File chip */}
                                                            {note.file_url && (
                                                                <a
                                                                    href={note.file_url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-[#ecb613]/50 hover:text-[#ecb613] transition-all max-w-full"
                                                                >
                                                                    <Download className="w-3 h-3 flex-shrink-0" />
                                                                    <span className="truncate">{note.file_name || 'Attachment'}</span>
                                                                    {note.file_size && <span className="text-slate-400 flex-shrink-0">· {formatFileSize(note.file_size)}</span>}
                                                                </a>
                                                            )}
                                                            {/* Timestamp */}
                                                            <p className="mt-2.5 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                                                                {new Date(note.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* ══ RIGHT: Assignments Panel ════════════════════════════════ */}
                                <div 
                                    className="flex-1 min-w-0 space-y-4 relative"
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = 'copy';
                                    }}
                                    onDragEnter={(e) => {
                                        e.preventDefault();
                                        if (e.dataTransfer.types.includes('application/json')) {
                                            setIsDraggingOverAssignments(true);
                                        }
                                    }}
                                >
                                    {isDraggingOverAssignments && (
                                        <div 
                                            className="absolute inset-0 z-50 bg-amber-500/10 dark:bg-amber-500/5 border-3 border-dashed border-[#ecb613] rounded-2xl flex flex-col items-center justify-center gap-3 backdrop-blur-[2px] transition-all animate-in fade-in zoom-in-95 duration-200"
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                            }}
                                            onDragLeave={(e) => {
                                                e.preventDefault();
                                                setIsDraggingOverAssignments(false);
                                            }}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                setIsDraggingOverAssignments(false);
                                                handleDropNote(e);
                                            }}
                                        >
                                            <div className="w-14 h-14 rounded-full bg-[#ecb613]/20 flex items-center justify-center text-[#ecb613] animate-bounce shadow-md">
                                                <ClipboardList className="w-7 h-7" />
                                            </div>
                                            <p className="font-extrabold text-[#ecb613] text-sm dark:text-[#ecb613] tracking-wide">Drop Note to Create Assignment</p>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center px-6">
                                                Release to configure options and assign to everyone or individuals.
                                            </p>
                                        </div>
                                    )}
                                    {/* Panel Header */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <ClipboardList className="w-5 h-5 text-[#ecb613]" />
                                            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Assignments</h3>
                                            {assignments.length > 0 && (
                                                <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{assignments.length}</span>
                                            )}
                                        </div>
                                        <button
                                            id="new-assignment-btn"
                                            onClick={() => setShowAssignmentModal(true)}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ecb613] text-slate-900 font-bold text-sm hover:bg-[#ecb613]/90 shadow-md shadow-[#ecb613]/20 transition-all self-start"
                                        >
                                            <Plus className="w-4 h-4" />
                                            New Assignment
                                        </button>
                                    </div>

                                    {/* Filter Tabs */}
                                    <div className="flex items-center gap-2">
                                        {([['all', 'All', Filter], ['all_students', '👥 For Everyone', UsersRound], ['individual', '👤 Individual', User]] as const).map(([value, label, Icon]) => (
                                            <button
                                                key={value}
                                                onClick={() => setAssignmentFilter(value)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                                    assignmentFilter === value
                                                        ? 'bg-[#ecb613]/10 text-[#ecb613] border-[#ecb613]/40'
                                                        : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Assignment Cards */}
                                    {assignmentsLoading ? (
                                        <div className="flex items-center justify-center py-20">
                                            <Loader2 className="w-8 h-8 animate-spin text-[#ecb613]" />
                                        </div>
                                    ) : filteredAssignments.length === 0 ? (
                                        <button
                                            onClick={() => setShowAssignmentModal(true)}
                                            className="w-full flex flex-col items-center justify-center gap-3 py-16 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-300 transition-all group cursor-pointer text-center"
                                        >
                                            <ClipboardList className="w-10 h-10 text-slate-300 dark:text-slate-600 group-hover:scale-110 transition-transform" />
                                            <div>
                                                <p className="font-bold text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200">
                                                    {assignmentFilter !== 'all' ? 'No assignments match this filter.' : 'No assignments yet'}
                                                </p>
                                                {assignmentFilter === 'all' && <p className="text-xs text-slate-400 mt-1">Click to create your first assignment</p>}
                                            </div>
                                        </button>
                                    ) : (
                                        <div className="space-y-3">
                                            {filteredAssignments.map(asg => {
                                                const isExpanded = expandedAssignmentId === asg.id;
                                                const isDeleting = deletingAssignmentId === asg.id;
                                                const isDue = asg.due_date && new Date(asg.due_date) < new Date();
                                                return (
                                                    <div
                                                        key={asg.id}
                                                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-shadow hover:shadow-md"
                                                    >
                                                        {/* Card Header */}
                                                        <div 
                                                            onClick={() => setExpandedAssignmentId(isExpanded ? null : asg.id)}
                                                            className="px-5 py-4 flex items-start gap-3 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors"
                                                        >
                                                            {/* Icon */}
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                                                asg.target_type === 'all'
                                                                    ? 'bg-indigo-50 dark:bg-indigo-900/20'
                                                                    : 'bg-amber-50 dark:bg-amber-900/20'
                                                            }`}>
                                                                {asg.target_type === 'all'
                                                                    ? <UsersRound className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                                                    : <User className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
                                                            </div>

                                                            {/* Content */}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{asg.title}</h4>
                                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                        asg.target_type === 'all'
                                                                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                                                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                                    }`}>
                                                                        {asg.target_type === 'all' ? '👥 All Students' : `👤 Individual (${asg.assignment_students?.length ?? 0})`}
                                                                    </span>
                                                                    {asg.due_date && (
                                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                            isDue
                                                                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                                                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                                        }`}>
                                                                            <Calendar className="w-2.5 h-2.5" />
                                                                            {isDue ? 'Overdue · ' : 'Due · '}{new Date(asg.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {asg.description && (
                                                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">{asg.description}</p>
                                                                )}
                                                                {asg.inventory_ref_id ? (
                                                                    <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-450 select-none">
                                                                        <BookOpen className="w-3 h-3 text-[#ecb613]" />
                                                                        Topic: <span className="text-[#ecb613]">{asg.inventory_ref_title}</span>
                                                                    </div>
                                                                ) : asg.file_url ? (
                                                                    <a
                                                                        href={asg.file_url}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#ecb613] hover:underline"
                                                                    >
                                                                        <Paperclip className="w-3 h-3" />{asg.file_name}
                                                                    </a>
                                                                ) : null}
                                                                <p className="text-[10px] text-slate-400 mt-1.5">
                                                                    Created {new Date(asg.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                </p>
                                                            </div>

                                                            {/* Actions */}
                                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                                {asg.assignment_students && asg.assignment_students.length > 0 && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setExpandedAssignmentId(isExpanded ? null : asg.id);
                                                                        }}
                                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                                        title={isExpanded ? 'Collapse' : 'Show students'}
                                                                    >
                                                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteAssignment(asg.id);
                                                                    }}
                                                                    disabled={isDeleting}
                                                                    className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                                                    title="Delete assignment"
                                                                >
                                                                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Expanded: student list */}
                                                        {isExpanded && asg.assignment_students && asg.assignment_students.length > 0 && (
                                                            <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 px-5 py-4">
                                                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Assigned Students</p>
                                                                <div className="space-y-2">
                                                                    {asg.assignment_students.map(as => {
                                                                        const mappedStatusColors: Record<string, string> = {
                                                                            pending: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
                                                                            submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                                                                            reviewed: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', // Reassigned/reviewed
                                                                            approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', // Approved
                                                                            draft: 'bg-slate-100 text-slate-500 dark:bg-slate-850 dark:text-slate-450 border border-dashed border-slate-300'
                                                                        };

                                                                        return (
                                                                            <div key={as.id} className="flex items-center gap-3 p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 animate-in fade-in duration-200">
                                                                                <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                                                    {as.student_pic
                                                                                        ? <img src={as.student_pic} alt={as.student_name} className="w-full h-full object-cover" />
                                                                                        : <span className="text-xs font-bold text-slate-500">{(as.student_name || 'U').charAt(0)}</span>
                                                                                    }
                                                                                </div>
                                                                                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex-1">{as.student_name || 'Unknown'}</span>
                                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${mappedStatusColors[as.status] || mappedStatusColors.pending}`}>
                                                                                    {as.status === 'reviewed' ? 'Re-assigned' : as.status}
                                                                                </span>
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleOpenReviewModal(as, asg);
                                                                                    }}
                                                                                    className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-900 bg-[#ecb613] hover:bg-[#ecb613]/90 rounded-lg transition-all shadow-sm shadow-[#ecb613]/10"
                                                                                >
                                                                                    Review
                                                                                </button>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'Attendance' ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Attendance Header Controls */}
                            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                        <Calendar className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Class Attendance</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Mark or update student attendance for your class.</p>
                                    </div>
                                </div>
                                
                                {/* Date Navigation */}
                                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-100 dark:border-slate-700">
                                    <button 
                                        onClick={() => {
                                            const prev = new Date(attendanceDate);
                                            prev.setDate(prev.getDate() - 1);
                                            setAttendanceDate(prev.toISOString().split('T')[0]);
                                        }}
                                        className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <input 
                                        type="date" 
                                        value={attendanceDate}
                                        onChange={(e) => setAttendanceDate(e.target.value)}
                                        className="bg-transparent border-none text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none px-2 text-center"
                                    />
                                    <button 
                                        onClick={() => {
                                            const next = new Date(attendanceDate);
                                            next.setDate(next.getDate() + 1);
                                            setAttendanceDate(next.toISOString().split('T')[0]);
                                        }}
                                        className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => setAttendanceDate(new Date().toISOString().split('T')[0])}
                                        className="px-3 py-1.5 bg-white dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-all border border-slate-200 dark:border-slate-600 shadow-sm"
                                    >
                                        Today
                                    </button>
                                </div>
                            </div>

                            {/* Summary Statistics */}
                            {(() => {
                                const activeRecords = Object.values(attendanceRecords);
                                const totalCount = activeAttendanceRoster.length;
                                const presentCount = activeRecords.filter(r => r === 'present').length;
                                const lateCount = activeRecords.filter(r => r === 'late').length;
                                const absentCount = activeRecords.filter(r => r === 'absent').length;
                                const excusedCount = activeRecords.filter(r => r === 'excused').length;
                                const presentRate = totalCount > 0 ? Math.round(((presentCount + lateCount) / totalCount) * 100) : 0;
                                
                                return (
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Enrolled Students</p>
                                                <h4 className="text-2xl font-black text-slate-950 dark:text-white mt-1">{totalCount}</h4>
                                            </div>
                                            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-xl">
                                                <Users className="w-5 h-5" />
                                            </div>
                                        </div>
                                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Present / Late</p>
                                                <h4 className="text-2xl font-black text-slate-950 dark:text-white mt-1">
                                                    <span className="text-emerald-600">{presentCount}</span>
                                                    <span className="text-slate-400 mx-1">/</span>
                                                    <span className="text-amber-500">{lateCount}</span>
                                                </h4>
                                            </div>
                                            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:emerald-400 rounded-xl">
                                                <CheckCircle className="w-5 h-5" />
                                            </div>
                                        </div>
                                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Absent / Excused</p>
                                                <h4 className="text-2xl font-black text-slate-950 dark:text-white mt-1">
                                                    <span className="text-rose-600">{absentCount}</span>
                                                    <span className="text-slate-400 mx-1">/</span>
                                                    <span className="text-slate-500">{excusedCount}</span>
                                                </h4>
                                            </div>
                                            <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:rose-400 rounded-xl">
                                                <X className="w-5 h-5" />
                                            </div>
                                        </div>
                                        <div className="bg-[#ecb613] p-5 rounded-2xl shadow-lg shadow-[#ecb613]/10 flex items-center justify-between text-slate-900">
                                            <div>
                                                <p className="text-xs font-bold opacity-80 uppercase tracking-widest">Presence Rate</p>
                                                <h4 className="text-3xl font-black mt-1">{presentRate}%</h4>
                                            </div>
                                            <div className="p-3 bg-white/20 rounded-xl">
                                                <TrendingUp className="w-5 h-5 text-slate-950" />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Attendance Table Card */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                {attendanceLoading ? (
                                    <div className="flex flex-col items-center justify-center py-20">
                                        <Loader2 className="w-8 h-8 animate-spin text-[#ecb613] mb-2" />
                                        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Syncing attendance logs...</p>
                                    </div>
                                ) : activeAttendanceRoster.length > 0 ? (
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                        {activeAttendanceRoster.map((student) => {
                                            const status = attendanceRecords[student.student_id];
                                            const isSaving = isSavingAttendanceMap[student.student_id];
                                            return (
                                                <div 
                                                    key={student.id} 
                                                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all group"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-slate-50 dark:border-slate-700 shadow-inner group-hover:scale-105 transition-transform relative">
                                                            {student.profile_pic_url ? (
                                                                <img src={student.profile_pic_url} alt={student.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span className="text-[#ecb613] text-lg font-black">{student.name.charAt(0)}</span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-extrabold text-slate-900 dark:text-white tracking-tight">{student.name}</h4>
                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Joined {formatLocalDate(student.joined_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                                        </div>
                                                    </div>

                                                    {/* Custom Button Selectors */}
                                                    <div className="flex items-center gap-2 flex-wrap relative">
                                                        {isSaving && (
                                                            <div className="absolute -left-8 top-1/2 -translate-y-1/2">
                                                                <Loader2 className="w-4 h-4 animate-spin text-[#ecb613]" />
                                                            </div>
                                                        )}
                                                        
                                                        {([
                                                            { key: 'present', label: 'Present', color: 'emerald', border: 'border-emerald-200 dark:border-emerald-800', activeBg: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' },
                                                            { key: 'absent', label: 'Absent', color: 'rose', border: 'border-rose-200 dark:border-rose-800', activeBg: 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' },
                                                            { key: 'late', label: 'Late', color: 'amber', border: 'border-amber-200 dark:border-amber-800', activeBg: 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' },
                                                            { key: 'excused', label: 'Excused', color: 'slate', border: 'border-slate-200 dark:border-slate-700', activeBg: 'bg-slate-600 text-white shadow-lg shadow-slate-600/20' }
                                                        ] as const).map(opt => {
                                                            const isActive = status === opt.key;
                                                            return (
                                                                <button
                                                                    key={opt.key}
                                                                    disabled={isSaving}
                                                                    onClick={() => handleMarkClassroomAttendance(student.student_id, opt.key)}
                                                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                                                                        isActive 
                                                                            ? opt.activeBg
                                                                            : `border ${opt.border} bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800`
                                                                    }`}
                                                                >
                                                                    {opt.label}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="py-20 text-center">
                                        <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Enrolled Students</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">Please enroll students in the Students tab first to mark their attendance.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : activeTab === 'Settings' ? (
                        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <div className="p-8 border-b border-slate-200 dark:border-slate-800">
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Classroom Settings</h3>
                                    <p className="text-sm text-slate-500 mt-1">Manage class details and recurring schedule timings.</p>
                                </div>
                                <div className="p-8 space-y-10">
                                    {/* Schedule Section */}
                                    <section>
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                                <Clock className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-bold text-slate-900 dark:text-white">Recurring Schedule</h4>
                                                <p className="text-xs text-slate-500">Set the weekly timings for this class.</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {/* List of Schedules */}
                                            <div className="space-y-4">
                                                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Active Slots</h5>
                                                {schedules.length === 0 ? (
                                                    <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                                        <p className="text-xs font-bold text-slate-400">No schedule slots configured yet.</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {schedules.map((slot) => (
                                                            <div key={slot.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-xl hover:shadow-md transition-all group">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-900 flex items-center justify-center border border-slate-100 dark:border-slate-700">
                                                                        <Calendar className="w-5 h-5 text-[#ecb613]" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{DAY_NAMES[slot.day_of_week]}</p>
                                                                        <p className="text-xs font-medium text-slate-500">{formatTime12hr(slot.start_time)} - {formatTime12hr(slot.end_time)}</p>
                                                                    </div>
                                                                </div>
                                                                <button 
                                                                    onClick={() => handleDeleteSchedule(slot.id)}
                                                                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Add Schedule Form */}
                                            <div className="bg-slate-50 dark:bg-slate-800/30 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                                                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Add New Timing</h5>
                                                <div className="space-y-5">
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 mb-2 px-1 uppercase tracking-wide">Day of the Week</label>
                                                        <select 
                                                            value={newSchedule.day}
                                                            onChange={(e) => setNewSchedule(prev => ({ ...prev, day: parseInt(e.target.value) }))}
                                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-[#ecb613] outline-none transition-all"
                                                        >
                                                            {DAY_NAMES.map((day, idx) => (
                                                                <option key={idx} value={idx}>{day}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-500 mb-2 px-1 uppercase tracking-wide">Start Time</label>
                                                            <select 
                                                                value={newSchedule.start}
                                                                onChange={(e) => setNewSchedule(prev => ({ ...prev, start: e.target.value }))}
                                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-[#ecb613] outline-none transition-all"
                                                            >
                                                                {TIME_OPTIONS.map(opt => (
                                                                    <option key={`start-${opt.value}`} value={opt.value}>{opt.label}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-500 mb-2 px-1 uppercase tracking-wide">End Time</label>
                                                            <select 
                                                                value={newSchedule.end}
                                                                onChange={(e) => setNewSchedule(prev => ({ ...prev, end: e.target.value }))}
                                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-[#ecb613] outline-none transition-all"
                                                            >
                                                                {TIME_OPTIONS.map(opt => (
                                                                    <option key={`end-${opt.value}`} value={opt.value}>{opt.label}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={handleSaveSchedule}
                                                        disabled={isSavingSchedule}
                                                        className="w-full bg-[#ecb613] text-slate-900 font-bold py-3 rounded-xl shadow-md shadow-[#ecb613]/20 hover:bg-[#ecb613]/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                                                    >
                                                        {isSavingSchedule ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlusCircle className="w-5 h-5" />}
                                                        Save Schedule Slot
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    <hr className="border-slate-100 dark:border-slate-800" />

                                    {/* Class Details – Editable */}
                                    <section>
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                                <Edit3 className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-bold text-slate-900 dark:text-white">Class Details</h4>
                                                <p className="text-xs text-slate-500">Edit class name, description, and status.</p>
                                            </div>
                                        </div>

                                        <div className="space-y-5">
                                            {/* Class Name */}
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                                                    Class Name <span className="text-rose-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={metadataForm.name}
                                                    onChange={e => setMetadataForm(prev => ({ ...prev, name: e.target.value }))}
                                                    placeholder="e.g. Morning Beginners Batch"
                                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#ecb613]/30 focus:border-[#ecb613] outline-none transition-all placeholder:font-normal placeholder:text-slate-400"
                                                />
                                            </div>

                                            {/* Description */}
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Description</label>
                                                <textarea
                                                    rows={4}
                                                    value={metadataForm.description}
                                                    onChange={e => setMetadataForm(prev => ({ ...prev, description: e.target.value }))}
                                                    placeholder="Briefly describe the focus, level, or goals of this class…"
                                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-[#ecb613]/30 focus:border-[#ecb613] outline-none transition-all resize-none placeholder:text-slate-400"
                                                />
                                            </div>

                                            {/* Status */}
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Class Status</label>
                                                <div className="flex items-center gap-3">
                                                    {(['active', 'inactive', 'archived'] as const).map(s => (
                                                        <button
                                                            key={s}
                                                            type="button"
                                                            onClick={() => setMetadataForm(prev => ({ ...prev, status: s }))}
                                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-xs font-bold uppercase tracking-wide transition-all ${
                                                                metadataForm.status === s
                                                                    ? s === 'active'
                                                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                                                                        : s === 'inactive'
                                                                        ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                                                                        : 'border-slate-400 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                                                    : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                                                            }`}
                                                        >
                                                            <span className={`w-1.5 h-1.5 rounded-full ${
                                                                s === 'active' ? 'bg-emerald-500' : s === 'inactive' ? 'bg-amber-400' : 'bg-slate-400'
                                                            }`} />
                                                            {s}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Error / Success feedback */}
                                            {metadataError && (
                                                <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl">
                                                    <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                                                    <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{metadataError}</p>
                                                </div>
                                            )}
                                            {metadataSaved && (
                                                <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                                                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Changes saved successfully!</p>
                                                </div>
                                            )}

                                            {/* Action buttons */}
                                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                                                <button
                                                    type="button"
                                                    onClick={() => setMetadataForm({
                                                        name: classroom?.name || '',
                                                        description: classroom?.description || '',
                                                        status: classroom?.status || 'active',
                                                    })}
                                                    className="text-sm font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                                                >
                                                    Reset changes
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleSaveMetadata}
                                                    disabled={isSavingMetadata}
                                                    className="flex items-center gap-2 px-6 py-2.5 bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900 font-bold text-sm rounded-xl shadow-md shadow-[#ecb613]/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                                >
                                                    {isSavingMetadata
                                                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                                                        : <><Edit3 className="w-4 h-4" /> Save Changes</>
                                                    }
                                                </button>
                                            </div>
                                        </div>
                                    </section>
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

                {/* 3. INTERACTIVE MEDIA PREVIEWER OVERLAY */}
                {mediaPreview && (
                    <div className="fixed inset-0 z-[400] bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-3xl w-full shadow-2xl text-white space-y-4 animate-scaleIn">
                            <div className="flex justify-between items-center select-none">
                                <h4 className="font-extrabold text-sm tracking-wide truncate pr-4 uppercase text-amber-500 font-mono">
                                    Previewing: {mediaPreview.title}
                                </h4>
                                <button 
                                    onClick={() => setMediaPreview(null)} 
                                    className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-all"
                                >
                                    <X className="size-5" />
                                </button>
                            </div>
                            
                            {/* Interactive Media Frame */}
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
                                        <FileText className="size-16 text-slate-600 mx-auto" />
                                        <p className="text-xs text-slate-400 max-w-sm">No interactive simulation available for generic files. Open details below:</p>
                                        <a 
                                            href={mediaPreview.url} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-full text-xs transition-all uppercase tracking-wider"
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

                {/* 4. PREMIUM CURRICULUM TOPIC DETAILS DIALOG */}
                {selectedTopic && (() => {
                    const chap = courseChapters.find(c => c.id === selectedTopic.chapter_id);
                    const mod = chap ? courseModules.find(m => m.id === chap.module_id) : null;
                    
                    const isAudio = selectedTopic.material_type === 'audio';
                    const isVideo = selectedTopic.material_type === 'video';
                    const isPdf = selectedTopic.material_type === 'pdf';
                    const isImage = selectedTopic.material_type === 'image';
                    const hasMaterial = !!selectedTopic.material_url;
                    
                    // Style config for headers and badges inside modal
                    const styleConfig = isVideo ? {
                        badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
                        icon: <Film className="size-5 text-[#ecb613]" />,
                        label: 'Video Tutorial'
                    } : isAudio ? {
                        badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-450 border border-amber-500/20',
                        icon: <Music className="size-5 text-amber-500 animate-pulse" />,
                        label: 'Audio Guide'
                    } : isPdf ? {
                        badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-450 border border-amber-500/20',
                        icon: <FileText className="size-5 text-[#ecb613]" />,
                        label: 'PDF Sheet Music'
                    } : {
                        badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-450 border border-amber-500/20',
                        icon: <BookOpen className="size-5 text-amber-500" />,
                        label: 'Interactive Guide'
                    };

                    return (
                        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl text-slate-800 dark:text-slate-100 overflow-hidden animate-in zoom-in-95 duration-300">
                                {/* Header */}
                                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex-shrink-0">
                                    <div className="flex items-center gap-3 text-left">
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                            {styleConfig.icon}
                                        </div>
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-black text-slate-900 dark:text-white text-sm md:text-base tracking-tight leading-none">{selectedTopic.title}</h3>
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
                                        className="p-1.5 rounded-lg text-slate-450 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Body */}
                                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                                    {/* 1. Lesson Overview */}
                                    <div className="space-y-3 text-left">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none font-mono">1. Lesson Overview</h4>
                                        <div className="p-5 rounded-2xl bg-slate-50/60 dark:bg-slate-950/20 border border-slate-200/50 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium leading-relaxed whitespace-pre-wrap">
                                            {selectedTopic.description || 'No detailed instructions uploaded. Follow general study guides for this level.'}
                                        </div>
                                    </div>

                                    {/* 2. Learning Objectives */}
                                    {selectedTopic.bullet_points && selectedTopic.bullet_points.length > 0 && (
                                        <div className="space-y-3 text-left">
                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none font-mono">2. Learning Objectives</h4>
                                            <div className="p-5 rounded-2xl bg-slate-50/60 dark:bg-slate-950/20 border border-slate-200/50 dark:border-slate-800 space-y-3.5">
                                                <ul className="space-y-2.5">
                                                    {selectedTopic.bullet_points.map((pt: string, idx: number) => (
                                                        <li key={idx} className="flex items-start gap-2.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                                            <div className="w-4 h-4 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5 text-[#ecb613] font-extrabold text-[8px]">
                                                                ✓
                                                            </div>
                                                            <span className="leading-tight">{pt}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                    {/* 3. Study Material Attachment */}
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
                                                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-955 font-black rounded-full text-xs transition-all uppercase tracking-wider"
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
                                                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
                                                    This is a theoretical study and conceptual topic block. Read the instructions and checklist objectives above to complete the learning phase.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-950/20 border-t border-slate-150 dark:border-slate-800 flex justify-end gap-3 flex-shrink-0">
                                    <button 
                                        onClick={() => setSelectedTopic(null)} 
                                        className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors tracking-wider uppercase"
                                    >
                                        Back to Curriculum
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Allocate from Inventory Sliding Drawer */}
                {isInventoryDrawerOpen && (
                    <div className="fixed inset-0 z-[600] flex justify-end animate-in fade-in duration-300">
                        {/* Backdrop */}
                        <div 
                            onClick={() => setIsInventoryDrawerOpen(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
                        ></div>

                        {/* Drawer Content */}
                        <div className="relative w-full max-w-xl h-full bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">
                            {/* Drawer Header */}
                            <div className="px-6 py-5 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
                                <div className="flex items-center gap-2.5 text-left">
                                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                                        <BookOpen className="size-4.5 text-amber-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight leading-none">Allocate from Inventory</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase font-mono tracking-wider mt-1">Classroom Learning Materials</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setIsInventoryDrawerOpen(false)}
                                    className="p-1.5 rounded-lg text-slate-450 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Search and Tab selectors */}
                            <div className="p-5 border-b border-slate-150 dark:border-slate-855 space-y-4">
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

                                {/* Tab Selectors */}
                            </div>

                            {/* List Area */}
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
                                                {/* Category Headline */}
                                                <div className="flex items-center gap-2 select-none border-b border-slate-150 dark:border-slate-855 pb-1.5 pt-1">
                                                    <span className="w-1.5 h-3.5 bg-[#ecb613] rounded-full" />
                                                    <h6 className="font-extrabold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">
                                                        {category}
                                                    </h6>
                                                    <span className="text-[9px] font-bold text-slate-400 font-mono bg-slate-100 dark:bg-slate-800/60 px-1.5 py-0.2 rounded-md">
                                                        {filteredModules.length} Modules
                                                    </span>
                                                </div>

                                                {/* Modules Accordion List */}
                                                <div className="space-y-3">
                                                    {filteredModules.map(mod => {
                                                        const isExpanded = !!expandedInventoryModules[mod.id];
                                                        const modChapters = courseChapters.filter(c => c.module_id === mod.id);
                                                        const isImporting = importingItemId === mod.id;
                                                        const isAllocated = classroomInventoryAllocations.some(a => a.module_id === mod.id && !a.allocated_to_student_id);

                                                        return (
                                                            <div key={mod.id} className="rounded-2xl border border-slate-200/80 dark:border-slate-855 overflow-hidden bg-slate-50/[0.2] dark:bg-slate-900/10">
                                                                {/* Header Panel */}
                                                                <div 
                                                                    onClick={() => setExpandedInventoryModules(prev => ({ ...prev, [mod.id]: !isExpanded }))}
                                                                    className="px-5 py-4 bg-slate-50/50 dark:bg-slate-900/60 hover:bg-slate-100/60 dark:hover:bg-slate-900/80 transition-all flex items-center justify-between cursor-pointer select-none gap-4"
                                                                >
                                                                    <div className="flex items-center gap-3 text-left min-w-0 flex-1">
                                                                        <div className="w-8.5 h-8.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 text-[10px] font-black uppercase font-mono shrink-0">
                                                                            {getCategoryAbbreviation(category)}
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <h5 className="text-xs font-black text-slate-855 dark:text-slate-100 leading-tight truncate">{mod.title}</h5>
                                                                            <p className="text-[9px] text-slate-450 dark:text-slate-555 font-bold uppercase mt-1 tracking-wider font-mono">
                                                                                {modChapters.length} CHAPTERS • {category}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                                                                        <button
                                                                            disabled={isImporting || isAllocated}
                                                                            onClick={() => handleAllocateItem('module', mod.id, mod.title, mod.description)}
                                                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 ${
                                                                                isAllocated
                                                                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-455 cursor-not-allowed shadow-none'
                                                                                    : 'bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-950 hover:-translate-y-0.5'
                                                                            }`}
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
                                                                            className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                                                                        >
                                                                            {isExpanded ? (
                                                                                <ChevronUp className="size-4" />
                                                                            ) : (
                                                                                <ChevronDown className="size-4" />
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Chapters & Lessons */}
                                                                {isExpanded && (
                                                                    <div className="p-4 bg-white dark:bg-slate-955/20 border-t border-slate-150 dark:border-slate-850 space-y-4">
                                                                        {modChapters.length === 0 ? (
                                                                            <p className="text-xs text-slate-400 italic text-center py-2">No chapters defined.</p>
                                                                        ) : (
                                                                            modChapters.map(chap => {
                                                                                const isChapImporting = importingItemId === chap.id;
                                                                                const isChapAllocated = classroomInventoryAllocations.some(a => a.chapter_id === chap.id && !a.allocated_to_student_id);
                                                                                const chapLessons = courseLessons.filter(l => l.chapter_id === chap.id);

                                                                                return (
                                                                                    <div key={chap.id} className="p-3.5 rounded-xl border border-slate-150 dark:border-slate-855 bg-slate-50/[0.1] dark:bg-slate-900/5 space-y-3">
                                                                                        {/* Chapter header row */}
                                                                                        <div className="flex items-start justify-between gap-3">
                                                                                            <div className="text-left">
                                                                                                <span className="text-[8px] font-black text-amber-550 font-mono uppercase tracking-widest leading-none">CHAPTER LEVEL</span>
                                                                                                <h6 className="text-xs font-black text-slate-800 dark:text-slate-200 mt-1 leading-tight">{chap.title}</h6>
                                                                                            </div>
                                                                                            <button
                                                                                                disabled={isChapImporting || isChapAllocated}
                                                                                                onClick={() => handleAllocateItem('chapter', chap.id, chap.title, chap.description)}
                                                                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 shrink-0 ${
                                                                                                    isChapAllocated
                                                                                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-455 cursor-not-allowed shadow-none'
                                                                                                        : 'bg-white dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-955 border border-slate-200 dark:border-slate-700 hover:border-transparent'
                                                                                                }`}
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

                                                                                        {/* Chapter Lessons */}
                                                                                        {chapLessons.length > 0 && (
                                                                                            <div className="pl-3 border-l border-slate-200 dark:border-slate-800 space-y-2 mt-2">
                                                                                                {chapLessons.map(lesson => {
                                                                                                    const isLessonImporting = importingItemId === lesson.id;
                                                                                                    const isLessonAllocated = classroomInventoryAllocations.some(a => a.lesson_id === lesson.id && !a.allocated_to_student_id);

                                                                                                    return (
                                                                                                        <div key={lesson.id} className="flex items-center justify-between gap-3 py-1.5">
                                                                                                            <div className="flex items-center gap-2 min-w-0">
                                                                                                                <div className="w-5.5 h-5.5 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                                                                                                    {lesson.material_type === 'video' ? (
                                                                                                                        <Film className="size-3 text-amber-550" />
                                                                                                                    ) : lesson.material_type === 'audio' ? (
                                                                                                                        <Music className="size-3 text-amber-550" />
                                                                                                                    ) : (
                                                                                                                        <FileText className="size-3 text-slate-400" />
                                                                                                                    )}
                                                                                                                </div>
                                                                                                                <span className="text-[11px] font-bold text-slate-655 dark:text-slate-355 truncate leading-none mt-0.5">{lesson.title}</span>
                                                                                                            </div>
                                                                                                            <button
                                                                                                                disabled={isLessonImporting || isLessonAllocated}
                                                                                                                onClick={() => handleAllocateItem('lesson', lesson.id, lesson.title, lesson.description)}
                                                                                                                className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shrink-0 ${
                                                                                                                    isLessonAllocated
                                                                                                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-455 cursor-not-allowed shadow-none'
                                                                                                                        : 'bg-white dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-955 border border-slate-200 dark:border-slate-700 hover:border-transparent'
                                                                                                                }`}
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
                {/* Allocation Manager Sliding Drawer */}
                {isAllocationDrawerOpen && (
                    <div className="fixed inset-0 z-[600] flex justify-end animate-in fade-in duration-300">
                        {/* Backdrop */}
                        <div 
                            onClick={() => setIsAllocationDrawerOpen(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
                        ></div>

                        {/* Drawer Content */}
                        <div className="relative w-full max-w-md h-full bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">
                            
                            {/* Drawer Header */}
                            <div className="px-6 py-5 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
                                <div className="flex items-center gap-2.5 text-left">
                                    <div className="w-9 h-9 rounded-xl bg-[#ecb613]/10 border border-[#ecb613]/20 flex items-center justify-center text-[#ecb613]">
                                        <Sliders className="size-4.5 text-[#ecb613]" />
                                    </div>
                                    <div>
                                        <h3 className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight leading-none">Allocation Manager</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase font-mono tracking-wider mt-1">Curriculum Pace & Targets</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setIsAllocationDrawerOpen(false)}
                                    className="p-1.5 rounded-lg text-slate-450 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Content Body */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-left">
                                
                                {/* Current Target Card */}
                                <div className="space-y-2">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-[#ecb613] font-mono">Current Target</span>
                                    <div className="p-4 rounded-2xl bg-amber-500/[0.02] border border-amber-500/10 dark:bg-slate-900/60 dark:border-slate-800 space-y-1">
                                        <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 leading-tight">
                                            {allocationTargetLesson?.title || 'No target selected'}
                                        </h4>
                                        <p className="text-[11px] text-slate-505 dark:text-slate-400 font-semibold leading-none">
                                            Topic {allocationTargetLesson?.lesson_number || ''} • Level 1
                                        </p>
                                    </div>
                                </div>

                                {/* Target Type Segment Switcher */}
                                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setAllocationTargetType('classwide')}
                                        className={`flex-1 py-2 text-center text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                                            allocationTargetType === 'classwide'
                                                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                                                : 'text-slate-450 hover:text-slate-600 dark:hover:text-slate-300'
                                        }`}
                                    >
                                        Class-wide
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAllocationTargetType('individual')}
                                        className={`flex-1 py-2 text-center text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                                            allocationTargetType === 'individual'
                                                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                                                : 'text-slate-450 hover:text-slate-600 dark:hover:text-slate-300'
                                        }`}
                                    >
                                        Individual Student
                                    </button>
                                </div>

                                {/* Update Content Status Blocks */}
                                <div className="space-y-2">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 font-mono">Update Content Status</span>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { status: 'locked', label: 'LOCKED', icon: Lock },
                                            { status: 'unlocked', label: 'UNLOCKED', icon: Unlock },
                                            { status: 'completed', label: 'DONE', icon: CheckCircle }
                                        ].map(item => {
                                            const isSelected = allocationStatus === item.status;
                                            const IconComponent = item.icon;
                                            return (
                                                <button
                                                    key={item.status}
                                                    type="button"
                                                    onClick={() => setAllocationStatus(item.status as any)}
                                                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all gap-2 cursor-pointer ${
                                                        isSelected
                                                            ? `${
                                                                item.status === 'locked' 
                                                                    ? 'bg-slate-900 dark:bg-slate-800 border-slate-900 dark:border-slate-850 text-white font-bold' 
                                                                    : item.status === 'unlocked' 
                                                                    ? 'border-[#ecb613] bg-amber-500/[0.04] text-[#ecb613] font-bold' 
                                                                    : 'border-emerald-500 bg-emerald-500/[0.04] text-emerald-600 dark:text-emerald-400 font-bold'
                                                            }`
                                                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/60 text-slate-400 dark:text-slate-500'
                                                    }`}
                                                >
                                                    <IconComponent className="size-4.5 stroke-[2.2]" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Student Roster (Individual Student Mode only) */}
                                {allocationTargetType === 'individual' && (
                                    <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-300">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 font-mono">Student Roster</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const allIds = students.map(s => s.student_id);
                                                    if (allocationSelectedStudents.length === students.length) {
                                                        setAllocationSelectedStudents([]);
                                                    } else {
                                                        setAllocationSelectedStudents(allIds);
                                                    }
                                                }}
                                                className="text-[9px] font-black uppercase tracking-wider text-amber-600 hover:text-amber-550 dark:text-[#ecb613] cursor-pointer"
                                            >
                                                {allocationSelectedStudents.length === students.length ? 'Clear All' : 'Select All'}
                                            </button>
                                        </div>

                                        {/* Roster Search Input */}
                                        <div className="relative">
                                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 size-3.5" />
                                            <input
                                                type="text"
                                                value={allocationSearchQuery}
                                                onChange={(e) => setAllocationSearchQuery(e.target.value)}
                                                placeholder="Search by name or ID..."
                                                className="w-full pl-9 pr-4 py-2.5 bg-slate-100 dark:bg-slate-900 border border-transparent dark:border-slate-800 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100 transition-all"
                                            />
                                        </div>

                                        {/* Scrollable list of students */}
                                        <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1.5 scrollbar-thin">
                                            {students.length === 0 ? (
                                                <p className="text-xs text-slate-450 italic text-center py-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl">No students enrolled in this classroom.</p>
                                            ) : (() => {
                                                const filtered = students.filter(s => 
                                                    s.name.toLowerCase().includes(allocationSearchQuery.toLowerCase()) ||
                                                    s.student_id.toLowerCase().includes(allocationSearchQuery.toLowerCase())
                                                );
                                                if (filtered.length === 0) {
                                                    return <p className="text-xs text-slate-450 italic text-center py-4">No matching students found.</p>;
                                                }
                                                return filtered.map((s, idx) => {
                                                    const isChecked = allocationSelectedStudents.includes(s.student_id);
                                                    return (
                                                        <div
                                                            key={s.id}
                                                            onClick={() => {
                                                                if (isChecked) {
                                                                    setAllocationSelectedStudents(prev => prev.filter(id => id !== s.student_id));
                                                                } else {
                                                                    setAllocationSelectedStudents(prev => [...prev, s.student_id]);
                                                                }
                                                            }}
                                                            className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                                                                isChecked
                                                                    ? 'border-[#ecb613]/40 bg-amber-500/[0.02] dark:bg-[#ecb613]/[0.01]'
                                                                    : 'border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-900/40'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-2.5">
                                                                {/* Avatar */}
                                                                <div className="relative">
                                                                    {s.profile_pic_url ? (
                                                                        <img 
                                                                            src={s.profile_pic_url} 
                                                                            alt={s.name} 
                                                                            className="size-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                                                                        />
                                                                    ) : (
                                                                        <div className="size-8 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 font-extrabold text-xs flex items-center justify-center border border-amber-500/20">
                                                                            {s.name.charAt(0).toUpperCase()}
                                                                        </div>
                                                                    )}
                                                                    <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border border-white dark:border-slate-950"></span>
                                                                </div>

                                                                {/* Name & ID */}
                                                                <div>
                                                                    <p className="text-[11px] font-black text-slate-800 dark:text-slate-100 leading-none">{s.name}</p>
                                                                    <p className="text-[9px] font-black text-slate-450 dark:text-slate-550 font-mono tracking-tight mt-0.5">ID: #FL{2000 + idx * 13}</p>
                                                                </div>
                                                            </div>

                                                            {/* Checkbox */}
                                                            <div className="relative flex items-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    readOnly
                                                                    className="size-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-900 cursor-pointer pointer-events-none"
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Drawer Footer */}
                            <div className="p-6 border-t border-slate-150 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-900/40">
                                <button
                                    type="button"
                                    disabled={isSavingAllocation}
                                    onClick={handleSaveAllocation}
                                    className="flex-1 py-3 bg-[#ecb613] hover:bg-amber-500 disabled:bg-slate-150 dark:disabled:bg-slate-800 text-slate-950 disabled:text-slate-400 font-black rounded-xl text-xs transition-all hover:scale-[1.02] active:scale-[0.98] tracking-widest uppercase flex items-center justify-center gap-2 shadow-md shadow-amber-500/10 cursor-pointer"
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
                                <button
                                    type="button"
                                    onClick={() => alert('Feature coming soon: Scheduling and history')}
                                    className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-transparent rounded-xl transition-all cursor-pointer"
                                >
                                    <Clock className="size-4" />
                                </button>
                            </div>

                        </div>
                    </div>
                )}

                {/* ── Review Task Modal ───────────────────────────────────── */}
                {isReviewModalOpen && selectedReviewStudent && selectedReviewAssignment && (
                    <div className="fixed inset-0 z-[350] flex items-end sm:items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300">
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-600 flex-shrink-0">
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
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-left">
                                {/* Video/Materials Links if exists */}
                                {selectedReviewStudent.video_url && (
                                    <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl flex items-center justify-between gap-3 animate-in fade-in duration-350">
                                        <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 min-w-0">
                                            <PlayCircle className="w-4 h-4 shrink-0" />
                                            <span className="text-xs font-bold truncate">Submission Video URL</span>
                                        </div>
                                        <a 
                                            href={selectedReviewStudent.video_url} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="inline-flex items-center gap-1 text-[11px] font-black text-[#ecb613] hover:underline shrink-0"
                                        >
                                            <ExternalLink className="w-3 h-3" /> View
                                        </a>
                                    </div>
                                )}

                                {(selectedReviewAssignment.file_url || selectedReviewAssignment.inventory_ref_id) && (
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-3 animate-in fade-in duration-350">
                                        <div className="flex items-center gap-2 text-slate-655 dark:text-slate-400 min-w-0">
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
                                                className="inline-flex items-center gap-1 text-[11px] font-black text-[#ecb613] hover:underline shrink-0"
                                            >
                                                <Download className="w-3 h-3" /> Download
                                            </a>
                                        ) : (
                                            <span className="text-[10px] text-amber-600 dark:text-amber-500 font-bold uppercase tracking-wider font-mono">Curriculum</span>
                                        )}
                                    </div>
                                )}

                                {/* Grading Form Fields */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Score (Out of 10)</label>
                                        <input 
                                            className="w-full rounded-xl border border-slate-205 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-xs font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#ecb613]/25 focus:border-[#ecb613] outline-none transition-all text-slate-800 dark:text-slate-100" 
                                            type="number" 
                                            min="0" max="10" step="0.5" 
                                            placeholder="e.g. 8.5"
                                            value={reviewScore}
                                            onChange={(e) => setReviewScore(e.target.value === '' ? '' : Number(e.target.value))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Proficiency</label>
                                        <select 
                                            className="w-full rounded-xl border border-slate-205 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5 text-xs font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#ecb613]/25 focus:border-[#ecb613] outline-none transition-all text-slate-800 dark:text-slate-100"
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
                                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Feedback / Comments</label>
                                    <textarea 
                                        className="w-full rounded-xl border border-slate-205 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-xs font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#ecb613]/25 focus:border-[#ecb613] outline-none transition-all resize-none text-slate-800 dark:text-slate-100" 
                                        rows={3} 
                                        placeholder="Add encouragement, areas of improvement..."
                                        value={reviewFeedback}
                                        onChange={(e) => setReviewFeedback(e.target.value)}
                                    ></textarea>
                                </div>

                                <div className="flex items-center gap-3 p-3.5 bg-rose-50 dark:bg-rose-950/10 rounded-xl border border-rose-100 dark:border-rose-900/40">
                                    <input 
                                        className="rounded text-rose-600 focus:ring-rose-500 h-4 w-4 border-slate-300 dark:border-slate-600 cursor-pointer" 
                                        type="checkbox" 
                                        id="review-reassign"
                                        checked={reviewReassign}
                                        onChange={(e) => setReviewReassign(e.target.checked)}
                                    />
                                    <label className="text-xs font-bold text-rose-800 dark:text-rose-450 flex flex-col cursor-pointer select-none" htmlFor="review-reassign">
                                        Re-assign Task
                                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-450 mt-0.5">Mark as incomplete to request a resubmission.</span>
                                    </label>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 flex-shrink-0">
                                <button
                                    onClick={() => setIsReviewModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveStudentReview}
                                    disabled={isSavingReview}
                                    className="px-5 py-2.5 rounded-xl text-xs font-black bg-[#ecb613] text-slate-900 hover:bg-[#ecb613]/90 shadow-md shadow-[#ecb613]/10 transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSavingReview ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                    {isSavingReview ? 'Saving...' : 'Save Review'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Global floating message notification toast */}
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

function LessonRow({ lesson, onClick, stats }: { lesson: any; onClick: () => void; stats?: { completed: number; unlocked: number; total: number } }) {
    const hasMaterial = !!lesson.material_url;
    const isAudio = lesson.material_type === 'audio';
    const isVideo = lesson.material_type === 'video';
    const isPdf = lesson.material_type === 'pdf';
    
    // Choose beautiful left-accent colors, background fills, and badge classes
    const styleConfig = isVideo ? {
        border: 'border-l-[#ecb613] dark:border-l-amber-500',
        bg: 'hover:bg-amber-500/[0.01]',
        badge: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/10',
        icon: <Film className="size-4 text-[#ecb613]" />,
        label: 'Video Tutorial'
    } : isAudio ? {
        border: 'border-l-amber-450 dark:border-l-amber-500',
        bg: 'hover:bg-amber-400/[0.01]',
        badge: 'bg-amber-50 text-amber-700 dark:bg-amber-450/10 dark:text-amber-300 border border-amber-200 dark:border-amber-450/15',
        icon: <Music className="size-4 text-amber-500 animate-pulse" />,
        label: 'Audio Guide'
    } : isPdf ? {
        border: 'border-l-[#ecb613] dark:border-l-amber-550',
        bg: 'hover:bg-amber-500/[0.01]',
        badge: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-450 border border-amber-200/60 dark:border-amber-500/10',
        icon: <FileText className="size-4 text-[#ecb613]" />,
        label: 'PDF Sheet Music'
    } : {
        border: 'border-l-amber-300 dark:border-l-amber-500',
        bg: 'hover:bg-amber-300/[0.01]',
        badge: 'bg-amber-50 text-amber-600 dark:bg-amber-300/10 dark:text-amber-400 border border-amber-100 dark:border-amber-300/10',
        icon: <BookOpen className="size-4 text-amber-500" />,
        label: 'Interactive Guide'
    };

    return (
        <div 
            onClick={onClick}
            className={`relative flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 border-l-4 ${styleConfig.border} ${styleConfig.bg} transition-all duration-300 hover:shadow-md hover:shadow-slate-500/[0.02] hover:-translate-y-0.5 gap-4 cursor-pointer active:scale-[0.99]`}
        >
            {/* Elegant node bullet representing a step in the lesson track */}
            <div className="absolute -left-[19px] top-6 w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700 border-2 border-white dark:border-slate-900 group-hover:bg-[#ecb613] transition-colors z-10 hidden md:block"></div>
            
            <div className="flex items-start gap-3.5 text-left flex-1">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-950/60 flex items-center justify-center shrink-0 mt-0.5">
                    {styleConfig.icon}
                </div>
                <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h6 className="text-xs font-extrabold text-slate-800 dark:text-slate-100">{lesson.title}</h6>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider leading-none ${styleConfig.badge}`}>
                            {styleConfig.label}
                        </span>
                        {stats && stats.total > 0 && (
                            <div className="flex items-center gap-1.5 ml-2 select-none shrink-0">
                                <span className="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 px-2 py-0.5 rounded-full text-[8px] font-mono font-black border border-emerald-500/20">
                                    {stats.completed}/{stats.total} Done
                                </span>
                                {stats.unlocked > 0 && (
                                    <span className="bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 px-2 py-0.5 rounded-full text-[8px] font-mono font-black border border-amber-500/20 animate-pulse">
                                        {stats.unlocked} Active
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    {lesson.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed max-w-xl">{lesson.description}</p>
                    )}
                </div>
            </div>
            {hasMaterial && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClick();
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-[#ecb613] hover:text-slate-950 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-transparent rounded-xl text-[10px] font-extrabold tracking-wider uppercase transition-all shadow-sm hover:shadow-[#ecb613]/10 self-start md:self-center shrink-0 active:scale-95"
                >
                    <PlayCircle className="size-3.5" />
                    <span>View Details</span>
                </button>
            )}
        </div>
    );
}
