'use client';

import React, { useMemo } from 'react';
import {
    Users, PlayCircle, BookOpen, Clock, Award, Calendar,
    ClipboardList, HelpCircle, CheckCircle, ChevronRight, X, Play, Music, Info, FileText, Video,
    AlertTriangle, AlertCircle, TrendingUp, Star
} from 'lucide-react';

import { getStudentFeeStatus } from '../../lib/fee-utils';
import { stripHtml } from '../../lib/text-utils';

interface StudentProfile {
    id: string;
    name: string;
    email: string;
    level?: string;
    profile_pic_url?: string;
    role?: string;
    teacher_id?: string | null;
    fees_basis?: 'monthly' | 'class' | null;
    fees_amount?: number | null;
    fees_classes_paid?: number | null;
    fees_collection_date?: number | null;
    status?: string;
}

interface ClassroomInfo {
    id: string;
    name: string;
    type?: string;
    teacher_id?: string;
    teacher_name?: string;
    teacher_email?: string;
    description?: string;
    is_live?: boolean;
    live_meeting_link?: string | null;
    live_session_started_at?: string | null;
}

interface EnrichedAssignment {
    id: string;
    title: string;
    description?: string;
    due_date?: string;
    file_url?: string | null;
    file_name?: string | null;
    file_size?: number | null;
    status: 'pending' | 'submitted' | 'reviewed' | 'approved';
    score?: number | null;
    proficiency_level?: string | null;
    feedback_text?: string | null;
    video_url?: string | null;
    submitted_at?: string | null;
}

interface Broadcast {
    id: string;
    channel: string;
    subject: string;
    content: string;
    audio_attachment?: string | null;
    created_at: string;
    sender?: {
        name: string;
        role: string;
    } | null;
}

interface Classmate {
    id: string;
    name: string;
    level: string;
    profile_pic_url: string | null;
}

interface OverviewTabProps {
    profile: StudentProfile | null;
    payments: any[];
    classroom: ClassroomInfo | null;
    assignments: EnrichedAssignment[];
    broadcasts: Broadcast[];
    unreadAdminBroadcasts: any[];
    setActiveTab: (tab: 'overview' | 'classroom' | 'curriculum' | 'tasks' | 'messages' | 'attendance' | 'library' | 'fees' | 'policies' | 'settings' | 'mentor_hub') => void;
    onNavigateToFeed?: (feed: { type: 'category' | 'chat'; id: string; name: string }) => void;
    handleDismissAdminBroadcast: (id: string) => void;
    levelLabel: string;
    attendancePct: number | null;
    attendanceStats: { present: number; absent: number; late: number; excused: number; total: number };
    featuredLesson: any | null;
    setSelectedTopic: (topic: any) => void;
    setShowMaterialPopup: (show: boolean) => void;
    setPracticeSuiteTab: (tab: 'metronome' | 'tanpura' | 'drums' | 'combosetup') => void;
    setShowPracticeSuite: (show: boolean) => void;
    classmates: Classmate[];
    studentAllocations: any[];
    studentProgress: any[];
    courseLessons: any[];
    courseChapters: any[];
    courseModules: any[];
    attendance: any[];
    batchSchedules?: any[];
    makeupSchedules?: any[];
    learningFocus?: any | null;
    studentSpotlights?: { teacherSpotlight: any | null; studentSpotlight: any | null };
    onToggleStudentSpotlight?: (lessonId: string) => Promise<void> | void;
}

const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    if (isNaN(h)) return timeStr;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
};

const getLocalYYYYMMDD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * OverviewTab component renders the primary dashboard overview for student portals.
 * Features a dedicated mobile-first hierarchy on mobile screens while preserving the desktop layout 100%.
 */
export default function OverviewTab({
    profile,
    payments,
    classroom,
    assignments,
    broadcasts,
    unreadAdminBroadcasts,
    setActiveTab,
    onNavigateToFeed,
    handleDismissAdminBroadcast,
    levelLabel,
    attendancePct,
    attendanceStats,
    featuredLesson,
    setSelectedTopic,
    setShowMaterialPopup,
    setPracticeSuiteTab,
    setShowPracticeSuite,
    classmates,
    studentAllocations,
    studentProgress,
    courseLessons,
    courseChapters,
    courseModules,
    attendance,
    batchSchedules = [],
    makeupSchedules = [],
    learningFocus,
    studentSpotlights,
    onToggleStudentSpotlight
}: OverviewTabProps) {
    const dashboardBroadcasts = useMemo(() => {
        return broadcasts.filter(b =>
            b.channel === 'announcements' ||
            b.channel === 'fee_management' ||
            (!b.channel && b.sender?.role === 'admin')
        );
    }, [broadcasts]);

    const proficiencyProgress = useMemo(() => {
        const allocatedModuleIds = new Set(studentAllocations.map(a => a.module_id).filter(Boolean));
        const allocatedChapterIds = new Set([
            ...studentAllocations.map(a => a.chapter_id).filter(Boolean),
            ...courseChapters.filter(c => allocatedModuleIds.has(c.module_id)).map(c => c.id)
        ]);
        const allocatedLessonIds = new Set([
            ...studentAllocations.map(a => a.lesson_id).filter(Boolean),
            ...courseLessons.filter(l => allocatedChapterIds.has(l.chapter_id)).map(l => l.id),
            ...studentProgress.map(p => p.lesson_id)
        ]);
        const allocatedLessonsList = courseLessons.filter(l => allocatedLessonIds.has(l.id));

        const unlockedLessonsList = allocatedLessonsList.filter(lesson => {
            const prog = studentProgress.find(p => p.lesson_id === lesson.id);
            return prog && prog.status !== 'locked';
        });

        if (unlockedLessonsList.length === 0) return 0;
        const completedCount = unlockedLessonsList.filter(lesson => {
            const prog = studentProgress.find(p => p.lesson_id === lesson.id);
            return prog && prog.status === 'completed';
        }).length;
        return Math.round((completedCount / unlockedLessonsList.length) * 100);
    }, [studentAllocations, courseLessons, courseChapters, studentProgress]);

    const taskSubmissionRate = useMemo(() => {
        const currentLevel = profile?.level || 'Level 1';
        const studentTasks = assignments.filter(asg => {
            let asgLevel = null;
            if (asg.proficiency_level) {
                asgLevel = asg.proficiency_level;
            } else {
                const mod = courseModules.find(m => m.title?.toLowerCase() === currentLevel.toLowerCase());
                asgLevel = mod?.title;
            }
            if (asgLevel) {
                return asgLevel.toLowerCase() === currentLevel.toLowerCase();
            }
            return true;
        });

        if (studentTasks.length === 0) return null;
        const submittedCount = studentTasks.filter(asg =>
            asg.status === 'submitted' || asg.status === 'reviewed' || asg.status === 'approved'
        ).length;
        return Math.round((submittedCount / studentTasks.length) * 100);
    }, [assignments, profile, courseModules]);

    const attendanceRate = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        const currentMonthAttendance = attendance.filter(att => {
            if (!att.date) return false;
            const d = new Date(att.date);
            return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        });

        if (currentMonthAttendance.length === 0) {
            const allTimePresent = attendance.filter(att =>
                att.status === 'present' || att.status === 'late'
            ).length;
            return attendance.length > 0 ? Math.round((allTimePresent / attendance.length) * 100) : null;
        }

        const joinedCount = currentMonthAttendance.filter(att =>
            att.status === 'present' || att.status === 'late'
        ).length;
        return Math.round((joinedCount / currentMonthAttendance.length) * 100);
    }, [attendance]);

    const avgScore = useMemo(() => {
        const graded = assignments.filter(asg => asg.score !== null && asg.score !== undefined);
        if (graded.length === 0) return null;
        const sum = graded.reduce((acc, curr) => acc + (curr.score || 0), 0);
        return parseFloat((sum / graded.length).toFixed(1));
    }, [assignments]);

    const overallProgress = useMemo(() => {
        const calcValues = [proficiencyProgress];
        if (taskSubmissionRate !== null) calcValues.push(taskSubmissionRate);
        if (attendanceRate !== null) calcValues.push(attendanceRate);
        if (avgScore !== null) calcValues.push(avgScore * 10);
        
        return Math.round(calcValues.reduce((a, b) => a + b, 0) / calcValues.length);
    }, [proficiencyProgress, taskSubmissionRate, attendanceRate, avgScore]);

    // Next Class computation for Mobile Dashboard
    const nextClass = useMemo(() => {
        if (!classroom && (!makeupSchedules || makeupSchedules.length === 0)) return null;

        const getSchedulesForDate = (date: Date) => {
            const dateStr = getLocalYYYYMMDD(date);
            const dayOfWeek = date.getDay();
            const dayClasses: any[] = [];

            // 1. Check matching temporary classes (overrides)
            const makeups = (makeupSchedules || []).filter(o => o.override_date === dateStr);
            makeups.forEach(m => {
                dayClasses.push({
                    type: 'temporary',
                    title: m.title || 'Temporary Class',
                    start_time: m.start_time,
                    end_time: m.end_time,
                    reason: m.reason,
                    date: new Date(date)
                });
            });

            // 2. Check matching recurring batch schedules (if no overrides for this day)
            if (makeups.length === 0) {
                const regulars = (batchSchedules || []).filter(s => s.day_of_week === dayOfWeek);
                regulars.forEach(r => {
                    dayClasses.push({
                        type: 'permanent',
                        title: classroom?.name || 'Regular Class',
                        start_time: r.start_time,
                        end_time: r.end_time,
                        date: new Date(date)
                    });
                });
            }

            return dayClasses;
        };

        const now = new Date();
        for (let i = 0; i <= 7; i++) {
            const d = new Date();
            d.setDate(now.getDate() + i);
            const classes = getSchedulesForDate(d);
            if (classes.length > 0) {
                const first = classes[0];
                const isToday = i === 0;
                const isTomorrow = i === 1;
                const formattedDate = isToday
                    ? 'Today'
                    : isTomorrow
                        ? 'Tomorrow'
                        : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                return {
                    ...first,
                    formattedDate,
                    isToday,
                    isTomorrow
                };
            }
        }
        return null;
    }, [classroom, batchSchedules, makeupSchedules]);

    // Pending and Overdue tasks
    const pendingTasks = useMemo(() => assignments.filter(a => a.status === 'pending'), [assignments]);
    const overdueTasks = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return pendingTasks.filter(a => a.due_date && new Date(a.due_date) < now);
    }, [pendingTasks]);

    // Tasks Due Soon (due today, tomorrow, or in 2 days)
    const dueSoonTasks = useMemo(() => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        return pendingTasks.filter(a => {
            if (!a.due_date) return false;
            const dueDateObj = new Date(a.due_date);
            const dueStart = new Date(dueDateObj.getFullYear(), dueDateObj.getMonth(), dueDateObj.getDate()).getTime();
            const diffDays = Math.round((dueStart - todayStart) / (1000 * 60 * 60 * 24));
            return diffDays >= 0 && diffDays <= 2;
        });
    }, [pendingTasks]);

    const getDueSoonText = (dueDateStr?: string) => {
        if (!dueDateStr) return '';
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const dueDateObj = new Date(dueDateStr);
        const dueStart = new Date(dueDateObj.getFullYear(), dueDateObj.getMonth(), dueDateObj.getDate()).getTime();
        const diffDays = Math.round((dueStart - todayStart) / (1000 * 60 * 60 * 24));
        const formattedDate = dueDateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const dayLabel = diffDays === 0 ? 'Due Today' : diffDays === 1 ? 'Due Tomorrow' : `Due in ${diffDays} Days`;
        return `${dayLabel} — ${formattedDate}`;
    };

    const latestAnnouncement = dashboardBroadcasts[0] || null;

    return (
        <div className="animate-in fade-in duration-300">
            {/* ========================================================================= */}
            {/* MOBILE-FIRST DASHBOARD VIEW (< 1024px)                                    */}
            {/* ========================================================================= */}
            <div className="lg:hidden space-y-4 text-left">
                {/* 1. Mobile Welcome Card */}
                <div
                    className="bg-cover bg-center rounded-2xl relative p-4 text-white shadow-xs overflow-hidden border border-[#E6E1DA]"
                    style={{ backgroundImage: "url('/flutes_custom.jpg')" }}
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-[#2B1B0E]/95 via-[#2B1B0E]/88 to-[#2B1B0E]/70 pointer-events-none" />
                    <div className="relative z-10 space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                                Flute Academy
                            </span>
                            <span className="text-[9px] font-extrabold text-amber-200">
                                {levelLabel}
                            </span>
                        </div>
                        <h1 className="text-base sm:text-lg font-black text-white leading-tight pt-0.5">
                            Namaste, {profile?.name?.split(' ')[0]}! 👋
                        </h1>
                        <p className="text-[10px] text-slate-300 truncate">
                            {classroom ? `${classroom.name}${classroom.teacher_name ? ` • ${classroom.teacher_name}` : ''}` : 'Begin your daily practice session'}
                        </p>
                    </div>
                </div>

                {/* 2. Next Class Card (Primary Information) */}
                <div className="bg-white border border-[#E6E1DA] rounded-2xl p-3.5 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                        <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${classroom?.is_live ? 'bg-red-500 animate-ping' : 'bg-amber-500'}`} />
                            <span className="text-[9px] font-black text-amber-800 uppercase tracking-widest font-mono">
                                {classroom?.is_live ? 'Live Session Now' : 'Next Class'}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setActiveTab('classroom')}
                            className="text-[10px] font-bold text-[#7C5E3F] hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                            <span>Timetable</span>
                            <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>

                    {classroom?.is_live ? (
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <span className="text-[8px] font-black uppercase tracking-wider bg-red-600 text-white px-2 py-0.5 rounded-md animate-pulse">
                                    ● Live Now
                                </span>
                                <h4 className="font-extrabold text-xs text-slate-900 mt-1 truncate">{classroom.name}</h4>
                                <p className="text-[10px] text-slate-500">Instructor: {classroom.teacher_name}</p>
                            </div>
                            {classroom.live_meeting_link && (
                                <a
                                    href={classroom.live_meeting_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black rounded-xl shadow-xs shrink-0 flex items-center gap-1 cursor-pointer"
                                >
                                    <PlayCircle className="w-3.5 h-3.5" />
                                    <span>Join</span>
                                </a>
                            )}
                        </div>
                    ) : nextClass ? (
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs">{nextClass.type === 'temporary' ? '⚡' : '🏫'}</span>
                                    <h4 className="font-extrabold text-xs text-slate-900 truncate">{nextClass.title}</h4>
                                </div>
                                <p className="text-[11px] font-black text-amber-700 mt-0.5">
                                    {nextClass.formattedDate} • {formatTime(nextClass.start_time)}{nextClass.end_time ? ` – ${formatTime(nextClass.end_time)}` : ''}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setActiveTab('classroom')}
                                className="px-3 py-1.5 bg-[#FAF5EE] hover:bg-[#F2E8DC] text-[#7C5E3F] text-[10px] font-black rounded-lg border border-[#7C5E3F]/20 shrink-0 cursor-pointer"
                            >
                                View
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between gap-3 text-slate-500">
                            <p className="text-[10px] sm:text-[11px]">No classes scheduled for the next 7 days.</p>
                            <button
                                type="button"
                                onClick={() => setActiveTab('classroom')}
                                className="text-[10px] font-bold text-[#7C5E3F] underline shrink-0 cursor-pointer"
                            >
                                View Schedule
                            </button>
                        </div>
                    )}
                </div>

                {/* Task Due Soon Highlight Card (Mobile) */}
                {dueSoonTasks.length > 0 && (
                    <div className="bg-gradient-to-r from-amber-500/15 to-orange-500/10 border border-amber-500/30 rounded-2xl p-3.5 shadow-xs text-left animate-in fade-in duration-200">
                        <div className="flex items-center justify-between border-b border-amber-500/20 pb-2 mb-2">
                            <div className="flex items-center gap-1.5">
                                <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                </span>
                                <span className="text-[9px] font-black text-amber-900 uppercase tracking-widest font-mono">
                                    Task Due Soon ({dueSoonTasks.length})
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setActiveTab('tasks')}
                                className="text-[10px] font-bold text-amber-800 hover:underline flex items-center gap-0.5 cursor-pointer"
                            >
                                <span>View All</span>
                                <ChevronRight className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="space-y-2">
                            {dueSoonTasks.slice(0, 2).map((task) => (
                                <div key={task.id} className="flex items-center justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <h4 className="font-extrabold text-xs text-slate-900 truncate">"{task.title}"</h4>
                                        <p className="text-[10px] font-bold text-amber-700 mt-0.5">
                                            {getDueSoonText(task.due_date)}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('tasks')}
                                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black rounded-lg shadow-xs shrink-0 cursor-pointer"
                                    >
                                        Submit
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 3. Quick Actions 2×2 Grid */}
                <div className="grid grid-cols-2 gap-2.5">
                    {/* 1. Practice Room */}
                    <button
                        type="button"
                        onClick={() => {
                            setPracticeSuiteTab('metronome');
                            setShowPracticeSuite(true);
                        }}
                        className="p-3 rounded-2xl bg-[#FAF5EE] border border-[#E6E1DA] hover:border-[#7C5E3F]/30 transition-all flex flex-col justify-between text-left active:scale-[0.98] cursor-pointer shadow-3xs"
                    >
                        <div className="w-8 h-8 rounded-xl bg-[#d49900]/15 text-[#b58300] flex items-center justify-center mb-1.5">
                            <PlayCircle className="w-4.5 h-4.5" />
                        </div>
                        <div>
                            <span className="font-extrabold text-xs text-slate-900 block">Practice Room</span>
                            <span className="text-[9px] text-slate-500">Metronome & Tanpura</span>
                        </div>
                    </button>

                    {/* 2. Curriculum */}
                    <button
                        type="button"
                        onClick={() => setActiveTab('curriculum')}
                        className="p-3 rounded-2xl bg-[#FAF5EE] border border-[#E6E1DA] hover:border-[#7C5E3F]/30 transition-all flex flex-col justify-between text-left active:scale-[0.98] cursor-pointer shadow-3xs"
                    >
                        <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center mb-1.5">
                            <BookOpen className="w-4.5 h-4.5" />
                        </div>
                        <div>
                            <span className="font-extrabold text-xs text-slate-900 block">Curriculum</span>
                            <span className="text-[9px] text-amber-700 font-bold">{proficiencyProgress}% completed</span>
                        </div>
                    </button>

                    {/* 3. Tasks */}
                    <button
                        type="button"
                        onClick={() => setActiveTab('tasks')}
                        className="p-3 rounded-2xl bg-[#FAF5EE] border border-[#E6E1DA] hover:border-[#7C5E3F]/30 transition-all flex flex-col justify-between text-left active:scale-[0.98] cursor-pointer shadow-3xs"
                    >
                        <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-700 flex items-center justify-center mb-1.5">
                            <ClipboardList className="w-4.5 h-4.5" />
                        </div>
                        <div>
                            <span className="font-extrabold text-xs text-slate-900 block">Tasks</span>
                            <span className={`text-[9px] font-bold ${pendingTasks.length > 0 ? 'text-rose-600 font-extrabold' : 'text-emerald-600'}`}>
                                {pendingTasks.length > 0 ? `${pendingTasks.length} Pending` : 'All Done ✓'}
                            </span>
                        </div>
                    </button>

                    {/* 4. Progress */}
                    <button
                        type="button"
                        onClick={() => setActiveTab('classroom')}
                        className="p-3 rounded-2xl bg-[#FAF5EE] border border-[#E6E1DA] hover:border-[#7C5E3F]/30 transition-all flex flex-col justify-between text-left active:scale-[0.98] cursor-pointer shadow-3xs"
                    >
                        <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-700 flex items-center justify-center mb-1.5">
                            <Award className="w-4.5 h-4.5" />
                        </div>
                        <div>
                            <span className="font-extrabold text-xs text-slate-900 block">Progress</span>
                            <span className="text-[9px] text-blue-700 font-bold">{overallProgress}% standing</span>
                        </div>
                    </button>
                </div>

                {/* 4. Important Alerts (Compact & Actionable) */}
                {/* A. Fee Balance Alert */}
                {(profile?.fees_classes_paid === undefined || profile?.fees_classes_paid === null || profile?.fees_classes_paid <= 0) ? (
                    <div 
                        onClick={() => setActiveTab('fees')}
                        className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-2 cursor-pointer active:scale-[0.99] text-left"
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                            <span className="text-[11px] font-bold text-red-900 truncate">
                                Prepaid Credit Expired — Pay in advance
                            </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-red-600 shrink-0" />
                    </div>
                ) : profile?.fees_classes_paid === 1 ? (
                    <div 
                        onClick={() => setActiveTab('fees')}
                        className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2 cursor-pointer active:scale-[0.99] text-left"
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                            <span className="text-[11px] font-bold text-amber-900 truncate">
                                1 Class Remaining — Renew your fees
                            </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-amber-600 shrink-0" />
                    </div>
                ) : null}

                {/* B. Overdue Task Alert (Urgent only; standard pending count is in Quick Actions) */}
                {overdueTasks.length > 0 && (
                    <div 
                        onClick={() => setActiveTab('tasks')}
                        className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-2 cursor-pointer active:scale-[0.99] text-left"
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span className="text-[11px] font-bold text-rose-900 truncate">
                                {overdueTasks.length} Overdue Task{overdueTasks.length > 1 ? 's' : ''} — Submit video
                            </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-rose-600 shrink-0" />
                    </div>
                )}

                {/* C. Notice / Admin Broadcast */}
                {unreadAdminBroadcasts.length > 0 && (
                    <div className="bg-[#FAF5EE] border-l-4 border-[#7C5E3F] border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2 text-left">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[8px] font-black uppercase bg-amber-100 text-[#7C5E3F] px-1.5 py-0.2 rounded font-mono">Notice</span>
                                <span className="text-[9px] font-bold text-slate-400">
                                    {new Date(unreadAdminBroadcasts[0].created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                </span>
                            </div>
                            <p className="text-xs font-bold text-slate-800 truncate mt-0.5">
                                {unreadAdminBroadcasts[0].subject}
                            </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    onNavigateToFeed?.({ type: 'category', id: 'announcements', name: 'Announcements' });
                                    setActiveTab('messages');
                                }}
                                className="text-[10px] font-black text-[#7C5E3F] px-2 py-1 bg-white border border-[#7C5E3F]/20 rounded-md cursor-pointer"
                            >
                                Read
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDismissAdminBroadcast(unreadAdminBroadcasts[0].id)}
                                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                                aria-label="Dismiss notice"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* 5. Latest Academy Update Preview */}
                {latestAnnouncement && (
                    <div 
                        onClick={() => {
                            onNavigateToFeed?.({ type: 'category', id: 'announcements', name: 'Announcements' });
                            setActiveTab('messages');
                        }}
                        className="p-3.5 bg-white border border-[#E6E1DA] rounded-2xl shadow-3xs text-left cursor-pointer hover:border-[#7C5E3F]/30 transition-all"
                    >
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[9px] font-black text-amber-800 uppercase tracking-widest font-mono flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">campaign</span>
                                Latest Academy Update
                            </span>
                            <span className="text-[9px] font-bold text-slate-400">
                                {new Date(latestAnnouncement.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                        </div>
                        <h4 className="font-extrabold text-xs text-slate-900 line-clamp-1">{latestAnnouncement.subject}</h4>
                        <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{stripHtml(latestAnnouncement.content)}</p>
                        <div className="mt-2 text-right">
                            <span className="text-[10px] font-bold text-[#7C5E3F] inline-flex items-center gap-0.5">
                                Read Notice <ChevronRight className="w-3 h-3" />
                            </span>
                        </div>
                    </div>
                )}

                {/* 6. Student Statistics (2 × 2 Grid) */}
                <div className="grid grid-cols-2 gap-2.5">
                    {/* Proficiency */}
                    <div className="bg-[#FDFBF7] border border-[#E6E1DA] rounded-2xl p-3 text-left">
                        <span className="text-[8px] font-extrabold text-[#9A958E] uppercase tracking-widest block font-mono">Proficiency</span>
                        <h4 className="font-extrabold text-xs text-[#3E3A35] truncate mt-0.5">{levelLabel}</h4>
                        <p className="text-[9px] text-[#9A958E] mt-0.5">{proficiencyProgress}% syllabus done</p>
                    </div>

                    {/* Attendance */}
                    <div className="bg-[#FDFBF7] border border-[#E6E1DA] rounded-2xl p-3 text-left">
                        <span className="text-[8px] font-extrabold text-[#9A958E] uppercase tracking-widest block font-mono">Attendance</span>
                        <h4 className="font-extrabold text-xs text-[#3E3A35] truncate mt-0.5">{attendancePct !== null ? `${attendancePct}%` : '—'}</h4>
                        <p className="text-[9px] text-[#9A958E] mt-0.5">{attendanceStats.total} marked sessions</p>
                    </div>

                    {/* Batch */}
                    <div className="bg-[#FDFBF7] border border-[#E6E1DA] rounded-2xl p-3 text-left">
                        <span className="text-[8px] font-extrabold text-[#9A958E] uppercase tracking-widest block font-mono">My Batch</span>
                        <h4 className="font-extrabold text-xs text-[#3E3A35] truncate mt-0.5">{classroom ? classroom.name : 'Not Enrolled'}</h4>
                        <p className="text-[9px] text-[#9A958E] mt-0.5">{classroom?.type === 'temporary' ? 'Temporary' : 'Active Batch'}</p>
                    </div>

                    {/* Overall Standing */}
                    <div className="bg-[#FDFBF7] border border-[#E6E1DA] rounded-2xl p-3 text-left">
                        <span className="text-[8px] font-extrabold text-[#9A958E] uppercase tracking-widest block font-mono">Standing</span>
                        <h4 className="font-extrabold text-xs text-[#7C5E3F] truncate mt-0.5">{overallProgress}%</h4>
                        <p className="text-[9px] text-emerald-600 font-bold mt-0.5">
                            {overallProgress >= 80 ? 'Consistent' : overallProgress >= 65 ? 'Improving' : 'Attention'}
                        </p>
                    </div>
                </div>

                {/* 7. Your Learning Focus (Compact Mobile) */}
                {learningFocus && (
                    <div className="p-4 bg-white border border-[#E6E1DA] rounded-3xl shadow-3xs text-left space-y-3">
                        <div className="flex items-center justify-between">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1 ${
                                learningFocus.badgeType === 'teacher' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                                learningFocus.badgeType === 'student' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                                learningFocus.badgeType === 'continue' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                learningFocus.badgeType === 'up_next' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                                {learningFocus.badgeLabel}
                            </span>
                            {learningFocus.lesson && (
                                <span className="text-[9px] font-bold text-slate-400">
                                    {learningFocus.lesson.duration || '20 Mins'}
                                </span>
                            )}
                        </div>

                        {learningFocus.lesson ? (
                            <div 
                                onClick={() => {
                                    setSelectedTopic(learningFocus.lesson);
                                    setActiveTab('curriculum');
                                }}
                                className="cursor-pointer active:scale-[0.99] transition-transform space-y-1.5"
                            >
                                <h4 className="font-extrabold text-sm text-slate-900 line-clamp-1 leading-snug">
                                    {learningFocus.lesson.lesson_number ? `Topic ${learningFocus.lesson.lesson_number}: ` : ''}{learningFocus.lesson.title}
                                </h4>
                                {learningFocus.recommendedBy && (
                                    <p className="text-[10px] font-bold text-amber-700">
                                        Recommended by {learningFocus.recommendedBy}
                                    </p>
                                )}
                                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                                    {stripHtml(learningFocus.lesson.description) || 'Practice finger placement, tone production and breath control.'}
                                </p>

                                <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400">
                                        {learningFocus.status === 'completed' ? 'Completed ✓' : 'In Progress'}
                                    </span>
                                    <button
                                        type="button"
                                        className="text-xs font-black text-white bg-[#ecb613] hover:bg-[#d49f0e] px-3.5 py-1.5 rounded-xl shadow-xs inline-flex items-center gap-1 cursor-pointer"
                                    >
                                        {learningFocus.actionLabel} <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="py-2">
                                <h4 className="font-extrabold text-sm text-slate-900">All Caught Up!</h4>
                                <p className="text-xs text-slate-500 mt-1">You have completed all currently assigned lessons in your curriculum.</p>
                                <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('curriculum')}
                                        className="text-xs font-black text-slate-700 bg-slate-100 hover:bg-slate-200 px-3.5 py-1.5 rounded-xl inline-flex items-center gap-1 cursor-pointer"
                                    >
                                        Review Syllabus <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Compact Companion Row if Teacher Spotlight is active AND Student also has My Spotlight */}
                        {learningFocus.secondarySpotlight?.lesson && (
                            <div 
                                onClick={() => {
                                    setSelectedTopic(learningFocus.secondarySpotlight!.lesson);
                                    setActiveTab('curriculum');
                                }}
                                className="p-2.5 bg-amber-50/50 border border-amber-200/60 rounded-2xl flex items-center justify-between gap-2 cursor-pointer hover:bg-amber-50 transition-colors"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] font-black text-amber-800 uppercase font-mono">★ My Spotlight</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-800 truncate mt-0.5">
                                        {learningFocus.secondarySpotlight.lesson.title}
                                    </p>
                                </div>
                                <span className="text-[10px] font-bold text-amber-700 shrink-0 inline-flex items-center gap-0.5">
                                    Continue <ChevronRight className="w-3 h-3" />
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ========================================================================= */}
            {/* DESKTOP VIEW (>= 1024px) - Clean Consolidated Attention & Urgent Alerts    */}
            {/* ========================================================================= */}
            <div className="hidden lg:block space-y-6">
                {/* 1. URGENT: Live Class Active Banner (Severity A) */}
                {classroom?.is_live && (
                    <div className="bg-gradient-to-r from-red-600 via-[#d49900] to-amber-500 rounded-2xl p-4 sm:p-5 text-white shadow-md flex items-center justify-between gap-6 animate-in zoom-in-95 duration-300 border border-red-500/20 text-left">
                        <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center shrink-0 animate-pulse">
                                <span className="material-symbols-outlined text-xl">video_call</span>
                            </div>
                            <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black uppercase tracking-wider bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse font-mono">
                                        ● Live Now
                                    </span>
                                    {classroom.live_session_started_at && (
                                        <span className="text-[10px] text-white/80 font-bold font-mono">
                                            Started at {new Date(classroom.live_session_started_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                                        </span>
                                    )}
                                </div>
                                <h3 className="font-extrabold text-white text-sm sm:text-base leading-tight truncate">
                                    {classroom.name} — Instructor: {classroom.teacher_name}
                                </h3>
                            </div>
                        </div>
                        {classroom.live_meeting_link && (
                            <a
                                href={classroom.live_meeting_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-5 py-2.5 bg-white text-red-600 hover:text-red-700 hover:bg-slate-50 transition-all font-black rounded-xl text-xs shadow-md flex items-center gap-1.5 shrink-0 uppercase tracking-wider cursor-pointer"
                            >
                                <PlayCircle className="w-4 h-4 text-red-600" />
                                <span>Join Class</span>
                            </a>
                        )}
                    </div>
                )}

                {/* 2. URGENT: Prepaid Credit Exhausted / 0 Classes Remaining (Severity A) */}
                {(profile?.fees_classes_paid === undefined || profile?.fees_classes_paid === null || profile?.fees_classes_paid <= 0) && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5 text-left flex items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-300 shadow-2xs">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center text-red-600 shrink-0">
                                <AlertCircle className="w-4.5 h-4.5" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="bg-red-600 text-white text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded font-mono">
                                        Prepaid Credit Expired
                                    </span>
                                </div>
                                <p className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                                    Your prepaid class credits have expired. Please complete your fee payment in advance to schedule your next session.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setActiveTab('fees')}
                            className="text-xs bg-red-600 hover:bg-red-700 text-white font-extrabold px-4 py-2 rounded-xl transition-all active:scale-95 shadow-xs shrink-0 flex items-center gap-1 cursor-pointer uppercase tracking-wider"
                        >
                            <span>Pay & Book Class</span>
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* 3. CONSOLIDATED ATTENTION STRIP (Severity B: Normal Actionable Items) */}
                {(profile?.fees_classes_paid === 1 || pendingTasks.length > 0 || unreadAdminBroadcasts.length > 0) && (
                    <div className="bg-[#FAF5EE] border border-[#E6E1DA] rounded-2xl px-4 py-2.5 shadow-3xs flex items-center justify-between gap-4 animate-in fade-in duration-200 text-left">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-x-auto scrollbar-none py-0.5">
                            <span className="text-[9px] font-black text-[#7C5E3F] uppercase tracking-widest bg-amber-200/60 px-2 py-0.5 rounded-md font-mono shrink-0">
                                Attention
                            </span>

                            {/* 1 Class Remaining */}
                            {profile?.fees_classes_paid === 1 && (
                                <div 
                                    onClick={() => setActiveTab('fees')}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100/70 hover:bg-amber-100 text-amber-900 border border-amber-300/40 text-xs font-bold cursor-pointer transition-colors shrink-0"
                                    title="Click to view fee balance & renew"
                                >
                                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                                    <span>1 Class Remaining</span>
                                </div>
                            )}

                            {/* Pending or Overdue Tasks */}
                            {overdueTasks.length > 0 ? (
                                <div 
                                    onClick={() => setActiveTab('tasks')}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-900 border border-rose-300/50 text-xs font-black cursor-pointer transition-colors shrink-0"
                                    title="Click to view overdue tasks"
                                >
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
                                    <span>{overdueTasks.length} Overdue Task{overdueTasks.length > 1 ? 's' : ''}</span>
                                </div>
                            ) : dueSoonTasks.length > 0 ? (
                                <div 
                                    onClick={() => setActiveTab('tasks')}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 border border-amber-500/40 text-xs font-black cursor-pointer transition-colors shrink-0"
                                    title="Click to view tasks due soon"
                                >
                                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                                    <span>{dueSoonTasks.length} Task{dueSoonTasks.length > 1 ? 's' : ''} Due Soon</span>
                                </div>
                            ) : pendingTasks.length > 0 ? (
                                <div 
                                    onClick={() => setActiveTab('tasks')}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-800 border border-slate-200 text-xs font-bold cursor-pointer transition-colors shrink-0"
                                    title="Click to view pending assignments"
                                >
                                    <ClipboardList className="w-3.5 h-3.5 text-slate-600" />
                                    <span>{pendingTasks.length} Pending Task{pendingTasks.length > 1 ? 's' : ''}</span>
                                </div>
                            ) : null}

                            {/* Unread Admin Notice */}
                            {unreadAdminBroadcasts.length > 0 && (
                                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-amber-50 text-[#7C5E3F] border border-[#7C5E3F]/20 text-xs font-medium min-w-0 max-w-md truncate">
                                    <span className="material-symbols-outlined text-sm text-[#7C5E3F] shrink-0">campaign</span>
                                    <span className="font-extrabold truncate">{unreadAdminBroadcasts[0].subject}</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onNavigateToFeed?.({ type: 'category', id: 'announcements', name: 'Announcements' });
                                            setActiveTab('messages');
                                        }}
                                        className="text-[10px] font-black text-[#7C5E3F] underline hover:text-[#5c442c] shrink-0 cursor-pointer"
                                    >
                                        Read
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDismissAdminBroadcast(unreadAdminBroadcasts[0].id)}
                                        className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
                                        aria-label="Dismiss notice"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* View All Actions Button */}
                        <button
                            type="button"
                            onClick={() => setActiveTab('messages')}
                            className="text-[11px] font-bold text-[#7C5E3F] hover:underline flex items-center gap-1 shrink-0 cursor-pointer whitespace-nowrap pl-2 border-l border-[#E6E1DA]"
                        >
                            <span>View All</span>
                            <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>
                )}

                {/* Task Due Soon Dedicated Desktop Banner */}
                {dueSoonTasks.length > 0 && (
                    <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 border border-amber-500/30 rounded-3xl p-4 sm:p-5 text-left shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-200">
                        <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0">
                                <Clock className="w-5 h-5 text-amber-700" />
                            </div>
                            <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black uppercase tracking-wider bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-mono">
                                        Task Due Soon
                                    </span>
                                    <span className="text-xs font-bold text-amber-800">
                                        {getDueSoonText(dueSoonTasks[0].due_date)}
                                    </span>
                                </div>
                                <h4 className="font-black text-sm sm:text-base text-slate-900 truncate">
                                    "{dueSoonTasks[0].title}"
                                </h4>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setActiveTab('tasks')}
                            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all shrink-0 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                        >
                            <span>Complete / Submit Task</span>
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Live Class Notification & Join Banner */}
                {classroom?.is_live && (
                    <div className="bg-gradient-to-r from-red-600 via-[#d49900] to-amber-500 rounded-3xl p-6 sm:p-7 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6 animate-in zoom-in-95 duration-300 border border-red-500/20 text-left">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-white/20 text-white flex items-center justify-center shrink-0 mt-0.5 animate-pulse">
                                <span className="material-symbols-outlined text-2xl animate-bounce">video_call</span>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black uppercase tracking-wider bg-red-500 text-white px-2.5 py-0.5 rounded-full animate-pulse font-mono">● Live Now</span>
                                    {classroom.live_session_started_at && (
                                        <span className="text-[10px] text-white/80 font-bold font-mono">
                                            Started at {new Date(classroom.live_session_started_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                                        </span>
                                    )}
                                </div>
                                <h3 className="font-extrabold text-white text-lg leading-tight">Class Session is Live!</h3>
                                <p className="text-xs text-white/90 leading-relaxed font-medium">
                                    Your instructor, <strong className="font-black text-white">{classroom.teacher_name}</strong>, has started an active classroom session. Join now to participate.
                                </p>
                            </div>
                        </div>
                        {classroom.live_meeting_link && (
                            <a
                                href={classroom.live_meeting_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-6 py-3.5 bg-white text-red-600 hover:text-red-700 hover:bg-slate-50 transition-all font-black rounded-full text-xs shadow-md flex items-center justify-center gap-2 hover:scale-[1.03] active:scale-[0.97] shrink-0 font-sans cursor-pointer uppercase tracking-wider"
                            >
                                <PlayCircle className="w-4.5 h-4.5 text-red-600" />
                                Join Class
                            </a>
                        )}
                    </div>
                )}

                <div
                    className="bg-cover bg-center rounded-3xl relative p-4 sm:p-8 text-white min-h-[140px] md:min-h-[280px] flex items-center shadow-md overflow-hidden border border-[#E6E1DA] text-left"
                    style={{ backgroundImage: "url('/flutes_custom.jpg')" }}
                >
                    {/* Overlay to ensure text readability */}
                    <div className="absolute inset-0 bg-gradient-to-b md:bg-gradient-to-r from-[#2B1B0E]/95 via-[#2B1B0E]/85 to-[#2B1B0E]/60 pointer-events-none"></div>

                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 w-full">
                        <div className="space-y-2.5 md:space-y-4 max-w-xl">
                            <div>
                                <span className="bg-[#FAF5EE] text-[#7C5E3F] text-[8px] md:text-[10px] font-black px-2 py-0.5 md:px-2.5 md:py-1 rounded-full uppercase tracking-wider shadow-xs">
                                    ★ Flute Academy Student Portal
                                </span>
                            </div>
                            <h1 className="text-xl sm:text-2xl md:text-5xl font-black tracking-tight leading-tight text-white">
                                Namaste, {profile?.name?.split(' ')[0]}!
                            </h1>
                            <p className="text-[11px] sm:text-xs md:text-sm font-medium text-slate-200/90 leading-relaxed italic">
                                "Daily Practice Tip: Blow gently with a relaxed embouchure. Focus on a clear sound, warm breath support, and precise finger placement."
                            </p>

                            {classroom && (
                                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-xl p-1.5 md:p-2.5 border border-white/10 text-white w-fit text-left shrink-0 mt-1 md:mt-2">
                                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                                        {classroom.type === 'temporary' ? (
                                            <span className="text-xs">⚡</span>
                                        ) : (
                                            <Users className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-350" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-[7px] md:text-[8px] font-bold text-white/60 uppercase tracking-wider leading-none">
                                            {profile?.status === 'archived' || profile?.status === 'inactive' ? 'Learning Circle' : classroom.type === 'temporary' ? 'Temporary Class' : 'Active Batch'}
                                        </p>
                                        <p className="text-[10px] md:text-xs font-black mt-0.5">{classroom.name || 'KFA Learning Circle'}{classroom.teacher_name ? ` · ${classroom.teacher_name}` : ''}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="shrink-0 flex flex-row md:flex-col gap-2.5 w-full md:w-auto mt-2 md:mt-0">
                            <button
                                onClick={() => {
                                    setPracticeSuiteTab('metronome');
                                    setShowPracticeSuite(true);
                                }}
                                className="flex-1 md:flex-initial px-4 py-3 bg-[#d49900] hover:bg-[#b58300] text-white font-extrabold text-[10px] sm:text-xs rounded-full shadow-lg shadow-orange-950/20 hover:scale-102 active:scale-98 transition-all flex items-center justify-center gap-1.5 group"
                            >
                                <PlayCircle className="w-4 h-4 shrink-0" />
                                <span><span className="hidden sm:inline">Start </span>Practice Room</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('curriculum')}
                                className="flex-1 md:flex-initial px-4 py-3 bg-white/10 hover:bg-white/15 text-white border border-[#faf6f0]/15 font-extrabold text-[10px] sm:text-xs rounded-full backdrop-blur-md transition-all flex items-center justify-center gap-1.5 active:scale-98"
                            >
                                <BookOpen className="w-4 h-4 text-white/80 shrink-0" />
                                <span>View Syllabus</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Summary Metrics Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Level Card */}
                    <div className="bg-[#FDFBF7] border border-[#E6E1DA] rounded-3xl p-4 sm:p-5 flex items-center gap-4 text-left shadow-2xs hover:shadow-sm hover:border-[#7C5E3F]/20 transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-amber-500/10 transition-colors"></div>
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#F5ECE3] text-[#D49E35] flex items-center justify-center shrink-0">
                            <Award className="w-5.5 h-5.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[9px] sm:text-[10px] font-extrabold text-[#9A958E] uppercase tracking-widest">Proficiency</p>
                            <h3 className="font-extrabold text-sm sm:text-base text-[#3E3A35] truncate mt-0.5">{levelLabel}</h3>
                            <p className="text-[9px] sm:text-[10px] font-semibold text-[#9A958E] mt-0.5">Scale & Finger training</p>
                        </div>
                    </div>

                    {/* Class/Batch Card */}
                    <div className={`bg-[#FDFBF7] border border-[#E6E1DA] rounded-3xl p-4 sm:p-5 flex items-center gap-4 text-left shadow-2xs hover:shadow-sm transition-all group relative overflow-hidden ${classroom
                        ? classroom.type === 'temporary'
                            ? 'hover:border-emerald-500/25'
                            : 'hover:border-blue-500/25'
                        : 'hover:border-[#7C5E3F]/20'
                        }`}>
                        <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-orange-500/10 transition-colors"></div>
                        <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shrink-0 ${classroom
                            ? classroom.type === 'temporary'
                                ? 'bg-emerald-50/80 text-emerald-600'
                                : 'bg-[#E3ECF5] text-[#5383B4]'
                            : 'bg-[#E3ECF5] text-[#5383B4]'
                            }`}>
                            <Clock className="w-5.5 h-5.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[9px] sm:text-[10px] font-extrabold text-[#9A958E] uppercase tracking-widest">
                                {classroom
                                    ? classroom.type === 'temporary'
                                        ? 'Temporary Class'
                                        : 'My Batch'
                                    : 'My Batch'
                                }
                            </p>
                            <h3 className="font-extrabold text-sm sm:text-base text-[#3E3A35] truncate mt-0.5">
                                {classroom ? (
                                    <>
                                        {classroom.type === 'temporary' ? '⚡ ' : '🏫 '}
                                        {classroom.name}
                                    </>
                                ) : 'Not Enrolled'}
                            </h3>
                            <p className="text-[9px] sm:text-[10px] font-semibold text-[#9A958E] mt-0.5">
                                {classroom
                                    ? classroom.type === 'temporary'
                                        ? 'Make-up Session / Override'
                                        : 'Active Class Session'
                                    : 'No Active Classroom'
                                }
                            </p>
                        </div>
                    </div>

                    {/* Attendance Percentage */}
                    <div className="bg-[#FDFBF7] border border-[#E6E1DA] rounded-3xl p-4 sm:p-5 flex items-center gap-4 text-left shadow-2xs hover:shadow-sm hover:border-[#7C5E3F]/20 transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors"></div>

                        {attendancePct !== null ? (
                            <div className="relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center shrink-0">
                                {/* Circular Progress Ring */}
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="40"
                                        strokeWidth="8"
                                        stroke="#f1f5f9"
                                        fill="transparent"
                                    />
                                    {attendancePct > 0 && (
                                        <circle
                                            cx="50"
                                            cy="50"
                                            r="40"
                                            strokeWidth="8"
                                            stroke="url(#emeraldGradient)"
                                            strokeDasharray={`${2 * Math.PI * 40}`}
                                            strokeDashoffset={`${2 * Math.PI * 40 * (1 - attendancePct / 100)}`}
                                            strokeLinecap="round"
                                            fill="transparent"
                                        />
                                    )}
                                    <defs>
                                        <linearGradient id="emeraldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#10b981" />
                                            <stop offset="100%" stopColor="#059669" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                                <span className="absolute text-[10px] font-black text-emerald-600">{attendancePct}%</span>
                            </div>
                        ) : (
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/0 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-500/10">
                                <Calendar className="w-5.5 h-5.5" />
                            </div>
                        )}

                        <div className="min-w-0 flex-1">
                            <p className="text-[9px] sm:text-[10px] font-extrabold text-[#9A958E] uppercase tracking-widest">Attendance</p>
                            <h3 className="font-extrabold text-sm sm:text-base text-[#3E3A35] mt-0.5">{attendancePct !== null ? `${attendancePct}%` : '—'}</h3>
                            <p className="text-[9px] sm:text-[10px] font-semibold text-[#9A958E] mt-0.5">{attendanceStats.total} marked sessions</p>
                        </div>
                    </div>

                    {/* Pending Tasks count */}
                    <div className="bg-[#FDFBF7] border border-[#E6E1DA] rounded-3xl p-4 sm:p-5 flex items-center gap-4 text-left shadow-2xs hover:shadow-sm hover:border-[#7C5E3F]/20 transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-[#F5E3E6] rounded-full blur-xl pointer-events-none group-hover:bg-[#F5E3E6]/10 transition-colors"></div>
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#F5E3E6] text-[#B45366] flex items-center justify-center shrink-0">
                            <ClipboardList className="w-5.5 h-5.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[9px] sm:text-[10px] font-extrabold text-[#9A958E] uppercase tracking-widest">Pending Tasks</p>
                            <h3 className="font-extrabold text-sm sm:text-base text-[#3E3A35] mt-0.5">{assignments.filter(a => a.status === 'pending').length} Tasks</h3>
                            <p className="text-[9px] sm:text-[10px] font-semibold text-[#9A958E] mt-0.5">Needs practice video</p>
                        </div>
                    </div>
                </div>

                {/* My Academic Standing & Progress */}
                <div className="bg-white border border-[#E6E1DA] rounded-3xl p-6 sm:p-7 shadow-xs text-left animate-in fade-in duration-300">
                    <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-stretch">
                        {/* Left: Overall Progress Circular Ring */}
                        <div className="flex flex-col items-center justify-center md:border-r border-slate-150 md:pr-8 shrink-0">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Overall Standing</h3>
                            <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="40"
                                        strokeWidth="8"
                                        stroke="#f1f5f9"
                                        fill="transparent"
                                    />
                                    {overallProgress > 0 && (
                                        <circle
                                            cx="50"
                                            cy="50"
                                            r="40"
                                            strokeWidth="8"
                                            stroke="url(#overallProgressGradientLeftColumn)"
                                            strokeDasharray={`${2 * Math.PI * 40}`}
                                            strokeDashoffset={`${2 * Math.PI * 40 * (1 - overallProgress / 100)}`}
                                            strokeLinecap="round"
                                            fill="transparent"
                                        />
                                    )}
                                    <defs>
                                        <linearGradient id="overallProgressGradientLeftColumn" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#7C5E3F" />
                                            <stop offset="100%" stopColor="#d49900" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                                <div className="absolute flex flex-col items-center justify-center">
                                    <span className="text-xl sm:text-2xl font-black text-[#7C5E3F]">{overallProgress}%</span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Progress</span>
                                </div>
                            </div>

                            {/* Standing Status Badge */}
                            <div className="mt-4 flex items-center gap-1.5">
                                {(taskSubmissionRate === null && attendanceRate === null && avgScore === null) || overallProgress >= 80 ? (
                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-250/30 text-[10px] font-extrabold select-none">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                        Consistent
                                    </span>
                                ) : overallProgress >= 65 ? (
                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-250/30 text-[10px] font-extrabold select-none">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                        Improving
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-250/30 text-[10px] font-extrabold select-none">
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                        Attention Needed
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Right: Component Evaluation Grid */}
                        <div className="flex-1 flex flex-col justify-between space-y-3">
                            <div>
                                <h4 className="font-black text-[#3E3A35] text-sm">Academic Performance Breakdown</h4>
                                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                    Your overall progress is calculated as the average of these 4 parameters.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* 1. Proficiency Progress */}
                                <div className="p-3 rounded-xl bg-slate-50/50 border border-slate-100 flex flex-col justify-between">
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="font-extrabold text-slate-655 flex items-center gap-1.5">
                                            <BookOpen className="w-3.5 h-3.5 text-[#7C5E3F] shrink-0" />
                                            Proficiency Progress
                                        </span>
                                        <span className="font-black text-[#7C5E3F]">{proficiencyProgress}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                                        <div className="bg-[#7C5E3F] h-full rounded-full transition-all duration-500" style={{ width: `${proficiencyProgress}%` }} />
                                    </div>
                                </div>

                                {/* 2. Task Submission */}
                                <div className="p-3 rounded-xl bg-slate-50/50 border border-slate-100 flex flex-col justify-between">
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="font-bold text-slate-655 flex items-center gap-1.5">
                                            <ClipboardList className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                            Task Submission Rate
                                        </span>
                                        <span className="font-black text-amber-600">{taskSubmissionRate ?? 0}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                                        <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${taskSubmissionRate ?? 0}%` }} />
                                    </div>
                                </div>

                                {/* 3. Attendance Rate */}
                                <div className="p-3 rounded-xl bg-slate-50/50 border border-slate-100 flex flex-col justify-between">
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="font-bold text-slate-655 flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                            Monthly Attendance
                                        </span>
                                        <span className="font-black text-emerald-600">{attendanceRate ?? 0}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                                        <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${attendanceRate ?? 0}%` }} />
                                    </div>
                                </div>

                                {/* 4. Average Score */}
                                <div className="p-3 rounded-xl bg-slate-50/50 border border-slate-100 flex flex-col justify-between">
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="font-bold text-slate-655 flex items-center gap-1.5">
                                            <Award className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                            Average Score
                                        </span>
                                        <span className="font-black text-blue-600">{(avgScore ?? 0) * 10}% ({(avgScore ?? 0)}/10)</span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                                        <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${(avgScore ?? 0) * 10}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Core Dashboard split sections */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left column: Weekly Curriculum & Recent Submissions */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Your Learning Focus */}
                        <div className="bg-white border border-[#E6E1DA] rounded-3xl overflow-hidden shadow-sm text-left">
                            <div className="px-6 py-5 border-b border-[#E6E1DA] flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-[#FAF5EE] text-[#7C5E3F] flex items-center justify-center">
                                        <BookOpen className="w-4.5 h-4.5" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-[#3E3A35] text-sm md:text-base">Your Learning Focus</h3>
                                        <p className="text-[10px] text-slate-500 mt-0.5">Personalized recommendations and next learning milestones</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setActiveTab('curriculum')}
                                    className="text-xs font-bold text-[#7C5E3F] hover:text-[#5c442c] transition-colors flex items-center gap-0.5 cursor-pointer"
                                >
                                    View Full Syllabus <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="p-6">
                                {learningFocus?.lesson ? (
                                    <div className="space-y-4">
                                        <div
                                            onClick={() => {
                                                setSelectedTopic(learningFocus.lesson);
                                                setActiveTab('curriculum');
                                            }}
                                            className="p-5 rounded-2xl bg-[#FDFBF7] border border-[#E6E1DA] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 transition-all hover:border-[#7C5E3F]/30 cursor-pointer hover:bg-white active:scale-[0.99]"
                                        >
                                            <div className="min-w-0 flex-1 text-left space-y-2.5">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`text-[9px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider font-mono ${
                                                        learningFocus.badgeType === 'teacher' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                                                        learningFocus.badgeType === 'student' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                                                        learningFocus.badgeType === 'continue' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                                        learningFocus.badgeType === 'up_next' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                                        'bg-slate-100 text-slate-700 border border-slate-200'
                                                    }`}>
                                                        {learningFocus.badgeLabel}
                                                    </span>
                                                    {learningFocus.recommendedBy && (
                                                        <span className="text-[10px] font-bold text-amber-800">
                                                            Recommended by {learningFocus.recommendedBy}
                                                        </span>
                                                    )}
                                                </div>

                                                <div>
                                                    <h4 className="font-black text-base text-[#3E3A35] leading-snug">
                                                        {learningFocus.lesson.lesson_number ? `Topic ${learningFocus.lesson.lesson_number}: ` : ''}{learningFocus.lesson.title}
                                                    </h4>
                                                </div>

                                                <p className="text-xs text-[#5C5852] line-clamp-2 leading-relaxed">
                                                    {stripHtml(learningFocus.lesson.description) || 'Practice finger coordination and mouth alignment on your bansuri to perfect your sound projection.'}
                                                </p>

                                                <div className="flex items-center gap-2 pt-1 flex-wrap">
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#7C5E3F] bg-[#FAF5EE] px-2.5 py-1 rounded-full">
                                                        <Clock className="w-3 h-3 text-[#7C5E3F]" /> {learningFocus.lesson.duration || '20 Mins'}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#5383B4] bg-[#E3ECF5] px-2.5 py-1 rounded-full">
                                                        <Award className="w-3 h-3" /> {learningFocus.lesson.difficulty || 'Intermediate'}
                                                    </span>
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${
                                                        learningFocus.status === 'completed'
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                                                    }`}>
                                                        {learningFocus.status === 'completed' ? 'Completed ✓' : 'In Progress'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="shrink-0 w-full sm:w-auto flex flex-col items-center sm:items-end gap-3">
                                                <div className="relative group">
                                                    <img
                                                        src="/flutes_custom.jpg"
                                                        alt="Active lesson spotlight"
                                                        className="object-cover rounded-2xl w-full sm:w-36 h-24 border border-[#E6E1DA]"
                                                    />
                                                    <div className="absolute inset-0 bg-black/10 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Play className="w-8 h-8 text-white fill-white" />
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="w-full sm:w-auto px-4 py-2 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-950 text-xs font-black rounded-xl shadow-xs inline-flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                                                >
                                                    {learningFocus.actionLabel} <ChevronRight className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Secondary Companion Card (When Teacher Spotlight is active AND Student has personal Spotlight) */}
                                        {learningFocus.secondarySpotlight?.lesson && (
                                            <div 
                                                onClick={() => {
                                                    setSelectedTopic(learningFocus.secondarySpotlight!.lesson);
                                                    setActiveTab('curriculum');
                                                }}
                                                className="p-4 bg-amber-50/40 border border-amber-200/70 rounded-2xl flex items-center justify-between gap-4 cursor-pointer hover:bg-amber-50/80 transition-all text-left"
                                            >
                                                <div className="min-w-0 flex-1 flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0">
                                                        <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[9px] font-black text-amber-900 uppercase font-mono tracking-wider">★ My Spotlight</span>
                                                            <span className="text-[10px] text-slate-400">•</span>
                                                            <span className="text-[10px] text-slate-500 font-bold">Personal focus</span>
                                                        </div>
                                                        <h5 className="font-extrabold text-xs text-slate-900 truncate mt-0.5">
                                                            {learningFocus.secondarySpotlight.lesson.lesson_number ? `Topic ${learningFocus.secondarySpotlight.lesson.lesson_number}: ` : ''}{learningFocus.secondarySpotlight.lesson.title}
                                                        </h5>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="px-3 py-1.5 text-xs font-black text-amber-900 bg-white border border-amber-300 hover:bg-amber-100 rounded-xl shadow-2xs inline-flex items-center gap-1 shrink-0 cursor-pointer"
                                                >
                                                    Continue <ChevronRight className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}

                                        {/* Social Practice Indicator */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#E6E1DA]/60">
                                            <div className="flex -space-x-2 overflow-hidden shrink-0">
                                                {classmates.slice(0, 3).map((mate) => (
                                                    <div key={mate.id} className="inline-block h-6 w-6 rounded-full ring-2 ring-white overflow-hidden bg-slate-100">
                                                        {mate.profile_pic_url ? (
                                                            <img src={mate.profile_pic_url} alt={mate.name} className="h-full w-full object-cover" />
                                                        ) : (
                                                            <div className="h-full w-full flex items-center justify-center text-[8px] font-bold text-[#7C5E3F] bg-[#FAF5EE]">
                                                                {mate.name.charAt(0)}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                                {classmates.length > 3 && (
                                                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-[#FAF5EE] ring-2 ring-white text-[9px] font-black text-[#7C5E3F]">
                                                        +{classmates.length - 3}
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-[10px] font-semibold text-[#9A958E] text-left">
                                                {classmates.length > 0 ? `${classmates.length + 5} student(s) from your batch are practicing this week` : 'Join the practice room to begin today!'}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-8 border border-dashed border-[#E6E1DA] rounded-2xl text-center bg-slate-50/50">
                                        <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                                        <p className="text-xs font-bold text-slate-700">Course completed!</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Contact your teacher for your next advanced module.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Recent Submissions & Feedback */}
                        <div className="bg-white border border-[#E6E1DA] rounded-3xl overflow-hidden shadow-sm text-left">
                            <div className="px-6 py-5 border-b border-[#E6E1DA] flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-[#FAF5EE] text-[#7C5E3F] flex items-center justify-center">
                                        <ClipboardList className="w-4.5 h-4.5" />
                                    </div>
                                    <h3 className="font-black text-[#3E3A35] text-sm md:text-base">Recent Submissions & Feedback</h3>
                                </div>
                                <button
                                    onClick={() => setActiveTab('tasks')}
                                    className="text-xs font-bold text-[#7C5E3F] hover:text-[#5c442c] transition-colors"
                                >
                                    View Tasks
                                </button>
                            </div>

                            <div className="p-6">
                                {assignments.filter(a => a.status !== 'pending').length === 0 ? (
                                    <div className="py-10 border border-dashed border-[#E6E1DA] rounded-2xl text-center bg-slate-50/50">
                                        <HelpCircle className="w-8 h-8 text-[#9A958E] mx-auto mb-2" />
                                        <p className="text-xs font-bold text-[#3E3A35]">No submissions yet.</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Submit your first task attempt to see feedback reports here.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {assignments.filter(a => a.status !== 'pending').slice(0, 2).map((asg) => {
                                            const isReviewed = asg.status === 'reviewed' || asg.status === 'approved';
                                            return (
                                                <div key={asg.id} className="p-4 rounded-2xl bg-[#FDFBF7] border border-[#E6E1DA] hover:border-[#7C5E3F]/15 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                    <div className="flex items-center gap-3 min-w-0 flex-1 text-left">
                                                        <div className="w-10 h-10 rounded-xl bg-[#F7F2EA] text-[#7C5E3F] flex items-center justify-center shrink-0">
                                                            {isReviewed ? <Award className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <h4 className="font-extrabold text-sm text-[#3E3A35] truncate">{asg.title}</h4>
                                                            <p className="text-[10px] text-slate-400 mt-1">
                                                                Submitted {asg.submitted_at ? new Date(asg.submitted_at).toLocaleDateString() : 'recently'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${isReviewed ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'
                                                            }`}>
                                                            {asg.status}
                                                        </span>
                                                        {isReviewed && asg.score !== null && (
                                                            <span className="text-[10px] font-black bg-[#FAF5EE] text-[#7C5E3F] px-2.5 py-1 rounded-full border border-[#7C5E3F]/10">
                                                                Score: {asg.score}/10
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Instructor Board & Practice Highlights */}
                    <div className="space-y-6">
                        {/* Notice Board */}
                        <div className="bg-white border border-[#E6E1DA] rounded-3xl overflow-hidden shadow-xs text-left">
                            <div className="bg-gradient-to-r from-amber-50 to-orange-50/20 px-5 py-4 border-b border-[#E6E1DA] flex items-center justify-between">
                                <h3 className="font-extrabold text-[#3E3A35] text-xs flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg text-amber-500 shrink-0">campaign</span>
                                    Notice Board
                                </h3>
                                <button
                                    onClick={() => setActiveTab('messages')}
                                    className="text-[10px] font-bold text-[#7C5E3F] hover:underline"
                                >
                                    View All
                                </button>
                            </div>

                            <div className="p-4 space-y-3 max-h-[220px] overflow-y-auto pr-1">
                                {dashboardBroadcasts.length === 0 ? (
                                    <p className="text-[11px] text-slate-400 text-center py-6">No recent notices.</p>
                                ) : (
                                    dashboardBroadcasts.slice(0, 3).map((b) => (
                                        <div 
                                            key={b.id} 
                                            onClick={() => {
                                                let feedId = 'announcements';
                                                let feedName = 'Announcements';
                                                if (b.channel === 'custom_groups') {
                                                    feedId = 'custom_groups';
                                                    feedName = 'Group Announcements';
                                                } else if (b.channel === 'classroom' || (!b.channel && b.sender?.role !== 'admin')) {
                                                    feedId = 'classroom';
                                                    feedName = 'Class Announcements';
                                                } else if (b.channel === 'new_joiners') {
                                                    feedId = 'new_joiners';
                                                    feedName = 'New Joiners Notices';
                                                } else if (b.channel === 'fee_management') {
                                                    setActiveTab('fees');
                                                    return;
                                                } else if (b.channel === 'voice') {
                                                    feedId = 'voice';
                                                    feedName = 'Voice Notes & Tones';
                                                }
                                                onNavigateToFeed?.({ type: 'category', id: feedId, name: feedName });
                                                setActiveTab('messages');
                                            }}
                                            className="text-left py-2 border-b border-[#E6E1DA]/30 last:border-0 last:pb-0 flex justify-between items-start gap-3 cursor-pointer hover:bg-[#FAF5EE]/60 px-2 py-1.5 rounded-xl transition-all"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <h4 className="font-extrabold text-[11px] text-[#3E3A35] truncate">{b.subject}</h4>
                                                <p className="text-[9px] text-[#9A958E] font-medium mt-0.5 line-clamp-1">
                                                    {stripHtml(b.content)}
                                                </p>
                                            </div>
                                            <span className="text-[9px] text-[#9A958E] font-bold shrink-0">
                                                {new Date(b.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Quick Practice Tips */}
                        <div className="bg-[#7C5E3F] rounded-3xl p-6 text-white text-left relative overflow-hidden shadow-md">
                            <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-xl pointer-events-none"></div>
                            <div className="space-y-4">
                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-lg text-amber-300">lightbulb</span>
                                </div>
                                <div>
                                    <h3 className="font-black text-sm uppercase tracking-wider text-amber-200">Practice Goal Tracker</h3>
                                    <p className="text-2xl font-black mt-1">15 Mins / Day</p>
                                </div>
                                <p className="text-xs text-slate-200 leading-relaxed font-semibold">
                                    Consistency is more vital than length. 15 minutes of attentive, focused daily practice produces far greater progress than 2 hours of rushed practice once a week.
                                </p>
                                <button
                                    onClick={() => {
                                        setPracticeSuiteTab('metronome');
                                        setShowPracticeSuite(true);
                                    }}
                                    className="w-full py-3 bg-white hover:bg-slate-50 text-[#7C5E3F] text-xs font-black rounded-xl transition-all shadow-xs text-center"
                                >
                                    Start Practice Room Now
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
