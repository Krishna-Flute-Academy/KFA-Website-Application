'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { Loader2, Search, Bell, UserCircle, Filter, Info, PlayCircle, CheckCircle, Save, X, ClipboardList, Plus, ChevronLeft, ChevronRight, Trash2, ChevronDown, ChevronUp, Edit2, Download, Upload, Library, Paperclip, Send, FileText, Clock, BookOpen, Video, Music, Image as ImageIcon } from 'lucide-react';
import TeacherSidebar from '../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../src/components/TeacherHeader';
import Link from 'next/link';
import { sendClassroomNotification } from '../../../src/lib/notifications';
import { sortClassroomsByDayAndTime } from '../../../src/lib/classroomSort';

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
}

interface TaskSubmission {
    id: string;
    student_id: string;
    student_name: string;
    student_profile_pic_url?: string;
    task_id: string;
    task_title: string;
// ... (rest of interface remains same)
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
        { id: 'all',       label: 'All Tasks',  color: 'text-slate-600' },
        { id: 'assigned',  label: 'Assigned',   color: 'text-blue-600' },
        { id: 'submitted', label: 'Submitted',  color: 'text-amber-600' },
        { id: 'reviewed',  label: 'Reviewed',   color: 'text-purple-600' },
        { id: 'approved',  label: 'Approved',   color: 'text-emerald-600' },
        { id: 'draft',     label: 'Drafts',     color: 'text-slate-400' },
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
    
    // Task Creation Form states
    const isPopup = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('popup') === 'true';
    const isCreate = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('create') === 'true';
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(isPopup || isCreate);
    const [createTitle, setCreateTitle] = useState('');
    const [createDescription, setCreateDescription] = useState('');
    const [createDueDate, setCreateDueDate] = useState('');
    const [createClassrooms, setCreateClassrooms] = useState<Classroom[]>([]);
    const [createSelectedClassroom, setCreateSelectedClassroom] = useState<string>('all');
    const [createStudents, setCreateStudents] = useState<Student[]>([]);
    const [createSelectAll, setCreateSelectAll] = useState(true);
    const [createStudentSearch, setCreateStudentSearch] = useState('');
    const [createStudentPage, setCreateStudentPage] = useState(1);
    
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
    
    // Inventory selection sub-modal state
    const [isInventoryOpen, setIsInventoryOpen] = useState(false);
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

            // Step 2: Get all enrolled students for these classrooms (with user details joined)
            const { data: enrollments, error: enrollError } = await supabaseAuth
                .from('classroom_students')
                .select(`
                    classroom_id,
                    student_id,
                    users!student_id(name, profile_pic_url, teacher_id)
                `)
                .in('classroom_id', classroomIds);

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

            // Step 3: Fetch all assignments created for these classrooms
            let assignmentsList: any[] | null = null;
            let assignmentsError = null;

            const res = await supabaseAuth
                .from('assignments')
                .select('id, title, description, created_at, due_date, target_type, classroom_id, status, inventory_ref_type, inventory_ref_id, inventory_ref_title, file_url, file_name, file_size')
                .in('classroom_id', classroomIds);
            
            assignmentsList = res.data;
            assignmentsError = res.error;

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

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabaseAuth.auth.getSession();
            if (!session) {
                router.push('/login?type=teacher');
                return;
            }

            // Clear unread task notifications
            await supabaseAuth
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
        setCurrentPage(1);
        let result = submissions;

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

        if (searchQuery.trim() !== '') {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(s =>
                s.student_name.toLowerCase().includes(lowerQuery) ||
                s.task_title.toLowerCase().includes(lowerQuery) ||
                (s.classroom_name && s.classroom_name.toLowerCase().includes(lowerQuery))
            );
        }
        setFilteredSubmissions(result);
    }, [activeTab, submissions, searchQuery]);

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
            // Fetch classrooms
            let classroomQuery = supabaseAuth
                .from('classrooms')
                .select('id, name, teacher_id');
            if (!isAdmin) {
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
            if (!isAdmin) {
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
            
            if (!isAdmin) {
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

                if (usersData) {
                    const formatted = usersData
                        .filter((item: any) => isAdmin || item.teacher_id === teacherId)
                        .map((item: any) => ({
                            id: item.id,
                            name: item.name || 'Unknown Student',
                            profile_pic_url: item.profile_pic_url || null,
                            selected: true,
                            classroom_ids: studentClassroomMap[item.id] || []
                        }));
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
        if (createSelectedClassroom && createSelectedClassroom !== 'all') {
            result = result.filter(s => s.classroom_ids?.includes(createSelectedClassroom));
        }
        if (createStudentSearch.trim() !== '') {
            const lowerQuery = createStudentSearch.toLowerCase();
            result = result.filter(s => s.name.toLowerCase().includes(lowerQuery));
        }
        return result;
    }, [createStudents, createSelectedClassroom, createStudentSearch]);

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
        if (task.due_date) {
            const d = new Date(task.due_date);
            setCreateDueDate(d.toISOString().split('T')[0]);
        } else {
            setCreateDueDate('');
        }
        setCreateSelectedClassroom(task.classroom_id || 'all');
        setSelectedPreviousTaskId(task.id);
        setShowSuggestions(false);

        // Restore file/reference fields
        setCreateFileUrl(task.file_url || '');
        setCreateFileName(task.file_name || '');
        setCreateFileSize(task.file_size || null);
        setCreateSelectedLessonId(task.inventory_ref_id || null);
        setCreateSelectedLessonTitle(task.inventory_ref_title || null);

        // Fetch currently assigned students for this task to pre-check them
        try {
            const { data: currentMappings } = await supabaseAuth
                .from('assignment_students')
                .select('student_id')
                .eq('assignment_id', task.id);

            if (currentMappings) {
                const assignedIds = new Set(currentMappings.map(m => m.student_id));
                setCreateStudents(prev => prev.map(s => ({
                    ...s,
                    selected: assignedIds.has(s.id)
                })));
            }
        } catch (err) {
            console.error('Error fetching assignees for previous task:', err);
        }
    };

    const handleToggleStudent = (studentId: string) => {
        setCreateStudents(prev => prev.map(s => 
            s.id === studentId ? { ...s, selected: !s.selected } : s
        ));
    };

    const handleToggleAll = (checked: boolean) => {
        setCreateSelectAll(checked);
        const filteredIds = new Set(filteredCreateStudents.map(s => s.id));
        setCreateStudents(prev => prev.map(s => 
            filteredIds.has(s.id) ? { ...s, selected: checked } : s
        ));
    };

    const handleCreateFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        let friendlySize = '';
        if (file.size >= 1024 * 1024) {
            friendlySize = `${(file.size / (1024 * 1024)).toFixed(1)}MB`;
        } else if (file.size >= 1024) {
            friendlySize = `${(file.size / 1024).toFixed(1)}KB`;
        } else {
            friendlySize = `${file.size} Bytes`;
        }

        let mappedType = 'file';
        if (file.type.startsWith('audio/')) {
            mappedType = 'audio';
        } else if (file.type.startsWith('video/')) {
            mappedType = 'video';
        } else if (file.type.includes('pdf') || file.name.endsWith('.pdf')) {
            mappedType = 'pdf';
        } else if (file.type.startsWith('image/')) {
            mappedType = 'image';
        }

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
            
            if (asg.due_date) {
                const d = new Date(asg.due_date);
                const formattedDate = d.toISOString().split('T')[0];
                setCreateDueDate(formattedDate);
            } else {
                setCreateDueDate('');
            }

            setCreateSelectedClassroom(asg.classroom_id || 'all');
            setCreateSelectAll(asg.target_type === 'all');
            setCreateFileUrl(asg.file_url || '');
            setCreateFileName(asg.file_name || '');
            setCreateFileSize(asg.file_size ? Number(asg.file_size) : null);
            setCreateSelectedLessonId(asg.inventory_ref_id || null);
            setCreateSelectedLessonTitle(asg.inventory_ref_title || null);

            // Fetch current mappings to select students
            const { data: currentMappings } = await supabaseAuth
                .from('assignment_students')
                .select('student_id')
                .eq('assignment_id', taskId);

            const assignedIds = new Set((currentMappings || []).map(m => m.student_id));

            setCreateStudents(prev => prev.map(student => ({
                ...student,
                selected: asg.target_type === 'all' || assignedIds.has(student.id)
            })));

            setIsCreateModalOpen(true);
        } catch (err) {
            console.error('Failed to load task details for editing:', err);
            alert('Failed to load task details.');
        }
    };

    const handleAssignTask = async (isDraft: boolean = false) => {
        const { data: { session } } = await supabaseAuth.auth.getSession();
        if (!session) return;
        
        if (!createTitle || !createDescription) {
            alert('Please fill in task title and instructions.');
            return;
        }

        if (createClassrooms.length === 0) {
            alert('Please create at least one classroom before assigning tasks.');
            return;
        }

        const selectedStudents = createStudents.filter(s => s.selected);
        if (!isDraft && selectedStudents.length === 0) {
            alert('Please select at least one student.');
            return;
        }

        // Group selected students by classroom ID
        const studentsByClass: Record<string, string[]> = {};
        
        if (selectedStudents.length > 0) {
            selectedStudents.forEach(s => {
                let studentClassId = createClassrooms[0].id;
                if (createSelectedClassroom && createSelectedClassroom !== 'all') {
                    studentClassId = createSelectedClassroom;
                } else if (s.classroom_ids && s.classroom_ids.length > 0) {
                    studentClassId = s.classroom_ids[0];
                }
                
                if (!studentsByClass[studentClassId]) {
                    studentsByClass[studentClassId] = [];
                }
                studentsByClass[studentClassId].push(s.id);
            });
        } else {
            const classId = createSelectedClassroom === 'all' ? createClassrooms[0].id : createSelectedClassroom;
            studentsByClass[classId] = [];
        }

        setIsSaving(true);
        try {
            if (editingTaskId) {
                const classId = createSelectedClassroom === 'all' ? (createClassrooms[0]?.id || null) : createSelectedClassroom;
                const classroomObj = createClassrooms.find(c => c.id === classId);
                const classTeacherId = classroomObj?.teacher_id || session.user.id;

                const updateData: any = {
                    title: createTitle,
                    description: createDescription,
                    due_date: createDueDate || null,
                    classroom_id: classId,
                    teacher_id: classTeacherId,
                    target_type: createSelectedClassroom === 'all' && createSelectAll ? 'all' : 'individual',
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

                if (updateError && (updateError.code === '42703' || updateError.message?.includes('status'))) {
                    delete updateData.status;
                    let fallbackUpdate = await supabaseAuth
                        .from('assignments')
                        .update(updateData)
                        .eq('id', editingTaskId);
                    
                    if (fallbackUpdate.error && fallbackUpdate.error.code === '42703') {
                        delete updateData.file_url;
                        delete updateData.file_name;
                        delete updateData.file_size;
                        delete updateData.inventory_ref_id;
                        delete updateData.inventory_ref_title;
                        delete updateData.inventory_ref_type;
                        
                        fallbackUpdate = await supabaseAuth
                            .from('assignments')
                            .update(updateData)
                            .eq('id', editingTaskId);
                    }
                    updateError = fallbackUpdate.error;
                }

                if (updateError) throw updateError;

                // Sync student mappings
                if (isDraft) {
                    await supabaseAuth
                        .from('assignment_students')
                        .delete()
                        .eq('assignment_id', editingTaskId);
                } else {
                    const studentIds = selectedStudents.map(s => s.id);
                    const { data: currentMappings } = await supabaseAuth
                        .from('assignment_students')
                        .select('student_id')
                        .eq('assignment_id', editingTaskId);

                    const existingStudentIds = new Set((currentMappings || []).map(m => m.student_id));
                    const targetStudentIds = new Set(studentIds);

                    const toRemove = [...existingStudentIds].filter(id => !targetStudentIds.has(id));
                    if (toRemove.length > 0) {
                        await supabaseAuth
                            .from('assignment_students')
                            .delete()
                            .eq('assignment_id', editingTaskId)
                            .in('student_id', toRemove);
                    }

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

                alert(isDraft ? 'Task draft saved successfully!' : 'Task changes saved successfully!');

                if (!isDraft) {
                    // Notify students whose tasks were updated
                    const studentIds = selectedStudents.map(s => s.id);
                    if (studentIds.length > 0) {
                        await sendClassroomNotification({
                            teacherId: session.user.id,
                            recipients: [{ id: 'custom', name: 'Students', type: 'custom' }],
                            title: `📋 Task Updated: ${createTitle}`,
                            message: `Your teacher has updated the task "${createTitle}". Check your Tasks tab for details.`,
                            studentIds
                        });
                    }
                }
            } else {
                const originalTask = previousTasks.find(t => t.id === selectedPreviousTaskId);

                for (const [classId, studentIds] of Object.entries(studentsByClass)) {
                    const isReusedTask = selectedPreviousTaskId && originalTask && classId === originalTask.classroom_id;

                    let assignmentIdToUse = '';
                    let assignmentError = null;

                    const classroomObj = createClassrooms.find(c => c.id === classId);
                    const classTeacherId = classroomObj?.teacher_id || session.user.id;

                    const updateData: any = {
                        title: createTitle,
                        description: createDescription,
                        due_date: createDueDate || null,
                        teacher_id: classTeacherId,
                        target_type: createSelectedClassroom === 'all' && createSelectAll ? 'all' : 'individual',
                        status: isDraft ? 'draft' : 'active',
                        file_url: createFileUrl || null,
                        file_name: createFileName || null,
                        file_size: createFileSize || null,
                        inventory_ref_id: createSelectedLessonId || null,
                        inventory_ref_title: createSelectedLessonTitle || null,
                        inventory_ref_type: createSelectedLessonId ? 'lesson' : null
                    };

                    if (isReusedTask) {
                        assignmentIdToUse = selectedPreviousTaskId!;
                        const { error } = await supabaseAuth
                            .from('assignments')
                            .update(updateData)
                            .eq('id', assignmentIdToUse);

                        assignmentError = error;

                        if (assignmentError && (assignmentError.code === '42703' || assignmentError.message?.includes('status'))) {
                            delete updateData.status;
                            const fallback = await supabaseAuth
                                .from('assignments')
                                .update(updateData)
                                .eq('id', assignmentIdToUse);
                            assignmentError = fallback.error;
                        }
                    } else {
                        const insertData = {
                            classroom_id: classId,
                            teacher_id: classTeacherId,
                            ...updateData,
                            created_at: new Date().toISOString()
                        };

                        let { data: newAsg, error: newAsgError } = await supabaseAuth
                            .from('assignments')
                            .insert(insertData)
                            .select()
                            .single();

                        assignmentError = newAsgError;

                        if (newAsgError && (newAsgError.code === '42703' || newAsgError.message?.includes('status'))) {
                            delete insertData.status;
                            let fallback = await supabaseAuth
                                .from('assignments')
                                .insert(insertData)
                                .select()
                                .single();
                            
                            if (fallback.error && fallback.error.code === '42703') {
                                delete insertData.file_url;
                                delete insertData.file_name;
                                delete insertData.file_size;
                                delete insertData.inventory_ref_id;
                                delete insertData.inventory_ref_title;
                                delete insertData.inventory_ref_type;
                                
                                fallback = await supabaseAuth
                                    .from('assignments')
                                    .insert(insertData)
                                    .select()
                                    .single();
                            }
                            
                            newAsg = fallback.data;
                            assignmentError = fallback.error;
                        }

                        if (newAsg) {
                            assignmentIdToUse = newAsg.id;
                        }
                    }

                    if (assignmentError) throw assignmentError;

                    // Sync assignment student mappings
                    if (isReusedTask) {
                        const { data: currentMappings } = await supabaseAuth
                            .from('assignment_students')
                            .select('student_id')
                            .eq('assignment_id', assignmentIdToUse);

                        const existingStudentIds = new Set((currentMappings || []).map(m => m.student_id));
                        const targetStudentIds = new Set(studentIds);

                        const toRemove = [...existingStudentIds].filter(id => !targetStudentIds.has(id));
                        if (toRemove.length > 0) {
                            await supabaseAuth
                                .from('assignment_students')
                                .delete()
                                .eq('assignment_id', assignmentIdToUse)
                                .in('student_id', toRemove);
                        }

                        const toAdd = studentIds.filter(id => !existingStudentIds.has(id));
                        if (toAdd.length > 0 && !isDraft) {
                            const newMappings = toAdd.map(studentId => ({
                                assignment_id: assignmentIdToUse,
                                student_id: studentId,
                                status: 'pending'
                            }));

                            const { error: mappingError } = await supabaseAuth
                                .from('assignment_students')
                                .insert(newMappings);

                            if (mappingError) throw mappingError;
                        }
                        
                        if (isDraft) {
                            await supabaseAuth
                                .from('assignment_students')
                                .delete()
                                .eq('assignment_id', assignmentIdToUse);
                        }
                    } else {
                        if (!isDraft && studentIds.length > 0) {
                            const studentMappings = studentIds.map(studentId => ({
                                assignment_id: assignmentIdToUse,
                                student_id: studentId,
                                status: 'pending'
                            }));

                            const { error: mappingError } = await supabaseAuth
                                .from('assignment_students')
                                .insert(studentMappings);

                            if (mappingError) throw mappingError;
                        }
                    }
                }

                alert(isDraft ? 'Task draft saved successfully!' : 'Task assigned successfully!');

                if (!isDraft) {
                    // Fire notifications for all assigned students across all classrooms
                    const allAssignedStudentIds = selectedStudents.map(s => s.id);
                    if (allAssignedStudentIds.length > 0) {
                        await sendClassroomNotification({
                            teacherId: session.user.id,
                            recipients: [{ id: 'custom', name: 'Students', type: 'custom' }],
                            title: `📋 New Task: ${createTitle}`,
                            message: `Your teacher has assigned you a new task: "${createTitle}".${ createDueDate ? ` Due by ${new Date(createDueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.` : '' } Check your Tasks tab to get started!`,
                            studentIds: allAssignedStudentIds
                        });
                    } else {
                        // 'all' class assignment — notify entire classroom
                        const classIds = Object.keys(studentsByClass);
                        for (const classId of classIds) {
                            await sendClassroomNotification({
                                teacherId: session.user.id,
                                recipients: [{ id: classId, name: 'Class', type: 'class' }],
                                title: `📋 New Task: ${createTitle}`,
                                message: `Your teacher has assigned a new task to your class: "${createTitle}".${ createDueDate ? ` Due by ${new Date(createDueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.` : '' } Check your Tasks tab!`
                            });
                        }
                    }
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
            const details = error?.details || 'No details';
            const hint = error?.hint || 'No hint';
            const code = error?.code || 'No code';
            alert(`Failed to save task:\nMessage: ${msg}\nDetails: ${details}\nHint: ${hint}\nCode: ${code}\nFull Error: ${JSON.stringify(error)}`);
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

    const toggleTaskCollapse = (groupKey: string) => {
        setCollapsedTasks(prev => {
            const current = prev[groupKey] ?? true;
            return {
                ...prev,
                [groupKey]: !current
            };
        });
    };

    const groupedSubmissions = useMemo(() => {
        const groups: Record<string, { groupName: string; submissions: TaskSubmission[] }> = {};
        
        filteredSubmissions.forEach(sub => {
            const taskKey = sub.task_title || 'Unassigned Tasks';
            
            if (!groups[taskKey]) {
                groups[taskKey] = {
                    groupName: taskKey,
                    submissions: []
                };
            }
            groups[taskKey].submissions.push(sub);
        });
        
        return Object.entries(groups).map(([groupKey, val]) => ({
            taskTitle: groupKey,
            submissions: val.submissions
        }));
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

                <div className="p-4 sm:p-6 md:p-8 grid grid-cols-12 gap-8 w-full flex-1">
                    {/* Left Column: Submission List */}
                    <div className="col-span-12 lg:col-span-7 space-y-6 flex flex-col h-full">
                        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Task Review</h1>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">Review student performance and provide feedback</p>
                            </div>
                            <div className="flex gap-2 items-center flex-wrap">
                                {selectedSubIds.length > 0 && (
                                    <button 
                                        onClick={handleDeleteBulk}
                                        disabled={isDeleting}
                                        className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 shadow-sm active:scale-[0.98] disabled:opacity-50 animate-in fade-in duration-200"
                                        title="Delete Selected"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        <span>Delete ({selectedSubIds.length})</span>
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
                                        setCreateStudents(prev => prev.map(s => ({ ...s, selected: true })));
                                        setIsCreateModalOpen(true);
                                    }}
                                    className="bg-[#ecb613] text-slate-900 px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#ecb613]/90 transition-colors flex items-center gap-2 shadow-sm"
                                >
                                    <Plus className="w-4 h-4" />
                                    Create Task
                                </button>
                            </div>
                        </header>

                        {/* Filter Tabs */}
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-sm overflow-x-auto scrollbar-none whitespace-nowrap snap-x">
                            {tabConfig.map(tab => {
                                const count = tab.id === 'all'
                                    ? new Set(submissions.map(s => s.task_id)).size
                                    : tab.id === 'assigned'
                                    ? new Set(submissions.filter(s => s.status === 'pending' && s.student_id !== 'draft' && s.student_id !== 'no-students').map(s => s.task_id)).size
                                    : tab.id === 'reviewed'
                                    ? new Set(submissions.filter(s => s.status === 'reviewed').map(s => s.task_id)).size
                                    : new Set(submissions.filter(s => s.status.toLowerCase() === tab.id).map(s => s.task_id)).size;

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
                            {groupedSubmissions.map((group) => {
                                const isCollapsed = collapsedTasks[group.taskTitle] ?? true;
                                const pendingCount = group.submissions.filter(s => s.status === 'submitted').length;
                                const isDraft = group.submissions.some(s => s.status === 'draft');
                                
                                return (
                                    <div 
                                        key={group.taskTitle} 
                                        className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-all hover:shadow-md"
                                    >
                                        {/* Task Accordion Header */}
                                        <header 
                                            onClick={() => {
                                                toggleTaskCollapse(group.taskTitle);
                                            }}
                                            className="px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between cursor-pointer select-none hover:bg-slate-100/50 dark:hover:bg-slate-800/60 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <input 
                                                    type="checkbox"
                                                    className="rounded border-slate-300 dark:border-slate-700 text-[#ecb613] focus:ring-[#ecb613] cursor-pointer w-4 h-4 mr-1 shrink-0"
                                                    checked={
                                                        group.submissions.length > 0 &&
                                                        group.submissions.every(sub => selectedSubIds.includes(sub.id))
                                                    }
                                                    onChange={(e) => {
                                                        const groupIds = group.submissions.map(s => s.id);
                                                        if (e.target.checked) {
                                                            setSelectedSubIds(prev => [...new Set([...prev, ...groupIds])]);
                                                        } else {
                                                            setSelectedSubIds(prev => prev.filter(id => !groupIds.includes(id)));
                                                        }
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <div className="w-10 h-10 rounded-lg bg-[#ecb613]/10 flex items-center justify-center text-[#ecb613] shrink-0">
                                                    <ClipboardList className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-bold text-slate-800 dark:text-white text-base leading-tight hover:text-[#ecb613] transition-colors">{group.taskTitle}</h3>
                                                        {isDraft && (
                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700 tracking-wider">
                                                                Draft
                                                            </span>
                                                        )}
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEditTaskClick(group.submissions[0].task_id);
                                                            }}
                                                            className="text-slate-400 hover:text-[#ecb613] transition-colors p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/80"
                                                            title="Edit Task"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteSingle(e, group.submissions[0].id);
                                                            }}
                                                            disabled={isDeleting}
                                                            className="text-slate-400 hover:text-rose-500 transition-colors p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/80 disabled:opacity-50"
                                                            title="Delete Task"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                                        {isDraft ? 'Saved as Draft' : `${group.submissions.length} Student${group.submissions.length !== 1 ? 's' : ''} assigned`}
                                                        {pendingCount > 0 && ` • ${pendingCount} Pending Review`}
                                                    </p>
                                                </div>
                                            </div>
                                            <div 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleTaskCollapse(group.taskTitle);
                                                }}
                                                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors cursor-pointer"
                                                title={isCollapsed ? "Show students list" : "Hide students list"}
                                            >
                                                {isCollapsed ? (
                                                    <ChevronDown className="w-5 h-5 text-slate-500" />
                                                ) : (
                                                    <ChevronUp className="w-5 h-5 text-slate-500" />
                                                )}
                                            </div>
                                        </header>

                                        {/* Task Table or Draft Empty State (Visible when not collapsed) */}
                                        {!isCollapsed && (
                                            isDraft ? (
                                                <div className="p-8 text-center bg-slate-50/50 dark:bg-slate-800/10 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center">
                                                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                                                        <ClipboardList className="w-6 h-6 text-slate-400" />
                                                    </div>
                                                    <h4 className="font-bold text-slate-800 dark:text-white text-sm">This Task is a Draft</h4>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm leading-relaxed">
                                                        This task has not been assigned to any students yet. You can keep it as a draft or delete it when you're ready.
                                                    </p>
                                                    <div className="mt-4 flex gap-2">
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEditTaskClick(group.submissions[0].task_id);
                                                            }}
                                                            className="px-4 py-2 bg-[#ecb613] text-slate-900 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 active:scale-[0.98]"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                            Edit Draft
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => handleDeleteSingle(e, group.submissions[0].id)}
                                                            disabled={isDeleting}
                                                            className="px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 active:scale-[0.98] disabled:opacity-50"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            Delete Draft
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto transition-all duration-300">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead className="bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800">
                                                            <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                                <th className="w-12 px-6 py-4 text-center">
                                                                    <input 
                                                                        type="checkbox"
                                                                        className="rounded border-slate-300 dark:border-slate-700 text-[#ecb613] focus:ring-[#ecb613] cursor-pointer"
                                                                        checked={
                                                                            group.submissions.length > 0 &&
                                                                            group.submissions.every(sub => selectedSubIds.includes(sub.id))
                                                                        }
                                                                        onChange={(e) => {
                                                                            const groupIds = group.submissions.map(s => s.id);
                                                                            if (e.target.checked) {
                                                                                setSelectedSubIds(prev => [...new Set([...prev, ...groupIds])]);
                                                                            } else {
                                                                                setSelectedSubIds(prev => prev.filter(id => !groupIds.includes(id)));
                                                                            }
                                                                        }}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    />
                                                                </th>
                                                                <th className="px-6 py-4">Student Name</th>
                                                                <th className="px-6 py-4">Classroom</th>
                                                                <th className="px-6 py-4">Date</th>
                                                                <th className="px-6 py-4">Status</th>
                                                                <th className="px-6 py-4 text-right">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                                            {group.submissions.map((sub) => (
                                                                <tr 
                                                                    key={sub.id} 
                                                                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors ${selectedSub?.id === sub.id ? 'bg-[#ecb613]/5' : ''}`}
                                                                    onClick={() => handleSelectSubmission(sub)}
                                                                >
                                                                    <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
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
                                                                    <td className="px-6 py-4 text-label">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20 shadow-sm">
                                                                                {sub.student_profile_pic_url ? (
                                                                                    <img 
                                                                                        src={sub.student_profile_pic_url} 
                                                                                        alt={sub.student_name} 
                                                                                        className="w-full h-full object-cover rounded-full"
                                                                                        loading="lazy"
                                                                                    />
                                                                                ) : (
                                                                                    <div className="text-primary text-[10px] font-black">{sub.student_name.charAt(0)}</div>
                                                                                )}
                                                                            </div>
                                                                            <span className="text-sm font-medium truncate">{sub.student_name}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 truncate max-w-[200px]">{sub.classroom_name || 'Individual'}</td>
                                                                    <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                                                                        {new Date(sub.submitted_at).toLocaleDateString()}
                                                                    </td>
                                                                    <td className="px-6 py-4">
                                                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${
                                                                            sub.status === 'submitted' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                                                            sub.status === 'reviewed' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                                                            sub.status === 'approved' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                                                                            sub.status === 'pending' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700' :
                                                                            'bg-slate-100 text-slate-500 border-slate-200'
                                                                        }`}>
                                                                            {sub.status}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                                        <button 
                                                                            onClick={(e) => handleDeleteSingle(e, sub.id)}
                                                                            disabled={isDeleting}
                                                                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors inline-flex items-center justify-center disabled:opacity-50"
                                                                            title="Delete Task Assignment"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
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
                            
                            {groupedSubmissions.length === 0 && (
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
                                            {selectedSub.task_description || 'No description provided for this task.'}
                                        </p>
                                    </section>

                                    {/* Task Attachment if exists */}
                                    {selectedSub.file_url && (
                                        <section className="bg-slate-50 dark:bg-slate-800/20 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                                            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-2">
                                                <Paperclip className="w-3.5 h-3.5" />
                                                Attachments
                                            </h3>
                                            <div className="flex items-center justify-between gap-3 mt-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
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
                                                    const embedUrl = url.replace(/\/view.*$/, '/preview');
                                                    return (
                                                        <iframe 
                                                            className="w-full aspect-[4/3] w-full rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 bg-slate-100"
                                                            src={embedUrl}
                                                            title="Student Submission Video"
                                                            allow="autoplay"
                                                        ></iframe>
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
                                                        <div className="text-xs text-slate-505 dark:text-slate-400 truncate mt-0.5">{task.description}</div>
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
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <button 
                                            onClick={() => setIsInventoryOpen(true)}
                                            className="group flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl hover:border-amber-400 hover:bg-amber-50/20 dark:hover:bg-amber-900/10 transition-all text-center" 
                                            type="button"
                                        >
                                            <Library className="w-7 h-7 text-amber-600 mb-2 group-hover:scale-110 transition-transform" />
                                            <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Inventory Library</span>
                                            <span className="text-xs text-slate-505 mt-1">Pick from uploaded sheet music</span>
                                        </button>
                                        <button 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="group flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl hover:border-amber-400 hover:bg-amber-50/20 dark:hover:bg-amber-900/10 transition-all text-center" 
                                            type="button"
                                        >
                                            {uploadProgress !== null ? (
                                                <Loader2 className="w-7 h-7 animate-spin text-amber-650 mb-2" />
                                            ) : (
                                                <Upload className="w-7 h-7 text-amber-600 mb-2 group-hover:scale-110 transition-transform" />
                                            )}
                                            <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                                                {uploadProgress !== null ? `Uploading (${uploadProgress}%)` : 'Upload New'}
                                            </span>
                                            <span className="text-xs text-slate-505 mt-1">Audio, PDF, Image, or Video</span>
                                        </button>
                                    </div>
                                                                    {/* Selected File Badge */}
                                    {createFileUrl && (
                                        <div className="mt-4 p-3 bg-amber-50/40 dark:bg-amber-955/10 rounded-xl border border-amber-100 dark:border-amber-900/20 flex items-center justify-between">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Paperclip className="w-4 h-4 text-amber-650 shrink-0" />
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
                                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-805 rounded-full transition-colors shrink-0"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
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
                                    {/* Class Selector */}
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-mono">Select Class</label>
                                        <select 
                                            className="w-full px-3 py-2.5 bg-white dark:bg-slate-805 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none font-bold"
                                            value={createSelectedClassroom}
                                            onChange={(e) => setCreateSelectedClassroom(e.target.value)}
                                        >
                                            <option value="all">All Students (Student Directory)</option>
                                            {sortClassroomsByDayAndTime(createClassrooms).map(cls => (
                                                <option key={cls.id} value={cls.id}>{cls.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Student Search & List */}
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Students</label>
                                            <label className="inline-flex items-center cursor-pointer select-none">
                                                <span className="mr-2 text-[10px] font-extrabold text-slate-500">Select All</span>
                                                <input 
                                                    type="checkbox" 
                                                    checked={createSelectAll}
                                                    onChange={(e) => handleToggleAll(e.target.checked)}
                                                    className="rounded border-slate-300 dark:border-slate-705 text-amber-600 focus:ring-amber-505 w-4 h-4 cursor-pointer"
                                                />
                                            </label>
                                        </div>
                                        
                                        <div className="relative mb-2">
                                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                            <input
                                                type="text"
                                                placeholder="Search student list..."
                                                value={createStudentSearch}
                                                onChange={(e) => setCreateStudentSearch(e.target.value)}
                                                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-805 text-xs focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-400"
                                            />
                                        </div>

                                        <div className="p-3 bg-white dark:bg-slate-805 rounded-xl border border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto space-y-1">
                                            {filteredCreateStudents.slice((createStudentPage - 1) * ITEMS_PER_PAGE, createStudentPage * ITEMS_PER_PAGE).map(student => (
                                                <label key={student.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-all cursor-pointer border border-transparent hover:border-slate-100 dark:hover:border-slate-600">
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
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{student.name}</span>
                                                </label>
                                            ))}
                                            {filteredCreateStudents.length === 0 && (
                                                <p className="text-[10px] text-slate-500 text-center py-4 italic font-medium">No students in this class.</p>
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

                                    {/* Due Date */}
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-mono">Due Date</label>
                                        <input 
                                            className="w-full px-3 py-2.5 bg-white dark:bg-slate-805 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none font-bold" 
                                            type="date"
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
                                        {editingTaskId ? 'Save Changes' : (selectedPreviousTaskId ? 'Save & Assign Task' : 'Assign Task')}
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
