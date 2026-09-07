'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { 
    Loader2, Plus, Inbox, ClipboardList, Library, CheckCircle2, 
    Search, Filter, Sparkles, BookOpen 
} from 'lucide-react';
import TeacherSidebar from '../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../src/components/TeacherHeader';
import { sendClassroomNotification } from '../../../src/lib/notifications';

// Modular Tasks Components
import { 
    TaskSubmission, AssignmentBatch, TaskTemplateGroup, 
    Classroom, Student, TasksTab, TeacherProfile, formatDateForInput 
} from '../../../src/components/teacher-dashboard/tasks/types';
import TaskReviewQueue from '../../../src/components/teacher-dashboard/tasks/TaskReviewQueue';
import TaskAssignmentList from '../../../src/components/teacher-dashboard/tasks/TaskAssignmentList';
import TaskTemplateLibrary from '../../../src/components/teacher-dashboard/tasks/TaskTemplateLibrary';
import TaskCompletedList from '../../../src/components/teacher-dashboard/tasks/TaskCompletedList';
import ReviewDrawer from '../../../src/components/teacher-dashboard/tasks/ReviewDrawer';
import MobileReviewScreen from '../../../src/components/teacher-dashboard/tasks/MobileReviewScreen';
import TaskCreateDialog from '../../../src/components/teacher-dashboard/tasks/TaskCreateDialog';

export default function TaskReviewPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<TeacherProfile | null>(null);
    const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
    
    // Top-level 4 views navigation
    const [activeTab, setActiveTab] = useState<TasksTab>('review');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Review Modal / Drawer States
    const [selectedSub, setSelectedSub] = useState<TaskSubmission | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isMobileReviewOpen, setIsMobileReviewOpen] = useState(false);

    // Creation / Edit Dialog States
    const isPopup = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('popup') === 'true';
    const isCreate = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('create') === 'true';
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(isPopup || isCreate);
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [initialCreateData, setInitialCreateData] = useState<any>(null);

    // Shared data
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [previousTasks, setPreviousTasks] = useState<any[]>([]);
    const [inventoryCategories, setInventoryCategories] = useState<any[]>([]);
    const [inventoryModules, setInventoryModules] = useState<any[]>([]);
    const [inventoryChapters, setInventoryChapters] = useState<any[]>([]);
    const [inventoryLessons, setInventoryLessons] = useState<any[]>([]);

    // 1. Fetch submissions
    const fetchSubmissions = useCallback(async (userId: string, isAdmin: boolean = false) => {
        // Trigger automated task reminders in the background
        fetch('/api/notifications/check-task-reminders', { method: 'POST' }).catch(err => console.error('Error running task reminders:', err));

        try {
            // Step 1: Get classrooms
            let classroomQuery = supabaseAuth.from('classrooms').select('id, name');
            if (!isAdmin) {
                classroomQuery = classroomQuery.eq('teacher_id', userId);
            }
            const { data: classroomsData, error: classroomError } = await classroomQuery;

            if (classroomError) {
                console.error('Error fetching classrooms:', classroomError);
                return;
            }

            const classroomIds = (classroomsData || []).map(c => c.id);
            if (classroomIds.length === 0) {
                setSubmissions([]);
                return;
            }

            // Step 2 & 3: Enrollments & Assignments in parallel
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

            const [{ data: enrollments, error: enrollError }, res] = await Promise.all([
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

            let assignmentsList: any[] | null = res.data;
            let assignmentsError = res.error;

            if (assignmentsError && (assignmentsError.code === '42703' || assignmentsError.message?.includes('status'))) {
                const fallback = await supabaseAuth
                    .from('assignments')
                    .select('id, title, description, created_at, due_date, target_type, classroom_id, inventory_ref_type, inventory_ref_id, inventory_ref_title, file_url, file_name, file_size')
                    .in('classroom_id', classroomIds);
                assignmentsList = fallback.data;
                assignmentsError = fallback.error;
            }

            if (assignmentsError) {
                console.error('Error fetching assignments:', assignmentsError);
                return;
            }

            const assignmentIds = (assignmentsList || []).map(a => a.id);
            if (assignmentIds.length === 0) {
                setSubmissions([]);
                return;
            }

            // Step 4: Fetch assignment_students
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

            if (asgStudentsError && (asgStudentsError.code === '42703' || asgStudentsError.message?.includes('score'))) {
                const fallback = await supabaseAuth
                    .from('assignment_students')
                    .select('id, status, student_id, assignment_id')
                    .in('assignment_id', assignmentIds);
                assignmentStudents = fallback.data as any[];
            }

            // Step 5: Format submissions list
            const formatted: TaskSubmission[] = [];

            (assignmentsList || []).forEach(asg => {
                const isAutoCurriculum = asg.inventory_ref_type && asg.title === asg.inventory_ref_title;
                if (isAutoCurriculum) return;

                const associatedClassStudents = studentsList.filter(s => s.classroom_id === asg.classroom_id);
                const classInfo = (classroomsData || []).find(c => c.id === asg.classroom_id);
                const className = classInfo?.name || 'Unknown Class';

                if ((asg as any).status === 'draft') {
                    formatted.push({
                        id: `draft-${asg.id}`,
                        student_id: 'draft',
                        student_name: 'No Students Assigned',
                        task_id: asg.id,
                        task_title: asg.title || 'Untitled Task',
                        task_description: asg.description || '',
                        status: 'draft',
                        submitted_at: asg.created_at || new Date().toISOString(),
                        classroom_id: asg.classroom_id,
                        classroom_name: className,
                        due_date: asg.due_date || null,
                        inventory_ref_type: asg.inventory_ref_type || null,
                        inventory_ref_id: asg.inventory_ref_id || null,
                        inventory_ref_title: asg.inventory_ref_title || null,
                        file_url: asg.file_url || '',
                        file_name: asg.file_name || '',
                        file_size: asg.file_size || null
                    });
                    return;
                }

                if (asg.target_type === 'individual') {
                    const mappingRows = (assignmentStudents || []).filter(row => row.assignment_id === asg.id);
                    if (mappingRows.length === 0) {
                        formatted.push({
                            id: `no-students-${asg.id}`,
                            student_id: 'no-students',
                            student_name: 'No Students Assigned',
                            task_id: asg.id,
                            task_title: asg.title || 'Untitled Task',
                            task_description: asg.description || '',
                            status: 'pending',
                            submitted_at: asg.created_at || new Date().toISOString(),
                            classroom_id: asg.classroom_id,
                            classroom_name: className,
                            due_date: asg.due_date || null,
                            file_url: asg.file_url || '',
                            file_name: asg.file_name || '',
                            file_size: asg.file_size || null,
                            inventory_ref_type: asg.inventory_ref_type || null,
                            inventory_ref_id: asg.inventory_ref_id || null,
                            inventory_ref_title: asg.inventory_ref_title || null
                        });
                    } else {
                        mappingRows.forEach(row => {
                            const studentInfo = studentsList.find(s => s.student_id === row.student_id);
                            const studentClassInfo = (classroomsData || []).find(c => c.id === studentInfo?.classroom_id);
                            const studentClassName = studentClassInfo?.name || className;

                            formatted.push({
                                id: row.id,
                                student_id: row.student_id,
                                student_name: (studentInfo?.users as any)?.name || 'Unknown Student',
                                student_profile_pic_url: (studentInfo?.users as any)?.profile_pic_url,
                                task_id: asg.id,
                                task_title: asg.title || 'Untitled Task',
                                task_description: asg.description || '',
                                status: row.status || 'pending',
                                submitted_at: row.submitted_at || asg.created_at || new Date().toISOString(),
                                video_url: row.video_url || '',
                                feedback_text: row.feedback_text || '',
                                score: row.score !== undefined ? row.score : undefined,
                                proficiency_level: row.proficiency_level || '',
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
                    // Everyone in classroom
                    if (associatedClassStudents.length === 0) {
                        formatted.push({
                            id: `no-students-${asg.id}`,
                            student_id: 'no-students',
                            student_name: 'No Students Assigned',
                            task_id: asg.id,
                            task_title: asg.title || 'Untitled Task',
                            task_description: asg.description || '',
                            status: 'pending',
                            submitted_at: asg.created_at || new Date().toISOString(),
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
                        associatedClassStudents.forEach(studentInfo => {
                            const existingRow = (assignmentStudents || []).find(row => row.assignment_id === asg.id && row.student_id === studentInfo.student_id);

                            formatted.push({
                                id: existingRow?.id || `temp-impl-${asg.id}-${studentInfo.student_id}`,
                                student_id: studentInfo.student_id,
                                student_name: (studentInfo.users as any)?.name || 'Unknown Student',
                                student_profile_pic_url: (studentInfo.users as any)?.profile_pic_url,
                                task_id: asg.id,
                                task_title: asg.title || 'Untitled Task',
                                task_description: asg.description || '',
                                status: existingRow?.status || 'pending',
                                submitted_at: existingRow?.submitted_at || asg.created_at || new Date().toISOString(),
                                video_url: existingRow?.video_url || '',
                                feedback_text: existingRow?.feedback_text || '',
                                score: existingRow?.score !== undefined ? existingRow?.score : undefined,
                                proficiency_level: existingRow?.proficiency_level || '',
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

            // Sort by submitted_at desc
            formatted.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
            setSubmissions(formatted);

        } catch (err) {
            console.error('CRITICAL ERROR in fetchSubmissions:', err);
        }
    }, []);

    // 2. Load Creation Data
    const loadCreationData = async (teacherId: string, isAdmin: boolean = false) => {
        try {
            const userIsAdmin = isAdmin || teacherProfile?.role === 'admin';

            let classroomQuery = supabaseAuth.from('classrooms').select('id, name, teacher_id');
            if (!userIsAdmin) {
                classroomQuery = classroomQuery.eq('teacher_id', teacherId);
            }
            const { data: classes } = await classroomQuery;
            if (classes) setClassrooms(classes);

            let prevTasksQuery = supabaseAuth
                .from('assignments')
                .select('id, title, description, due_date, classroom_id, target_type, status, inventory_ref_type, inventory_ref_id, inventory_ref_title, file_url, file_name, file_size');
            if (!userIsAdmin) {
                prevTasksQuery = prevTasksQuery.eq('teacher_id', teacherId);
            }
            const { data: prevTasks } = await prevTasksQuery;
            if (prevTasks) {
                const manual = prevTasks.filter((t: any) => !(t.inventory_ref_type && t.title === t.inventory_ref_title));
                setPreviousTasks(manual);
            }

            const [catRes, modRes, chapRes, lesRes] = await Promise.all([
                supabaseAuth.from('course_categories').select('*').order('category_order', { ascending: true }),
                supabaseAuth.from('course_modules').select('*').order('module_number', { ascending: true }),
                supabaseAuth.from('course_chapters').select('*').order('chapter_number', { ascending: true }),
                supabaseAuth.from('course_lessons').select('id, chapter_id, lesson_number, title, description, material_type, material_url, file_name, bullet_points').order('lesson_number', { ascending: true })
            ]);

            if (catRes.data) setInventoryCategories(catRes.data);
            if (modRes.data) setInventoryModules(modRes.data);
            if (chapRes.data) setInventoryChapters(chapRes.data);
            if (lesRes.data) setInventoryLessons(lesRes.data);

            // Fetch students
            let studentIds: string[] = [];
            const studentClassMap: Record<string, string[]> = {};

            if (classes && classes.length > 0) {
                const classIds = classes.map((c: any) => c.id);
                const [enrollmentsRes, overridesRes] = await Promise.all([
                    supabaseAuth.from('classroom_students').select('student_id, classroom_id').in('classroom_id', classIds),
                    supabaseAuth.from('session_student_overrides').select('student_id, target_classroom_id').in('target_classroom_id', classIds)
                ]);

                const enrollments = enrollmentsRes.data || [];
                const overrides = overridesRes.data || [];

                enrollments.forEach((e: any) => {
                    if (!studentClassMap[e.student_id]) studentClassMap[e.student_id] = [];
                    if (!studentClassMap[e.student_id].includes(e.classroom_id)) studentClassMap[e.student_id].push(e.classroom_id);
                });

                overrides.forEach((o: any) => {
                    if (!studentClassMap[o.student_id]) studentClassMap[o.student_id] = [];
                    if (!studentClassMap[o.student_id].includes(o.target_classroom_id)) studentClassMap[o.student_id].push(o.target_classroom_id);
                });

                studentIds = [...new Set([...enrollments.map((e: any) => e.student_id), ...overrides.map((o: any) => o.student_id)])];
            }

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
                    if (!studentIds.includes(item.id)) studentIds.push(item.id);
                });
            }

            if (studentIds.length > 0) {
                const { data: usersData } = await supabaseAuth
                    .from('users')
                    .select('id, name, profile_pic_url, teacher_id')
                    .in('id', studentIds);

                const classMap: Record<string, string> = {};
                (classes || []).forEach((c: any) => { classMap[c.id] = c.name; });

                if (usersData) {
                    const formattedStudents = usersData.map((item: any) => {
                        const cids = studentClassMap[item.id] || [];
                        const cnames = cids.map(cid => classMap[cid]).filter(Boolean);
                        return {
                            id: item.id,
                            name: item.name || 'Unknown Student',
                            profile_pic_url: item.profile_pic_url || null,
                            selected: false,
                            classroom_ids: cids,
                            classroom_names: cnames
                        };
                    });
                    setStudents(formattedStudents);
                }
            }
        } catch (err) {
            console.error('Error loading creation details:', err);
        }
    };

    // SWR Cache
    useEffect(() => {
        if (submissions.length === 0) return;
        const timer = setTimeout(() => {
            try {
                localStorage.setItem('kfa_tasks_cache', JSON.stringify({ submissions, teacherProfile }));
            } catch (e) { console.error('Tasks cache save error:', e); }
        }, 300);
        return () => clearTimeout(timer);
    }, [submissions, teacherProfile]);

    // Initial auth & setup
    useEffect(() => {
        let hasCachedData = false;
        try {
            const cached = localStorage.getItem('kfa_tasks_cache');
            if (cached) {
                const data = JSON.parse(cached);
                if (data.submissions) setSubmissions(data.submissions);
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

            // Clear unread task notifications
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

    // Build Batches for Assignments View
    const assignmentBatches = useMemo(() => {
        const batchMap: Record<string, AssignmentBatch> = {};

        submissions.forEach(sub => {
            const assignmentId = sub.task_id;
            if (!assignmentId) return;

            if (!batchMap[assignmentId]) {
                batchMap[assignmentId] = {
                    assignmentId,
                    taskTitle: sub.task_title || 'Untitled Task',
                    taskDescription: sub.task_description,
                    classroomName: sub.classroom_name || 'Individual',
                    classroomId: sub.classroom_id,
                    targetType: sub.classroom_name?.toLowerCase().includes('all') ? 'all' : 'individual',
                    dueDate: sub.due_date,
                    createdAt: sub.submitted_at,
                    isDraft: sub.status === 'draft',
                    inventoryRefType: sub.inventory_ref_type,
                    inventoryRefId: sub.inventory_ref_id,
                    inventoryRefTitle: sub.inventory_ref_title,
                    fileUrl: sub.file_url,
                    fileName: sub.file_name,
                    fileSize: sub.file_size,
                    submissions: [],
                    totalCount: 0,
                    submittedCount: 0,
                    reviewedCount: 0,
                    approvedCount: 0,
                    pendingCount: 0
                };
            }

            const batch = batchMap[assignmentId];
            batch.submissions.push(sub);

            if (sub.student_id !== 'draft' && sub.student_id !== 'no-students') {
                batch.totalCount++;
                if (sub.status === 'submitted') batch.submittedCount++;
                else if (sub.status === 'reviewed') batch.reviewedCount++;
                else if (sub.status === 'approved') batch.approvedCount++;
                else if (sub.status === 'pending') batch.pendingCount++;
            }
        });

        return Object.values(batchMap);
    }, [submissions]);

    // Build Template Groups for Templates View
    const templateGroups = useMemo(() => {
        const templateMap: Record<string, TaskTemplateGroup> = {};

        assignmentBatches.forEach(batch => {
            const titleKey = (batch.taskTitle || 'Untitled').toLowerCase().trim();
            const refKey = batch.inventoryRefId ? `_${batch.inventoryRefId}` : '';
            const templateKey = `${titleKey}${refKey}`;

            if (!templateMap[templateKey]) {
                templateMap[templateKey] = {
                    templateKey,
                    taskTitle: batch.taskTitle,
                    taskDescription: batch.taskDescription,
                    inventoryRefType: batch.inventoryRefType,
                    inventoryRefId: batch.inventoryRefId,
                    inventoryRefTitle: batch.inventoryRefTitle,
                    fileUrl: batch.fileUrl,
                    fileName: batch.fileName,
                    fileSize: batch.fileSize,
                    batches: [],
                    totalStudents: 0,
                    submittedCount: 0,
                    reviewedCount: 0,
                    approvedCount: 0,
                    pendingCount: 0,
                    isDraftOnly: true
                };
            }

            const tmpl = templateMap[templateKey];
            tmpl.batches.push(batch);
            if (!batch.isDraft) tmpl.isDraftOnly = false;
            tmpl.totalStudents += batch.totalCount;
            tmpl.submittedCount += batch.submittedCount;
            tmpl.reviewedCount += batch.reviewedCount;
            tmpl.approvedCount += batch.approvedCount;
            tmpl.pendingCount += batch.pendingCount;
        });

        return Object.values(templateMap);
    }, [assignmentBatches]);

    // Awaiting Review queue for navigation
    const awaitingQueue = useMemo(() => {
        return submissions.filter(s => s.status === 'submitted' && s.student_id !== 'draft' && s.student_id !== 'no-students');
    }, [submissions]);

    const currentReviewIndex = useMemo(() => {
        if (!selectedSub) return -1;
        return awaitingQueue.findIndex(s => s.id === selectedSub.id);
    }, [awaitingQueue, selectedSub]);

    const nextSubmissionInQueue = useMemo(() => {
        if (currentReviewIndex === -1) return null;
        if (currentReviewIndex < awaitingQueue.length - 1) {
            return awaitingQueue[currentReviewIndex + 1];
        }
        return null;
    }, [awaitingQueue, currentReviewIndex]);

    // Review trigger handlers (responsive: Drawer on desktop, Screen on mobile)
    const handleOpenReview = (sub: TaskSubmission) => {
        setSelectedSub(sub);
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
            setIsMobileReviewOpen(true);
            setIsDrawerOpen(false);
        } else {
            setIsDrawerOpen(true);
            setIsMobileReviewOpen(false);
        }
    };

    const handleCloseReview = () => {
        setSelectedSub(null);
        setIsDrawerOpen(false);
        setIsMobileReviewOpen(false);
    };

    const handleSelectNextSubmission = () => {
        if (nextSubmissionInQueue) {
            setSelectedSub(nextSubmissionInQueue);
        } else {
            handleCloseReview();
        }
    };

    const handleSelectPreviousSubmission = () => {
        if (currentReviewIndex > 0) {
            setSelectedSub(awaitingQueue[currentReviewIndex - 1]);
        }
    };

    // Save Review Mutation
    const handleSaveReview = async (sub: TaskSubmission, updates: {
        status: 'reviewed' | 'approved';
        score?: number | null;
        proficiency_level?: string;
        feedback_text?: string;
    }): Promise<boolean> => {
        setIsSaving(true);
        try {
            const isTemp = sub.id.startsWith('temp-impl-');
            const newStatus = updates.status;
            const updatePayload = {
                status: newStatus,
                score: updates.score === undefined ? null : updates.score,
                proficiency_level: updates.proficiency_level || null,
                feedback_text: updates.feedback_text || null,
                submitted_at: new Date().toISOString()
            };

            let dbError;
            if (isTemp) {
                const { data: newRow, error: insertError } = await supabaseAuth
                    .from('assignment_students')
                    .insert({
                        assignment_id: sub.task_id,
                        student_id: sub.student_id,
                        ...updatePayload
                    })
                    .select()
                    .single();
                dbError = insertError;
                if (!insertError && newRow) {
                    sub.id = newRow.id;
                }
            } else {
                const { error: updateError } = await supabaseAuth
                    .from('assignment_students')
                    .update(updatePayload)
                    .eq('id', sub.id);
                dbError = updateError;
            }

            if (dbError) {
                console.warn('Fallback saving review...', dbError);
                if (isTemp) {
                    await supabaseAuth.from('assignment_students').insert({
                        assignment_id: sub.task_id,
                        student_id: sub.student_id,
                        status: newStatus
                    });
                } else {
                    await supabaseAuth.from('assignment_students').update({ status: newStatus }).eq('id', sub.id);
                }
            }

            // Update local state
            const updatedSubmissions = submissions.map(s => 
                s.student_id === sub.student_id && s.task_id === sub.task_id 
                    ? { ...s, ...updatePayload, id: sub.id, status: newStatus } 
                    : s
            );
            setSubmissions(updatedSubmissions);

            // Send student notification
            try {
                const { data: { session } } = await supabaseAuth.auth.getSession();
                const teacherId = session?.user?.id || '';
                await sendClassroomNotification({
                    teacherId,
                    recipients: [{ id: sub.student_id, name: sub.student_name, type: 'student' }],
                    title: newStatus === 'approved' ? `✅ Task Approved: ${sub.task_title}` : `📝 Task Reviewed: ${sub.task_title}`,
                    message: newStatus === 'approved' 
                        ? `Your submission for "${sub.task_title}" has been approved!${updates.score ? ` Score: ${updates.score}/10.` : ''}`
                        : `Your submission for "${sub.task_title}" has been reviewed and needs revision.${updates.feedback_text ? ` Feedback: "${updates.feedback_text}"` : ''}`,
                    studentIds: [sub.student_id]
                });
            } catch (notifErr) {
                console.error('Failed to send notification for task review:', notifErr);
            }

            return true;
        } catch (err: any) {
            console.error('Error saving review:', err);
            alert(`Failed to save review: ${err.message || 'Unknown error'}`);
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    // Quick due date update
    const handleQuickUpdateDueDate = async (taskId: string, newDueDate: string) => {
        try {
            const { error } = await supabaseAuth
                .from('assignments')
                .update({ due_date: newDueDate || null })
                .eq('id', taskId);

            if (error) throw error;

            setSubmissions(prev => prev.map(s => s.task_id === taskId ? { ...s, due_date: newDueDate || null } : s));
        } catch (err) {
            console.error('Error updating due date:', err);
            alert('Could not update due date.');
        }
    };

    // Delete single assignment batch
    const handleDeleteAssignment = async (assignmentId: string) => {
        if (!confirm('Are you sure you want to delete this task assignment and all student mappings?')) return;
        setIsSaving(true);
        try {
            await supabaseAuth.from('assignment_students').delete().eq('assignment_id', assignmentId);
            const { error } = await supabaseAuth.from('assignments').delete().eq('id', assignmentId);
            if (error) throw error;

            setSubmissions(prev => prev.filter(s => s.task_id !== assignmentId));
            setPreviousTasks(prev => prev.filter(t => t.id !== assignmentId));
            alert('Task assignment deleted successfully.');
        } catch (err: any) {
            console.error('Error deleting assignment:', err);
            alert(`Failed to delete assignment: ${err.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Delete template (deletes all batches under that template)
    const handleDeleteTemplate = async (template: TaskTemplateGroup) => {
        if (!confirm(`Are you sure you want to delete template "${template.taskTitle}" and its ${template.batches.length} assignments?`)) return;
        setIsSaving(true);
        try {
            const taskIds = template.batches.map(b => b.assignmentId);
            await supabaseAuth.from('assignment_students').delete().in('assignment_id', taskIds);
            await supabaseAuth.from('assignments').delete().in('id', taskIds);

            setSubmissions(prev => prev.filter(s => !taskIds.includes(s.task_id)));
            setPreviousTasks(prev => prev.filter(t => !taskIds.includes(t.id)));
            alert('Task template deleted successfully.');
        } catch (err: any) {
            console.error('Error deleting template:', err);
            alert(`Failed to delete template: ${err.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Edit Assignment Trigger
    const handleEditAssignment = async (assignmentId: string) => {
        const batch = assignmentBatches.find(b => b.assignmentId === assignmentId);
        if (!batch) return;

        setEditingTaskId(assignmentId);

        // Fetch attachments from assignment_attachments if present
        let loadedAttachments: any[] = [];
        try {
            const { data: atts } = await supabaseAuth
                .from('assignment_attachments')
                .select('*')
                .eq('assignment_id', assignmentId)
                .order('created_at', { ascending: true });
            if (atts && atts.length > 0) {
                loadedAttachments = atts;
            }
        } catch (e) {
            console.warn('[handleEditAssignment] assignment_attachments fetch:', e);
        }

        const validStudentIds = batch.submissions
            .filter(s => s.student_id !== 'draft' && s.student_id !== 'no-students')
            .map(s => s.student_id);

        const mappedTargetMode = batch.targetType === 'all' 
            ? 'all_students' 
            : (batch.targetType === 'classroom' ? 'classes' : 'selected_students');

        setInitialCreateData({
            title: batch.taskTitle,
            description: batch.taskDescription,
            dueDate: formatDateForInput(batch.dueDate),
            fileUrl: batch.fileUrl,
            fileName: batch.fileName,
            fileSize: batch.fileSize,
            inventoryRefId: batch.inventoryRefId,
            inventoryRefTitle: batch.inventoryRefTitle,
            classroomId: batch.classroomId,
            targetMode: mappedTargetMode,
            selectedClassroomIds: batch.classroomId ? [batch.classroomId] : [],
            classRecipientMode: 'all_in_classes',
            selectedStudentIds: validStudentIds,
            attachments: loadedAttachments
        });
        setIsCreateModalOpen(true);
    };

    // Assign again from template
    const handleAssignFromTemplate = (template: TaskTemplateGroup) => {
        setEditingTaskId(null);
        setInitialCreateData({
            title: template.taskTitle,
            description: template.taskDescription,
            dueDate: '',
            fileUrl: template.fileUrl,
            fileName: template.fileName,
            fileSize: template.fileSize,
            inventoryRefId: template.inventoryRefId,
            inventoryRefTitle: template.inventoryRefTitle,
            targetMode: 'classes',
            selectedClassroomIds: classrooms.length > 0 ? [classrooms[0].id] : [],
            classRecipientMode: 'all_in_classes',
            selectedStudentIds: [],
            attachments: []
        });
        setIsCreateModalOpen(true);
    };

    // Save or Assign Task Mutation from Create Dialog
    const handleSaveTaskDialog = async (data: {
        title: string;
        description: string;
        dueDate: string;
        targetMode: 'all_students' | 'classes' | 'selected_students';
        selectedClassroomIds: string[];
        classRecipientMode: 'all_in_classes' | 'selective_in_classes';
        selectedStudentIds: string[];
        attachments: any[];
        fileUrl: string;
        fileName: string;
        fileSize: number | null;
        inventoryRefId: string | null;
        inventoryRefTitle: string | null;
        selectedClassroomId: string;
        isDraft: boolean;
    }) => {
        const { data: { session } } = await supabaseAuth.auth.getSession();
        if (!session) return;

        setIsSaving(true);
        try {
            const primaryClassId = (data.selectedClassroomIds && data.selectedClassroomIds.length > 0)
                ? data.selectedClassroomIds[0]
                : (data.selectedClassroomId || classrooms[0]?.id);
            const classObj = classrooms.find(c => c.id === primaryClassId);
            const teacherId = classObj?.teacher_id || session.user.id;

            const targetType = data.targetMode === 'all_students'
                ? 'all'
                : (data.targetMode === 'classes' && data.classRecipientMode === 'all_in_classes' ? 'classroom' : 'individual');

            if (editingTaskId) {
                // Update existing assignment
                const updateData: any = {
                    title: data.title,
                    description: data.description,
                    due_date: data.dueDate || null,
                    classroom_id: primaryClassId,
                    teacher_id: teacherId,
                    target_type: targetType,
                    status: data.isDraft ? 'draft' : 'active',
                    file_url: data.fileUrl || null,
                    file_name: data.fileName || null,
                    file_size: data.fileSize || null,
                    inventory_ref_id: data.inventoryRefId || null,
                    inventory_ref_title: data.inventoryRefTitle || null,
                    inventory_ref_type: data.inventoryRefId ? 'lesson' : null
                };

                const { error: updateError } = await supabaseAuth.from('assignments').update(updateData).eq('id', editingTaskId);
                if (updateError) throw updateError;

                // Sync assignment_attachments
                if (data.attachments) {
                    await supabaseAuth.from('assignment_attachments').delete().eq('assignment_id', editingTaskId);
                    if (data.attachments.length > 0) {
                        const rows = data.attachments.map(att => ({
                            assignment_id: editingTaskId,
                            attachment_type: att.attachment_type,
                            title: att.title,
                            file_url: att.file_url || null,
                            file_name: att.file_name || null,
                            file_size: typeof att.file_size === 'number' ? att.file_size : null,
                            duration_seconds: att.duration_seconds || null,
                            inventory_ref_type: att.inventory_ref_type || null,
                            inventory_ref_id: att.inventory_ref_id || null
                        }));
                        const { error: attErr } = await supabaseAuth.from('assignment_attachments').insert(rows);
                        if (attErr) console.warn('[assignment_attachments] insert warning:', attErr.message);
                    }
                }

                // Sync student mappings safely
                if (!data.isDraft) {
                    const { data: currentMappings } = await supabaseAuth
                        .from('assignment_students')
                        .select('id, student_id, status, video_url, feedback_text')
                        .eq('assignment_id', editingTaskId);

                    const existingMap = new Map((currentMappings || []).map(m => [m.student_id, m]));
                    const existingStudentIds = new Set(existingMap.keys());
                    const targetStudentIds = new Set(data.selectedStudentIds);

                    // Remove non-submitted records for deselected students
                    const toRemove: string[] = [];
                    for (const studentId of existingStudentIds) {
                        if (!targetStudentIds.has(studentId)) {
                            const rec = existingMap.get(studentId);
                            const hasWork = rec && (rec.status !== 'pending' || rec.video_url || rec.feedback_text);
                            if (!hasWork) toRemove.push(studentId);
                        }
                    }

                    if (toRemove.length > 0) {
                        await supabaseAuth.from('assignment_students').delete().eq('assignment_id', editingTaskId).in('student_id', toRemove);
                    }

                    // Add new students
                    const toAdd = data.selectedStudentIds.filter(id => !existingStudentIds.has(id));
                    if (toAdd.length > 0) {
                        await supabaseAuth.from('assignment_students').insert(
                            toAdd.map(sid => ({ assignment_id: editingTaskId, student_id: sid, status: 'pending' }))
                        );
                    }
                }
            } else {
                // Insert new assignment
                const insertData = {
                    classroom_id: primaryClassId,
                    teacher_id: teacherId,
                    title: data.title,
                    description: data.description,
                    due_date: data.dueDate || null,
                    target_type: targetType,
                    status: data.isDraft ? 'draft' : 'active',
                    file_url: data.fileUrl || null,
                    file_name: data.fileName || null,
                    file_size: data.fileSize || null,
                    inventory_ref_id: data.inventoryRefId || null,
                    inventory_ref_title: data.inventoryRefTitle || null,
                    inventory_ref_type: data.inventoryRefId ? 'lesson' : null,
                    created_at: new Date().toISOString()
                };

                const { data: newAsg, error: newAsgError } = await supabaseAuth.from('assignments').insert(insertData).select().single();
                if (newAsgError) throw newAsgError;

                // Insert assignment_attachments
                if (newAsg && data.attachments && data.attachments.length > 0) {
                    const rows = data.attachments.map(att => ({
                        assignment_id: newAsg.id,
                        attachment_type: att.attachment_type,
                        title: att.title,
                        file_url: att.file_url || null,
                        file_name: att.file_name || null,
                        file_size: typeof att.file_size === 'number' ? att.file_size : null,
                        duration_seconds: att.duration_seconds || null,
                        inventory_ref_type: att.inventory_ref_type || null,
                        inventory_ref_id: att.inventory_ref_id || null
                    }));
                    const { error: attErr } = await supabaseAuth.from('assignment_attachments').insert(rows);
                    if (attErr) console.warn('[assignment_attachments] insert warning:', attErr.message);
                }

                if (!data.isDraft && data.selectedStudentIds.length > 0 && newAsg) {
                    await supabaseAuth.from('assignment_students').insert(
                        data.selectedStudentIds.map(sid => ({ assignment_id: newAsg.id, student_id: sid, status: 'pending' }))
                    );
                }
            }

            setIsCreateModalOpen(false);
            setEditingTaskId(null);
            setInitialCreateData(null);

            const isAdmin = teacherProfile?.role === 'admin';
            await fetchSubmissions(session.user.id, isAdmin);
            await loadCreationData(session.user.id, isAdmin);

            if (isPopup) {
                window.parent.postMessage('kfa_popup_success', '*');
            }
            alert(editingTaskId ? 'Task changes saved successfully!' : 'Task assigned successfully!');
        } catch (err: any) {
            console.error('Error saving task:', err);
            alert(`Failed to save task: ${err.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8f8f6] dark:bg-[#221d10]">
                <Loader2 className="w-10 h-10 animate-spin text-[#ecb613] mb-4" />
                <p className="font-bold text-slate-600 dark:text-slate-400">Loading tasks dashboard...</p>
            </div>
        );
    }

    const awaitingCount = submissions.filter(s => s.status === 'submitted' && s.student_id !== 'draft' && s.student_id !== 'no-students').length;
    const completedCount = submissions.filter(s => (s.status === 'approved' || s.status === 'reviewed') && s.student_id !== 'draft' && s.student_id !== 'no-students').length;
    const activeAssignmentsCount = assignmentBatches.filter(b => !b.isDraft).length;
    const templatesCount = templateGroups.length;

    return (
        <div className={`text-slate-900 dark:text-slate-100 min-h-screen flex font-sans ${isPopup ? 'bg-transparent' : 'bg-[#f8f8f6] dark:bg-[#221d10]'}`}>
            {!isPopup && <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />}

            <main className={`flex-1 flex flex-col min-w-0 ${isPopup ? 'hidden' : ''}`}>
                <TeacherHeader 
                    title="Tasks & Assignments" 
                    avatarUrl={teacherProfile?.profile_pic_url}
                    userName={teacherProfile?.name}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    backLink={teacherProfile?.role === 'admin' ? '/admin-dashboard' : '/teacher-dashboard'}
                />

                <div className="p-3.5 sm:p-6 md:p-8 space-y-6 max-w-7xl w-full mx-auto flex-1">
                    {/* Top Action Header Bar */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                                Task Review & Assignments
                            </h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                                Modern teacher workflow: Review submissions → Track assignments → Reuse templates → Access history
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setEditingTaskId(null);
                                setInitialCreateData(null);
                                setIsCreateModalOpen(true);
                            }}
                            className="min-h-[44px] px-4 py-2.5 bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900 font-black text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center gap-2 active:scale-95"
                        >
                            <Plus className="w-4 h-4 stroke-[3]" />
                            <span>+ New Task</span>
                        </button>
                    </div>

                    {/* 4 Top-Level Views Tabs Navigation */}
                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-x-auto scrollbar-none whitespace-nowrap">
                        {/* 1. Review (Inbox) Tab */}
                        <button
                            type="button"
                            onClick={() => setActiveTab('review')}
                            className={`min-h-[42px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all shrink-0 ${
                                activeTab === 'review'
                                    ? 'bg-[#ecb613] text-slate-900 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                            <Inbox className="w-4 h-4" />
                            <span>Review</span>
                            {awaitingCount > 0 && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                    activeTab === 'review' ? 'bg-slate-900 text-[#ecb613]' : 'bg-[#ecb613] text-slate-900'
                                }`}>
                                    {awaitingCount}
                                </span>
                            )}
                        </button>

                        {/* 2. Assignments Tab */}
                        <button
                            type="button"
                            onClick={() => setActiveTab('assignments')}
                            className={`min-h-[42px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all shrink-0 ${
                                activeTab === 'assignments'
                                    ? 'bg-[#ecb613] text-slate-900 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                            <ClipboardList className="w-4 h-4" />
                            <span>Assignments</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {activeAssignmentsCount}
                            </span>
                        </button>

                        {/* 3. Templates Tab */}
                        <button
                            type="button"
                            onClick={() => setActiveTab('templates')}
                            className={`min-h-[42px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all shrink-0 ${
                                activeTab === 'templates'
                                    ? 'bg-[#ecb613] text-slate-900 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                            <Library className="w-4 h-4" />
                            <span>Templates</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {templatesCount}
                            </span>
                        </button>

                        {/* 4. Completed Tab */}
                        <button
                            type="button"
                            onClick={() => setActiveTab('completed')}
                            className={`min-h-[42px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all shrink-0 ${
                                activeTab === 'completed'
                                    ? 'bg-[#ecb613] text-slate-900 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Completed</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {completedCount}
                            </span>
                        </button>
                    </div>

                    {/* Active View Container */}
                    <div className="space-y-4">
                        {activeTab === 'review' && (
                            <TaskReviewQueue 
                                submissions={submissions}
                                classrooms={classrooms}
                                onReview={handleOpenReview}
                                searchQuery={searchQuery}
                            />
                        )}

                        {activeTab === 'assignments' && (
                            <TaskAssignmentList 
                                batches={assignmentBatches}
                                classrooms={classrooms}
                                onEditAssignment={handleEditAssignment}
                                onDeleteAssignment={handleDeleteAssignment}
                                onQuickUpdateDueDate={handleQuickUpdateDueDate}
                                onReviewSubmission={handleOpenReview}
                                searchQuery={searchQuery}
                            />
                        )}

                        {activeTab === 'templates' && (
                            <TaskTemplateLibrary 
                                templates={templateGroups}
                                onAssignFromTemplate={handleAssignFromTemplate}
                                onDeleteTemplate={handleDeleteTemplate}
                                searchQuery={searchQuery}
                            />
                        )}

                        {activeTab === 'completed' && (
                            <TaskCompletedList 
                                submissions={submissions}
                                classrooms={classrooms}
                                onReview={handleOpenReview}
                                searchQuery={searchQuery}
                            />
                        )}
                    </div>
                </div>
            </main>

            {/* Desktop Review Drawer */}
            <ReviewDrawer 
                isOpen={isDrawerOpen}
                submission={selectedSub}
                onClose={handleCloseReview}
                onSaveReview={handleSaveReview}
                isSaving={isSaving}
                nextSubmission={nextSubmissionInQueue}
                onSelectNext={handleSelectNextSubmission}
            />

            {/* Mobile Full-Screen Review Page / Sheet */}
            <MobileReviewScreen 
                isOpen={isMobileReviewOpen}
                submission={selectedSub}
                currentIndex={currentReviewIndex + 1}
                totalCount={awaitingQueue.length}
                onClose={handleCloseReview}
                onPrevious={handleSelectPreviousSubmission}
                onNext={handleSelectNextSubmission}
                hasPrevious={currentReviewIndex > 0}
                hasNext={currentReviewIndex < awaitingQueue.length - 1}
                onSaveReview={handleSaveReview}
                isSaving={isSaving}
            />

            {/* Task Creation & Assignment Dialog */}
            {isCreateModalOpen && (
                <TaskCreateDialog 
                    isOpen={isCreateModalOpen}
                    onClose={() => {
                        setIsCreateModalOpen(false);
                        setEditingTaskId(null);
                        setInitialCreateData(null);
                        if (isPopup) window.parent.postMessage('close_popup', '*');
                    }}
                    editingTaskId={editingTaskId}
                    initialData={initialCreateData}
                    classrooms={classrooms}
                    students={students}
                    previousTasks={previousTasks}
                    inventoryCategories={inventoryCategories}
                    inventoryModules={inventoryModules}
                    inventoryChapters={inventoryChapters}
                    inventoryLessons={inventoryLessons}
                    onSaveTask={handleSaveTaskDialog}
                    isSaving={isSaving}
                    isPopup={isPopup}
                />
            )}
        </div>
    );
}
