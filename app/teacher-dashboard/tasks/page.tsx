'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { Loader2, Search, Bell, UserCircle, Filter, Info, PlayCircle, CheckCircle, Save, X, ClipboardList, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
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
    status: 'pending' | 'submitted' | 'reviewed' | 'approved';
    submitted_at: string;
    video_url?: string;
    feedback_text?: string;
    score?: number;
    proficiency_level?: string;
    student_notes?: string;
}

export default function TaskReviewPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<{ name: string; email: string } | null>(null);
    const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
    const [filteredSubmissions, setFilteredSubmissions] = useState<TaskSubmission[]>([]);
    const [selectedSub, setSelectedSub] = useState<TaskSubmission | null>(null);
    const [statusFilter, setStatusFilter] = useState('All Status');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 12;
    const [isSaving, setIsSaving] = useState(false);
    
    // Grading form state
    const [score, setScore] = useState<number | ''>('');
    const [proficiency, setProficiency] = useState('');
    const [feedback, setFeedback] = useState('');
    const [reassign, setReassign] = useState(false);

    const fetchSubmissions = useCallback(async (userId: string) => {
        console.log('Fetching submissions for teacher:', userId);
        
        try {
            // Updated query to match attempt_files schema
            let { data, error } = await supabaseAuth
                .from('task_attempts')
                .select(`
                    id,
                    status,
                    submitted_at,
                    score,
                    proficiency_level,
                    student_id,
                    tasks!task_id(title, description),
                    users!student_id!inner(name, teacher_id, profile_pic_url),
                    attempt_files(video_url, feedback_text, feedback_audio_url)
                `)
                .eq('users.teacher_id', userId)
                .order('submitted_at', { ascending: false });

            // FALLBACK: If score/proficiency doesn't exist, try a simpler query
            if (error && (error.code === '42703' || error.message?.includes('score'))) {
                console.warn('Grading columns missing, trying fallback query...');
                const fallback = await supabaseAuth
                    .from('task_attempts')
                    .select(`
                        id,
                        status,
                        submitted_at,
                        student_id,
                        tasks!task_id(title, description),
                        users!student_id!inner(name, teacher_id, profile_pic_url),
                        attempt_files(video_url, feedback_text, feedback_audio_url)
                    `)
                    .eq('users.teacher_id', userId)
                    .order('submitted_at', { ascending: false });
                
                data = fallback.data as any[];
                error = fallback.error;
            }

            if (error) {
                console.error('Supabase Query Error:', JSON.stringify(error, null, 2));
                return;
            }

            if (data) {
                const formatted: TaskSubmission[] = (data as any[]).map(s => {
                    // Extract first file if exists
                    const file = s.attempt_files && s.attempt_files.length > 0 ? s.attempt_files[0] : null;
                    return {
                        id: s.id,
                        student_id: s.student_id,
                        student_name: s.users?.name || 'Unknown Student',
                        student_profile_pic_url: s.users?.profile_pic_url,
                        task_id: s.task_id,
                        task_title: s.tasks?.title || 'Unknown Task',
                        task_description: s.tasks?.description,
                        status: s.status,
                        submitted_at: s.submitted_at,
                        video_url: file?.video_url,
                        feedback_text: file?.feedback_text || '',
                        score: (s as any).score || undefined,
                        proficiency_level: (s as any).proficiency_level || '',
                        student_notes: '' // Placeholder
                    };
                });
                setSubmissions(formatted);
                setFilteredSubmissions(formatted);
                
                // Auto-select first pending if none selected
                const firstPending = formatted.find(sub => sub.status === 'submitted');
                if (firstPending && !selectedSub) {
                    handleSelectSubmission(firstPending);
                }
            }
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
        if (statusFilter === 'All Status') {
            setFilteredSubmissions(submissions);
        } else {
            setFilteredSubmissions(submissions.filter(s => s.status.toLowerCase() === statusFilter.toLowerCase()));
        }
    }, [statusFilter, submissions]);

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
            const updates = {
                status: reassign ? 'submitted' : 'reviewed', // Reassign puts it back to submitted/pending
                score: score === '' ? null : score,
                proficiency_level: proficiency,
                reviewed_at: new Date().toISOString()
            };

            // 1. Update task_attempts
            const { error: attemptError } = await supabaseAuth
                .from('task_attempts')
                .update(updates)
                .eq('id', selectedSub.id);

            if (attemptError) throw attemptError;

            // 2. Update attempt_files (feedback)
            const { error: fileError } = await supabaseAuth
                .from('attempt_files')
                .update({ feedback_text: feedback })
                .eq('attempt_id', selectedSub.id);

            if (fileError) {
                console.warn('Could not update feedback in attempt_files, it might not exist yet:', fileError);
                // If it doesn't exist, we might need to insert, but usually a submission has a file
            }

            // Update local state
            const updatedSubmissions = submissions.map(s => 
                s.id === selectedSub.id ? { ...s, ...updates, feedback_text: feedback, status: updates.status as any } : s
            );
            setSubmissions(updatedSubmissions);
            setSelectedSub({ ...selectedSub, ...updates, feedback_text: feedback, status: updates.status as any });
            alert('Review saved successfully');

        } catch (error: any) {
            console.error('Error updating review:', error);
            alert(`Failed to save review: ${error.message || 'Unknown error'}`);
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
            <div className="h-screen w-full flex flex-col items-center justify-center bg-surface">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="font-medium text-on-surface-variant">Loading tasks...</p>
            </div>
        );
    }

    return (
        <div className="bg-background text-on-background min-h-screen flex font-body">
            <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

            <main className="flex-1 flex flex-col min-w-0">
                <TeacherHeader title="Task Review" />

                <div className="p-8 grid grid-cols-12 gap-8 max-w-[1600px] mx-auto w-full flex-1">
                    {/* Left Column: Submission List */}
                    <div className="col-span-12 lg:col-span-7 space-y-6 flex flex-col h-full">
                        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-extrabold tracking-tight text-on-surface font-headline">Task Review</h1>
                                <p className="text-on-surface-variant text-sm">Review student performance and provide feedback</p>
                            </div>
                            <div className="flex gap-2">
                                <select 
                                    className="rounded-lg border-outline bg-surface px-3 py-2 text-sm focus:ring-primary focus:border-primary"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                >
                                    <option>All Status</option>
                                    <option>Pending</option>
                                    <option>Submitted</option>
                                    <option>Reviewed</option>
                                    <option>Approved</option>
                                </select>
                                <button className="bg-surface border border-outline px-4 py-2 rounded-lg text-sm font-medium hover:bg-surface-container transition-colors flex items-center gap-2">
                                    <Filter className="w-4 h-4" />
                                    Filter
                                </button>
                                <Link 
                                    href="/teacher-dashboard/tasks/create"
                                    className="bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm"
                                >
                                    <Plus className="w-4 h-4" />
                                    Create Task
                                </Link>
                            </div>
                        </header>

                        {/* List Area */}
                        <div className="bg-surface rounded-xl shadow-sm border border-outline overflow-hidden flex-1 flex flex-col">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-surface-container-low border-b border-outline">
                                        <tr className="font-headline">
                                            <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Student Name</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Task Title</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Date</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-outline">
                                        {filteredSubmissions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((sub) => (
                                            <tr 
                                                key={sub.id} 
                                                className={`hover:bg-primary-container/30 cursor-pointer transition-colors ${selectedSub?.id === sub.id ? 'bg-primary-container/20' : ''}`}
                                                onClick={() => handleSelectSubmission(sub)}
                                            >
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
                                                        <span className="font-medium text-on-surface truncate">{sub.student_name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-on-surface-variant truncate max-w-[200px]">{sub.task_title}</td>
                                                <td className="px-6 py-4 text-sm text-on-surface-variant whitespace-nowrap">
                                                    {new Date(sub.submitted_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${
                                                        sub.status === 'submitted' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                                        sub.status === 'reviewed' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                                        sub.status === 'approved' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                                                        'bg-slate-100 text-slate-500 border-slate-200'
                                                    }`}>
                                                        {sub.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredSubmissions.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-10 text-center text-on-surface-variant italic">
                                                    No tasks found for this status.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {filteredSubmissions.length > ITEMS_PER_PAGE && (
                                <div className="flex items-center justify-between px-6 py-4 bg-surface-container-lowest border-t border-outline">
                                    <div className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                                        Showing <span className="text-primary">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="text-primary">{Math.min(currentPage * ITEMS_PER_PAGE, filteredSubmissions.length)}</span> of {filteredSubmissions.length}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button 
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="p-2 rounded-lg hover:bg-surface-container transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <div className="flex items-center gap-1 mx-2">
                                            {Array.from({ length: Math.ceil(filteredSubmissions.length / ITEMS_PER_PAGE) }, (_, i) => i + 1).map(page => (
                                                <button
                                                    key={page}
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${
                                                        currentPage === page 
                                                        ? 'bg-primary text-on-primary shadow-lg shadow-primary/20 scale-110' 
                                                        : 'hover:bg-surface-container text-on-surface-variant'
                                                    }`}
                                                >
                                                    {page}
                                                </button>
                                            ))}
                                        </div>
                                        <button 
                                            onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredSubmissions.length / ITEMS_PER_PAGE), p + 1))}
                                            disabled={currentPage === Math.ceil(filteredSubmissions.length / ITEMS_PER_PAGE)}
                                            className="p-2 rounded-lg hover:bg-surface-container transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Bento Quick Stats */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-100 dark:border-amber-900/10">
                                <p className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase font-label">Pending</p>
                                <h3 className="text-2xl font-black text-amber-900 dark:text-amber-100 font-headline">
                                    {submissions.filter(s => s.status === 'submitted').length}
                                </h3>
                            </div>
                            <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/10">
                                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase font-label">Reviewed</p>
                                <h3 className="text-2xl font-black text-emerald-900 dark:text-emerald-100 font-headline">
                                    {submissions.filter(s => s.status === 'reviewed' || s.status === 'approved').length}
                                </h3>
                            </div>
                            <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase font-label">Avg Proficiency</p>
                                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 font-headline">Developing</h3>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Detail Panel */}
                    <div className="col-span-12 lg:col-span-5 h-full">
                        {selectedSub ? (
                            <div className="bg-surface rounded-2xl shadow-xl border border-outline sticky top-24 overflow-hidden flex flex-col max-h-[calc(100vh-120px)] transition-all animate-in fade-in slide-in-from-right-4">
                                <div className="p-6 bg-surface-container-low border-b border-outline">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest font-label tracking-wide">Active Review</span>
                                            <h2 className="text-xl font-extrabold text-on-surface font-headline">{selectedSub.task_title}</h2>
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
                                        <button onClick={() => setSelectedSub(null)} className="p-1 hover:bg-surface-container rounded-full text-on-surface-variant">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                                    {/* Task Brief */}
                                    <section>
                                        <h3 className="text-xs font-bold text-on-surface-variant uppercase mb-2 flex items-center gap-2 font-label">
                                            <Info className="w-3 h-3" />
                                            Task Brief
                                        </h3>
                                        <p className="text-sm text-on-surface leading-relaxed">
                                            {selectedSub.task_description || 'No description provided for this task.'}
                                        </p>
                                    </section>

                                    {/* Student Notes / Video */}
                                    <section className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-2 font-label">Student Submission</h3>
                                        <p className="text-sm text-slate-800 dark:text-slate-200 italic">
                                            {selectedSub.student_notes || '"Please check my breathing technique at mark 1:20."'}
                                        </p>
                                        
                                        {selectedSub.video_url && (
                                            <a 
                                                href={selectedSub.video_url} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="mt-4 flex items-center gap-2 text-primary font-bold text-xs cursor-pointer hover:underline"
                                            >
                                                <PlayCircle className="w-4 h-4" />
                                                View Submission Video
                                            </a>
                                        )}
                                    </section>

                                    {/* Grading Form */}
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1.5 font-label">Score (Out of 10)</label>
                                                <input 
                                                    className="w-full rounded-lg border-outline bg-surface px-4 py-2.5 text-sm focus:ring-primary focus:border-primary dark:bg-slate-900" 
                                                    type="number" 
                                                    min="0" max="10" step="0.5" 
                                                    placeholder="8.5"
                                                    value={score}
                                                    onChange={(e) => setScore(e.target.value === '' ? '' : Number(e.target.value))}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1.5 font-label">Proficiency Level</label>
                                                <select 
                                                    className="w-full rounded-lg border-outline bg-surface px-4 py-2.5 text-sm focus:ring-primary focus:border-primary dark:bg-slate-900"
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
                                            <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1.5 font-label">Feedback</label>
                                            <textarea 
                                                className="w-full rounded-lg border-outline bg-surface px-4 py-2.5 text-sm focus:ring-primary focus:border-primary dark:bg-slate-900" 
                                                rows={4} 
                                                placeholder="Enter detailed feedback for the student..."
                                                value={feedback}
                                                onChange={(e) => setFeedback(e.target.value)}
                                            ></textarea>
                                        </div>
                                        <div className="flex items-center gap-3 p-4 bg-error-container/10 rounded-lg border border-error-container">
                                            <input 
                                                className="rounded text-error focus:ring-error h-4 w-4 border-outline" 
                                                type="checkbox" 
                                                id="reassign"
                                                checked={reassign}
                                                onChange={(e) => setReassign(e.target.checked)}
                                            />
                                            <label className="text-sm font-semibold text-on-error-container flex flex-col cursor-pointer" htmlFor="reassign">
                                                Re-assign Task
                                                <span className="text-[11px] font-normal text-on-surface-variant">Mark as incomplete and request a resubmission.</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 bg-surface border-t border-outline flex gap-3">
                                    <button 
                                        onClick={handleSaveReview}
                                        disabled={isSaving}
                                        className="flex-1 bg-primary text-on-primary font-bold py-3 px-4 rounded-xl shadow-md hover:bg-primary/90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                        Mark as Reviewed & Close
                                    </button>
                                    <button className="bg-surface border border-outline text-on-surface font-semibold py-3 px-4 rounded-xl hover:bg-surface-container transition-all active:scale-[0.98]">
                                        <Save className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full bg-surface-dim border-2 border-dashed border-outline rounded-2xl flex flex-col items-center justify-center p-12 text-center text-on-surface-variant">
                                <div className="p-4 bg-surface rounded-full mb-4 shadow-sm">
                                    <ClipboardList className="w-12 h-12 text-slate-300" />
                                </div>
                                <h3 className="text-lg font-bold text-on-surface font-headline">No Task Selected</h3>
                                <p className="text-sm mt-2 max-w-[240px]">Select a student submission from the list to begin review and provide feedback.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
