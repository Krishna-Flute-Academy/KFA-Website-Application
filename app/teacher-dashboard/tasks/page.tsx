'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { Loader2, Search, Bell, UserCircle, Filter, Info, PlayCircle, CheckCircle, Save, X, ClipboardList, Plus, ChevronLeft, ChevronRight, Trash2, ChevronDown, ChevronUp, Edit2, Download, Upload, Library, Paperclip, Send, FileText, Clock, BookOpen, Video, Music, Image as ImageIcon, Mic, ExternalLink, Folder } from 'lucide-react';
import TeacherSidebar from '../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../src/components/TeacherHeader';
import Link from 'next/link';
import { sendClassroomNotification } from '../../../src/lib/notifications';
// Note: task reminders are triggered via the API route to avoid client-side Supabase auth issues
import { sortClassroomsByDayAndTime } from '../../../src/lib/classroomSort';
import AudioRecorderWidget from '../../../src/components/AudioRecorderWidget';
import AutoLinkText from '../../../src/components/common/AutoLinkText';

interface Classroom {
    id: string;
    name: string;
    teacher_id?: string;
}

interface Student {
    id: string;
    name: string;
    profile_pic_url?: string;
    selected: boolean;
    classroom_ids: string[];
    classroom_names?: string[];
}

export interface AssignmentBatch {
    assignmentId: string;
    classroomName: string;
    classroomId?: string;
    targetType: string;
    dueDate?: string | null;
    createdAt?: string | null;
    isDraft: boolean;
    submissions: TaskSubmission[];
}

export interface TaskTemplateGroup {
    templateKey: string;
    taskTitle: string;
    taskDescription?: string;
    inventoryRefType?: string | null;
    inventoryRefId?: string | null;
    inventoryRefTitle?: string | null;
    fileUrl?: string;
    fileName?: string;
    fileSize?: string | number | null;
    batches: AssignmentBatch[];
    totalStudents: number;
    submittedCount: number;
    reviewedCount: number;
    approvedCount: number;
    pendingCount: number;
    isDraftOnly: boolean;
}

interface TaskSubmission {
    id: string;
    student_id: string;
    student_name: string;
    student_profile_pic_url?: string;
    task_id: string;
    task_title: string;
    task_description?: string;
    status: 'pending' | 'submitted' | 'reviewed' | 'approved' | 'draft';
    submitted_at: string;
    video_url?: string;
    feedback_text?: string;
    score?: number;
    proficiency_level?: string;
    student_notes?: string;
    classroom_id?: string;
    classroom_name?: string;
    file_url?: string;
    file_name?: string;
    file_size?: string | number | null;
    due_date?: string | null;
    inventory_ref_id?: string | null;
    inventory_ref_title?: string | null;
    inventory_ref_type?: string | null;
}

export default function TaskReviewPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<{ id?: string; name: string; email: string; phone?: string | null; role?: string; profile_pic_url?: string | null } | null>(null);
    const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
    const [filteredSubmissions, setFilteredSubmissions] = useState<TaskSubmission[]>([]);
    const [selectedSub, setSelectedSub] = useState<TaskSubmission | null>(null);
    const [activeTab, setActiveTab] = useState<'all' | 'assigned' | 'submitted' | 'reviewed' | 'approved' | 'draft'>('all');

    const tabConfig = [
        { id: 'all',       label: 'All Templates',  color: 'text-slate-600' },
        { id: 'assigned',  label: 'Active Batches', color: 'text-blue-600' },
        { id: 'submitted', label: 'Submitted',      color: 'text-amber-600' },
        { id: 'reviewed',  label: 'Reviewed',       color: 'text-purple-600' },
        { id: 'approved',  label: 'Approved',       color: 'text-emerald-600' },
        { id: 'draft',     label: 'Drafts',         color: 'text-slate-400' },
    ] as const;

    const formatFileSize = (size: number | string | null | undefined): string => {
        if (!size) return '';
        if (typeof size === 'number') {
            if (size < 1024) return `${size} B`;
            if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
            return `${(size / (1024 * 1024)).toFixed(1)} MB`;
        }
        return size;
    };

    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 12;
    const [isSaving, setIsSaving] = useState(false);
    const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const [collapsedTasks, setCollapsedTasks] = useState<Record<string, boolean>>({});

    // Classroom & Target Filter state
    const [targetFilter, setTargetFilter] = useState<'all' | 'classroom' | 'individual' | 'all_students'>('all');
    const [selectedFilterClassroomId, setSelectedFilterClassroomId] = useState<string>('all');
    
    // Task Creation Form states
    const isPopup = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('popup') === 'true';
    const isCreate = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('create') === 'true';
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(isPopup || isCreate);
    const [assignmentTargetMode, setAssignmentTargetMode] = useState<'classroom' | 'individual' | 'all'>('classroom');
    const [createTitle, setCreateTitle] = useState('');
    const [createDescription, setCreateDescription] = useState('');
    const [createDueDate, setCreateDueDate] = useState('');
    const [createClassrooms, setCreateClassrooms] = useState<Classroom[]>([]);
    const [createSelectedClassroom, setCreateSelectedClassroom] = useState<string>('all');
    const [createStudents, setCreateStudents] = useState<Student[]>([]);
    const [createSelectAll, setCreateSelectAll] = useState(true);
    const [createStudentSearch, setCreateStudentSearch] = useState('');
    const [createStudentPage, setCreateStudentPage] = useState(1);

    const formatDateForInput = (dateVal: any): string => {
        if (!dateVal) return '';
        const str = String(dateVal).trim();
        if (str.includes('T')) return str.split('T')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
        const d = new Date(str);
        if (isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const handleQuickUpdateDueDate = async (taskId: string, newDueDate: string) => {
        try {
            const { error } = await supabaseAuth
                .from('assignments')
                .update({ due_date: newDueDate || null })
                .eq('id', taskId);

            if (error) throw error;

            setSubmissions(prev => prev.map(s => s.task_id === taskId ? { ...s, due_date: newDueDate || null } : s));
            setFilteredSubmissions(prev => prev.map(s => s.task_id === taskId ? { ...s, due_date: newDueDate || null } : s));
            if (selectedSub && selectedSub.task_id === taskId) {
                setSelectedSub(prev => prev ? { ...prev, due_date: newDueDate || null } : null);
            }
        } catch (err) {
            console.error('Error updating task due date:', err);
            alert('Could not update due date.');
        }
    };
    
    // Suggestion and previous tasks state
    const [previousTasks, setPreviousTasks] = useState<any[]>([]);
    const [selectedPreviousTaskId, setSelectedPreviousTaskId] = useState<string | null>(null);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Attachment file state
    const [createFileUrl, setCreateFileUrl] = useState('');
    const [createFileName, setCreateFileName] = useState('');
    const [createFileSize, setCreateFileSize] = useState<number | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    
    // Curriculum topic reference state
    const [createSelectedLessonId, setCreateSelectedLessonId] = useState<string | null>(null);
    const [createSelectedLessonTitle, setCreateSelectedLessonTitle] = useState<string | null>(null);
    
    // Inventory selection & audio recorder sub-modal state
    const [isInventoryOpen, setIsInventoryOpen] = useState(false);
    const [showAudioRecorder, setShowAudioRecorder] = useState(false);
    const [inventoryLessons, setInventoryLessons] = useState<any[]>([]);
    const [selectedOverviewTask, setSelectedOverviewTask] = useState<TaskSubmission | null>(null);

    // Curriculum hierarchy for Inventory Library
    const [inventoryCategories, setInventoryCategories] = useState<any[]>([]);
    const [inventoryModules, setInventoryModules] = useState<any[]>([]);
    const [inventoryChapters, setInventoryChapters] = useState<any[]>([]);
    const [inventorySearchQuery, setInventorySearchQuery] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
    const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
    const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});

    const fileInputRef = React.useRef<HTMLInputElement>(null);
    
    // Grading form state
    const [score, setScore] = useState<number | ''>('');
    const [proficiency, setProficiency] = useState('');
    const [feedback, setFeedback] = useState('');
    const [reassign, setReassign] = useState(false);

    const fetchSubmissions = useCallback(async (userId: string, isAdmin: boolean = false) => {
        console.log('Fetching submissions for teacher:', userId, 'isAdmin:', isAdmin);
        
        // Trigger automated 2-day pre-due-date task reminders via server API (avoids client-side Supabase auth issues)
        fetch('/api/notifications/check-task-reminders', { method: 'POST' }).catch(err => console.error('Error running task reminders:', err));

        try {
            // Step 1: Get classroom IDs and names (filtered if not admin)
            let classroomQuery = supabaseAuth
                .from('classrooms')
                .select('id, name');
            if (!isAdmin) {
                classroomQuery = classroomQuery.eq('teacher_id', userId);
            }
            const { data: classrooms, error: classroomError } = await classroomQuery;

            if (classroomError) {
                console.error('Error fetching classrooms:', classroomError);
                return;
            }

            const classroomIds = (classrooms || []).map(c => c.id);

            if (classroomIds.length === 0) {
                console.log('No classrooms found for this teacher');
                setSubmissions([]);
                setFilteredSubmissions([]);
                return;
            }

            // Step 2 & 3 in parallel: Fetch enrollments AND assignments concurrently!
            const enrollmentsReq = supabaseAuth
                .from('classroom_students')
                .select(`
                    classroom_id,
                    student_id,
                    users!student_id(name, profile_pic_url, teacher_id)
                `)
                .in('classroom_id', classroomIds);

            const assignmentsReq = supabaseAuth
                .from('assignments')
                .select('id, title, description, created_at, due_date, target_type, classroom_id, status, inventory_ref_type, inventory_ref_id, inventory_ref_title, file_url, file_name, file_size')
                .in('classroom_id', classroomIds);

            const [
                { data: enrollments, error: enrollError },
                res
            ] = await Promise.all([
                enrollmentsReq,
                assignmentsReq
            ]);

            if (enrollError) {
                console.error('Error fetching enrolled students:', enrollError);
                return;
            }

            const rawEnrollments = enrollments || [];
            const filteredEnrollments = rawEnrollments.filter((e: any) => isAdmin || e.users?.teacher_id === userId);
            const studentsList = filteredEnrollments;
            const studentIds = [...new Set(studentsList.map(e => e.student_id))];

            if (studentIds.length === 0) {
                console.log('No students enrolled in classrooms');
            }

            let assignmentsList: any[] | null = res.data;
            let assignmentsError = res.error;

            if (assignmentsError && (assignmentsError.code === '42703' || assignmentsError.message?.includes('status'))) {
                console.warn('status column missing in assignments, running fallback...');
                const fallback = await supabaseAuth
                    .from('assignments')
                    .select('id, title, description, created_at, due_date, target_type, classroom_id, inventory_ref_type, inventory_ref_id, inventory_ref_title, file_url, file_name, file_size')
                    .in('classroom_id', classroomIds);
                
                assignmentsList = fallback.data;
                assignmentsError = fallback.error;
                
                // Ultimate fallback if ALL new columns are missing
                if (assignmentsError && assignmentsError.code === '42703') {
                    console.warn('Other new columns missing (file_url, etc). Running ultimate fallback...');
                    const ultimate = await supabaseAuth
                        .from('assignments')
                        .select('id, title, description, created_at, due_date, target_type, classroom_id')
                        .in('classroom_id', classroomIds);
                    assignmentsList = ultimate.data;
                    assignmentsError = ultimate.error;
                }
            }

            if (assignmentsError) {
                console.error('Error fetching classroom assignments:', assignmentsError);
                return;
            }

            const assignmentIds = (assignmentsList || []).map(a => a.id);

            if (assignmentIds.length === 0) {
                console.log('No assignments created for this teacher\'s classrooms');
                setSubmissions([]);
                setFilteredSubmissions([]);
                return;
            }

            // Step 4: Fetch assignment_students (to get submission statuses, scores, etc.)
            let { data: assignmentStudents, error: asgStudentsError } = await supabaseAuth
                .from('assignment_students')
                .select(`
                    id,
                    status,
                    score,
                    proficiency_level,
                    feedback_text,
                    video_url,
                    submitted_at,
                    student_id,
                    assignment_id
                `)
                .in('assignment_id', assignmentIds);

            // FALLBACK: If custom columns don't exist yet, fallback gracefully
            if (asgStudentsError && (asgStudentsError.code === '42703' || asgStudentsError.message?.includes('score') || asgStudentsError.message?.includes('feedback_text'))) {
                console.warn('Custom grading columns missing in assignment_students, trying fallback query...');
                const fallback = await supabaseAuth
                    .from('assignment_students')
                    .select(`
                        id,
                        status,
                        student_id,
                        assignment_id
                    `)
                    .in('assignment_id', assignmentIds);
                
                assignmentStudents = fallback.data as any[];
                asgStudentsError = fallback.error;
            }

            if (asgStudentsError) {
                console.error('Supabase Query Error fetching assignment_students:', asgStudentsError);
                return;
            }

            // Step 5: Merge and construct list of tasks/attempts
            const formatted: TaskSubmission[] = [];

            (assignmentsList || []).forEach(asg => {
                // Hide auto-assigned curriculum progress mapping items from tasks dashboard
                const isAutoCurriculum = asg.inventory_ref_type && 
                    asg.title === asg.inventory_ref_title;
                if (isAutoCurriculum) return;
                
                const associatedClassroomStudents = studentsList.filter(s => s.classroom_id === asg.classroom_id);
                const classInfo = (classrooms || []).find(c => c.id === asg.classroom_id);
                const className = classInfo?.name || 'Unknown Class';
                
                if ((asg as any).status === 'draft') {
                    formatted.push({
                        id: `draft-${asg.id}`,
                        student_id: 'draft',
                        student_name: 'No Students Assigned',
                        student_profile_pic_url: undefined,
                        task_id: asg.id,
                        task_title: asg.title || 'Unknown Assignment',
                        task_description: asg.description || '',
                        status: 'draft' as any,
                        submitted_at: asg.created_at || new Date().toISOString(),
                        video_url: '',
                        feedback_text: '',
                        score: undefined,
                        proficiency_level: '',
                        student_notes: '',
                        classroom_id: asg.classroom_id,
                        classroom_name: className,
                        due_date: asg.due_date || null,
                        inventory_ref_type: asg.inventory_ref_type || null,
                        inventory_ref_id: asg.inventory_ref_id || null,
                        inventory_ref_title: asg.inventory_ref_title || null
                    });
                    return;
                }

                if (asg.target_type === 'individual') {
                    // For individual assignments, only show students who have a row in assignment_students
                    const mappingRows = (assignmentStudents || []).filter(row => row.assignment_id === asg.id);
                    if (mappingRows.length === 0) {
                        formatted.push({
                            id: `no-students-${asg.id}`,
                            student_id: 'no-students',
                            student_name: 'No Students Assigned',
                            student_profile_pic_url: undefined,
                            task_id: asg.id,
                            task_title: asg.title || 'Unknown Assignment',
                            task_description: asg.description || '',
                            status: 'pending',
                            submitted_at: asg.created_at || new Date().toISOString(),
                            video_url: '',
                            feedback_text: '',
                            score: undefined,
                            proficiency_level: '',
                            student_notes: '',
                            classroom_id: asg.classroom_id,
                            classroom_name: className,
                            file_url: asg.file_url || '',
                            file_name: asg.file_name || '',
                            file_size: asg.file_size || null,
                            due_date: asg.due_date || null,
                            inventory_ref_type: asg.inventory_ref_type || null,
                            inventory_ref_id: asg.inventory_ref_id || null,
                            inventory_ref_title: asg.inventory_ref_title || null
                        });
                    } else {
                        mappingRows.forEach(row => {
                            const studentInfo = studentsList.find(s => s.student_id === row.student_id);
                            const studentClassInfo = (classrooms || []).find(c => c.id === studentInfo?.classroom_id);
                            const studentClassName = studentClassInfo?.name || className;
                            
                            formatted.push({
                                id: row.id,
                                student_id: row.student_id,
                                student_name: (studentInfo?.users as any)?.name || 'Unknown Student',
                                student_profile_pic_url: (studentInfo?.users as any)?.profile_pic_url,
                                task_id: asg.id,
                                task_title: asg.title || 'Unknown Assignment',
                                task_description: asg.description || '',
                                status: row.status || 'pending',
                                submitted_at: row.submitted_at || asg.created_at || new Date().toISOString(),
                                video_url: row.video_url || '',
                                feedback_text: row.feedback_text || '',
                                score: row.score !== undefined ? row.score : undefined,
                                proficiency_level: row.proficiency_level || '',
                                student_notes: '',
                                classroom_id: studentInfo?.classroom_id || asg.classroom_id,
                                classroom_name: studentClassName,
                                file_url: asg.file_url || '',
                                file_name: asg.file_name || '',
                                file_size: asg.file_size || null,
                                due_date: asg.due_date || null,
                                inventory_ref_type: asg.inventory_ref_type || null,
                                inventory_ref_id: asg.inventory_ref_id || null,
                                inventory_ref_title: asg.inventory_ref_title || null
                            });
                        });
                    }
                } else {
                    // For "all" (Everyone) assignments, implicitly show EVERY student in the classroom!
                    if (associatedClassroomStudents.length === 0) {
                        formatted.push({
                            id: `no-students-${asg.id}`,
                            student_id: 'no-students',
                            student_name: 'No Students Assigned',
                            student_profile_pic_url: undefined,
                            task_id: asg.id,
                            task_title: asg.title || 'Unknown Assignment',
                            task_description: asg.description || '',
                            status: 'pending',
                            submitted_at: asg.created_at || new Date().toISOString(),
                            video_url: '',
                            feedback_text: '',
                            score: undefined,
                            proficiency_level: '',
                            student_notes: '',
                            classroom_id: asg.classroom_id,
                            classroom_name: className,
                            file_url: asg.file_url || '',
                            file_name: asg.file_name || '',
                            file_size: asg.file_size || null,
                            due_date: asg.due_date || null,
                            inventory_ref_type: asg.inventory_ref_type || null,
                            inventory_ref_id: asg.inventory_ref_id || null,
                            inventory_ref_title: asg.inventory_ref_title || null
                        });
                    } else {
                        associatedClassroomStudents.forEach(studentInfo => {
                            // Check if they already have an assignment_students row
                            const existingRow = (assignmentStudents || []).find(row => row.assignment_id === asg.id && row.student_id === studentInfo.student_id);
                            
                            formatted.push({
                                id: existingRow?.id || `temp-impl-${asg.id}-${studentInfo.student_id}`, // virtual ID
                                student_id: studentInfo.student_id,
                                student_name: (studentInfo.users as any)?.name || 'Unknown Student',
                                student_profile_pic_url: (studentInfo.users as any)?.profile_pic_url,
                                task_id: asg.id,
                                task_title: asg.title || 'Unknown Assignment',
                                task_description: asg.description || '',
                                status: existingRow?.status || 'pending',
                                submitted_at: existingRow?.submitted_at || asg.created_at || new Date().toISOString(),
                                video_url: existingRow?.video_url || '',
                                feedback_text: existingRow?.feedback_text || '',
                                score: existingRow?.score !== undefined ? existingRow?.score : undefined,
                                proficiency_level: existingRow?.proficiency_level || '',
                                student_notes: '',
                                classroom_id: asg.classroom_id,
                                classroom_name: className,
                                file_url: asg.file_url || '',
                                file_name: asg.file_name || '',
                                file_size: asg.file_size || null,
                                due_date: asg.due_date || null,
                                inventory_ref_type: asg.inventory_ref_type || null,
                                inventory_ref_id: asg.inventory_ref_id || null,
                                inventory_ref_title: asg.inventory_ref_title || null
                            });
                        });
                    }
                }
            });

            // Order by date descending
            formatted.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());

            setSubmissions(formatted);
            setFilteredSubmissions(formatted);

        } catch (err) {
            console.error('CRITICAL RUNTIME ERROR in fetchSubmissions:', err);
        }
    }, [selectedSub]);

    // SWR Cache Saver for Tasks
    useEffect(() => {
        if (submissions.length === 0) return;
        const timer = setTimeout(() => {
            try {
                const cacheData = { submissions, teacherProfile };
                localStorage.setItem('kfa_tasks_cache', JSON.stringify(cacheData));
            } catch (e) { console.error('Tasks cache save error:', e); }
        }, 300);
        return () => clearTimeout(timer);
    }, [submissions, teacherProfile]);

    useEffect(() => {
        let hasCachedData = false;
        try {
            const cached = localStorage.getItem('kfa_tasks_cache');
            if (cached) {
                const data = JSON.parse(cached);
                if (data.submissions) {
                    setSubmissions(data.submissions);
                    setFilteredSubmissions(data.submissions);
                }
                if (data.teacherProfile) setTeacherProfile(data.teacherProfile);
                setLoading(false);
                hasCachedData = true;
            }
        } catch (e) { console.error('Tasks cache load error:', e); }

        const checkAuth = async () => {
            if (!hasCachedData) setLoading(true);
            const { data: { session } } = await supabaseAuth.auth.getSession();
            if (!session) {
                router.push('/login?type=teacher');
                return;
            }

            // Clear unread task notifications asynchronously
            supabaseAuth
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', session.user.id)
                .eq('type', 'tasks')
                .eq('is_read', false);

            const { data: profile } = await supabaseAuth
                .from('users')
                .select('id, name, email, phone, role, profile_pic_url')
                .eq('id', session.user.id)
                .single();

            if (profile?.role !== 'teacher' && profile?.role !== 'admin') {
                router.push('/');
                return;
            }

            const isAdmin = profile.role === 'admin';
            setTeacherProfile({ id: profile.id, name: profile.name, email: profile.email, phone: profile.phone, role: profile.role, profile_pic_url: profile.profile_pic_url });
            await fetchSubmissions(session.user.id, isAdmin);
            await loadCreationData(session.user.id, isAdmin);
            setLoading(false);
        };

        checkAuth();
    }, [router, fetchSubmissions]);

    useEffect(() => {
        if (isCreateModalOpen && teacherProfile?.id) {
            const isAdmin = teacherProfile.role === 'admin';
            loadCreationData(teacherProfile.id, isAdmin);
        }
    }, [isCreateModalOpen, teacherProfile?.id, teacherProfile?.role]);

    useEffect(() => {
        setCurrentPage(1);
        let result = submissions;

        // 1. Target & Classroom Filter
        if (targetFilter === 'classroom') {
            if (selectedFilterClassroomId !== 'all') {
                result = result.filter(s => s.classroom_id === selectedFilterClassroomId);
            } else {
                result = result.filter(s => !!s.classroom_id);
            }
        } else if (targetFilter === 'individual') {
            result = result.filter(s => s.student_id !== 'no-students' && s.student_id !== 'draft');
        } else if (targetFilter === 'all_students') {
            result = result.filter(s => !s.classroom_id || (s.classroom_name && s.classroom_name.toLowerCase().includes('all')));
        }

        // 2. Status Tab Filter
        if (activeTab !== 'all') {
            if (activeTab === 'assigned') {
                // 'assigned' = active tasks with status pending (awaiting student submission)
                result = result.filter(s => s.status === 'pending' && s.student_id !== 'draft' && s.student_id !== 'no-students');
            } else if (activeTab === 'draft') {
                result = result.filter(s => s.status === 'draft');
            } else if (activeTab === 'reviewed') {
                // only reviewed (needs revision) tasks are reviewed
                result = result.filter(s => s.status === 'reviewed');
            } else {
                result = result.filter(s => s.status.toLowerCase() === activeTab);
            }
        }

        // 3. Search Query Filter
        if (searchQuery.trim() !== '') {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(s =>
                s.student_name.toLowerCase().includes(lowerQuery) ||
                s.task_title.toLowerCase().includes(lowerQuery) ||
                (s.classroom_name && s.classroom_name.toLowerCase().includes(lowerQuery))
            );
        }
        setFilteredSubmissions(result);
    }, [activeTab, submissions, searchQuery, targetFilter, selectedFilterClassroomId]);

    const handleSelectSubmission = (sub: TaskSubmission) => {
        setSelectedSub(sub);
        setScore(sub.score || '');
        setProficiency(sub.proficiency_level || '');
        setFeedback(sub.feedback_text || '');
        setReassign(false);
    };

    const handleSaveReview = async () => {
        if (!selectedSub) return;
        setIsSaving(true);

        try {
            const newStatus = reassign ? 'reviewed' : 'approved';
            const updates = {
                status: newStatus,
                score: score === '' ? null : score,
                proficiency_level: proficiency,
                feedback_text: feedback,
                submitted_at: new Date().toISOString()
            };

            const isTemp = selectedSub.id.startsWith('temp-impl-');
            let dbError;

            if (isTemp) {
                // Insert a new row
                const { data: newRow, error: insertError } = await supabaseAuth
                    .from('assignment_students')
                    .insert({
                        assignment_id: selectedSub.task_id,
                        student_id: selectedSub.student_id,
                        ...updates
                    })
                    .select()
                    .single();
                
                dbError = insertError;
                if (!insertError && newRow) {
                    selectedSub.id = newRow.id;
                }
            } else {
                // Update existing row
                const { error: updateError } = await supabaseAuth
                    .from('assignment_students')
                    .update(updates)
                    .eq('id', selectedSub.id);
                
                dbError = updateError;
            }

            if (dbError) {
                console.warn('Columns on assignment_students table might be missing, running fallback save...', dbError);
                if (isTemp) {
                    const { data: newRow, error: fallbackError } = await supabaseAuth
                        .from('assignment_students')
                        .insert({
                            assignment_id: selectedSub.task_id,
                            student_id: selectedSub.student_id,
                            status: newStatus
                        })
                        .select()
                        .single();
                    if (fallbackError) throw fallbackError;
                    if (newRow) selectedSub.id = newRow.id;
                } else {
                    const { error: fallbackError } = await supabaseAuth
                        .from('assignment_students')
                        .update({ status: newStatus })
                        .eq('id', selectedSub.id);
                    if (fallbackError) throw fallbackError;
                }
            }

            // Update local state
            const updatedSubmissions = submissions.map(s => 
                s.student_id === selectedSub.student_id && s.task_id === selectedSub.task_id 
                    ? { ...s, ...updates, id: selectedSub.id, status: newStatus as any } 
                    : s
            );
            setSubmissions(updatedSubmissions);
            setSelectedSub({ ...selectedSub, ...updates, status: newStatus as any });

            // Send notification to the student
            try {
                const { data: { session } } = await supabaseAuth.auth.getSession();
                const teacherId = session?.user?.id || '';
                
                await sendClassroomNotification({
                    teacherId: teacherId || '',
                    recipients: [{ id: selectedSub.student_id, name: selectedSub.student_name, type: 'student' }],
                    title: newStatus === 'approved' ? `✅ Task Approved: ${selectedSub.task_title}` : `📝 Task Reviewed: ${selectedSub.task_title}`,
                    message: newStatus === 'approved' 
                        ? `Your submission for "${selectedSub.task_title}" has been approved!${score ? ` Score: ${score}/10.` : ''}`
                        : `Your submission for "${selectedSub.task_title}" has been reviewed and needs revision.${feedback ? ` Feedback: "${feedback}"` : ''}`,
                    studentIds: [selectedSub.student_id]
                });
            } catch (notifErr) {
                console.error('Failed to send notification for task review:', notifErr);
            }

            alert('Review saved successfully');

        } catch (error: any) {
            console.error('Error updating review:', error);
            alert(`Failed to save review: ${error.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const loadCreationData = async (teacherId: string, isAdmin: boolean = false) => {
        try {
            const userIsAdmin = isAdmin || teacherProfile?.role === 'admin';

            // Fetch classrooms
            let classroomQuery = supabaseAuth
                .from('classrooms')
                .select('id, name, teacher_id');
            if (!userIsAdmin) {
                classroomQuery = classroomQuery.eq('teacher_id', teacherId);
            }
            const { data: classes } = await classroomQuery;
            
            if (classes) {
                setCreateClassrooms(classes);
            }

            // Fetch previous assignments
            let prevTasksQuery = supabaseAuth
                .from('assignments')
                .select('id, title, description, due_date, classroom_id, target_type, status, inventory_ref_type, inventory_ref_id, inventory_ref_title, file_url, file_name, file_size');
            if (!userIsAdmin) {
                prevTasksQuery = prevTasksQuery.eq('teacher_id', teacherId);
            }
            const { data: prevTasks } = await prevTasksQuery;
            
            if (prevTasks) {
                const manualPrevTasks = prevTasks.filter((t: any) => {
                    const isAutoCurriculum = t.inventory_ref_type && 
                        t.title === t.inventory_ref_title;
                    return !isAutoCurriculum;
                });
                setPreviousTasks(manualPrevTasks);
            }

            // Fetch curriculum categories
            const { data: categoriesData } = await supabaseAuth
                .from('course_categories')
                .select('*')
                .order('category_order', { ascending: true });
            if (categoriesData) {
                setInventoryCategories(categoriesData);
            }

            // Fetch curriculum modules
            const { data: modulesData } = await supabaseAuth
                .from('course_modules')
                .select('*')
                .order('module_number', { ascending: true });
            if (modulesData) {
                setInventoryModules(modulesData);
            }

            // Fetch curriculum chapters
            const { data: chaptersData } = await supabaseAuth
                .from('course_chapters')
                .select('*')
                .order('chapter_number', { ascending: true });
            if (chaptersData) {
                setInventoryChapters(chaptersData);
            }

            // Fetch curriculum lessons for Inventory Library
            const { data: lessonsData } = await supabaseAuth
                .from('course_lessons')
                .select('*')
                .order('lesson_number', { ascending: true });
            if (lessonsData) {
                setInventoryLessons(lessonsData);
            }

            // Fetch all students enrolled or override in teacher's classrooms, plus direct student profiles
            let studentIds: string[] = [];
            const studentClassroomMap: Record<string, string[]> = {};

            if (classes && classes.length > 0) {
                const classIds = classes.map((c: any) => c.id);
                const [enrollmentsRes, overridesRes] = await Promise.all([
                    supabaseAuth.from('classroom_students').select('student_id, classroom_id').in('classroom_id', classIds),
                    supabaseAuth.from('session_student_overrides').select('student_id, target_classroom_id').in('target_classroom_id', classIds)
                ]);

                const enrollments = enrollmentsRes.data || [];
                const overrides = overridesRes.data || [];

                enrollments.forEach((e: any) => {
                    if (!studentClassroomMap[e.student_id]) {
                        studentClassroomMap[e.student_id] = [];
                    }
                    if (!studentClassroomMap[e.student_id].includes(e.classroom_id)) {
                        studentClassroomMap[e.student_id].push(e.classroom_id);
                    }
                });

                overrides.forEach((o: any) => {
                    if (!studentClassroomMap[o.student_id]) {
                        studentClassroomMap[o.student_id] = [];
                    }
                    if (!studentClassroomMap[o.student_id].includes(o.target_classroom_id)) {
                        studentClassroomMap[o.student_id].push(o.target_classroom_id);
                    }
                });

                studentIds = [...new Set([
                    ...enrollments.map((e: any) => e.student_id),
                    ...overrides.map((o: any) => o.student_id)
                ])];
            }

            // Also fetch all student profiles assigned to this teacher directly
            let studentsUserQuery = supabaseAuth
                .from('users')
                .select('id, name, profile_pic_url')
                .or('role.eq.student,role.eq.pending,role.eq.mentor');
            
            if (!userIsAdmin) {
                studentsUserQuery = studentsUserQuery.eq('teacher_id', teacherId);
            }

            const { data: directStudents } = await studentsUserQuery;
            if (directStudents) {
                directStudents.forEach(item => {
                    if (!studentIds.includes(item.id)) {
                        studentIds.push(item.id);
                    }
                });
            }

            if (studentIds.length > 0) {
                const { data: usersData } = await supabaseAuth
                    .from('users')
                    .select('id, name, profile_pic_url, teacher_id')
                    .in('id', studentIds);

                const classroomNameMap: Record<string, string> = {};
                (classes || []).forEach((c: any) => {
                    classroomNameMap[c.id] = c.name;
                });

                if (usersData) {
                    const formatted = usersData
                        .map((item: any) => {
                            const cids = studentClassroomMap[item.id] || [];
                            const cnames = cids.map(cid => classroomNameMap[cid]).filter(Boolean);
                            return {
                                id: item.id,
                                name: item.name || 'Unknown Student',
                                profile_pic_url: item.profile_pic_url || null,
                                selected: false,
                                classroom_ids: cids,
                                classroom_names: cnames
                            };
                        });
                    setCreateStudents(formatted);
                }
            } else {
                setCreateStudents([]);
            }
        } catch (err) {
            console.error('Error loading creation details:', err);
        }
    };

    const filteredCreateStudents = React.useMemo(() => {
        let result = createStudents;
        if (assignmentTargetMode === 'classroom') {
            if (createSelectedClassroom && createSelectedClassroom !== 'all') {
                result = result.filter(s => s.classroom_ids?.includes(createSelectedClassroom));
            }
        } else if (assignmentTargetMode === 'individual') {
            if (createSelectedClassroom && createSelectedClassroom !== 'all') {
                result = result.filter(s => s.classroom_ids?.includes(createSelectedClassroom));
            }
        }
        if (createStudentSearch.trim() !== '') {
            const lowerQuery = createStudentSearch.toLowerCase().trim();
            result = result.filter(s => 
                s.name.toLowerCase().includes(lowerQuery) ||
                (s.classroom_names && s.classroom_names.some(cn => cn.toLowerCase().includes(lowerQuery)))
            );
        }
        return result;
    }, [createStudents, assignmentTargetMode, createSelectedClassroom, createStudentSearch]);

    useEffect(() => {
        setCreateStudentPage(1);
    }, [createSelectedClassroom, createStudentSearch, assignmentTargetMode]);

    const selectedInFilteredCount = useMemo(() => {
        return filteredCreateStudents.filter(s => s.selected).length;
    }, [filteredCreateStudents]);

    const totalSelectedCount = useMemo(() => {
        return createStudents.filter(s => s.selected).length;
    }, [createStudents]);

    const isAllFilteredSelected = useMemo(() => {
        return filteredCreateStudents.length > 0 && filteredCreateStudents.every(s => s.selected);
    }, [filteredCreateStudents]);

    const filteredPreviousTasks = React.useMemo(() => {
        const seen = new Set<string>();
        const unique: any[] = [];
        previousTasks.forEach(task => {
            const normalizedTitle = (task.title || '').toLowerCase().trim();
            if (normalizedTitle && !seen.has(normalizedTitle)) {
                seen.add(normalizedTitle);
                unique.push(task);
            }
        });

        if (!createTitle.trim()) return unique;
        const lowerTitle = createTitle.toLowerCase();
        return unique.filter(t => t.title?.toLowerCase().includes(lowerTitle));
    }, [previousTasks, createTitle]);

    const getCategoryForModule = (mod: any, categories: any[]) => {
        if (mod.category_id) {
            const cat = categories.find(c => c.id === mod.category_id);
            if (cat) return { id: cat.id, name: cat.name };
        }
        const desc = mod.description || '';
        const match = desc.match(/^\[(.*?)\]/);
        if (match) {
            const catName = match[1].trim();
            const cat = categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
            if (cat) return { id: cat.id, name: cat.name };
            return { id: catName, name: catName };
        }
        const defaultCatName = mod.module_number < 100 ? 'Proficiency Levels' : 'Specialized Modules';
        const cat = categories.find(c => c.name.toLowerCase() === defaultCatName.toLowerCase());
        if (cat) return { id: cat.id, name: cat.name };
        return { id: 'default', name: defaultCatName };
    };

    const getLessonMaterialIcon = (type: string, hasUrl: boolean) => {
        if (!hasUrl) return <FileText className="w-3.5 h-3.5 text-slate-400" />;
        switch (type?.toLowerCase()) {
            case 'pdf': return <FileText className="w-3.5 h-3.5 text-red-500" />;
            case 'video': return <Video className="w-3.5 h-3.5 text-amber-550" />;
            case 'audio': return <Music className="w-3.5 h-3.5 text-blue-500" />;
            case 'image': return <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />;
            default: return <FileText className="w-3.5 h-3.5 text-slate-500" />;
        }
    };

    const filteredCurriculumTree = useMemo(() => {
        const query = inventorySearchQuery.trim().toLowerCase();
        
        const categoriesMap: Record<string, { id: string; name: string; modules: any[] }> = {};
        
        inventoryCategories.forEach(cat => {
            categoriesMap[cat.id] = { id: cat.id, name: cat.name, modules: [] };
        });
        
        const modulesMap: Record<string, { id: string; title: string; module_number: number; chapters: any[] }> = {};
        inventoryModules.forEach(mod => {
            const catInfo = getCategoryForModule(mod, inventoryCategories);
            if (!categoriesMap[catInfo.id]) {
                categoriesMap[catInfo.id] = { id: catInfo.id, name: catInfo.name, modules: [] };
            }
            
            const modNode = { id: mod.id, title: mod.title, module_number: mod.module_number, chapters: [] };
            modulesMap[mod.id] = modNode;
            categoriesMap[catInfo.id].modules.push(modNode);
        });
        
        const chaptersMap: Record<string, { id: string; title: string; chapter_number: number; lessons: any[] }> = {};
        inventoryChapters.forEach(chap => {
            const chapNode = { id: chap.id, title: chap.title, chapter_number: chap.chapter_number, lessons: [] };
            chaptersMap[chap.id] = chapNode;
            
            const modNode = modulesMap[chap.module_id];
            if (modNode) {
                modNode.chapters.push(chapNode);
            }
        });
        
        inventoryLessons.forEach(lesson => {
            const chapNode = chaptersMap[lesson.chapter_id];
            if (chapNode) {
                chapNode.lessons.push(lesson);
            }
        });

        const result: any[] = [];

        Object.values(categoriesMap).forEach(cat => {
            const catMatches = cat.name.toLowerCase().includes(query);
            const filteredModules: any[] = [];
            
            cat.modules.forEach(mod => {
                const modMatches = mod.title.toLowerCase().includes(query);
                const filteredChapters: any[] = [];
                
                mod.chapters.forEach(chap => {
                    const chapMatches = chap.title.toLowerCase().includes(query);
                    const filteredLessons: any[] = [];
                    
                    chap.lessons.forEach(lesson => {
                        const lessonTitleMatches = lesson.title.toLowerCase().includes(query);
                        const fileNameMatches = (lesson.file_name || '').toLowerCase().includes(query);
                        if (lessonTitleMatches || fileNameMatches || chapMatches || modMatches || catMatches) {
                            filteredLessons.push(lesson);
                        }
                    });
                    
                    if (filteredLessons.length > 0 || chapMatches) {
                        filteredChapters.push({
                            ...chap,
                            lessons: filteredLessons
                        });
                    }
                });
                
                if (filteredChapters.length > 0 || modMatches) {
                    filteredModules.push({
                        ...mod,
                        chapters: filteredChapters
                    });
                }
            });
            
            if (filteredModules.length > 0 || catMatches) {
                result.push({
                    ...cat,
                    modules: filteredModules
                });
            }
        });

        return result;
    }, [inventoryCategories, inventoryModules, inventoryChapters, inventoryLessons, inventorySearchQuery]);

    useEffect(() => {
        if (inventorySearchQuery.trim() !== '') {
            const newExpandedCats: Record<string, boolean> = {};
            const newExpandedMods: Record<string, boolean> = {};
            const newExpandedChaps: Record<string, boolean> = {};
            
            filteredCurriculumTree.forEach(cat => {
                newExpandedCats[cat.id] = true;
                cat.modules.forEach((mod: any) => {
                    newExpandedMods[mod.id] = true;
                    mod.chapters.forEach((chap: any) => {
                        newExpandedChaps[chap.id] = true;
                    });
                });
            });
            
            setExpandedCategories(newExpandedCats);
            setExpandedModules(newExpandedMods);
            setExpandedChapters(newExpandedChaps);
        }
    }, [inventorySearchQuery, filteredCurriculumTree]);

    const handleTitleChange = (newTitle: string) => {
        setCreateTitle(newTitle);
        if (selectedPreviousTaskId) {
            const matched = previousTasks.find(t => t.id === selectedPreviousTaskId);
            if (matched && matched.title !== newTitle) {
                setSelectedPreviousTaskId(null);
            }
        }
        setShowSuggestions(true);
    };

    const handleSelectPreviousTask = async (task: any) => {
        setCreateTitle(task.title || '');
        setCreateDescription(task.description || '');
        // Do not copy previous task due date - leave empty so teacher selects a new submission date
        setCreateDueDate('');
        
        setSelectedPreviousTaskId(task.id);
        setShowSuggestions(false);

        // Restore attachments, recorded voice, and curriculum references
        setCreateFileUrl(task.file_url || '');
        setCreateFileName(task.file_name || '');
        setCreateFileSize(task.file_size || null);
        setCreateSelectedLessonId(task.inventory_ref_id || null);
        setCreateSelectedLessonTitle(task.inventory_ref_title || null);
    };

    const handleClassroomChange = (classroomId: string) => {
        setCreateSelectedClassroom(classroomId);
        setCreateStudentPage(1);
        if (!editingTaskId) {
            setCreateStudents(prev => prev.map(s => ({
                ...s,
                selected: classroomId === 'all' ? true : (s.classroom_ids?.includes(classroomId) ?? false)
            })));
        }
    };

    const handleTargetModeChange = (mode: 'classroom' | 'individual' | 'all') => {
        setAssignmentTargetMode(mode);
        setCreateStudentSearch('');
        if (mode === 'classroom') {
            const firstClassId = createClassrooms[0]?.id || 'all';
            setCreateSelectedClassroom(firstClassId);
            if (!editingTaskId) {
                setCreateStudents(prev => prev.map(s => ({
                    ...s,
                    selected: s.classroom_ids?.includes(firstClassId) ?? false
                })));
            }
        } else if (mode === 'all') {
            setCreateSelectedClassroom('all');
            if (!editingTaskId) {
                setCreateStudents(prev => prev.map(s => ({ ...s, selected: true })));
            }
        } else { // 'individual'
            setCreateSelectedClassroom('all');
            if (!editingTaskId) {
                setCreateStudents(prev => prev.map(s => ({ ...s, selected: false })));
            }
        }
    };

    const handleToggleStudent = (studentId: string) => {
        setCreateStudents(prev => prev.map(s => 
            s.id === studentId ? { ...s, selected: !s.selected } : s
        ));
    };

    const handleSelectSingleStudentOnly = (studentId: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setCreateStudents(prev => prev.map(s => ({
            ...s,
            selected: s.id === studentId
        })));
    };

    const handleToggleAll = (checked: boolean) => {
        const filteredIds = new Set(filteredCreateStudents.map(s => s.id));
        setCreateStudents(prev => prev.map(s => {
            if (filteredIds.has(s.id)) {
                return { ...s, selected: checked };
            }
            return s;
        }));
    };

    const uploadTaskFile = async (file: File) => {
        setUploadProgress(20);
        try {
            const fileExt = file.name.split('.').pop();
            const randomName = `${Math.random().toString(36).substring(2, 12)}_${Date.now()}.${fileExt}`;
            const filePath = `materials/${randomName}`;

            setUploadProgress(50);
            
            const { error: uploadError } = await supabaseAuth.storage
                .from('inventory_materials')
                .upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            setUploadProgress(85);

            const { data: { publicUrl } } = supabaseAuth.storage
                .from('inventory_materials')
                .getPublicUrl(filePath);

            setUploadProgress(100);
            setTimeout(() => {
                setUploadProgress(null);
                setCreateFileUrl(publicUrl);
                setCreateFileName(file.name);
                setCreateFileSize(file.size);
                // Clear lesson references
                setCreateSelectedLessonId(null);
                setCreateSelectedLessonTitle(null);
            }, 400);
        } catch (err: any) {
            console.error('Upload failed:', err);
            setUploadProgress(null);
            alert(`File upload failed: ${err.message}`);
        }
    };
    const handleCreateFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await uploadTaskFile(file);
    };

    const handleEditTaskClick = async (taskId: string) => {
        try {
            const { data: asg, error: asgError } = await supabaseAuth
                .from('assignments')
                .select('id, title, description, due_date, classroom_id, status, target_type, inventory_ref_id, inventory_ref_title, inventory_ref_type, file_url, file_name, file_size')
                .eq('id', taskId)
                .single();

            if (asgError || !asg) {
                console.error('Error fetching assignment for editing:', asgError);
                alert('Could not fetch task details.');
                return;
            }

            setEditingTaskId(asg.id);
            setCreateTitle(asg.title || '');
            setCreateDescription(asg.description || '');
            setCreateDueDate(formatDateForInput(asg.due_date));
            setCreateFileUrl(asg.file_url || '');
            setCreateFileName(asg.file_name || '');
            setCreateFileSize(asg.file_size ? Number(asg.file_size) : null);
            setCreateSelectedLessonId(asg.inventory_ref_id || null);
            setCreateSelectedLessonTitle(asg.inventory_ref_title || null);
            setCreateStudentSearch('');

            // Target mode and classroom
            if (asg.target_type === 'individual') {
                setAssignmentTargetMode('individual');
                setCreateSelectedClassroom('all');
            } else if (asg.target_type === 'all' && !asg.classroom_id) {
                setAssignmentTargetMode('all');
                setCreateSelectedClassroom('all');
            } else if (asg.classroom_id) {
                setAssignmentTargetMode('classroom');
                setCreateSelectedClassroom(asg.classroom_id);
            } else {
                setAssignmentTargetMode('individual');
                setCreateSelectedClassroom('all');
            }

            // Fetch current mappings to accurately select students
            const { data: currentMappings } = await supabaseAuth
                .from('assignment_students')
                .select('student_id')
                .eq('assignment_id', taskId);

            const assignedIds = new Set((currentMappings || []).map(m => m.student_id));

            // Hydrate createStudents safely
            setCreateStudents(prev => prev.map(student => {
                let isSelected = false;
                if (assignedIds.size > 0) {
                    isSelected = assignedIds.has(student.id);
                } else if (asg.target_type === 'all') {
                    isSelected = asg.classroom_id ? (student.classroom_ids?.includes(asg.classroom_id) ?? false) : true;
                }
                return {
                    ...student,
                    selected: isSelected
                };
            }));

            setIsCreateModalOpen(true);
        } catch (err) {
            console.error('Failed to load task details for editing:', err);
            alert('Failed to load task details.');
        }
    };

    const handleAssignAgainFromTemplate = (templateGroup: TaskTemplateGroup) => {
        setEditingTaskId(null);
        setCreateTitle(templateGroup.taskTitle || '');
        setCreateDescription(templateGroup.taskDescription || '');
        setCreateDueDate('');
        setCreateFileUrl(templateGroup.fileUrl || '');
        setCreateFileName(templateGroup.fileName || '');
        setCreateFileSize(templateGroup.fileSize ? Number(templateGroup.fileSize) : null);
        setCreateSelectedLessonId(templateGroup.inventoryRefId || null);
        setCreateSelectedLessonTitle(templateGroup.inventoryRefTitle || null);
        setSelectedPreviousTaskId(null);
        setAssignmentTargetMode('individual');
        setCreateSelectedClassroom('all');
        setCreateStudentSearch('');
        setCreateStudents(prev => prev.map(s => ({
            ...s,
            selected: false
        })));
        setIsCreateModalOpen(true);
    };

    const handleAssignTask = async (isDraft: boolean = false) => {
        const { data: { session } } = await supabaseAuth.auth.getSession();
        if (!session) return;
        
        if (!createTitle.trim() || !createDescription.trim()) {
            alert('Please fill in task title and instructions.');
            return;
        }

        if (!isDraft && !createDueDate) {
            alert('Please select a due date for the task.');
            return;
        }

        if (createClassrooms.length === 0) {
            alert('Please create at least one classroom before assigning tasks.');
            return;
        }

        let selectedStudents = createStudents.filter(s => s.selected);

        if (assignmentTargetMode === 'all') {
            selectedStudents = createStudents;
        } else if (assignmentTargetMode === 'classroom') {
            if (createSelectedClassroom && createSelectedClassroom !== 'all') {
                selectedStudents = selectedStudents.filter(s => s.classroom_ids?.includes(createSelectedClassroom));
            }
        }

        if (!isDraft && selectedStudents.length === 0) {
            alert('Please select at least one student.');
            return;
        }

        setIsSaving(true);
        try {
            if (editingTaskId) {
                // Update specific assignment batch
                const primaryClassId = (createSelectedClassroom && createSelectedClassroom !== 'all') 
                    ? createSelectedClassroom 
                    : (selectedStudents[0]?.classroom_ids[0] || createClassrooms[0]?.id);
                const classroomObj = createClassrooms.find(c => c.id === primaryClassId);
                const classTeacherId = classroomObj?.teacher_id || session.user.id;

                const updateData: any = {
                    title: createTitle.trim(),
                    description: createDescription.trim(),
                    due_date: createDueDate || null,
                    classroom_id: primaryClassId,
                    teacher_id: classTeacherId,
                    target_type: assignmentTargetMode === 'all' ? 'all' : (assignmentTargetMode === 'classroom' ? 'classroom' : 'individual'),
                    status: isDraft ? 'draft' : 'active',
                    file_url: createFileUrl || null,
                    file_name: createFileName || null,
                    file_size: createFileSize || null,
                    inventory_ref_id: createSelectedLessonId || null,
                    inventory_ref_title: createSelectedLessonTitle || null,
                    inventory_ref_type: createSelectedLessonId ? 'lesson' : null
                };

                let { error: updateError } = await supabaseAuth
                    .from('assignments')
                    .update(updateData)
                    .eq('id', editingTaskId);

                if (updateError) throw updateError;

                // Sync student mappings safely without losing student submissions
                if (!isDraft) {
                    const studentIds = selectedStudents.map(s => s.id);
                    const { data: currentMappings } = await supabaseAuth
                        .from('assignment_students')
                        .select('id, student_id, status, video_url, feedback_text')
                        .eq('assignment_id', editingTaskId);

                    const existingMap = new Map((currentMappings || []).map(m => [m.student_id, m]));
                    const existingStudentIds = new Set(existingMap.keys());
                    const targetStudentIds = new Set(studentIds);

                    // Students to remove (only delete if NO submitted work or reviewed status to protect student history)
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
                            .eq('assignment_id', editingTaskId)
                            .in('student_id', toRemove);
                    }

                    // Students to add (insert pending records for newly selected students)
                    const toAdd = studentIds.filter(id => !existingStudentIds.has(id));
                    if (toAdd.length > 0) {
                        const newMappings = toAdd.map(studentId => ({
                            assignment_id: editingTaskId,
                            student_id: studentId,
                            status: 'pending'
                        }));

                        const { error: mappingError } = await supabaseAuth
                            .from('assignment_students')
                            .insert(newMappings);

                        if (mappingError) throw mappingError;
                    }
                }
            } else {
                // CREATE NEW ASSIGNMENT BATCH (Single record containing all target assignees)
                const primaryClassId = (assignmentTargetMode === 'classroom' && createSelectedClassroom && createSelectedClassroom !== 'all')
                    ? createSelectedClassroom
                    : (selectedStudents[0]?.classroom_ids[0] || createClassrooms[0]?.id);
                const classroomObj = createClassrooms.find(c => c.id === primaryClassId);
                const classTeacherId = classroomObj?.teacher_id || session.user.id;

                const insertData = {
                    classroom_id: primaryClassId,
                    teacher_id: classTeacherId,
                    title: createTitle.trim(),
                    description: createDescription.trim(),
                    due_date: createDueDate || null,
                    target_type: assignmentTargetMode === 'all' ? 'all' : (assignmentTargetMode === 'classroom' ? 'classroom' : 'individual'),
                    status: isDraft ? 'draft' : 'active',
                    file_url: createFileUrl || null,
                    file_name: createFileName || null,
                    file_size: createFileSize || null,
                    inventory_ref_id: createSelectedLessonId || null,
                    inventory_ref_title: createSelectedLessonTitle || null,
                    inventory_ref_type: createSelectedLessonId ? 'lesson' : null,
                    created_at: new Date().toISOString()
                };

                const { data: newAsg, error: newAsgError } = await supabaseAuth
                    .from('assignments')
                    .insert(insertData)
                    .select()
                    .single();

                if (newAsgError) throw newAsgError;

                if (!isDraft && selectedStudents.length > 0 && newAsg) {
                    const studentMappings = selectedStudents.map(student => ({
                        assignment_id: newAsg.id,
                        student_id: student.id,
                        status: 'pending'
                    }));

                    const { error: mappingError } = await supabaseAuth
                        .from('assignment_students')
                        .insert(studentMappings);

                    if (mappingError) throw mappingError;
                }
            }

            setIsCreateModalOpen(false);
            setEditingTaskId(null);
            
            // Clear form
            setCreateTitle('');
            setCreateDescription('');
            setCreateDueDate('');
            setCreateFileUrl('');
            setCreateFileName('');
            setCreateFileSize(null);
            setCreateSelectedLessonId(null);
            setCreateSelectedLessonTitle(null);
            setSelectedPreviousTaskId(null);
            
            // Refresh submissions list and dropdown previous tasks list
            const currentProfile = await supabaseAuth.from('users').select('role').eq('id', session.user.id).single();
            const isAdmin = currentProfile?.data?.role === 'admin';
            await fetchSubmissions(session.user.id, isAdmin);
            await loadCreationData(session.user.id);
            
            if (isPopup) {
                window.parent.postMessage('kfa_popup_success', '*');
            }

        } catch (error: any) {
            console.error('Error assigning/saving task:', error);
            const msg = error?.message || 'Unknown error';
            alert(`Failed to save task: ${msg}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteSingle = async (e: React.MouseEvent, attemptId: string) => {
        e.stopPropagation();
        const isDraft = attemptId.startsWith('draft-');
        const confirmMsg = isDraft 
            ? 'Are you sure you want to delete this task draft?' 
            : 'Are you sure you want to delete this task assignment for all assigned students?';
            
        if (!confirm(confirmMsg)) return;
        setIsDeleting(true);
        try {
            let taskId = '';
            if (isDraft) {
                taskId = attemptId.replace('draft-', '');
            } else if (attemptId.startsWith('no-students-')) {
                taskId = attemptId.replace('no-students-', '');
            } else {
                const sub = submissions.find(s => s.id === attemptId);
                if (sub) taskId = sub.task_id;
            }

            if (taskId) {
                // First delete child mappings in assignment_students
                await supabaseAuth
                    .from('assignment_students')
                    .delete()
                    .eq('assignment_id', taskId);

                // Then delete parent assignment
                const { error: assignmentError } = await supabaseAuth
                    .from('assignments')
                    .delete()
                    .eq('id', taskId);
                if (assignmentError) throw assignmentError;

                // Update local state by removing all submissions related to this task
                const updatedSubmissions = submissions.filter(s => s.task_id !== taskId);
                setSubmissions(updatedSubmissions);
                setPreviousTasks(prev => prev.filter(t => t.id !== taskId));
                
                if (selectedSub?.task_id === taskId) {
                    setSelectedSub(null);
                }
                setSelectedSubIds(prev => prev.filter(id => {
                    const sub = submissions.find(s => s.id === id);
                    return sub ? sub.task_id !== taskId : true;
                }));
            }
            alert(isDraft ? 'Task draft deleted successfully.' : 'Task assignment deleted successfully.');
        } catch (err: any) {
            console.error('Error deleting task assignment:', err);
            alert(`Failed to delete task assignment: ${err.message || 'Unknown error'}`);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteBulk = async () => {
        if (selectedSubIds.length === 0) return;
        if (!confirm(`Are you sure you want to delete the selected task assignments?`)) return;
        setIsDeleting(true);
        try {
            const uniqueTaskIds = [...new Set(
                selectedSubIds
                    .map(id => {
                        const s = submissions.find(sub => sub.id === id);
                        return s ? s.task_id : null;
                    })
                    .filter(Boolean)
            )] as string[];

            if (uniqueTaskIds.length > 0) {
                // Delete child mappings first
                await supabaseAuth
                    .from('assignment_students')
                    .delete()
                    .in('assignment_id', uniqueTaskIds);

                // Delete parent assignments
                const { error: assignmentsError } = await supabaseAuth
                    .from('assignments')
                    .delete()
                    .in('id', uniqueTaskIds);
                if (assignmentsError) throw assignmentsError;

                // Update local state
                const updatedSubmissions = submissions.filter(s => !uniqueTaskIds.includes(s.task_id));
                setSubmissions(updatedSubmissions);
                setPreviousTasks(prev => prev.filter(t => !uniqueTaskIds.includes(t.id)));
                
                if (selectedSub && uniqueTaskIds.includes(selectedSub.task_id)) {
                    setSelectedSub(null);
                }
                setSelectedSubIds([]);
            }
            alert(`Selected task assignments deleted successfully.`);
        } catch (err: any) {
            console.error('Error in bulk delete:', err);
            alert(`Failed to delete tasks: ${err.message || 'Unknown error'}`);
        } finally {
            setIsDeleting(false);
        }
    };

    const [collapsedTemplates, setCollapsedTemplates] = useState<Record<string, boolean>>({});
    const [collapsedBatches, setCollapsedBatches] = useState<Record<string, boolean>>({});

    const toggleTemplateCollapse = (templateKey: string) => {
        setCollapsedTemplates(prev => {
            const current = prev[templateKey] ?? true;
            return {
                ...prev,
                [templateKey]: !current
            };
        });
    };

    const toggleBatchCollapse = (batchId: string) => {
        setCollapsedBatches(prev => {
            const current = prev[batchId] ?? true;
            return {
                ...prev,
                [batchId]: !current
            };
        });
    };

    const groupedTaskTemplates = useMemo(() => {
        const templateMap: Record<string, TaskTemplateGroup> = {};

        filteredSubmissions.forEach(sub => {
            const titleKey = (sub.task_title || 'Untitled Task').toLowerCase().trim();
            const refKey = sub.inventory_ref_id ? `_${sub.inventory_ref_id}` : '';
            const templateKey = `${titleKey}${refKey}`;

            if (!templateMap[templateKey]) {
                templateMap[templateKey] = {
                    templateKey,
                    taskTitle: sub.task_title || 'Untitled Task',
                    taskDescription: sub.task_description,
                    inventoryRefType: sub.inventory_ref_type,
                    inventoryRefId: sub.inventory_ref_id,
                    inventoryRefTitle: sub.inventory_ref_title,
                    fileUrl: sub.file_url,
                    fileName: sub.file_name,
                    fileSize: sub.file_size,
                    batches: [],
                    totalStudents: 0,
                    submittedCount: 0,
                    reviewedCount: 0,
                    approvedCount: 0,
                    pendingCount: 0,
                    isDraftOnly: true,
                };
            }

            const template = templateMap[templateKey];
            if (!template.fileUrl && sub.file_url) {
                template.fileUrl = sub.file_url;
                template.fileName = sub.file_name;
                template.fileSize = sub.file_size;
            }
            if (!template.taskDescription && sub.task_description) {
                template.taskDescription = sub.task_description;
            }
            if (!template.inventoryRefTitle && sub.inventory_ref_title) {
                template.inventoryRefTitle = sub.inventory_ref_title;
            }

            const assignmentId = sub.task_id || `unassigned-${sub.id}`;
            let batch = template.batches.find(b => b.assignmentId === assignmentId);
            if (!batch) {
                batch = {
                    assignmentId,
                    classroomName: sub.classroom_name || 'Individual / Cross-Class',
                    classroomId: sub.classroom_id,
                    targetType: sub.classroom_name?.toLowerCase().includes('all') ? 'all' : 'individual',
                    dueDate: sub.due_date,
                    createdAt: sub.submitted_at,
                    isDraft: sub.status === 'draft',
                    submissions: []
                };
                template.batches.push(batch);
            }

            batch.submissions.push(sub);

            if (sub.status !== 'draft') {
                template.isDraftOnly = false;
            }
            if (sub.student_id !== 'draft' && sub.student_id !== 'no-students') {
                template.totalStudents++;
                if (sub.status === 'submitted') template.submittedCount++;
                else if (sub.status === 'reviewed') template.reviewedCount++;
                else if (sub.status === 'approved') template.approvedCount++;
                else if (sub.status === 'pending') template.pendingCount++;
            }
        });

        return Object.values(templateMap);
    }, [filteredSubmissions]);

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8f8f6] dark:bg-[#221d10]">
                <Loader2 className="w-10 h-10 animate-spin text-[#ecb613] mb-4" />
                <p className="font-medium text-slate-600 dark:text-slate-400">Loading tasks...</p>
            </div>
        );
    }

    return (
        <div className={`text-slate-900 dark:text-slate-100 min-h-screen flex font-sans ${isPopup ? 'bg-transparent' : 'bg-[#f8f8f6] dark:bg-[#221d10]'}`}>
            {!isPopup && <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />}

            <main className={`flex-1 flex flex-col min-w-0 ${isPopup ? 'hidden' : ''}`}>
                <TeacherHeader 
                    title="Task Review" 
                    avatarUrl={teacherProfile?.profile_pic_url}
                    userName={teacherProfile?.name}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    backLink={teacherProfile?.role === 'admin' ? '/admin-dashboard' : '/teacher-dashboard'}
                />

                <div className="p-3 sm:p-6 md:p-8 grid grid-cols-12 gap-6 md:gap-8 w-full flex-1">
                    {/* Left Column: Submission List */}
                    <div className="col-span-12 lg:col-span-7 space-y-4 flex flex-col h-full">
                        <header className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <h1 className="admin-page-title">Task Review</h1>
                                <p className="admin-page-subtitle">Review student performance and provide feedback</p>
                            </div>
                            <div className="admin-btn-group">
                                {selectedSubIds.length > 0 && (
                                    <button 
                                        onClick={handleDeleteBulk}
                                        disabled={isDeleting}
                                        className="admin-btn admin-btn-danger"
                                        title={`Delete ${selectedSubIds.length} selected tasks`}
                                    >
                                        <Trash2 className="w-4 h-4 shrink-0" />
                                        <span className="hidden sm:inline">Delete ({selectedSubIds.length})</span>
                                    </button>
                                )}
                                <button 
                                    onClick={() => {
                                        setEditingTaskId(null);
                                        setCreateTitle('');
                                        setCreateDescription('');
                                        setCreateDueDate('');
                                        setCreateFileUrl('');
                                        setCreateFileName('');
                                        setCreateFileSize(null);
                                        setCreateSelectedLessonId(null);
                                        setCreateSelectedLessonTitle(null);
                                        setSelectedPreviousTaskId(null);
                                        setCreateStudents(prev => prev.map(s => ({ ...s, selected: false })));
                                        setIsCreateModalOpen(true);
                                    }}
                                    className="admin-btn admin-btn-primary"
                                    title="Create Task"
                                >
                                    <Plus className="w-4 h-4 shrink-0" />
                                    <span className="hidden sm:inline">Create Task</span>
                                </button>
                            </div>
                        </header>

                        {/* Target & Classroom Filter Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 shadow-xs">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pl-1">Target:</span>
                                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => { setTargetFilter('all'); setSelectedFilterClassroomId('all'); }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            targetFilter === 'all'
                                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                                        }`}
                                    >
                                        All Targets
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTargetFilter('classroom')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            targetFilter === 'classroom'
                                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                                        }`}
                                    >
                                        🏫 Classrooms
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setTargetFilter('individual'); setSelectedFilterClassroomId('all'); }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            targetFilter === 'individual'
                                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                                        }`}
                                    >
                                        👤 Individual
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setTargetFilter('all_students'); setSelectedFilterClassroomId('all'); }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            targetFilter === 'all_students'
                                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                                        }`}
                                    >
                                        👥 All Students
                                    </button>
                                </div>
                            </div>

                            {targetFilter === 'classroom' && (
                                <select
                                    value={selectedFilterClassroomId}
                                    onChange={(e) => setSelectedFilterClassroomId(e.target.value)}
                                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-[#ecb613]"
                                >
                                    <option value="all">All Classrooms</option>
                                    {createClassrooms.map(cls => (
                                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* Status Filter Tabs */}
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-sm overflow-x-auto scrollbar-none whitespace-nowrap snap-x">
                            {tabConfig.map(tab => {
                                const count = tab.id === 'all'
                                    ? new Set(submissions.map(s => (s.task_title || 'Untitled').toLowerCase().trim())).size
                                    : tab.id === 'assigned'
                                    ? new Set(submissions.filter(s => s.status !== 'draft').map(s => s.task_id)).size
                                    : tab.id === 'draft'
                                    ? new Set(submissions.filter(s => s.status === 'draft').map(s => s.task_id)).size
                                    : tab.id === 'reviewed'
                                    ? submissions.filter(s => s.status === 'reviewed' && s.student_id !== 'draft' && s.student_id !== 'no-students').length
                                    : tab.id === 'submitted'
                                    ? submissions.filter(s => s.status === 'submitted' && s.student_id !== 'draft' && s.student_id !== 'no-students').length
                                    : submissions.filter(s => s.status.toLowerCase() === tab.id && s.student_id !== 'draft' && s.student_id !== 'no-students').length;

                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0 snap-start ${
                                            isActive
                                                ? 'bg-[#ecb613] text-slate-900 shadow-sm'
                                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        {tab.label}
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                                            isActive
                                                ? 'bg-slate-900/15 text-slate-900'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                        }`}>{count}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="space-y-4 flex-1 overflow-y-auto pr-1 max-h-[calc(100vh-280px)]">
                            {groupedTaskTemplates.map((templateGroup) => {
                                const isTemplateCollapsed = collapsedTemplates[templateGroup.templateKey] ?? true;
                                const allSubIdsInTemplate = templateGroup.batches.flatMap(b => b.submissions.map(s => s.id));
                                const isAllInTemplateSelected = allSubIdsInTemplate.length > 0 && allSubIdsInTemplate.every(id => selectedSubIds.includes(id));
                                
                                return (
                                    <div 
                                        key={templateGroup.templateKey} 
                                        className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/90 dark:border-slate-800 overflow-hidden transition-all hover:shadow-md"
                                    >
                                        {/* Task Template Level Header */}
                                        <header 
                                            onClick={() => toggleTemplateCollapse(templateGroup.templateKey)}
                                            className="p-4 sm:px-6 sm:py-4.5 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/60 dark:border-slate-800 flex items-center justify-between cursor-pointer select-none hover:bg-slate-100/60 dark:hover:bg-slate-800/80 transition-colors gap-3"
                                        >
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                <input 
                                                    type="checkbox"
                                                    className="rounded border-slate-300 dark:border-slate-700 text-[#ecb613] focus:ring-[#ecb613] cursor-pointer w-4 h-4 shrink-0"
                                                    checked={isAllInTemplateSelected}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedSubIds(prev => [...new Set([...prev, ...allSubIdsInTemplate])]);
                                                        } else {
                                                            setSelectedSubIds(prev => prev.filter(id => !allSubIdsInTemplate.includes(id)));
                                                        }
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 border border-amber-500/20">
                                                    <ClipboardList className="w-5 h-5" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white leading-snug hover:text-[#ecb613] transition-colors truncate max-w-md">
                                                            {templateGroup.taskTitle}
                                                        </h3>
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 dark:bg-amber-955/60 dark:text-amber-300 border border-amber-300/40 shrink-0">
                                                            {templateGroup.batches.length} {templateGroup.batches.length === 1 ? 'Batch' : 'Batches'}
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
                                                            {templateGroup.totalStudents} {templateGroup.totalStudents === 1 ? 'Student' : 'Students'}
                                                        </span>
                                                        {templateGroup.submittedCount > 0 && (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 shrink-0 shadow-xs">
                                                                📥 {templateGroup.submittedCount} Submitted
                                                            </span>
                                                        )}
                                                        {templateGroup.approvedCount > 0 && (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                                                                ✅ {templateGroup.approvedCount} Approved
                                                            </span>
                                                        )}
                                                        {templateGroup.isDraftOnly && (
                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 shrink-0">
                                                                Draft
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                                                        {templateGroup.inventoryRefTitle && (
                                                            <span className="text-amber-700 dark:text-amber-300 font-semibold truncate max-w-xs">
                                                                📖 {templateGroup.inventoryRefTitle}
                                                            </span>
                                                        )}
                                                        {templateGroup.fileName && (
                                                            <span className="text-slate-500 truncate max-w-[200px]">
                                                                📎 {templateGroup.fileName}
                                                            </span>
                                                        )}
                                                        {templateGroup.taskDescription && (
                                                            <span className="text-slate-400 truncate hidden md:inline">
                                                                • {templateGroup.taskDescription.slice(0, 60)}...
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleAssignAgainFromTemplate(templateGroup);
                                                    }}
                                                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 shadow-xs active:scale-[0.98]"
                                                    title="Assign this task template to more students or classes"
                                                >
                                                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                                    <span className="hidden sm:inline">Assign Again</span>
                                                </button>
                                                <div 
                                                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                                    title={isTemplateCollapsed ? "Expand template" : "Collapse template"}
                                                >
                                                    {isTemplateCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                                                </div>
                                            </div>
                                        </header>

                                        {/* Template Content & Assignment Batches (Visible when template is expanded) */}
                                        {!isTemplateCollapsed && (
                                            <div className="p-3 sm:p-4 bg-slate-50/40 dark:bg-slate-950/20 space-y-4">
                                                {/* Optional Task Instruction & Attachment Note */}
                                                {templateGroup.taskDescription && (
                                                    <div className="p-3 bg-white dark:bg-slate-800/70 rounded-xl border border-slate-200/70 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                                                        <span className="font-bold text-slate-500 uppercase text-[10px] block mb-1 font-mono">Task Instructions:</span>
                                                        <AutoLinkText text={templateGroup.taskDescription} />
                                                        {templateGroup.fileUrl && (
                                                            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center gap-2">
                                                                <Paperclip className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                                                <a 
                                                                    href={templateGroup.fileUrl} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer"
                                                                    className="text-xs font-bold text-amber-600 hover:underline truncate"
                                                                >
                                                                    {templateGroup.fileName || 'Download Attachment'}
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Assignment Batches List */}
                                                <div className="space-y-3">
                                                    {templateGroup.batches.map((batch, batchIndex) => {
                                                        const isBatchCollapsed = collapsedBatches[batch.assignmentId] ?? true;
                                                        const validBatchSubmissions = batch.submissions.filter(s => s.student_id !== 'draft' && s.student_id !== 'no-students');
                                                        const batchPendingCount = batch.submissions.filter(s => s.status === 'submitted').length;
                                                        const batchSubIds = batch.submissions.map(s => s.id);
                                                        const isBatchAllSelected = batchSubIds.length > 0 && batchSubIds.every(id => selectedSubIds.includes(id));
                                                        
                                                        return (
                                                            <div 
                                                                key={batch.assignmentId}
                                                                className="bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs"
                                                            >
                                                                {/* Batch Header */}
                                                                <div 
                                                                    onClick={() => toggleBatchCollapse(batch.assignmentId)}
                                                                    className="p-3 sm:px-4 sm:py-3 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors gap-2"
                                                                >
                                                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                                        <input 
                                                                            type="checkbox"
                                                                            className="rounded border-slate-300 dark:border-slate-600 text-[#ecb613] focus:ring-[#ecb613] cursor-pointer w-4 h-4 shrink-0"
                                                                            checked={isBatchAllSelected}
                                                                            onChange={(e) => {
                                                                                if (e.target.checked) {
                                                                                    setSelectedSubIds(prev => [...new Set([...prev, ...batchSubIds])]);
                                                                                } else {
                                                                                    setSelectedSubIds(prev => prev.filter(id => !batchSubIds.includes(id)));
                                                                                }
                                                                            }}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        />
                                                                        
                                                                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                                            <span className="font-extrabold text-xs sm:text-sm text-slate-800 dark:text-slate-100">
                                                                                Batch {batchIndex + 1}:
                                                                            </span>
                                                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-900 dark:text-amber-300 border border-amber-500/20 shrink-0">
                                                                                🏫 {batch.classroomName}
                                                                            </span>
                                                                            {batch.dueDate && (
                                                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                                                                                    new Date(batch.dueDate) < new Date() && !batch.isDraft
                                                                                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                                                                        : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                                                                }`}>
                                                                                    📅 Due: {new Date(batch.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                                                </span>
                                                                            )}
                                                                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                                                                {validBatchSubmissions.length} Student{validBatchSubmissions.length !== 1 ? 's' : ''}
                                                                            </span>
                                                                            {batchPendingCount > 0 && (
                                                                                <span className="text-amber-600 font-extrabold text-[11px]">
                                                                                    • {batchPendingCount} Pending Review
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center gap-1 shrink-0 ml-2">
                                                                        <button 
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleEditTaskClick(batch.assignmentId);
                                                                            }}
                                                                            className="px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-amber-600 bg-slate-100 dark:bg-slate-700/80 hover:bg-amber-50 dark:hover:bg-amber-955/30 rounded-lg transition-colors flex items-center gap-1 border border-slate-200 dark:border-slate-600"
                                                                            title="Edit this specific assignment batch"
                                                                        >
                                                                            <Edit2 className="w-3 h-3" />
                                                                            <span className="hidden sm:inline">Edit Batch</span>
                                                                        </button>
                                                                        <button 
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleDeleteSingle(e, batch.submissions[0]?.id || `no-students-${batch.assignmentId}`);
                                                                            }}
                                                                            disabled={isDeleting}
                                                                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors disabled:opacity-50"
                                                                            title="Delete this assignment batch"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <div 
                                                                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                                                            title={isBatchCollapsed ? "Show students" : "Hide students"}
                                                                        >
                                                                            {isBatchCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Batch Students Table */}
                                                                {!isBatchCollapsed && (
                                                                    batch.isDraft ? (
                                                                        <div className="p-4 text-center bg-slate-50/50 dark:bg-slate-800/30 text-xs text-slate-500 italic">
                                                                            Draft batch — no students assigned yet.
                                                                        </div>
                                                                    ) : (
                                                                        <div className="overflow-x-auto">
                                                                            <table className="w-full text-left border-collapse text-xs">
                                                                                <thead className="bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-700">
                                                                                    <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                                                                                        <th className="w-10 px-4 py-2.5 text-center">
                                                                                            <input 
                                                                                                type="checkbox"
                                                                                                className="rounded border-slate-300 dark:border-slate-700 text-[#ecb613] focus:ring-[#ecb613] cursor-pointer"
                                                                                                checked={isBatchAllSelected}
                                                                                                onChange={(e) => {
                                                                                                    if (e.target.checked) {
                                                                                                        setSelectedSubIds(prev => [...new Set([...prev, ...batchSubIds])]);
                                                                                                    } else {
                                                                                                        setSelectedSubIds(prev => prev.filter(id => !batchSubIds.includes(id)));
                                                                                                    }
                                                                                                }}
                                                                                                onClick={(e) => e.stopPropagation()}
                                                                                            />
                                                                                        </th>
                                                                                        <th className="px-4 py-2.5">Student</th>
                                                                                        <th className="px-4 py-2.5">Classroom</th>
                                                                                        <th className="px-4 py-2.5">Assigned</th>
                                                                                        <th className="px-4 py-2.5">Due Date</th>
                                                                                        <th className="px-4 py-2.5">Status</th>
                                                                                        <th className="px-4 py-2.5 text-right">Review</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                                                                                    {batch.submissions.map((sub) => (
                                                                                        <tr 
                                                                                            key={sub.id}
                                                                                            className={`hover:bg-amber-500/5 dark:hover:bg-slate-750 cursor-pointer transition-colors ${selectedSub?.id === sub.id ? 'bg-[#ecb613]/10 font-bold' : ''}`}
                                                                                            onClick={() => handleSelectSubmission(sub)}
                                                                                        >
                                                                                            <td className="px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                                                                                <input 
                                                                                                    type="checkbox"
                                                                                                    className="rounded border-slate-300 dark:border-slate-700 text-[#ecb613] focus:ring-[#ecb613] cursor-pointer"
                                                                                                    checked={selectedSubIds.includes(sub.id)}
                                                                                                    onChange={(e) => {
                                                                                                        if (e.target.checked) {
                                                                                                            setSelectedSubIds(prev => [...prev, sub.id]);
                                                                                                        } else {
                                                                                                            setSelectedSubIds(prev => prev.filter(id => id !== sub.id));
                                                                                                        }
                                                                                                    }}
                                                                                                />
                                                                                            </td>
                                                                                            <td className="px-4 py-2.5">
                                                                                                <div className="flex items-center gap-2.5">
                                                                                                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20 shadow-xs shrink-0">
                                                                                                        {sub.student_profile_pic_url ? (
                                                                                                            <img 
                                                                                                                src={sub.student_profile_pic_url} 
                                                                                                                alt={sub.student_name} 
                                                                                                                className="w-full h-full object-cover rounded-full"
                                                                                                                loading="lazy"
                                                                                                            />
                                                                                                        ) : (
                                                                                                            <div className="text-primary text-[9px] font-black">{sub.student_name.charAt(0)}</div>
                                                                                                        )}
                                                                                                    </div>
                                                                                                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{sub.student_name}</span>
                                                                                                </div>
                                                                                            </td>
                                                                                            <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 font-medium truncate max-w-[150px]">
                                                                                                {sub.classroom_name || 'Individual'}
                                                                                            </td>
                                                                                            <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap text-[11px]">
                                                                                                {new Date(sub.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                                                            </td>
                                                                                            <td className="px-4 py-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                                                                <div className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-955/30 px-2 py-0.5 rounded-md border border-amber-200/60 dark:border-amber-900/30">
                                                                                                    <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                                                                                                    <input 
                                                                                                        type="date"
                                                                                                        value={formatDateForInput(sub.due_date)}
                                                                                                        onChange={(e) => handleQuickUpdateDueDate(sub.task_id, e.target.value)}
                                                                                                        className="bg-transparent text-amber-900 dark:text-amber-300 font-mono text-[11px] font-bold outline-none cursor-pointer"
                                                                                                        title="Quick change due date"
                                                                                                    />
                                                                                                </div>
                                                                                            </td>
                                                                                            <td className="px-4 py-2.5">
                                                                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                                                                                                    sub.status === 'submitted' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                                                                                    sub.status === 'reviewed' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                                                                                    sub.status === 'approved' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                                                                                                    sub.status === 'pending' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700' :
                                                                                                    'bg-slate-100 text-slate-500 border-slate-200'
                                                                                                }`}>
                                                                                                    {sub.status}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                                                                                                <button 
                                                                                                    onClick={() => handleSelectSubmission(sub)}
                                                                                                    className="px-2.5 py-1 text-[11px] font-bold text-[#ecb613] hover:text-slate-900 hover:bg-[#ecb613] rounded-lg transition-colors border border-[#ecb613]/40"
                                                                                                    title="Review student submission"
                                                                                                >
                                                                                                    Review
                                                                                                </button>
                                                                                            </td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            
                            {groupedTaskTemplates.length === 0 && (
                                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-500 italic">
                                    No tasks found for this filter.
                                </div>
                            )}
                        </div>

                        {/* Bento Quick Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-100 dark:border-amber-900/10 shadow-sm transition-all hover:shadow-md">
                                <p className="text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase font-label tracking-wider">Pending Review</p>
                                <h3 className="text-2xl font-black text-amber-900 dark:text-amber-100 font-headline mt-1">
                                    {submissions.filter(s => s.status === 'submitted').length}
                                </h3>
                            </div>
                            <div className="bg-sky-50 dark:bg-sky-950/20 p-4 rounded-xl border border-sky-100 dark:border-sky-900/10 shadow-sm transition-all hover:shadow-md">
                                <p className="text-[10px] font-bold text-sky-800 dark:text-sky-400 uppercase font-label tracking-wider">Pending Submission</p>
                                <h3 className="text-2xl font-black text-sky-900 dark:text-sky-100 font-headline mt-1">
                                    {submissions.filter(s => s.status === 'pending').length}
                                </h3>
                            </div>
                            <div className="bg-indigo-50 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/10 shadow-sm transition-all hover:shadow-md">
                                <p className="text-[10px] font-bold text-indigo-800 dark:text-indigo-400 uppercase font-label tracking-wider">Reviewed</p>
                                <h3 className="text-2xl font-black text-indigo-900 dark:text-indigo-100 font-headline mt-1">
                                    {submissions.filter(s => s.status === 'reviewed').length}
                                </h3>
                            </div>
                            <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/10 shadow-sm transition-all hover:shadow-md">
                                <p className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase font-label tracking-wider">Approved</p>
                                <h3 className="text-2xl font-black text-emerald-900 dark:text-emerald-100 font-headline mt-1">
                                    {submissions.filter(s => s.status === 'approved').length}
                                </h3>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:shadow-md">
                                <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase font-label tracking-wider">Drafts</p>
                                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 font-headline mt-1">
                                    {submissions.filter(s => s.status === 'draft').length}
                                </h3>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Detail Panel */}
                    <div className="col-span-12 lg:col-span-5 h-full">
                        {selectedSub ? (
                            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 sticky top-24 overflow-hidden flex flex-col max-h-[calc(100vh-120px)] transition-all animate-in fade-in slide-in-from-right-4">
                                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Active Review</span>
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedSub.task_title}</h2>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20">
                                                    {selectedSub.student_profile_pic_url ? (
                                                        <img 
                                                            src={selectedSub.student_profile_pic_url} 
                                                            alt={selectedSub.student_name} 
                                                            className="w-full h-full object-cover rounded-full"
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <div className="text-primary text-[8px] font-black">{selectedSub.student_name.charAt(0)}</div>
                                                    )}
                                                </div>
                                                <span className="text-xs font-medium text-on-surface-variant">{selectedSub.student_name}</span>
                                            </div>
                                        </div>
                                        <button onClick={() => setSelectedSub(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                                    {/* Task Brief */}
                                    <section>
                                        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-2">
                                            <Info className="w-3 h-3" />
                                            Task Brief
                                        </h3>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                            <AutoLinkText text={selectedSub.task_description || 'No description provided for this task.'} preserveNewlines />
                                        </p>
                                    </section>

                                    {/* Task Attachment if exists */}
                                    {selectedSub.file_url && (
                                        <section className="bg-slate-50 dark:bg-slate-800/20 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                                            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                                                <Paperclip className="w-3.5 h-3.5" />
                                                Attachments
                                            </h3>
                                            <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                                <span className="text-xs font-bold text-slate-750 dark:text-slate-200 truncate max-w-[200px]" title={selectedSub.file_name}>
                                                    📎 {selectedSub.file_name || 'Learning Material'}
                                                </span>
                                                <a 
                                                    href={selectedSub.file_url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className="text-amber-600 hover:text-amber-700 font-extrabold text-xs flex items-center gap-1 shrink-0"
                                                >
                                                    <Download className="w-3.5 h-3.5" /> View
                                                </a>
                                            </div>
                                            {(selectedSub.file_url.includes('.webm') || selectedSub.file_url.includes('.mp3') || selectedSub.file_url.includes('.wav') || selectedSub.file_url.includes('.m4a') || selectedSub.file_url.includes('.ogg') || (selectedSub.file_name && selectedSub.file_name.toLowerCase().includes('voice'))) && (
                                                <audio src={selectedSub.file_url} controls className="w-full h-8 rounded-lg" />
                                            )}
                                        </section>
                                    )}

                                    {/* Topic Reference if exists */}
                                    {selectedSub.inventory_ref_id && (
                                        <section className="bg-amber-50/20 dark:bg-amber-955/5 p-4 rounded-xl border border-amber-100 dark:border-amber-900/20">
                                            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-2">
                                                <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                                                Topic Reference
                                            </h3>
                                            <div className="flex items-center justify-between gap-3 mt-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-amber-100/50 dark:border-amber-900/20">
                                                <span className="text-xs font-bold text-slate-755 dark:text-slate-200 truncate max-w-[200px]" title={selectedSub.inventory_ref_title || ''}>
                                                    📖 {selectedSub.inventory_ref_title}
                                                </span>
                                                <span className="text-[10px] text-amber-650 bg-amber-100/50 dark:bg-amber-955/30 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">Curriculum</span>
                                            </div>
                                        </section>
                                    )}

                                    {/* Student Video Link if exists */}
                                    {selectedSub.video_url && (
                                        <section className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                                            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2 mb-2">
                                                <PlayCircle className="w-3.5 h-3.5" />
                                                Student Submission
                                            </h3>
                                            {(() => {
                                                const url = selectedSub.video_url;
                                                if (!url) return null;
                                                
                                                // YouTube
                                                const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
                                                const ytMatch = url.match(ytRegex);
                                                if (ytMatch && ytMatch[1]) {
                                                    return (
                                                        <iframe 
                                                            className="w-full aspect-video rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 bg-black" 
                                                            src={`https://www.youtube.com/embed/${ytMatch[1]}`} 
                                                            title="Student Submission Video"
                                                            allowFullScreen
                                                        ></iframe>
                                                    );
                                                }
                                                // Google Drive
                                                if (url.includes('drive.google.com')) {
                                                    const isFolder = url.includes('/folders/') || url.includes('/drive/folders');
                                                    if (isFolder) {
                                                        return (
                                                            <div className="bg-amber-50/60 dark:bg-amber-955/10 border border-amber-200 dark:border-amber-900/30 p-4 rounded-xl space-y-3">
                                                                <div className="flex items-start gap-3">
                                                                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400 shrink-0">
                                                                        <Folder className="w-5 h-5" />
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Google Drive Folder Submitted</h4>
                                                                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                                                                            Google Drive folder links cannot be embedded in an iframe preview. Click below to open and view the folder directly in Google Drive.
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <a 
                                                                    href={url} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer" 
                                                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900 font-extrabold text-xs rounded-xl shadow-sm transition-all"
                                                                >
                                                                    <ExternalLink className="w-4 h-4" />
                                                                    Open Folder in Google Drive
                                                                </a>
                                                            </div>
                                                        );
                                                    }

                                                    const embedUrl = url.replace(/\/view.*$/, '/preview');
                                                    return (
                                                        <div className="space-y-2">
                                                            <iframe 
                                                                className="w-full aspect-[4/3] rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 bg-slate-100"
                                                                src={embedUrl}
                                                                title="Student Submission Video"
                                                                allow="autoplay"
                                                            ></iframe>
                                                            <a 
                                                                href={url} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer" 
                                                                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                                                            >
                                                                <ExternalLink className="w-3.5 h-3.5 text-amber-500" />
                                                                Open in Google Drive (If preview is restricted)
                                                            </a>
                                                        </div>
                                                    );
                                                }
                                                // Direct Audio/Video (Supabase Storage or direct link)
                                                if (url.includes('/storage/v1/object/public/') || url.match(/\.(mp4|webm|ogg|mp3|wav)$/i)) {
                                                    return (
                                                        <video 
                                                            className="w-full rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 bg-black aspect-video max-h-[300px] object-contain"
                                                            controls
                                                            src={url}
                                                        />
                                                    );
                                                }
                                                
                                                // Fallback
                                                return (
                                                    <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                                                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[200px]" title={url}>{url}</span>
                                                        <a 
                                                            href={url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900 font-bold text-xs rounded-md transition-colors shrink-0 shadow-sm"
                                                        >
                                                            <PlayCircle className="w-3.5 h-3.5" />
                                                            Open Link
                                                        </a>
                                                    </div>
                                                );
                                            })()}
                                        </section>
                                    )}

                                    {/* Grading Form */}
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Score (Out of 10)</label>
                                                <input 
                                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] outline-none" 
                                                    type="number" 
                                                    min="0" max="10" step="0.5" 
                                                    placeholder="8.5"
                                                    value={score}
                                                    onChange={(e) => setScore(e.target.value === '' ? '' : Number(e.target.value))}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Proficiency Level</label>
                                                <select 
                                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] outline-none"
                                                    value={proficiency}
                                                    onChange={(e) => setProficiency(e.target.value)}
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
                                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Feedback</label>
                                            <textarea 
                                                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] outline-none" 
                                                rows={4} 
                                                placeholder="Enter detailed feedback for the student..."
                                                value={feedback}
                                                onChange={(e) => setFeedback(e.target.value)}
                                            ></textarea>
                                        </div>
                                        <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-900/10 rounded-lg border border-rose-200 dark:border-rose-800">
                                            <input 
                                                className="rounded text-rose-600 focus:ring-rose-500 h-4 w-4 border-slate-300 dark:border-slate-600" 
                                                type="checkbox" 
                                                id="reassign"
                                                checked={reassign}
                                                onChange={(e) => setReassign(e.target.checked)}
                                            />
                                            <label className="text-sm font-semibold text-rose-700 dark:text-rose-400 flex flex-col cursor-pointer" htmlFor="reassign">
                                                Re-assign Task
                                                <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">Mark as incomplete and request a resubmission.</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                {selectedSub.student_id !== 'no-students' && (
                                    <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex">
                                        <button 
                                            onClick={handleSaveReview}
                                            disabled={isSaving}
                                            className="w-full bg-[#ecb613] text-slate-900 font-bold py-3 px-4 rounded-xl shadow-md hover:bg-[#ecb613]/90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                            {reassign ? 'Mark as Reviewed' : 'Mark as Reviewed & Close'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="h-full bg-slate-50 dark:bg-slate-800/30 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center p-12 text-center text-slate-500">
                                <div className="p-4 bg-white dark:bg-slate-800 rounded-full mb-4 shadow-sm">
                                    <ClipboardList className="w-12 h-12 text-slate-300 dark:text-slate-600" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Task Selected</h3>
                                <p className="text-sm mt-2 max-w-[240px]">Select a student submission from the list to begin review and provide feedback.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Embedded Create Task Modal */}
            {isCreateModalOpen && (
                <div className={`fixed inset-0 z-50 flex animate-in fade-in duration-200 ${isPopup ? 'bg-transparent' : 'bg-black/60 backdrop-blur-sm items-center justify-center p-4'}`}>
                    <div className={`bg-white dark:bg-slate-900 flex flex-col text-left ${isPopup ? 'w-full h-full overflow-y-auto' : 'rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200'}`}>
                        {/* Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 rounded-t-3xl">
                            <div>
                                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white leading-tight">
                                    {editingTaskId ? 'Edit Task' : 'Create New Task'}
                                </h2>
                                <p className="text-xs text-slate-500 mt-1 font-semibold">Assign tasks, lesson materials, and checksheets to classrooms or individual students</p>
                            </div>
                                <button 
                                    onClick={() => {
                                        setIsCreateModalOpen(false);
                                    setEditingTaskId(null);
                                    // Clear form
                                    setCreateTitle('');
                                    setCreateDescription('');
                                    setCreateDueDate('');
                                    setCreateFileUrl('');
                                    setCreateFileName('');
                                    setCreateFileSize(null);
                                    setCreateSelectedLessonId(null);
                                    setCreateSelectedLessonTitle(null);
                                    setSelectedPreviousTaskId(null);
                                    if (isPopup) {
                                        window.parent.postMessage('close_popup', '*');
                                    }
                                }} 
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-full text-slate-400 dark:text-slate-500 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
                            {/* Left Column: Title & Instructions */}
                            <div className="lg:col-span-2 space-y-6">
                                <div className="relative">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-355 uppercase tracking-wide">Task Title</label>
                                        {selectedPreviousTaskId && (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-450 tracking-wider">
                                                Reusing Previous Task
                                            </span>
                                        )}
                                    </div>
                                    <div className="relative flex items-center">
                                        <input 
                                            className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400 font-semibold text-sm" 
                                            placeholder="e.g. Master the Mohanam Raga Scale" 
                                            type="text"
                                            value={createTitle}
                                            onChange={(e) => handleTitleChange(e.target.value)}
                                            onFocus={() => setShowSuggestions(true)}
                                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                        />
                                        <button
                                            type="button"
                                            onMouseDown={(e) => {
                                                e.preventDefault(); // prevent blur
                                            }}
                                            onClick={() => {
                                                setShowSuggestions(prev => !prev);
                                            }}
                                            className="absolute right-3 p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                                            title="Show previous tasks"
                                        >
                                            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showSuggestions ? 'rotate-180' : ''}`} />
                                        </button>
                                    </div>
                                    {showSuggestions && filteredPreviousTasks.length > 0 && (
                                        <div 
                                            onMouseDown={(e) => e.preventDefault()} // Keep input focused
                                            className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50"
                                        >
                                            <div className="px-4 py-2 text-[10px] font-black text-slate-400 dark:text-slate-505 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/10">
                                                Previous Tasks (Click to Reuse)
                                            </div>
                                            {filteredPreviousTasks.map(task => (
                                                <button
                                                    key={task.id}
                                                    type="button"
                                                    onClick={() => handleSelectPreviousTask(task)}
                                                    className="w-full text-left px-4 py-3 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 flex items-center justify-between transition-colors group"
                                                >
                                                    <div className="flex-1 min-w-0 pr-4">
                                                        <div className="font-bold text-sm text-slate-800 dark:text-slate-205 truncate group-hover:text-amber-600 transition-colors">{task.title}</div>
                                                        <div className="text-xs text-slate-505 dark:text-slate-400 truncate mt-0.5"><AutoLinkText text={task.description} /></div>
                                                    </div>
                                                    {task.status === 'draft' && (
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-505 tracking-wider shrink-0">Draft</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">Detailed Instructions</label>
                                    <textarea 
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400 text-sm" 
                                        placeholder="Provide specific guidance on breath control, finger placement, or scale drills..." 
                                        rows={6}
                                        value={createDescription}
                                        onChange={(e) => setCreateDescription(e.target.value)}
                                    ></textarea>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wide">Learning Materials & Attachments</label>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <button 
                                            onClick={() => setIsInventoryOpen(true)}
                                            className="group flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl hover:border-amber-400 hover:bg-amber-50/20 dark:hover:bg-amber-900/10 transition-all text-center cursor-pointer" 
                                            type="button"
                                        >
                                            <Library className="w-6 h-6 text-amber-600 mb-1.5 group-hover:scale-110 transition-transform" />
                                            <span className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">Inventory</span>
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Sheet music library</span>
                                        </button>
                                        <button 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="group flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl hover:border-amber-400 hover:bg-amber-50/20 dark:hover:bg-amber-900/10 transition-all text-center cursor-pointer" 
                                            type="button"
                                        >
                                            {uploadProgress !== null ? (
                                                <Loader2 className="w-6 h-6 animate-spin text-amber-600 mb-1.5" />
                                            ) : (
                                                <Upload className="w-6 h-6 text-amber-600 mb-1.5 group-hover:scale-110 transition-transform" />
                                            )}
                                            <span className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
                                                {uploadProgress !== null ? `(${uploadProgress}%)` : 'Upload File'}
                                            </span>
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Audio, PDF, Image</span>
                                        </button>
                                        <button 
                                            onClick={() => setShowAudioRecorder(prev => !prev)}
                                            className={`group flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-2xl transition-all text-center cursor-pointer ${
                                                showAudioRecorder 
                                                    ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/20' 
                                                    : 'border-slate-200 dark:border-slate-800 hover:border-amber-400 hover:bg-amber-50/20 dark:hover:bg-amber-900/10'
                                            }`} 
                                            type="button"
                                        >
                                            <Mic className="w-6 h-6 text-amber-600 mb-1.5 group-hover:scale-110 transition-transform" />
                                            <span className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">Record Voice</span>
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Live audio note</span>
                                        </button>
                                    </div>

                                    {/* Audio Recorder Widget */}
                                    {showAudioRecorder && (
                                        <div className="mt-3">
                                            <AudioRecorderWidget
                                                onAudioRecorded={(file) => {
                                                    uploadTaskFile(file);
                                                    setShowAudioRecorder(false);
                                                }}
                                                onCancel={() => setShowAudioRecorder(false)}
                                                label="Record Voice Instruction"
                                            />
                                        </div>
                                    )}

                                    {/* Selected File Badge */}
                                    {createFileUrl && (
                                        <div className="mt-4 p-3 bg-amber-50/40 dark:bg-amber-955/10 rounded-xl border border-amber-100 dark:border-amber-900/20 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Paperclip className="w-4 h-4 text-amber-600 shrink-0" />
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate" title={createFileName}>
                                                        {createFileName}
                                                    </span>
                                                    {createFileSize && (
                                                        <span className="text-[10px] text-slate-400 font-mono">({formatFileSize(createFileSize)})</span>
                                                    )}
                                                </div>
                                                <button 
                                                    onClick={() => {
                                                        setCreateFileUrl('');
                                                        setCreateFileName('');
                                                        setCreateFileSize(null);
                                                    }}
                                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors shrink-0 cursor-pointer"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                            {(createFileUrl.includes('.webm') || createFileUrl.includes('.mp3') || createFileUrl.includes('.wav') || createFileUrl.includes('.m4a') || createFileUrl.includes('.ogg') || createFileName.toLowerCase().includes('voice')) && (
                                                <audio src={createFileUrl} controls className="w-full h-8 rounded-lg" />
                                            )}
                                        </div>
                                    )}

                                    {/* Topic Reference Badge */}
                                    {createSelectedLessonId && (
                                        <div className="mt-4 p-3 bg-amber-50/40 dark:bg-amber-955/10 rounded-xl border border-amber-100 dark:border-amber-900/20 flex items-center justify-between">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <BookOpen className="w-4 h-4 text-amber-655 shrink-0" />
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate" title={createSelectedLessonTitle || ''}>
                                                    Topic Reference: {createSelectedLessonTitle}
                                                </span>
                                                <span className="text-[10px] text-amber-650 bg-amber-100/50 dark:bg-amber-955/30 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">Curriculum</span>
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    setCreateSelectedLessonId(null);
                                                    setCreateSelectedLessonTitle(null);
                                                }}
                                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-805 rounded-full transition-colors shrink-0"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Column: Assignees & Target Config */}
                            <div className="lg:col-span-1 space-y-6 bg-slate-50/50 dark:bg-slate-800/10 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                                <div className="space-y-6">
                                    {/* Target Mode Selector */}
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-mono">Assign Target</label>
                                        <div className="grid grid-cols-3 gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <button
                                                type="button"
                                                onClick={() => handleTargetModeChange('classroom')}
                                                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                                                    assignmentTargetMode === 'classroom'
                                                        ? 'bg-amber-500 text-slate-900 shadow-xs'
                                                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                                                }`}
                                            >
                                                🏫 Class
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleTargetModeChange('individual')}
                                                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                                                    assignmentTargetMode === 'individual'
                                                        ? 'bg-amber-500 text-slate-900 shadow-xs'
                                                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                                                }`}
                                            >
                                                👤 Individual
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleTargetModeChange('all')}
                                                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                                                    assignmentTargetMode === 'all'
                                                        ? 'bg-amber-500 text-slate-900 shadow-xs'
                                                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                                                }`}
                                            >
                                                👥 All
                                            </button>
                                        </div>
                                    </div>

                                    {/* Class Selector for Classroom Mode */}
                                    {assignmentTargetMode === 'classroom' && (
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-mono">Select Classroom</label>
                                            <select 
                                                className="w-full px-3 py-2.5 bg-white dark:bg-slate-805 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none font-bold"
                                                value={createSelectedClassroom}
                                                onChange={(e) => handleClassroomChange(e.target.value)}
                                            >
                                                {sortClassroomsByDayAndTime(createClassrooms).map(cls => (
                                                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* All Students Notice */}
                                    {assignmentTargetMode === 'all' && (
                                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
                                                <ClipboardList className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">All Active Students</h4>
                                                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                                                    This task will be assigned to all <strong className="text-amber-600 dark:text-amber-400 font-black">{createStudents.length} active students</strong> across all academy classrooms.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Student Search & List (for Individual & Classroom modes) */}
                                    {assignmentTargetMode !== 'all' && (
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono shrink-0">Students</label>
                                                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-955/40 text-amber-700 dark:text-amber-300 font-mono truncate">
                                                        {selectedInFilteredCount}/{filteredCreateStudents.length} selected
                                                        {totalSelectedCount > selectedInFilteredCount && ` (${totalSelectedCount} total)`}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {totalSelectedCount > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setCreateStudents(prev => prev.map(s => ({ ...s, selected: false })))}
                                                            className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer select-none"
                                                            title="Clear all selections across all classrooms"
                                                        >
                                                            Clear All
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleAll(!isAllFilteredSelected)}
                                                        className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer select-none"
                                                    >
                                                        {isAllFilteredSelected ? 'Deselect' : 'Select All'}
                                                    </button>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isAllFilteredSelected}
                                                        onChange={(e) => handleToggleAll(e.target.checked)}
                                                        className="rounded border-slate-300 dark:border-slate-700 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                                                    />
                                                </div>
                                            </div>

                                            {assignmentTargetMode === 'individual' && (
                                                <div className="mb-2">
                                                    <select
                                                        value={createSelectedClassroom}
                                                        onChange={(e) => {
                                                            setCreateSelectedClassroom(e.target.value);
                                                            setCreateStudentPage(1);
                                                        }}
                                                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-805 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-semibold text-slate-700 dark:text-slate-300 outline-none"
                                                    >
                                                        <option value="all">Filter by Classroom: All Classrooms</option>
                                                        {sortClassroomsByDayAndTime(createClassrooms).map(cls => (
                                                            <option key={cls.id} value={cls.id}>{cls.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                            
                                            <div className="relative mb-2">
                                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                <input
                                                    type="text"
                                                    placeholder="Search student or classroom..."
                                                    value={createStudentSearch}
                                                    onChange={(e) => {
                                                        setCreateStudentSearch(e.target.value);
                                                        setCreateStudentPage(1);
                                                    }}
                                                    className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-805 text-xs focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-400"
                                                />
                                                {createStudentSearch && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setCreateStudentSearch('');
                                                            setCreateStudentPage(1);
                                                        }}
                                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full"
                                                        title="Clear search"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="p-3 bg-white dark:bg-slate-805 rounded-xl border border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto space-y-1">
                                                {filteredCreateStudents.slice((createStudentPage - 1) * ITEMS_PER_PAGE, createStudentPage * ITEMS_PER_PAGE).map(student => (
                                                    <div 
                                                        key={student.id} 
                                                        className={`flex items-center justify-between p-1.5 rounded-lg transition-all border ${
                                                            student.selected 
                                                                ? 'bg-amber-50/60 dark:bg-amber-955/20 border-amber-200/70 dark:border-amber-900/30' 
                                                                : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 border-transparent hover:border-slate-100 dark:hover:border-slate-600'
                                                        }`}
                                                    >
                                                        <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer select-none">
                                                            <input 
                                                                className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 border-slate-300 dark:border-slate-600 cursor-pointer" 
                                                                type="checkbox" 
                                                                checked={student.selected}
                                                                onChange={() => handleToggleStudent(student.id)}
                                                            />
                                                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20 shadow-sm shrink-0">
                                                                {student.profile_pic_url ? (
                                                                    <img 
                                                                        src={student.profile_pic_url} 
                                                                        alt={student.name} 
                                                                        className="w-full h-full object-cover rounded-full"
                                                                        loading="lazy"
                                                                    />
                                                                ) : (
                                                                    <div className="text-primary text-[8px] font-black">{student.name.charAt(0)}</div>
                                                                )}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate block">{student.name}</span>
                                                                <span className="text-[9px] text-slate-400 font-medium truncate block">
                                                                    {student.classroom_names && student.classroom_names.length > 0 ? student.classroom_names.join(', ') : 'Direct Student'}
                                                                </span>
                                                            </div>
                                                        </label>
                                                        
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleSelectSingleStudentOnly(student.id, e)}
                                                            className="text-[9px] font-black uppercase tracking-wider text-slate-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 px-1.5 py-0.5 rounded transition-all shrink-0 ml-1 border border-slate-200 dark:border-slate-700 hover:border-amber-300 font-mono"
                                                            title={`Select only ${student.name} and uncheck others`}
                                                        >
                                                            Only
                                                        </button>
                                                    </div>
                                                ))}
                                                {filteredCreateStudents.length === 0 && (
                                                    <p className="text-[10px] text-slate-500 text-center py-4 italic font-medium">No students match the current filter.</p>
                                                )}
                                            </div>

                                            {/* Pagination */}
                                            {filteredCreateStudents.length > ITEMS_PER_PAGE && (
                                                <div className="flex items-center justify-between mt-2 px-1">
                                                    <button 
                                                        onClick={() => setCreateStudentPage(p => Math.max(1, p - 1))}
                                                        disabled={createStudentPage === 1}
                                                        className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"
                                                    >
                                                        <ChevronLeft className="w-3.5 h-3.5" />
                                                    </button>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">
                                                        {createStudentPage} / {Math.ceil(filteredCreateStudents.length / ITEMS_PER_PAGE)}
                                                    </span>
                                                    <button 
                                                        onClick={() => setCreateStudentPage(p => Math.min(Math.ceil(filteredCreateStudents.length / ITEMS_PER_PAGE), p + 1))}
                                                        disabled={createStudentPage === Math.ceil(filteredCreateStudents.length / ITEMS_PER_PAGE)}
                                                        className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"
                                                    >
                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Due Date */}
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-mono">Due Date <span className="text-rose-500">*</span></label>
                                        <input 
                                            className="w-full px-3 py-2.5 bg-white dark:bg-slate-805 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none font-bold" 
                                            type="date"
                                            required
                                            value={createDueDate}
                                            onChange={(e) => setCreateDueDate(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3 pt-6 border-t border-slate-200 dark:border-slate-800">
                                    <button 
                                        type="button"
                                        onClick={() => handleAssignTask(false)}
                                        disabled={isSaving}
                                        className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                                    >
                                        {isSaving ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : editingTaskId ? (
                                            <Save className="w-4 h-4" />
                                        ) : (
                                            <Send className="w-4 h-4" />
                                        )}
                                        {editingTaskId ? 'Save Batch Changes' : (selectedPreviousTaskId ? 'Save & Assign Task' : 'Assign Task')}
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => handleAssignTask(true)}
                                        disabled={isSaving}
                                        className="w-full py-3 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-750 dark:text-slate-200 font-bold text-xs rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 active:translate-y-[1px] disabled:opacity-50"
                                    >
                                        <FileText className="w-4 h-4" />
                                        {editingTaskId ? 'Save as Draft' : 'Save as Draft'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Inventory Picker Sub-Modal */}
            {isInventoryOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 text-left">
                        {/* Header */}
                        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 rounded-t-3xl shrink-0">
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Select from Inventory Library</h3>
                                <p className="text-xs text-slate-505 font-semibold mt-0.5">Choose a learning material file to attach to the task</p>
                            </div>
                            <button 
                                onClick={() => setIsInventoryOpen(false)}
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {/* Search Bar */}
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900 shrink-0">
                            <div className="relative">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input 
                                    type="text"
                                    placeholder="Search headlines, modules, chapters, topics..."
                                    value={inventorySearchQuery}
                                    onChange={(e) => setInventorySearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400 text-slate-900 dark:text-white"
                                />
                                {inventorySearchQuery && (
                                    <button 
                                        onClick={() => setInventorySearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Collapsible Tree Body */}
                        <div className="p-5 overflow-y-auto flex-1 space-y-3 bg-[#f8f8f6]/30 dark:bg-[#221d10]/30">
                            {filteredCurriculumTree.length > 0 ? (
                                filteredCurriculumTree.map(cat => {
                                    const isCatExpanded = expandedCategories[cat.id] ?? false;
                                    return (
                                        <div key={cat.id} className="space-y-1.5 border border-slate-200 dark:border-slate-800/85 rounded-2xl p-3 bg-white dark:bg-slate-900/60 shadow-sm">
                                            {/* Category Headline Header */}
                                            <div 
                                                onClick={() => setExpandedCategories(prev => ({ ...prev, [cat.id]: !isCatExpanded }))}
                                                className="flex items-center justify-between cursor-pointer select-none group/cat pb-1.5 border-b border-dashed border-slate-200/60 dark:border-slate-800/60"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <BookOpen className="w-4 h-4 text-amber-500" />
                                                    <span className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider font-mono">
                                                        {cat.name}
                                                    </span>
                                                </div>
                                                <div className="text-slate-400 group-hover/cat:text-amber-500 transition-colors">
                                                    {isCatExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </div>
                                            </div>

                                            {/* Modules under Category */}
                                            {isCatExpanded && (
                                                <div className="space-y-2 pl-1.5 pt-1.5">
                                                    {cat.modules.map((mod: any) => {
                                                        const isModExpanded = expandedModules[mod.id] ?? false;
                                                        return (
                                                            <div key={mod.id} className="space-y-1 bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/40 rounded-xl p-2.5">
                                                                {/* Module Header */}
                                                                <div 
                                                                    onClick={() => setExpandedModules(prev => ({ ...prev, [mod.id]: !isModExpanded }))}
                                                                    className="flex items-center justify-between cursor-pointer select-none group/mod"
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-500 text-xs font-bold font-mono">
                                                                            M{mod.module_number}
                                                                        </div>
                                                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover/mod:text-amber-600 transition-colors">
                                                                            {mod.title}
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-slate-400 group-hover/mod:text-amber-500 transition-colors">
                                                                        {isModExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                                    </div>
                                                                </div>

                                                                {/* Chapters under Module */}
                                                                {isModExpanded && (
                                                                    <div className="space-y-1.5 pl-3 pt-2">
                                                                        {mod.chapters.map((chap: any) => {
                                                                            const isChapExpanded = expandedChapters[chap.id] ?? false;
                                                                            return (
                                                                                <div key={chap.id} className="space-y-1 border-l-2 border-slate-200 dark:border-slate-700 pl-3">
                                                                                    {/* Chapter Header */}
                                                                                    <div 
                                                                                        onClick={() => setExpandedChapters(prev => ({ ...prev, [chap.id]: !isChapExpanded }))}
                                                                                        className="flex items-center justify-between cursor-pointer select-none group/chap"
                                                                                    >
                                                                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover/chap:text-amber-600 transition-colors">
                                                                                            Chapter {chap.chapter_number}: {chap.title}
                                                                                        </span>
                                                                                        <div className="text-slate-400 group-hover/chap:text-amber-500 transition-colors">
                                                                                            {isChapExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* Topics under Chapter */}
                                                                                    {isChapExpanded && (
                                                                                        <div className="space-y-1 pt-1.5 pl-1">
                                                                                            {chap.lessons.map((lesson: any) => (
                                                                                                <button
                                                                                                    key={lesson.id}
                                                                                                    type="button"
                                                                                                    onClick={() => {
                                                                                                        setCreateSelectedLessonId(lesson.id);
                                                                                                        setCreateSelectedLessonTitle(lesson.title);
                                                                                                        setCreateFileUrl('');
                                                                                                        setCreateFileName('');
                                                                                                        setCreateFileSize(null);
                                                                                                        setIsInventoryOpen(false);
                                                                                                    }}
                                                                                                    className="w-full text-left p-2 hover:bg-amber-50/40 dark:hover:bg-amber-900/10 rounded-lg border border-transparent hover:border-amber-200/40 dark:hover:border-amber-900/20 transition-all flex items-center gap-2.5 group/lesson"
                                                                                                >
                                                                                                    <div className="w-7 h-7 rounded-md bg-[#f8f8f6] dark:bg-slate-900 flex items-center justify-center text-amber-500 shrink-0 border border-slate-100 dark:border-slate-800">
                                                                                                        {getLessonMaterialIcon(lesson.material_type, !!(lesson.material_url || lesson.link_url))}
                                                                                                    </div>
                                                                                                    <div className="min-w-0 flex-1">
                                                                                                        <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate group-hover/lesson:text-amber-600 transition-colors">
                                                                                                            {lesson.title}
                                                                                                        </h5>
                                                                                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate">
                                                                                                            {lesson.material_url 
                                                                                                                ? `File: ${lesson.file_name || 'Material'} • ${lesson.file_size || 'PDF'}` 
                                                                                                                : lesson.link_url 
                                                                                                                    ? `Link: ${lesson.link_url}` 
                                                                                                                    : 'Curriculum Topic'}
                                                                                                        </p>
                                                                                                    </div>
                                                                                                </button>
                                                                                            ))}
                                                                                            {chap.lessons.length === 0 && (
                                                                                                <p className="text-[10px] text-slate-400 italic pl-2">No topics in this chapter.</p>
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                        {mod.chapters.length === 0 && (
                                                                            <p className="text-[10px] text-slate-400 italic pl-3">No chapters in this module.</p>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                    {cat.modules.length === 0 && (
                                                        <p className="text-[10px] text-slate-400 italic pl-1.5">No modules in this category.</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-12">
                                    <p className="text-sm text-slate-500 italic">No matching curriculum items found.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden File Input */}
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleCreateFileUpload} 
                className="hidden" 
                accept=".pdf,.mp3,.wav,.mp4,.png,.jpg,.jpeg"
            />

        </div>
    );
}
