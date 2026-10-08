'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
    MessageSquare, Video, Loader2, Send, Share2, Users,
    TrendingUp, Clock, Star, Trash2, UserPlus, Search,
    Calendar, User, Zap, FileText, Copy, ExternalLink, Edit3, Check
} from 'lucide-react';
import { supabaseAuth } from '../../lib/supabase-auth';
import { 
    resolveClassroomMeetingInfo, 
    extractClassroomMetadata, 
    serializeClassroomDescription, 
    isValidMeetingUrl 
} from '../../lib/meeting-utils';
import { sendClassroomNotification } from '../../lib/notifications';

interface EnrolledStudent {
    id: string;
    student_id: string;
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

interface OverviewTabProps {
    isMeetingView: boolean;
    handleSendClassMessage: (e: React.FormEvent) => void;
    messageSubject: string;
    setMessageSubject: (val: string) => void;
    messageContent: string;
    setMessageContent: React.Dispatch<React.SetStateAction<string>>;
    isSendingMessage: boolean;
    classBroadcasts: any[];
    setSelectedAnnouncement: (b: any) => void;
    students: EnrolledStudent[];
    avgAttendance: string;
    schedules: any[];
    getRealStudentProgress: (studentId: string, defaultMockVal: number) => number;
    openDirectoryModal: () => void;
    paginatedStudents: EnrolledStudent[];
    removingStudentId: string | null;
    handleRemoveStudent: (student: EnrolledStudent) => Promise<void>;
    currentPage: number;
    setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
    totalPages: number;
    PAGE_SIZE: number;
    setShowMessageModal: (val: boolean) => void;
    classroomId: string;
    classroom: any;
    DAY_NAMES: string[];
    formatTime12hr: (time: string) => string;
    formatLocalDate: (dateStr: string) => Date;
    announcementSearchQuery: string;
    setAnnouncementSearchQuery: (val: string) => void;
    filteredAnnouncements: any[];
    
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

export default function OverviewTab({
    isMeetingView,
    handleSendClassMessage,
    messageSubject,
    setMessageSubject,
    messageContent,
    setMessageContent,
    isSendingMessage,
    classBroadcasts,
    setSelectedAnnouncement,
    students,
    avgAttendance,
    schedules,
    getRealStudentProgress,
    openDirectoryModal,
    paginatedStudents,
    removingStudentId,
    handleRemoveStudent,
    currentPage,
    setCurrentPage,
    totalPages,
    PAGE_SIZE,
    setShowMessageModal,
    classroomId,
    classroom,
    DAY_NAMES,
    formatTime12hr,
    formatLocalDate,
    announcementSearchQuery,
    setAnnouncementSearchQuery,
    filteredAnnouncements,
    
    // New Destructuring
    classroomInventoryAllocations,
    courseModules,
    courseChapters,
    courseLessons,
    classroomAttendance,
    classroomAssignmentsStudents,
    assignments,
    studentProgress
}: OverviewTabProps) {
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
        const classAssignments = assignments.filter(asg => asg.classroom_id === classroomId);
        
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

    // Need studentProgress reference for getStudentProficiencyProgress
    // Passed directly as prop from page.tsx

    const getStatusColor = (status: string) => {
        if (status === 'Consistent') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
        if (status === 'Improving') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
        return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
    };

    // Note Form States
    const [noteTitle, setNoteTitle] = useState('');
    const [noteContent, setNoteContent] = useState('');
    const [noteColor, setNoteColor] = useState('yellow');
    const [isSavingNote, setIsSavingNote] = useState(false);
    const [noteSuccess, setNoteSuccess] = useState(false);

    const handleSendClassNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!noteTitle.trim()) return;
        setIsSavingNote(true);
        setNoteSuccess(false);
        try {
            const { data: { session } } = await supabaseAuth.auth.getSession();
            const teacherId = session?.user?.id;
            if (!teacherId) throw new Error('No instructor session found.');

            const { error } = await supabaseAuth
                .from('class_notes')
                .insert([{
                    classroom_id: classroomId,
                    teacher_id: teacherId,
                    title: noteTitle.trim(),
                    content: noteContent.trim() || null,
                    color: noteColor
                }]);

            if (error) throw error;

            setNoteTitle('');
            setNoteContent('');
            setNoteSuccess(true);
            setTimeout(() => setNoteSuccess(false), 3000);
        } catch (err) {
            console.error('Error creating class note during session:', err);
            alert('Failed to save class note. Please try again.');
        } finally {
            setIsSavingNote(false);
        }
    };

    const handleSendMessageFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        handleSendClassMessage(e);
    };

    // Meeting Details Section State for Teacher
    const meetingInfo = resolveClassroomMeetingInfo(classroom);
    const [isEditingMeetingLink, setIsEditingMeetingLink] = useState(false);
    const [editLinkValue, setEditLinkValue] = useState('');
    const [isSavingLink, setIsSavingLink] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);
    const [linkActionMsg, setLinkActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleCopyMeetingLink = (url: string) => {
        if (typeof navigator !== 'undefined') {
            navigator.clipboard.writeText(url);
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2000);
        }
    };

    const handleSaveMeetingLink = async (newUrl: string | null) => {
        if (newUrl && !isValidMeetingUrl(newUrl)) {
            setLinkActionMsg({ type: 'error', text: 'Please enter a valid URL starting with http:// or https://' });
            return;
        }
        setIsSavingLink(true);
        setLinkActionMsg(null);
        try {
            // If the class is actively live, update live_meeting_link
            // Also update reusable meeting link in description so future sessions and refreshes retain it
            const currentMeta = extractClassroomMetadata(classroom?.description);
            const updatedDesc = serializeClassroomDescription(
                currentMeta.cleanDescription,
                currentMeta.deliveryFormat,
                newUrl || null
            );

            const updatePayload: any = { description: updatedDesc };
            if (classroom?.is_live) {
                updatePayload.live_meeting_link = newUrl || null;
            }

            const { error } = await supabaseAuth
                .from('classrooms')
                .update(updatePayload)
                .eq('id', classroomId);

            if (error) throw error;

            // Update local classroom object
            if (classroom) {
                classroom.description = updatedDesc;
                if (classroom.is_live) {
                    classroom.live_meeting_link = newUrl || null;
                }
            }

            setIsEditingMeetingLink(false);
            setLinkActionMsg({ type: 'success', text: newUrl ? 'Meeting link saved successfully!' : 'Meeting link removed.' });
            setTimeout(() => setLinkActionMsg(null), 3000);
        } catch (err: any) {
            console.error('Failed to update meeting link:', err);
            setLinkActionMsg({ type: 'error', text: err.message || 'Failed to update meeting link.' });
        } finally {
            setIsSavingLink(false);
        }
    };

    const handleShareMeetingLink = async (url: string) => {
        const studentIds = students.map(s => s.student_id);
        if (studentIds.length === 0) {
            setLinkActionMsg({ type: 'error', text: 'No enrolled students to notify.' });
            return;
        }
        setIsSavingLink(true);
        try {
            await sendClassroomNotification({
                teacherId: classroom?.teacher_id,
                recipients: [{ id: classroomId, name: classroom?.name || 'Classroom', type: 'class' }],
                title: `Meeting Link Available: ${classroom?.name || 'Classroom'}`,
                message: `The meeting link for "${classroom?.name || 'your class'}" has been updated. Open your classroom portal to view details and join.`,
                studentIds,
                type: 'live_class'
            });
            setLinkActionMsg({ type: 'success', text: 'Meeting link shared with enrolled students!' });
            setTimeout(() => setLinkActionMsg(null), 3000);
        } catch (err: any) {
            console.error('Failed to share meeting link notification:', err);
            setLinkActionMsg({ type: 'error', text: 'Failed to broadcast notification.' });
        } finally {
            setIsSavingLink(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 text-left">
            {!isMeetingView && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
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
                            <p className="text-xs font-bold text-slate-505 dark:text-slate-400">Average Attendance</p>
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
                            <p className="text-xs font-bold text-slate-505 dark:text-slate-400">Weekly Sessions</p>
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
                    {isMeetingView && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 hover:shadow-md transition-shadow text-left">
                        <form onSubmit={handleSendMessageFormSubmit} className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-extrabold text-slate-900 dark:text-white text-md flex items-center gap-2">
                                    <MessageSquare className="text-[#ecb613] size-4" />
                                    Send Message to Class
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const linkToShare = meetingInfo.effectiveMeetingLink;
                                        const meetText = linkToShare
                                            ? `Join class session online in your student portal, or via: ${linkToShare}`
                                            : `Please check your classroom Meeting Details section to join the session.`;
                                        setMessageContent(prev => prev ? `${prev}\n\n${meetText}` : meetText);
                                    }}
                                    className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 hover:scale-[1.02] border border-blue-200/50 dark:border-blue-900/30 cursor-pointer"
                                >
                                    <Video size={12} /> 🔗 Share Meet Link
                                </button>
                            </div>

                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-slate-555 uppercase tracking-wide">Subject</label>
                                <input
                                    type="text"
                                    value={messageSubject}
                                    onChange={(e) => setMessageSubject(e.target.value)}
                                    placeholder="e.g. Google Meet URL - Session started"
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#ecb613] outline-none placeholder:text-slate-405 text-slate-800 dark:text-slate-105"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-slate-555 uppercase tracking-wide">Message Text</label>
                                <textarea
                                    rows={4}
                                    value={messageContent}
                                    onChange={(e) => setMessageContent(e.target.value)}
                                    placeholder="Type announcement message..."
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-[#ecb613] outline-none text-slate-800 dark:text-slate-100 font-semibold"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSendingMessage || !messageContent.trim()}
                                className="w-full py-3 bg-[#ecb613] hover:bg-amber-600 text-slate-900 font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md disabled:opacity-50 cursor-pointer"
                            >
                                {isSendingMessage ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        Broadcast Message to Class
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                    )}
                    {/* Progress Summary Card */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Individual Progress Summary</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-405 mt-1">Milestone tracking for the current week</p>
                            </div>
                        </div>
                        <div className="space-y-6">
                            {students.slice(0, 4).map(student => (
                                <div key={student.id} className="flex items-center gap-4 group">
                                    <div className="relative shrink-0 select-none">
                                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700">
                                            {student.profile_pic_url ? (
                                                <img alt={student.name} className="w-full h-full object-cover" src={student.profile_pic_url} loading="lazy" />
                                            ) : (
                                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{student.name.charAt(0)}</span>
                                            )}
                                        </div>
                                        {student.is_online && (
                                            <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
                                        )}
                                    </div>
                                    {(() => {
                                        const realProgress = getRealStudentProgress(student.student_id, 0);
                                        const submission = getStudentSubmissionRate(student.student_id, student.level || 'Level 1', student.mock_submission);
                                        const attendance = getStudentAttendanceRate(student.student_id, student.mock_attendance);
                                        const score = getStudentAvgScore(student.student_id, student.mock_score);
                                        
                                        // Status is calculated logically based on academic metrics
                                        let calculatedStatus: 'Consistent' | 'Improving' | 'At Risk' = 'Consistent';
                                        
                                        const hasLowAttendance = attendance !== null && attendance < 75;
                                        const hasLowSubmissions = submission !== null && submission < 60;
                                        const hasLowScore = score !== null && score < 5.0;

                                        const isBorderlineAttendance = attendance !== null && attendance >= 75 && attendance < 85;
                                        const isBorderlineSubmissions = submission !== null && submission >= 60 && submission < 75;
                                        const isBorderlineScore = score !== null && score >= 5.0 && score < 7.0;

                                        if (hasLowAttendance || hasLowSubmissions || hasLowScore) {
                                            calculatedStatus = 'At Risk';
                                        } else if (isBorderlineAttendance || isBorderlineSubmissions || isBorderlineScore) {
                                            calculatedStatus = 'Improving';
                                        } else {
                                            calculatedStatus = 'Consistent';
                                        }
                                        
                                        return (
                                            <>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between mb-1.5 gap-2 items-center">
                                                        <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#ecb613] transition-colors truncate">{student.name}</span>
                                                        <span className="text-[10px] font-black tracking-wider uppercase text-amber-600 dark:text-[#ecb613] bg-amber-500/10 dark:bg-[#ecb613]/10 px-2 py-0.5 rounded-lg font-mono shrink-0">
                                                            {student.level}
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                                        <div className={`h-full transition-all duration-500 ${
                                                            calculatedStatus === 'Consistent' 
                                                                ? 'bg-emerald-500' 
                                                                : (calculatedStatus === 'Improving' ? 'bg-[#ecb613]' : 'bg-rose-500')
                                                        }`} style={{ width: `${realProgress}%` }}></div>
                                                    </div>
                                                </div>
                                                <span className="text-xs font-bold text-slate-400 w-8 text-right shrink-0">{realProgress}%</span>
                                            </>
                                        );
                                    })()}
                                </div>
                            ))}
                            {students.length === 0 && (
                                <div className="py-8 text-center bg-slate-50 dark:bg-slate-805/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                    <p className="text-slate-500 text-sm font-medium">No students enrolled yet.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Student Roster Table */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center flex-wrap gap-4">
                            <h3 className="admin-section-title">Student Roster</h3>
                            <div className="flex gap-3">
                                <button 
                                    onClick={openDirectoryModal}
                                    className="admin-btn admin-btn-primary admin-btn-sm"
                                    title="Add Student from Directory"
                                >
                                    <UserPlus className="w-3.5 h-3.5 shrink-0" />
                                    <span className="hidden sm:inline">Add from Directory</span>
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-455 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                    <tr>
                                        <th className="px-6 py-4">Student Name</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Proficiency Progress</th>
                                        <th className="px-6 py-4">Task Submission</th>
                                        <th className="px-6 py-4">Attendance</th>
                                        <th className="px-6 py-4">Avg. Score</th>
                                        <th className="px-6 py-4">Joined Date</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {paginatedStudents.map(student => {
                                        const realProgress = getRealStudentProgress(student.student_id, 0);
                                        const submission = getStudentSubmissionRate(student.student_id, student.level || 'Level 1', student.mock_submission);
                                        const attendance = getStudentAttendanceRate(student.student_id, student.mock_attendance);
                                        const score = getStudentAvgScore(student.student_id, student.mock_score);

                                        // Status is calculated logically based on academic metrics
                                        let calculatedStatus: 'Consistent' | 'Improving' | 'At Risk' = 'Consistent';
                                        
                                        const hasLowAttendance = attendance !== null && attendance < 75;
                                        const hasLowSubmissions = submission !== null && submission < 60;
                                        const hasLowScore = score !== null && score < 5.0;

                                        const isBorderlineAttendance = attendance !== null && attendance >= 75 && attendance < 85;
                                        const isBorderlineSubmissions = submission !== null && submission >= 60 && submission < 75;
                                        const isBorderlineScore = score !== null && score >= 5.0 && score < 7.0;

                                        if (hasLowAttendance || hasLowSubmissions || hasLowScore) {
                                            calculatedStatus = 'At Risk';
                                        } else if (isBorderlineAttendance || isBorderlineSubmissions || isBorderlineScore) {
                                            calculatedStatus = 'Improving';
                                        } else {
                                            calculatedStatus = 'Consistent';
                                        }

                                        return (
                                            <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-600 shrink-0">
                                                            {student.profile_pic_url ? (
                                                                <img alt={student.name} className="w-full h-full object-cover" src={student.profile_pic_url} loading="lazy" />
                                                            ) : (
                                                                <span className="text-xs font-bold text-slate-505 dark:text-slate-400">{student.name.charAt(0)}</span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <Link href={`/teacher-dashboard/students/${student.student_id}`} className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#ecb613] transition-colors">{student.name}</Link>
                                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">ID: {student.student_id.substring(0, 8)}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wide inline-block border ${getStatusColor(calculatedStatus)} border-transparent dark:border-current/20`}>
                                                        {calculatedStatus}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="w-24">
                                                        <div className="flex justify-between mb-1">
                                                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{realProgress}%</span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1 flex overflow-hidden">
                                                            <div className="h-1 rounded-full bg-[#ecb613]" style={{ width: `${realProgress}%` }}></div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm font-bold text-slate-600 dark:text-slate-300">
                                                    {submission ?? 0}%
                                                </td>
                                                <td className="px-6 py-4 text-sm font-bold text-slate-600 dark:text-slate-300">
                                                    {attendance ?? 0}%
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-sm font-bold text-slate-900 dark:text-white">{(score ?? 0).toFixed(1)}</span>
                                                        <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-xs font-semibold text-slate-505 dark:text-slate-400">
                                                    {new Date(student.joined_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => handleRemoveStudent(student)}
                                                        disabled={removingStudentId === student.id}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg transition-all disabled:opacity-50 cursor-pointer"
                                                        title="Remove from this classroom"
                                                    >
                                                        {removingStudentId === student.id
                                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            : <Trash2 className="w-3.5 h-3.5" />}
                                                        Remove
                                                    </button>
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
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#ecb613] text-slate-900 rounded-xl text-xs font-bold hover:bg-[#ecb613]/90 transition-colors shadow-sm cursor-pointer"
                                                >
                                                    <UserPlus className="w-4 h-4" /> Add from Directory
                                                </button>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-205 dark:border-slate-800 flex justify-between items-center rounded-b-2xl">
                            <span className="text-[10px] font-black text-slate-455 dark:text-slate-400 uppercase tracking-widest">
                                Showing {paginatedStudents.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0} - {Math.min(currentPage * PAGE_SIZE, students.length)} of {students.length} students
                            </span>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer animate-in fade-in"
                                >
                                    Previous
                                </button>
                                <button 
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    className="px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer animate-in fade-in"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Quick Actions, Schedules, and Announcements */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                    {/* ── Meeting Details Section ── */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-left space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                    <Video className="w-4 h-4" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Meeting Details</h4>
                                    <span className="text-[10px] font-mono font-bold text-slate-400 block">
                                        {meetingInfo.deliveryFormat === 'online' ? 'Online Classroom' : 'In-Person (Offline)'}
                                    </span>
                                </div>
                            </div>
                            {meetingInfo.deliveryFormat === 'online' && !isEditingMeetingLink && (
                                <button
                                    onClick={() => {
                                        setEditLinkValue(meetingInfo.effectiveMeetingLink || '');
                                        setIsEditingMeetingLink(true);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                    title="Edit meeting link"
                                >
                                    <Edit3 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {linkActionMsg && (
                            <div className={`text-xs px-3 py-2 rounded-xl font-medium animate-in fade-in duration-200 ${
                                linkActionMsg.type === 'success'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50'
                                    : 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-200/50'
                            }`}>
                                {linkActionMsg.text}
                            </div>
                        )}

                        {meetingInfo.deliveryFormat === 'offline' ? (
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    This is an in-person offline class. Instructions and attendance are conducted physically at the academy.
                                </p>
                            </div>
                        ) : isEditingMeetingLink ? (
                            <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                        Meeting URL
                                    </label>
                                    <input
                                        type="url"
                                        value={editLinkValue}
                                        onChange={e => setEditLinkValue(e.target.value)}
                                        placeholder="https://meet.google.com/..."
                                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#ecb613] outline-none font-mono text-slate-800 dark:text-slate-100"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        disabled={isSavingLink}
                                        onClick={() => handleSaveMeetingLink(editLinkValue.trim() || null)}
                                        className="flex-1 py-2 bg-[#ecb613] hover:bg-amber-600 text-slate-900 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                                    >
                                        {isSavingLink ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Link'}
                                    </button>
                                    {meetingInfo.effectiveMeetingLink && (
                                        <button
                                            type="button"
                                            disabled={isSavingLink}
                                            onClick={() => {
                                                if (window.confirm('Are you sure you want to remove the saved meeting link for this classroom?')) {
                                                    handleSaveMeetingLink(null);
                                                }
                                            }}
                                            className="px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-400 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                            title="Remove link"
                                        >
                                            Remove
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        disabled={isSavingLink}
                                        onClick={() => setIsEditingMeetingLink(false)}
                                        className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : meetingInfo.effectiveMeetingLink ? (
                            <div className="space-y-3">
                                <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 font-mono">
                                            Platform: {meetingInfo.platform}
                                        </span>
                                        {classroom?.is_live && (
                                            <span className="text-[9px] font-mono font-extrabold uppercase bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                                                Active Live
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-700 dark:text-slate-300 font-mono break-all truncate">
                                        {meetingInfo.effectiveMeetingLink}
                                    </p>
                                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                        <span>Type: {meetingInfo.sessionMeetingLink ? 'Session-specific override' : 'Reusable class link'}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleCopyMeetingLink(meetingInfo.effectiveMeetingLink!)}
                                        className="py-2 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                                        title="Copy meeting link"
                                    >
                                        {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                        <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                                    </button>

                                    <a
                                        href={meetingInfo.effectiveMeetingLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="py-2 px-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all text-center"
                                        title="Open meeting"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        <span>Join</span>
                                    </a>

                                    <button
                                        type="button"
                                        disabled={isSavingLink}
                                        onClick={() => handleShareMeetingLink(meetingInfo.effectiveMeetingLink!)}
                                        className="py-2 px-2 bg-[#ecb613]/15 hover:bg-[#ecb613]/30 text-amber-800 dark:text-[#ecb613] rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                                        title="Share with enrolled students"
                                    >
                                        <Share2 className="w-3.5 h-3.5" />
                                        <span>Share</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-2">
                                <p className="text-xs text-slate-400">No meeting link saved for this classroom yet.</p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditLinkValue('');
                                        setIsEditingMeetingLink(true);
                                    }}
                                    className="px-3 py-1.5 bg-[#ecb613] hover:bg-amber-600 text-slate-900 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                                >
                                    <Video className="w-3.5 h-3.5" /> Add Meeting Link
                                </button>
                            </div>
                        )}
                    </div>

                    {!isMeetingView && (
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Quick Actions</h4>
                                <Zap className="w-5 h-5 text-amber-500 fill-amber-500 animate-pulse" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => setShowMessageModal(true)}
                                    className="p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-[#ecb613]/10 rounded-xl text-center transition-all group border border-slate-205 dark:border-slate-700 hover:border-[#ecb613]/30 flex flex-col items-center justify-center cursor-pointer"
                                >
                                    <MessageSquare className="w-6 h-6 text-[#ecb613] mb-2 group-hover:scale-110 transition-transform" />
                                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white uppercase tracking-wide">Message All</span>
                                </button>
                                <Link 
                                    href={`/teacher-dashboard/classrooms/${classroomId}/meeting`}
                                    className="p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-[#ecb613]/10 rounded-xl text-center transition-all group border border-slate-205 dark:border-slate-700 hover:border-[#ecb613]/30 flex flex-col items-center justify-center"
                                >
                                    <Video className="w-6 h-6 text-[#ecb613] mb-2 group-hover:scale-110 transition-transform" />
                                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white uppercase tracking-wide">Start Session</span>
                                </Link>
                            </div>
                        </div>
                    )}

                    {classroom?.teacher_name && (
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Class Instructor</h4>
                                <User className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div className="flex items-center gap-3 bg-emerald-50/50 dark:bg-emerald-950/10 p-3 rounded-xl border border-emerald-200/50 dark:border-emerald-900/30">
                                <div className="w-8 h-8 rounded-full bg-[#ecb613]/15 flex items-center justify-center font-bold text-[#ecb613] text-xs shrink-0 select-none">
                                    {classroom.teacher_name.charAt(0)}
                                </div>
                                <div className="flex flex-col text-left">
                                    <span className="text-xs font-bold text-slate-905 dark:text-white">
                                        {classroom.teacher_name}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                                        Primary Teacher
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Class Schedule</h4>
                            <Clock className="w-5 h-5 text-[#ecb613]" />
                        </div>
                        <div className="space-y-3">
                            {classroom?.type === 'temporary' ? (
                                classroom.class_date ? (
                                    <div className="flex justify-between items-center bg-amber-50/50 dark:bg-amber-955/10 p-3 rounded-xl border border-amber-200/50 dark:border-amber-900/30">
                                        <div className="flex flex-col text-left">
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                {formatLocalDate(classroom.class_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                            {classroom.start_time && (
                                                <span className="text-[10px] text-slate-455 dark:text-slate-400 font-medium mt-0.5">
                                                    {formatTime12hr(classroom.start_time.slice(0,5))} – {formatTime12hr(classroom.end_time?.slice(0,5) || '')}
                                                </span>
                                            )}
                                        </div>
                                        <Calendar className="w-4 h-4 text-amber-550 shrink-0" />
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-455 italic">No schedule set</p>
                                )
                            ) : schedules.length === 0 ? (
                                <p className="text-xs text-slate-455 italic">No schedule set</p>
                            ) : (
                                schedules.slice(0, 3).map(slot => (
                                    <div key={slot.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{DAY_NAMES[slot.day_of_week]}</span>
                                        <span className="text-xs font-medium text-[#ecb613]">{formatTime12hr(slot.start_time)} - {formatTime12hr(slot.end_time)}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
