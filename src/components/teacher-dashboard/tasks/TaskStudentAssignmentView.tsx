'use client';

import React, { useState, useMemo } from 'react';
import { 
    Search, Users, Filter, Calendar, Clock, BookOpen, Paperclip, 
    CheckCircle2, AlertCircle, ArrowLeft, ExternalLink, PlayCircle,
    Edit2, ChevronRight, Sparkles, User, RefreshCw
} from 'lucide-react';
import { Student, Classroom, AssignmentBatch, TaskSubmission, formatDateForInput } from './types';
import { 
    deriveStudentAssignmentStatus, 
    computeStudentAssignmentMetrics, 
    StudentEffectiveAssignment,
    isDueDatePassed
} from '../../../lib/assignment-service';
import AutoLinkText from '../../common/AutoLinkText';

interface TaskStudentAssignmentViewProps {
    students: Student[];
    classrooms: Classroom[];
    batches: AssignmentBatch[];
    submissions: TaskSubmission[];
    searchQuery: string;
    onSearchChange?: (q: string) => void;
    onReviewSubmission: (sub: TaskSubmission) => void;
    onEditAssignment: (assignmentId: string) => void;
    onQuickUpdateDueDate: (taskId: string, newDueDate: string) => Promise<void>;
    onNavigateToRevisionQueue?: (taskTitle?: string) => void;
}

export default function TaskStudentAssignmentView({
    students,
    classrooms,
    batches,
    submissions,
    searchQuery,
    onSearchChange,
    onReviewSubmission,
    onEditAssignment,
    onQuickUpdateDueDate,
    onNavigateToRevisionQueue
}: TaskStudentAssignmentViewProps) {
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [selectedClassroomId, setSelectedClassroomId] = useState<string>('all');
    const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<'all' | 'active' | 'past_due' | 'completed'>('all');
    const [learnerLifecycleFilter, setLearnerLifecycleFilter] = useState<'active' | 'all' | 'paused'>('active');
    const [localStudentSearch, setLocalStudentSearch] = useState('');
    const [studentTaskSearch, setStudentTaskSearch] = useState('');
    const [isAutocompleteFocused, setIsAutocompleteFocused] = useState(false);

    // Instant autocomplete student matches (top 6)
    const autocompleteMatches = useMemo(() => {
        if (!localStudentSearch.trim()) return [];
        const q = localStudentSearch.toLowerCase().trim();
        return students
            .filter(s => s.name.toLowerCase().includes(q))
            .slice(0, 6);
    }, [localStudentSearch, students]);

    // Classrooms lookup map
    const classroomsMap = useMemo(() => {
        const map: Record<string, string> = {};
        classrooms.forEach(c => { map[c.id] = c.name; });
        return map;
    }, [classrooms]);

    // Active classrooms for dropdown
    const availableClassrooms = useMemo(() => {
        return [...classrooms].sort((a, b) => a.name.localeCompare(b.name));
    }, [classrooms]);

    // Pre-calculate effective assignments for each student
    const studentDataMap = useMemo(() => {
        const map = new Map<string, {
            student: Student;
            assignments: StudentEffectiveAssignment[];
            metrics: ReturnType<typeof computeStudentAssignmentMetrics>;
        }>();

        // Build lookup of submissions by (task_id, student_id)
        const subMap = new Map<string, TaskSubmission>();
        submissions.forEach(sub => {
            if (sub.task_id && sub.student_id) {
                subMap.set(`${sub.task_id}_${sub.student_id}`, sub);
            }
        });

        students.forEach(student => {
            const studentClassSet = new Set(student.classroom_ids || []);
            const effectiveAssignments: StudentEffectiveAssignment[] = [];
            const seenTaskIds = new Set<string>();

            batches.forEach(batch => {
                if (batch.isDraft) return;
                if (seenTaskIds.has(batch.assignmentId)) return;

                const isAutoCurriculum = batch.inventoryRefType && batch.taskTitle === batch.inventoryRefTitle;
                if (isAutoCurriculum) return;

                const isIndividual = batch.targetType === 'individual';
                const subKey = `${batch.assignmentId}_${student.id}`;
                const studentSub = subMap.get(subKey);

                let isAssigned = false;
                if (isIndividual) {
                    if (studentSub || (batch.submissions && batch.submissions.some(s => s.student_id === student.id))) {
                        isAssigned = true;
                    }
                } else {
                    // Classroom assignment vs Academy-wide all-students assignment
                    if (batch.classroomId && batch.classroomId !== 'all') {
                        if (studentClassSet.has(batch.classroomId) || studentSub) {
                            isAssigned = true;
                        }
                    } else if (batch.targetType === 'all') {
                        // Academy-wide all-students assignment (no specific classroom)
                        isAssigned = true;
                    } else if (studentSub) {
                        isAssigned = true;
                    }
                }

                if (!isAssigned) return;
                seenTaskIds.add(batch.assignmentId);

                const rawStatus = studentSub?.status || 'pending';
                const derived = deriveStudentAssignmentStatus(rawStatus, batch.dueDate);

                effectiveAssignments.push({
                    assignmentId: batch.assignmentId,
                    taskTitle: batch.taskTitle,
                    taskDescription: batch.taskDescription,
                    classroomId: batch.classroomId || '',
                    classroomName: batch.classroomName,
                    dueDate: batch.dueDate,
                    createdAt: batch.createdAt,
                    targetType: (batch.targetType as any) || 'classroom',
                    isIndividual,
                    status: rawStatus as any,
                    effectiveStatus: derived.statusKey,
                    statusLabel: derived.label,
                    isPastDue: derived.isPastDue,
                    isCompleted: derived.isCompleted,
                    isActive: derived.isActive,
                    score: studentSub?.score,
                    proficiencyLevel: studentSub?.proficiency_level,
                    feedbackText: studentSub?.feedback_text,
                    videoUrl: studentSub?.video_url,
                    submittedAt: studentSub?.submitted_at,
                    fileUrl: batch.fileUrl,
                    fileName: batch.fileName,
                    fileSize: batch.fileSize,
                    inventoryRefId: batch.inventoryRefId,
                    inventoryRefTitle: batch.inventoryRefTitle,
                    inventoryRefType: batch.inventoryRefType,
                    submissionId: studentSub?.id
                });
            });

            // Sort newest first
            effectiveAssignments.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
            const metrics = computeStudentAssignmentMetrics(effectiveAssignments);

            map.set(student.id, {
                student,
                assignments: effectiveAssignments,
                metrics
            });
        });

        return map;
    }, [students, batches, submissions]);

    // Effective search term combining top-level search and local search
    const effectiveStudentSearch = useMemo(() => {
        return (localStudentSearch || searchQuery).toLowerCase().trim();
    }, [localStudentSearch, searchQuery]);

    // Filter students list based on search, classroom, lifecycle and assignment status
    const filteredStudents = useMemo(() => {
        return students.filter(student => {
            const data = studentDataMap.get(student.id);
            const metrics = data?.metrics;

            // 1. Learner lifecycle filter
            const isPaused = student.status === 'inactive' || student.status === 'archived';
            if (learnerLifecycleFilter === 'active' && isPaused) {
                // If user is searching specifically by student name, allow matching even if paused
                if (!effectiveStudentSearch || !student.name.toLowerCase().includes(effectiveStudentSearch)) {
                    return false;
                }
            } else if (learnerLifecycleFilter === 'paused' && !isPaused) {
                return false;
            }

            // 2. Classroom filter
            if (selectedClassroomId !== 'all') {
                if (!student.classroom_ids || !student.classroom_ids.includes(selectedClassroomId)) {
                    return false;
                }
            }

            // 3. Status filter
            if (metrics) {
                if (assignmentStatusFilter === 'active' && metrics.activeCount === 0) return false;
                if (assignmentStatusFilter === 'past_due' && metrics.pastDueCount === 0) return false;
                if (assignmentStatusFilter === 'completed' && metrics.completedCount === 0) return false;
            }

            // 4. Student search term
            if (effectiveStudentSearch) {
                const matchesName = student.name.toLowerCase().includes(effectiveStudentSearch);
                const matchesClass = student.classroom_names?.some(c => c.toLowerCase().includes(effectiveStudentSearch));
                const matchesTask = data?.assignments.some(a => 
                    a.taskTitle.toLowerCase().includes(effectiveStudentSearch) ||
                    (a.inventoryRefTitle && a.inventoryRefTitle.toLowerCase().includes(effectiveStudentSearch))
                );
                if (!matchesName && !matchesClass && !matchesTask) return false;
            }

            return true;
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [students, studentDataMap, learnerLifecycleFilter, selectedClassroomId, assignmentStatusFilter, effectiveStudentSearch]);

    // Selected student data
    const selectedStudentData = useMemo(() => {
        if (!selectedStudentId) return null;
        return studentDataMap.get(selectedStudentId) || null;
    }, [selectedStudentId, studentDataMap]);

    // Assignments for selected student filtered by tab & sub-search
    const selectedStudentAssignments = useMemo(() => {
        if (!selectedStudentData) return [];
        let list = selectedStudentData.assignments;

        if (assignmentStatusFilter === 'active') {
            list = list.filter(a => a.isActive);
        } else if (assignmentStatusFilter === 'past_due') {
            list = list.filter(a => a.isPastDue);
        } else if (assignmentStatusFilter === 'completed') {
            list = list.filter(a => a.isCompleted);
        }

        if (studentTaskSearch.trim() !== '') {
            const q = studentTaskSearch.toLowerCase().trim();
            list = list.filter(a => 
                a.taskTitle.toLowerCase().includes(q) ||
                (a.taskDescription && a.taskDescription.toLowerCase().includes(q)) ||
                (a.classroomName && a.classroomName.toLowerCase().includes(q)) ||
                (a.inventoryRefTitle && a.inventoryRefTitle.toLowerCase().includes(q))
            );
        }

        return list;
    }, [selectedStudentData, assignmentStatusFilter, studentTaskSearch]);

    // Helper to find original TaskSubmission object for Review modal
    const getSubmissionForReview = (asg: StudentEffectiveAssignment): TaskSubmission | null => {
        if (!selectedStudentData) return null;
        const student = selectedStudentData.student;
        const sub = submissions.find(s => s.task_id === asg.assignmentId && s.student_id === student.id);
        if (sub) return sub;

        // Fallback reconstructed TaskSubmission
        return {
            id: asg.submissionId || `sub-${asg.assignmentId}-${student.id}`,
            student_id: student.id,
            student_name: student.name,
            student_profile_pic_url: student.profile_pic_url || undefined,
            task_id: asg.assignmentId,
            task_title: asg.taskTitle,
            task_description: asg.taskDescription || undefined,
            status: asg.status,
            submitted_at: asg.submittedAt || asg.createdAt || new Date().toISOString(),
            classroom_id: asg.classroomId,
            classroom_name: asg.classroomName,
            due_date: asg.dueDate || null,
            score: asg.score ?? undefined,
            proficiency_level: asg.proficiencyLevel || undefined,
            feedback_text: asg.feedbackText || undefined,
            video_url: asg.videoUrl || undefined,
            file_url: asg.fileUrl || undefined,
            file_name: asg.fileName || undefined,
            file_size: asg.fileSize || null,
            inventory_ref_id: asg.inventoryRefId || null,
            inventory_ref_title: asg.inventoryRefTitle || null,
            inventory_ref_type: asg.inventoryRefType || null
        };
    };

    return (
        <div className="space-y-4">
            {/* Top Control Bar: Search & Filters */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xs space-y-3">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    {/* Student Search Autocomplete Input */}
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search student, assignment or task..."
                            value={localStudentSearch}
                            onFocus={() => setIsAutocompleteFocused(true)}
                            onBlur={() => setTimeout(() => setIsAutocompleteFocused(false), 250)}
                            onChange={(e) => {
                                setLocalStudentSearch(e.target.value);
                                onSearchChange?.(e.target.value);
                                setIsAutocompleteFocused(true);
                            }}
                            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#ecb613] transition-all"
                        />
                        {localStudentSearch && (
                            <button
                                type="button"
                                onClick={() => {
                                    setLocalStudentSearch('');
                                    onSearchChange?.('');
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                Clear
                            </button>
                        )}

                        {/* Autocomplete Dropdown Popup */}
                        {isAutocompleteFocused && autocompleteMatches.length > 0 && !selectedStudentId && (
                            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in slide-in-from-top-2 duration-150">
                                <div className="px-3.5 py-1.5 bg-slate-50 dark:bg-slate-800/60 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                    Quick Select Student
                                </div>
                                {autocompleteMatches.map(st => (
                                    <button
                                        key={st.id}
                                        type="button"
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            setSelectedStudentId(st.id);
                                            setIsAutocompleteFocused(false);
                                        }}
                                        className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-amber-50/80 dark:hover:bg-amber-950/30 text-left transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-8 h-8 rounded-xl bg-[#ecb613]/20 border border-[#ecb613]/30 flex items-center justify-center font-black text-xs text-[#ecb613] shrink-0">
                                                {st.profile_pic_url ? (
                                                    <img src={st.profile_pic_url} alt={st.name} className="w-full h-full object-cover rounded-xl" />
                                                ) : (
                                                    st.name.charAt(0)
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">{st.name}</p>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                                    {st.classroom_names?.join(' • ') || 'No Classroom'}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-[11px] font-bold text-[#ecb613] bg-amber-500/10 px-2 py-0.5 rounded-md shrink-0">
                                            Inspect
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Classroom Dropdown */}
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold text-slate-400 hidden sm:inline">Classroom:</span>
                        <select
                            value={selectedClassroomId}
                            onChange={(e) => setSelectedClassroomId(e.target.value)}
                            className="min-h-[38px] px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#ecb613]"
                        >
                            <option value="all">All Classrooms ({students.length} students)</option>
                            {availableClassrooms.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Learner Lifecycle Filter Toggle */}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
                        <button
                            type="button"
                            onClick={() => setLearnerLifecycleFilter('active')}
                            className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                learnerLifecycleFilter === 'active'
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                            }`}
                        >
                            Active Learners
                        </button>
                        <button
                            type="button"
                            onClick={() => setLearnerLifecycleFilter('all')}
                            className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                learnerLifecycleFilter === 'all'
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                            }`}
                        >
                            All (incl. Paused)
                        </button>
                    </div>
                </div>

                {/* Status Tabs Bar */}
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-1 border-t border-slate-100 dark:border-slate-800/80">
                    <button
                        type="button"
                        onClick={() => setAssignmentStatusFilter('all')}
                        className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
                            assignmentStatusFilter === 'all'
                                ? 'bg-[#ecb613]/20 text-amber-900 dark:text-amber-200 border border-[#ecb613]/50'
                                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                        }`}
                    >
                        All
                    </button>
                    <button
                        type="button"
                        onClick={() => setAssignmentStatusFilter('active')}
                        className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
                            assignmentStatusFilter === 'active'
                                ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/50'
                                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                        }`}
                    >
                        Active
                    </button>
                    <button
                        type="button"
                        onClick={() => setAssignmentStatusFilter('past_due')}
                        className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
                            assignmentStatusFilter === 'past_due'
                                ? 'bg-rose-500/20 text-rose-900 dark:text-rose-200 border border-rose-500/50'
                                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                        }`}
                    >
                        Past Due
                    </button>
                    <button
                        type="button"
                        onClick={() => setAssignmentStatusFilter('completed')}
                        className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
                            assignmentStatusFilter === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-900 dark:text-emerald-200 border border-emerald-500/50'
                                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                        }`}
                    >
                        Completed
                    </button>
                </div>
            </div>

            {/* View Body: Either Student Detail Panel or Student List Grid */}
            {selectedStudentData ? (
                /* ── SELECTED STUDENT ASSIGNMENTS PANEL ────────────────────────── */
                <div className="space-y-4 animate-in fade-in duration-200">
                    {/* Header with Back button & Summary Banner */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3.5">
                                <button
                                    type="button"
                                    onClick={() => setSelectedStudentId(null)}
                                    className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                                    title="Back to all students"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    <span className="text-xs font-bold hidden sm:inline">All Students</span>
                                </button>

                                <div className="w-12 h-12 rounded-2xl bg-[#ecb613]/20 border border-[#ecb613]/30 flex items-center justify-center overflow-hidden shrink-0">
                                    {selectedStudentData.student.profile_pic_url ? (
                                        <img 
                                            src={selectedStudentData.student.profile_pic_url} 
                                            alt={selectedStudentData.student.name} 
                                            className="w-full h-full object-cover" 
                                        />
                                    ) : (
                                        <span className="font-black text-base text-[#ecb613]">
                                            {selectedStudentData.student.name.charAt(0)}
                                        </span>
                                    )}
                                </div>

                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white truncate">
                                            {selectedStudentData.student.name}
                                        </h2>
                                        {selectedStudentData.student.status === 'inactive' && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300">
                                                Learning Paused
                                            </span>
                                        )}
                                        {selectedStudentData.student.status === 'archived' && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-200 text-slate-700">
                                                Archived
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5 truncate">
                                        🏫 {selectedStudentData.student.classroom_names?.join(' • ') || 'No Classroom'}
                                    </p>
                                </div>
                            </div>

                            {/* Summary Metrics Pills: Active, Past Due, Awaiting Review, Completed */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800 rounded-xl text-center min-w-[70px]">
                                    <div className="text-[10px] uppercase tracking-wider font-extrabold text-amber-700 dark:text-amber-300">Active</div>
                                    <div className="text-base font-black text-amber-900 dark:text-amber-100">{selectedStudentData.metrics.activeCount}</div>
                                </div>
                                <div className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-800 rounded-xl text-center min-w-[70px]">
                                    <div className="text-[10px] uppercase tracking-wider font-extrabold text-rose-700 dark:text-rose-300">Past Due</div>
                                    <div className="text-base font-black text-rose-900 dark:text-rose-100">{selectedStudentData.metrics.pastDueCount}</div>
                                </div>
                                <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800 rounded-xl text-center min-w-[70px]">
                                    <div className="text-[10px] uppercase tracking-wider font-extrabold text-blue-700 dark:text-blue-300">Review</div>
                                    <div className="text-base font-black text-blue-900 dark:text-blue-100">{selectedStudentData.metrics.awaitingReviewCount}</div>
                                </div>
                                <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800 rounded-xl text-center min-w-[70px]">
                                    <div className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-700 dark:text-emerald-300">Completed</div>
                                    <div className="text-base font-black text-emerald-900 dark:text-emerald-100">{selectedStudentData.metrics.completedCount}</div>
                                </div>
                            </div>
                        </div>

                        {/* Search inside student assignments */}
                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
                            <div className="relative flex-1 max-w-md">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder={`Filter ${selectedStudentData.student.name}'s assignments...`}
                                    value={studentTaskSearch}
                                    onChange={(e) => setStudentTaskSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-[#ecb613]"
                                />
                            </div>
                            <span className="text-xs text-slate-400 font-bold">
                                Showing {selectedStudentAssignments.length} of {selectedStudentData.assignments.length} effective assignments
                            </span>
                        </div>
                    </div>

                    {/* Effective Assignment Cards List */}
                    {selectedStudentAssignments.length > 0 ? (
                        <div className="space-y-3">
                            {selectedStudentAssignments.map(asg => {
                                const submissionObj = getSubmissionForReview(asg);

                                return (
                                    <div
                                        key={asg.assignmentId}
                                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-3 text-left"
                                    >
                                        <div className="space-y-2">
                                            {/* Badges bar */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {/* Targeting Badge: Individual vs Class */}
                                                {asg.isIndividual ? (
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black border bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30">
                                                        👤 Individual
                                                    </span>
                                                ) : (
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black border bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 border-indigo-500/30">
                                                        👥 For Everyone • {asg.classroomName || 'Class Assignment'}
                                                    </span>
                                                )}

                                                {/* Classroom Badge for individual tasks */}
                                                {asg.isIndividual && asg.classroomName && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                        🏫 {asg.classroomName}
                                                    </span>
                                                )}

                                                {/* Student-specific Status Pill */}
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                                                    asg.effectiveStatus === 'approved'
                                                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                        : asg.effectiveStatus === 'awaiting_review'
                                                        ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300'
                                                        : asg.effectiveStatus === 'needs_revision'
                                                        ? 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300'
                                                        : asg.isPastDue
                                                        ? 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300'
                                                        : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
                                                }`}>
                                                    {asg.statusLabel}
                                                </span>

                                                {asg.score !== null && asg.score !== undefined && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 border border-emerald-300">
                                                        Score: {asg.score}/10
                                                    </span>
                                                )}
                                            </div>

                                            {/* Title & Description */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white leading-snug">
                                                        {asg.taskTitle}
                                                    </h3>
                                                    {asg.taskDescription && (
                                                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                                                            <AutoLinkText text={asg.taskDescription} />
                                                        </p>
                                                    )}
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => onEditAssignment(asg.assignmentId)}
                                                    className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                                                    title="Edit Assignment"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            {/* Materials & Topics */}
                                            {(asg.inventoryRefTitle || asg.fileName) && (
                                                <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                                                    {asg.inventoryRefTitle && (
                                                        <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 truncate max-w-[240px] flex items-center gap-1">
                                                            <BookOpen className="w-3 h-3" />
                                                            {asg.inventoryRefTitle}
                                                        </span>
                                                    )}
                                                    {asg.fileName && (
                                                        <span className="text-[11px] text-slate-500 truncate max-w-[200px] flex items-center gap-1">
                                                            <Paperclip className="w-3 h-3 text-amber-600" />
                                                            {asg.fileName}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Feedback preview if revision requested */}
                                            {asg.feedbackText && (
                                                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                                                    <span className="font-bold text-slate-500 dark:text-slate-400 mr-1">Latest Feedback:</span>
                                                    {asg.feedbackText}
                                                </div>
                                            )}
                                        </div>

                                        {/* Card Footer: Dates & Review Action */}
                                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap text-xs">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <span className="text-slate-400 text-[11px]">
                                                    Assigned: {asg.createdAt ? new Date(asg.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                                                </span>
                                                <div className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                                                    <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                                                    <input
                                                        type="date"
                                                        value={formatDateForInput(asg.dueDate)}
                                                        onChange={(e) => onQuickUpdateDueDate(asg.assignmentId, e.target.value)}
                                                        className="bg-transparent text-slate-800 dark:text-slate-200 font-mono text-[11px] font-bold outline-none cursor-pointer"
                                                        title="Quick change due date"
                                                    />
                                                </div>
                                            </div>

                                            {/* Action button */}
                                            {submissionObj && (asg.status === 'submitted' || asg.status === 'reviewed' || asg.status === 'approved') ? (
                                                <button
                                                    type="button"
                                                    onClick={() => onReviewSubmission(submissionObj)}
                                                    className={`min-h-[34px] px-3.5 py-1.5 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 active:scale-95 transition-all ${
                                                        asg.status === 'submitted'
                                                            ? 'bg-[#ecb613] hover:bg-[#d9a50b] text-slate-950 shadow-amber-500/20'
                                                            : asg.status === 'reviewed'
                                                            ? 'bg-blue-50 hover:bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200 border border-blue-200 dark:border-blue-800'
                                                            : 'bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                                                    }`}
                                                >
                                                    <PlayCircle className="w-3.5 h-3.5 shrink-0" />
                                                    <span>
                                                        {asg.status === 'submitted' ? 'Review Submission' :
                                                         asg.status === 'reviewed' ? 'Reopen Review' : 'View Review Details'}
                                                    </span>
                                                </button>
                                            ) : (
                                                <span className="text-[11px] text-slate-400 italic">
                                                    Awaiting student submission
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-12 text-center text-slate-500">
                            No assignments found for {selectedStudentData.student.name} matching the selected filter.
                        </div>
                    )}
                </div>
            ) : (
                /* ── STUDENTS LIST GRID ────────────────────────────────────────── */
                <div>
                    {filteredStudents.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                            {filteredStudents.map(student => {
                                const data = studentDataMap.get(student.id);
                                const metrics = data?.metrics || {
                                    totalCount: 0,
                                    activeCount: 0,
                                    awaitingSubmissionCount: 0,
                                    awaitingReviewCount: 0,
                                    completedCount: 0,
                                    pastDueCount: 0,
                                    needsRevisionCount: 0
                                };
                                const isPaused = student.status === 'inactive' || student.status === 'archived';

                                return (
                                    <div
                                        key={student.id}
                                        onClick={() => setSelectedStudentId(student.id)}
                                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs hover:shadow-md hover:border-[#ecb613]/60 transition-all flex flex-col justify-between space-y-3 cursor-pointer group text-left"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-2xl bg-[#ecb613]/20 border border-[#ecb613]/30 flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
                                                {student.profile_pic_url ? (
                                                    <img src={student.profile_pic_url} alt={student.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="font-black text-sm text-[#ecb613]">
                                                        {student.name.charAt(0)}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white truncate group-hover:text-[#ecb613] transition-colors">
                                                        {student.name}
                                                    </h3>
                                                    {isPaused && (
                                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                                                            Paused
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                                                    {student.classroom_names?.join(', ') || 'No Classroom'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Metrics 4-Box Grid */}
                                        <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                                            <div className="bg-amber-500/10 dark:bg-amber-500/5 rounded-lg py-1 px-0.5">
                                                <div className="text-[9px] uppercase font-bold text-amber-700 dark:text-amber-400">Active</div>
                                                <div className="text-xs font-black text-amber-900 dark:text-amber-200">{metrics.activeCount}</div>
                                            </div>
                                            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg py-1 px-0.5">
                                                <div className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">Pending</div>
                                                <div className="text-xs font-black text-slate-800 dark:text-slate-200">{metrics.awaitingSubmissionCount}</div>
                                            </div>
                                            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg py-1 px-0.5">
                                                <div className="text-[9px] uppercase font-bold text-blue-700 dark:text-blue-300">Review</div>
                                                <div className="text-xs font-black text-blue-900 dark:text-blue-200">{metrics.awaitingReviewCount}</div>
                                            </div>
                                            <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg py-1 px-0.5">
                                                <div className="text-[9px] uppercase font-bold text-emerald-700 dark:text-emerald-300">Done</div>
                                                <div className="text-xs font-black text-emerald-900 dark:text-emerald-200">{metrics.completedCount}</div>
                                            </div>
                                        </div>

                                        {/* Card Bottom: View Assignments Button */}
                                        <div className="flex items-center justify-between pt-1 text-xs">
                                            <span className="text-[11px] font-bold text-slate-400">
                                                {metrics.totalCount} {metrics.totalCount === 1 ? 'Assignment' : 'Assignments'}
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#ecb613] group-hover:underline">
                                                View Assignments <ChevronRight className="w-3.5 h-3.5" />
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-12 text-center text-slate-500">
                            No students found matching your search and filters.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
