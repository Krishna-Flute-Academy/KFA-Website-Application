'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    X, Library, Upload, Mic, Paperclip, BookOpen, Search, 
    ChevronLeft, ChevronRight, Save, Send, FileText, 
    Loader2, Users, Volume2, Trash2, CheckSquare, Square,
    Check, Sparkles, Filter, ChevronDown, Calendar, Layers
} from 'lucide-react';
import { Classroom, Student, formatFileSize, formatDateForInput, AttachedMaterial } from './types';
import { supabaseAuth } from '../../../lib/supabase-auth';
import AudioRecorderWidget from '../../AudioRecorderWidget';
import InventoryPickerModal from './InventoryPickerModal';
import { sortClassroomsByDayAndTime } from '../../../lib/classroomSort';
import AutoLinkText from '../../common/AutoLinkText';

export type AssignTargetMode = 'all_students' | 'classes' | 'selected_students';
export type ClassRecipientMode = 'all_in_classes' | 'selective_in_classes';

interface TaskCreateDialogProps {
    isOpen: boolean;
    onClose: () => void;
    editingTaskId: string | null;
    initialData?: {
        title?: string;
        description?: string;
        dueDate?: string;
        fileUrl?: string;
        fileName?: string;
        fileSize?: number | null;
        inventoryRefId?: string | null;
        inventoryRefTitle?: string | null;
        classroomId?: string;
        targetMode?: 'all_students' | 'classes' | 'selected_students' | 'classroom' | 'individual' | 'all';
        selectedClassroomIds?: string[];
        classRecipientMode?: ClassRecipientMode;
        selectedStudentIds?: string[];
        attachments?: AttachedMaterial[];
    };
    classrooms: Classroom[];
    students: Student[];
    previousTasks: any[];
    inventoryCategories: any[];
    inventoryModules: any[];
    inventoryChapters: any[];
    inventoryLessons: any[];
    onSaveTask: (taskData: {
        title: string;
        description: string;
        dueDate: string;
        targetMode: AssignTargetMode;
        selectedClassroomIds: string[];
        classRecipientMode: ClassRecipientMode;
        selectedStudentIds: string[];
        attachments: AttachedMaterial[];
        fileUrl: string;
        fileName: string;
        fileSize: number | null;
        inventoryRefId: string | null;
        inventoryRefTitle: string | null;
        selectedClassroomId: string;
        isDraft: boolean;
    }) => Promise<void>;
    isSaving: boolean;
    isPopup?: boolean;
}

export default function TaskCreateDialog({
    isOpen,
    onClose,
    editingTaskId,
    initialData,
    classrooms,
    students: allStudents,
    previousTasks,
    inventoryCategories,
    inventoryModules,
    inventoryChapters,
    inventoryLessons,
    onSaveTask,
    isSaving,
    isPopup = false
}: TaskCreateDialogProps) {
    // ── Task Basic Details ───────────────────────────────────────────────────
    const [title, setTitle] = useState(initialData?.title || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [dueDate, setDueDate] = useState(initialData?.dueDate || '');

    // ── Target Mode State ────────────────────────────────────────────────────
    const initialTargetMode: AssignTargetMode = useMemo(() => {
        if (!initialData?.targetMode) return 'classes';
        if (initialData.targetMode === 'all' || initialData.targetMode === 'all_students') return 'all_students';
        if (initialData.targetMode === 'individual' || initialData.targetMode === 'selected_students') return 'selected_students';
        return 'classes';
    }, [initialData?.targetMode]);

    const [targetMode, setTargetMode] = useState<AssignTargetMode>(initialTargetMode);

    // ── Mode 2: Classrooms State ─────────────────────────────────────────────
    const [selectedClassroomIds, setSelectedClassroomIds] = useState<Set<string>>(() => {
        if (initialData?.selectedClassroomIds && initialData.selectedClassroomIds.length > 0) {
            return new Set(initialData.selectedClassroomIds);
        }
        if (initialData?.classroomId && initialData.classroomId !== 'all') {
            return new Set([initialData.classroomId]);
        }
        return new Set(classrooms.length > 0 ? [classrooms[0].id] : []);
    });

    const [classRecipientMode, setClassRecipientMode] = useState<ClassRecipientMode>(
        initialData?.classRecipientMode || 'all_in_classes'
    );

    // ── Mode 3 / Canonical Student Selection State ───────────────────────────
    // Persistent Set of selected student IDs — NEVER modified by search/class filters!
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(() => {
        return new Set(initialData?.selectedStudentIds || []);
    });

    // ── Transient Filter States for Pickers (Filtering ONLY) ────────────────
    const [classroomSearch, setClassroomSearch] = useState('');
    const [studentSearch, setStudentSearch] = useState('');
    const [classroomFilter, setClassroomFilter] = useState('all');
    const [studentPage, setStudentPage] = useState(1);
    const STUDENTS_PER_PAGE = 10;

    // Filtered Classrooms for Mode 2
    const filteredClassrooms = useMemo(() => {
        const sorted = sortClassroomsByDayAndTime(classrooms);
        if (!classroomSearch.trim()) return sorted;
        const q = classroomSearch.toLowerCase().trim();
        return sorted.filter(c => c.name.toLowerCase().includes(q));
    }, [classrooms, classroomSearch]);

    // ── Multi-Material Attachments State ──────────────────────────────────────
    const [attachments, setAttachments] = useState<AttachedMaterial[]>(() => {
        if (initialData?.attachments && initialData.attachments.length > 0) {
            return initialData.attachments;
        }
        const initialList: AttachedMaterial[] = [];
        if (initialData?.inventoryRefId) {
            initialList.push({
                id: `inv-${initialData.inventoryRefId}`,
                attachment_type: 'inventory',
                title: initialData.inventoryRefTitle || 'Curriculum Lesson',
                inventory_ref_id: initialData.inventoryRefId,
                inventory_ref_type: 'lesson'
            });
        }
        if (initialData?.fileUrl) {
            const isAudio = initialData.fileUrl.includes('.webm') || initialData.fileUrl.includes('.mp3') || initialData.fileUrl.includes('.wav') || initialData.fileUrl.includes('.m4a');
            initialList.push({
                id: `file-${Date.now()}`,
                attachment_type: isAudio ? 'audio' : 'document',
                title: initialData.fileName || 'Attached File',
                file_url: initialData.fileUrl,
                file_name: initialData.fileName || 'attachment',
                file_size: initialData.fileSize || null
            });
        }
        return initialList;
    });

    // Sub-modals & widgets
    const [isInventoryOpen, setIsInventoryOpen] = useState(false);
    const [showAudioRecorder, setShowAudioRecorder] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedPreviousTaskId, setSelectedPreviousTaskId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Student Lookup Map for fast rendering
    const studentMap = useMemo(() => {
        const map = new Map<string, Student>();
        allStudents.forEach(s => map.set(s.id, s));
        return map;
    }, [allStudents]);

    // Handle previous task suggestions
    const filteredPreviousTasks = useMemo(() => {
        const seen = new Set<string>();
        const unique: any[] = [];
        previousTasks.forEach(task => {
            const norm = (task.title || '').toLowerCase().trim();
            if (norm && !seen.has(norm)) {
                seen.add(norm);
                unique.push(task);
            }
        });
        if (!title.trim()) return unique;
        return unique.filter(t => t.title?.toLowerCase().includes(title.toLowerCase()));
    }, [previousTasks, title]);

    const handleSelectPreviousTask = (task: any) => {
        setTitle(task.title || '');
        setDescription(task.description || '');
        setDueDate('');
        setSelectedPreviousTaskId(task.id);
        setShowSuggestions(false);

        // Load legacy attachments if any
        const newAtts: AttachedMaterial[] = [];
        if (task.inventory_ref_id) {
            newAtts.push({
                id: `inv-${task.inventory_ref_id}`,
                attachment_type: 'inventory',
                title: task.inventory_ref_title || 'Curriculum Lesson',
                inventory_ref_id: task.inventory_ref_id,
                inventory_ref_type: task.inventory_ref_type || 'lesson'
            });
        }
        if (task.file_url) {
            const isAudio = task.file_url.includes('.webm') || task.file_url.includes('.mp3') || task.file_url.includes('.wav');
            newAtts.push({
                id: `file-${Date.now()}`,
                attachment_type: isAudio ? 'audio' : 'document',
                title: task.file_name || 'Attached File',
                file_url: task.file_url,
                file_name: task.file_name || 'attachment',
                file_size: task.file_size || null
            });
        }
        if (newAtts.length > 0) {
            setAttachments(newAtts);
        }
    };

    // ── Attachment Handlers (Independent, Non-destructive) ───────────────────
    const handleSelectInventoryLesson = (lesson: any) => {
        setAttachments(prev => {
            // Avoid duplicate identical lesson
            if (prev.some(a => a.attachment_type === 'inventory' && a.inventory_ref_id === lesson.id)) {
                return prev;
            }
            return [
                ...prev,
                {
                    id: `inv-${Date.now()}-${lesson.id}`,
                    attachment_type: 'inventory',
                    title: lesson.title,
                    inventory_ref_id: lesson.id,
                    inventory_ref_type: 'lesson'
                }
            ];
        });
        setIsInventoryOpen(false);
    };

    const uploadFile = async (file: File, isAudioNote: boolean = false) => {
        setUploadProgress(20);
        try {
            const fileExt = file.name.split('.').pop() || 'bin';
            const randomName = `${Math.random().toString(36).substring(2, 12)}_${Date.now()}.${fileExt}`;
            const filePath = `materials/${randomName}`;

            setUploadProgress(50);
            const { error: uploadError } = await supabaseAuth.storage
                .from('inventory_materials')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            setUploadProgress(85);
            const { data: { publicUrl } } = supabaseAuth.storage
                .from('inventory_materials')
                .getPublicUrl(filePath);

            setUploadProgress(100);
            setTimeout(() => {
                setUploadProgress(null);
                const isAudio = isAudioNote || file.type.startsWith('audio/') || file.name.endsWith('.webm') || file.name.endsWith('.mp3') || file.name.endsWith('.wav');
                setAttachments(prev => [
                    ...prev,
                    {
                        id: `${isAudio ? 'aud' : 'doc'}-${Date.now()}`,
                        attachment_type: isAudio ? 'audio' : 'document',
                        title: isAudio ? (file.name.includes('voice_instruction') ? 'Teacher Voice Instruction' : file.name) : file.name,
                        file_url: publicUrl,
                        file_name: file.name,
                        file_size: file.size
                    }
                ]);
            }, 300);
        } catch (err: any) {
            console.error('File upload failed:', err);
            setUploadProgress(null);
            alert(`File upload failed: ${err.message || 'Unknown error'}`);
        }
    };

    const handleRemoveAttachment = (attachmentId: string) => {
        setAttachments(prev => prev.filter(a => a.id !== attachmentId));
    };

    // ── Student Selection Logic (Persistent Set) ─────────────────────────────
    const handleToggleClassroom = (classroomId: string) => {
        setSelectedClassroomIds(prev => {
            const next = new Set(prev);
            if (next.has(classroomId)) {
                next.delete(classroomId);
            } else {
                next.add(classroomId);
            }
            return next;
        });
    };

    const handleToggleStudent = (studentId: string) => {
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

    const handleRemoveSelectedStudent = (studentId: string) => {
        setSelectedStudentIds(prev => {
            const next = new Set(prev);
            next.delete(studentId);
            return next;
        });
    };

    const handleClearAllSelectedStudents = () => {
        setSelectedStudentIds(new Set());
    };

    // ── Filtered Students computation (Scoped to targetMode & filters) ───────
    const visibleStudents = useMemo(() => {
        let pool = allStudents;

        if (targetMode === 'classes') {
            // Only students enrolled in any of the selected classrooms
            pool = pool.filter(s => s.classroom_ids?.some(cid => selectedClassroomIds.has(cid)));
        } else if (targetMode === 'selected_students') {
            // Filter by classroomFilter dropdown if set
            if (classroomFilter !== 'all') {
                pool = pool.filter(s => s.classroom_ids?.includes(classroomFilter));
            }
        }

        // Apply text search
        if (studentSearch.trim()) {
            const q = studentSearch.toLowerCase().trim();
            pool = pool.filter(s => 
                s.name.toLowerCase().includes(q) ||
                (s.classroom_names && s.classroom_names.some(cn => cn.toLowerCase().includes(q)))
            );
        }

        return pool;
    }, [allStudents, targetMode, selectedClassroomIds, classroomFilter, studentSearch]);

    const paginatedStudents = useMemo(() => {
        const start = (studentPage - 1) * STUDENTS_PER_PAGE;
        return visibleStudents.slice(start, start + STUDENTS_PER_PAGE);
    }, [visibleStudents, studentPage]);

    const handleSelectAllVisible = () => {
        setSelectedStudentIds(prev => {
            const next = new Set(prev);
            visibleStudents.forEach(s => next.add(s.id));
            return next;
        });
    };

    const handleDeselectVisible = () => {
        setSelectedStudentIds(prev => {
            const next = new Set(prev);
            visibleStudents.forEach(s => next.delete(s.id));
            return next;
        });
    };

    // ── Resolved Recipient Calculation on Submit ─────────────────────────────
    const resolvedRecipients = useMemo(() => {
        if (targetMode === 'all_students') {
            return allStudents.map(s => s.id);
        }
        if (targetMode === 'classes') {
            if (classRecipientMode === 'all_in_classes') {
                return allStudents
                    .filter(s => s.classroom_ids?.some(cid => selectedClassroomIds.has(cid)))
                    .map(s => s.id);
            }
            // Selective within selected classes
            return Array.from(selectedStudentIds).filter(id => {
                const s = studentMap.get(id);
                return s?.classroom_ids?.some(cid => selectedClassroomIds.has(cid));
            });
        }
        return Array.from(selectedStudentIds);
    }, [targetMode, classRecipientMode, allStudents, selectedClassroomIds, selectedStudentIds, studentMap]);

    const handleSubmit = async (isDraft: boolean) => {
        if (!title.trim() || !description.trim()) {
            alert('Please provide a task title and detailed instructions.');
            return;
        }

        if (!isDraft && !dueDate) {
            alert('Please select a due date for the task.');
            return;
        }

        if (!isDraft && targetMode === 'classes' && selectedClassroomIds.size === 0) {
            alert('Please select at least one classroom.');
            return;
        }

        if (!isDraft && resolvedRecipients.length === 0) {
            alert('Please select at least one recipient student for this assignment.');
            return;
        }

        // Dual-write legacy fields for backward compatibility
        const primaryDoc = attachments.find(a => a.attachment_type === 'document' || a.attachment_type === 'audio');
        const primaryInv = attachments.find(a => a.attachment_type === 'inventory');
        const primaryClassId = Array.from(selectedClassroomIds)[0] || classrooms[0]?.id || '';

        await onSaveTask({
            title: title.trim(),
            description: description.trim(),
            dueDate,
            targetMode,
            selectedClassroomIds: Array.from(selectedClassroomIds),
            classRecipientMode,
            selectedStudentIds: resolvedRecipients,
            attachments,
            // Legacy mirror fields
            fileUrl: primaryDoc?.file_url || '',
            fileName: primaryDoc?.file_name || '',
            fileSize: primaryDoc?.file_size || null,
            inventoryRefId: primaryInv?.inventory_ref_id || null,
            inventoryRefTitle: primaryInv?.title || null,
            selectedClassroomId: primaryClassId,
            isDraft
        });
    };

    if (!isOpen) return null;

    return (
        <div className={`fixed inset-0 z-50 flex animate-in fade-in duration-200 ${isPopup ? 'bg-transparent' : 'bg-black/60 backdrop-blur-sm items-center justify-center p-2 sm:p-4'}`}>
            <div className={`bg-white dark:bg-slate-900 flex flex-col text-left ${isPopup ? 'w-full h-full overflow-y-auto' : 'rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full max-h-[94vh] overflow-hidden animate-in zoom-in-95 duration-200'}`}>
                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* Header                                                          */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                <div className="p-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40 rounded-t-3xl shrink-0">
                    <div>
                        <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-white leading-tight flex items-center gap-2">
                            <span>{editingTaskId ? 'Edit Task Assignment' : 'Create & Assign Task'}</span>
                            {resolvedRecipients.length > 0 && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                                    {resolvedRecipients.length} {resolvedRecipients.length === 1 ? 'recipient' : 'recipients'}
                                </span>
                            )}
                        </h2>
                        <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 font-medium">
                            Set up instructions, multiple learning materials, and distribute to classrooms or selected students
                        </p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors cursor-pointer"
                        type="button"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* Body Content (Desktop 2-Col Grid / Mobile Stacked)             */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 font-sans">
                    {/* ── Left Column (Lg: col-span-7): Details & Materials ──────── */}
                    <div className="lg:col-span-7 space-y-5">
                        {/* Task Title with Suggestions */}
                        <div className="relative">
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                                    Task Title <span className="text-rose-500">*</span>
                                </label>
                                {selectedPreviousTaskId && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                                        Template Loaded
                                    </span>
                                )}
                            </div>
                            <input 
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-[#ecb613] outline-none transition-all text-sm font-semibold placeholder:text-slate-400" 
                                placeholder="e.g., Raag Bhoopali – Aaroh & Avaroh Drill" 
                                type="text"
                                value={title}
                                onChange={(e) => {
                                    setTitle(e.target.value);
                                    setShowSuggestions(true);
                                }}
                                onFocus={() => setShowSuggestions(true)}
                            />

                            {/* Suggestions dropdown */}
                            {showSuggestions && filteredPreviousTasks.length > 0 && !selectedPreviousTaskId && (
                                <div className="absolute z-30 left-0 right-0 mt-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50 animate-in fade-in-50">
                                    <div className="p-2 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-850 px-3">
                                        Suggested Previous Task Templates
                                    </div>
                                    {filteredPreviousTasks.slice(0, 5).map(task => (
                                        <button
                                            key={task.id}
                                            type="button"
                                            onClick={() => handleSelectPreviousTask(task)}
                                            className="w-full text-left p-2.5 hover:bg-amber-500/10 transition-colors flex items-start gap-2 cursor-pointer"
                                        >
                                            <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                            <div className="min-w-0 flex-1">
                                                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                                    {task.title}
                                                </div>
                                                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                                    {task.description}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Detailed Instructions */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
                                Detailed Instructions <span className="text-rose-500">*</span>
                            </label>
                            <textarea 
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-[#ecb613] outline-none transition-all placeholder:text-slate-400 text-sm leading-relaxed" 
                                placeholder="Provide specific guidance on breath control, finger placement, metronome tempo, or scale drills..." 
                                rows={4}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>

                        {/* ── Learning Materials & Attachments ───────────────────────── */}
                        <div className="space-y-3">
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                                Learning Materials & Attachments
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                {/* Button 1: Curriculum Inventory */}
                                <button 
                                    onClick={() => setIsInventoryOpen(true)}
                                    className="group flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl hover:border-[#ecb613] hover:bg-[#ecb613]/10 transition-all text-center cursor-pointer min-h-[58px]" 
                                    type="button"
                                >
                                    <Library className="w-4 h-4 text-[#ecb613] mb-1 group-hover:scale-110 transition-transform" />
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">Curriculum Inventory</span>
                                    <span className="text-[10px] text-slate-400">Attach lesson / notes</span>
                                </button>

                                {/* Button 2: Upload File */}
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="group flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl hover:border-[#ecb613] hover:bg-[#ecb613]/10 transition-all text-center cursor-pointer min-h-[58px]" 
                                    type="button"
                                >
                                    {uploadProgress !== null ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-[#ecb613] mb-1" />
                                    ) : (
                                        <Upload className="w-4 h-4 text-[#ecb613] mb-1 group-hover:scale-110 transition-transform" />
                                    )}
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                                        {uploadProgress !== null ? `(${uploadProgress}%)` : 'Upload Document'}
                                    </span>
                                    <span className="text-[10px] text-slate-400">PDF, image, audio</span>
                                </button>

                                {/* Button 3: Record Voice */}
                                <button 
                                    onClick={() => setShowAudioRecorder(prev => !prev)}
                                    className={`group flex flex-col items-center justify-center p-3 border-2 border-dashed rounded-2xl transition-all text-center cursor-pointer min-h-[58px] ${
                                        showAudioRecorder 
                                            ? 'border-[#ecb613] bg-[#ecb613]/10' 
                                            : 'border-slate-200 dark:border-slate-800 hover:border-[#ecb613] hover:bg-[#ecb613]/10'
                                    }`} 
                                    type="button"
                                >
                                    <Mic className="w-4 h-4 text-[#ecb613] mb-1 group-hover:scale-110 transition-transform" />
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">Record Voice</span>
                                    <span className="text-[10px] text-slate-400">Live teacher note</span>
                                </button>
                            </div>

                            {/* Voice Recorder Dropdown */}
                            {showAudioRecorder && (
                                <div className="p-3 bg-amber-50/60 dark:bg-slate-800/80 rounded-2xl border border-amber-300/60 dark:border-amber-500/30">
                                    <AudioRecorderWidget
                                        onAudioRecorded={(file) => {
                                            uploadFile(file, true);
                                            setShowAudioRecorder(false);
                                        }}
                                        onCancel={() => setShowAudioRecorder(false)}
                                        label="Record Voice Instruction"
                                    />
                                </div>
                            )}

                            {/* ── ATTACHED MATERIALS TRAY (Coexistence) ──────────────── */}
                            {attachments.length > 0 && (
                                <div className="space-y-2 pt-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                                            <Paperclip className="w-3 h-3 text-amber-500" />
                                            Attached Materials ({attachments.length})
                                        </span>
                                    </div>

                                    <div className="space-y-2">
                                        {attachments.map((item) => (
                                            <div 
                                                key={item.id}
                                                className="p-3 bg-slate-50 dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3 shadow-2xs"
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                    {item.attachment_type === 'inventory' ? (
                                                        <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                                                            <BookOpen className="w-4 h-4" />
                                                        </div>
                                                    ) : item.attachment_type === 'audio' ? (
                                                        <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-700 dark:text-purple-400 flex items-center justify-center shrink-0">
                                                            <Volume2 className="w-4 h-4" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                                                            <FileText className="w-4 h-4" />
                                                        </div>
                                                    )}

                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                                                {item.title}
                                                            </span>
                                                            <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md bg-white dark:bg-slate-700 text-slate-500 border border-slate-200 dark:border-slate-600 shrink-0">
                                                                {item.attachment_type}
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                                                            {item.file_size ? formatFileSize(item.file_size) : null}
                                                            {item.file_url && (
                                                                <a 
                                                                    href={item.file_url} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer" 
                                                                    className="text-amber-600 hover:underline"
                                                                >
                                                                    Preview Link ↗
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Audio Player preview for recorded notes */}
                                                {item.attachment_type === 'audio' && item.file_url && (
                                                    <div className="hidden sm:block">
                                                        <audio src={item.file_url} controls className="h-7 w-40" />
                                                    </div>
                                                )}

                                                {/* Remove attachment button */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveAttachment(item.id)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                                                    title="Remove this attachment"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Right Column (Lg: col-span-5): Assign To & Due Date ────── */}
                    <div className="lg:col-span-5 space-y-5 bg-slate-50/50 dark:bg-slate-850/50 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                        <div className="space-y-4">
                            {/* ── ASSIGN TO SELECTOR ─────────────────────────────────── */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-2">
                                    Assign To
                                </label>
                                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-2xl">
                                    <button
                                        type="button"
                                        onClick={() => setTargetMode('all_students')}
                                        className={`py-2 px-1 text-xs font-bold rounded-xl transition-all text-center cursor-pointer ${
                                            targetMode === 'all_students'
                                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-black'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                        }`}
                                    >
                                        All Students
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTargetMode('classes')}
                                        className={`py-2 px-1 text-xs font-bold rounded-xl transition-all text-center cursor-pointer ${
                                            targetMode === 'classes'
                                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-black'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                        }`}
                                    >
                                        Class / Classes
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTargetMode('selected_students')}
                                        className={`py-2 px-1 text-xs font-bold rounded-xl transition-all text-center cursor-pointer ${
                                            targetMode === 'selected_students'
                                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-black'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                        }`}
                                    >
                                        Selected Students
                                    </button>
                                </div>
                            </div>

                            {/* ── MODE 1: ALL STUDENTS ──────────────────────────────── */}
                            {targetMode === 'all_students' && (
                                <div className="p-4 bg-amber-500/10 dark:bg-amber-950/30 rounded-2xl border border-amber-500/20 space-y-2">
                                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-black text-xs">
                                        <Users className="w-4 h-4" />
                                        <span>Assigning to All Students</span>
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                        This task will be assigned to all <strong>{allStudents.length} eligible students</strong> across the academy.
                                    </p>
                                </div>
                            )}

                            {/* ── MODE 2: CLASS / CLASSES ───────────────────────────── */}
                            {targetMode === 'classes' && (
                                <div className="space-y-3">
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                                                Select Classrooms ({selectedClassroomIds.size} selected)
                                            </label>
                                            {selectedClassroomIds.size > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedClassroomIds(new Set())}
                                                    className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
                                                >
                                                    Clear All
                                                </button>
                                            )}
                                        </div>

                                        {/* Classroom Search Bar */}
                                        <div className="relative mb-2">
                                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                            <input
                                                type="text"
                                                placeholder="Search classes by name, day, or time..."
                                                value={classroomSearch}
                                                onChange={(e) => setClassroomSearch(e.target.value)}
                                                className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-[#ecb613]"
                                            />
                                            {classroomSearch && (
                                                <button
                                                    type="button"
                                                    onClick={() => setClassroomSearch('')}
                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Quick Select/Deselect visible classes */}
                                        {filteredClassrooms.length > 0 && (
                                            <div className="flex items-center justify-between text-[10px] px-1 mb-1 text-slate-500">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedClassroomIds(prev => {
                                                            const next = new Set(prev);
                                                            filteredClassrooms.forEach(c => next.add(c.id));
                                                            return next;
                                                        });
                                                    }}
                                                    className="hover:text-amber-600 font-bold transition-colors cursor-pointer"
                                                >
                                                    Select All Visible ({filteredClassrooms.length})
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedClassroomIds(prev => {
                                                            const next = new Set(prev);
                                                            filteredClassrooms.forEach(c => next.delete(c.id));
                                                            return next;
                                                        });
                                                    }}
                                                    className="hover:text-rose-500 font-bold transition-colors cursor-pointer"
                                                >
                                                    Deselect Visible
                                                </button>
                                            </div>
                                        )}

                                        <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 p-1">
                                            {filteredClassrooms.length > 0 ? (
                                                filteredClassrooms.map(cls => {
                                                    const isChecked = selectedClassroomIds.has(cls.id);
                                                    return (
                                                        <div
                                                            key={cls.id}
                                                            onClick={() => handleToggleClassroom(cls.id)}
                                                            className="flex items-center gap-2.5 p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg cursor-pointer transition-colors"
                                                        >
                                                            <input 
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => handleToggleClassroom(cls.id)}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="rounded border-slate-300 text-[#ecb613] focus:ring-[#ecb613] w-4 h-4 cursor-pointer"
                                                            />
                                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                                                {cls.name}
                                                            </span>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <div className="p-3 text-center text-xs text-slate-400 italic">
                                                    No classes found matching &quot;{classroomSearch}&quot;.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Class Recipient Sub-Mode (All vs Selective) */}
                                    {selectedClassroomIds.size > 0 && (
                                        <div className="space-y-2 pt-1 border-t border-slate-200/80 dark:border-slate-700/80">
                                            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                                                Recipients in Selected Classes
                                            </label>
                                            <div className="space-y-1.5">
                                                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700 dark:text-slate-300">
                                                    <input 
                                                        type="radio"
                                                        name="classRecipientMode"
                                                        value="all_in_classes"
                                                        checked={classRecipientMode === 'all_in_classes'}
                                                        onChange={() => setClassRecipientMode('all_in_classes')}
                                                        className="text-[#ecb613] focus:ring-[#ecb613]"
                                                    />
                                                    <span>All students in selected classes</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700 dark:text-slate-300">
                                                    <input 
                                                        type="radio"
                                                        name="classRecipientMode"
                                                        value="selective_in_classes"
                                                        checked={classRecipientMode === 'selective_in_classes'}
                                                        onChange={() => setClassRecipientMode('selective_in_classes')}
                                                        className="text-[#ecb613] focus:ring-[#ecb613]"
                                                    />
                                                    <span>Select students from selected classes</span>
                                                </label>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── MODE 3: SELECTED STUDENTS & SELECTIVE CLASS STUDENTS ─ */}
                            {((targetMode === 'classes' && classRecipientMode === 'selective_in_classes') || targetMode === 'selected_students') && (
                                <div className="space-y-2.5">
                                    {/* Classroom Filter Dropdown (Selected Students Mode) */}
                                    {targetMode === 'selected_students' && (
                                        <div>
                                            <select
                                                value={classroomFilter}
                                                onChange={(e) => {
                                                    setClassroomFilter(e.target.value);
                                                    setStudentPage(1);
                                                }}
                                                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none"
                                            >
                                                <option value="all">Filter: All Classrooms</option>
                                                {sortClassroomsByDayAndTime(classrooms).map(cls => (
                                                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Search Input */}
                                    <div className="relative">
                                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            placeholder="Search students..."
                                            value={studentSearch}
                                            onChange={(e) => {
                                                setStudentSearch(e.target.value);
                                                setStudentPage(1);
                                            }}
                                            className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-[#ecb613]"
                                        />
                                    </div>

                                    {/* Quick Selection Helpers */}
                                    <div className="flex items-center justify-between text-[11px] px-1 text-slate-500">
                                        <div className="flex items-center gap-2">
                                            <button 
                                                type="button" 
                                                onClick={handleSelectAllVisible}
                                                className="hover:text-amber-600 font-bold transition-colors"
                                            >
                                                Select All Visible
                                            </button>
                                            <span>·</span>
                                            <button 
                                                type="button" 
                                                onClick={handleDeselectVisible}
                                                className="hover:text-rose-500 font-bold transition-colors"
                                            >
                                                Deselect Visible
                                            </button>
                                        </div>
                                        {selectedStudentIds.size > 0 && (
                                            <button 
                                                type="button" 
                                                onClick={handleClearAllSelectedStudents}
                                                className="text-rose-600 font-bold hover:underline"
                                            >
                                                Clear All
                                            </button>
                                        )}
                                    </div>

                                    {/* Scrollable Student List */}
                                    <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 p-1">
                                        {paginatedStudents.length > 0 ? (
                                            paginatedStudents.map(student => {
                                                const isSelected = selectedStudentIds.has(student.id);
                                                return (
                                                    <div 
                                                        key={student.id}
                                                        onClick={() => handleToggleStudent(student.id)}
                                                        className="flex items-center gap-2.5 p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg cursor-pointer transition-colors"
                                                    >
                                                        <input 
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => handleToggleStudent(student.id)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="rounded border-slate-300 text-[#ecb613] focus:ring-[#ecb613] w-4 h-4 cursor-pointer"
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block">
                                                                {student.name}
                                                            </span>
                                                            {student.classroom_names && student.classroom_names.length > 0 && (
                                                                <span className="text-[10px] text-slate-400 truncate block">
                                                                    {student.classroom_names.join(', ')}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="p-4 text-center text-xs text-slate-400 italic">No students match filter.</div>
                                        )}
                                    </div>

                                    {/* Pagination */}
                                    {visibleStudents.length > STUDENTS_PER_PAGE && (
                                        <div className="flex items-center justify-between px-1">
                                            <button 
                                                type="button"
                                                onClick={() => setStudentPage(p => Math.max(1, p - 1))}
                                                disabled={studentPage === 1}
                                                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                                            >
                                                <ChevronLeft className="w-3.5 h-3.5" />
                                            </button>
                                            <span className="text-[9px] font-black text-slate-400 font-mono">
                                                {studentPage} / {Math.ceil(visibleStudents.length / STUDENTS_PER_PAGE)}
                                            </span>
                                            <button 
                                                type="button"
                                                onClick={() => setStudentPage(p => Math.min(Math.ceil(visibleStudents.length / STUDENTS_PER_PAGE), p + 1))}
                                                disabled={studentPage === Math.ceil(visibleStudents.length / STUDENTS_PER_PAGE)}
                                                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                                            >
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}

                                    {/* ── PERSISTENT SELECTED STUDENTS SUMMARY ───────────── */}
                                    {selectedStudentIds.size > 0 && (
                                        <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                <span>Selected Students ({selectedStudentIds.size})</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                                                {Array.from(selectedStudentIds).map(sid => {
                                                    const s = studentMap.get(sid);
                                                    if (!s) return null;
                                                    return (
                                                        <span 
                                                            key={sid}
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-500/30"
                                                        >
                                                            <span className="truncate max-w-[120px]">{s.name}</span>
                                                            <button 
                                                                type="button"
                                                                onClick={() => handleRemoveSelectedStudent(sid)}
                                                                className="hover:text-rose-500 transition-colors"
                                                            >
                                                                <X className="w-2.5 h-2.5" />
                                                            </button>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Due Date Field ─────────────────────────────────────── */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 font-mono">
                                    Due Date <span className="text-rose-500">*</span>
                                </label>
                                <input 
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#ecb613]" 
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* ── Action Buttons ─────────────────────────────────────────── */}
                        <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                            <button 
                                type="button"
                                onClick={() => handleSubmit(false)}
                                disabled={isSaving}
                                className="w-full min-h-[44px] py-2.5 px-4 bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900 font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingTaskId ? <Save className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                                <span>{editingTaskId ? 'Save Task Changes' : `Assign Task (${resolvedRecipients.length})`}</span>
                            </button>

                            <button 
                                type="button"
                                onClick={() => handleSubmit(true)}
                                disabled={isSaving}
                                className="w-full min-h-[40px] py-2 px-4 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                            >
                                <FileText className="w-4 h-4" />
                                <span>Save as Draft</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* Inventory Picker Sub-Modal                                          */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <InventoryPickerModal 
                isOpen={isInventoryOpen}
                onClose={() => setIsInventoryOpen(false)}
                categories={inventoryCategories}
                modules={inventoryModules}
                chapters={inventoryChapters}
                lessons={inventoryLessons}
                onSelectLesson={handleSelectInventoryLesson}
            />

            {/* Hidden file input for uploading docs/media */}
            <input 
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadFile(f);
                }}
                className="hidden"
                accept=".pdf,.mp3,.wav,.mp4,.png,.jpg,.jpeg,.doc,.docx"
            />
        </div>
    );
}
