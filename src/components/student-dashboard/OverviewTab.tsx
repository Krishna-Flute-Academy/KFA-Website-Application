'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
    Users, PlayCircle, BookOpen, Clock, Award, Calendar,
    ClipboardList, HelpCircle, CheckCircle, ChevronRight, X, Play, Music,
    AlertTriangle, AlertCircle, Star, Sparkles, Youtube, Target, Lightbulb
} from 'lucide-react';

import { supabase } from '../../lib/supabase';
import { supabaseAuth } from '../../lib/supabase-auth';
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
    recipients?: any[];
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

interface BlogPostItem {
    id: string;
    title: string;
    slug?: string;
    excerpt?: string;
    featured_image?: string;
    target_url?: string;
}

interface YouTubeVideoItem {
    videoId: string;
    title: string;
    thumbnail?: string;
    url: string;
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

export default function OverviewTab({
    profile,
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
    setSelectedTopic,
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
}: OverviewTabProps) {
    const [latestPost, setLatestPost] = useState<BlogPostItem | null>(null);
    const [latestVideo, setLatestVideo] = useState<YouTubeVideoItem | null>(null);
    const [latestMentorNote, setLatestMentorNote] = useState<any | null>(null);

    // Fetch latest active mentor note for current student
    useEffect(() => {
        const fetchMentorNote = async () => {
            if (!profile?.id) return;
            try {
                const { data, error } = await supabaseAuth
                    .from('mentor_notes')
                    .select(`
                        id,
                        student_id,
                        title,
                        note,
                        note_type,
                        is_active,
                        created_at,
                        users:mentor_id (name)
                    `)
                    .eq('student_id', profile.id)
                    .eq('is_active', true)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (error) {
                    const { data: rawNote } = await supabaseAuth
                        .from('mentor_notes')
                        .select('*')
                        .eq('student_id', profile.id)
                        .eq('is_active', true)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    setLatestMentorNote(rawNote || null);
                } else {
                    setLatestMentorNote(data || null);
                }
            } catch (e) {
                console.warn('Error fetching latest mentor note:', e);
            }
        };
        fetchMentorNote();
    }, [profile?.id]);

    // Fetch Explore & Learn items reusing existing broadcasts, blog_posts, and youtube API
    useEffect(() => {
        let blogBc: any = null;
        let videoBc: any = null;

        if (broadcasts && broadcasts.length > 0) {
            blogBc = broadcasts.find((b: any) =>
                b.channel === 'blog' || b.recipients?.some((r: any) => r._meta && r.type === 'blog')
            );
            videoBc = broadcasts.find((b: any) =>
                b.channel === 'video' || b.recipients?.some((r: any) => r._meta && r.type === 'video')
            );
        }

        if (blogBc) {
            const meta = blogBc.recipients?.find((r: any) => r._meta && r.type === 'blog') || {};
            setLatestPost({
                id: blogBc.id,
                title: blogBc.subject,
                slug: meta.target_url || '/blog',
                excerpt: stripHtml(blogBc.content || ''),
                featured_image: meta.image_url || undefined,
                target_url: meta.target_url || '/blog'
            });
        }

        if (videoBc) {
            const meta = videoBc.recipients?.find((r: any) => r._meta && r.type === 'video') || {};
            setLatestVideo({
                videoId: videoBc.id,
                title: videoBc.subject,
                thumbnail: meta.image_url,
                url: meta.target_url || 'https://www.youtube.com/@krishnafluteacademy'
            });
        }

        const fetchLatest = async () => {
            try {
                const [blogRes, videoRes] = await Promise.allSettled([
                    !blogBc
                        ? supabase
                            .from('blog_posts')
                            .select('id, title, slug, excerpt, featured_image, published_at')
                            .eq('published', true)
                            .order('published_at', { ascending: false })
                            .limit(1)
                            .maybeSingle()
                        : Promise.resolve({ data: null }),
                    !videoBc
                        ? fetch('/api/latest-youtube-video').then(r => r.ok ? r.json() : null)
                        : Promise.resolve(null)
                ]);

                if (!blogBc && blogRes.status === 'fulfilled' && blogRes.value?.data) {
                    const b = blogRes.value.data as any;
                    setLatestPost({
                        id: b.id,
                        title: b.title,
                        slug: b.slug,
                        excerpt: b.excerpt,
                        featured_image: b.featured_image,
                        target_url: b.slug ? (b.slug.startsWith('/') || b.slug.startsWith('http') ? b.slug : `/blog/${b.slug}`) : '/blog'
                    });
                }

                if (!videoBc && videoRes.status === 'fulfilled' && videoRes.value?.videoId) {
                    const v = videoRes.value;
                    setLatestVideo({
                        videoId: v.videoId,
                        title: v.title,
                        thumbnail: v.thumbnail,
                        url: v.url || `https://www.youtube.com/watch?v=${v.videoId}`
                    });
                }
            } catch (e) {
                console.warn('Error fetching Explore & Learn items:', e);
            }
        };

        fetchLatest();
    }, [broadcasts]);

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

    // Next Class computation
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

    // Pending, Overdue, and Revision tasks
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

    const getNoticeCategoryBadge = (b: Broadcast) => {
        if (b.channel === 'fee_management') {
            return { label: 'Fee', style: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
        }
        if (b.channel === 'classroom') {
            return { label: 'Class', style: 'bg-blue-50 text-blue-800 border-blue-200' };
        }
        if (b.channel === 'tasks' || b.subject?.toLowerCase().includes('task') || b.subject?.toLowerCase().includes('assignment')) {
            return { label: 'Task', style: 'bg-amber-50 text-amber-900 border-amber-200' };
        }
        return { label: 'Announcement', style: 'bg-amber-100/80 text-amber-900 border-amber-300' };
    };

    return (
        <div className="animate-in fade-in duration-300">
            {/* ========================================================================= */}
            {/* MOBILE VIEW (< 1024px)                                                    */}
            {/* Priority Order:                                                          */}
            {/* 1. Critical Action (Fee expired)                                         */}
            {/* 2. Important Classroom Update (Live class / Attention)                   */}
            {/* 3. Compact Hero (~120–130px)                                             */}
            {/* 4. Learning Focus                                                        */}
            {/* 5. Tasks (Higher action priority)                                        */}
            {/* 6. Next Class                                                            */}
            {/* 7. Practice Goal / Practice Room                                         */}
            {/* 8. Explore & Learn (Compact tutorial + article)                          */}
            {/* 9. Notice Board                                                          */}
            {/* 10. Progress (Academic Performance)                                      */}
            {/* 11. Attendance / Level                                                   */}
            {/* 12. Recent Submissions                                                   */}
            {/* ========================================================================= */}
            <div className="lg:hidden space-y-3.5 text-left">
                {/* 1. Critical Action (Fee Expired) */}
                {(profile?.fees_classes_paid === undefined || profile?.fees_classes_paid === null || profile?.fees_classes_paid <= 0) ? (
                    <div 
                        onClick={() => setActiveTab('fees')}
                        className="p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-2 cursor-pointer active:scale-[0.99] text-left shadow-2xs"
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                            <span className="text-[11px] font-bold text-red-900 truncate">
                                Prepaid Credit Expired — Pay & Book Class
                            </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-red-600 shrink-0" />
                    </div>
                ) : profile?.fees_classes_paid === 1 ? (
                    <div 
                        onClick={() => setActiveTab('fees')}
                        className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2 cursor-pointer active:scale-[0.99] text-left"
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

                {/* 2. Important Classroom Update (Live Session / Overdue Tasks) */}
                {classroom?.is_live && (
                    <div className="bg-gradient-to-r from-red-600 via-amber-600 to-amber-500 rounded-2xl p-3 text-white shadow-xs flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <span className="text-[8px] font-black uppercase tracking-wider bg-red-600 text-white px-2 py-0.5 rounded-md animate-pulse font-mono">
                                ● Live Now
                            </span>
                            <h4 className="font-extrabold text-xs text-white mt-0.5 truncate">{classroom.name}</h4>
                            <p className="text-[10px] text-white/90 truncate">Instructor: {classroom.teacher_name}</p>
                        </div>
                        {classroom.live_meeting_link && (
                            <a
                                href={classroom.live_meeting_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3.5 py-1.5 bg-white text-red-600 hover:bg-slate-50 text-[10px] font-black rounded-xl shadow-xs shrink-0 flex items-center gap-1 cursor-pointer"
                            >
                                <PlayCircle className="w-3.5 h-3.5" />
                                <span>Join</span>
                            </a>
                        )}
                    </div>
                )}

                {overdueTasks.length > 0 && (
                    <div 
                        onClick={() => setActiveTab('tasks')}
                        className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-2 cursor-pointer active:scale-[0.99] text-left"
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

                {/* 3. Mobile Compact Hero (~120–130px max) */}
                <div
                    className="bg-cover bg-center rounded-2xl relative p-3.5 text-white shadow-xs overflow-hidden border border-[#E6E1DA]"
                    style={{ backgroundImage: "url('/flutes_custom.jpg')" }}
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-[#2B1B0E]/95 via-[#2B1B0E]/88 to-[#2B1B0E]/70 pointer-events-none" />
                    <div className="relative z-10 space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                                Flute Academy
                            </span>
                            <span className="text-[9px] font-extrabold text-amber-200 truncate max-w-[150px]">
                                {classroom ? `${classroom.name}${classroom.teacher_name ? ` • ${classroom.teacher_name}` : ''}` : levelLabel}
                            </span>
                        </div>
                        <div>
                            <h1 className="text-base font-black text-white leading-tight">
                                Namaste, {profile?.name?.split(' ')[0]}! 👋
                            </h1>
                            <p className="text-[10px] text-slate-300 truncate">
                                Here's what to focus on today.
                            </p>
                        </div>
                        <div className="pt-0.5 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setPracticeSuiteTab('metronome');
                                    setShowPracticeSuite(true);
                                }}
                                className="h-[34px] px-3 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-950 font-black text-[10px] rounded-lg shadow-xs transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                            >
                                <PlayCircle className="w-3.5 h-3.5 text-slate-950" />
                                <span>Start Practice Room</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('curriculum')}
                                className="h-[34px] px-2.5 bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold rounded-lg border border-white/20 transition-all cursor-pointer flex items-center"
                            >
                                Syllabus →
                            </button>
                        </div>
                    </div>
                </div>

                {/* 4. YOUR LEARNING FOCUS (Primary Hero on Mobile) */}
                {learningFocus && (
                    <div className="bg-white border border-[#E6E1DA] rounded-3xl overflow-hidden shadow-3xs text-left">
                        {/* Standardized Header */}
                        <div className="bg-gradient-to-r from-amber-50/60 to-orange-50/20 px-4 py-2.5 border-b border-[#E6E1DA] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-[#FAF5EE] text-[#7C5E3F] flex items-center justify-center shrink-0">
                                    <BookOpen className="w-3.5 h-3.5 text-[#7C5E3F]" />
                                </div>
                                <h3 className="font-bold text-[#3E3A35] text-xs sm:text-sm">Your Learning Focus</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setActiveTab('curriculum')}
                                className="text-[11px] font-bold text-[#7C5E3F] hover:underline flex items-center gap-0.5"
                            >
                                <span>Full Syllabus</span>
                                <ChevronRight className="w-3 h-3" />
                            </button>
                        </div>

                        <div className="p-3.5">
                            {learningFocus.lesson ? (
                                <div 
                                    onClick={() => {
                                        setSelectedTopic(learningFocus.lesson);
                                        setActiveTab('curriculum');
                                    }}
                                    className="cursor-pointer active:scale-[0.99] transition-transform space-y-2"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className={`text-[8.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full font-mono ${
                                            learningFocus.badgeType === 'teacher' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                                            learningFocus.badgeType === 'student' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                                            learningFocus.badgeType === 'continue' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                            learningFocus.badgeType === 'up_next' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                            'bg-slate-100 text-slate-700 border border-slate-200'
                                        }`}>
                                            {learningFocus.badgeLabel}
                                        </span>
                                        {learningFocus.recommendedBy && (
                                            <span className="text-[9.5px] font-bold text-amber-800 truncate">
                                                by {learningFocus.recommendedBy}
                                            </span>
                                        )}
                                    </div>

                                    <h4 className="font-black text-sm text-slate-900 leading-snug">
                                        {learningFocus.lesson.lesson_number ? `Topic ${learningFocus.lesson.lesson_number}: ` : ''}{learningFocus.lesson.title}
                                    </h4>

                                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                                        {stripHtml(learningFocus.lesson.description) || 'Practice finger coordination and mouth alignment on your bansuri.'}
                                    </p>

                                    <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                                        <span className="text-[9px] font-bold text-[#7C5E3F] bg-[#FAF5EE] px-2 py-0.5 rounded-full">
                                            {learningFocus.lesson.duration || '20 Mins'}
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                                            {learningFocus.lesson.difficulty || 'Intermediate'}
                                        </span>
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                            learningFocus.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                                        }`}>
                                            {learningFocus.status === 'completed' ? 'Completed ✓' : 'In Progress'}
                                        </span>
                                    </div>

                                    <div className="pt-1.5">
                                        <button
                                            type="button"
                                            className="w-full text-xs font-black text-slate-950 bg-[#ecb613] hover:bg-[#d49f0e] py-2 px-4 rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                        >
                                            <span>Continue Learning</span>
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-3 text-center">
                                    <p className="text-xs font-bold text-slate-700">All Assigned Lessons Completed!</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Explore your syllabus for the next module.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 5–6. Mobile Priority: Tasks & Next Class */}
                <div className="grid grid-cols-2 gap-2.5">
                    {/* 5. Tasks (High Priority) */}
                    <div 
                        onClick={() => setActiveTab('tasks')}
                        className={`border rounded-2xl p-3 text-left cursor-pointer active:scale-[0.98] ${
                            overdueTasks.length > 0 
                                ? 'bg-rose-50/60 border-rose-200' 
                                : pendingTasks.length > 0 
                                    ? 'bg-amber-50/60 border-amber-200' 
                                    : 'bg-[#FDFBF7] border-[#E6E1DA]'
                        }`}
                    >
                        <span className="text-[8px] font-extrabold text-[#9A958E] uppercase tracking-widest block font-mono">Tasks</span>
                        <h4 className="font-extrabold text-xs text-[#3E3A35] truncate mt-0.5">
                            {overdueTasks.length > 0 ? (
                                <span className="text-rose-700">{overdueTasks.length} Overdue</span>
                            ) : pendingTasks.length > 0 ? (
                                <span className="text-amber-800">{pendingTasks.length} Due</span>
                            ) : (
                                <span className="text-emerald-700">All Done ✓</span>
                            )}
                        </h4>
                        <p className="text-[9px] text-[#7C5E3F] font-bold mt-0.5">
                            {pendingTasks.length > 0 ? 'Submit Tasks →' : `${assignments.length} total`}
                        </p>
                    </div>

                    {/* 6. Next Class */}
                    <div 
                        onClick={() => setActiveTab('classroom')}
                        className="bg-[#FDFBF7] border border-[#E6E1DA] rounded-2xl p-3 text-left cursor-pointer active:scale-[0.98]"
                    >
                        <span className="text-[8px] font-extrabold text-[#9A958E] uppercase tracking-widest block font-mono">Next Class</span>
                        <h4 className="font-extrabold text-xs text-[#3E3A35] truncate mt-0.5">
                            {nextClass ? nextClass.formattedDate : (classroom ? classroom.name : 'No Class')}
                        </h4>
                        <p className="text-[9px] text-amber-800 font-bold mt-0.5 truncate">
                            {nextClass?.start_time ? formatTime(nextClass.start_time) : 'Active Batch'}
                        </p>
                    </div>
                </div>

                {/* 7. Mobile Practice Goal Tracker */}
                <div className="bg-[#7C5E3F] text-white rounded-3xl p-4 shadow-xs text-left space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-amber-200 uppercase tracking-wider">Practice Goal</span>
                        <span className="text-[8px] font-mono bg-amber-400/20 text-amber-200 px-2 py-0.5 rounded-full">Daily Habit</span>
                    </div>
                    <div>
                        <h4 className="text-lg font-black text-white">15 Mins / Day</h4>
                        <p className="text-[11px] text-slate-200 leading-snug mt-0.5">
                            Consistency builds mastery. 15 minutes of daily practice produces steady progress.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setPracticeSuiteTab('metronome');
                            setShowPracticeSuite(true);
                        }}
                        className="w-full h-[40px] px-4 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-950 text-xs font-black rounded-xl transition-all shadow-xs text-center flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                        <Music className="w-3.5 h-3.5 text-slate-950" />
                        <span>Start Practice Room →</span>
                    </button>
                </div>

                {/* 8. Mobile Mentor Note Card */}
                <div className="bg-white border border-[#E6E1DA] rounded-3xl overflow-hidden shadow-3xs text-left">
                    <div className="bg-gradient-to-r from-amber-50/60 to-orange-50/20 px-4 py-2.5 border-b border-[#E6E1DA] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-[#FAF5EE] text-[#7C5E3F] flex items-center justify-center shrink-0">
                                <Target className="w-3.5 h-3.5 text-amber-700" />
                            </div>
                            <h3 className="font-bold text-[#3E3A35] text-xs sm:text-sm">🎯 Mentor Note</h3>
                        </div>
                        <button
                            onClick={() => setActiveTab('mentor_hub')}
                            className="text-[11px] font-bold text-[#7C5E3F] hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                            <span>Mentor Hub</span>
                            <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>

                    <div className="p-3.5">
                        {latestMentorNote ? (
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-[8px] font-black uppercase tracking-wider text-amber-800 bg-amber-100/80 border border-amber-200 px-2 py-0.5 rounded font-mono">
                                        {latestMentorNote.note_type === 'focus' ? 'FOCUS THIS WEEK' : latestMentorNote.note_type?.toUpperCase()}
                                    </span>
                                </div>
                                {latestMentorNote.title && (
                                    <h4 className="font-extrabold text-xs text-slate-900 leading-snug">
                                        {latestMentorNote.title}
                                    </h4>
                                )}
                                <p className="text-xs text-slate-600 leading-relaxed font-medium line-clamp-3">
                                    {latestMentorNote.note}
                                </p>
                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                                    <span className="text-slate-400 font-medium">
                                        {latestMentorNote.users?.name || 'Krishna Sir'} · {new Date(latestMentorNote.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                                    </span>
                                    <button
                                        onClick={() => setActiveTab('mentor_hub')}
                                        className="text-[#7C5E3F] font-bold hover:underline cursor-pointer"
                                    >
                                        View in Hub →
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                                    No new guidance right now. Keep working on your current Learning Focus.
                                </p>
                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                                    <span className="text-slate-400 font-medium">Krishna Flute Academy</span>
                                    <button
                                        onClick={() => setActiveTab('mentor_hub')}
                                        className="text-[#7C5E3F] font-bold hover:underline cursor-pointer"
                                    >
                                        Mentor Hub →
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 9. Mobile News & Updates (Compact Card) */}
                <div className="bg-white border border-[#E6E1DA] rounded-3xl overflow-hidden shadow-3xs text-left">
                    <div className="bg-gradient-to-r from-amber-50/60 to-orange-50/20 px-4 py-2.5 border-b border-[#E6E1DA] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-[#FAF5EE] text-[#7C5E3F] flex items-center justify-center shrink-0">
                                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                            </div>
                            <h3 className="font-bold text-[#3E3A35] text-xs sm:text-sm">News & Updates</h3>
                        </div>
                        <a
                            href="/blog"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-[#7C5E3F] hover:underline flex items-center gap-0.5"
                        >
                            <span>More</span>
                            <ChevronRight className="w-3 h-3" />
                        </a>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {/* Latest Video */}
                        <div 
                            onClick={() => {
                                const videoUrl = latestVideo?.url || 'https://www.youtube.com/@krishnafluteacademy';
                                window.open(videoUrl, '_blank');
                            }}
                            className="p-3 flex items-center gap-2.5 active:bg-[#FAF5EE]/60 transition-colors cursor-pointer"
                        >
                            <div className="relative w-12 h-9 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                                {latestVideo?.thumbnail ? (
                                    <img 
                                        src={latestVideo.thumbnail} 
                                        alt={latestVideo.title} 
                                        className="w-full h-full object-cover" 
                                    />
                                ) : (
                                    <div className="w-full h-full bg-rose-50 flex items-center justify-center text-rose-600">
                                        <Youtube className="w-4 h-4" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                    <Play className="w-3 h-3 text-white fill-white" />
                                </div>
                            </div>
                            <div className="min-w-0 flex-1">
                                <span className="text-[8px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 border border-rose-200/60 px-1.5 py-0.2 rounded font-mono">
                                    Tutorial
                                </span>
                                <h4 className="font-bold text-xs text-slate-900 truncate mt-0.5">
                                    {latestVideo?.title || 'Bansuri Fingering & Tone Masterclass'}
                                </h4>
                            </div>
                            <span className="text-[11px] font-bold text-[#7C5E3F] shrink-0">
                                Watch →
                            </span>
                        </div>

                        {/* Latest Article */}
                        <div 
                            onClick={() => {
                                const blogUrl = latestPost?.target_url || (latestPost?.slug ? (latestPost.slug.startsWith('http') || latestPost.slug.startsWith('/') ? latestPost.slug : `/blog/${latestPost.slug}`) : '/blog');
                                window.open(blogUrl, '_blank');
                            }}
                            className="p-3 flex items-center gap-2.5 active:bg-[#FAF5EE]/60 transition-colors cursor-pointer"
                        >
                            <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200/70 text-amber-800 flex items-center justify-center shrink-0">
                                <BookOpen className="w-4 h-4 text-[#7C5E3F]" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <span className="text-[8px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100/70 border border-amber-200 px-1.5 py-0.2 rounded font-mono">
                                    Article
                                </span>
                                <h4 className="font-bold text-xs text-slate-900 truncate mt-0.5">
                                    {latestPost?.title || 'Daily Flute Riyaz: 5 Essential Tips'}
                                </h4>
                            </div>
                            <span className="text-[11px] font-bold text-[#7C5E3F] shrink-0">
                                Read →
                            </span>
                        </div>
                    </div>
                </div>

                {/* 10. Notice Board */}
                <div className="bg-white border border-[#E6E1DA] rounded-3xl overflow-hidden shadow-3xs text-left">
                    <div className="bg-gradient-to-r from-amber-50/60 to-orange-50/20 px-4 py-2.5 border-b border-[#E6E1DA] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-[#FAF5EE] text-[#7C5E3F] flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-sm text-amber-600">campaign</span>
                            </div>
                            <h3 className="font-bold text-[#3E3A35] text-xs sm:text-sm">Notice Board</h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                onNavigateToFeed?.({ type: 'category', id: 'announcements', name: 'Announcements' });
                                setActiveTab('messages');
                            }}
                            className="text-[11px] font-bold text-[#7C5E3F] hover:underline"
                        >
                            View All →
                        </button>
                    </div>

                    <div className="p-3 space-y-2">
                        {dashboardBroadcasts.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-4">No recent notices.</p>
                        ) : (
                            dashboardBroadcasts.slice(0, 3).map((b) => {
                                const cat = getNoticeCategoryBadge(b);
                                return (
                                    <div
                                        key={b.id}
                                        onClick={() => {
                                            onNavigateToFeed?.({ type: 'category', id: 'announcements', name: 'Announcements' });
                                            setActiveTab('messages');
                                        }}
                                        className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 text-left space-y-1 cursor-pointer active:scale-[0.99]"
                                    >
                                        <div className="flex items-center justify-between gap-1.5">
                                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${cat.style}`}>
                                                {cat.label}
                                            </span>
                                            <span className="text-[9.5px] text-slate-400">
                                                {new Date(b.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-xs text-slate-900 truncate">{b.subject}</h4>
                                        <p className="text-[11px] text-slate-600 line-clamp-2 leading-[1.4]">{stripHtml(b.content)}</p>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* 10. Academic Performance (Compact on Mobile) */}
                <div className="bg-white border border-[#E6E1DA] rounded-3xl p-3.5 shadow-3xs text-left">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2.5">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Academic Standing</span>
                        <span className="text-xs font-black text-[#7C5E3F]">{overallProgress}% Overall</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 rounded-xl bg-slate-50 text-[10px]">
                            <span className="text-slate-500 block">Proficiency</span>
                            <span className="font-extrabold text-[#7C5E3F]">{proficiencyProgress}%</span>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-50 text-[10px]">
                            <span className="text-slate-500 block">Tasks</span>
                            <span className="font-extrabold text-amber-600">{taskSubmissionRate ?? 0}%</span>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-50 text-[10px]">
                            <span className="text-slate-500 block">Attendance</span>
                            <span className="font-extrabold text-emerald-600">{attendanceRate ?? 0}%</span>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-50 text-[10px]">
                            <span className="text-slate-500 block">Avg Score</span>
                            <span className="font-extrabold text-blue-600">{(avgScore ?? 0)}/10</span>
                        </div>
                    </div>
                </div>

                {/* 11. Attendance / Level supporting metrics */}
                <div className="grid grid-cols-2 gap-2.5">
                    <div 
                        onClick={() => setActiveTab('attendance')}
                        className="bg-[#FDFBF7] border border-[#E6E1DA] rounded-2xl p-3 text-left cursor-pointer active:scale-[0.98]"
                    >
                        <span className="text-[8px] font-extrabold text-[#9A958E] uppercase tracking-widest block font-mono">Attendance</span>
                        <h4 className="font-extrabold text-xs text-[#3E3A35] truncate mt-0.5">
                            {attendancePct !== null ? `${attendancePct}%` : '—'}
                        </h4>
                        <p className="text-[9px] text-[#9A958E] mt-0.5">{attendanceStats.total} marked sessions</p>
                    </div>

                    <div 
                        onClick={() => setActiveTab('curriculum')}
                        className="bg-[#FDFBF7] border border-[#E6E1DA] rounded-2xl p-3 text-left cursor-pointer active:scale-[0.98]"
                    >
                        <span className="text-[8px] font-extrabold text-[#9A958E] uppercase tracking-widest block font-mono">Level</span>
                        <h4 className="font-extrabold text-xs text-[#3E3A35] truncate mt-0.5">{levelLabel}</h4>
                        <p className="text-[9px] text-[#9A958E] mt-0.5">{proficiencyProgress}% syllabus done</p>
                    </div>
                </div>

                {/* 12. Recent Submissions */}
                <div className="bg-white border border-[#E6E1DA] rounded-3xl overflow-hidden shadow-3xs text-left">
                    <div className="bg-gradient-to-r from-amber-50/60 to-orange-50/20 px-4 py-2.5 border-b border-[#E6E1DA] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-[#FAF5EE] text-[#7C5E3F] flex items-center justify-center shrink-0">
                                <ClipboardList className="w-3.5 h-3.5 text-[#7C5E3F]" />
                            </div>
                            <h3 className="font-bold text-[#3E3A35] text-xs sm:text-sm">Recent Submissions</h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => setActiveTab('tasks')}
                            className="text-[11px] font-bold text-[#7C5E3F] hover:underline"
                        >
                            View All →
                        </button>
                    </div>

                    <div className="p-3">
                        {assignments.filter(a => a.status !== 'pending').length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-4">No submissions yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {assignments.filter(a => a.status !== 'pending').slice(0, 2).map((asg) => (
                                    <div key={asg.id} className="p-2 rounded-xl bg-slate-50 flex items-center justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <h4 className="font-bold text-xs text-slate-900 truncate">{asg.title}</h4>
                                            <p className="text-[9px] text-slate-400">
                                                {asg.submitted_at ? new Date(asg.submitted_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'recently'}
                                            </p>
                                        </div>
                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">
                                            {asg.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* DESKTOP VIEW (>= 1024px)                                                  */}
            {/* EXACT ORDER & PRIORITIES:                                                 */}
            {/* 1. COMPACT ACTION REQUIRED / ATTENTION BAR (40–56px)                      */}
            {/* 2. COMPACT HERO BANNER (~130–150px)                                       */}
            {/* 3. YOUR LEARNING FOCUS (~180–220px total height, standardized header)     */}
            {/* 4. STUDENT SUMMARY (Level | Next Class | Attendance | Tasks with CTA)     */}
            {/* 5. ACADEMIC PERFORMANCE (Compact ~20-25% shorter)                         */}
            {/* 6. NOTICE BOARD (65%) + PRACTICE GOAL & EXPLORE (35%)                     */}
            {/* 7. RECENT SUBMISSIONS & FEEDBACK (standardized header)                    */}
            {/* ========================================================================= */}
            <div className="hidden lg:block space-y-5 text-left">
                {/* ═══════════════════════════════════════════════════════════════════════ */}
                {/* 1. COMPACT ACTION REQUIRED / ATTENTION BAR (40–56px)                    */}
                {/* ═══════════════════════════════════════════════════════════════════════ */}
                {/* Live Class Active Banner */}
                {classroom?.is_live && (
                    <div className="bg-gradient-to-r from-red-600 via-[#d49900] to-amber-500 rounded-2xl px-4 py-3 text-white shadow-md flex items-center justify-between gap-4 animate-in zoom-in-95 duration-300 border border-red-500/20 text-left">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center shrink-0 animate-pulse">
                                <span className="material-symbols-outlined text-lg">video_call</span>
                            </div>
                            <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-[8.5px] font-black uppercase tracking-wider bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse font-mono">
                                        ● Live Now
                                    </span>
                                    {classroom.live_session_started_at && (
                                        <span className="text-[10px] text-white/80 font-bold font-mono">
                                            Started at {new Date(classroom.live_session_started_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                                        </span>
                                    )}
                                </div>
                                <h3 className="font-extrabold text-white text-xs sm:text-sm leading-tight truncate">
                                    {classroom.name} — Instructor: {classroom.teacher_name}
                                </h3>
                            </div>
                        </div>
                        {classroom.live_meeting_link && (
                            <a
                                href={classroom.live_meeting_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-1.5 bg-white text-red-600 hover:text-red-700 hover:bg-slate-50 transition-all font-black rounded-xl text-xs shadow-sm flex items-center gap-1.5 shrink-0 uppercase tracking-wider cursor-pointer"
                            >
                                <PlayCircle className="w-4 h-4 text-red-600" />
                                <span>Join Class</span>
                            </a>
                        )}
                    </div>
                )}

                {/* Compact Fee Reminder Action Bar (48–56px) */}
                {(profile?.fees_classes_paid === undefined || profile?.fees_classes_paid === null || profile?.fees_classes_paid <= 0) && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-2.5 text-left flex items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-200 shadow-2xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                            <span className="bg-red-600 text-white text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded font-mono shrink-0">
                                Prepaid Credit Expired
                            </span>
                            <p className="text-xs font-bold text-slate-800 truncate">
                                Your prepaid class credits have expired. Please complete fee payment in advance to schedule sessions.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setActiveTab('fees')}
                            className="text-[11.5px] bg-red-600 hover:bg-red-700 text-white font-extrabold px-3.5 py-1.5 rounded-xl transition-all active:scale-95 shadow-xs shrink-0 flex items-center gap-1 cursor-pointer uppercase tracking-wider whitespace-nowrap"
                        >
                            <span>Pay & Book Class</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {/* Compact Attention / Classroom Update Strip (40–44px single-line) */}
                {(profile?.fees_classes_paid === 1 || pendingTasks.length > 0 || unreadAdminBroadcasts.length > 0) && (
                    <div className="bg-[#FAF5EE] border border-[#E6E1DA] rounded-2xl px-4 py-2 shadow-3xs flex items-center justify-between gap-3 animate-in fade-in duration-200 text-left">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-x-auto scrollbar-none py-0.5">
                            <span className="text-[9px] font-black text-[#7C5E3F] uppercase tracking-widest bg-amber-200/60 px-2 py-0.5 rounded-md font-mono shrink-0">
                                Attention
                            </span>

                            {/* 1 Class Remaining */}
                            {profile?.fees_classes_paid === 1 && (
                                <div 
                                    onClick={() => setActiveTab('fees')}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-amber-100/70 hover:bg-amber-100 text-amber-900 border border-amber-300/40 text-xs font-bold cursor-pointer transition-colors shrink-0"
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
                                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-rose-100 text-rose-900 border border-rose-300/50 text-xs font-black cursor-pointer transition-colors shrink-0"
                                    title="Click to view overdue tasks"
                                >
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
                                    <span>{overdueTasks.length} Overdue Task{overdueTasks.length > 1 ? 's' : ''}</span>
                                </div>
                            ) : dueSoonTasks.length > 0 ? (
                                <div 
                                    onClick={() => setActiveTab('tasks')}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 border border-amber-500/40 text-xs font-black cursor-pointer transition-colors shrink-0"
                                    title="Click to view tasks due soon"
                                >
                                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                                    <span>{dueSoonTasks.length} Task{dueSoonTasks.length > 1 ? 's' : ''} Due Soon</span>
                                </div>
                            ) : pendingTasks.length > 0 ? (
                                <div 
                                    onClick={() => setActiveTab('tasks')}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-800 border border-slate-200 text-xs font-bold cursor-pointer transition-colors shrink-0"
                                    title="Click to view pending assignments"
                                >
                                    <ClipboardList className="w-3.5 h-3.5 text-slate-600" />
                                    <span>{pendingTasks.length} Pending Task{pendingTasks.length > 1 ? 's' : ''}</span>
                                </div>
                            ) : null}

                            {/* Unread Admin Notice */}
                            {unreadAdminBroadcasts.length > 0 && (
                                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-lg bg-amber-50 text-[#7C5E3F] border border-[#7C5E3F]/20 text-xs font-medium min-w-0 max-w-md truncate">
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
                            className="text-[11.5px] font-bold text-[#7C5E3F] hover:underline flex items-center gap-1 shrink-0 cursor-pointer whitespace-nowrap pl-2 border-l border-[#E6E1DA]"
                        >
                            <span>View All</span>
                            <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════════════════════ */}
                {/* 2. COMPACT HERO BANNER (~130–150px)                                    */}
                {/* ═══════════════════════════════════════════════════════════════════════ */}
                <div
                    className="bg-cover bg-center rounded-3xl relative p-5 sm:p-5.5 text-white shadow-md overflow-hidden border border-[#E6E1DA] text-left"
                    style={{ backgroundImage: "url('/flutes_custom.jpg')" }}
                >
                    {/* Dark gradient overlay for readability */}
                    <div className="absolute inset-0 bg-gradient-to-r from-[#2B1B0E]/95 via-[#2B1B0E]/88 to-[#2B1B0E]/70 pointer-events-none" />

                    <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
                        <div className="space-y-1.5 max-w-xl">
                            <div className="flex items-center gap-2">
                                <span className="bg-[#FAF5EE]/90 text-[#7C5E3F] text-[8.5px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-2xs font-mono">
                                    ★ Flute Academy Student Portal
                                </span>
                                {classroom && (
                                    <span className="text-[10px] font-bold text-amber-200/90 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
                                        {classroom.name}{classroom.teacher_name ? ` • ${classroom.teacher_name}` : ''}
                                    </span>
                                )}
                            </div>

                            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
                                Namaste, {profile?.name?.split(' ')[0]}! 👋
                            </h1>

                            <p className="text-xs text-slate-200/90 font-medium line-clamp-1 leading-snug">
                                Here's what to focus on today. Focus on steady embouchure, warm breath support, and finger precision.
                            </p>
                        </div>

                        {/* CTAs: Refined Primary Gold Practice Room + Secondary View Syllabus */}
                        <div className="shrink-0 flex items-center gap-2.5">
                            <button
                                type="button"
                                onClick={() => {
                                    setPracticeSuiteTab('metronome');
                                    setShowPracticeSuite(true);
                                }}
                                className="h-[36px] px-4 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-950 font-black text-xs rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 hover:scale-[1.01] active:scale-[0.98] cursor-pointer"
                            >
                                <PlayCircle className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                                <span>Start Practice Room</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('curriculum')}
                                className="h-[36px] px-3.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 active:scale-[0.98] cursor-pointer"
                            >
                                <BookOpen className="w-3.5 h-3.5 text-white/80 shrink-0" />
                                <span>View Syllabus</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════════════ */}
                {/* 3. YOUR LEARNING FOCUS (~180–220px total height, STANDARDIZED HEADER)   */}
                {/* ═══════════════════════════════════════════════════════════════════════ */}
                <div className="bg-white border border-[#E6E1DA] rounded-3xl overflow-hidden shadow-xs text-left">
                    {/* Standardized Header matching Notice Board & Recent Submissions */}
                    <div className="bg-gradient-to-r from-amber-50/60 to-orange-50/20 px-5 py-3 border-b border-[#E6E1DA] flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-[#FAF5EE] text-[#7C5E3F] flex items-center justify-center shrink-0">
                                <BookOpen className="w-4 h-4 text-[#7C5E3F]" />
                            </div>
                            <h3 className="font-bold text-[#3E3A35] text-[15px]">Your Learning Focus</h3>
                        </div>
                        <button
                            onClick={() => setActiveTab('curriculum')}
                            className="text-[12px] sm:text-[13px] font-bold text-[#7C5E3F] hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                            <span>Full Syllabus</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="p-4 sm:p-5">
                        {learningFocus?.lesson ? (
                            <div className="space-y-3">
                                <div
                                    onClick={() => {
                                        setSelectedTopic(learningFocus.lesson);
                                        setActiveTab('curriculum');
                                    }}
                                    className="p-3.5 sm:p-4 rounded-2xl bg-[#FDFBF7] border border-[#E6E1DA] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all hover:border-[#7C5E3F]/30 cursor-pointer hover:bg-white active:scale-[0.99]"
                                >
                                    <div className="min-w-0 flex-1 text-left space-y-1.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-[8.5px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono ${
                                                learningFocus.badgeType === 'teacher' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                                                learningFocus.badgeType === 'student' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                                                learningFocus.badgeType === 'continue' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                                learningFocus.badgeType === 'up_next' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                                'bg-slate-100 text-slate-700 border border-slate-200'
                                            }`}>
                                                {learningFocus.badgeLabel}
                                            </span>
                                            {learningFocus.recommendedBy && (
                                                <span className="text-[9.5px] font-bold text-amber-800">
                                                    Recommended by {learningFocus.recommendedBy}
                                                </span>
                                            )}
                                        </div>

                                        <div>
                                            <h4 className="font-black text-sm sm:text-base text-[#3E3A35] leading-snug">
                                                {learningFocus.lesson.lesson_number ? `Topic ${learningFocus.lesson.lesson_number}: ` : ''}{learningFocus.lesson.title}
                                            </h4>
                                        </div>

                                        <p className="text-[11.5px] sm:text-xs text-[#5C5852] line-clamp-1 sm:line-clamp-2 leading-relaxed">
                                            {stripHtml(learningFocus.lesson.description) || 'Practice finger coordination and mouth alignment on your bansuri to perfect your sound projection.'}
                                        </p>

                                        <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                                            <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-[#7C5E3F] bg-[#FAF5EE] px-2 py-0.5 rounded-full">
                                                <Clock className="w-3 h-3 text-[#7C5E3F]" /> {learningFocus.lesson.duration || '20 Mins'}
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-[#5383B4] bg-[#E3ECF5] px-2 py-0.5 rounded-full">
                                                <Award className="w-3 h-3" /> {learningFocus.lesson.difficulty || 'Intermediate'}
                                            </span>
                                            <span className={`inline-flex items-center gap-1 text-[9.5px] font-bold px-2 py-0.5 rounded-full ${
                                                learningFocus.status === 'completed'
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                            }`}>
                                                {learningFocus.status === 'completed' ? 'Completed ✓' : 'In Progress'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="shrink-0 w-full sm:w-auto flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2.5">
                                        <div className="relative group hidden sm:block">
                                            <img
                                                src="/flutes_custom.jpg"
                                                alt="Active lesson spotlight"
                                                className="object-cover rounded-xl w-28 h-16 border border-[#E6E1DA]"
                                            />
                                            <div className="absolute inset-0 bg-black/10 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Play className="w-6 h-6 text-white fill-white" />
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="w-full sm:w-auto px-4 py-2 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-950 text-xs font-black rounded-xl shadow-xs inline-flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                                        >
                                            <span>Continue Learning</span>
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Secondary Companion Card if active */}
                                {learningFocus.secondarySpotlight?.lesson && (
                                    <div 
                                        onClick={() => {
                                            setSelectedTopic(learningFocus.secondarySpotlight!.lesson);
                                            setActiveTab('curriculum');
                                        }}
                                        className="p-2.5 sm:p-3 bg-amber-50/40 border border-amber-200/70 rounded-2xl flex items-center justify-between gap-3 cursor-pointer hover:bg-amber-50/80 transition-all text-left"
                                    >
                                        <div className="min-w-0 flex-1 flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-lg bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0">
                                                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[8.5px] font-black text-amber-900 uppercase font-mono tracking-wider">★ My Spotlight</span>
                                                </div>
                                                <h5 className="font-extrabold text-xs text-slate-900 truncate mt-0.5">
                                                    {learningFocus.secondarySpotlight.lesson.lesson_number ? `Topic ${learningFocus.secondarySpotlight.lesson.lesson_number}: ` : ''}{learningFocus.secondarySpotlight.lesson.title}
                                                </h5>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="px-2.5 py-1 text-[11px] font-black text-amber-900 bg-white border border-amber-300 hover:bg-amber-100 rounded-lg shadow-2xs inline-flex items-center gap-0.5 shrink-0 cursor-pointer"
                                        >
                                            Continue <ChevronRight className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="py-6 border border-dashed border-[#E6E1DA] rounded-2xl text-center bg-slate-50/50">
                                <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                                <p className="text-xs font-bold text-slate-700">Course completed!</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">Explore syllabus for next module.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════════════ */}
                {/* 4. STUDENT SUMMARY (LEVEL | NEXT CLASS | ATTENDANCE | TASKS)           */}
                {/* ═══════════════════════════════════════════════════════════════════════ */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* 1. Level Card */}
                    <div 
                        onClick={() => setActiveTab('curriculum')}
                        className="bg-[#FDFBF7] border border-[#E6E1DA] rounded-3xl p-4 sm:p-5 flex items-center gap-4 text-left shadow-2xs hover:shadow-sm hover:border-[#7C5E3F]/20 transition-all group relative overflow-hidden cursor-pointer"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-amber-500/10 transition-colors"></div>
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#F5ECE3] text-[#D49E35] flex items-center justify-center shrink-0">
                            <Award className="w-5.5 h-5.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[9px] sm:text-[10px] font-extrabold text-[#9A958E] uppercase tracking-widest">Level</p>
                            <h3 className="font-extrabold text-sm sm:text-base text-[#3E3A35] truncate mt-0.5">{levelLabel}</h3>
                            <p className="text-[9px] sm:text-[10px] font-semibold text-[#9A958E] mt-0.5">{proficiencyProgress}% syllabus done</p>
                        </div>
                    </div>

                    {/* 2. Next Class Card */}
                    <div 
                        onClick={() => setActiveTab('classroom')}
                        className={`bg-[#FDFBF7] border border-[#E6E1DA] rounded-3xl p-4 sm:p-5 flex items-center gap-4 text-left shadow-2xs hover:shadow-sm transition-all group relative overflow-hidden cursor-pointer ${classroom
                        ? classroom.type === 'temporary'
                            ? 'hover:border-emerald-500/25'
                            : 'hover:border-blue-500/25'
                        : 'hover:border-[#7C5E3F]/20'
                        }`}
                    >
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
                                Next Class
                            </p>
                            <h3 className="font-extrabold text-sm sm:text-base text-[#3E3A35] truncate mt-0.5">
                                {nextClass ? (
                                    <>
                                        {nextClass.type === 'temporary' ? '⚡ ' : '🏫 '}
                                        {nextClass.formattedDate}
                                    </>
                                ) : classroom ? classroom.name : 'No Class'}
                            </h3>
                            <p className="text-[9px] sm:text-[10px] font-semibold text-[#9A958E] mt-0.5 truncate">
                                {nextClass?.start_time ? formatTime(nextClass.start_time) : (classroom ? 'Active Batch' : 'Not Enrolled')}
                            </p>
                        </div>
                    </div>

                    {/* 3. Attendance Card */}
                    <div 
                        onClick={() => setActiveTab('attendance')}
                        className="bg-[#FDFBF7] border border-[#E6E1DA] rounded-3xl p-4 sm:p-5 flex items-center gap-4 text-left shadow-2xs hover:shadow-sm hover:border-[#7C5E3F]/20 transition-all group relative overflow-hidden cursor-pointer"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors"></div>
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                            <Calendar className="w-5.5 h-5.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[9px] sm:text-[10px] font-extrabold text-[#9A958E] uppercase tracking-widest">Attendance</p>
                            <h3 className="font-extrabold text-sm sm:text-base text-[#3E3A35] mt-0.5">{attendancePct !== null ? `${attendancePct}%` : '—'}</h3>
                            <p className="text-[9px] sm:text-[10px] font-semibold text-[#9A958E] mt-0.5">{attendanceStats.total} marked sessions</p>
                        </div>
                    </div>

                    {/* 4. Tasks Card with Higher Action Priority */}
                    <div 
                        onClick={() => setActiveTab('tasks')}
                        className={`border rounded-3xl p-4 sm:p-5 flex items-center gap-4 text-left shadow-2xs hover:shadow-sm transition-all group relative overflow-hidden cursor-pointer ${
                            overdueTasks.length > 0 
                                ? 'border-rose-300 bg-rose-50/40 hover:border-rose-400' 
                                : pendingTasks.length > 0 
                                    ? 'border-amber-300 bg-amber-50/40 hover:border-amber-400' 
                                    : 'bg-[#FDFBF7] border-[#E6E1DA] hover:border-[#7C5E3F]/20'
                        }`}
                    >
                        <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shrink-0 ${
                            overdueTasks.length > 0 
                                ? 'bg-rose-100 text-rose-700' 
                                : pendingTasks.length > 0 
                                    ? 'bg-amber-100 text-amber-800' 
                                    : 'bg-[#F5E3E6] text-[#B45366]'
                        }`}>
                            {overdueTasks.length > 0 ? <AlertTriangle className="w-5.5 h-5.5" /> : <ClipboardList className="w-5.5 h-5.5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[9px] sm:text-[10px] font-extrabold text-[#9A958E] uppercase tracking-widest">Tasks</p>
                            <h3 className="font-extrabold text-sm sm:text-base text-[#3E3A35] mt-0.5">
                                {overdueTasks.length > 0 ? (
                                    <span className="text-rose-700">{overdueTasks.length} Overdue</span>
                                ) : pendingTasks.length > 0 ? (
                                    <span className="text-amber-800">{pendingTasks.length} Tasks Due</span>
                                ) : (
                                    <span className="text-emerald-700">All Done ✓</span>
                                )}
                            </h3>
                            <div className="mt-0.5">
                                {pendingTasks.length > 0 ? (
                                    <span className="text-[10px] font-bold text-[#7C5E3F] inline-flex items-center gap-0.5 hover:underline">
                                        Submit Tasks →
                                    </span>
                                ) : (
                                    <p className="text-[9px] sm:text-[10px] font-semibold text-[#9A958E]">
                                        {assignments.length} total tasks
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════════════ */}
                {/* 5. ACADEMIC PERFORMANCE (COMPACT ~20-25% SHORTER, SECONDARY)            */}
                {/* ═══════════════════════════════════════════════════════════════════════ */}
                <div className="bg-white border border-[#E6E1DA] rounded-3xl p-5 sm:p-5.5 shadow-xs text-left">
                    <div className="flex flex-col md:flex-row gap-5 md:gap-7 items-center">
                        {/* Progress Circular Ring */}
                        <div className="flex flex-col items-center justify-center md:border-r border-slate-150 md:pr-7 shrink-0">
                            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">Overall Standing</h4>
                            <div className="relative w-20 h-20 sm:w-22 sm:h-22 flex items-center justify-center">
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
                                            stroke="#ecb613"
                                            strokeDasharray={`${2 * Math.PI * 40}`}
                                            strokeDashoffset={`${2 * Math.PI * 40 * (1 - overallProgress / 100)}`}
                                            strokeLinecap="round"
                                            fill="transparent"
                                        />
                                    )}
                                </svg>
                                <div className="absolute flex flex-col items-center justify-center">
                                    <span className="text-lg sm:text-xl font-black text-[#7C5E3F]">{overallProgress}%</span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase">Standing</span>
                                </div>
                            </div>

                            {/* Standing Status Badge */}
                            <div className="mt-2 flex items-center gap-1.5">
                                {(taskSubmissionRate === null && attendanceRate === null && avgScore === null) || overallProgress >= 80 ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-250/30 text-[9px] font-extrabold select-none">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                        Consistent
                                    </span>
                                ) : overallProgress >= 65 ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-250/30 text-[9px] font-extrabold select-none">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                        Improving
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-250/30 text-[9px] font-extrabold select-none">
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                        Attention Needed
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* 4 Components Breakdown Grid */}
                        <div className="flex-1 w-full flex flex-col justify-between space-y-2.5">
                            <div>
                                <h4 className="font-extrabold text-[#3E3A35] text-xs sm:text-sm">Academic Performance Breakdown</h4>
                                <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">
                                    Consolidated evaluation calculated across curriculum, tasks, attendance, and scores.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {/* 1. Proficiency Progress */}
                                <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 flex flex-col justify-between">
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="font-extrabold text-slate-700 flex items-center gap-1.5">
                                            <BookOpen className="w-3.5 h-3.5 text-[#7C5E3F] shrink-0" />
                                            Proficiency Progress
                                        </span>
                                        <span className="font-black text-[#7C5E3F]">{proficiencyProgress}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                        <div className="bg-[#7C5E3F] h-full rounded-full transition-all duration-500" style={{ width: `${proficiencyProgress}%` }} />
                                    </div>
                                </div>

                                {/* 2. Task Submission */}
                                <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 flex flex-col justify-between">
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                                            <ClipboardList className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                            Task Submission Rate
                                        </span>
                                        <span className="font-black text-amber-600">{taskSubmissionRate ?? 0}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                        <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${taskSubmissionRate ?? 0}%` }} />
                                    </div>
                                </div>

                                {/* 3. Attendance Rate */}
                                <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 flex flex-col justify-between">
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                            Monthly Attendance
                                        </span>
                                        <span className="font-black text-emerald-600">{attendanceRate ?? 0}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                        <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${attendanceRate ?? 0}%` }} />
                                    </div>
                                </div>

                                {/* 4. Average Score */}
                                <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 flex flex-col justify-between">
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                                            <Award className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                            Average Score
                                        </span>
                                        <span className="font-black text-blue-600">{(avgScore ?? 0)}/10</span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                        <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${(avgScore ?? 0) * 10}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════════════ */}
                {/* 6. MAIN CONTENT ROW: NOTICE BOARD & RECENT SUBMISSIONS (LEFT)           */}
                {/*    PRACTICE GOAL & MENTOR NOTE (RIGHT)                                   */}
                {/* ═══════════════════════════════════════════════════════════════════════ */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    {/* LEFT COLUMN: NOTICE BOARD + RECENT SUBMISSIONS (~70% / lg:col-span-8) */}
                    <div className="lg:col-span-8 space-y-5">
                        {/* 1. Notice Board Card */}
                        <div className="bg-white border border-[#E6E1DA] rounded-3xl overflow-hidden shadow-xs text-left">
                            {/* Standardized Header */}
                            <div className="bg-gradient-to-r from-amber-50/60 to-orange-50/20 px-5 py-3 border-b border-[#E6E1DA] flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-[#FAF5EE] text-[#7C5E3F] flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-base text-amber-600">campaign</span>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-[#3E3A35] text-[15px]">Notice Board</h3>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        onNavigateToFeed?.({ type: 'category', id: 'announcements', name: 'Announcements' });
                                        setActiveTab('messages');
                                    }}
                                    className="text-[12px] sm:text-[13px] font-bold text-[#7C5E3F] hover:underline flex items-center gap-0.5 cursor-pointer"
                                >
                                    <span>View All</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="p-4 sm:p-5 space-y-2.5">
                                {dashboardBroadcasts.length === 0 ? (
                                    <p className="text-xs text-slate-400 text-center py-6">No recent notices.</p>
                                ) : (
                                    dashboardBroadcasts.slice(0, 3).map((b) => {
                                        const cat = getNoticeCategoryBadge(b);
                                        return (
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
                                                    } else if (b.channel === 'fee_management') {
                                                        setActiveTab('fees');
                                                        return;
                                                    }
                                                    onNavigateToFeed?.({ type: 'category', id: feedId, name: feedName });
                                                    setActiveTab('messages');
                                                }}
                                                className="p-3.5 rounded-2xl border border-slate-100 hover:border-amber-300/60 hover:bg-[#FAF5EE]/50 transition-all cursor-pointer text-left space-y-1.5"
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className={`text-[10px] sm:text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${cat.style}`}>
                                                            {cat.label}
                                                        </span>
                                                        <h4 className="font-bold text-[13.5px] sm:text-[14px] text-[#3E3A35] truncate">{b.subject}</h4>
                                                    </div>
                                                    <span className="text-[11.5px] sm:text-[12px] text-slate-400 font-medium shrink-0">
                                                        {new Date(b.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                    </span>
                                                </div>
                                                <p className="text-[12.5px] sm:text-[13px] text-[#5C5852] line-clamp-2 leading-[1.45] pl-0.5">
                                                    {stripHtml(b.content)}
                                                </p>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <div className="px-5 py-2.5 border-t border-slate-100 text-right">
                                <button
                                    type="button"
                                    onClick={() => {
                                        onNavigateToFeed?.({ type: 'category', id: 'announcements', name: 'Announcements' });
                                        setActiveTab('messages');
                                    }}
                                    className="text-[12.5px] sm:text-[13px] font-bold text-[#7C5E3F] hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                                >
                                    <span>View All Notices</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* 2. Recent Submissions & Feedback Card (Directly Below Notice Board) */}
                        <div className="bg-white border border-[#E6E1DA] rounded-3xl overflow-hidden shadow-xs text-left">
                            <div className="bg-gradient-to-r from-amber-50/60 to-orange-50/20 px-5 py-3 border-b border-[#E6E1DA] flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-[#FAF5EE] text-[#7C5E3F] flex items-center justify-center shrink-0">
                                        <ClipboardList className="w-4 h-4 text-[#7C5E3F]" />
                                    </div>
                                    <h3 className="font-bold text-[#3E3A35] text-[15px]">Recent Submissions & Feedback</h3>
                                </div>
                                <button
                                    onClick={() => setActiveTab('tasks')}
                                    className="text-[12px] sm:text-[13px] font-bold text-[#7C5E3F] hover:underline flex items-center gap-0.5 cursor-pointer"
                                >
                                    <span>View All Tasks</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="p-4 sm:p-5">
                                {assignments.filter(a => a.status !== 'pending').length === 0 ? (
                                    <div className="py-6 border border-dashed border-[#E6E1DA] rounded-2xl text-center bg-slate-50/50">
                                        <HelpCircle className="w-8 h-8 text-[#9A958E] mx-auto mb-1.5" />
                                        <p className="text-xs font-bold text-[#3E3A35]">No submissions yet.</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Submit your first task attempt to see feedback reports here.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5">
                                        {assignments.filter(a => a.status !== 'pending').slice(0, 3).map((asg) => {
                                            const isReviewed = asg.status === 'reviewed' || asg.status === 'approved';
                                            return (
                                                <div 
                                                    key={asg.id} 
                                                    onClick={() => setActiveTab('tasks')}
                                                    className="p-3 sm:p-3.5 rounded-2xl bg-[#FDFBF7] border border-[#E6E1DA] hover:border-[#7C5E3F]/25 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0 flex-1 text-left">
                                                        <div className="w-8 h-8 rounded-xl bg-[#F7F2EA] text-[#7C5E3F] flex items-center justify-center shrink-0">
                                                            {isReviewed ? <Award className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <h4 className="font-extrabold text-xs sm:text-sm text-[#3E3A35] truncate">{asg.title}</h4>
                                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                                                Submitted {asg.submitted_at ? new Date(asg.submitted_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'recently'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                                        {isReviewed && asg.score !== null && asg.score !== undefined && (
                                                            <span className="text-[10px] font-black bg-[#FAF5EE] text-[#7C5E3F] px-2.5 py-1 rounded-full border border-[#7C5E3F]/10">
                                                                Score: {asg.score}/10
                                                            </span>
                                                        )}
                                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                                                            isReviewed ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'
                                                        }`}>
                                                            {asg.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: PRACTICE GOAL + MENTOR NOTE (~30% / lg:col-span-4 space-y-4) */}
                    <div className="lg:col-span-4 space-y-4">
                        {/* 1. Practice Goal Tracker Card */}
                        <div className="bg-[#7C5E3F] rounded-3xl p-5 text-white text-left relative overflow-hidden shadow-md space-y-3">
                            <div className="absolute bottom-0 right-0 w-28 h-28 bg-white/5 rounded-full blur-xl pointer-events-none"></div>
                            
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-sm text-amber-300">lightbulb</span>
                                    </div>
                                    <h3 className="font-bold text-xs uppercase tracking-wider text-amber-200">Practice Goal</h3>
                                </div>
                                <span className="text-[8.5px] font-bold tracking-widest uppercase bg-amber-400/20 text-amber-200 px-2 py-0.5 rounded-full font-mono">
                                    Daily Habit
                                </span>
                            </div>

                            <div>
                                <p className="text-2xl font-black text-white">15 Mins / Day</p>
                                <p className="text-[11.5px] text-slate-200 leading-snug font-medium mt-1">
                                    Consistency builds mastery on the bansuri. 15 minutes of attentive daily practice produces steady progress.
                                </p>
                            </div>

                            <div className="pt-2 flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPracticeSuiteTab('metronome');
                                        setShowPracticeSuite(true);
                                    }}
                                    className="w-full sm:w-auto min-w-[220px] sm:min-w-[250px] h-[42px] px-5 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-950 text-xs font-black rounded-xl transition-all shadow-xs hover:shadow-md text-center flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                                >
                                    <Music className="w-3.5 h-3.5 text-slate-950" />
                                    <span>Start Practice Room →</span>
                                </button>
                            </div>
                        </div>

                        {/* 2. Compact Mentor Guidance Card */}
                        <div className="bg-white border border-[#E6E1DA] rounded-3xl overflow-hidden shadow-xs text-left">
                            <div className="bg-gradient-to-r from-amber-50/60 to-orange-50/20 px-4 py-2.5 border-b border-[#E6E1DA] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-lg bg-[#FAF5EE] text-[#7C5E3F] flex items-center justify-center shrink-0">
                                        <Target className="w-3.5 h-3.5 text-amber-700" />
                                    </div>
                                    <h3 className="font-bold text-[#3E3A35] text-xs sm:text-sm">🎯 Mentor Note</h3>
                                </div>
                                <button
                                    onClick={() => setActiveTab('mentor_hub')}
                                    className="text-[11px] font-bold text-[#7C5E3F] hover:underline flex items-center gap-0.5 cursor-pointer"
                                >
                                    <span>Mentor Hub</span>
                                    <ChevronRight className="w-3 h-3" />
                                </button>
                            </div>

                            <div className="p-4">
                                {latestMentorNote ? (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[8.5px] font-black uppercase tracking-wider text-amber-800 bg-amber-100/80 border border-amber-200 px-2 py-0.5 rounded font-mono">
                                                {latestMentorNote.note_type === 'focus' ? 'FOCUS THIS WEEK' : latestMentorNote.note_type?.toUpperCase()}
                                            </span>
                                        </div>
                                        {latestMentorNote.title && (
                                            <h4 className="font-extrabold text-xs text-slate-900 leading-snug">
                                                {latestMentorNote.title}
                                            </h4>
                                        )}
                                        <p className="text-xs text-slate-600 leading-relaxed font-medium line-clamp-3">
                                            {latestMentorNote.note}
                                        </p>
                                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10.5px]">
                                            <span className="text-slate-400 font-medium">
                                                {latestMentorNote.users?.name || 'Krishna Sir'} · {new Date(latestMentorNote.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                                            </span>
                                            <button
                                                onClick={() => setActiveTab('mentor_hub')}
                                                className="text-[#7C5E3F] font-bold hover:underline cursor-pointer"
                                            >
                                                View in Mentor Hub →
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-600 font-medium leading-relaxed">
                                            No new guidance right now. Keep working on your current Learning Focus.
                                        </p>
                                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10.5px]">
                                            <span className="text-slate-400 font-medium">Krishna Flute Academy</span>
                                            <button
                                                onClick={() => setActiveTab('mentor_hub')}
                                                className="text-[#7C5E3F] font-bold hover:underline cursor-pointer"
                                            >
                                                Mentor Hub →
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 3. News & Updates Card (Tutorial & Articles) */}
                        <div className="bg-white border border-[#E6E1DA] rounded-3xl overflow-hidden shadow-xs text-left">
                            <div className="bg-gradient-to-r from-amber-50/60 to-orange-50/20 px-4 py-2.5 border-b border-[#E6E1DA] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-lg bg-[#FAF5EE] text-[#7C5E3F] flex items-center justify-center shrink-0">
                                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                    </div>
                                    <h3 className="font-bold text-[#3E3A35] text-xs sm:text-sm">News & Updates</h3>
                                </div>
                                <a
                                    href="/blog"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] font-bold text-[#7C5E3F] hover:underline flex items-center gap-0.5"
                                >
                                    <span>More</span>
                                    <ChevronRight className="w-3 h-3" />
                                </a>
                            </div>

                            <div className="divide-y divide-slate-100">
                                {/* Latest Tutorial / Video */}
                                <div 
                                    onClick={() => {
                                        const videoUrl = latestVideo?.url || 'https://www.youtube.com/@krishnafluteacademy';
                                        window.open(videoUrl, '_blank');
                                    }}
                                    className="p-3 hover:bg-[#FAF5EE]/50 transition-colors cursor-pointer flex items-center gap-3 group"
                                >
                                    <div className="relative w-14 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                                        {latestVideo?.thumbnail ? (
                                            <img 
                                                src={latestVideo.thumbnail} 
                                                alt={latestVideo.title} 
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-rose-50 flex items-center justify-center text-rose-600">
                                                <Youtube className="w-5 h-5" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                            <Play className="w-3.5 h-3.5 text-white fill-white" />
                                        </div>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[8px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 border border-rose-200/60 px-1.5 py-0.2 rounded font-mono">
                                                Tutorial
                                            </span>
                                            <span className="text-[9.5px] text-slate-400 font-medium">Video</span>
                                        </div>
                                        <h4 className="font-bold text-xs text-slate-900 truncate mt-0.5 group-hover:text-amber-800 transition-colors">
                                            {latestVideo?.title || 'Bansuri Fingering & Tone Masterclass'}
                                        </h4>
                                    </div>
                                    <span className="text-[11px] font-bold text-[#7C5E3F] group-hover:translate-x-0.5 transition-transform shrink-0">
                                        Watch →
                                    </span>
                                </div>

                                {/* Latest Blog / Article */}
                                <div 
                                    onClick={() => {
                                        const blogUrl = latestPost?.target_url || (latestPost?.slug ? (latestPost.slug.startsWith('http') || latestPost.slug.startsWith('/') ? latestPost.slug : `/blog/${latestPost.slug}`) : '/blog');
                                        window.open(blogUrl, '_blank');
                                    }}
                                    className="p-3 hover:bg-[#FAF5EE]/50 transition-colors cursor-pointer flex items-center gap-3 group"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200/70 text-amber-800 flex items-center justify-center shrink-0">
                                        <BookOpen className="w-4.5 h-4.5 text-[#7C5E3F]" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[8px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100/70 border border-amber-200 px-1.5 py-0.2 rounded font-mono">
                                                Article
                                            </span>
                                            <span className="text-[9.5px] text-slate-400 font-medium">3 min read</span>
                                        </div>
                                        <h4 className="font-bold text-xs text-slate-900 truncate mt-0.5 group-hover:text-amber-800 transition-colors">
                                            {latestPost?.title || 'Daily Flute Riyaz: 5 Essential Tips'}
                                        </h4>
                                    </div>
                                    <span className="text-[11px] font-bold text-[#7C5E3F] group-hover:translate-x-0.5 transition-transform shrink-0">
                                        Read →
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
