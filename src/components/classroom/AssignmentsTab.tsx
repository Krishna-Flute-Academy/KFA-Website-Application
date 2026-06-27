'use client';

import React from 'react';
import { 
    ClipboardList, X, UsersRound, User, Paperclip, Upload, 
    AlertTriangle, Loader2, Send, StickyNote, BookOpen, 
    NotebookPen, Plus, GripVertical, Edit3, Trash2, Download, Filter,
    Calendar, ChevronUp, ChevronDown
} from 'lucide-react';

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
    joined_at: string;
    mock_milestone?: string;
    is_makeup?: boolean;
}

interface AssignmentsTabProps {
    showAssignmentModal: boolean;
    setShowAssignmentModal: (show: boolean) => void;
    classroom: any;
    closeAssignmentModal: () => void;
    assignmentForm: {
        title: string;
        description: string;
        due_date: string;
        target_type: 'all' | 'individual';
        selectedStudentIds: Set<string>;
        file_url: string | null;
        file_name: string | null;
        file_size: number | null;
    };
    setAssignmentForm: React.Dispatch<React.SetStateAction<any>>;
    students: Student[];
    assignmentFileRef: React.RefObject<HTMLInputElement | null>;
    assignmentFile: File | null;
    setAssignmentFile: (file: File | null) => void;
    formatFileSize: (bytes: number | null) => string;
    assignmentError: string;
    isSavingAssignment: boolean;
    handleCreateAssignment: () => void;
    showNoteEditor: boolean;
    editingNote: any;
    setShowNoteEditor: (show: boolean) => void;
    setEditingNote: (note: any) => void;
    noteForm: {
        title: string;
        content: string;
        color: string;
    };
    setNoteForm: React.Dispatch<React.SetStateAction<any>>;
    noteFileRef: React.RefObject<HTMLInputElement | null>;
    noteFile: File | null;
    setNoteFile: (file: File | null) => void;
    noteError: string;
    setNoteError: (err: string) => void;
    handleSaveNote: () => void;
    isSavingNote: boolean;
    dbSetupError: boolean;
    setDbSetupError: (show: boolean) => void;
    classNotes: any[];
    openNewNote: () => void;
    notesLoading: boolean;
    handleDragStart: (e: React.DragEvent, note: any) => void;
    openEditNote: (note: any) => void;
    handleDeleteNote: (id: string) => Promise<void>;
    deletingNoteId: string | null;
    isDraggingOverAssignments: boolean;
    setIsDraggingOverAssignments: (dragging: boolean) => void;
    handleDropNote: (e: React.DragEvent) => void;
    assignments: any[];
    assignmentsLoading: boolean;
    filteredAssignments: any[];
    setAssignmentFilter: (filter: 'all' | 'all_students' | 'individual') => void;
    assignmentFilter: 'all' | 'all_students' | 'individual';
    expandedAssignmentId: string | null;
    setExpandedAssignmentId: (id: string | null) => void;
    deletingAssignmentId: string | null;
    handleDeleteAssignment: (id: string) => Promise<void>;
    handleOpenReviewModal: (studentSubmission: any, assignment: any) => void;
}

const NOTE_COLORS = {
    yellow: {
        dot: 'bg-amber-400',
        bg: 'bg-amber-50/50 dark:bg-amber-955/10',
        border: 'border-amber-250 dark:border-amber-900/30',
        header: 'text-amber-800 dark:text-amber-400'
    },
    blue: {
        dot: 'bg-blue-400',
        bg: 'bg-blue-50/50 dark:bg-blue-955/10',
        border: 'border-blue-250 dark:border-blue-900/30',
        header: 'text-blue-800 dark:text-blue-400'
    },
    green: {
        dot: 'bg-emerald-500',
        bg: 'bg-emerald-50/50 dark:bg-emerald-955/10',
        border: 'border-emerald-250 dark:border-emerald-900/30',
        header: 'text-emerald-800 dark:text-emerald-405'
    },
    pink: {
        dot: 'bg-pink-400',
        bg: 'bg-pink-50/50 dark:bg-pink-955/10',
        border: 'border-pink-250 dark:border-pink-900/30',
        header: 'text-pink-850 dark:text-pink-400'
    }
};

export default function AssignmentsTab({
    showAssignmentModal,
    setShowAssignmentModal,
    classroom,
    closeAssignmentModal,
    assignmentForm,
    setAssignmentForm,
    students,
    assignmentFileRef,
    assignmentFile,
    setAssignmentFile,
    formatFileSize,
    assignmentError,
    isSavingAssignment,
    handleCreateAssignment,
    showNoteEditor,
    editingNote,
    setShowNoteEditor,
    setEditingNote,
    noteForm,
    setNoteForm,
    noteFileRef,
    noteFile,
    setNoteFile,
    noteError,
    setNoteError,
    handleSaveNote,
    isSavingNote,
    dbSetupError,
    setDbSetupError,
    classNotes,
    openNewNote,
    notesLoading,
    handleDragStart,
    openEditNote,
    handleDeleteNote,
    deletingNoteId,
    isDraggingOverAssignments,
    setIsDraggingOverAssignments,
    handleDropNote,
    assignments,
    assignmentsLoading,
    filteredAssignments,
    setAssignmentFilter,
    assignmentFilter,
    expandedAssignmentId,
    setExpandedAssignmentId,
    deletingAssignmentId,
    handleDeleteAssignment,
    handleOpenReviewModal
}: AssignmentsTabProps) {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">

            {/* ── Create Assignment Modal ───────────────────────────────────── */}
            {showAssignmentModal && (
                <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[#ecb613]/10 flex items-center justify-center">
                                    <ClipboardList className="w-5 h-5 text-[#ecb613]" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white">Create Assignment</h3>
                                    <p className="text-xs text-slate-505">for <span className="font-semibold">{classroom?.name}</span></p>
                                </div>
                            </div>
                            <button onClick={closeAssignmentModal} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-605 hover:bg-slate-105 dark:hover:bg-slate-800 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                            {/* Title */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Title <span className="text-rose-500">*</span></label>
                                <input
                                    id="assignment-title-input"
                                    type="text"
                                    placeholder="e.g., Practice Raag Yaman — Sa Re Ga Ma"
                                    value={assignmentForm.title}
                                    onChange={e => setAssignmentForm((f: any) => ({ ...f, title: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#ecb613]/30 focus:border-[#ecb613] outline-none transition-all font-semibold"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Description</label>
                                <textarea
                                    id="assignment-description-input"
                                    rows={3}
                                    placeholder="Describe what the student needs to do..."
                                    value={assignmentForm.description}
                                    onChange={e => setAssignmentForm((f: any) => ({ ...f, description: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#ecb613]/30 focus:border-[#ecb613] outline-none transition-all resize-none font-semibold"
                                />
                            </div>

                            {/* Due Date */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Due Date</label>
                                <input
                                    id="assignment-due-date"
                                    type="date"
                                    value={assignmentForm.due_date}
                                    onChange={e => setAssignmentForm((f: any) => ({ ...f, due_date: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#ecb613]/30 focus:border-[#ecb613] outline-none transition-all font-semibold"
                                />
                            </div>

                            {/* Target Toggle */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Assign To</label>
                                <div className="flex gap-2">
                                    <button
                                        id="target-all-btn"
                                        onClick={() => setAssignmentForm((f: any) => ({ ...f, target_type: 'all', selectedStudentIds: new Set() }))}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-all flex-1 justify-center cursor-pointer ${
                                            assignmentForm.target_type === 'all'
                                                ? 'border-[#ecb613] bg-[#ecb613]/10 text-[#ecb613]'
                                                : 'border-slate-200 dark:border-slate-700 text-slate-505 hover:border-slate-300'
                                        }`}
                                    >
                                        <UsersRound className="w-4 h-4" />
                                        All Students
                                    </button>
                                    <button
                                        id="target-individual-btn"
                                        onClick={() => setAssignmentForm((f: any) => ({ ...f, target_type: 'individual' }))}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-all flex-1 justify-center cursor-pointer ${
                                            assignmentForm.target_type === 'individual'
                                                ? 'border-[#ecb613] bg-[#ecb613]/10 text-[#ecb613]'
                                                : 'border-slate-200 dark:border-slate-700 text-slate-505 hover:border-slate-300'
                                        }`}
                                    >
                                        <User className="w-4 h-4" />
                                        Individual
                                    </button>
                                </div>
                            </div>

                            {/* Individual student picker */}
                            {assignmentForm.target_type === 'individual' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Select Students <span className="text-rose-500">*</span></label>
                                    {students.length === 0 ? (
                                        <p className="text-sm text-slate-505 italic text-center py-4">No students enrolled in this classroom.</p>
                                    ) : (
                                        <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-slate-700 rounded-xl p-2">
                                            {students.map(s => {
                                                const isSel = assignmentForm.selectedStudentIds.has(s.student_id);
                                                return (
                                                    <button
                                                        key={s.student_id}
                                                        onClick={() => setAssignmentForm((f: any) => {
                                                            const next = new Set(f.selectedStudentIds);
                                                            isSel ? next.delete(s.student_id) : next.add(s.student_id);
                                                            return { ...f, selectedStudentIds: next };
                                                        })}
                                                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left cursor-pointer ${
                                                            isSel
                                                                ? 'bg-[#ecb613]/10 border-2 border-[#ecb613]'
                                                                : 'bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent hover:border-slate-200'
                                                        }`}
                                                    >
                                                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                            {s.profile_pic_url
                                                                ? <img src={s.profile_pic_url} alt={s.name} className="w-full h-full object-cover" />
                                                                : <span className="text-xs font-bold text-slate-500">{s.name.charAt(0)}</span>
                                                            }
                                                        </div>
                                                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex-1">{s.name}</span>
                                                        <div className={`w-4 h-4 rounded flex items-center justify-center border-2 flex-shrink-0 ${
                                                            isSel ? 'bg-[#ecb613] border-[#ecb613]' : 'border-slate-300 dark:border-slate-600'
                                                        }`}>
                                                            {isSel && <svg className="w-2.5 h-2.5 text-slate-900" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {assignmentForm.selectedStudentIds.size > 0 && (
                                        <p className="text-xs font-semibold text-[#ecb613] mt-1.5">{assignmentForm.selectedStudentIds.size} student{assignmentForm.selectedStudentIds.size !== 1 ? 's' : ''} selected</p>
                                    )}
                                </div>
                            )}

                            {/* File Attachment */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Attach File <span className="text-slate-400 font-normal normal-case">(optional)</span></label>
                                <input ref={assignmentFileRef} type="file" accept=".pdf,.doc,.docx,.mp3,.mp4,.wav,.jpg,.jpeg,.png" className="hidden" onChange={e => {
                                    setAssignmentFile(e.target.files?.[0] || null);
                                    if (e.target.files?.[0]) {
                                        setAssignmentForm((f: any) => ({ ...f, file_url: null, file_name: null, file_size: null }));
                                    }
                                }} />
                                {assignmentFile || assignmentForm.file_url ? (
                                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                                        <Paperclip className="w-4 h-4 text-[#ecb613] flex-shrink-0" />
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex-1 truncate">
                                            {assignmentFile ? assignmentFile.name : assignmentForm.file_name}
                                        </span>
                                        <span className="text-xs text-slate-400">
                                            {formatFileSize(assignmentFile ? assignmentFile.size : assignmentForm.file_size)}
                                        </span>
                                        <button onClick={() => {
                                            setAssignmentFile(null);
                                            setAssignmentForm((f: any) => ({ ...f, file_url: null, file_name: null, file_size: null }));
                                        }} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"><X className="w-3.5 h-3.5 text-slate-400" /></button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => assignmentFileRef.current?.click()}
                                        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-500 hover:border-[#ecb613]/50 hover:text-[#ecb613] hover:bg-[#ecb613]/5 transition-all cursor-pointer"
                                    >
                                        <Upload className="w-4 h-4" />
                                        Click to attach a file
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3 flex-shrink-0">
                            {assignmentError && (
                                <div className="flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl">
                                    <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs font-medium text-rose-700 dark:text-rose-400 break-all">{assignmentError}</p>
                                </div>
                            )}
                            <div className="flex items-center justify-end gap-3">
                                <button
                                    onClick={closeAssignmentModal}
                                    className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-655 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                >Cancel</button>
                                <button
                                    id="create-assignment-submit-btn"
                                    onClick={handleCreateAssignment}
                                    disabled={isSavingAssignment || !assignmentForm.title.trim() || (assignmentForm.target_type === 'individual' && assignmentForm.selectedStudentIds.size === 0)}
                                    className="px-5 py-2 rounded-lg text-sm font-bold bg-[#ecb613] text-slate-900 hover:bg-[#ecb613]/90 shadow-md shadow-[#ecb613]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                                >
                                    {isSavingAssignment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    {isSavingAssignment ? 'Creating...' : 'Create Assignment'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Note Editor Modal ─────────────────────────────────────── */}
            {showNoteEditor && (
                <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-xl flex flex-col animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[#ecb613]/10 flex items-center justify-center">
                                    <StickyNote className="w-5 h-5 text-[#ecb613]" />
                                </div>
                                <h3 className="font-bold text-slate-900 dark:text-white">{editingNote ? 'Edit Note' : 'New Class Note'}</h3>
                            </div>
                            <button onClick={() => { setShowNoteEditor(false); setEditingNote(null); }} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="px-6 py-5 space-y-4">
                            {/* Color picker */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Note Color</label>
                                <div className="flex gap-2">
                                    {Object.entries(NOTE_COLORS).map(([color, palette]) => (
                                        <button
                                            key={color}
                                            onClick={() => setNoteForm((f: any) => ({ ...f, color }))}
                                            className={`w-8 h-8 rounded-full border-2 transition-all cursor-pointer ${palette.dot} ${
                                                noteForm.color === color ? 'border-slate-700 dark:border-white scale-110' : 'border-transparent'
                                            }`}
                                            title={color}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Title */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Title <span className="text-rose-500">*</span></label>
                                <input
                                    id="note-title-input"
                                    type="text"
                                    placeholder="e.g., Week 3 Class Notes — Raga Bhairav"
                                    value={noteForm.title}
                                    onChange={e => setNoteForm((f: any) => ({ ...f, title: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#ecb613]/30 focus:border-[#ecb613] outline-none transition-all font-semibold"
                                />
                            </div>

                            {/* Content */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Content</label>
                                <textarea
                                    id="note-content-input"
                                    rows={5}
                                    placeholder="Write your class notes here..."
                                    value={noteForm.content}
                                    onChange={e => setNoteForm((f: any) => ({ ...f, content: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#ecb613]/30 focus:border-[#ecb613] outline-none transition-all resize-none font-semibold"
                                />
                            </div>

                            {/* File attachment */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Upload File <span className="text-slate-400 font-normal normal-case">(PDF, audio, image)</span></label>
                                <input ref={noteFileRef} type="file" accept=".pdf,.doc,.docx,.mp3,.mp4,.wav,.jpg,.jpeg,.png" className="hidden" onChange={e => setNoteFile(e.target.files?.[0] || null)} />
                                {noteFile || editingNote?.file_url ? (
                                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                                        <Paperclip className="w-4 h-4 text-[#ecb613] flex-shrink-0" />
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex-1 truncate">{noteFile?.name || editingNote?.file_name}</span>
                                        <span className="text-xs text-slate-400">{formatFileSize(noteFile?.size || editingNote?.file_size || null)}</span>
                                        <button onClick={() => { setNoteFile(null); if (editingNote) setEditingNote((prev: any) => prev ? { ...prev, file_url: null, file_name: null } : null); }} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"><X className="w-3.5 h-3.5 text-slate-400" /></button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => noteFileRef.current?.click()}
                                        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-500 hover:border-[#ecb613]/50 hover:text-[#ecb613] hover:bg-[#ecb613]/5 transition-all cursor-pointer"
                                    >
                                        <Upload className="w-4 h-4" /> Attach a file
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3">
                            {noteError && (
                                <div className="flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl">
                                    <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs font-medium text-rose-700 dark:text-rose-400 break-all">{noteError}</p>
                                </div>
                            )}
                            <div className="flex justify-end gap-3">
                                <button onClick={() => { setShowNoteEditor(false); setEditingNote(null); setNoteError(''); }} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-655 dark:text-slate-305 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">Cancel</button>
                                <button
                                    id="save-note-btn"
                                    onClick={handleSaveNote}
                                    disabled={isSavingNote || !noteForm.title.trim()}
                                    className="px-5 py-2 rounded-lg text-sm font-bold bg-[#ecb613] text-slate-900 hover:bg-[#ecb613]/90 shadow-md shadow-[#ecb613]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                                >
                                    {isSavingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                                    {isSavingNote ? 'Saving...' : (editingNote ? 'Update Note' : 'Save Note')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── DB Setup Error Banner ──────────────────────────────────── */}
            {dbSetupError && (
                <div className="mb-6 rounded-2xl border-2 border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/10 overflow-hidden text-left">
                    <div className="flex items-start gap-3 px-5 py-4">
                        <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-rose-800 dark:text-rose-300 text-sm">Database setup required</h4>
                            <p className="text-xs text-rose-700 dark:text-rose-405 mt-1 leading-relaxed">
                                The <code className="font-mono bg-rose-100 dark:bg-rose-900/40 px-1 rounded">assignments</code>, <code className="font-mono bg-rose-100 dark:bg-rose-900/40 px-1 rounded">classroom_inventory_allocation</code>, <code className="font-mono bg-rose-100 dark:bg-rose-900/40 px-1 rounded">class_notes</code>, and <code className="font-mono bg-rose-200 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 px-1 rounded font-semibold">student_topic_progress</code> tables don&apos;t exist yet in your <strong>auth Supabase project</strong> (<code className="font-mono">sevtycwrmhzyfxvxkkgc</code>).
                            </p>
                            <p className="text-xs text-rose-700 dark:text-rose-405 mt-2">
                                Go to <strong>Supabase Dashboard → SQL Editor → New Query</strong> and paste the SQL copy from below, then click Run.
                            </p>
                        </div>
                        <button onClick={() => setDbSetupError(false)} className="p-1 rounded text-rose-400 hover:text-rose-600 flex-shrink-0 cursor-pointer"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="mx-5 mb-4 relative">
                        <pre className="text-[10px] font-mono bg-rose-900/10 dark:bg-rose-955/30 text-rose-900 dark:text-rose-200 p-4 rounded-xl overflow-x-auto leading-relaxed border border-rose-200 dark:border-rose-800 max-h-40 overflow-y-auto">{`-- Run in: Supabase Dashboard > SQL Editor
CREATE TABLE IF NOT EXISTS public.class_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  classroom_id UUID NOT NULL, teacher_id UUID NOT NULL,
  title TEXT NOT NULL, content TEXT, file_url TEXT,
  file_name TEXT, file_size INTEGER, color TEXT DEFAULT 'yellow',
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  classroom_id UUID NOT NULL, teacher_id UUID NOT NULL,
  title TEXT NOT NULL, description TEXT, due_date DATE,
  target_type TEXT NOT NULL DEFAULT 'all',
  file_url TEXT, file_name TEXT, file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.assignment_students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL, student_id UUID NOT NULL,
  status TEXT DEFAULT 'pending', UNIQUE (assignment_id, student_id)
);
CREATE TABLE IF NOT EXISTS public.classroom_inventory_allocation (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.course_modules(id) ON DELETE SET NULL,
  chapter_id UUID REFERENCES public.course_chapters(id) ON DELETE SET NULL,
  lesson_id UUID REFERENCES public.course_lessons(id) ON DELETE SET NULL,
  allocated_by UUID REFERENCES public.users(id),
  allocated_to_student_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.student_topic_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'locked',
  unlocked_by TEXT NOT NULL DEFAULT 'system',
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (student_id, lesson_id)
);
ALTER TABLE public.class_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_inventory_allocation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_topic_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all class_notes" ON public.class_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all assignments" ON public.assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all assignment_students" ON public.assignment_students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all classroom_inventory_allocation" ON public.classroom_inventory_allocation FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all student_topic_progress" ON public.student_topic_progress FOR ALL USING (true) WITH CHECK (true);`}</pre>
                        <button
                            onClick={() => {
                                const sql = `CREATE TABLE IF NOT EXISTS public.class_notes (\n  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n  classroom_id UUID NOT NULL, teacher_id UUID NOT NULL,\n  title TEXT NOT NULL, content TEXT, file_url TEXT,\n  file_name TEXT, file_size INTEGER, color TEXT DEFAULT 'yellow',\n  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()\n);\nCREATE TABLE IF NOT EXISTS public.assignments (\n  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n  classroom_id UUID NOT NULL, teacher_id UUID NOT NULL,\n  title TEXT NOT NULL, description TEXT, due_date DATE,\n  target_type TEXT NOT NULL DEFAULT 'all',\n  file_url TEXT, file_name TEXT, file_size INTEGER,\n  created_at TIMESTAMPTZ DEFAULT now()\n);\nCREATE TABLE IF NOT EXISTS public.assignment_students (\n  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n  assignment_id UUID NOT NULL, student_id UUID NOT NULL,\n  status TEXT DEFAULT 'pending', UNIQUE (assignment_id, student_id)\n);\nCREATE TABLE IF NOT EXISTS public.classroom_inventory_allocation (\n  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,\n  module_id UUID REFERENCES public.course_modules(id) ON DELETE SET NULL,\n  chapter_id UUID REFERENCES public.course_chapters(id) ON DELETE SET NULL,\n  lesson_id UUID REFERENCES public.course_lessons(id) ON DELETE SET NULL,\n  allocated_by UUID REFERENCES public.users(id),\n  allocated_to_student_id UUID REFERENCES public.users(id),\n  created_at TIMESTAMPTZ DEFAULT now()\n);\nCREATE TABLE IF NOT EXISTS public.student_topic_progress (\n  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,\n  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,\n  lesson_id UUID NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,\n  status TEXT NOT NULL DEFAULT 'locked',\n  unlocked_by TEXT NOT NULL DEFAULT 'system',\n  unlocked_at TIMESTAMPTZ DEFAULT now(),\n  completed_at TIMESTAMPTZ,\n  UNIQUE (student_id, lesson_id)\n);\nALTER TABLE public.class_notes ENABLE ROW LEVEL SECURITY;\nALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;\nALTER TABLE public.assignment_students ENABLE ROW LEVEL SECURITY;\nALTER TABLE public.classroom_inventory_allocation ENABLE ROW LEVEL SECURITY;\nALTER TABLE public.student_topic_progress ENABLE ROW LEVEL SECURITY;\nCREATE POLICY "Allow all class_notes" ON public.class_notes FOR ALL USING (true) WITH CHECK (true);\nCREATE POLICY "Allow all assignments" ON public.assignments FOR ALL USING (true) WITH CHECK (true);\nCREATE POLICY "Allow all assignment_students" ON public.assignment_students FOR ALL USING (true) WITH CHECK (true);\nCREATE POLICY "Allow all classroom_inventory_allocation" ON public.classroom_inventory_allocation FOR ALL USING (true) WITH CHECK (true);\nCREATE POLICY "Allow all student_topic_progress" ON public.student_topic_progress FOR ALL USING (true) WITH CHECK (true);`;
                                navigator.clipboard.writeText(sql).then(() => alert('SQL copied to clipboard!'));
                            }}
                            className="absolute top-2 right-2 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                        >
                            Copy SQL
                        </button>
                    </div>
                    <div className="px-5 pb-4">
                        <button
                            onClick={() => { window.location.reload(); }}
                            className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                        >
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Reload Page after running SQL
                        </button>
                    </div>
                </div>
            )}

            {/* ── Main Two-Panel Layout ─────────────────────────────────── */}
            <div className="flex flex-col xl:flex-row gap-6">

                {/* ══ LEFT: Notes Board ══════════════════════════════════════ */}
                <div className="xl:w-96 flex-shrink-0 space-y-4">
                    {/* Board Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <NotebookPen className="w-5 h-5 text-[#ecb613]" />
                            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Notes Board</h3>
                            {classNotes.length > 0 && (
                                <span className="text-xs font-bold text-slate-400 bg-slate-105 dark:bg-slate-800 px-2 py-0.5 rounded-full">{classNotes.length}</span>
                            )}
                        </div>
                        <button
                            id="new-note-btn"
                            onClick={openNewNote}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ecb613] text-slate-900 font-bold text-xs hover:bg-[#ecb613]/90 shadow-sm shadow-[#ecb613]/20 transition-all cursor-pointer"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            New Note
                        </button>
                    </div>

                    {/* Notes List */}
                    {notesLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-7 h-7 animate-spin text-[#ecb613]" />
                        </div>
                    ) : classNotes.length === 0 ? (
                        <button
                            onClick={openNewNote}
                            className="w-full flex flex-col items-center justify-center gap-3 py-14 border-2 border-dashed border-amber-200 dark:border-amber-700/30 rounded-2xl bg-amber-50/50 dark:bg-amber-900/5 hover:bg-amber-55 dark:hover:bg-amber-900/10 hover:border-amber-300 dark:hover:border-amber-600/50 transition-all group cursor-pointer text-center"
                        >
                            <StickyNote className="w-10 h-10 text-amber-300 dark:text-amber-600 group-hover:scale-110 transition-transform" />
                            <div>
                                <p className="font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200">No notes yet</p>
                                <p className="text-xs text-slate-405 mt-1">Click to write your first class note</p>
                            </div>
                        </button>
                    ) : (
                        <div className="space-y-3">
                            {classNotes.map((note: any) => {
                                const palette = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
                                return (
                                    <div
                                        key={note.id}
                                        draggable="true"
                                        onDragStart={(e) => handleDragStart(e, note)}
                                        className={`rounded-2xl border overflow-hidden shadow-sm group transition-shadow hover:shadow-md cursor-grab active:cursor-grabbing text-left ${palette.bg} ${palette.border}`}
                                    >
                                        {/* Note header bar */}
                                        <div className={`flex items-center justify-between px-4 py-2.5 ${palette.header}`}>
                                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                <GripVertical className="w-3.5 h-3.5 text-slate-400 dark:text-slate-550 cursor-grab active:cursor-grabbing opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate flex-1">{note.title}</h4>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                <button
                                                    onClick={() => openEditNote(note)}
                                                    className="p-1.5 rounded-lg bg-white/70 dark:bg-slate-700/70 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                                    title="Edit note"
                                                >
                                                    <Edit3 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteNote(note.id)}
                                                    disabled={deletingNoteId === note.id}
                                                    className="p-1.5 rounded-lg bg-white/70 dark:bg-slate-700/70 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors cursor-pointer"
                                                    title="Delete note"
                                                >
                                                    {deletingNoteId === note.id
                                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                                                        : <Trash2 className="w-3.5 h-3.5 text-rose-500" />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Note body */}
                                        <div className="px-4 py-3">
                                            {note.content && (
                                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap line-clamp-4">{note.content}</p>
                                            )}
                                            {/* File chip */}
                                            {note.file_url && (
                                                <a
                                                    href={note.file_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-705 dark:text-slate-300 hover:border-[#ecb613]/50 hover:text-[#ecb613] transition-all max-w-full"
                                                >
                                                    <Download className="w-3 h-3 flex-shrink-0" />
                                                    <span className="truncate">{note.file_name || 'Attachment'}</span>
                                                    {note.file_size && <span className="text-slate-400 flex-shrink-0">· {formatFileSize(note.file_size)}</span>}
                                                </a>
                                            )}
                                            {/* Timestamp */}
                                            <p className="mt-2.5 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                                                {new Date(note.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ══ RIGHT: Assignments Panel ════════════════════════════════ */}
                <div 
                    className="flex-1 min-w-0 space-y-4 relative text-left"
                    onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'copy';
                    }}
                    onDragEnter={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.types.includes('application/json')) {
                            setIsDraggingOverAssignments(true);
                        }
                    }}
                >
                    {isDraggingOverAssignments && (
                        <div 
                            className="absolute inset-0 z-50 bg-amber-500/10 dark:bg-amber-500/5 border-3 border-dashed border-[#ecb613] rounded-2xl flex flex-col items-center justify-center gap-3 backdrop-blur-[2px] transition-all animate-in fade-in zoom-in-95 duration-200"
                            onDragOver={(e) => {
                                e.preventDefault();
                            }}
                            onDragLeave={(e) => {
                                e.preventDefault();
                                setIsDraggingOverAssignments(false);
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDraggingOverAssignments(false);
                                handleDropNote(e);
                            }}
                        >
                            <div className="w-14 h-14 rounded-full bg-[#ecb613]/20 flex items-center justify-center text-[#ecb613] animate-bounce shadow-md">
                                <ClipboardList className="w-7 h-7" />
                            </div>
                            <p className="font-extrabold text-[#ecb613] text-sm dark:text-[#ecb613] tracking-wide">Drop Note to Create Assignment</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center px-6">
                                Release to configure options and assign to everyone or individuals.
                            </p>
                        </div>
                    )}
                    {/* Panel Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <ClipboardList className="w-5 h-5 text-[#ecb613]" />
                            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Assignments</h3>
                            {assignments.length > 0 && (
                                <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{assignments.length}</span>
                            )}
                        </div>
                        <button
                            id="new-assignment-btn"
                            onClick={() => setShowAssignmentModal(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ecb613] text-slate-900 font-bold text-sm hover:bg-[#ecb613]/90 shadow-md shadow-[#ecb613]/20 transition-all self-start cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            New Assignment
                        </button>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-2">
                        {([['all', 'All', Filter], ['all_students', '👥 For Everyone', UsersRound], ['individual', '👤 Individual', User]] as const).map(([value, label]) => (
                            <button
                                key={value}
                                onClick={() => setAssignmentFilter(value)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                    assignmentFilter === value
                                        ? 'bg-[#ecb613]/10 text-[#ecb613] border-[#ecb613]/40'
                                        : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Assignment Cards */}
                    {assignmentsLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-[#ecb613]" />
                        </div>
                    ) : filteredAssignments.length === 0 ? (
                        <button
                            onClick={() => setShowAssignmentModal(true)}
                            className="w-full flex flex-col items-center justify-center gap-3 py-16 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-350 transition-all group cursor-pointer text-center"
                        >
                            <ClipboardList className="w-10 h-10 text-slate-300 dark:text-slate-600 group-hover:scale-110 transition-transform" />
                            <div>
                                <p className="font-bold text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200">
                                    {assignmentFilter !== 'all' ? 'No assignments match this filter.' : 'No assignments yet'}
                                </p>
                                {assignmentFilter === 'all' && <p className="text-xs text-slate-400 mt-1">Click to create your first assignment</p>}
                            </div>
                        </button>
                    ) : (
                        <div className="space-y-3">
                            {filteredAssignments.map((asg: any) => {
                                const isExpanded = expandedAssignmentId === asg.id;
                                const isDeleting = deletingAssignmentId === asg.id;
                                const isDue = asg.due_date && new Date(asg.due_date) < new Date();
                                return (
                                    <div
                                        key={asg.id}
                                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-shadow hover:shadow-md text-left"
                                    >
                                        {/* Card Header */}
                                        <div 
                                            onClick={() => setExpandedAssignmentId(isExpanded ? null : asg.id)}
                                            className="px-5 py-4 flex items-start gap-3 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-805/10 transition-colors"
                                        >
                                            {/* Icon */}
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                                asg.target_type === 'all'
                                                    ? 'bg-indigo-50 dark:bg-indigo-900/20'
                                                    : 'bg-amber-50 dark:bg-amber-900/20'
                                            }`}>
                                                {asg.target_type === 'all'
                                                    ? <UsersRound className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                                    : <User className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0 text-left">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{asg.title}</h4>
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        asg.target_type === 'all'
                                                            ? 'bg-indigo-105 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                                                            : 'bg-amber-105 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                    }`}>
                                                        {asg.target_type === 'all' ? '👥 All Students' : `👤 Individual (${asg.assignment_students?.length ?? 0})`}
                                                    </span>
                                                    {asg.due_date && (
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                            isDue
                                                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                        }`}>
                                                            <Calendar className="w-2.5 h-2.5" />
                                                            {isDue ? 'Overdue · ' : 'Due · '}{new Date(asg.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                        </span>
                                                    )}
                                                </div>
                                                {asg.description && (
                                                    <p className="text-xs text-slate-550 dark:text-slate-400 leading-relaxed line-clamp-2">{asg.description}</p>
                                                )}
                                                {asg.inventory_ref_id ? (
                                                    <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-450 select-none">
                                                        <BookOpen className="w-3 h-3 text-[#ecb613]" />
                                                        Topic: <span className="text-[#ecb613]">{asg.inventory_ref_title}</span>
                                                    </div>
                                                ) : asg.file_url ? (
                                                    <a
                                                        href={asg.file_url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#ecb613] hover:underline"
                                                    >
                                                        <Paperclip className="w-3 h-3" />{asg.file_name}
                                                    </a>
                                                ) : null}
                                                <p className="text-[10px] text-slate-400 mt-1.5">
                                                    Created {new Date(asg.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </p>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                                                {asg.assignment_students && asg.assignment_students.length > 0 && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setExpandedAssignmentId(isExpanded ? null : asg.id);
                                                        }}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-805 transition-colors cursor-pointer"
                                                        title={isExpanded ? 'Collapse' : 'Show students'}
                                                    >
                                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteAssignment(asg.id);
                                                    }}
                                                    disabled={isDeleting}
                                                    className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors cursor-pointer"
                                                    title="Delete assignment"
                                                >
                                                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Expanded: student list */}
                                        {isExpanded && asg.assignment_students && asg.assignment_students.length > 0 && (
                                            <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 px-5 py-4">
                                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Assigned Students</p>
                                                <div className="space-y-2">
                                                    {asg.assignment_students.map((as: any) => {
                                                        const mappedStatusColors: Record<string, string> = {
                                                            pending: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
                                                            submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                                                            reviewed: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', // Reassigned/reviewed
                                                            approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', // Approved
                                                            draft: 'bg-slate-100 text-slate-505 dark:bg-slate-850 dark:text-slate-450 border border-dashed border-slate-300'
                                                        };

                                                        return (
                                                            <div key={as.id} className="flex items-center gap-3 p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-105 dark:border-slate-800 animate-in fade-in duration-200 text-left">
                                                                <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                                    {as.student_pic
                                                                        ? <img src={as.student_pic} alt={as.student_name} className="w-full h-full object-cover" />
                                                                        : <span className="text-xs font-bold text-slate-500">{(as.student_name || 'U').charAt(0)}</span>
                                                                    }
                                                                </div>
                                                                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex-1">{as.student_name || 'Unknown'}</span>
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${mappedStatusColors[as.status] || mappedStatusColors.pending}`}>
                                                                    {as.status === 'reviewed' ? 'Re-assigned' : as.status}
                                                                </span>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleOpenReviewModal(as, asg);
                                                                    }}
                                                                    className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-900 bg-[#ecb613] hover:bg-[#ecb613]/90 rounded-lg transition-all shadow-sm shadow-[#ecb613]/10 cursor-pointer"
                                                                >
                                                                    Review
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
