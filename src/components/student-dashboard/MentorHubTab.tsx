'use client';

import React, { useState, useMemo } from 'react';
import { 
    Users, ClipboardList, CheckCircle2, Clock, MessageSquare, 
    Search, Award, Star, Video, ExternalLink, Filter, 
    Send, ChevronRight, AlertCircle, Sparkles, X, Loader2, Check
} from 'lucide-react';
import { supabaseAuth } from '../../lib/supabase-auth';

interface Mentee {
    id: string;
    student_id: string;
    name: string;
    email: string;
    level?: string;
    profile_pic_url?: string | null;
    classroom_name?: string;
}

interface MenteeSubmission {
    id: string; // assignment_students id
    assignment_id: string;
    student_id: string;
    student_name: string;
    student_email: string;
    student_level?: string;
    student_pic?: string | null;
    assignment_title: string;
    assignment_description?: string;
    due_date?: string;
    status: 'pending' | 'submitted' | 'reviewed' | 'approved' | 'needs_revision';
    score?: number | null;
    proficiency_level?: string | null;
    feedback_text?: string | null;
    video_url?: string | null;
    submitted_at?: string | null;
    reviewed_at?: string | null;
    reviewed_by?: string | null;
}

interface MentorHubTabProps {
    profile: any;
    mentees: Mentee[];
    submissions: MenteeSubmission[];
    onRefreshSubmissions: () => Promise<void>;
    onNavigateToChat: (studentId: string, studentName: string) => void;
}

export default function MentorHubTab({
    profile,
    mentees,
    submissions,
    onRefreshSubmissions,
    onNavigateToChat
}: MentorHubTabProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'reviewed'>('all');
    const [selectedTab, setSelectedTab] = useState<'tasks' | 'mentees'>('tasks');
    
    // Review Modal State
    const [selectedSubmission, setSelectedSubmission] = useState<MenteeSubmission | null>(null);
    const [reviewScore, setReviewScore] = useState<string>('');
    const [reviewFeedback, setReviewFeedback] = useState<string>('');
    const [reviewProficiency, setReviewProficiency] = useState<string>('Good');
    const [reviewStatus, setReviewStatus] = useState<'approved' | 'needs_revision'>('approved');
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Summary Statistics
    const stats = useMemo(() => {
        const totalMentees = mentees.length;
        const pendingCount = submissions.filter(s => s.status === 'submitted' || s.status === 'pending').length;
        const reviewedCount = submissions.filter(s => s.status === 'approved' || s.status === 'reviewed' || s.status === 'needs_revision').length;
        
        const scores = submissions.filter(s => typeof s.score === 'number').map(s => Number(s.score));
        const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 'N/A';

        return { totalMentees, pendingCount, reviewedCount, avgScore };
    }, [mentees, submissions]);

    // Filtered submissions
    const filteredSubmissions = useMemo(() => {
        return submissions.filter(sub => {
            const matchesSearch = 
                sub.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                sub.assignment_title.toLowerCase().includes(searchQuery.toLowerCase());

            if (!matchesSearch) return false;

            if (statusFilter === 'pending') {
                return sub.status === 'submitted' || sub.status === 'pending';
            }
            if (statusFilter === 'reviewed') {
                return sub.status === 'approved' || sub.status === 'reviewed' || sub.status === 'needs_revision';
            }
            return true;
        });
    }, [submissions, searchQuery, statusFilter]);

    // Open review modal
    const handleOpenReview = (sub: MenteeSubmission) => {
        setSelectedSubmission(sub);
        setReviewScore(sub.score !== undefined && sub.score !== null ? String(sub.score) : '85');
        setReviewFeedback(sub.feedback_text || '');
        setReviewProficiency(sub.proficiency_level || 'Good');
        setReviewStatus(sub.status === 'needs_revision' ? 'needs_revision' : 'approved');
        setErrorMsg('');
        setSuccessMsg('');
    };

    // Save evaluation
    const handleSaveReview = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSubmission) return;

        setIsSaving(true);
        setErrorMsg('');
        setSuccessMsg('');

        try {
            const scoreNum = parseFloat(reviewScore);
            if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
                throw new Error('Please enter a valid score between 0 and 100.');
            }

            const now = new Date().toISOString();

            // Update assignment_students row in Supabase
            const { error: updateError } = await supabaseAuth
                .from('assignment_students')
                .update({
                    status: reviewStatus,
                    score: scoreNum,
                    proficiency_level: reviewProficiency,
                    feedback_text: reviewFeedback.trim(),
                    reviewed_by: profile.id,
                    reviewed_at: now,
                    reviewer_role: 'mentor'
                })
                .eq('id', selectedSubmission.id);

            if (updateError) throw updateError;

            // Notify mentee
            try {
                const notifMessage = `Your mentor ${profile.name} reviewed your task "${selectedSubmission.assignment_title}". Grade: ${scoreNum}/100. Status: ${reviewStatus === 'approved' ? 'Approved' : 'Needs Revision'}`;
                await supabaseAuth.from('notifications').insert({
                    user_id: selectedSubmission.student_id,
                    title: reviewStatus === 'approved' ? 'Task Approved by Mentor' : 'Task Revision Requested by Mentor',
                    message: notifMessage,
                    type: 'messages',
                    is_read: false,
                    created_at: now
                });
            } catch (notifErr) {
                console.error('Failed to send notification to mentee:', notifErr);
            }

            setSuccessMsg('Task review and marks saved successfully!');
            await onRefreshSubmissions();

            setTimeout(() => {
                setSelectedSubmission(null);
                setSuccessMsg('');
            }, 1200);
        } catch (err: any) {
            setErrorMsg(err.message || 'Failed to submit review. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-amber-900 via-[#7C5E3F] to-amber-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-200 text-xs font-bold mb-2 border border-amber-400/30">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Senior Student Mentor Portal</span>
                        </div>
                        <h2 className="text-2xl font-black tracking-tight">Welcome, Mentor {profile?.name || ''}</h2>
                        <p className="text-amber-100/80 text-xs mt-1 max-w-xl">
                            Guide your fellow academy students, evaluate task submissions, provide constructive feedback, and award marks.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSelectedTab('tasks')}
                            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                                selectedTab === 'tasks'
                                    ? 'bg-white text-[#7C5E3F] shadow-sm'
                                    : 'bg-white/10 hover:bg-white/20 text-white'
                            }`}
                        >
                            Task Reviews ({stats.pendingCount} Pending)
                        </button>
                        <button
                            onClick={() => setSelectedTab('mentees')}
                            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                                selectedTab === 'mentees'
                                    ? 'bg-white text-[#7C5E3F] shadow-sm'
                                    : 'bg-white/10 hover:bg-white/20 text-white'
                            }`}
                        >
                            My Mentees ({stats.totalMentees})
                        </button>
                    </div>
                </div>
            </div>

            {/* Metrics Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Assigned Mentees</span>
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                            <Users className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-slate-800 dark:text-white">{stats.totalMentees}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Students guiding</p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Pending Review</span>
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                            <Clock className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{stats.pendingCount}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Submissions waiting</p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Evaluated Tasks</span>
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.reviewedCount}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Tasks reviewed</p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Avg Marks Awarded</span>
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                            <Award className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{stats.avgScore}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Out of 100</p>
                </div>
            </div>

            {/* TAB CONTENT: TASKS REVIEW */}
            {selectedTab === 'tasks' && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs text-left">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                        <div>
                            <h3 className="text-base font-extrabold text-slate-800 dark:text-white">Mentee Task Submissions</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Review recordings, grade marks, and send notes to your assigned mentees.</p>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="relative">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Search by mentee name or task..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100 w-full sm:w-60"
                                />
                            </div>

                            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
                                <button
                                    onClick={() => setStatusFilter('all')}
                                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${statusFilter === 'all' ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-2xs' : 'text-slate-500'}`}
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => setStatusFilter('pending')}
                                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${statusFilter === 'pending' ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-2xs' : 'text-slate-500'}`}
                                >
                                    Pending ({stats.pendingCount})
                                </button>
                                <button
                                    onClick={() => setStatusFilter('reviewed')}
                                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${statusFilter === 'reviewed' ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-2xs' : 'text-slate-500'}`}
                                >
                                    Reviewed
                                </button>
                            </div>
                        </div>
                    </div>

                    {filteredSubmissions.length === 0 ? (
                        <div className="py-16 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/20">
                            <ClipboardList className="w-10 h-10 text-slate-350 mx-auto mb-2" />
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No submissions found</p>
                            <p className="text-[10px] text-slate-400 mt-1">Submissions from your assigned mentees will appear here for validation.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredSubmissions.map((sub) => {
                                const isPending = sub.status === 'submitted' || sub.status === 'pending';
                                const isApproved = sub.status === 'approved';
                                const needsRevision = sub.status === 'needs_revision';

                                return (
                                    <div
                                        key={sub.id}
                                        className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-900/50 bg-white dark:bg-slate-900 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                                    >
                                        <div className="flex items-start gap-3.5 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 font-extrabold flex items-center justify-center shrink-0">
                                                {sub.student_pic ? (
                                                    <img src={sub.student_pic} alt={sub.student_name} className="w-full h-full object-cover rounded-xl" />
                                                ) : (
                                                    sub.student_name.charAt(0)
                                                )}
                                            </div>

                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <h4 className="font-extrabold text-sm text-slate-800 dark:text-white leading-none">{sub.assignment_title}</h4>
                                                    <span className="text-[9px] font-bold text-slate-400">• {sub.student_name}</span>
                                                    {sub.student_level && (
                                                        <span className="text-[8px] font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded uppercase">
                                                            {sub.student_level}
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mb-2">
                                                    {sub.assignment_description || 'No specific instructions provided.'}
                                                </p>

                                                <div className="flex items-center gap-4 text-[10px] text-slate-400 flex-wrap">
                                                    {sub.submitted_at && (
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3 text-amber-500" />
                                                            Submitted: {new Date(sub.submitted_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                        </span>
                                                    )}
                                                    {sub.video_url && (
                                                        <a 
                                                            href={sub.video_url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            className="flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline font-bold"
                                                        >
                                                            <Video className="w-3 h-3" />
                                                            Watch Media / Video
                                                            <ExternalLink className="w-2.5 h-2.5" />
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800">
                                            {/* Evaluation Pill */}
                                            <div className="text-right">
                                                {isPending ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40 text-[10px] font-bold">
                                                        <Clock className="w-3 h-3" />
                                                        Pending Review
                                                    </span>
                                                ) : isApproved ? (
                                                    <div>
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40 text-[10px] font-bold">
                                                            <CheckCircle2 className="w-3 h-3" />
                                                            Approved
                                                        </span>
                                                        {sub.score !== undefined && sub.score !== null && (
                                                            <p className="text-[10px] font-black text-slate-600 dark:text-slate-300 mt-1">Score: {sub.score}/100</p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40 text-[10px] font-bold">
                                                            <AlertCircle className="w-3 h-3" />
                                                            Revision Requested
                                                        </span>
                                                        {sub.score !== undefined && sub.score !== null && (
                                                            <p className="text-[10px] font-black text-slate-600 dark:text-slate-300 mt-1">Score: {sub.score}/100</p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action button */}
                                            <button
                                                onClick={() => handleOpenReview(sub)}
                                                className="px-3.5 py-2 rounded-xl bg-[#7C5E3F] hover:bg-amber-800 text-white font-extrabold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <span>{isPending ? 'Validate & Grade' : 'Edit Review'}</span>
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB CONTENT: MENTEES LIST */}
            {selectedTab === 'mentees' && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs text-left">
                    <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div>
                            <h3 className="text-base font-extrabold text-slate-800 dark:text-white">Assigned Mentees Directory</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Direct access to guide and chat with your assigned academy students.</p>
                        </div>
                    </div>

                    {mentees.length === 0 ? (
                        <div className="py-16 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/20">
                            <Users className="w-10 h-10 text-slate-350 mx-auto mb-2" />
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No mentees assigned yet</p>
                            <p className="text-[10px] text-slate-400 mt-1">Your assigned mentees will appear here once allocated by academy teachers.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {mentees.map((mentee) => {
                                const menteeSubmissions = submissions.filter(s => s.student_id === mentee.student_id);
                                const pendingCount = menteeSubmissions.filter(s => s.status === 'submitted' || s.status === 'pending').length;

                                return (
                                    <div
                                        key={mentee.id}
                                        className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-300 transition-all flex items-center justify-between gap-4"
                                    >
                                        <div className="flex items-center gap-3.5 min-w-0">
                                            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 font-extrabold flex items-center justify-center shrink-0 text-sm">
                                                {mentee.profile_pic_url ? (
                                                    <img src={mentee.profile_pic_url} alt={mentee.name} className="w-full h-full object-cover rounded-xl" />
                                                ) : (
                                                    mentee.name.charAt(0)
                                                )}
                                            </div>

                                            <div className="min-w-0 text-left">
                                                <h4 className="font-extrabold text-sm text-slate-800 dark:text-white leading-none truncate mb-1">{mentee.name}</h4>
                                                <p className="text-[11px] text-slate-400 truncate mb-1.5">{mentee.email}</p>

                                                <div className="flex items-center gap-2 text-[9px] font-extrabold text-slate-500">
                                                    {mentee.level && (
                                                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded uppercase">
                                                            {mentee.level}
                                                        </span>
                                                    )}
                                                    <span>{menteeSubmissions.length} Tasks ({pendingCount} pending)</span>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => onNavigateToChat(mentee.student_id, mentee.name)}
                                            className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 border border-amber-200/60 dark:border-amber-900/40 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold shrink-0"
                                            title="Chat with Mentee"
                                        >
                                            <MessageSquare className="w-4 h-4" />
                                            <span className="hidden sm:inline">Chat</span>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* REVIEW & EVALUATION MODAL */}
            {selectedSubmission && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative text-left">
                        <button
                            onClick={() => setSelectedSubmission(null)}
                            className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
                                <Award className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-extrabold text-slate-800 dark:text-white">Validate Task & Assign Marks</h3>
                                <p className="text-xs text-slate-400">Mentee: <span className="font-bold text-amber-600">{selectedSubmission.student_name}</span></p>
                            </div>
                        </div>

                        {errorMsg && (
                            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-600 text-xs font-semibold flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        {successMsg && (
                            <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 text-emerald-600 text-xs font-semibold flex items-center gap-2">
                                <Check className="w-4 h-4 shrink-0" />
                                <span>{successMsg}</span>
                            </div>
                        )}

                        {/* Submission details preview */}
                        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/50 mb-5 space-y-2 text-xs">
                            <p className="font-extrabold text-slate-800 dark:text-slate-100">{selectedSubmission.assignment_title}</p>
                            {selectedSubmission.video_url ? (
                                <a
                                    href={selectedSubmission.video_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white font-bold text-xs hover:bg-amber-600 transition-colors"
                                >
                                    <Video className="w-3.5 h-3.5" />
                                    Watch Mentee Video / Recording
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            ) : (
                                <p className="text-slate-400 italic">No video recording attached to this submission.</p>
                            )}
                        </div>

                        <form onSubmit={handleSaveReview} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Marks / Score (Out of 100) *
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    required
                                    value={reviewScore}
                                    onChange={(e) => setReviewScore(e.target.value)}
                                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Proficiency Level Assessment
                                </label>
                                <select
                                    value={reviewProficiency}
                                    onChange={(e) => setReviewProficiency(e.target.value)}
                                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-white"
                                >
                                    <option value="Exceptional">Exceptional (Exceeds Expectations)</option>
                                    <option value="Good">Good (Meets Level Standards)</option>
                                    <option value="Developing">Developing (Needs Minor Refinement)</option>
                                    <option value="Needs Practice">Needs Practice</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Validation Decision
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setReviewStatus('approved')}
                                        className={`py-2 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                            reviewStatus === 'approved'
                                                ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm'
                                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                        }`}
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        Approve Task
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setReviewStatus('needs_revision')}
                                        className={`py-2 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                            reviewStatus === 'needs_revision'
                                                ? 'bg-rose-500 text-white border-rose-600 shadow-sm'
                                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                        }`}
                                    >
                                        <AlertCircle className="w-4 h-4" />
                                        Request Revision
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Mentor Feedback & Suggestions
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="Write guidance, flute posture tips, or breath control feedback..."
                                    value={reviewFeedback}
                                    onChange={(e) => setReviewFeedback(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-white"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setSelectedSubmission(null)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-5 py-2 rounded-xl bg-[#7C5E3F] hover:bg-amber-800 text-white font-extrabold text-xs transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Saving Evaluation...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-3.5 h-3.5" />
                                            <span>Submit Marks & Review</span>
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
