'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { Loader2, Search, Bell, UserCircle, Filter, Info, PlayCircle, CheckCircle, Save, X, ClipboardList, Plus, ChevronLeft, ChevronRight, Trash2, ChevronDown, ChevronUp, Edit2 } from 'lucide-react';
import TeacherSidebar from '../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../src/components/TeacherHeader';
import Link from 'next/link';

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
}

export default function TaskReviewPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<{ name: string; email: string } | null>(null);
    const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
    const [filteredSubmissions, setFilteredSubmissions] = useState<TaskSubmission[]>([]);
    const [selectedSub, setSelectedSub] = useState<TaskSubmission | null>(null);
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['pending']);
    const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
    const statusDropdownRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
                setIsStatusDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const statusOptions = [
        { value: 'pending', label: 'Pending' },
        { value: 'submitted', label: 'Submitted' },
        { value: 'reviewed', label: 'Reviewed' },
        { value: 'approved', label: 'Approved' },
        { value: 'draft', label: 'Saved as Draft' }
    ];

    const handleToggleStatus = (status: string) => {
        setSelectedStatuses(prev => {
            if (prev.includes(status)) {
                return prev.filter(s => s !== status);
            } else {
                return [...prev, status];
            }
        });
    };

    const handleSelectAllStatuses = () => {
        setSelectedStatuses(statusOptions.map(opt => opt.value));
    };

    const handleClearAllStatuses = () => {
        setSelectedStatuses([]);
    };

    const getStatusLabel = (statusVal: string) => {
        const option = statusOptions.find(o => o.value === statusVal);
        return option ? option.label : statusVal;
    };

    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 12;
    const [isSaving, setIsSaving] = useState(false);
    const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const [collapsedTasks, setCollapsedTasks] = useState<Record<string, boolean>>({});
    
    // Grading form state
    const [score, setScore] = useState<number | ''>('');
    const [proficiency, setProficiency] = useState('');
    const [feedback, setFeedback] = useState('');
    const [reassign, setReassign] = useState(false);

    const fetchSubmissions = useCallback(async (userId: string) => {
        console.log('Fetching submissions for teacher:', userId);
        
        try {
            // Step 1: Get this teacher's classroom IDs and names
            const { data: classrooms, error: classroomError } = await supabaseAuth
                .from('classrooms')
                .select('id, name')
                .eq('teacher_id', userId);

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
                    users!student_id(name, profile_pic_url)
                `)
                .in('classroom_id', classroomIds);

            if (enrollError) {
                console.error('Error fetching enrolled students:', enrollError);
                return;
            }

            const studentsList = enrollments || [];
            const studentIds = [...new Set(studentsList.map(e => e.student_id))];

            if (studentIds.length === 0) {
                console.log('No students enrolled in classrooms');
                setSubmissions([]);
                setFilteredSubmissions([]);
                return;
            }

            // Step 3: Fetch all assignments created for these classrooms
            let assignmentsList: any[] | null = null;
            let assignmentsError = null;

            const res = await supabaseAuth
                .from('assignments')
                .select('id, title, description, created_at, due_date, target_type, classroom_id, status, inventory_ref_type')
                .in('classroom_id', classroomIds);
            
            assignmentsList = res.data;
            assignmentsError = res.error;

            if (assignmentsError && (assignmentsError.code === '42703' || assignmentsError.message?.includes('status'))) {
                console.warn('status column missing in assignments, running fallback...');
                const fallback = await supabaseAuth
                    .from('assignments')
                    .select('id, title, description, created_at, due_date, target_type, classroom_id, inventory_ref_type')
                    .in('classroom_id', classroomIds);
                assignmentsList = fallback.data;
                assignmentsError = fallback.error;
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
                if (asg.inventory_ref_type) return; // Hide inventory assignments from tasks dashboard
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
                        classroom_name: className
                    });
                    return;
                }

                if (asg.target_type === 'individual') {
                    // For individual assignments, only show students who have a row in assignment_students
                    const mappingRows = (assignmentStudents || []).filter(row => row.assignment_id === asg.id);
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
                            classroom_name: studentClassName
                        });
                    });
                } else {
                    // For "all" (Everyone) assignments, implicitly show EVERY student in the classroom!
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
                            classroom_name: className
                        });
                    });
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

            const { data: profile } = await supabaseAuth
                .from('users')
                .select('name, email, role')
                .eq('id', session.user.id)
                .single();

            if (profile?.role !== 'teacher') {
                router.push('/');
                return;
            }

            setTeacherProfile({ name: profile.name, email: profile.email });
            await fetchSubmissions(session.user.id);
            setLoading(false);
        };

        checkAuth();
    }, [router, fetchSubmissions]);

    useEffect(() => {
        setCurrentPage(1); // Reset pagination on filter change
        let result = submissions;
        
        result = result.filter(s => selectedStatuses.includes(s.status.toLowerCase()));
        
        if (searchQuery.trim() !== '') {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(s => 
                s.student_name.toLowerCase().includes(lowerQuery) ||
                s.task_title.toLowerCase().includes(lowerQuery) ||
                (s.classroom_name && s.classroom_name.toLowerCase().includes(lowerQuery))
            );
        }
        setFilteredSubmissions(result);
    }, [selectedStatuses, submissions, searchQuery]);

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
            alert('Review saved successfully');

        } catch (error: any) {
            console.error('Error updating review:', error);
            alert(`Failed to save review: ${error.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteSingle = async (e: React.MouseEvent, attemptId: string) => {
        e.stopPropagation();
        const isDraft = attemptId.startsWith('draft-');
        const confirmMsg = isDraft 
            ? 'Are you sure you want to delete this task draft?' 
            : 'Are you sure you want to delete this task assignment?';
            
        if (!confirm(confirmMsg)) return;
        setIsDeleting(true);
        try {
            if (isDraft) {
                const assignmentId = attemptId.replace('draft-', '');
                const { error: assignmentError } = await supabaseAuth
                    .from('assignments')
                    .delete()
                    .eq('id', assignmentId);
                if (assignmentError) throw assignmentError;
            } else if (!attemptId.startsWith('temp-impl-')) {
                // Delete from database
                const { error: attemptError } = await supabaseAuth
                    .from('assignment_students')
                    .delete()
                    .eq('id', attemptId);
                if (attemptError) throw attemptError;
            }

            // Update local state
            const updatedSubmissions = submissions.filter(s => s.id !== attemptId);
            setSubmissions(updatedSubmissions);
            
            if (selectedSub?.id === attemptId) {
                setSelectedSub(null);
            }
            setSelectedSubIds(prev => prev.filter(id => id !== attemptId));
            
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
        if (!confirm(`Are you sure you want to delete the ${selectedSubIds.length} selected task assignments?`)) return;
        setIsDeleting(true);
        try {
            const dbIds = selectedSubIds.filter(id => !id.startsWith('temp-impl-'));
            
            if (dbIds.length > 0) {
                // Delete in bulk from database
                const { error: attemptsError } = await supabaseAuth
                    .from('assignment_students')
                    .delete()
                    .in('id', dbIds);
                if (attemptsError) throw attemptsError;
            }

            // Update local state
            const updatedSubmissions = submissions.filter(s => !selectedSubIds.includes(s.id));
            setSubmissions(updatedSubmissions);
            
            if (selectedSub && selectedSubIds.includes(selectedSub.id)) {
                setSelectedSub(null);
            }
            setSelectedSubIds([]);
            
            alert(`${selectedSubIds.length} task assignments deleted successfully.`);
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
        <div className="bg-[#f8f8f6] dark:bg-[#221d10] text-slate-900 dark:text-slate-100 min-h-screen flex font-sans">
            <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

            <main className="flex-1 flex flex-col min-w-0">
                <TeacherHeader 
                    title="Task Review" 
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                />

                <div className="p-8 grid grid-cols-12 gap-8 max-w-[1600px] mx-auto w-full flex-1">
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

                                <div className="relative" ref={statusDropdownRef}>
                                    <button
                                        type="button"
                                        onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                                        className="flex items-center justify-between gap-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] outline-none text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all font-semibold shadow-sm min-w-[140px]"
                                    >
                                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="truncate">
                                            {selectedStatuses.length === 0
                                                ? 'No Status'
                                                : selectedStatuses.length === statusOptions.length
                                                ? 'All Statuses'
                                                : selectedStatuses.length <= 2
                                                ? selectedStatuses.map(s => getStatusLabel(s)).join(', ')
                                                : `Status (${selectedStatuses.length})`}
                                        </span>
                                        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isStatusDropdownOpen && (
                                        <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-150">
                                            <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                <span>Filter Status</span>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={handleSelectAllStatuses}
                                                        className="text-[#ecb613] hover:text-[#ecb613]/80 capitalize text-[10px]"
                                                    >
                                                        All
                                                    </button>
                                                    <span className="text-slate-200 dark:text-slate-700">|</span>
                                                    <button
                                                        type="button"
                                                        onClick={handleClearAllStatuses}
                                                        className="text-rose-500 hover:text-rose-600 capitalize text-[10px]"
                                                    >
                                                        Clear
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="py-1 max-h-60 overflow-y-auto">
                                                {statusOptions.map(opt => {
                                                    const isChecked = selectedStatuses.includes(opt.value);
                                                    const count = submissions.filter(s => s.status.toLowerCase() === opt.value).length;
                                                    return (
                                                        <label
                                                            key={opt.value}
                                                            className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer select-none text-sm text-slate-700 dark:text-slate-200 transition-colors"
                                                        >
                                                            <div className="flex items-center gap-2.5">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={() => handleToggleStatus(opt.value)}
                                                                    className="rounded border-slate-300 dark:border-slate-700 text-[#ecb613] focus:ring-[#ecb613] cursor-pointer w-4 h-4"
                                                                />
                                                                <span className="font-semibold text-slate-800 dark:text-slate-200">{opt.label}</span>
                                                            </div>
                                                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold">
                                                                {count}
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <Link 
                                    href="/teacher-dashboard/tasks/create"
                                    className="bg-[#ecb613] text-slate-900 px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#ecb613]/90 transition-colors flex items-center gap-2 shadow-sm"
                                >
                                    <Plus className="w-4 h-4" />
                                    Create Task
                                </Link>
                            </div>
                        </header>

                        {/* List Area: Grouped by Task Accordion */}
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
                                            onClick={() => toggleTaskCollapse(group.taskTitle)}
                                            className="px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between cursor-pointer select-none hover:bg-slate-100/50 dark:hover:bg-slate-800/60 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-[#ecb613]/10 flex items-center justify-center text-[#ecb613]">
                                                    <ClipboardList className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-bold text-slate-800 dark:text-white text-base leading-tight">{group.taskTitle}</h3>
                                                        {isDraft && (
                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700 tracking-wider">
                                                                Draft
                                                            </span>
                                                        )}
                                                        <Link 
                                                            href={`/teacher-dashboard/tasks/${group.submissions[0].task_id}/edit`}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="text-slate-400 hover:text-[#ecb613] transition-colors p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/80"
                                                            title="Edit Task"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </Link>
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                                        {isDraft ? 'Saved as Draft' : `${group.submissions.length} Student${group.submissions.length !== 1 ? 's' : ''} assigned`}
                                                        {pendingCount > 0 && ` • ${pendingCount} Pending Review`}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
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
                                                        <Link 
                                                            href={`/teacher-dashboard/tasks/${group.submissions[0].task_id}/edit`}
                                                            className="px-4 py-2 bg-[#ecb613] text-slate-900 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 active:scale-[0.98]"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                            Edit Draft
                                                        </Link>
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

                                    {/* Student Video Link if exists (Student Submission section removed as requested) */}
                                    {selectedSub.video_url && (
                                        <section className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                                            <a 
                                                href={selectedSub.video_url} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="flex items-center gap-2 text-primary font-bold text-xs cursor-pointer hover:underline"
                                            >
                                                <PlayCircle className="w-4 h-4" />
                                                View Submission Video
                                            </a>
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
        </div>
    );
}
