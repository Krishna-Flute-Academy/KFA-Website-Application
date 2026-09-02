'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    X, Library, Upload, Mic, Paperclip, BookOpen, Search, 
    ChevronLeft, ChevronRight, ChevronDown, Save, Send, FileText, 
    Loader2, Users, ClipboardList 
} from 'lucide-react';
import { Classroom, Student, formatFileSize, formatDateForInput } from './types';
import { supabaseAuth } from '../../../lib/supabase-auth';
import AudioRecorderWidget from '../../AudioRecorderWidget';
import InventoryPickerModal from './InventoryPickerModal';
import { sortClassroomsByDayAndTime } from '../../../lib/classroomSort';
import AutoLinkText from '../../common/AutoLinkText';

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
        targetMode?: 'classroom' | 'individual' | 'all';
        selectedStudentIds?: string[];
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
        targetMode: 'classroom' | 'individual' | 'all';
        selectedClassroomId: string;
        selectedStudentIds: string[];
        fileUrl: string;
        fileName: string;
        fileSize: number | null;
        inventoryRefId: string | null;
        inventoryRefTitle: string | null;
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
    students: initialStudents,
    previousTasks,
    inventoryCategories,
    inventoryModules,
    inventoryChapters,
    inventoryLessons,
    onSaveTask,
    isSaving,
    isPopup = false
}: TaskCreateDialogProps) {
    const [title, setTitle] = useState(initialData?.title || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [dueDate, setDueDate] = useState(initialData?.dueDate || '');
    const [targetMode, setTargetMode] = useState<'classroom' | 'individual' | 'all'>(initialData?.targetMode || 'classroom');
    const [selectedClassroomId, setSelectedClassroomId] = useState(initialData?.classroomId || classrooms[0]?.id || 'all');
    
    // Attachments & Curriculum
    const [fileUrl, setFileUrl] = useState(initialData?.fileUrl || '');
    const [fileName, setFileName] = useState(initialData?.fileName || '');
    const [fileSize, setFileSize] = useState<number | null>(initialData?.fileSize || null);
    const [inventoryRefId, setInventoryRefId] = useState<string | null>(initialData?.inventoryRefId || null);
    const [inventoryRefTitle, setInventoryRefTitle] = useState<string | null>(initialData?.inventoryRefTitle || null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);

    // Sub-modals & widgets
    const [isInventoryOpen, setIsInventoryOpen] = useState(false);
    const [showAudioRecorder, setShowAudioRecorder] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedPreviousTaskId, setSelectedPreviousTaskId] = useState<string | null>(null);

    // Students selection
    const [studentsList, setStudentsList] = useState<Student[]>([]);
    const [studentSearch, setStudentSearch] = useState('');
    const [studentPage, setStudentPage] = useState(1);
    const STUDENTS_PER_PAGE = 12;
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Hydrate students list with initialData
    useEffect(() => {
        const initialSelectedSet = new Set(initialData?.selectedStudentIds || []);
        const formatted = initialStudents.map(s => ({
            ...s,
            selected: initialSelectedSet.size > 0 
                ? initialSelectedSet.has(s.id) 
                : (targetMode === 'all' ? true : (targetMode === 'classroom' && selectedClassroomId !== 'all' ? (s.classroom_ids?.includes(selectedClassroomId) ?? false) : false))
        }));
        setStudentsList(formatted);
    }, [initialStudents, initialData?.selectedStudentIds, targetMode, selectedClassroomId]);

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

    // Handle student filtering
    const filteredStudents = useMemo(() => {
        let result = studentsList;
        if (targetMode === 'classroom') {
            if (selectedClassroomId && selectedClassroomId !== 'all') {
                result = result.filter(s => s.classroom_ids?.includes(selectedClassroomId));
            }
        } else if (targetMode === 'individual') {
            if (selectedClassroomId && selectedClassroomId !== 'all') {
                result = result.filter(s => s.classroom_ids?.includes(selectedClassroomId));
            }
        }
        if (studentSearch.trim() !== '') {
            const q = studentSearch.toLowerCase().trim();
            result = result.filter(s => 
                s.name.toLowerCase().includes(q) ||
                (s.classroom_names && s.classroom_names.some(cn => cn.toLowerCase().includes(q)))
            );
        }
        return result;
    }, [studentsList, targetMode, selectedClassroomId, studentSearch]);

    const paginatedStudents = useMemo(() => {
        const start = (studentPage - 1) * STUDENTS_PER_PAGE;
        return filteredStudents.slice(start, start + STUDENTS_PER_PAGE);
    }, [filteredStudents, studentPage]);

    const selectedInFilteredCount = useMemo(() => {
        return filteredStudents.filter(s => s.selected).length;
    }, [filteredStudents]);

    const totalSelectedCount = useMemo(() => {
        return studentsList.filter(s => s.selected).length;
    }, [studentsList]);

    const isAllFilteredSelected = useMemo(() => {
        return filteredStudents.length > 0 && filteredStudents.every(s => s.selected);
    }, [filteredStudents]);

    const handleSelectPreviousTask = (task: any) => {
        setTitle(task.title || '');
        setDescription(task.description || '');
        setDueDate('');
        setSelectedPreviousTaskId(task.id);
        setShowSuggestions(false);
        setFileUrl(task.file_url || '');
        setFileName(task.file_name || '');
        setFileSize(task.file_size || null);
        setInventoryRefId(task.inventory_ref_id || null);
        setInventoryRefTitle(task.inventory_ref_title || null);
    };

    const handleTargetModeChange = (mode: 'classroom' | 'individual' | 'all') => {
        setTargetMode(mode);
        setStudentSearch('');
        if (mode === 'classroom') {
            const firstClassId = classrooms[0]?.id || 'all';
            setSelectedClassroomId(firstClassId);
            setStudentsList(prev => prev.map(s => ({
                ...s,
                selected: s.classroom_ids?.includes(firstClassId) ?? false
            })));
        } else if (mode === 'all') {
            setSelectedClassroomId('all');
            setStudentsList(prev => prev.map(s => ({ ...s, selected: true })));
        } else {
            setSelectedClassroomId('all');
            setStudentsList(prev => prev.map(s => ({ ...s, selected: false })));
        }
    };

    const handleClassroomChange = (classroomId: string) => {
        setSelectedClassroomId(classroomId);
        setStudentPage(1);
        if (!editingTaskId) {
            setStudentsList(prev => prev.map(s => ({
                ...s,
                selected: classroomId === 'all' ? true : (s.classroom_ids?.includes(classroomId) ?? false)
            })));
        }
    };

    const handleToggleStudent = (studentId: string) => {
        setStudentsList(prev => prev.map(s => 
            s.id === studentId ? { ...s, selected: !s.selected } : s
        ));
    };

    const handleToggleAllFiltered = (checked: boolean) => {
        const filteredIds = new Set(filteredStudents.map(s => s.id));
        setStudentsList(prev => prev.map(s => {
            if (filteredIds.has(s.id)) {
                return { ...s, selected: checked };
            }
            return s;
        }));
    };

    const uploadFile = async (file: File) => {
        setUploadProgress(20);
        try {
            const fileExt = file.name.split('.').pop();
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
                setFileUrl(publicUrl);
                setFileName(file.name);
                setFileSize(file.size);
                setInventoryRefId(null);
                setInventoryRefTitle(null);
            }, 400);
        } catch (err: any) {
            console.error('File upload failed:', err);
            setUploadProgress(null);
            alert(`File upload failed: ${err.message || 'Unknown error'}`);
        }
    };

    const handleSubmit = async (isDraft: boolean) => {
        if (!title.trim() || !description.trim()) {
            alert('Please provide a task title and instructions.');
            return;
        }

        if (!isDraft && !dueDate) {
            alert('Please select a due date for the task.');
            return;
        }

        const selectedIds = studentsList.filter(s => s.selected).map(s => s.id);

        if (!isDraft && targetMode !== 'all' && selectedIds.length === 0) {
            alert('Please select at least one student or target classroom.');
            return;
        }

        await onSaveTask({
            title: title.trim(),
            description: description.trim(),
            dueDate,
            targetMode,
            selectedClassroomId,
            selectedStudentIds: targetMode === 'all' ? studentsList.map(s => s.id) : selectedIds,
            fileUrl,
            fileName,
            fileSize,
            inventoryRefId,
            inventoryRefTitle,
            isDraft
        });
    };

    if (!isOpen) return null;

    return (
        <div className={`fixed inset-0 z-50 flex animate-in fade-in duration-200 ${isPopup ? 'bg-transparent' : 'bg-black/60 backdrop-blur-sm items-center justify-center p-4'}`}>
            <div className={`bg-white dark:bg-slate-900 flex flex-col text-left ${isPopup ? 'w-full h-full overflow-y-auto' : 'rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200'}`}>
                {/* Header */}
                <div className="p-5 sm:px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 rounded-t-3xl shrink-0">
                    <div>
                        <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white leading-tight">
                            {editingTaskId ? 'Edit Task Assignment' : 'Create & Assign Task'}
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5 font-semibold">
                            Distribute exercises, lesson materials, and practice checksheets to classrooms or individual students
                        </p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                        type="button"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 sm:p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
                    {/* Left 2 Cols: Title, Description, Materials */}
                    <div className="lg:col-span-2 space-y-5">
                        {/* Title with Suggestions */}
                        <div className="relative">
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                                    Task Title
                                </label>
                                {selectedPreviousTaskId && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                                        Reusing Previous Task
                                    </span>
                                )}
                            </div>
                            <div className="relative flex items-center">
                                <input 
                                    className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-[#ecb613] outline-none transition-all placeholder:text-slate-400 font-bold text-sm" 
                                    placeholder="e.g. Master the Mohanam Raga Scale" 
                                    type="text"
                                    value={title}
                                    onChange={(e) => {
                                        setTitle(e.target.value);
                                        setShowSuggestions(true);
                                    }}
                                    onFocus={() => setShowSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                />
                                <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => setShowSuggestions(prev => !prev)}
                                    className="absolute right-3 p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"
                                    title="Show previous tasks suggestions"
                                >
                                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showSuggestions ? 'rotate-180' : ''}`} />
                                </button>
                            </div>

                            {/* Dropdown suggestions */}
                            {showSuggestions && filteredPreviousTasks.length > 0 && (
                                <div 
                                    onMouseDown={(e) => e.preventDefault()}
                                    className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60"
                                >
                                    <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-slate-800/40">
                                        Reusable Task Library (Click to Reuse)
                                    </div>
                                    {filteredPreviousTasks.map(task => (
                                        <button
                                            key={task.id}
                                            type="button"
                                            onClick={() => handleSelectPreviousTask(task)}
                                            className="w-full text-left px-4 py-3 hover:bg-[#ecb613]/10 dark:hover:bg-slate-800 flex items-center justify-between transition-colors group"
                                        >
                                            <div className="flex-1 min-w-0 pr-4">
                                                <div className="font-bold text-sm text-slate-800 dark:text-slate-200 group-hover:text-amber-600 transition-colors truncate">
                                                    {task.title}
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                                    {task.description}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Instructions */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
                                Detailed Instructions
                            </label>
                            <textarea 
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-[#ecb613] outline-none transition-all placeholder:text-slate-400 text-sm" 
                                placeholder="Provide specific guidance on breath control, finger placement, or scale drills..." 
                                rows={5}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>

                        {/* Attachments & Learning Materials */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2.5 uppercase tracking-wide">
                                Learning Materials & Attachments
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <button 
                                    onClick={() => setIsInventoryOpen(true)}
                                    className="group flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl hover:border-[#ecb613] hover:bg-[#ecb613]/10 transition-all text-center cursor-pointer min-h-[44px]" 
                                    type="button"
                                >
                                    <Library className="w-5 h-5 text-[#ecb613] mb-1 group-hover:scale-110 transition-transform" />
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">Curriculum Inventory</span>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Sheet music & topics</span>
                                </button>

                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="group flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl hover:border-[#ecb613] hover:bg-[#ecb613]/10 transition-all text-center cursor-pointer min-h-[44px]" 
                                    type="button"
                                >
                                    {uploadProgress !== null ? (
                                        <Loader2 className="w-5 h-5 animate-spin text-[#ecb613] mb-1" />
                                    ) : (
                                        <Upload className="w-5 h-5 text-[#ecb613] mb-1 group-hover:scale-110 transition-transform" />
                                    )}
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                                        {uploadProgress !== null ? `(${uploadProgress}%)` : 'Upload File'}
                                    </span>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400">PDF, Audio, Video</span>
                                </button>

                                <button 
                                    onClick={() => setShowAudioRecorder(prev => !prev)}
                                    className={`group flex flex-col items-center justify-center p-3.5 border-2 border-dashed rounded-2xl transition-all text-center cursor-pointer min-h-[44px] ${
                                        showAudioRecorder 
                                            ? 'border-[#ecb613] bg-[#ecb613]/10' 
                                            : 'border-slate-200 dark:border-slate-800 hover:border-[#ecb613] hover:bg-[#ecb613]/10'
                                    }`} 
                                    type="button"
                                >
                                    <Mic className="w-5 h-5 text-[#ecb613] mb-1 group-hover:scale-110 transition-transform" />
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">Record Voice</span>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Live teacher audio note</span>
                                </button>
                            </div>

                            {/* Voice Recorder */}
                            {showAudioRecorder && (
                                <div className="mt-3">
                                    <AudioRecorderWidget
                                        onAudioRecorded={(file) => {
                                            uploadFile(file);
                                            setShowAudioRecorder(false);
                                        }}
                                        onCancel={() => setShowAudioRecorder(false)}
                                        label="Record Voice Instruction"
                                    />
                                </div>
                            )}

                            {/* Selected File Badge */}
                            {fileUrl && (
                                <div className="mt-3 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Paperclip className="w-4 h-4 text-amber-600 shrink-0" />
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate" title={fileName}>
                                                {fileName}
                                            </span>
                                            {fileSize && (
                                                <span className="text-[10px] text-slate-400 font-mono">({formatFileSize(fileSize)})</span>
                                            )}
                                        </div>
                                        <button 
                                            onClick={() => {
                                                setFileUrl('');
                                                setFileName('');
                                                setFileSize(null);
                                            }}
                                            className="p-1 text-slate-400 hover:text-rose-600 rounded-full"
                                            type="button"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {(fileUrl.includes('.webm') || fileUrl.includes('.mp3') || fileUrl.includes('.wav') || fileUrl.includes('.m4a') || fileName.toLowerCase().includes('voice')) && (
                                        <audio src={fileUrl} controls className="w-full h-8 rounded-lg" />
                                    )}
                                </div>
                            )}

                            {/* Topic Reference Badge */}
                            {inventoryRefId && (
                                <div className="mt-3 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 flex items-center justify-between">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <BookOpen className="w-4 h-4 text-amber-600 shrink-0" />
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                                            Curriculum Topic: {inventoryRefTitle}
                                        </span>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            setInventoryRefId(null);
                                            setInventoryRefTitle(null);
                                        }}
                                        className="p-1 text-slate-400 hover:text-rose-600 rounded-full"
                                        type="button"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right 1 Col: Assignees, Classroom, Due Date */}
                    <div className="lg:col-span-1 space-y-5 bg-slate-50/70 dark:bg-slate-800/20 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
                        <div className="space-y-4">
                            {/* Target Mode */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">
                                    Assign Target
                                </label>
                                <div className="grid grid-cols-3 gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <button
                                        type="button"
                                        onClick={() => handleTargetModeChange('classroom')}
                                        className={`min-h-[36px] py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                                            targetMode === 'classroom'
                                                ? 'bg-[#ecb613] text-slate-900 shadow-xs'
                                                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                                        }`}
                                    >
                                        🏫 Class
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleTargetModeChange('individual')}
                                        className={`min-h-[36px] py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                                            targetMode === 'individual'
                                                ? 'bg-[#ecb613] text-slate-900 shadow-xs'
                                                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                                        }`}
                                    >
                                        👤 Individual
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleTargetModeChange('all')}
                                        className={`min-h-[36px] py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                                            targetMode === 'all'
                                                ? 'bg-[#ecb613] text-slate-900 shadow-xs'
                                                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                                        }`}
                                    >
                                        👥 All
                                    </button>
                                </div>
                            </div>

                            {/* Class Selector for Classroom Mode */}
                            {targetMode === 'classroom' && (
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">
                                        Select Classroom
                                    </label>
                                    <select 
                                        className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#ecb613]"
                                        value={selectedClassroomId}
                                        onChange={(e) => handleClassroomChange(e.target.value)}
                                    >
                                        {sortClassroomsByDayAndTime(classrooms).map(cls => (
                                            <option key={cls.id} value={cls.id}>{cls.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Student Multi-Select List (for Individual & Classroom modes) */}
                            {targetMode !== 'all' && (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Students</label>
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300">
                                                {selectedInFilteredCount}/{filteredStudents.length}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleToggleAllFiltered(!isAllFilteredSelected)}
                                            className="text-[10px] font-bold text-amber-600 hover:underline"
                                        >
                                            {isAllFilteredSelected ? 'Deselect All' : 'Select All'}
                                        </button>
                                    </div>

                                    {targetMode === 'individual' && (
                                        <select
                                            value={selectedClassroomId}
                                            onChange={(e) => handleClassroomChange(e.target.value)}
                                            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-semibold text-slate-700 dark:text-slate-300 outline-none"
                                        >
                                            <option value="all">Filter: All Classrooms</option>
                                            {sortClassroomsByDayAndTime(classrooms).map(cls => (
                                                <option key={cls.id} value={cls.id}>{cls.name}</option>
                                            ))}
                                        </select>
                                    )}

                                    <div className="relative">
                                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            placeholder="Search students..."
                                            value={studentSearch}
                                            onChange={(e) => setStudentSearch(e.target.value)}
                                            className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-[#ecb613]"
                                        />
                                    </div>

                                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 p-1">
                                        {paginatedStudents.length > 0 ? (
                                            paginatedStudents.map(student => (
                                                <div 
                                                    key={student.id}
                                                    onClick={() => handleToggleStudent(student.id)}
                                                    className="flex items-center gap-2.5 p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg cursor-pointer transition-colors"
                                                >
                                                    <input 
                                                        type="checkbox"
                                                        checked={student.selected}
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
                                            ))
                                        ) : (
                                            <div className="p-4 text-center text-xs text-slate-400 italic">No students found.</div>
                                        )}
                                    </div>

                                    {/* Pagination */}
                                    {filteredStudents.length > STUDENTS_PER_PAGE && (
                                        <div className="flex items-center justify-between px-1">
                                            <button 
                                                type="button"
                                                onClick={() => setStudentPage(p => Math.max(1, p - 1))}
                                                disabled={studentPage === 1}
                                                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"
                                            >
                                                <ChevronLeft className="w-3.5 h-3.5" />
                                            </button>
                                            <span className="text-[9px] font-black text-slate-400 font-mono">
                                                {studentPage} / {Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE)}
                                            </span>
                                            <button 
                                                type="button"
                                                onClick={() => setStudentPage(p => Math.min(Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE), p + 1))}
                                                disabled={studentPage === Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE)}
                                                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"
                                            >
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Due Date */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">
                                    Due Date <span className="text-rose-500">*</span>
                                </label>
                                <input 
                                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#ecb613]" 
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Submit Actions */}
                        <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                            <button 
                                type="button"
                                onClick={() => handleSubmit(false)}
                                disabled={isSaving}
                                className="w-full min-h-[44px] py-2.5 px-4 bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900 font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingTaskId ? <Save className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                                <span>{editingTaskId ? 'Save Batch Changes' : 'Assign Task'}</span>
                            </button>

                            <button 
                                type="button"
                                onClick={() => handleSubmit(true)}
                                disabled={isSaving}
                                className="w-full min-h-[40px] py-2 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <FileText className="w-4 h-4" />
                                <span>Save as Draft</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Inventory Picker Sub-Modal */}
            <InventoryPickerModal 
                isOpen={isInventoryOpen}
                onClose={() => setIsInventoryOpen(false)}
                categories={inventoryCategories}
                modules={inventoryModules}
                chapters={inventoryChapters}
                lessons={inventoryLessons}
                onSelectLesson={(lesson) => {
                    setInventoryRefId(lesson.id);
                    setInventoryRefTitle(lesson.title);
                    setFileUrl('');
                    setFileName('');
                    setFileSize(null);
                }}
            />

            {/* Hidden file input */}
            <input 
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadFile(f);
                }}
                className="hidden"
                accept=".pdf,.mp3,.wav,.mp4,.png,.jpg,.jpeg"
            />
        </div>
    );
}
