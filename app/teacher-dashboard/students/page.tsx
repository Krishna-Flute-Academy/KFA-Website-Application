'use client';

import React, { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { Loader2, Lightbulb, Sparkles, X, Check, Target } from 'lucide-react';
import TeacherSidebar from '../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../src/components/TeacherHeader';
import Link from 'next/link';
import { sortClassroomsByDayAndTime } from '../../../src/lib/classroomSort';
import { getStudentStatusBadge } from '../../../src/lib/student-lifecycle';
import { fetchAcademyTeachers } from '../../../src/lib/teachers';
import { PauseLearningModal } from '../../../src/components/teacher-dashboard/students/PauseLearningModal';
import { ResumeLearningModal } from '../../../src/components/teacher-dashboard/students/ResumeLearningModal';

const GUIDANCE_TEMPLATES = [
    {
        name: 'Breath Control',
        type: 'focus',
        title: 'Breath Control & Airflow',
        text: 'Maintain consistent diaphragm support and smooth airflow. Keep blowing pressure even across swaras.'
    },
    {
        name: 'Tone',
        type: 'improvement',
        title: 'Tone Clarity & Sweet Sound',
        text: 'Adjust your lip embouchure slightly upward to reduce airy hiss. Aim for a warm, centered flute tone.'
    },
    {
        name: 'Rhythm',
        type: 'practice',
        title: 'Taal & Metronome Practice',
        text: 'Practice the composition strictly with a metronome or tanpura. Focus on landing cleanly on the Sam (Beat 1).'
    },
    {
        name: 'Finger Movement',
        type: 'practice',
        title: 'Finger Placement & Clean Holes',
        text: 'Ensure finger pads completely seal the tone holes with minimal tension. Relax your hands and wrists.'
    },
    {
        name: 'Long Notes',
        type: 'practice',
        title: 'Long Sustained Notes (Riyaz)',
        text: 'Spend 10 minutes daily holding each note from Mandra Saptak to Madhya Saptak with steady breath and zero pitch wobble.'
    },
    {
        name: 'Slow Practice',
        type: 'focus',
        title: 'Slow Riyaz for Muscle Memory',
        text: 'Practice at half speed with pure clarity. Precision at slow tempo builds effortless speed later.'
    },
    {
        name: 'Tempo',
        type: 'practice',
        title: 'Gradual Speed Progression',
        text: 'Do not rush the tempo. Master the phrase accurately at 60 BPM before gradually increasing tempo by 5 BPM intervals.'
    },
    {
        name: 'Revision',
        type: 'improvement',
        title: 'Review Previous Lesson Feedback',
        text: 'Revisit the previous assignment submission and pay special attention to finger release timing and komal swara tuning.'
    },
    {
        name: 'Good Improvement',
        type: 'strength',
        title: 'Outstanding Progress & Tone',
        text: 'Great progress on tone projection and tempo stability! Keep up this consistent riyaz for the upcoming ragas.'
    },
    {
        name: 'Clean Notes',
        type: 'focus',
        title: 'Clean Note Articulation',
        text: 'Avoid sliding accidentally between notes unless specifically playing meend. Focus on crisp, clean note separations.'
    }
];

export interface AttentionIssue {
    type: 'unassigned_batch' | 'low_attendance' | 'overdue_tasks' | 'spotlight_pending';
    label: string;
    detail?: string;
}

interface StudentData {
    id: string;
    user_id: string;
    name: string;
    email?: string;
    role?: string;
    profile_pic_url?: string;
    student_id_formatted: string;
    batch: string;
    classroom_id?: string | null;
    classroom_name?: string | null;
    attendance_pct: number;
    status: string;
    attention_issues?: AttentionIssue[];
    pacing_status?: 'Consistent' | 'Improving' | 'At Risk';
    is_online?: boolean;
    created_at?: string;
    join_date?: string | null;
    level?: string | null;
    learning_mode?: string | null;
    notes?: string | null;
    fees_basis?: string | null;
    fees_amount?: number | null;
    fees_collection_date?: number | null;
    fees_classes_paid?: number | null;
    teacher_id?: string | null;
    teacher_name?: string;
    phone?: string;
}

interface BulkEnrollRow {
    name: string;
    email: string;
    phone: string;
    level: string;
    batchId: string;
    error?: string;
}

interface Classroom {
    id: string;
    name: string;
    teacher_id?: string | null;
}

const AttentionPopoverPortal: React.FC<{
    student: StudentData | null;
    triggerEl: HTMLElement | null;
    onClose: () => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
}> = ({ student, triggerEl, onClose, onMouseEnter, onMouseLeave }) => {
    const [mounted, setMounted] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState<{
        top: number;
        left: number;
        width: number;
        maxHeight: number;
        placement: 'top' | 'bottom';
    } | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    const updatePosition = useCallback(() => {
        if (!triggerEl) return;
        const triggerRect = triggerEl.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // If trigger is scrolled completely out of viewport, close it
        if (triggerRect.bottom < 0 || triggerRect.top > viewportHeight) {
            onClose();
            return;
        }

        const isMobile = viewportWidth < 768;
        const padding = isMobile ? 12 : 16;
        const gap = 8;
        const popoverWidth = isMobile
            ? Math.min(340, viewportWidth - (padding * 2))
            : 300;

        const popoverEl = popoverRef.current;
        const measuredHeight = popoverEl ? Math.max(popoverEl.offsetHeight, popoverEl.scrollHeight) : 220;

        const spaceBelow = viewportHeight - triggerRect.bottom - gap - padding;
        const spaceAbove = triggerRect.top - gap - padding;

        let placement: 'top' | 'bottom' = 'bottom';
        let top: number;
        let maxHeight: number;

        // Auto flip upward if space below is insufficient AND space above is greater
        if (spaceBelow < measuredHeight && spaceAbove > spaceBelow) {
            placement = 'top';
            maxHeight = Math.max(160, Math.min(360, spaceAbove));
            const actualHeight = Math.min(measuredHeight, maxHeight);
            top = Math.max(padding, triggerRect.top - actualHeight - gap);
        } else {
            placement = 'bottom';
            maxHeight = Math.max(160, Math.min(360, spaceBelow));
            top = Math.min(viewportHeight - padding - Math.min(measuredHeight, maxHeight), triggerRect.bottom + gap);
        }

        // Horizontal positioning: center on mobile, clamp on desktop
        let left: number;
        if (isMobile) {
            left = Math.max(padding, (viewportWidth - popoverWidth) / 2);
        } else {
            left = triggerRect.left;
            if (left + popoverWidth > viewportWidth - padding) {
                left = Math.max(padding, viewportWidth - popoverWidth - padding);
            }
            if (left < padding) {
                left = padding;
            }
        }

        setCoords({ top, left, width: popoverWidth, maxHeight, placement });
    }, [triggerEl, onClose]);

    useLayoutEffect(() => {
        if (student && triggerEl) {
            updatePosition();
        }
    }, [student, triggerEl, updatePosition]);

    useEffect(() => {
        if (!student || !triggerEl) return;

        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                popoverRef.current &&
                !popoverRef.current.contains(target) &&
                triggerEl &&
                !triggerEl.contains(target)
            ) {
                onClose();
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [student, triggerEl, updatePosition, onClose]);

    if (!mounted || !student || !triggerEl) return null;

    const issues = (student.status === 'Active' ? student.attention_issues : []) || [];
    if (issues.length === 0) return null;

    return createPortal(
        <div
            ref={popoverRef}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            style={{
                position: 'fixed',
                top: coords ? `${coords.top}px` : '-9999px',
                left: coords ? `${coords.left}px` : '-9999px',
                width: coords ? `${coords.width}px` : '300px',
                maxHeight: coords ? `${coords.maxHeight}px` : '360px',
                zIndex: 99999,
                opacity: coords ? 1 : 0,
                transform: coords ? 'scale(1)' : 'scale(0.96)',
                transition: 'opacity 150ms ease-out, transform 150ms ease-out',
            }}
            className="p-3.5 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-amber-200 dark:border-amber-800/70 text-left flex flex-col pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Needs Attention Details"
        >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-amber-600 dark:text-amber-400">warning</span>
                    Needs Attention ({issues.length})
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    className="size-6 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    aria-label="Close"
                >
                    <span className="material-symbols-outlined text-sm">close</span>
                </button>
            </div>

            {/* Bullets List with Auto Scroll */}
            <ul className="space-y-2 mb-2.5 overflow-y-auto pr-1 flex-1 min-h-0">
                {issues.map((issue, idx) => (
                    <li key={idx} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                        <span className="text-amber-500 font-bold leading-tight select-none mt-0.5">•</span>
                        <div className="flex-1 min-w-0">
                            <span className="font-semibold block leading-tight text-slate-900 dark:text-slate-100">{issue.label}</span>
                            {issue.detail && (
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 block leading-tight mt-0.5">{issue.detail}</span>
                            )}
                        </div>
                    </li>
                ))}
            </ul>

            {/* Profile Action Link */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <Link
                    href={`/teacher-dashboard/students/${student.id}`}
                    onClick={onClose}
                    className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 hover:underline cursor-pointer"
                >
                    View Student Profile →
                </Link>
            </div>
        </div>,
        document.body
    );
};

export default function StudentDirectory() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string; phone?: string | null; role?: string; profile_pic_url?: string | null } | null>(null);
    const [students, setStudents] = useState<StudentData[]>([]);
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [stats, setStats] = useState({
        avgAttendance: 0,
        submissionRate: 76, // Mocked for now
    });
    const [filterMode, setFilterMode] = useState<'all' | 'recent' | 'unassigned'>('all');
    const [unassignedStudents, setUnassignedStudents] = useState<StudentData[]>([]);
    const [claimingId, setClaimingId] = useState<string | null>(null);
    const [showClaimModal, setShowClaimModal] = useState<StudentData | null>(null);
    const [claimBatchId, setClaimBatchId] = useState('');
    const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
    const [claimTeacherId, setClaimTeacherId] = useState('');
    const [selectedBatch, setSelectedBatch] = useState<string>('All Batches');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived' | 'inactive'>('active');
    const [attentionFilter, setAttentionFilter] = useState<'all' | 'needs_attention' | 'no_attention'>('all');
    const [activeAttentionStudent, setActiveAttentionStudent] = useState<StudentData | null>(null);
    const [activeAttentionTrigger, setActiveAttentionTrigger] = useState<HTMLElement | null>(null);
    const [isAttentionPinned, setIsAttentionPinned] = useState(false);
    const attentionCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

    const handleAttentionTriggerMouseEnter = (student: StudentData, el: HTMLElement) => {
        if (attentionCloseTimerRef.current) {
            clearTimeout(attentionCloseTimerRef.current);
            attentionCloseTimerRef.current = null;
        }
        setActiveAttentionStudent(student);
        setActiveAttentionTrigger(el);
    };

    const handleAttentionTriggerMouseLeave = () => {
        if (!isAttentionPinned) {
            attentionCloseTimerRef.current = setTimeout(() => {
                setActiveAttentionStudent(null);
                setActiveAttentionTrigger(null);
            }, 150);
        }
    };

    const handleAttentionTriggerClick = (student: StudentData, el: HTMLElement, e: React.MouseEvent) => {
        e.stopPropagation();
        if (attentionCloseTimerRef.current) {
            clearTimeout(attentionCloseTimerRef.current);
            attentionCloseTimerRef.current = null;
        }
        if (activeAttentionStudent?.id === student.id && isAttentionPinned) {
            setActiveAttentionStudent(null);
            setActiveAttentionTrigger(null);
            setIsAttentionPinned(false);
        } else {
            setActiveAttentionStudent(student);
            setActiveAttentionTrigger(el);
            setIsAttentionPinned(true);
        }
    };

    const handleCloseAttentionPopover = () => {
        if (attentionCloseTimerRef.current) {
            clearTimeout(attentionCloseTimerRef.current);
            attentionCloseTimerRef.current = null;
        }
        setActiveAttentionStudent(null);
        setActiveAttentionTrigger(null);
        setIsAttentionPinned(false);
    };

    const handlePopoverMouseEnter = () => {
        if (attentionCloseTimerRef.current) {
            clearTimeout(attentionCloseTimerRef.current);
            attentionCloseTimerRef.current = null;
        }
    };

    const handlePopoverMouseLeave = () => {
        if (!isAttentionPinned) {
            attentionCloseTimerRef.current = setTimeout(() => {
                setActiveAttentionStudent(null);
                setActiveAttentionTrigger(null);
            }, 150);
        }
    };

    const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
    const actionMenuRef = useRef<HTMLDivElement>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
                setActiveActionMenuId(null);
            }
        }
        if (activeActionMenuId) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [activeActionMenuId]);

    // Single delete
    const [studentToDelete, setStudentToDelete] = useState<{ id: string, name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Bulk selection & deletion
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    // Bulk enroll modal
    const [showBulkEnrollModal, setShowBulkEnrollModal] = useState(false);
    const [bulkEnrollStep, setBulkEnrollStep] = useState<'input' | 'review' | 'done'>('input');
    const [bulkCsvText, setBulkCsvText] = useState('');
    const [bulkRows, setBulkRows] = useState<BulkEnrollRow[]>([]);
    const [bulkEnrollBatch, setBulkEnrollBatch] = useState('');
    const [bulkEnrollLevel, setBulkEnrollLevel] = useState('beginner');
    const [isBulkEnrolling, setIsBulkEnrolling] = useState(false);
    const [bulkEnrollResult, setBulkEnrollResult] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [pendingUsers, setPendingUsers] = useState<{ id: string; name: string; email: string; phone?: string; created_at: string }[]>([]);

    // Guidance / Mentor Note Modal State
    const [showGuidanceModal, setShowGuidanceModal] = useState(false);
    const [guidanceTargetStudents, setGuidanceTargetStudents] = useState<StudentData[]>([]);
    const [guidanceType, setGuidanceType] = useState<'focus' | 'practice' | 'improvement' | 'strength' | 'general'>('focus');
    const [guidanceTitle, setGuidanceTitle] = useState('Focus this week');
    const [guidanceText, setGuidanceText] = useState('');
    const [guidanceIsActive, setGuidanceIsActive] = useState(true);
    const [isSavingGuidance, setIsSavingGuidance] = useState(false);
    const [guidanceSuccessMsg, setGuidanceSuccessMsg] = useState('');
    const [guidanceErrorMsg, setGuidanceErrorMsg] = useState('');

    const openBulkGuidanceModal = () => {
        const targets = students.filter(s => selectedIds.has(s.id));
        if (targets.length === 0) return;
        setGuidanceTargetStudents(targets);
        setGuidanceType('focus');
        setGuidanceTitle('Focus this week');
        setGuidanceText('');
        setGuidanceIsActive(true);
        setGuidanceSuccessMsg('');
        setGuidanceErrorMsg('');
        setShowGuidanceModal(true);
    };

    const openSingleGuidanceModal = (student: StudentData) => {
        setGuidanceTargetStudents([student]);
        setGuidanceType('focus');
        setGuidanceTitle('Focus this week');
        setGuidanceText('');
        setGuidanceIsActive(true);
        setGuidanceSuccessMsg('');
        setGuidanceErrorMsg('');
        setShowGuidanceModal(true);
    };

    const handleSaveGuidance = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!guidanceText.trim()) {
            setGuidanceErrorMsg('Please enter guidance text.');
            return;
        }

        setIsSavingGuidance(true);
        setGuidanceErrorMsg('');
        setGuidanceSuccessMsg('');

        try {
            const { data: { user } } = await supabaseAuth.auth.getUser();
            if (!user) throw new Error('You must be logged in.');

            const targetIds = guidanceTargetStudents.map(s => s.id);

            // 1. If marked as active, deactivate previous active notes
            if (guidanceIsActive && targetIds.length > 0) {
                await supabaseAuth
                    .from('mentor_notes')
                    .update({ is_active: false })
                    .in('student_id', targetIds)
                    .eq('is_active', true);
            }

            // 2. Batch insert one row per student
            const rows = targetIds.map(sId => ({
                student_id: sId,
                mentor_id: user.id,
                title: guidanceTitle.trim() || 'Teacher Guidance',
                note: guidanceText.trim(),
                note_type: guidanceType,
                is_active: guidanceIsActive,
                created_at: new Date().toISOString()
            }));

            const { error: insertError } = await supabaseAuth
                .from('mentor_notes')
                .insert(rows);

            if (insertError) throw insertError;

            setGuidanceSuccessMsg(`Guidance saved successfully for ${targetIds.length} student${targetIds.length > 1 ? 's' : ''}!`);
            setSelectedIds(new Set());

            setTimeout(() => {
                setShowGuidanceModal(false);
                setGuidanceSuccessMsg('');
            }, 1200);
        } catch (err: any) {
            setGuidanceErrorMsg(err.message || 'Failed to save guidance.');
        } finally {
            setIsSavingGuidance(false);
        }
    };

    interface DeletedStudentItem {
        id: string;
        name: string;
        deletedAt: string;
        student: any;
    }
    const [recycleBin, setRecycleBin] = useState<DeletedStudentItem[]>([]);
    const [showRecycleBin, setShowRecycleBin] = useState(false);

    useEffect(() => {
        const savedBin = localStorage.getItem('students_recycle_bin');
        if (savedBin) {
            try {
                setRecycleBin(JSON.parse(savedBin));
            } catch (e) {
                console.error(e);
            }
        }
    }, []);

    const saveRecycleBin = (bin: DeletedStudentItem[]) => {
        setRecycleBin(bin);
        localStorage.setItem('students_recycle_bin', JSON.stringify(bin));
    };

    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [filterMode, selectedBatch, statusFilter, searchQuery]);

    // Clear selection when page changes or filters change
    useEffect(() => {
        setSelectedIds(new Set());
    }, [currentPage, filterMode, selectedBatch, statusFilter, searchQuery]);

    const reEvaluateOnlineStatus = async () => {
        try {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            const { data: activeSessions } = await supabaseAuth
                .from('user_sessions')
                .select('user_id')
                .is('logout_at', null)
                .gt('last_activity_at', fiveMinutesAgo);
            
            const onlineUserIds = new Set<string>(activeSessions?.map(sess => sess.user_id) || []);
            
            setStudents(prev => prev.map(s => ({
                ...s,
                is_online: onlineUserIds.has(s.id)
            })));
            
            setUnassignedStudents(prev => prev.map(s => ({
                ...s,
                is_online: onlineUserIds.has(s.id)
            })));
        } catch (e) {
            console.error('Error re-evaluating online status:', e);
        }
    };

    // SWR Cache Saver for Students Directory
    useEffect(() => {
        if (students.length === 0) return;
        const timer = setTimeout(() => {
            try {
                const cacheData = { students, classrooms, teachers, stats, unassignedStudents, teacherProfile };
                localStorage.setItem('kfa_students_cache', JSON.stringify(cacheData));
            } catch (e) { console.error('Students cache save error:', e); }
        }, 300);
        return () => clearTimeout(timer);
    }, [students, classrooms, teachers, stats, unassignedStudents, teacherProfile]);

    useEffect(() => {
        let hasCachedData = false;
        try {
            const cached = localStorage.getItem('kfa_students_cache');
            if (cached) {
                const data = JSON.parse(cached);
                if (data.students) setStudents(data.students);
                if (data.classrooms) setClassrooms(data.classrooms);
                if (data.teachers) setTeachers(data.teachers);
                if (data.stats) setStats(data.stats);
                if (data.unassignedStudents) setUnassignedStudents(data.unassignedStudents);
                if (data.teacherProfile) setTeacherProfile(data.teacherProfile);
                setLoading(false);
                hasCachedData = true;
            }
        } catch (e) { console.error('Students cache load error:', e); }

        const checkAuthAndFetchData = async () => {
            if (!hasCachedData) setLoading(true);
            try {
                // 1. Check Session
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (!session) {
                    router.push('/login?type=teacher');
                    return;
                }

                const userId = session.user.id;

                // 2. Verify Teacher/Admin Role & Get Profile
                const { data: profile, error: profileError } = await supabaseAuth
                    .from('users')
                    .select('name, email, phone, role, profile_pic_url')
                    .eq('id', userId)
                    .single();

                if (profileError || (profile?.role !== 'teacher' && profile?.role !== 'admin')) {
                    router.push('/');
                    return;
                }

                setTeacherProfile({ id: userId, name: profile.name, email: profile.email, phone: profile.phone, role: profile.role, profile_pic_url: profile.profile_pic_url });
                const isAdminUser = profile.role === 'admin';

                // 1. Initial parallel fetches (rooms, teachers, lessons count, active sessions, students)
                const fiveMinutesAgoForQuery = new Date(Date.now() - 5 * 60 * 1000).toISOString();

                const roomsReq = isAdminUser
                    ? supabaseAuth.from('classrooms').select('id, name, teacher_id')
                    : supabaseAuth.from('classrooms').select('id, name, teacher_id').eq('teacher_id', userId);

                const teachersReq = fetchAcademyTeachers(supabaseAuth, userId);
                const sessionsReq = supabaseAuth.from('user_sessions').select('user_id').is('logout_at', null).gt('last_activity_at', fiveMinutesAgoForQuery);

                const studentsBaseReq = supabaseAuth
                    .from('users')
                    .select(`
                        id,
                        name,
                        email,
                        role,
                        status,
                        profile_pic_url,
                        created_at,
                        teacher_id,
                        phone,
                        join_date,
                        level,
                        notes,
                        fees_basis,
                        fees_amount,
                        fees_collection_date,
                        fees_classes_paid,
                        classroom_students(
                            classroom_id,
                            classrooms(id, name, type)
                        )
                    `)
                    .eq('role', 'student');

                const studentsReq = isAdminUser
                    ? studentsBaseReq
                    : studentsBaseReq.eq('teacher_id', userId);

                const [
                    { data: rooms },
                    teachersData,
                    { data: activeSessions },
                    { data: studentsData, error: studentsError }
                ] = await Promise.all([
                    roomsReq,
                    teachersReq,
                    sessionsReq,
                    studentsReq
                ]);

                // 2. Fetch scoped secondary student data (attendance, completed topics, assignments with due dates, teacher spotlights)
                const studentIds = (studentsData || []).map(s => s.id);

                const attendancePromise = isAdminUser
                    ? supabaseAuth.from('attendance').select('student_id, status')
                    : studentIds.length > 0
                        ? supabaseAuth.from('attendance').select('student_id, status').in('student_id', studentIds)
                        : Promise.resolve({ data: [] as any });

                const progressPromise = isAdminUser
                    ? supabaseAuth.from('student_topic_progress').select('student_id, lesson_id').eq('status', 'completed')
                    : studentIds.length > 0
                        ? supabaseAuth.from('student_topic_progress').select('student_id, lesson_id').eq('status', 'completed').in('student_id', studentIds)
                        : Promise.resolve({ data: [] as any });

                const assignmentsPromise = isAdminUser
                    ? supabaseAuth.from('assignment_students').select('student_id, status, assignments(id, title, due_date)')
                    : studentIds.length > 0
                        ? supabaseAuth.from('assignment_students').select('student_id, status, assignments(id, title, due_date)').in('student_id', studentIds)
                        : Promise.resolve({ data: [] as any });

                const spotlightsPromise = isAdminUser
                    ? supabaseAuth.from('student_curriculum_spotlights').select('student_id, lesson_id, spotlight_type, created_at').eq('spotlight_type', 'teacher')
                    : studentIds.length > 0
                        ? supabaseAuth.from('student_curriculum_spotlights').select('student_id, lesson_id, spotlight_type, created_at').eq('spotlight_type', 'teacher').in('student_id', studentIds)
                        : Promise.resolve({ data: [] as any });

                const [
                    { data: allAttendance },
                    { data: allProgress },
                    { data: allAssignments },
                    { data: allSpotlights }
                ] = await Promise.all([
                    attendancePromise,
                    progressPromise,
                    assignmentsPromise,
                    spotlightsPromise
                ]);

                if (rooms) setClassrooms(rooms);

                const teacherMap = new Map<string, string>();
                if (teachersData) {
                    setTeachers(teachersData);
                    teachersData.forEach(t => teacherMap.set(t.id, t.name));
                }

                const onlineUserIds = new Set<string>(activeSessions?.map(sess => sess.user_id) || []);

                const attendanceMap = new Map<string, string[]>();
                allAttendance?.forEach((a: any) => {
                    if (!attendanceMap.has(a.student_id)) {
                        attendanceMap.set(a.student_id, []);
                    }
                    attendanceMap.get(a.student_id)!.push(a.status);
                });

                const completedLessonsMap = new Map<string, Set<string>>();
                allProgress?.forEach((p: any) => {
                    if (!completedLessonsMap.has(p.student_id)) {
                        completedLessonsMap.set(p.student_id, new Set());
                    }
                    completedLessonsMap.get(p.student_id)!.add(p.lesson_id);
                });

                const todayIso = new Date().toISOString().slice(0, 10);
                const overdueTasksMap = new Map<string, number>();
                const assignmentsMap = new Map<string, any[]>();
                allAssignments?.forEach((a: any) => {
                    if (!assignmentsMap.has(a.student_id)) {
                        assignmentsMap.set(a.student_id, []);
                    }
                    assignmentsMap.get(a.student_id)!.push(a);

                    const asg = Array.isArray(a.assignments) ? a.assignments[0] : a.assignments;
                    const isPending = a.status === 'pending';
                    const isOverdue = isPending && asg?.due_date && asg.due_date < todayIso;
                    if (isOverdue) {
                        overdueTasksMap.set(a.student_id, (overdueTasksMap.get(a.student_id) || 0) + 1);
                    }
                });

                const pendingSpotlightsMap = new Map<string, number>();
                allSpotlights?.forEach((spot: any) => {
                    const completedSet = completedLessonsMap.get(spot.student_id);
                    const isCompleted = completedSet?.has(spot.lesson_id);
                    if (!isCompleted && spot.created_at) {
                        const daysOld = Math.floor((Date.now() - new Date(spot.created_at).getTime()) / (1000 * 60 * 60 * 24));
                        if (daysOld >= 7) {
                            pendingSpotlightsMap.set(spot.student_id, daysOld);
                        }
                    }
                });

                if (studentsError) {
                    console.error('Supabase error fetching students:', {
                        message: studentsError.message,
                        code: studentsError.code,
                        details: studentsError.details,
                        hint: studentsError.hint,
                        raw: studentsError
                    });
                }

                if (studentsData) {
                    const formatted: StudentData[] = studentsData.map((s: any) => {
                        const studentAttendance = attendanceMap.get(s.id) || [];

                        // 1. Calculate Attendance Percentage
                        let attendancePct = 100;
                        const eligibleAttendance = studentAttendance.filter((status: string) => status !== 'excused');
                        if (eligibleAttendance.length > 0) {
                            const presentCount = eligibleAttendance.filter((status: string) => status === 'present' || status === 'late').length;
                            attendancePct = Math.round((presentCount / eligibleAttendance.length) * 100);
                        }

                        const enrollments = s.classroom_students || [];
                        const permCs = enrollments.find((cs: any) => {
                            const r = Array.isArray(cs?.classrooms) ? cs?.classrooms[0] : cs?.classrooms;
                            return r && r.type !== 'learning_circle' && r.type !== 'temporary';
                        }) || enrollments[0];
                        const room = Array.isArray(permCs?.classrooms) ? permCs?.classrooms[0] : permCs?.classrooms;
                        const resolvedRoomName = room?.name || null;
                        const resolvedRoomId = permCs?.classroom_id || room?.id || null;

                        // 2. Evaluate KFA Needs Attention Rules (Active Students Only)
                        const attentionIssues: AttentionIssue[] = [];
                        if (s.status === 'active') {
                            // Priority 1: Batch Unassigned
                            if (!resolvedRoomName || resolvedRoomName === 'Unassigned' || resolvedRoomName.toLowerCase().includes('learning circle')) {
                                attentionIssues.push({
                                    type: 'unassigned_batch',
                                    label: 'Batch Unassigned',
                                    detail: 'Active student has no regular classroom batch allocated.'
                                });
                            }

                            // Priority 2: Low Attendance (minimum 3 eligible sessions)
                            if (eligibleAttendance.length >= 3 && attendancePct < 75) {
                                attentionIssues.push({
                                    type: 'low_attendance',
                                    label: `Low Attendance — ${attendancePct}%`,
                                    detail: `Attended only ${eligibleAttendance.filter((st: string) => st === 'present' || st === 'late').length} of ${eligibleAttendance.length} eligible classes.`
                                });
                            }

                            // Priority 3: Overdue Task
                            const overdueCount = overdueTasksMap.get(s.id) || 0;
                            if (overdueCount > 0) {
                                attentionIssues.push({
                                    type: 'overdue_tasks',
                                    label: overdueCount === 1 ? '1 Overdue Task' : `${overdueCount} Overdue Tasks`,
                                    detail: `${overdueCount} assigned task${overdueCount > 1 ? 's are' : ' is'} past the due date.`
                                });
                            }

                            // Priority 4: Spotlight Pending (Teacher spotlight active >= 7 days)
                            const spotlightDays = pendingSpotlightsMap.get(s.id);
                            if (spotlightDays !== undefined) {
                                attentionIssues.push({
                                    type: 'spotlight_pending',
                                    label: `Spotlight pending for ${spotlightDays} days`,
                                    detail: `Teacher recommended spotlight lesson has remained incomplete for ${spotlightDays} days.`
                                });
                            }
                        }

                        return {
                            id: s.id,
                            user_id: s.id,
                            name: s.name,
                            email: s.email,
                            role: s.role,
                            student_id_formatted: `KFA-2024-${s.id.slice(0, 3).toUpperCase()}`,
                            batch: resolvedRoomName || 'Unassigned',
                            classroom_id: resolvedRoomId,
                            classroom_name: resolvedRoomName,
                            attendance_pct: attendancePct,
                            profile_pic_url: s.profile_pic_url,
                            status: s.status === 'active' ? 'Active' : s.status === 'archived' ? 'Archived' : 'Inactive',
                            attention_issues: attentionIssues,
                            pacing_status: 'Consistent',
                            is_online: onlineUserIds.has(s.id),
                            created_at: s.created_at,
                            join_date: s.join_date,
                            level: s.level,
                            notes: s.notes,
                            fees_basis: s.fees_basis,
                            fees_amount: s.fees_amount,
                            fees_collection_date: s.fees_collection_date,
                            fees_classes_paid: s.fees_classes_paid,
                            teacher_id: s.teacher_id,
                            teacher_name: s.teacher_id ? (teacherMap.get(s.teacher_id) || 'Unknown Teacher') : 'Unassigned',
                            phone: s.phone || 'No Phone'
                        };
                    });

                    setStudents(formatted);

                    if (formatted.length > 0) {
                        const avg = Math.round(formatted.reduce((acc, curr) => acc + curr.attendance_pct, 0) / formatted.length);
                        
                        let studentsWithAssignments = 0;
                        let sumSubmissionPct = 0;
                        
                        formatted.forEach(f => {
                            const studentAssignments = assignmentsMap.get(f.id) || [];
                            if (studentAssignments.length > 0) {
                                const submittedCount = studentAssignments.filter(a => a.status === 'submitted' || a.status === 'reviewed' || a.status === 'approved').length;
                                const pct = Math.round((submittedCount / studentAssignments.length) * 100);
                                sumSubmissionPct += pct;
                                studentsWithAssignments++;
                            }
                        });
                        
                        const avgSubmissions = studentsWithAssignments > 0 
                            ? Math.round(sumSubmissionPct / studentsWithAssignments) 
                            : 76;
                            
                        setStats({
                            avgAttendance: avg,
                            submissionRate: avgSubmissions
                        });
                    }
                }

                // 5. Fetch Unassigned Students (Admins and Teachers)
                const { data: unassignedData, error: unassignedError } = await supabaseAuth
                    .from('users')
                    .select(`
                        id,
                        name,
                        email,
                        status,
                        profile_pic_url,
                        created_at,
                        teacher_id,
                        phone,
                        join_date,
                        level,
                        notes,
                        fees_basis,
                        fees_amount,
                        fees_collection_date,
                        fees_classes_paid
                    `)
                    .eq('role', 'student')
                    .is('teacher_id', null);

                if (unassignedError) {
                    console.error('Supabase error fetching unassigned students:', {
                        message: unassignedError.message,
                        code: unassignedError.code,
                        details: unassignedError.details,
                        hint: unassignedError.hint,
                        raw: unassignedError
                    });
                }

                if (unassignedData) {
                    const formattedUnassigned: StudentData[] = unassignedData.map((s: any) => {
                        const studentAttendance = attendanceMap.get(s.id) || [];

                        let attendancePct = 100;
                        const eligibleAttendance = studentAttendance.filter((status: string) => status !== 'excused');
                        if (eligibleAttendance.length > 0) {
                            const presentCount = eligibleAttendance.filter((status: string) => status === 'present' || status === 'late').length;
                            attendancePct = Math.round((presentCount / eligibleAttendance.length) * 100);
                        }

                        const attentionIssues: AttentionIssue[] = [];
                        if (s.status === 'active') {
                            attentionIssues.push({
                                type: 'unassigned_batch',
                                label: 'Batch Unassigned',
                                detail: 'Active student is not allocated to any classroom batch.'
                            });
                            if (eligibleAttendance.length >= 3 && attendancePct < 75) {
                                attentionIssues.push({
                                    type: 'low_attendance',
                                    label: `Low Attendance — ${attendancePct}%`,
                                    detail: `Attended only ${eligibleAttendance.filter((st: string) => st === 'present' || st === 'late').length} of ${eligibleAttendance.length} eligible classes.`
                                });
                            }
                        }

                        return {
                            id: s.id,
                            user_id: s.id,
                            name: s.name,
                            email: s.email,
                            role: s.role || 'student',
                            student_id_formatted: `KFA-2024-${s.id.slice(0, 3).toUpperCase()}`,
                            batch: 'Unassigned',
                            attendance_pct: attendancePct,
                            profile_pic_url: s.profile_pic_url,
                            status: s.status === 'active' ? 'Active' : s.status === 'archived' ? 'Archived' : 'Inactive',
                            attention_issues: attentionIssues,
                            pacing_status: 'Consistent' as const,
                            is_online: onlineUserIds.has(s.id),
                            created_at: s.created_at,
                            join_date: s.join_date,
                            level: s.level,
                            learning_mode: s.learning_mode,
                            notes: s.notes,
                            fees_basis: s.fees_basis,
                            fees_amount: s.fees_amount,
                            fees_collection_date: s.fees_collection_date,
                            fees_classes_paid: s.fees_classes_paid,
                            teacher_id: s.teacher_id,
                            teacher_name: 'Unassigned',
                            phone: s.phone || 'No Phone'
                        };
                    });
                    setUnassignedStudents(formattedUnassigned);
                }

                // 6. Fetch pending signup requests (role = 'pending')
                const { data: pendingData } = await supabaseAuth
                    .from('users')
                    .select('id, name, email, phone, created_at')
                    .eq('role', 'pending')
                    .order('created_at', { ascending: false });

                if (isMounted && pendingData) setPendingUsers(pendingData);

            } catch (err) {
                console.error('Error fetching students:', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        let isMounted = true;
        let unassignedChannel: any = null;
        let pendingChannel: any = null;
        let sessionsChannel: any = null;

        checkAuthAndFetchData();

        // Real-time subscription to listen for new student signups instantly!
        unassignedChannel = supabaseAuth
            .channel('realtime-unassigned-students')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'users' },
                (payload) => {
                    if (!isMounted) return;
                    const newStudent = payload.new;
                    if (newStudent && newStudent.role === 'student' && !newStudent.teacher_id) {
                        setUnassignedStudents(prev => [{
                            id: newStudent.id,
                            user_id: newStudent.id,
                            name: newStudent.name,
                            student_id_formatted: `KFA-2024-${newStudent.id.slice(0, 3).toUpperCase()}`,
                            batch: 'Unassigned',
                            attendance_pct: 0,
                            profile_pic_url: newStudent.profile_pic_url,
                            status: newStudent.status === 'active' ? 'Active' : newStudent.status === 'archived' ? 'Archived' : 'Inactive',
                            created_at: newStudent.created_at || new Date().toISOString(),
                            phone: newStudent.phone || 'No Phone'
                        }, ...prev]);
                    }
                }
            )
            .subscribe();

        // Real-time: new pending signup requests
        pendingChannel = supabaseAuth
            .channel('realtime-pending-users')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'users' },
                (payload) => {
                    if (!isMounted) return;
                    const u = payload.new as any;
                    if (payload.eventType === 'INSERT' && u?.role === 'pending') {
                        setPendingUsers(prev => [{ id: u.id, name: u.name, email: u.email, phone: u.phone, created_at: u.created_at || new Date().toISOString() }, ...prev]);
                    } else if (payload.eventType === 'UPDATE' && u?.role !== 'pending') {
                        // Remove from list once admin assigns a role
                        setPendingUsers(prev => prev.filter(p => p.id !== u.id));
                    }
                }
            )
            .subscribe();

        // Subscribe to user session changes (online/offline updates)
        sessionsChannel = supabaseAuth
            .channel('realtime-sessions-students-directory')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'user_sessions' },
                () => {
                    if (isMounted) {
                        reEvaluateOnlineStatus();
                    }
                }
            )
            .subscribe();

        // Refresh online statuses in real-time every 30 seconds
        const onlineCheckerTimer = setInterval(() => {
            if (isMounted) {
                reEvaluateOnlineStatus();
            }
        }, 30000);

        return () => {
            isMounted = false;
            if (unassignedChannel) {
                supabaseAuth.removeChannel(unassignedChannel);
            }
            if (pendingChannel) {
                supabaseAuth.removeChannel(pendingChannel);
            }
            if (sessionsChannel) {
                supabaseAuth.removeChannel(sessionsChannel);
            }
            clearInterval(onlineCheckerTimer);
        };
    }, [router]);

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    const claimStudent = async () => {
        if (!teacherProfile || !showClaimModal || !claimBatchId) {
            alert('Please select a batch.');
            return;
        }
        
        setClaimingId(showClaimModal.id);
        try {
            const isAdmin = teacherProfile.role === 'admin';
            const assignedTeacherId = isAdmin ? claimTeacherId : teacherProfile.id;

            if (isAdmin && !assignedTeacherId) {
                alert('Please select a teacher.');
                setClaimingId(null);
                return;
            }

            // 1. Update teacher_id
            const { error: userError } = await supabaseAuth
                .from('users')
                .update({ teacher_id: assignedTeacherId })
                .eq('id', showClaimModal.id);

            if (userError) throw userError;

            // 2. Add to classroom_students
            const { error: classError } = await supabaseAuth
                .from('classroom_students')
                .insert([{
                    classroom_id: claimBatchId,
                    student_id: showClaimModal.id,
                    joined_at: new Date().toISOString(),
                }]);
                
            if (classError) throw classError;

            const selectedClassroom = classrooms.find(c => c.id === claimBatchId);
            const batchName = selectedClassroom?.name || 'Assigned';

            // Find the claimed student from the unassigned list
            const claimed = unassignedStudents.find(s => s.id === showClaimModal.id);
            if (claimed) {
                const assignedTeacherName = teachers.find(t => t.id === assignedTeacherId)?.name || 'Unknown Teacher';
                // Add to assigned students and remove from unassigned students
                setStudents(prev => [...prev, { 
                    ...claimed, 
                    batch: batchName,
                    teacher_id: assignedTeacherId,
                    teacher_name: assignedTeacherName
                }]);
                setUnassignedStudents(prev => prev.filter(s => s.id !== showClaimModal.id));
            }
            
            setShowClaimModal(null);
            setClaimBatchId('');
            setClaimTeacherId('');
        } catch (err) {
            console.error('Error claiming student:', err);
            alert('Failed to assign student. Please try again.');
        } finally {
            setClaimingId(null);
        }
    };

    const [showReactivateModal, setShowReactivateModal] = useState<StudentData | null>(null);
    const [reactivateBatchId, setReactivateBatchId] = useState('');
    const [isReactivating, setIsReactivating] = useState(false);

    const [pauseStudentTarget, setPauseStudentTarget] = useState<StudentData | null>(null);
    const [resumeStudentTarget, setResumeStudentTarget] = useState<StudentData | null>(null);

    const handlePauseStudent = (student: StudentData) => {
        setPauseStudentTarget(student);
    };

    const handleResumeStudent = (student: StudentData) => {
        setResumeStudentTarget(student);
    };

    const handleArchiveStudent = async (student: StudentData) => {
        if (!confirm(`Archive ${student.name}? They will be marked as a former student with preserved history.`)) {
            return;
        }

        // Optimistic update
        setStudents(prev => prev.map(s => s.id === student.id ? { ...s, status: 'Archived' } : s));

        try {
            const { error: userError } = await supabaseAuth
                .from('users')
                .update({ status: 'archived' })
                .eq('id', student.id);

            if (userError) throw userError;
        } catch (err: any) {
            console.error('Error archiving student:', err);
            alert(`Error archiving student: ${err.message || err.details || String(err)}`);
            // Revert on error
            setStudents(prev => prev.map(s => s.id === student.id ? { ...s, status: student.status } : s));
        }
    };

    const handleOpenReactivateModal = (student: StudentData) => {
        const defaultRoom = classrooms.find(c => !c.name.toLowerCase().includes('learning circle'))?.id || classrooms[0]?.id || '';
        setReactivateBatchId(defaultRoom);
        setShowReactivateModal(student);
    };

    const confirmReactivateStudent = async () => {
        if (!showReactivateModal || !reactivateBatchId) return;
        if (showReactivateModal.status !== 'Archived') return;

        setIsReactivating(true);
        try {
            const targetStudentId = showReactivateModal.id;

            const { error: userErr } = await supabaseAuth
                .from('users')
                .update({ status: 'active' })
                .eq('id', targetStudentId);

            if (userErr) throw userErr;

            await supabaseAuth
                .from('classroom_students')
                .delete()
                .eq('student_id', targetStudentId);

            const { error: roomErr } = await supabaseAuth
                .from('classroom_students')
                .insert([{
                    classroom_id: reactivateBatchId,
                    student_id: targetStudentId,
                    joined_at: new Date().toISOString()
                }]);

            if (roomErr) console.error('Error assigning classroom during reactivation:', roomErr);

            const roomName = classrooms.find(c => c.id === reactivateBatchId)?.name || 'Active Batch';

            setStudents(prev => prev.map(s => s.id === targetStudentId ? { ...s, status: 'Active', batch: roomName } : s));

            const studentName = showReactivateModal.name;
            const isReEnroll = showReactivateModal.status === 'Archived';
            setShowReactivateModal(null);
            setReactivateBatchId('');
            alert(`Student ${studentName} successfully ${isReEnroll ? 're-enrolled' : 'resumed'} and allocated to ${roomName}!`);
        } catch (err: any) {
            console.error('Error reactivating student:', err);
            alert(`Error reactivating student: ${err.message || err.details || String(err)}`);
        } finally {
            setIsReactivating(false);
        }
    };

    // ─── Single Delete ────────────────────────────────────────────────────────
    const confirmDelete = async () => {
        if (!studentToDelete) return;

        setIsDeleting(true);
        try {
            // 1. Fetch full details for the recycle bin
            const { data: fullStudent, error: fetchErr } = await supabaseAuth
                .from('users')
                .select('*')
                .eq('id', studentToDelete.id)
                .single();

            if (fetchErr) {
                console.error("Error fetching student details for recycle bin:", fetchErr);
                alert("Failed to archive student in Recycle Bin. Aborting deletion.");
                setIsDeleting(false);
                return;
            }

            // 2. Delete from database
            const { error } = await supabaseAuth
                .from('users')
                .delete()
                .eq('id', studentToDelete.id);

            if (error) {
                console.error("Supabase deletion error:", error);
                alert("Failed to delete student. Please try again.");
                return;
            }

            // 3. Put into Recycle Bin local storage
            const newBinItem: DeletedStudentItem = {
                id: studentToDelete.id,
                name: studentToDelete.name,
                deletedAt: new Date().toISOString(),
                student: fullStudent
            };
            saveRecycleBin([newBinItem, ...recycleBin]);

            setStudents(prev => prev.filter(s => s.id !== studentToDelete.id));
            setStudentToDelete(null);
        } catch (err: any) {
            console.error('Error deleting student:', err);
            alert("An unexpected error occurred while deleting the student.");
        } finally {
            setIsDeleting(false);
        }
    };

    // ─── Bulk Selection ───────────────────────────────────────────────────────
    const toggleSelectStudent = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === paginatedStudents.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(paginatedStudents.map(s => s.id)));
        }
    };

    // ─── Bulk Delete ──────────────────────────────────────────────────────────
    const confirmBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        setIsBulkDeleting(true);
        try {
            const ids = Array.from(selectedIds);

            // 1. Fetch full details for the recycle bin
            const { data: fullStudents, error: fetchErr } = await supabaseAuth
                .from('users')
                .select('*')
                .in('id', ids);

            if (fetchErr || !fullStudents || fullStudents.length === 0) {
                console.error("Error fetching students details for recycle bin:", fetchErr);
                alert("Failed to archive students in Recycle Bin. Aborting deletion.");
                setIsBulkDeleting(false);
                return;
            }

            // 2. Delete from database
            const { error } = await supabaseAuth
                .from('users')
                .delete()
                .in('id', ids);

            if (error) {
                console.error("Bulk deletion error:", error);
                alert("Failed to delete selected students. Please try again.");
                return;
            }

            // 3. Put into Recycle Bin local storage
            const newBinItems: DeletedStudentItem[] = fullStudents.map(student => ({
                id: student.id,
                name: student.name,
                deletedAt: new Date().toISOString(),
                student: student
            }));
            saveRecycleBin([...newBinItems, ...recycleBin]);

            setStudents(prev => prev.filter(s => !selectedIds.has(s.id)));
            setSelectedIds(new Set());
            setShowBulkDeleteModal(false);
        } catch (err: any) {
            console.error('Error bulk deleting students:', err);
            alert("An unexpected error occurred during bulk deletion.");
        } finally {
            setIsBulkDeleting(false);
        }
    };

    const handleRestoreStudent = async (item: DeletedStudentItem) => {
        try {
            const { error } = await supabaseAuth
                .from('users')
                .insert([item.student]);

            if (error) {
                console.error("Supabase restore error:", error);
                alert(`Failed to restore student: ${error.message}`);
                return;
            }

            const updatedBin = recycleBin.filter(b => b.id !== item.id);
            saveRecycleBin(updatedBin);

            const restoredData: StudentData = {
                id: item.student.id,
                user_id: item.student.id,
                name: item.student.name,
                student_id_formatted: 'KFA-' + item.student.student_serial_id.toString().padStart(4, '0'),
                batch: 'Unassigned',
                attendance_pct: 100,
                pacing_status: 'Consistent',
                is_online: false,
                profile_pic_url: item.student.profile_pic_url || '',
                teacher_name: '',
                phone: item.student.phone || '',
                status: item.student.status || 'active'
            };
            setStudents(prev => [restoredData, ...prev]);

            alert(`Student "${item.name}" restored successfully!`);
        } catch (err: any) {
            console.error('Error restoring student:', err);
            alert("An unexpected error occurred while restoring the student.");
        }
    };

    const handlePermanentDeleteStudent = (itemId: string) => {
        if (!window.confirm("Are you sure you want to permanently delete this student from the Recycle Bin? This action is permanent and cannot be undone.")) return;
        const updatedBin = recycleBin.filter(b => b.id !== itemId);
        saveRecycleBin(updatedBin);
    };

    const handleClearRecycleBin = () => {
        if (!window.confirm("Are you sure you want to empty the Recycle Bin? All deleted students will be permanently lost.")) return;
        saveRecycleBin([]);
    };

    // ─── Download CSV Template ────────────────────────────────────────────────
    const downloadCsvTemplate = () => {
        const headers = 'Name,Email,Phone\n';
        const sampleData = 'Aarav Patel,aarav@email.com,+91 98001 00001\nRiya Sharma,riya@email.com,\nAnkit Verma,ankit@email.com,+91 98001 00003\n';
        const blob = new Blob([headers + sampleData], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'kfa_students_bulk_enroll_template.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // ─── Bulk Enroll: CSV Parse ───────────────────────────────────────────────
    const parseBulkCsv = () => {
        const lines = bulkCsvText.trim().split('\n').filter(l => l.trim() !== '');
        if (lines.length === 0) return;

        // Detect if first line is a header
        const firstLineLower = lines[0].toLowerCase();
        const hasHeader = firstLineLower.includes('name') || firstLineLower.includes('email');
        const dataLines = hasHeader ? lines.slice(1) : lines;

        const parsed: BulkEnrollRow[] = dataLines.map(line => {
            // Support comma or tab separated
            const cols = line.split(/,|\t/).map(c => c.trim().replace(/^"|"$/g, ''));
            const name = cols[0] || '';
            const email = cols[1] || '';
            const phone = cols[2] || '';
            let error: string | undefined;
            if (!name) error = 'Name is required';
            else if (!email || !email.includes('@')) error = 'Valid email is required';
            return {
                name,
                email,
                phone,
                level: bulkEnrollLevel,
                batchId: bulkEnrollBatch,
                error,
            };
        });

        setBulkRows(parsed);
        setBulkEnrollStep('review');
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            setBulkCsvText(ev.target?.result as string ?? '');
        };
        reader.readAsText(file);
    };

    const updateBulkRow = (idx: number, field: keyof BulkEnrollRow, value: string) => {
        setBulkRows(prev => prev.map((r, i) => {
            if (i !== idx) return r;
            const updated = { ...r, [field]: value };
            // Re-validate
            if (!updated.name) updated.error = 'Name is required';
            else if (!updated.email || !updated.email.includes('@')) updated.error = 'Valid email is required';
            else updated.error = undefined;
            return updated;
        }));
    };

    const removeBulkRow = (idx: number) => {
        setBulkRows(prev => prev.filter((_, i) => i !== idx));
    };

    // ─── Bulk Enroll Submit ───────────────────────────────────────────────────
    const submitBulkEnroll = async () => {
        if (!teacherProfile) return;
        const validRows = bulkRows.filter(r => !r.error);
        if (validRows.length === 0) return;

        setIsBulkEnrolling(true);
        let success = 0;
        let failed = 0;

        for (const row of validRows) {
            try {
                const { data: userData, error: userError } = await supabaseAuth
                    .from('users')
                    .insert([{
                        name: row.name,
                        email: row.email,
                        phone: row.phone,
                        role: 'student',
                        status: 'active',
                        teacher_id: teacherProfile.id,
                        join_date: new Date().toISOString().split('T')[0],
                        level: row.level || bulkEnrollLevel,
                    }])
                    .select()
                    .single();

                if (userError) throw userError;

                // Link to classroom if batch selected
                const batchId = row.batchId || bulkEnrollBatch;
                if (batchId && userData) {
                    await supabaseAuth
                        .from('classroom_students')
                        .insert([{
                            classroom_id: batchId,
                            student_id: userData.id,
                            joined_at: new Date().toISOString(),
                        }]);
                }
                success++;
            } catch (err) {
                console.error('Error enrolling student:', row.name, err);
                failed++;
            }
        }

        setBulkEnrollResult({ success, failed });
        setIsBulkEnrolling(false);
        setBulkEnrollStep('done');

        // Refresh student list
        if (success > 0) {
            router.refresh();
            // Re-fetch students
            const userId = teacherProfile.id;
            const { data: studentsData } = await supabaseAuth
                .from('users')
                .select(`id, name, status, profile_pic_url, created_at, classroom_students(classrooms(name, type))`)
                .eq('role', 'student')
                .eq('teacher_id', userId);

            if (studentsData) {
                const formatted: StudentData[] = studentsData.map((s: any) => {
                    const enrs = s.classroom_students || [];
                    const permRoom = enrs.find((cs: any) => {
                        const r = Array.isArray(cs.classrooms) ? cs.classrooms[0] : cs.classrooms;
                        return r && r.type !== 'learning_circle' && r.type !== 'temporary';
                    }) || enrs[0];
                    const roomObj = Array.isArray(permRoom?.classrooms) ? permRoom?.classrooms[0] : permRoom?.classrooms;

                    return {
                        id: s.id,
                        user_id: s.id,
                        name: s.name,
                        student_id_formatted: `KFA-2024-${s.id.slice(0, 3).toUpperCase()}`,
                        batch: roomObj?.name || 'Unassigned',
                        attendance_pct: Math.floor(Math.random() * 20) + 70,
                        profile_pic_url: s.profile_pic_url,
                        status: s.status === 'active' ? 'Active' : 'Inactive',
                        created_at: s.created_at,
                    };
                });
                setStudents(formatted);
                if (formatted.length > 0) {
                    const avg = Math.round(formatted.reduce((acc, curr) => acc + curr.attendance_pct, 0) / formatted.length);
                    setStats(prev => ({ ...prev, avgAttendance: avg }));
                }
            }
        }
    };

    const closeBulkEnrollModal = () => {
        setShowBulkEnrollModal(false);
        setBulkEnrollStep('input');
        setBulkCsvText('');
        setBulkRows([]);
        setBulkEnrollBatch('');
        setBulkEnrollLevel('beginner');
        setBulkEnrollResult({ success: 0, failed: 0 });
    };

    const availableBatches = Array.from(new Set(students.map(s => s.batch).filter(b => b !== 'Unassigned'))).sort();

    const getStudentAttentionIssues = React.useCallback((student: StudentData): AttentionIssue[] => {
        if (student.status !== 'Active') return [];
        return student.attention_issues || [];
    }, []);

    const allUnassignedStudents = React.useMemo(() => {
        const map = new Map<string, StudentData>();
        
        unassignedStudents.forEach(s => {
            map.set(s.id, s);
        });

        students.forEach(s => {
            if (!s.teacher_id || s.teacher_name === 'Unassigned' || s.batch === 'Unassigned') {
                map.set(s.id, s);
            }
        });
        
        return Array.from(map.values());
    }, [students, unassignedStudents]);

    const summaryCounts = React.useMemo(() => {
        let active = 0;
        let paused = 0;
        let archived = 0;
        students.forEach(s => {
            const st = (s.status || '').toLowerCase();
            if (st === 'active') active++;
            else if (st === 'inactive') paused++;
            else if (st === 'archived') archived++;
        });
        return {
            total: students.length,
            active,
            paused,
            archived,
            unassigned: allUnassignedStudents.length
        };
    }, [students, allUnassignedStudents]);

    const displayedStudents = React.useMemo(() => {
        let result = filterMode === 'unassigned' ? [...allUnassignedStudents] : [...students];

        if (filterMode !== 'unassigned') {
            if (selectedBatch !== 'All Batches') {
                result = result.filter(s => s.batch === selectedBatch);
            }

            if (statusFilter !== 'all') {
                result = result.filter(s => s.status.toLowerCase() === statusFilter.toLowerCase());
            }

            if (attentionFilter === 'needs_attention') {
                result = result.filter(s => getStudentAttentionIssues(s).length > 0);
            } else if (attentionFilter === 'no_attention') {
                result = result.filter(s => s.status === 'Active' && getStudentAttentionIssues(s).length === 0);
            }
        }

        if (filterMode === 'recent' || filterMode === 'unassigned') {
            result = result.sort((a, b) => {
                const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                return dateB - dateA; // Descending
            });
        } else {
            // all students - sort alphabetically
            result = result.sort((a, b) => a.name.localeCompare(b.name));
        }

        if (searchQuery.trim() !== '') {
            const lowerQuery = searchQuery.toLowerCase();
            const matchesSearch = (s: StudentData) => 
                s.name.toLowerCase().includes(lowerQuery) || 
                s.student_id_formatted.toLowerCase().includes(lowerQuery) ||
                (s.email && s.email.toLowerCase().includes(lowerQuery)) ||
                (s.phone && s.phone.toLowerCase().includes(lowerQuery)) ||
                (s.batch && s.batch.toLowerCase().includes(lowerQuery)) ||
                (s.teacher_name && s.teacher_name.toLowerCase().includes(lowerQuery));

            const filteredTabResult = result.filter(matchesSearch);

            // If searching on Unassigned/Recent tab yields 0 matches, search across ALL students so assigned students aren't hidden
            if (filteredTabResult.length === 0) {
                return students.filter(matchesSearch);
            }

            return filteredTabResult;
        }

        return result;
    }, [students, allUnassignedStudents, filterMode, selectedBatch, statusFilter, attentionFilter, searchQuery, getStudentAttentionIssues]);

    const totalPages = Math.ceil(displayedStudents.length / ITEMS_PER_PAGE);
    const paginatedStudents = displayedStudents.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const allPageSelected = paginatedStudents.length > 0 && paginatedStudents.every(s => selectedIds.has(s.id));
    const somePageSelected = paginatedStudents.some(s => selectedIds.has(s.id));

    const handleExportCSV = () => {
        const headers = [
            'Student Name',
            'Student ID',
            'Email',
            'Phone',
            'Role',
            'Batch Class',
            'Assigned Teacher',
            'Attendance (%)',
            'Pacing Status',
            'Account Status',
            'Experience Level',
            'Class Learning Mode',
            'Billing Plan',
            'Fees Amount (INR)',
            'Prepaid Classes Left',
            'Due Day of Month',
            'Joining Date',
            'Portal Online Status',
            'Notes',
            'Registration Date'
        ];
        
        const escapeCSV = (val: any) => {
            if (val === null || val === undefined || val === '') return '""';
            const str = String(val).replace(/"/g, '""');
            return `"${str}"`;
        };

        const csvRows = displayedStudents.map(student => [
            escapeCSV(student.name),
            escapeCSV(student.student_id_formatted),
            escapeCSV(student.email || 'N/A'),
            escapeCSV(student.phone || 'N/A'),
            escapeCSV(student.role || 'student'),
            escapeCSV(student.batch),
            escapeCSV(student.teacher_name || 'Unassigned'),
            student.attendance_pct,
            escapeCSV(student.pacing_status || 'Consistent'),
            escapeCSV(student.status),
            escapeCSV(student.level || 'N/A'),
            escapeCSV(student.learning_mode === 'offline' ? 'Offline (In-Person)' : 'Online Class'),
            escapeCSV(student.fees_basis ? (student.fees_basis === 'monthly' ? 'Monthly Subscription' : 'Class-basis') : 'N/A'),
            student.fees_amount !== null && student.fees_amount !== undefined ? student.fees_amount : 'N/A',
            student.fees_classes_paid !== null && student.fees_classes_paid !== undefined ? student.fees_classes_paid : 'N/A',
            student.fees_collection_date ? `${student.fees_collection_date}th` : 'N/A',
            escapeCSV(student.join_date || 'N/A'),
            escapeCSV(student.is_online ? 'Active' : 'Offline'),
            escapeCSV(student.notes || ''),
            escapeCSV(student.created_at ? new Date(student.created_at).toLocaleDateString() : 'N/A')
        ]);

        const csvContent = [
            headers.join(','),
            ...csvRows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `students_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8f8f6] dark:bg-[#221d10]">
                <Loader2 className="w-10 h-10 animate-spin text-[#ecb613] mb-4" />
                <p className="font-medium text-slate-600 dark:text-slate-400">Loading directory...</p>
            </div>
        );
    }

    return (
        <div className="bg-[#f8f8f6] dark:bg-[#221d10] text-slate-900 dark:text-slate-100 font-sans min-h-screen font-sans">
            {/* ─── Single Delete Confirmation Modal ───────────────────────────────── */}
            {studentToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-rose-600 dark:text-rose-400 text-2xl">delete_forever</span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Delete Student?</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">
                                Are you sure you want to delete <span className="font-bold text-slate-700 dark:text-slate-300">{studentToDelete.name}</span>? This will move them to the Recycle Bin, from which they can be restored later.
                            </p>
                        </div>
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                            <button 
                                onClick={() => setStudentToDelete(null)}
                                disabled={isDeleting}
                                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">
                                Cancel
                            </button>
                            <button 
                                onClick={confirmDelete}
                                disabled={isDeleting}
                                className="px-4 py-2 rounded-lg text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2">
                                {isDeleting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <span className="material-symbols-outlined text-lg">delete</span>
                                )}
                                {isDeleting ? 'Deleting...' : 'Delete Student'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Bulk Delete Confirmation Modal ─────────────────────────────────── */}
            {showBulkDeleteModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-rose-600 dark:text-rose-400 text-2xl">group_remove</span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Bulk Delete {selectedIds.size} Student{selectedIds.size !== 1 ? 's' : ''}?</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">
                                This will move <span className="font-bold text-rose-600">{selectedIds.size} student{selectedIds.size !== 1 ? 's' : ''}</span> to the Recycle Bin. You will be able to restore them later if needed.
                            </p>
                        </div>
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                            <button 
                                onClick={() => setShowBulkDeleteModal(false)}
                                disabled={isBulkDeleting}
                                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">
                                Cancel
                            </button>
                            <button 
                                onClick={confirmBulkDelete}
                                disabled={isBulkDeleting}
                                className="px-4 py-2 rounded-lg text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2">
                                {isBulkDeleting ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</>
                                ) : (
                                    <><span className="material-symbols-outlined text-lg">delete_sweep</span>Delete {selectedIds.size} Student{selectedIds.size !== 1 ? 's' : ''}</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Add Guidance / Mentor Note Modal ─────────────────────────────────────── */}
            {showGuidanceModal && (
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setShowGuidanceModal(false)}
                >
                    <div 
                        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 text-left max-h-[90vh] flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                                    <Lightbulb className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                                        {guidanceTargetStudents.length > 1
                                            ? `Add Guidance (${guidanceTargetStudents.length} Students)`
                                            : `Add Guidance: ${guidanceTargetStudents[0]?.name || 'Student'}`
                                        }
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Personalized tip or practice focus that displays on the student dashboard.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowGuidanceModal(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSaveGuidance} className="p-5 space-y-4 overflow-y-auto flex-1 text-left">
                            {guidanceErrorMsg && (
                                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-600 text-xs font-semibold">
                                    {guidanceErrorMsg}
                                </div>
                            )}

                            {guidanceSuccessMsg && (
                                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 text-emerald-600 text-xs font-semibold flex items-center gap-2">
                                    <Check className="w-4 h-4" />
                                    <span>{guidanceSuccessMsg}</span>
                                </div>
                            )}

                            {/* Quick Shortcut Templates */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Quick Tip Templates
                                </label>
                                <div className="flex flex-wrap gap-1.5">
                                    {GUIDANCE_TEMPLATES.map((tpl) => (
                                        <button
                                            key={tpl.name}
                                            type="button"
                                            onClick={() => {
                                                setGuidanceType(tpl.type as any);
                                                setGuidanceTitle(tpl.title);
                                                setGuidanceText(tpl.text);
                                            }}
                                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 hover:text-amber-900 dark:hover:bg-amber-950/50 dark:hover:text-amber-300 text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
                                        >
                                            {tpl.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Note Type *
                                    </label>
                                    <select
                                        value={guidanceType}
                                        onChange={(e) => setGuidanceType(e.target.value as any)}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#ecb613] outline-none text-slate-800 dark:text-white"
                                    >
                                        <option value="focus">Focus Point</option>
                                        <option value="practice">Practice Riyaz</option>
                                        <option value="improvement">Area of Improvement</option>
                                        <option value="strength">Strength & Appreciation</option>
                                        <option value="general">General Guidance</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Title
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Focus this week"
                                        value={guidanceTitle}
                                        onChange={(e) => setGuidanceTitle(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#ecb613] outline-none text-slate-800 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Guidance / Tip *
                                    </label>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                        {guidanceText.length}/500
                                    </span>
                                </div>
                                <textarea
                                    rows={4}
                                    required
                                    maxLength={500}
                                    placeholder="Write practice instructions, posture tips, or breath control advice..."
                                    value={guidanceText}
                                    onChange={(e) => setGuidanceText(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#ecb613] outline-none text-slate-800 dark:text-white leading-relaxed"
                                />
                            </div>

                            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={guidanceIsActive}
                                    onChange={(e) => setGuidanceIsActive(e.target.checked)}
                                    className="rounded text-[#ecb613] focus:ring-[#ecb613] w-4 h-4 cursor-pointer"
                                />
                                <span>Set as Current Active Guidance (Featured on student dashboard)</span>
                            </label>

                            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowGuidanceModal(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingGuidance}
                                    className="px-5 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                                >
                                    {isSavingGuidance ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Saving Note...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4" />
                                            <span>Apply Guidance</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── Recycle Bin Modal ──────────────────────────────────────────────── */}
            {showRecycleBin && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[#ecb613] text-2xl">delete_sweep</span>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Student Recycle Bin</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                {recycleBin.length > 0 && (
                                    <button
                                        onClick={handleClearRecycleBin}
                                        className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-450 dark:hover:bg-rose-900/30 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                    >
                                        <span className="material-symbols-outlined text-sm">delete_forever</span>
                                        Empty Bin
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowRecycleBin(false)}
                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-650 transition-colors"
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                        </div>
                        <div className="p-6 max-h-[400px] overflow-y-auto space-y-3">
                            {recycleBin.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                    <span className="material-symbols-outlined text-5xl mb-2 text-slate-300 dark:text-slate-700">delete_outline</span>
                                    <p className="text-sm font-semibold">Your recycle bin is empty.</p>
                                    <p className="text-xs text-slate-400 mt-1">Deleted students will show up here to be restored if needed.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {recycleBin.map((item) => (
                                        <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                                            <div className="min-w-0">
                                                <p className="font-bold text-slate-900 dark:text-white truncate">{item.name}</p>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    Joined: {item.student.join_date || 'N/A'} • Deleted: {new Date(item.deletedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleRestoreStudent(item)}
                                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                                                    title="Restore Student"
                                                >
                                                    <span className="material-symbols-outlined text-sm">settings_backup_restore</span>
                                                    Restore
                                                </button>
                                                <button
                                                    onClick={() => handlePermanentDeleteStudent(item.id)}
                                                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                                                    title="Delete Permanently"
                                                >
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex justify-end border-t border-slate-100 dark:border-slate-800">
                            <button
                                onClick={() => setShowRecycleBin(false)}
                                className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Claim & Assign Student Modal ─────────────────────────────────────── */}
            {showClaimModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-2xl">person_add</span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Claim Student</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                                You are about to approve <span className="font-bold text-slate-700 dark:text-slate-300">{showClaimModal.name}</span>. Please assign them to a batch so their student dashboard can unlock.
                            </p>
                            
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Select Batch</label>
                                <select
                                    value={claimBatchId}
                                    onChange={e => {
                                        const newBatchId = e.target.value;
                                        setClaimBatchId(newBatchId);
                                        if (teacherProfile?.role === 'admin') {
                                            const room = classrooms.find(c => c.id === newBatchId);
                                            if (room?.teacher_id) {
                                                setClaimTeacherId(room.teacher_id);
                                            }
                                        }
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none"
                                >
                                    <option value="" disabled>Choose a batch...</option>
                                    {sortClassroomsByDayAndTime(classrooms).map(room => (
                                        <option key={room.id} value={room.id}>{room.name}</option>
                                    ))}
                                </select>
                            </div>

                            {teacherProfile?.role === 'admin' && (
                                <div className="space-y-2 mt-4">
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Select Teacher</label>
                                    <select
                                        value={claimTeacherId}
                                        onChange={e => setClaimTeacherId(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none"
                                    >
                                        <option value="" disabled>Choose a teacher...</option>
                                        {teachers.map(teacher => (
                                            <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                            <button 
                                onClick={() => { setShowClaimModal(null); setClaimBatchId(''); }}
                                disabled={claimingId === showClaimModal.id}
                                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">
                                Cancel
                            </button>
                            <button 
                                onClick={claimStudent}
                                disabled={claimingId === showClaimModal.id || !claimBatchId || (teacherProfile?.role === 'admin' && !claimTeacherId)}
                                className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2">
                                {claimingId === showClaimModal.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <span className="material-symbols-outlined text-lg">check_circle</span>
                                )}
                                {claimingId === showClaimModal.id ? 'Approving...' : 'Approve & Assign'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Reactivate Student Modal ─────────────────────────────────────── */}
            {showReactivateModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-2xl">unarchive</span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                                Re-enroll Student
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                                You are re-enrolling <span className="font-bold text-slate-700 dark:text-slate-300">{showReactivateModal.name}</span>. Please select which classroom batch to allocate them to:
                            </p>
                            
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Target Classroom Batch</label>
                                <select
                                    value={reactivateBatchId}
                                    onChange={e => setReactivateBatchId(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none font-bold"
                                >
                                    <option value="" disabled>Select classroom batch...</option>
                                    {classrooms
                                        .filter(room => !room.name.toLowerCase().includes('learning circle'))
                                        .map(room => (
                                            <option key={room.id} value={room.id}>{room.name}</option>
                                        ))}
                                </select>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                            <button 
                                onClick={() => { setShowReactivateModal(null); setReactivateBatchId(''); }}
                                disabled={isReactivating}
                                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">
                                Cancel
                            </button>
                            <button 
                                onClick={confirmReactivateStudent}
                                disabled={isReactivating || !reactivateBatchId}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-md disabled:opacity-50 flex items-center gap-2">
                                {isReactivating ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <span className="material-symbols-outlined text-lg">unarchive</span>
                                )}
                                {isReactivating ? 'Re-enrolling...' : 'Re-enroll & Allocate'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Bulk Enroll Modal ───────────────────────────────────────────────── */}
            {showBulkEnrollModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        
                        {/* Modal Header */}
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[#ecb613]/10 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[#ecb613]">assignment_ind</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Bulk Enroll Students</h3>
                                    <p className="text-xs text-slate-500">Import multiple students at once via CSV or manual entry</p>
                                </div>
                            </div>
                            <button onClick={closeBulkEnrollModal} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Step indicator */}
                        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-shrink-0">
                            {(['input', 'review', 'done'] as const).map((step, idx) => (
                                <React.Fragment key={step}>
                                    <div className={`flex items-center gap-1.5 text-xs font-bold ${bulkEnrollStep === step ? 'text-[#ecb613]' : ((['input', 'review', 'done'].indexOf(bulkEnrollStep) > idx) ? 'text-green-600' : 'text-slate-400')}`}>
                                        <span className={`size-5 rounded-full flex items-center justify-center text-[10px] font-black ${bulkEnrollStep === step ? 'bg-[#ecb613] text-slate-900' : ((['input', 'review', 'done'].indexOf(bulkEnrollStep) > idx) ? 'bg-green-100 text-green-700' : 'bg-slate-200 dark:bg-slate-700 text-slate-500')}`}>
                                            {['input', 'review', 'done'].indexOf(bulkEnrollStep) > idx ? '✓' : idx + 1}
                                        </span>
                                        {step === 'input' ? 'Import Data' : step === 'review' ? 'Review & Edit' : 'Complete'}
                                    </div>
                                    {idx < 2 && <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700 max-w-[40px]" />}
                                </React.Fragment>
                            ))}
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto">

                            {/* Step 1: Input */}
                            {bulkEnrollStep === 'input' && (
                                <div className="p-6 space-y-6">
                                    {/* Global settings */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Default Batch</label>
                                            <select
                                                value={bulkEnrollBatch}
                                                onChange={e => setBulkEnrollBatch(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none"
                                            >
                                                <option value="">No Batch (Unassigned)</option>
                                                {sortClassroomsByDayAndTime(classrooms).map(room => (
                                                    <option key={room.id} value={room.id}>{room.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Default Level</label>
                                            <select
                                                value={bulkEnrollLevel}
                                                onChange={e => setBulkEnrollLevel(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none"
                                            >
                                                <option value="beginner">Beginner</option>
                                                <option value="intermediate">Intermediate</option>
                                                <option value="advanced">Advanced</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* CSV format info */}
                                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-1 flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-base">info</span>
                                                CSV Format
                                            </p>
                                            <p className="text-xs text-blue-600 dark:text-blue-400 font-mono">Name, Email, Phone (optional)</p>
                                            <p className="text-xs text-blue-500 dark:text-blue-500 mt-1">Supports comma or tab-separated values. First row header is auto-detected.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={downloadCsvTemplate}
                                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-[#ecb613] hover:bg-[#d8a310] text-slate-900 text-xs font-bold rounded-lg shadow-sm transition-all"
                                        >
                                            <span className="material-symbols-outlined text-sm">download</span>
                                            Template CSV
                                        </button>
                                    </div>

                                    {/* File upload */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-2">Upload CSV File</label>
                                        <div 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center cursor-pointer hover:border-[#ecb613]/50 hover:bg-[#ecb613]/5 transition-all group"
                                        >
                                            <span className="material-symbols-outlined text-3xl text-slate-400 group-hover:text-[#ecb613] transition-colors">upload_file</span>
                                            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mt-1">Click to upload CSV</p>
                                            <p className="text-xs text-slate-400 mt-0.5">or paste data below</p>
                                        </div>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".csv,.txt"
                                            onChange={handleFileUpload}
                                            className="hidden"
                                        />
                                    </div>

                                    {/* Manual text input */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Or Paste / Type Data</label>
                                        <textarea
                                            value={bulkCsvText}
                                            onChange={e => setBulkCsvText(e.target.value)}
                                            rows={8}
                                            placeholder={`Name, Email, Phone\nAarav Patel, aarav@email.com, +91 98001 00001\nRiya Sharma, riya@email.com\nAnkit Verma, ankit@email.com, +91 98001 00003`}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none resize-none text-slate-700 dark:text-slate-300 placeholder:text-slate-400 placeholder:font-sans"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Review */}
                            {bulkEnrollStep === 'review' && (
                                <div className="p-6 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">{bulkRows.length} student{bulkRows.length !== 1 ? 's' : ''} to enroll</p>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                <span className="text-green-600 font-semibold">{bulkRows.filter(r => !r.error).length} valid</span>
                                                {bulkRows.filter(r => r.error).length > 0 && <span className="text-rose-500 font-semibold ml-2">{bulkRows.filter(r => r.error).length} with errors</span>}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setBulkEnrollStep('input')}
                                            className="text-xs font-bold text-[#ecb613] hover:underline"
                                        >← Edit Data</button>
                                    </div>

                                    <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                                        {bulkRows.map((row, idx) => (
                                            <div key={idx} className={`rounded-xl border p-3 ${row.error ? 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/10' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50'}`}>
                                                <div className="grid grid-cols-12 gap-2 items-center">
                                                    <div className="col-span-1 flex items-center justify-center">
                                                        {row.error ? (
                                                            <span className="material-symbols-outlined text-rose-500 text-lg">error</span>
                                                        ) : (
                                                            <span className="material-symbols-outlined text-green-500 text-lg">check_circle</span>
                                                        )}
                                                    </div>
                                                    <input
                                                        value={row.name}
                                                        onChange={e => updateBulkRow(idx, 'name', e.target.value)}
                                                        placeholder="Full Name *"
                                                        className={`col-span-3 text-xs font-medium bg-white dark:bg-slate-900 border rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-[#ecb613]/30 ${row.error && !row.name ? 'border-rose-300' : 'border-slate-200 dark:border-slate-700'}`}
                                                    />
                                                    <input
                                                        value={row.email}
                                                        onChange={e => updateBulkRow(idx, 'email', e.target.value)}
                                                        placeholder="Email *"
                                                        className={`col-span-4 text-xs font-medium bg-white dark:bg-slate-900 border rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-[#ecb613]/30 ${row.error && (!row.email || !row.email.includes('@')) ? 'border-rose-300' : 'border-slate-200 dark:border-slate-700'}`}
                                                    />
                                                    <input
                                                        value={row.phone}
                                                        onChange={e => updateBulkRow(idx, 'phone', e.target.value)}
                                                        placeholder="Phone"
                                                        className="col-span-3 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-[#ecb613]/30"
                                                    />
                                                    <button
                                                        onClick={() => removeBulkRow(idx)}
                                                        className="col-span-1 flex items-center justify-center p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">delete</span>
                                                    </button>
                                                </div>
                                                {row.error && (
                                                    <p className="text-[10px] text-rose-500 font-medium mt-1 ml-8">{row.error}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {bulkRows.length === 0 && (
                                        <div className="text-center py-8 text-slate-400">
                                            <span className="material-symbols-outlined text-4xl mb-2 block">person_search</span>
                                            <p className="text-sm">No students to enroll. Go back and add data.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Step 3: Done */}
                            {bulkEnrollStep === 'done' && (
                                <div className="p-8 flex flex-col items-center justify-center text-center min-h-[280px] space-y-4">
                                    <div className={`w-16 h-16 rounded-full flex items-center justify-center ${bulkEnrollResult.success > 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-rose-100 dark:bg-rose-900/30'}`}>
                                        <span className={`material-symbols-outlined text-3xl ${bulkEnrollResult.success > 0 ? 'text-green-600' : 'text-rose-500'}`}>
                                            {bulkEnrollResult.success > 0 ? 'check_circle' : 'error'}
                                        </span>
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-slate-900 dark:text-white">Enrollment Complete!</h4>
                                        <p className="text-slate-500 text-sm mt-1">Bulk enrollment process finished.</p>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-center">
                                            <p className="text-3xl font-black text-green-600">{bulkEnrollResult.success}</p>
                                            <p className="text-xs text-slate-500 font-medium">Enrolled</p>
                                        </div>
                                        {bulkEnrollResult.failed > 0 && (
                                            <div className="text-center">
                                                <p className="text-3xl font-black text-rose-500">{bulkEnrollResult.failed}</p>
                                                <p className="text-xs text-slate-500 font-medium">Failed</p>
                                            </div>
                                        )}
                                    </div>
                                    {bulkEnrollResult.failed > 0 && (
                                        <p className="text-xs text-slate-400 max-w-xs">Some students could not be enrolled (possibly duplicate emails). Check the console for details.</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
                            <button onClick={closeBulkEnrollModal} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                {bulkEnrollStep === 'done' ? 'Close' : 'Cancel'}
                            </button>
                            <div className="flex items-center gap-3">
                                {bulkEnrollStep === 'input' && (
                                    <button
                                        onClick={parseBulkCsv}
                                        disabled={!bulkCsvText.trim()}
                                        className="px-5 py-2 rounded-lg text-sm font-bold bg-[#ecb613] text-slate-900 hover:bg-[#ecb613]/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                        Review Students
                                    </button>
                                )}
                                {bulkEnrollStep === 'review' && (
                                    <button
                                        onClick={submitBulkEnroll}
                                        disabled={isBulkEnrolling || bulkRows.filter(r => !r.error).length === 0}
                                        className="px-5 py-2 rounded-lg text-sm font-bold bg-[#ecb613] text-slate-900 hover:bg-[#ecb613]/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {isBulkEnrolling ? (
                                            <><Loader2 className="w-4 h-4 animate-spin" /> Enrolling...</>
                                        ) : (
                                            <><span className="material-symbols-outlined text-lg">assignment_ind</span>Enroll {bulkRows.filter(r => !r.error).length} Student{bulkRows.filter(r => !r.error).length !== 1 ? 's' : ''}</>
                                        )}
                                    </button>
                                )}
                                {bulkEnrollStep === 'done' && bulkEnrollResult.success > 0 && (
                                    <button
                                        onClick={closeBulkEnrollModal}
                                        className="px-5 py-2 rounded-lg text-sm font-bold bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-lg">check</span>
                                        View Students
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex min-h-screen">
                <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

                <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <TeacherHeader 
                        title="Student Directory" 
                        avatarUrl={teacherProfile?.profile_pic_url}
                        userName={teacherProfile?.name}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        backLink={teacherProfile?.role === 'admin' ? '/admin-dashboard' : '/teacher-dashboard'}
                    />

                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
                        <div className="max-w-7xl mx-auto w-full space-y-6">
                            {/* ── Page Header & Top Actions ────────────────────────── */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Student Management</h1>
                                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                                        Manage enrollment, monitor student progress, and take immediate lifecycle actions.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {(teacherProfile?.role === 'admin' || teacherProfile?.role === 'teacher') && (
                                        <>
                                            <button
                                                onClick={() => setShowRecycleBin(true)}
                                                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-xs transition-all cursor-pointer"
                                                title={`Recycle Bin (${recycleBin.length} deleted students)`}
                                            >
                                                <span className="material-symbols-outlined text-base shrink-0 text-slate-400">delete_sweep</span>
                                                <span>Recycle Bin ({recycleBin.length})</span>
                                            </button>
                                            <button
                                                onClick={() => setShowBulkEnrollModal(true)}
                                                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-xs transition-all cursor-pointer"
                                                title="Bulk Enroll Students via CSV"
                                            >
                                                <span className="material-symbols-outlined text-base shrink-0 text-slate-400">upload_file</span>
                                                <span className="hidden sm:inline">Bulk Enroll</span>
                                            </button>
                                            <button
                                                onClick={handleExportCSV}
                                                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-xs transition-all cursor-pointer"
                                                title="Export Student Directory as CSV"
                                            >
                                                <span className="material-symbols-outlined text-base shrink-0 text-slate-400">download</span>
                                                <span className="hidden sm:inline">Export</span>
                                            </button>
                                            <Link
                                                href="/teacher-dashboard/students/add"
                                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-[#ecb613] hover:bg-[#d49f0e] rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
                                                title="Add New Student"
                                            >
                                                <span className="material-symbols-outlined text-base shrink-0">person_add</span>
                                                <span>Add Student</span>
                                            </Link>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* ── Pending Signup Requests Banner ────────────────── */}
                            {pendingUsers.length > 0 && (
                                <div className="rounded-xl border border-amber-300/80 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-700/80 overflow-hidden shadow-xs">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 bg-amber-100/70 dark:bg-amber-900/30 border-b border-amber-200/80 dark:border-amber-700/80">
                                        <div className="flex items-center gap-2">
                                            <span className="relative flex h-2.5 w-2.5 shrink-0">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                                            </span>
                                            <span className="font-bold text-xs sm:text-sm text-amber-900 dark:text-amber-300">
                                                {pendingUsers.length} New Registration Request{pendingUsers.length !== 1 ? 's' : ''} Awaiting Approval
                                            </span>
                                        </div>
                                        <Link
                                            href="/teacher-dashboard/role-allocation"
                                            className="text-xs font-bold text-amber-800 dark:text-amber-300 hover:underline flex items-center gap-1 shrink-0 self-start sm:self-auto"
                                        >
                                            Go to Role Allocation →
                                        </Link>
                                    </div>
                                    <div className="divide-y divide-amber-100 dark:divide-amber-900/30">
                                        {pendingUsers.slice(0, 5).map(u => (
                                            <div key={u.id} className="flex items-center justify-between p-3.5 sm:px-4 sm:py-3 gap-3">
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-200/80 dark:bg-amber-800/80 flex items-center justify-center text-amber-900 dark:text-amber-100 font-black text-xs sm:text-sm shrink-0 border border-amber-300/50">
                                                        {u.name?.charAt(0)?.toUpperCase() || '?'}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">{u.name}</p>
                                                        </div>
                                                        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-[11px] font-medium text-slate-400 hidden md:inline">
                                                        {new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                    <Link
                                                        href="/teacher-dashboard/role-allocation"
                                                        className="admin-btn-sm admin-btn-primary whitespace-nowrap"
                                                        title="Assign Role"
                                                    >
                                                        <span className="material-symbols-outlined text-base shrink-0">manage_accounts</span>
                                                        <span className="hidden sm:inline">Assign Role</span>
                                                    </Link>
                                                </div>
                                            </div>
                                        ))}
                                        {pendingUsers.length > 5 && (
                                            <div className="px-4 py-2.5 text-center bg-amber-50/50 dark:bg-amber-950/10">
                                                <Link href="/teacher-dashboard/role-allocation" className="text-xs text-amber-800 dark:text-amber-400 font-bold hover:underline">
                                                    View all {pendingUsers.length} pending requests →
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── Bulk Selection Action Bar ────────────────────────── */}
                            {selectedIds.size > 0 && (
                                <div className="flex items-center justify-between p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-xl animate-in slide-in-from-top-2 duration-200 shadow-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-rose-500">check_box</span>
                                        <span className="text-xs sm:text-sm font-bold text-rose-700 dark:text-rose-400">
                                            {selectedIds.size} student{selectedIds.size !== 1 ? 's' : ''} selected
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <button
                                            onClick={openBulkGuidanceModal}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-950 bg-[#ecb613] hover:bg-[#d49f0e] rounded-lg transition-all shadow-xs cursor-pointer active:scale-95"
                                        >
                                            <Lightbulb className="w-3.5 h-3.5 text-slate-950" />
                                            <span>+ Add Guidance ({selectedIds.size})</span>
                                        </button>
                                        <button
                                            onClick={() => setSelectedIds(new Set())}
                                            className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                        >
                                            Clear
                                        </button>
                                        <button
                                            onClick={() => setShowBulkDeleteModal(true)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-sm cursor-pointer"
                                        >
                                            <span className="material-symbols-outlined text-base">delete_sweep</span>
                                            Delete ({selectedIds.size})
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ── Compact Summary Cards (Clickable Filter Shortcuts) ── */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                                {/* Active Card */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFilterMode('all');
                                        setStatusFilter('active');
                                        setCurrentPage(1);
                                    }}
                                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                                        filterMode !== 'unassigned' && statusFilter === 'active'
                                            ? 'bg-emerald-50/80 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-700 shadow-xs ring-2 ring-emerald-500/20'
                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active</span>
                                        <span className="size-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-base">school</span>
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-baseline gap-2">
                                        <span className="text-2xl font-black text-slate-900 dark:text-white">{summaryCounts.active}</span>
                                        <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Regular Students</span>
                                    </div>
                                </button>

                                {/* Learning Paused Card */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFilterMode('all');
                                        setStatusFilter('inactive');
                                        setCurrentPage(1);
                                    }}
                                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                                        filterMode !== 'unassigned' && statusFilter === 'inactive'
                                            ? 'bg-amber-50/80 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700 shadow-xs ring-2 ring-amber-500/20'
                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Learning Paused</span>
                                        <span className="size-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-base">pause_circle</span>
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-baseline gap-2">
                                        <span className="text-2xl font-black text-slate-900 dark:text-white">{summaryCounts.paused}</span>
                                        <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Temporary Break</span>
                                    </div>
                                </button>

                                {/* Archived Card */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFilterMode('all');
                                        setStatusFilter('archived');
                                        setCurrentPage(1);
                                    }}
                                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                                        filterMode !== 'unassigned' && statusFilter === 'archived'
                                            ? 'bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-600 shadow-xs ring-2 ring-slate-400/20'
                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Archived</span>
                                        <span className="size-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-base">archive</span>
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-baseline gap-2">
                                        <span className="text-2xl font-black text-slate-900 dark:text-white">{summaryCounts.archived}</span>
                                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Former Students</span>
                                    </div>
                                </button>

                                {/* Unassigned Card */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFilterMode('unassigned');
                                        setCurrentPage(1);
                                    }}
                                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                                        filterMode === 'unassigned'
                                            ? 'bg-blue-50/80 border-blue-300 dark:bg-blue-950/30 dark:border-blue-700 shadow-xs ring-2 ring-blue-500/20'
                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Unassigned</span>
                                        <span className="size-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-base">group_add</span>
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-baseline gap-2">
                                        <span className="text-2xl font-black text-slate-900 dark:text-white">{summaryCounts.unassigned}</span>
                                        <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">Needs Classroom</span>
                                    </div>
                                </button>
                            </div>

                            {/* ── Filter Controls Card ─────────────────────────────── */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 space-y-3">
                                {/* Search & Secondary Filters */}
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                    <div className="relative flex-1 min-w-[240px]">
                                        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => {
                                                setSearchQuery(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                            placeholder="Search student by name, ID, phone, email, batch..."
                                            className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-slate-900 dark:text-white placeholder:text-slate-400"
                                        />
                                        {searchQuery && (
                                            <button
                                                onClick={() => setSearchQuery('')}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                            >
                                                <span className="material-symbols-outlined text-base">close</span>
                                            </button>
                                        )}
                                    </div>

                                    {filterMode !== 'unassigned' && (
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            {/* Batch Selector */}
                                            <div className="relative flex items-center bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 shadow-xs">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase mr-2 select-none">Batch:</span>
                                                <select
                                                    value={selectedBatch}
                                                    onChange={(e) => {
                                                        setSelectedBatch(e.target.value);
                                                        setCurrentPage(1);
                                                    }}
                                                    className="text-xs font-semibold bg-transparent border-none focus:ring-0 text-slate-700 dark:text-slate-200 pr-4 cursor-pointer outline-none"
                                                >
                                                    <option value="All Batches">All Batches</option>
                                                    {availableBatches.map(batch => (
                                                        <option key={batch} value={batch}>{batch}</option>
                                                    ))}
                                                    <option value="Unassigned">Unassigned</option>
                                                </select>
                                            </div>

                                            {/* Focus / Attention Selector */}
                                            <div className="relative flex items-center bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 shadow-xs">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase mr-2 select-none">Focus:</span>
                                                <select
                                                    value={attentionFilter}
                                                    onChange={(e) => {
                                                        setAttentionFilter(e.target.value as any);
                                                        setCurrentPage(1);
                                                    }}
                                                    className="text-xs font-semibold bg-transparent border-none focus:ring-0 text-slate-700 dark:text-slate-200 pr-4 cursor-pointer outline-none"
                                                >
                                                    <option value="all">All Students</option>
                                                    <option value="needs_attention">⚠ Needs Attention</option>
                                                    <option value="no_attention">✓ No Attention</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Primary Status Tabs */}
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-t border-slate-100 dark:border-slate-800 pt-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFilterMode('all');
                                            setStatusFilter('all');
                                            setCurrentPage(1);
                                        }}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${
                                            filterMode !== 'unassigned' && statusFilter === 'all'
                                                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        All Students ({students.length})
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFilterMode('all');
                                            setStatusFilter('active');
                                            setCurrentPage(1);
                                        }}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${
                                            filterMode !== 'unassigned' && statusFilter === 'active'
                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <span className={`size-1.5 rounded-full ${filterMode !== 'unassigned' && statusFilter === 'active' ? 'bg-white' : 'bg-emerald-500'}`} />
                                        Active ({summaryCounts.active})
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFilterMode('all');
                                            setStatusFilter('inactive');
                                            setCurrentPage(1);
                                        }}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${
                                            filterMode !== 'unassigned' && statusFilter === 'inactive'
                                                ? 'bg-amber-600 text-white shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <span className={`size-1.5 rounded-full ${filterMode !== 'unassigned' && statusFilter === 'inactive' ? 'bg-white' : 'bg-amber-500'}`} />
                                        Learning Paused ({summaryCounts.paused})
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFilterMode('all');
                                            setStatusFilter('archived');
                                            setCurrentPage(1);
                                        }}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${
                                            filterMode !== 'unassigned' && statusFilter === 'archived'
                                                ? 'bg-slate-700 text-white shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <span className={`size-1.5 rounded-full ${filterMode !== 'unassigned' && statusFilter === 'archived' ? 'bg-white' : 'bg-slate-400'}`} />
                                        Archived ({summaryCounts.archived})
                                    </button>

                                    {teacherProfile && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFilterMode('unassigned');
                                                setCurrentPage(1);
                                            }}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${
                                                filterMode === 'unassigned'
                                                    ? 'bg-blue-600 text-white shadow-xs'
                                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                            }`}
                                        >
                                            <span className={`size-1.5 rounded-full ${filterMode === 'unassigned' ? 'bg-white' : 'bg-blue-500'}`} />
                                            Unassigned ({allUnassignedStudents.length})
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* ── Main Students Table & Mobile Cards ───────────────── */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                                {/* Mobile Cards View (Hidden on Tablet / Desktop) */}
                                <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                                    {paginatedStudents.map((student) => {
                                        const studentAttentionIssues = getStudentAttentionIssues(student);
                                        const hasAttention = student.status === 'Active' && studentAttentionIssues.length > 0;
                                        const primaryIssue = hasAttention ? studentAttentionIssues[0] : null;
                                        const moreCount = hasAttention && studentAttentionIssues.length > 1 ? studentAttentionIssues.length - 1 : 0;

                                        return (
                                            <div 
                                                key={student.id}
                                                onClick={() => router.push(`/teacher-dashboard/students/${student.id}`)}
                                                className="p-4 space-y-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                                            >
                                                {/* ROW 1: Identity (Avatar, Name, ID, Lifecycle Status) & 3-dot Action Menu */}
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                                        {/* Avatar */}
                                                        <div className="relative shrink-0 mt-0.5">
                                                            <div className="size-10 rounded-full bg-amber-500/10 dark:bg-amber-400/10 flex items-center justify-center overflow-hidden border border-amber-500/20 shadow-xs">
                                                                {student.profile_pic_url ? (
                                                                    <img src={student.profile_pic_url} alt={student.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{student.name.charAt(0).toUpperCase()}</span>
                                                                )}
                                                            </div>
                                                            {student.is_online && (
                                                                <span className="absolute bottom-0 right-0 block size-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                                                            )}
                                                        </div>

                                                        {/* Name, KFA ID, and Lifecycle Badge */}
                                                        <div className="min-w-0 flex-1 space-y-1">
                                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate leading-snug">
                                                                {student.name}
                                                            </h4>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400">
                                                                    {student.student_id_formatted}
                                                                </span>
                                                                {student.status === 'Active' ? (
                                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                                                        <span className="size-1.5 rounded-full bg-emerald-500" />
                                                                        Active
                                                                    </span>
                                                                ) : student.status === 'Inactive' ? (
                                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                                                                        <span className="size-1.5 rounded-full bg-amber-500" />
                                                                        Paused
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                                        <span className="size-1.5 rounded-full bg-slate-400" />
                                                                        Archived
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* 3-dot Action Menu (min 44x44px touch target) */}
                                                    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            type="button"
                                                            onClick={() => setActiveActionMenuId(activeActionMenuId === student.id ? null : student.id)}
                                                            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                                            aria-label="Student actions"
                                                        >
                                                            <span className="material-symbols-outlined text-xl">more_vert</span>
                                                        </button>
                                                        {activeActionMenuId === student.id && (
                                                            <div 
                                                                ref={actionMenuRef}
                                                                className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 text-left"
                                                            >
                                                                <Link
                                                                    href={`/teacher-dashboard/students/${student.id}`}
                                                                    onClick={() => setActiveActionMenuId(null)}
                                                                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                                                                >
                                                                    <span className="material-symbols-outlined text-sm text-slate-400">visibility</span>
                                                                    View Profile
                                                                </Link>
                                                                <Link
                                                                    href={`/teacher-dashboard/students/${student.id}/edit`}
                                                                    onClick={() => setActiveActionMenuId(null)}
                                                                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                                                                >
                                                                    <span className="material-symbols-outlined text-sm text-slate-400">edit</span>
                                                                    Edit Student
                                                                </Link>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setActiveActionMenuId(null);
                                                                        openSingleGuidanceModal(student);
                                                                    }}
                                                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-left cursor-pointer"
                                                                >
                                                                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                                                                    Add Guidance Note
                                                                </button>
                                                                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                                                                {student.status === 'Active' ? (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setActiveActionMenuId(null);
                                                                                handlePauseStudent(student);
                                                                            }}
                                                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-left cursor-pointer"
                                                                        >
                                                                            <span className="material-symbols-outlined text-sm">pause_circle</span>
                                                                            Pause Learning
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setActiveActionMenuId(null);
                                                                                handleArchiveStudent(student);
                                                                            }}
                                                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 text-left cursor-pointer"
                                                                        >
                                                                            <span className="material-symbols-outlined text-sm">archive</span>
                                                                            Archive Student
                                                                        </button>
                                                                    </>
                                                                ) : student.status === 'Inactive' ? (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setActiveActionMenuId(null);
                                                                                handleResumeStudent(student);
                                                                            }}
                                                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-left cursor-pointer"
                                                                        >
                                                                            <span className="material-symbols-outlined text-sm">play_circle</span>
                                                                            Resume Learning
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setActiveActionMenuId(null);
                                                                                handleArchiveStudent(student);
                                                                            }}
                                                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 text-left cursor-pointer"
                                                                        >
                                                                            <span className="material-symbols-outlined text-sm">archive</span>
                                                                            Archive Student
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setActiveActionMenuId(null);
                                                                            handleOpenReactivateModal(student);
                                                                        }}
                                                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-left cursor-pointer"
                                                                    >
                                                                        <span className="material-symbols-outlined text-sm">unarchive</span>
                                                                        Re-enroll Student
                                                                    </button>
                                                                )}
                                                                {teacherProfile?.role === 'admin' && (
                                                                    <>
                                                                        <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setActiveActionMenuId(null);
                                                                                setStudentToDelete({ id: student.id, name: student.name });
                                                                            }}
                                                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-left cursor-pointer"
                                                                        >
                                                                            <span className="material-symbols-outlined text-sm">delete</span>
                                                                            Delete Student
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* ROW 2: Dedicated Needs Attention Presentation (Active Students with Issues Only) */}
                                                {hasAttention && primaryIssue && (
                                                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleAttentionTriggerClick(student, e.currentTarget, e)}
                                                            className={`w-full min-h-[44px] flex items-center justify-between gap-2.5 px-3.5 py-2 rounded-xl text-left transition-all cursor-pointer ${
                                                                activeAttentionStudent?.id === student.id
                                                                    ? 'bg-amber-100/90 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-700 shadow-xs ring-2 ring-amber-500/20'
                                                                    : 'bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200/90 dark:border-amber-800/60 hover:bg-amber-100/70 dark:hover:bg-amber-900/40 active:scale-[0.99]'
                                                            }`}
                                                        >
                                                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                                                <span className="material-symbols-outlined text-base text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">warning</span>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                                                                            Needs Attention
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 truncate mt-0.5">
                                                                        {primaryIssue.label}
                                                                        {moreCount > 0 && (
                                                                            <span className="text-amber-600/90 dark:text-amber-400/90 font-normal">
                                                                                {' '}• +{moreCount} more
                                                                            </span>
                                                                        )}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <span className="material-symbols-outlined text-base text-amber-600 dark:text-amber-400 shrink-0">
                                                                {activeAttentionStudent?.id === student.id ? 'expand_less' : 'expand_more'}
                                                            </span>
                                                        </button>
                                                    </div>
                                                )}

                                                {/* ROW 3: Class & Attendance Details */}
                                                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                                    <div>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Class / Batch</span>
                                                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block mt-0.5">{student.batch}</span>
                                                        {teacherProfile?.role === 'admin' && student.teacher_name && (
                                                            <span className="text-[10px] text-slate-500 block truncate mt-0.5">{student.teacher_name}</span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                            <span>Attendance</span>
                                                            <span className="font-bold text-slate-800 dark:text-slate-200">{student.attendance_pct}%</span>
                                                        </div>
                                                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden mt-2">
                                                            <div 
                                                                className={`h-full rounded-full ${student.attendance_pct >= 85 ? 'bg-emerald-500' : student.attendance_pct >= 75 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                                                style={{ width: `${student.attendance_pct}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* ROW 4: Actions Footer */}
                                                <div className="flex items-center justify-between gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center gap-2">
                                                        {student.phone && student.phone !== 'No Phone' && (
                                                            <a
                                                                href={`tel:${student.phone}`}
                                                                className="min-h-[44px] px-3 py-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                                                            >
                                                                <span className="material-symbols-outlined text-base text-emerald-600">call</span>
                                                                Call
                                                            </a>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => router.push(`/teacher-dashboard/messages?chat=${student.id}`)}
                                                            className="min-h-[44px] px-3 py-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                                                        >
                                                            <span className="material-symbols-outlined text-base text-amber-600">chat</span>
                                                            Chat
                                                        </button>
                                                    </div>

                                                    {filterMode === 'unassigned' ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowClaimModal(student)}
                                                            className="min-h-[44px] px-3.5 py-2 inline-flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs cursor-pointer"
                                                        >
                                                            <span className="material-symbols-outlined text-base">person_add</span>
                                                            Claim & Assign
                                                        </button>
                                                    ) : (
                                                        <Link
                                                            href={`/teacher-dashboard/students/${student.id}`}
                                                            className="min-h-[44px] px-3.5 py-2 inline-flex items-center gap-1 text-xs font-bold text-slate-950 bg-[#ecb613] hover:bg-[#d49f0e] rounded-xl transition-colors shadow-xs"
                                                        >
                                                            View Student
                                                            <span className="material-symbols-outlined text-base">arrow_forward</span>
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {paginatedStudents.length === 0 && (
                                        <div className="p-8 text-center text-slate-500 text-xs">
                                            {filterMode === 'unassigned' ? 'No unassigned students waiting to be claimed.' : 'No students found matching your filters.'}
                                        </div>
                                    )}
                                </div>

                                {/* Desktop Table View (Fits 100% full width with zero horizontal scrolling) */}
                                <div className="hidden md:block w-full overflow-hidden">
                                    <table className="w-full table-fixed text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                                <th className="px-3 py-3.5 w-12 text-center">
                                                    {filterMode !== 'unassigned' ? (
                                                        <input
                                                            type="checkbox"
                                                            checked={allPageSelected}
                                                            ref={el => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
                                                            onChange={toggleSelectAll}
                                                            className="size-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500/20 cursor-pointer"
                                                        />
                                                    ) : (
                                                        <span className="text-slate-400 text-xs">—</span>
                                                    )}
                                                </th>
                                                <th className="px-4 py-3.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[24%]">
                                                    Student
                                                </th>
                                                <th className="px-4 py-3.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[18%]">
                                                    Status
                                                </th>
                                                <th className="px-4 py-3.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[22%]">
                                                    Class & Schedule
                                                </th>
                                                <th className="px-4 py-3.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[13%]">
                                                    Attendance
                                                </th>
                                                <th className="px-4 py-3.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[13%]">
                                                    Contact
                                                </th>
                                                <th className="px-4 py-3.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right w-[10%]">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                            {paginatedStudents.map((student) => {
                                                const studentAttentionIssues = getStudentAttentionIssues(student);
                                                return (
                                                    <tr 
                                                        key={student.id} 
                                                        onClick={() => router.push(`/teacher-dashboard/students/${student.id}`)}
                                                        className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group ${selectedIds.has(student.id) ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''}`}
                                                    >
                                                        {/* Checkbox */}
                                                        <td className="px-3 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                            {filterMode !== 'unassigned' ? (
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedIds.has(student.id)}
                                                                    onChange={() => toggleSelectStudent(student.id)}
                                                                    className="size-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500/20 cursor-pointer"
                                                                />
                                                            ) : (
                                                                <span className="text-slate-400 text-xs">—</span>
                                                            )}
                                                        </td>

                                                        {/* Student Profile & Attention */}
                                                        <td className="px-4 py-4">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className="relative shrink-0">
                                                                    <div className="size-10 rounded-full bg-amber-500/10 dark:bg-amber-400/10 flex items-center justify-center overflow-hidden border border-amber-500/20 shadow-xs">
                                                                        {student.profile_pic_url ? (
                                                                            <img src={student.profile_pic_url} alt={student.name} className="w-full h-full object-cover rounded-full" loading="lazy" />
                                                                        ) : (
                                                                            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{student.name.charAt(0).toUpperCase()}</span>
                                                                        )}
                                                                    </div>
                                                                    {student.is_online && (
                                                                        <span className="absolute bottom-0 right-0 block size-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" title="Online now" />
                                                                    )}
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate">
                                                                            {student.name}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                                        <span className="text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400 tracking-tight">
                                                                            {student.student_id_formatted}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {/* Status */}
                                                        <td className="px-4 py-4">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                {student.status === 'Active' ? (
                                                                    <>
                                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                                                            <span className="size-1.5 rounded-full bg-emerald-500" />
                                                                            Active
                                                                        </span>
                                                                        {studentAttentionIssues.length > 0 && (
                                                                            <div className="inline-flex items-center" onClick={(e) => e.stopPropagation()}>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={(e) => handleAttentionTriggerClick(student, e.currentTarget, e)}
                                                                                    onMouseEnter={(e) => handleAttentionTriggerMouseEnter(student, e.currentTarget)}
                                                                                    onMouseLeave={handleAttentionTriggerMouseLeave}
                                                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                                                                                        activeAttentionStudent?.id === student.id
                                                                                            ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100 border border-amber-400 dark:border-amber-700 ring-2 ring-amber-500/20'
                                                                                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                                                                                    }`}
                                                                                    title="Click or hover to view attention reasons"
                                                                                >
                                                                                    <span className="material-symbols-outlined text-[13px] text-amber-600 dark:text-amber-400">warning</span>
                                                                                    <span>Needs Attention</span>
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                ) : student.status === 'Inactive' ? (
                                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                                                                        <span className="size-1.5 rounded-full bg-amber-500" />
                                                                        Learning Paused
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                                        <span className="size-1.5 rounded-full bg-slate-400" />
                                                                        Former Student
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* Class & Schedule */}
                                                        <td className="px-4 py-4">
                                                            <div className="min-w-0 space-y-0.5">
                                                                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block truncate" title={student.batch}>
                                                                    {student.batch}
                                                                </span>
                                                                {teacherProfile?.role === 'admin' && (
                                                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                                                                        Teacher: {student.teacher_name || 'Unassigned'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* Attendance */}
                                                        <td className="px-4 py-4">
                                                            <div className="space-y-1.5 min-w-[100px]">
                                                                <div className="flex items-center justify-between text-xs">
                                                                    <span className={`font-bold ${
                                                                        student.attendance_pct >= 85 ? 'text-emerald-600 dark:text-emerald-400' :
                                                                        student.attendance_pct >= 75 ? 'text-amber-600 dark:text-amber-400' :
                                                                        'text-rose-600 dark:text-rose-400'
                                                                    }`}>
                                                                        {student.attendance_pct}%
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400 font-medium">
                                                                        {student.attendance_pct >= 85 ? 'Good' : student.attendance_pct >= 75 ? 'Average' : 'Low'}
                                                                    </span>
                                                                </div>
                                                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                                                    <div 
                                                                        className={`h-full rounded-full transition-all duration-300 ${
                                                                            student.attendance_pct >= 85 ? 'bg-emerald-500' :
                                                                            student.attendance_pct >= 75 ? 'bg-amber-500' :
                                                                            'bg-rose-500'
                                                                        }`}
                                                                        style={{ width: `${Math.min(100, Math.max(0, student.attendance_pct))}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {/* Contact */}
                                                        <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="min-w-0 flex-1">
                                                                    {student.phone && student.phone !== 'No Phone' ? (
                                                                        <a
                                                                            href={`tel:${student.phone}`}
                                                                            className="text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 truncate block transition-colors"
                                                                            title={`Call ${student.name}: ${student.phone}`}
                                                                        >
                                                                            {student.phone}
                                                                        </a>
                                                                    ) : (
                                                                        <span className="text-xs text-slate-400 dark:text-slate-500 italic">No phone</span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    {student.phone && student.phone !== 'No Phone' && (
                                                                        <a
                                                                            href={`tel:${student.phone}`}
                                                                            className="size-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                                                                            title={`Call ${student.phone}`}
                                                                        >
                                                                            <span className="material-symbols-outlined text-[16px]">call</span>
                                                                        </a>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => router.push(`/teacher-dashboard/messages?chat=${student.id}`)}
                                                                        className="size-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
                                                                        title="Send Message"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[16px]">chat</span>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {/* Actions */}
                                                        <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                            {filterMode === 'unassigned' ? (
                                                                <button 
                                                                    onClick={() => setShowClaimModal(student)} 
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                                                                >
                                                                    <span className="material-symbols-outlined text-sm">person_add</span>
                                                                    Claim
                                                                </button>
                                                            ) : (
                                                                <div className="flex items-center justify-end gap-1.5">
                                                                    <Link 
                                                                        href={`/teacher-dashboard/students/${student.id}`}
                                                                        className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                                                                    >
                                                                        View
                                                                    </Link>
                                                                    <div className="relative">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setActiveActionMenuId(activeActionMenuId === student.id ? null : student.id)}
                                                                            className="size-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                                                            title="More actions"
                                                                        >
                                                                            <span className="material-symbols-outlined text-lg">more_vert</span>
                                                                        </button>
                                                                        {activeActionMenuId === student.id && (
                                                                            <div 
                                                                                ref={actionMenuRef}
                                                                                className="absolute right-0 top-full mt-1.5 w-52 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 text-left"
                                                                            >
                                                                                <Link
                                                                                    href={`/teacher-dashboard/students/${student.id}`}
                                                                                    onClick={() => setActiveActionMenuId(null)}
                                                                                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                                                                >
                                                                                    <span className="material-symbols-outlined text-base text-slate-400">visibility</span>
                                                                                    View Profile
                                                                                </Link>
                                                                                <Link
                                                                                    href={`/teacher-dashboard/students/${student.id}/edit`}
                                                                                    onClick={() => setActiveActionMenuId(null)}
                                                                                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                                                                >
                                                                                    <span className="material-symbols-outlined text-base text-slate-400">edit</span>
                                                                                    Edit Student
                                                                                </Link>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setActiveActionMenuId(null);
                                                                                        router.push(`/teacher-dashboard/messages?chat=${student.id}`);
                                                                                    }}
                                                                                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                                                                                >
                                                                                    <span className="material-symbols-outlined text-base text-slate-400">chat</span>
                                                                                    Send Message
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setActiveActionMenuId(null);
                                                                                        openSingleGuidanceModal(student);
                                                                                    }}
                                                                                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                                                                                >
                                                                                    <Lightbulb className="w-4 h-4 text-amber-500" />
                                                                                    Add Guidance Note
                                                                                </button>

                                                                                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                                                                                {/* Lifecycle Transitions */}
                                                                                {student.status === 'Active' ? (
                                                                                    <>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                setActiveActionMenuId(null);
                                                                                                handlePauseStudent(student);
                                                                                            }}
                                                                                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors text-left cursor-pointer"
                                                                                        >
                                                                                            <span className="material-symbols-outlined text-base">pause_circle</span>
                                                                                            Pause Learning
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                setActiveActionMenuId(null);
                                                                                                handleArchiveStudent(student);
                                                                                            }}
                                                                                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                                                                                        >
                                                                                            <span className="material-symbols-outlined text-base">archive</span>
                                                                                            Archive Student
                                                                                        </button>
                                                                                    </>
                                                                                ) : student.status === 'Inactive' ? (
                                                                                    <>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                setActiveActionMenuId(null);
                                                                                                handleResumeStudent(student);
                                                                                            }}
                                                                                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors text-left cursor-pointer"
                                                                                        >
                                                                                            <span className="material-symbols-outlined text-base">play_circle</span>
                                                                                            Resume Learning
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                setActiveActionMenuId(null);
                                                                                                handleArchiveStudent(student);
                                                                                            }}
                                                                                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                                                                                        >
                                                                                            <span className="material-symbols-outlined text-base">archive</span>
                                                                                            Archive Student
                                                                                        </button>
                                                                                    </>
                                                                                ) : (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setActiveActionMenuId(null);
                                                                                            handleOpenReactivateModal(student);
                                                                                        }}
                                                                                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors text-left cursor-pointer"
                                                                                        >
                                                                                        <span className="material-symbols-outlined text-base">unarchive</span>
                                                                                        Re-enroll Student
                                                                                    </button>
                                                                                )}

                                                                                {teacherProfile?.role === 'admin' && (
                                                                                    <>
                                                                                        <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                setActiveActionMenuId(null);
                                                                                                setStudentToDelete({ id: student.id, name: student.name });
                                                                                            }}
                                                                                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-left cursor-pointer"
                                                                                        >
                                                                                            <span className="material-symbols-outlined text-base">delete</span>
                                                                                            Delete Student
                                                                                        </button>
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {paginatedStudents.length === 0 && (
                                                <tr>
                                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500 text-xs font-semibold">
                                                        {filterMode === 'unassigned' ? 'No unassigned students waiting to be claimed.' : 'No students found matching your filters.'}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination Footer */}
                                <div className="px-6 py-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                        Showing {displayedStudents.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, displayedStudents.length)} of {displayedStudents.length} students
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button 
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                            className="size-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                        >
                                            <span className="material-symbols-outlined text-sm">chevron_left</span>
                                        </button>
                                        
                                        {Array.from({ length: totalPages }).map((_, idx) => (
                                            <button 
                                                key={idx}
                                                onClick={() => setCurrentPage(idx + 1)}
                                                className={`size-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${currentPage === idx + 1 ? 'bg-[#ecb613] text-slate-950 shadow-xs' : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                            >
                                                {idx + 1}
                                            </button>
                                        ))}

                                        <button 
                                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                            disabled={currentPage === totalPages || totalPages === 0}
                                            className="size-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                        >
                                            <span className="material-symbols-outlined text-sm">chevron_right</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* Needs Attention Viewport-Aware Popover Portal */}
            <AttentionPopoverPortal
                student={activeAttentionStudent}
                triggerEl={activeAttentionTrigger}
                onClose={handleCloseAttentionPopover}
                onMouseEnter={handlePopoverMouseEnter}
                onMouseLeave={handlePopoverMouseLeave}
            />

            {/* Pause Learning Modal */}
            <PauseLearningModal
                isOpen={!!pauseStudentTarget}
                onClose={() => setPauseStudentTarget(null)}
                student={pauseStudentTarget}
                onSuccess={(updatedStudent) => {
                    setStudents(prev => prev.map(s => s.id === updatedStudent.id ? { 
                        ...s, 
                        status: 'Inactive', 
                        batch: 'KFA Learning Circle', 
                        classroom_name: 'KFA Learning Circle' 
                    } : s));
                    router.refresh();
                }}
            />

            {/* Resume Learning Modal */}
            <ResumeLearningModal
                isOpen={!!resumeStudentTarget}
                onClose={() => setResumeStudentTarget(null)}
                student={resumeStudentTarget}
                classrooms={classrooms}
                onSuccess={(updatedStudent) => {
                    setStudents(prev => prev.map(s => s.id === updatedStudent.id ? { 
                        ...s, 
                        status: 'Active', 
                        batch: updatedStudent.batch, 
                        classroom_name: updatedStudent.batch, 
                        classroom_id: updatedStudent.classroom_id,
                        fees_collection_date: updatedStudent.fees_collection_date
                    } : s));
                    router.refresh();
                }}
            />
        </div>
    );
}
