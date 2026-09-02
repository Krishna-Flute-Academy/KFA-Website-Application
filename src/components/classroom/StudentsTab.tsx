'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
    Calendar, UserPlus, Trash2, Loader2, Plus, 
    AlertTriangle, Sparkles, BarChart2, BookOpen,
    Lightbulb, Check, X, Send, CheckSquare, Square
} from 'lucide-react';
import { supabaseAuth } from '../../lib/supabase-auth';

interface Student {
    id: string;
    student_id: string;
    name: string;
    level?: string;
    profile_pic_url?: string | null;
    mock_progress: number;
    mock_status: string;
    mock_score: number;
    mock_attendance: number;
    mock_submission: number;
    joined_at: string;
    mock_milestone?: string;
    is_makeup?: boolean;
    is_online?: boolean;
}

interface StudentsTabProps {
    students: Student[];
    classroom: any;
    openMakeupModal: () => void;
    openDirectoryModal: () => void;
    paginatedStudents: Student[];
    getRealStudentProgress: (studentId: string, mockVal: number) => number;
    handleRemoveStudent: (student: Student) => void;
    removingStudentId: string | null;
    currentPage: number;
    setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
    PAGE_SIZE: number;
    totalPages: number;
    sessionOverrides: any[];
    formatLocalDate: (dateStr: string) => Date;
    openRescheduleModal: (override: any) => void;
    handleDeleteOverride: (id: string) => Promise<void>;
    isDeletingOverrideId: string | null;
    avgAttendance: number;

    // New Props
    classroomInventoryAllocations: any[];
    courseModules: any[];
    courseChapters: any[];
    courseLessons: any[];
    classroomAttendance: any[];
    classroomAssignmentsStudents: any[];
    assignments: any[];
    studentProgress: any[];
}

const MENTOR_NOTE_TEMPLATES = [
    {
        name: 'Breath Control',
        type: 'practice',
        title: 'Breath Control & Airflow',
        text: 'Practice long steady breaths into the blowhole with relaxed diaphragm support. Maintain stable pitch on lower notes for 5 minutes daily.'
    },
    {
        name: 'Finger Coordination',
        type: 'focus',
        title: 'Finger Placement & Clean Holes',
        text: 'Ensure finger pads fully seal tone holes without excessive tension. Practice slow transition between Sa, Re, and Ga.'
    },
    {
        name: 'Rhythm Practice',
        type: 'practice',
        title: 'Taal & Metronome Practice',
        text: 'Practice with the academy metronome at 60 BPM. Focus on landing exactly on the Sam (beat 1) with clean attacks.'
    },
    {
        name: 'Tone Improvement',
        type: 'improvement',
        title: 'Tone Clarity & Sweet Sound',
        text: 'Adjust your lip embouchure slightly upward to reduce airy hiss. Aim for a warm, resonant, centered flute tone.'
    },
    {
        name: 'Long Note Practice',
        type: 'practice',
        title: 'Long Sustained Notes (Riyaz)',
        text: 'Spend 10 minutes daily holding each note from Mandra Saptak to Madhya Saptak with steady breath and zero pitch wobble.'
    },
    {
        name: 'Tempo Control',
        type: 'practice',
        title: 'Gradual Speed Progression',
        text: 'Do not rush the tempo. Master the phrase accurately at 60 BPM before gradually increasing tempo by 5 BPM intervals.'
    },
    {
        name: 'Revision Required',
        type: 'improvement',
        title: 'Review Previous Lesson Feedback',
        text: 'Revisit the previous assignment submission and pay special attention to finger release timing and komal swara tuning.'
    },
    {
        name: 'Excellent Improvement',
        type: 'strength',
        title: 'Outstanding Progress & Tone',
        text: 'Great progress on tone projection and tempo stability! Keep up this consistent riyaz for the upcoming ragas.'
    },
    {
        name: 'Practice More Slowly',
        type: 'focus',
        title: 'Slow Riyaz for Muscle Memory',
        text: 'Practice at half speed with pure clarity. Precision at slow tempo builds effortless speed later.'
    },
    {
        name: 'Focus on Clean Notes',
        type: 'focus',
        title: 'Clean Note Articulation',
        text: 'Avoid sliding accidentally between notes unless specifically playing meend. Focus on crisp, clean note separations.'
    }
];

function getStatusColor(status: string) {
    if (status === 'Consistent') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400';
    if (status === 'Improving') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400';
    return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400';
}

export default function StudentsTab({
    students,
    classroom,
    openMakeupModal,
    openDirectoryModal,
    paginatedStudents,
    getRealStudentProgress,
    handleRemoveStudent,
    removingStudentId,
    currentPage,
    setCurrentPage,
    PAGE_SIZE,
    totalPages,
    sessionOverrides,
    formatLocalDate,
    openRescheduleModal,
    handleDeleteOverride,
    isDeletingOverrideId,
    avgAttendance,

    // New Destructuring
    classroomInventoryAllocations,
    courseModules,
    courseChapters,
    courseLessons,
    classroomAttendance,
    classroomAssignmentsStudents,
    assignments,
    studentProgress
}: StudentsTabProps) {
    // Multi-select state
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

    // Mentor Note Modal state
    const [isMentorModalOpen, setIsMentorModalOpen] = useState(false);
    const [modalTargetStudents, setModalTargetStudents] = useState<Student[]>([]);
    const [noteType, setNoteType] = useState<'focus' | 'practice' | 'strength' | 'improvement' | 'general'>('focus');
    const [noteTitle, setNoteTitle] = useState('Focus this week');
    const [noteText, setNoteText] = useState('');
    const [isActiveGuidance, setIsActiveGuidance] = useState(true);
    const [isSavingNote, setIsSavingNote] = useState(false);
    const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
    const [saveErrorMsg, setSaveErrorMsg] = useState('');

    const toggleSelectStudent = (studentId: string) => {
        setSelectedStudentIds(prev => {
            const next = new Set(prev);
            if (next.has(studentId)) {
                next.delete(studentId);
            } else {
                next.add(studentId);
            }
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedStudentIds.size === paginatedStudents.length && paginatedStudents.length > 0) {
            setSelectedStudentIds(new Set());
        } else {
            setSelectedStudentIds(new Set(paginatedStudents.map(s => s.student_id)));
        }
    };

    const openBulkMentorModal = () => {
        const targets = students.filter(s => selectedStudentIds.has(s.student_id));
        if (targets.length === 0) return;
        setModalTargetStudents(targets);
        setNoteType('focus');
        setNoteTitle('Focus this week');
        setNoteText('');
        setIsActiveGuidance(true);
        setSaveSuccessMsg('');
        setSaveErrorMsg('');
        setIsMentorModalOpen(true);
    };

    const openSingleMentorModal = (student: Student) => {
        setModalTargetStudents([student]);
        setNoteType('focus');
        setNoteTitle('Focus this week');
        setNoteText('');
        setIsActiveGuidance(true);
        setSaveSuccessMsg('');
        setSaveErrorMsg('');
        setIsMentorModalOpen(true);
    };

    const applyTemplate = (tpl: typeof MENTOR_NOTE_TEMPLATES[0]) => {
        setNoteType(tpl.type as any);
        setNoteTitle(tpl.title);
        setNoteText(tpl.text);
    };

    const handleSaveMentorNotes = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!noteText.trim()) {
            setSaveErrorMsg('Please enter guidance text.');
            return;
        }

        setIsSavingNote(true);
        setSaveErrorMsg('');
        setSaveSuccessMsg('');

        try {
            const { data: { user } } = await supabaseAuth.auth.getUser();
            if (!user) throw new Error('You must be logged in to create mentor notes.');

            const targetIds = modalTargetStudents.map(s => s.student_id);

            // 1. If marked as current active guidance, deactivate older active notes for these students
            if (isActiveGuidance && targetIds.length > 0) {
                await supabaseAuth
                    .from('mentor_notes')
                    .update({ is_active: false })
                    .in('student_id', targetIds)
                    .eq('is_active', true);
            }

            // 2. Batch insert one row per selected student
            const rows = targetIds.map(sId => ({
                student_id: sId,
                classroom_id: classroom?.id || null,
                mentor_id: user.id,
                title: noteTitle.trim() || 'Teacher Guidance',
                note: noteText.trim(),
                note_type: noteType,
                is_active: isActiveGuidance,
                created_at: new Date().toISOString()
            }));

            const { error: insertError } = await supabaseAuth
                .from('mentor_notes')
                .insert(rows);

            if (insertError) throw insertError;

            setSaveSuccessMsg(`Mentor note saved successfully for ${targetIds.length} student${targetIds.length > 1 ? 's' : ''}!`);
            setSelectedStudentIds(new Set());

            setTimeout(() => {
                setIsMentorModalOpen(false);
                setSaveSuccessMsg('');
            }, 1200);
        } catch (err: any) {
            setSaveErrorMsg(err.message || 'Failed to save mentor note. Please try again.');
        } finally {
            setIsSavingNote(false);
        }
    };

    const getAssignmentLevel = (assignment: any) => {
        if (!assignment.inventory_ref_type || !assignment.inventory_ref_id) return null;
        
        let moduleId = '';
        if (assignment.inventory_ref_type === 'module') {
            moduleId = assignment.inventory_ref_id;
        } else if (assignment.inventory_ref_type === 'chapter') {
            const chap = courseChapters.find(c => c.id === assignment.inventory_ref_id);
            if (chap) moduleId = chap.module_id;
        } else if (assignment.inventory_ref_type === 'lesson') {
            const lesson = courseLessons.find(l => l.id === assignment.inventory_ref_id);
            const chap = lesson ? courseChapters.find(c => c.id === lesson.chapter_id) : null;
            if (chap) moduleId = chap.module_id;
        }
        
        if (moduleId) {
            const mod = courseModules.find(m => m.id === moduleId);
            return mod ? mod.title : null;
        }
        
        return null;
    };

    const getStudentSubmissionRate = (studentId: string, studentLevel: string, defaultMockVal: number) => {
        const classAssignments = assignments.filter(asg => asg.classroom_id === classroom.id);
        
        const studentTasks = classAssignments.filter(asg => {
            const isAssigned = asg.target_type === 'all' || 
                (asg.assignment_students && asg.assignment_students.some(s => s.student_id === studentId));
                
            if (!isAssigned) return false;
            
            let mapRow = null;
            if (asg.assignment_students) {
                mapRow = asg.assignment_students.find(s => s.student_id === studentId);
            }
            
            if (mapRow && mapRow.proficiency_level) {
                return mapRow.proficiency_level.toLowerCase() === studentLevel.toLowerCase();
            }
            
            const asgLevel = getAssignmentLevel(asg);
            if (asgLevel) {
                return asgLevel.toLowerCase() === studentLevel.toLowerCase();
            }
            
            return true;
        });
        
        if (studentTasks.length === 0) return null;
        
        let submittedCount = 0;
        studentTasks.forEach(asg => {
            const mapping = classroomAssignmentsStudents.find(cas => 
                cas.student_id === studentId && cas.assignment_id === asg.id
            );
            if (mapping && (mapping.status === 'submitted' || mapping.status === 'reviewed' || mapping.status === 'approved')) {
                submittedCount++;
            }
        });
        
        return Math.round((submittedCount / studentTasks.length) * 100);
    };

    const getStudentAttendanceRate = (studentId: string, defaultMockVal: number) => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        
        const currentMonthAttendance = classroomAttendance.filter(att => {
            if (!att.date) return false;
            const d = new Date(att.date);
            return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        });
        
        if (currentMonthAttendance.length === 0) {
            const allTimeUniqueDates = new Set(classroomAttendance.map(att => att.date)).size;
            if (allTimeUniqueDates > 0) {
                const allTimePresent = classroomAttendance.filter(att => 
                    att.student_id === studentId && (att.status === 'present' || att.status === 'late')
                ).length;
                return Math.round((allTimePresent / allTimeUniqueDates) * 100);
            }
            return null;
        }
        
        const uniqueDates = new Set(currentMonthAttendance.map(att => att.date));
        const totalScheduled = uniqueDates.size;
        
        const joinedCount = currentMonthAttendance.filter(att => 
            att.student_id === studentId && (att.status === 'present' || att.status === 'late')
        ).length;
        
        return totalScheduled > 0 ? Math.round((joinedCount / totalScheduled) * 100) : null;
    };

    const getStudentAvgScore = (studentId: string, defaultMockVal: number) => {
        const studentAssignments = classroomAssignmentsStudents.filter(cas => 
            cas.student_id === studentId && cas.score !== null && cas.score !== undefined
        );
        
        if (studentAssignments.length === 0) return null;
        
        const sum = studentAssignments.reduce((acc, curr) => acc + curr.score, 0);
        return parseFloat((sum / studentAssignments.length).toFixed(1));
    };

    const atRiskStudent = React.useMemo(() => {
        let lowest: { student: Student; rate: number } | null = null;
        students.forEach(s => {
            const rate = getStudentAttendanceRate(s.student_id, s.mock_attendance);
            if (rate !== null && rate < 75) {
                if (!lowest || rate < lowest.rate) {
                    lowest = { student: s, rate };
                }
            }
        });
        return lowest;
    }, [students, classroomAttendance]);

    const classTasksStats = React.useMemo(() => {
        const classAsgs = (assignments || []).filter(asg => asg.classroom_id === classroom?.id);
        const totalTasks = classAsgs.length;
        let totalSubmissions = 0;
        let expectedSubmissions = totalTasks * students.length;

        if (totalTasks > 0 && students.length > 0 && classroomAssignmentsStudents) {
            classAsgs.forEach(asg => {
                const subs = classroomAssignmentsStudents.filter(cas => 
                    cas.assignment_id === asg.id && 
                    (cas.status === 'submitted' || cas.status === 'reviewed' || cas.status === 'approved')
                );
                totalSubmissions += subs.length;
            });
        }

        const rate = expectedSubmissions > 0 ? Math.round((totalSubmissions / expectedSubmissions) * 100) : 0;
        return { totalTasks, rate };
    }, [assignments, classroom, students, classroomAssignmentsStudents]);

    const isAllSelected = paginatedStudents.length > 0 && selectedStudentIds.size === paginatedStudents.length;

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
            {/* Actions Header */}
            <div className="flex justify-between items-end flex-wrap gap-4">
                <div>
                    <h3 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Student Roster</h3>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Managing {students.length} students in {classroom.name}</p>
                </div>
                <div className="flex gap-3 flex-wrap items-center">
                    {/* Bulk Action Button */}
                    {selectedStudentIds.size > 0 && (
                        <button
                            onClick={openBulkMentorModal}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl font-bold text-xs shadow-md transition-all animate-in zoom-in-95 cursor-pointer active:scale-95"
                        >
                            <Lightbulb className="w-4 h-4 text-amber-200" />
                            <span>Add Mentor Note ({selectedStudentIds.size})</span>
                        </button>
                    )}

                    <button
                        onClick={openMakeupModal}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                    >
                        <Calendar className="w-4 h-4" />
                        <span>Schedule Makeup</span>
                    </button>

                    <button
                        onClick={openDirectoryModal}
                        className="flex items-center gap-2 px-4 py-2 bg-[#ecb613] text-slate-900 rounded-xl text-xs font-bold hover:bg-[#ecb613]/90 transition-all shadow-md shadow-[#ecb613]/20 cursor-pointer"
                    >
                        <UserPlus className="w-4 h-4" />
                        <span>Add from Directory</span>
                    </button>
                </div>
            </div>

            {/* Bulk Selection Notification Bar */}
            {selectedStudentIds.size > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-2xl p-3.5 flex items-center justify-between gap-4 shadow-xs animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs">
                            {selectedStudentIds.size}
                        </div>
                        <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                            {selectedStudentIds.size} student{selectedStudentIds.size > 1 ? 's' : ''} selected. You can apply the same guidance note to all of them in one click.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={openBulkMentorModal}
                            className="px-3.5 py-1.5 bg-[#7C5E3F] hover:bg-amber-900 text-white text-xs font-extrabold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                            <Lightbulb className="w-3.5 h-3.5 text-amber-300" />
                            <span>Compose Note →</span>
                        </button>
                        <button
                            onClick={() => setSelectedStudentIds(new Set())}
                            className="px-2.5 py-1.5 text-slate-500 hover:text-slate-700 text-xs font-bold cursor-pointer"
                        >
                            Clear
                        </button>
                    </div>
                </div>
            )}

            {/* Student Table / Roster */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mt-2">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                <th className="px-4 py-4 w-10 text-center">
                                    <button
                                        type="button"
                                        onClick={toggleSelectAll}
                                        className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                                        title={isAllSelected ? 'Deselect all' : 'Select all'}
                                    >
                                        {isAllSelected ? (
                                            <CheckSquare className="w-4 h-4 text-amber-600" />
                                        ) : (
                                            <Square className="w-4 h-4" />
                                        )}
                                    </button>
                                </th>
                                <th className="px-5 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Student</th>
                                <th className="px-5 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="px-5 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Proficiency Progress</th>
                                <th className="px-5 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Task Submission</th>
                                <th className="px-5 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Attendance</th>
                                <th className="px-5 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg. Score</th>
                                <th className="px-5 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {paginatedStudents.map(student => {
                                const isSelected = selectedStudentIds.has(student.student_id);
                                const realProgress = getRealStudentProgress(student.student_id, 0);
                                const submission = getStudentSubmissionRate(student.student_id, student.level || 'Level 1', student.mock_submission);
                                const attendance = getStudentAttendanceRate(student.student_id, student.mock_attendance);
                                const score = getStudentAvgScore(student.student_id, student.mock_score);
                                
                                const calcValues = [realProgress];
                                if (submission !== null) calcValues.push(submission);
                                if (attendance !== null) calcValues.push(attendance);
                                if (score !== null) calcValues.push(score * 10);
                                
                                const cumulativeAverage = Math.round(calcValues.reduce((a, b) => a + b, 0) / calcValues.length);
                                
                                let calculatedStatus: 'Consistent' | 'Improving' | 'At Risk' = 'At Risk';
                                if (submission === null && attendance === null && score === null) {
                                    calculatedStatus = 'Consistent';
                                } else {
                                    if (cumulativeAverage >= 80) calculatedStatus = 'Consistent';
                                    else if (cumulativeAverage >= 65) calculatedStatus = 'Improving';
                                }

                                return (
                                    <tr 
                                        key={student.id} 
                                        className={`transition-colors group ${
                                            isSelected ? 'bg-amber-50/50 dark:bg-amber-950/20' : 'hover:bg-slate-50/50 dark:hover:bg-slate-850'
                                        }`}
                                    >
                                        <td className="px-4 py-4 text-center">
                                            <button
                                                type="button"
                                                onClick={() => toggleSelectStudent(student.student_id)}
                                                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                                            >
                                                {isSelected ? (
                                                    <CheckSquare className="w-4 h-4 text-amber-600" />
                                                ) : (
                                                    <Square className="w-4 h-4" />
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="relative shrink-0 select-none">
                                                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border border-slate-200 dark:border-slate-600 flex items-center justify-center">
                                                        {student.profile_pic_url ? (
                                                            <img alt={student.name} className="w-full h-full object-cover" src={student.profile_pic_url} loading="lazy" />
                                                        ) : (
                                                            <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{student.name.charAt(0)}</span>
                                                        )}
                                                    </div>
                                                    {student.is_online && (
                                                        <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-800 animate-pulse" />
                                                    )}
                                                </div>
                                                <div>
                                                    <Link href={`/teacher-dashboard/students/${student.student_id}`} className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#ecb613] transition-colors">{student.name}</Link>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{student.name.toLowerCase().replace(' ', '.')}@academy.edu</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${getStatusColor(calculatedStatus)}`}>
                                                {calculatedStatus}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="w-32">
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{realProgress}% Complete</span>
                                                </div>
                                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 flex overflow-hidden">
                                                    <div className="h-1.5 rounded-full bg-[#ecb613]" style={{ width: `${realProgress}%` }}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-sm font-medium text-slate-700 dark:text-slate-300">{submission ?? 0}%</td>
                                        <td className="px-5 py-4 text-sm font-medium text-slate-700 dark:text-slate-300">{attendance ?? 0}%</td>
                                        <td className="px-5 py-4 text-sm font-bold text-slate-900 dark:text-white">{(score ?? 0).toFixed(1)} ★</td>
                                        <td className="px-5 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {/* Single Mentor Note Button */}
                                                <button
                                                    onClick={() => openSingleMentorModal(student)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60 rounded-lg transition-all cursor-pointer shadow-2xs"
                                                    title="Give mentor note/tip"
                                                >
                                                    <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                                                    <span>+ Guidance</span>
                                                </button>

                                                <button
                                                    onClick={() => handleRemoveStudent(student)}
                                                    disabled={removingStudentId === student.id}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg transition-all disabled:opacity-50 text-left cursor-pointer"
                                                    title="Remove from this classroom"
                                                >
                                                    {removingStudentId === student.id
                                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        : <Trash2 className="w-3.5 h-3.5" />}
                                                    Remove
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {paginatedStudents.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center bg-slate-50 dark:bg-slate-800/30">
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
                            className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
                        >
                            Previous
                        </button>
                        <button 
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Temporary Session overrides (Makeup Classes) Section */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mt-6">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center flex-wrap gap-4">
                    <div>
                        <h4 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-emerald-600" />
                            Temporary Session Allocations / Makeups
                        </h4>
                        <p className="text-xs text-slate-500 mt-1">Students assigned to this classroom for a single class date (e.g. makeup sessions).</p>
                    </div>
                    <button
                        onClick={openMakeupModal}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:hover:bg-emerald-950/40 font-bold text-xs transition-colors cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add Makeup
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 tracking-wider">Student</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 tracking-wider">Class Date</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 tracking-wider">Reason / Notes</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 tracking-wider"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {sessionOverrides.map(override => (
                                <tr key={override.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border border-slate-200 dark:border-slate-600 flex items-center justify-center shrink-0">
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
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 rounded-lg transition-all cursor-pointer"
                                                title="Reschedule makeup allocation"
                                            >
                                                <Calendar className="w-3.5 h-3.5" />
                                                Reschedule
                                            </button>
                                            <button
                                                onClick={() => handleDeleteOverride(override.id)}
                                                disabled={isDeletingOverrideId === override.id}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg transition-all disabled:opacity-50 text-left cursor-pointer"
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

            {/* Dynamic Classroom Insights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:grid-cols-3">
                <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/50 p-6 rounded-2xl shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-3 text-amber-800 dark:text-amber-400">
                            <AlertTriangle className="w-5 h-5 shrink-0" />
                            <h4 className="font-extrabold text-sm">Attendance & Participation</h4>
                        </div>
                        <p className="text-xs text-amber-900/80 dark:text-amber-200/90 mb-4 leading-relaxed font-semibold">
                            {atRiskStudent ? (
                                <><strong>{atRiskStudent.student.name}</strong> has a low attendance rate ({atRiskStudent.rate}%) this month and may need extra guidance.</>
                            ) : (
                                <>All {students.length} student(s) in {classroom?.name || 'this batch'} currently maintain active class participation.</>
                            )}
                        </p>
                    </div>
                    <button 
                        onClick={openMakeupModal}
                        className="w-full py-2.5 bg-[#7C5E3F] hover:bg-amber-800 text-white rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                    >
                        <Calendar className="w-4 h-4" />
                        <span>Schedule Makeup Class</span>
                    </button>
                </div>

                <div className="bg-indigo-50/70 dark:bg-indigo-950/20 border border-[#c7d2fe] dark:border-indigo-900/50 p-6 rounded-2xl shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-3 text-indigo-800 dark:text-indigo-400">
                            <Sparkles className="w-5 h-5 shrink-0" />
                            <h4 className="font-extrabold text-sm">Classroom Tasks & Submissions</h4>
                        </div>
                        <p className="text-xs text-indigo-900/80 dark:text-indigo-200/90 mb-4 leading-relaxed font-semibold">
                            {classTasksStats.totalTasks > 0 ? (
                                <>{classTasksStats.totalTasks} active assignment(s) created for this batch with an average submission rate of {classTasksStats.rate}%.</>
                            ) : (
                                <>No assignments created for this batch yet. Assign lessons or practice tasks to track student progress.</>
                            )}
                        </p>
                    </div>
                    <Link 
                        href="/teacher-dashboard/tasks"
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                    >
                        <BookOpen className="w-4 h-4" />
                        <span>Manage Classroom Tasks</span>
                    </Link>
                </div>

                <div className="p-6 rounded-2xl shadow-lg relative overflow-hidden text-slate-900 flex flex-col justify-between" style={{ backgroundColor: '#ecb613' }}>
                    <div>
                        <BarChart2 className="w-8 h-8 mb-4 opacity-80" />
                        <h4 className="text-sm font-bold opacity-80 uppercase tracking-wider text-slate-900/80">Avg. Attendance</h4>
                        <p className="text-4xl font-black mt-1 text-slate-900">{avgAttendance}%</p>
                    </div>
                    <div className="pt-4 border-t border-slate-900/20 mt-4 text-left">
                        <p className="text-xs font-semibold italic text-slate-900/80">"Strongest participation on Wednesdays."</p>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* MENTOR NOTE MODAL (SINGLE / BULK)                                   */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {isMentorModalOpen && (
                <div 
                    className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
                    onClick={() => setIsMentorModalOpen(false)}
                >
                    <div 
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative text-left"
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setIsMentorModalOpen(false)}
                            className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
                                <Lightbulb className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                                    {modalTargetStudents.length === 1 ? 'Mentor Guidance' : `Bulk Mentor Note (${modalTargetStudents.length} Students)`}
                                </h3>
                                <p className="text-xs text-slate-400">
                                    {modalTargetStudents.length === 1 
                                        ? `Student: ${modalTargetStudents[0].name}`
                                        : `Applying to ${modalTargetStudents.map(s => s.name.split(' ')[0]).join(', ')}`
                                    }
                                </p>
                            </div>
                        </div>

                        {saveErrorMsg && (
                            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-600 text-xs font-semibold flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <span>{saveErrorMsg}</span>
                            </div>
                        )}

                        {saveSuccessMsg && (
                            <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 text-emerald-600 text-xs font-semibold flex items-center gap-2">
                                <Check className="w-4 h-4 shrink-0" />
                                <span>{saveSuccessMsg}</span>
                            </div>
                        )}

                        {/* Quick-Select Shortcuts */}
                        <div className="mb-4">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">
                                Quick Tips / Templates
                            </span>
                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                                {MENTOR_NOTE_TEMPLATES.map(tpl => (
                                    <button
                                        key={tpl.name}
                                        type="button"
                                        onClick={() => applyTemplate(tpl)}
                                        className="text-[10.5px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-100 hover:text-amber-900 dark:bg-slate-800 dark:hover:bg-amber-950/40 dark:hover:text-amber-300 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                                    >
                                        + {tpl.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <form onSubmit={handleSaveMentorNotes} className="space-y-3.5">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Type
                                    </label>
                                    <select
                                        value={noteType}
                                        onChange={(e) => setNoteType(e.target.value as any)}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-white"
                                    >
                                        <option value="focus">Focus</option>
                                        <option value="practice">Practice</option>
                                        <option value="improvement">Improvement</option>
                                        <option value="strength">Strength</option>
                                        <option value="general">General</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Title
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Focus this week"
                                        value={noteTitle}
                                        onChange={(e) => setNoteTitle(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Guidance / Practice Suggestion *
                                    </label>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                        {noteText.length}/500
                                    </span>
                                </div>
                                <textarea
                                    rows={4}
                                    maxLength={500}
                                    required
                                    placeholder="Write guidance, flute posture feedback, breath control tips, or practice suggestions..."
                                    value={noteText}
                                    onChange={(e) => setNoteText(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-white leading-relaxed"
                                />
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="activeGuidanceCheckbox"
                                    checked={isActiveGuidance}
                                    onChange={(e) => setIsActiveGuidance(e.target.checked)}
                                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                                />
                                <label htmlFor="activeGuidanceCheckbox" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                                    Keep as current active guidance for student dashboard
                                </label>
                            </div>

                            <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsMentorModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={isSavingNote}
                                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-black text-xs transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
                                >
                                    {isSavingNote ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Saving Note...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-3.5 h-3.5" />
                                            <span>{modalTargetStudents.length === 1 ? 'Save Mentor Note' : `Apply to ${modalTargetStudents.length} Students`}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
