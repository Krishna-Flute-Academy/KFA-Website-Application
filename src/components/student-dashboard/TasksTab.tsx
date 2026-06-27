'use client';

import React from 'react';
import { ClipboardList, Download, Video, X, Loader2 } from 'lucide-react';

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

interface TasksTabProps {
    assignments: EnrichedAssignment[];
    selectedAssignment: EnrichedAssignment | null;
    setSelectedAssignment: (asg: EnrichedAssignment | null) => void;
    submitVideoUrl: string;
    setSubmitVideoUrl: (url: string) => void;
    isSubmittingTask: boolean;
    handleSubmitTask: (e: React.FormEvent) => Promise<void>;
}

/**
 * TasksTab component handles student assignments list and includes the submission form modal.
 */
export default function TasksTab({
    assignments,
    selectedAssignment,
    setSelectedAssignment,
    submitVideoUrl,
    setSubmitVideoUrl,
    isSubmittingTask,
    handleSubmitTask
}: TasksTabProps) {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Filter Section Tabs */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs text-left">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h3 className="font-extrabold text-slate-800 text-base">Assignments</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Practice list assigned by your instructor</p>
                    </div>
                </div>

                {assignments.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                        <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-xs font-bold text-slate-700">No assignments assigned.</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Your teacher has not uploaded any tasks yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {assignments.map((asg) => {
                            const statusClass = 
                                asg.status === 'approved' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                                asg.status === 'reviewed' ? 'bg-blue-50 border-blue-100 text-blue-700' :
                                asg.status === 'submitted' ? 'bg-indigo-50 border-indigo-100 text-indigo-700' :
                                'bg-amber-50 border-amber-100 text-amber-700';

                            return (
                                <div 
                                    key={asg.id} 
                                    className="bg-white border border-slate-150 rounded-2xl p-5 hover:shadow-xs transition-shadow flex flex-col justify-between text-left"
                                >
                                    <div>
                                        <div className="flex justify-between items-start gap-4">
                                            <h4 className="font-extrabold text-xs md:text-sm text-slate-800 line-clamp-1">{asg.title}</h4>
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shrink-0 ${statusClass}`}>
                                                {asg.status === 'submitted' ? 'Submitted (Pending)' : asg.status}
                                            </span>
                                        </div>

                                        <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                                            {asg.description || 'No detailed instructions.'}
                                        </p>

                                        {asg.file_url && (
                                            <a 
                                                href={asg.file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-[10px] font-bold text-[#ecb613] bg-amber-50 border border-amber-100 rounded-md px-2 py-1 mt-3.5 hover:bg-amber-100 transition-colors"
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                                {asg.file_name || 'View Attachment'}
                                            </a>
                                        )}
                                    </div>

                                    <div className="border-t border-slate-100 pt-4 mt-4 flex items-center justify-between gap-4">
                                        <span className="text-[10px] text-slate-400 font-semibold">
                                            {asg.due_date ? `Due: ${new Date(asg.due_date).toLocaleDateString()}` : 'No due date'}
                                        </span>

                                        <button 
                                            onClick={() => {
                                                setSelectedAssignment(asg);
                                                setSubmitVideoUrl(asg.video_url || '');
                                            }}
                                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-1 ${
                                                asg.status === 'approved' || asg.status === 'reviewed'
                                                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                    : 'bg-amber-500 hover:bg-amber-600 text-white shadow-2xs'
                                            }`}
                                        >
                                            <Video className="w-3.5 h-3.5" />
                                            {asg.status === 'pending' ? 'Submit' : 'Update'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Submit Assignment Modal */}
            {selectedAssignment && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 text-left">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
                            <div>
                                <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest block">Submit Practice Recording</span>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1.5 line-clamp-1">{selectedAssignment.title}</h3>
                            </div>
                            <button 
                                onClick={() => {
                                    setSelectedAssignment(null);
                                    setSubmitVideoUrl('');
                                }} 
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 dark:text-slate-500 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSubmitTask} className="p-6 space-y-4">
                            <div className="space-y-1 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Assignment Brief</h4>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-3 mt-1">
                                    {selectedAssignment.description || 'No instruction notes provided by the teacher.'}
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="video-url" className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Video / Recording Link</label>
                                <input 
                                    id="video-url"
                                    type="url"
                                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#ecb613] font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-405"
                                    placeholder="e.g., YouTube, Google Drive, Soundcloud, or Vimeo link"
                                    value={submitVideoUrl}
                                    onChange={(e) => setSubmitVideoUrl(e.target.value)}
                                    required
                                />
                                <p className="text-[9px] text-slate-400 mt-1">
                                    Upload your practice recording to Drive or YouTube (unlisted) and paste the link here.
                                </p>
                            </div>

                            {/* Existing Grade summary inside drawer */}
                            {(selectedAssignment.score !== undefined && selectedAssignment.score !== null) && (
                                <div className="p-4 bg-emerald-50/40 border border-emerald-150 rounded-2xl space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-widest">Graded Assessment</span>
                                        <span className="font-extrabold text-sm text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Score: {selectedAssignment.score}/10</span>
                                    </div>
                                    {selectedAssignment.feedback_text && (
                                        <p className="text-[11px] text-slate-600 leading-relaxed italic">
                                            "{selectedAssignment.feedback_text}"
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Footer / actions */}
                            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setSelectedAssignment(null);
                                        setSubmitVideoUrl('');
                                    }}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSubmittingTask}
                                    className="px-5 py-2 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-900 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-md hover:shadow-lg disabled:bg-stone-300 disabled:text-slate-500 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
                                >
                                    {isSubmittingTask ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />}
                                    {selectedAssignment.status === 'pending' ? 'Submit Recording' : 'Resubmit Recording'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
