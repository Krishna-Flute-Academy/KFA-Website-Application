'use client';

import React from 'react';
import { 
    Users, PlayCircle, BookOpen, Clock, Award, Calendar, 
    ClipboardList, HelpCircle, CheckCircle, ChevronRight, X, Play, Music, Info, FileText, Video,
    AlertTriangle, AlertCircle
} from 'lucide-react';

import { getStudentFeeStatus } from '../../lib/fee-utils';

const stripHtml = (html: string) => {
    if (!html) return '';
    return html.replace(/<[^>]*>?/gm, '');
};

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
}

interface ClassroomInfo {
    id: string;
    name: string;
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
    setActiveTab: (tab: 'overview' | 'curriculum' | 'tasks' | 'messages' | 'attendance' | 'library') => void;
    handleDismissAdminBroadcast: (id: string) => void;
    levelLabel: string;
    attendancePct: number | null;
    attendanceStats: { present: number; absent: number; late: number; excused: number; total: number };
    featuredLesson: any | null;
    setSelectedTopic: (topic: any) => void;
    setShowMaterialPopup: (show: boolean) => void;
    setPracticeSuiteTab: (tab: 'metronome' | 'drums') => void;
    setShowPracticeSuite: (show: boolean) => void;
    classmates: Classmate[];
}

/**
 * OverviewTab component renders the primary dashboard overview for student portals.
 */
export default function OverviewTab({
    profile,
    payments,
    classroom,
    assignments,
    broadcasts,
    unreadAdminBroadcasts,
    setActiveTab,
    handleDismissAdminBroadcast,
    levelLabel,
    attendancePct,
    attendanceStats,
    featuredLesson,
    setSelectedTopic,
    setShowMaterialPopup,
    setPracticeSuiteTab,
    setShowPracticeSuite,
    classmates
}: OverviewTabProps) {
    const dashboardBroadcasts = React.useMemo(() => {
        return broadcasts.filter(b => 
            b.channel === 'announcements' || 
            b.channel === 'fee_management' || 
            (!b.channel && b.sender?.role === 'admin')
        );
    }, [broadcasts]);

    const feeAlert = React.useMemo(() => {
        if (!profile || !profile.fees_collection_date || profile.fees_basis !== 'monthly') {
            return null;
        }

        const feeStatus = getStudentFeeStatus(
            profile.fees_basis,
            Number(profile.fees_collection_date),
            payments
        );

        if (!feeStatus || feeStatus.status === 'good') {
            return null; // Hide the reminder for that month
        }

        if (feeStatus.status === 'upcoming') {
            return {
                type: 'upcoming',
                title: 'Upcoming Fee Payment',
                message: `Your monthly fee is due on ${feeStatus.formattedDueDate}.`
            };
        } else if (feeStatus.status === 'due') {
            return {
                type: 'due',
                title: 'Fee Payment Due Today',
                message: `Your monthly fee is due today.`
            };
        } else { // overdue
            return {
                type: 'overdue',
                title: 'Payment Overdue',
                message: `Your monthly fee is overdue. Please submit your fees.`
            };
        }
    }, [profile, payments]);

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {/* Fee Reminder Banner */}
            {feeAlert && (
                <div className={`relative overflow-hidden rounded-2xl border p-5 shadow-lg flex items-center justify-between gap-6 animate-in slide-in-from-top-4 duration-300 ${
                    feeAlert.type === 'overdue'
                        ? 'bg-gradient-to-r from-rose-50 to-red-50/75 dark:from-red-950/20 dark:to-rose-950/10 border-red-200 dark:border-red-900/30 text-red-900 dark:text-red-300'
                        : feeAlert.type === 'due'
                            ? 'bg-gradient-to-r from-amber-50 to-rose-50/80 dark:from-amber-955/20 dark:to-rose-955/20 border-amber-200 dark:border-amber-900/30 text-amber-900 dark:text-amber-300'
                            : 'bg-gradient-to-r from-amber-50/50 to-orange-50/30 dark:from-amber-950/10 dark:to-orange-950/5 border-amber-100 dark:border-amber-900/20 text-amber-800 dark:text-amber-400'
                }`}>
                    {/* Background glass/glow detail */}
                    <div className="absolute -right-12 -top-12 w-32 h-32 rounded-full bg-white/20 dark:bg-white/5 blur-2xl pointer-events-none" />
                    
                    <div className="flex items-center gap-4 text-left relative z-10">
                        <div className={`flex items-center justify-center size-12 rounded-2xl border shrink-0 ${
                            feeAlert.type === 'overdue'
                                ? 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 animate-pulse'
                                : feeAlert.type === 'due'
                                    ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800/40 text-amber-600 dark:text-amber-450 animate-bounce'
                                    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/20 text-amber-600 dark:text-amber-550'
                        }`}>
                            {feeAlert.type === 'overdue' ? (
                                <AlertTriangle className="size-6 shrink-0" />
                            ) : feeAlert.type === 'due' ? (
                                <AlertCircle className="size-6 shrink-0" />
                            ) : (
                                <Clock className="size-6 shrink-0" />
                            )}
                        </div>
                        
                        <div>
                            <h4 className="text-sm font-black tracking-tight leading-none mb-1.5 uppercase">
                                {feeAlert.title}
                            </h4>
                            <p className="text-xs font-semibold opacity-90 leading-relaxed">
                                {feeAlert.message}
                            </p>
                        </div>
                    </div>
                </div>
            )}
            {/* Admin Broadcast Alert Banner */}
            {unreadAdminBroadcasts.length > 0 && (
                <div className="bg-[#FAF5EE] border-l-4 border-[#7C5E3F] rounded-2xl p-4 sm:p-5 shadow-xs flex items-start justify-between gap-4 animate-in slide-in-from-top-4 duration-300">
                    <div className="flex items-start gap-3 text-left">
                        <div className="w-9 h-9 rounded-full bg-[#FAF5EE] border border-[#7C5E3F]/20 text-[#7C5E3F] flex items-center justify-center shrink-0 mt-0.5">
                            <span className="material-symbols-outlined text-lg">campaign</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-[#7C5E3F] uppercase tracking-wider bg-amber-100 dark:bg-amber-950/20 px-2 py-0.5 rounded">Important Notice</span>
                                <span className="text-[9px] font-bold text-slate-400">
                                    {new Date(unreadAdminBroadcasts[0].created_at).toLocaleDateString()}
                                </span>
                            </div>
                            <h4 className="font-extrabold text-slate-800 text-sm mt-1 truncate">{unreadAdminBroadcasts[0].subject}</h4>
                            <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                                {unreadAdminBroadcasts[0].content}
                            </p>
                            <button 
                                onClick={() => setActiveTab('messages')}
                                className="text-xs font-black text-[#7C5E3F] hover:text-[#5c442c] transition-colors mt-2 flex items-center gap-0.5"
                            >
                                Read full announcement <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                    <button 
                        onClick={() => handleDismissAdminBroadcast(unreadAdminBroadcasts[0].id)}
                        className="text-[#9A958E] hover:text-[#7C5E3F] transition-colors p-1"
                        aria-label="Dismiss Alert"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Pending Tasks Alert Banner */}
            {assignments.filter(a => a.status === 'pending').length > 0 && (
                <div className="bg-gradient-to-r from-amber-500/10 to-amber-600/10 border border-amber-200 dark:border-amber-900/30 rounded-3xl p-5 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <span className="material-symbols-outlined text-xl">assignment_late</span>
                        </div>
                        <div className="space-y-0.5">
                            <h4 className="text-sm font-black text-slate-800 dark:text-white">
                                You have {assignments.filter(a => a.status === 'pending').length} pending tasks
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                Submit before the due date.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setActiveTab('tasks')}
                        className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-full text-xs transition-all flex items-center justify-center gap-1.5 hover:scale-102 active:scale-98 shadow-xs cursor-pointer uppercase tracking-wider font-mono shrink-0"
                    >
                        Go to Tasks
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
            
            {/* Welcome Banner Card */}
            <div 
                className="bg-cover bg-center rounded-3xl relative p-6 sm:p-8 text-white min-h-[240px] md:min-h-[280px] flex items-center shadow-md overflow-hidden border border-[#E6E1DA] text-left"
                style={{ backgroundImage: "url('/flutes_custom.jpg')" }}
            >
                {/* Overlay to ensure text readability */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#2B1B0E]/95 via-[#2B1B0E]/75 to-transparent pointer-events-none"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 w-full">
                    <div className="space-y-4 max-w-xl">
                        <div>
                            <span className="bg-[#FAF5EE] text-[#7C5E3F] text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-xs">
                                ★ Flute Academy Student Portal
                            </span>
                        </div>
                        <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight text-white">
                            Namaste, {profile?.name?.split(' ')[0]}!
                        </h1>
                        <p className="text-sm font-medium text-slate-200 leading-relaxed italic">
                            "Daily Practice Tip: Blow gently with a relaxed embouchure. Focus on a clear sound, warm breath support, and precise finger placement."
                        </p>
                        
                        {classroom && (
                            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 text-white w-fit text-left shrink-0">
                                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                                    <Users className="w-4 h-4 text-amber-350" />
                                </div>
                                <div>
                                    <p className="text-[8px] font-bold text-white/60 uppercase tracking-wider leading-none">Active Batch</p>
                                    <p className="text-xs font-black mt-0.5">{classroom.name} · {classroom.teacher_name}</p>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="shrink-0 flex flex-col sm:flex-row md:flex-col gap-3 w-full sm:w-auto md:w-auto">
                        <button 
                            onClick={() => {
                                setPracticeSuiteTab('metronome');
                                setShowPracticeSuite(true);
                            }}
                            className="px-6 py-3.5 bg-[#d49900] hover:bg-[#b58300] text-white font-extrabold text-xs rounded-full shadow-lg shadow-orange-950/20 hover:scale-102 active:scale-98 transition-all flex items-center justify-center gap-2 group w-full sm:w-auto"
                        >
                            <PlayCircle className="w-4 h-4" />
                            Start Practice Room
                        </button>
                        <button 
                            onClick={() => setActiveTab('curriculum')}
                            className="px-6 py-3.5 bg-white/10 hover:bg-white/15 text-white border border-white/15 font-extrabold text-xs rounded-full backdrop-blur-md transition-all flex items-center justify-center gap-2 active:scale-98 w-full sm:w-auto"
                        >
                            <BookOpen className="w-4 h-4 text-white/80" />
                            View Syllabus
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
                <div className="bg-[#FDFBF7] border border-[#E6E1DA] rounded-3xl p-4 sm:p-5 flex items-center gap-4 text-left shadow-2xs hover:shadow-sm hover:border-[#7C5E3F]/20 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-orange-500/10 transition-colors"></div>
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#E3ECF5] text-[#5383B4] flex items-center justify-center shrink-0">
                        <Clock className="w-5.5 h-5.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[9px] sm:text-[10px] font-extrabold text-[#9A958E] uppercase tracking-widest">My Batch</p>
                        <h3 className="font-extrabold text-sm sm:text-base text-[#3E3A35] truncate mt-0.5">{classroom?.name || 'Not Enrolled'}</h3>
                        <p className="text-[9px] sm:text-[10px] font-semibold text-[#9A958E] mt-0.5">Active Class Session</p>
                    </div>
                </div>

                {/* Attendance Percentage */}
                <div className="bg-[#FDFBF7] border border-[#E6E1DA] rounded-3xl p-4 sm:p-5 flex items-center gap-4 text-left shadow-2xs hover:shadow-sm hover:border-[#7C5E3F]/20 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors"></div>
                    
                    {attendancePct !== null ? (
                        <div className="relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center shrink-0">
                            {/* Circular Progress Ring */}
                            <svg className="w-full h-full transform -rotate-90">
                                {/* Background Circle */}
                                <circle 
                                    cx="50%" 
                                    cy="50%" 
                                    r="40%" 
                                    strokeWidth="8%" 
                                    stroke="#f1f5f9" 
                                    fill="transparent" 
                                />
                                {/* Progress Circle */}
                                <circle 
                                    cx="50%" 
                                    cy="50%" 
                                    r="40%" 
                                    strokeWidth="8%" 
                                    stroke="url(#emeraldGradient)" 
                                    strokeDasharray={`${2 * Math.PI * 40}`}
                                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - attendancePct / 100)}`}
                                    strokeLinecap="round"
                                    fill="transparent" 
                                />
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

            {/* Core Dashboard split sections */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left column: Weekly Curriculum & Recent Submissions */}
                <div className="lg:col-span-2 space-y-6">
                    {/* This Week's Curriculum */}
                    <div className="bg-white border border-[#E6E1DA] rounded-3xl overflow-hidden shadow-sm text-left">
                        <div className="px-6 py-5 border-b border-[#E6E1DA] flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-[#FAF5EE] text-[#7C5E3F] flex items-center justify-center">
                                    <BookOpen className="w-4.5 h-4.5" />
                                </div>
                                <div>
                                    <h3 className="font-black text-[#3E3A35] text-sm md:text-base">This Week's Curriculum</h3>
                                    <p className="text-[10px] text-slate-500 mt-0.5">Focus: Mastering the bansuri key scales & alankars</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setActiveTab('curriculum')} 
                                className="text-xs font-bold text-[#7C5E3F] hover:text-[#5c442c] transition-colors flex items-center gap-0.5"
                            >
                                View Full Syllabus <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        <div className="p-6">
                            {featuredLesson ? (
                                <div className="space-y-4">
                                    <div 
                                        onClick={() => {
                                            const url = featuredLesson.material_url || featuredLesson.link_url;
                                            if (url) {
                                                setSelectedTopic(featuredLesson);
                                                setShowMaterialPopup(true);
                                            } else {
                                                alert('No materials uploaded for this topic yet.');
                                            }
                                        }}
                                        className="p-5 rounded-2xl bg-[#FDFBF7] border border-[#E6E1DA] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 transition-all hover:border-[#7C5E3F]/30 cursor-pointer hover:bg-white active:scale-[0.99]"
                                    >
                                        <div className="min-w-0 flex-1 text-left space-y-3">
                                            <div>
                                                <span className="text-[9px] font-extrabold text-[#7C5E3F] bg-[#FAF5EE] px-2.5 py-1 rounded-full uppercase tracking-wider">Spotlight Lesson</span>
                                                <h4 className="font-black text-base text-[#3E3A35] mt-2 leading-snug">
                                                    Lesson {featuredLesson.lesson_number}: {featuredLesson.title}
                                                </h4>
                                            </div>
                                            <p className="text-xs text-[#5C5852] line-clamp-2 leading-relaxed">{stripHtml(featuredLesson.description) || 'Practice your finger coordination and mouth alignment on your bansuri to perfect your sound projection.'}</p>
                                            
                                            <div className="flex items-center gap-2 pt-1 flex-wrap">
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#7C5E3F] bg-[#FAF5EE] px-2.5 py-1 rounded-full">
                                                    <Clock className="w-3 h-3 text-[#7C5E3F]" /> {featuredLesson.duration || '20 Mins'}
                                                </span>
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#5383B4] bg-[#E3ECF5] px-2.5 py-1 rounded-full">
                                                    <Award className="w-3 h-3" /> {featuredLesson.difficulty || 'Intermediate'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="shrink-0 w-full sm:w-auto relative group">
                                            <img 
                                                src="/flutes_custom.jpg" 
                                                alt="Active lesson spotlight" 
                                                className="object-cover rounded-2xl w-full sm:w-36 h-24 border border-[#E6E1DA]" 
                                            />
                                            <div className="absolute inset-0 bg-black/10 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Play className="w-8 h-8 text-white fill-white" />
                                            </div>
                                        </div>
                                    </div>

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
                                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                                                        isReviewed ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'
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
                    {/* Instructor Message Board */}
                    <div className="bg-white border border-[#E6E1DA] rounded-3xl overflow-hidden shadow-sm text-left">
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50/20 px-6 py-5 border-b border-[#E6E1DA] flex items-center justify-between">
                            <h3 className="font-black text-[#3E3A35] text-sm flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg text-amber-500 shrink-0">campaign</span>
                                Instructor Notice Board
                            </h3>
                        </div>

                        <div className="p-6 divide-y divide-[#E6E1DA]/40 max-h-[400px] overflow-y-auto pr-1">
                            {dashboardBroadcasts.length === 0 ? (
                                <div className="py-12 text-center text-slate-400">
                                    <p className="text-xs">No announcements or fee messages posted yet.</p>
                                </div>
                            ) : (
                                dashboardBroadcasts.map((b) => (
                                    <div key={b.id} className="py-4 first:pt-0 last:pb-0 text-left space-y-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <h4 className="font-extrabold text-xs text-[#3E3A35] truncate">{b.subject}</h4>
                                                <p className="text-[9px] text-[#9A958E] font-semibold mt-0.5">
                                                    By {b.sender?.name || 'Academy Instructor'} · {new Date(b.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </p>
                                            </div>
                                            <span className="bg-[#FAF5EE] text-[#7C5E3F] text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-[#7C5E3F]/10 shrink-0">
                                                {b.channel === 'fee_management' ? 'Fees' : (b.channel ? b.channel.replace('_', ' ') : 'Announcement')}
                                            </span>
                                        </div>

                                        <p className="text-[11px] text-[#5C5852] leading-relaxed whitespace-pre-line">{b.content}</p>
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
    );
}
