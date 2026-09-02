'use client';

import React, { useMemo } from 'react';
import { 
    Library, Plus, BookOpen, Paperclip, Mic, Trash2, Edit2, 
    ChevronRight, Music, Play, Send 
} from 'lucide-react';
import { TaskTemplateGroup, formatFileSize } from './types';
import AutoLinkText from '../../../components/common/AutoLinkText';

interface TaskTemplateLibraryProps {
    templates: TaskTemplateGroup[];
    onAssignFromTemplate: (template: TaskTemplateGroup) => void;
    onDeleteTemplate: (template: TaskTemplateGroup) => void;
    searchQuery: string;
}

export default function TaskTemplateLibrary({
    templates,
    onAssignFromTemplate,
    onDeleteTemplate,
    searchQuery
}: TaskTemplateLibraryProps) {
    const filteredTemplates = useMemo(() => {
        if (!searchQuery.trim()) return templates;
        const query = searchQuery.toLowerCase().trim();
        return templates.filter(t => 
            t.taskTitle.toLowerCase().includes(query) ||
            (t.taskDescription && t.taskDescription.toLowerCase().includes(query)) ||
            (t.inventoryRefTitle && t.inventoryRefTitle.toLowerCase().includes(query)) ||
            (t.fileName && t.fileName.toLowerCase().includes(query))
        );
    }, [templates, searchQuery]);

    return (
        <div className="space-y-4">
            {/* Header info bar */}
            <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-[#ecb613]/20 flex items-center justify-center text-[#ecb613] shrink-0 border border-[#ecb613]/30">
                        <Library className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                            Reusable Task Library ({filteredTemplates.length} Templates)
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Pre-built assignments, curriculum checksheets, and exercises ready to distribute to any classroom or student.
                        </p>
                    </div>
                </div>
            </div>

            {/* Template Cards Grid */}
            {filteredTemplates.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTemplates.map(template => {
                        const isAudio = template.fileUrl && (
                            template.fileUrl.includes('.webm') || 
                            template.fileUrl.includes('.mp3') || 
                            template.fileUrl.includes('.wav') || 
                            template.fileUrl.includes('.m4a') || 
                            (template.fileName && template.fileName.toLowerCase().includes('voice'))
                        );

                        return (
                            <div 
                                key={template.templateKey}
                                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-5 flex flex-col justify-between hover:shadow-md transition-all space-y-4"
                            >
                                <div className="space-y-3">
                                    {/* Top badges */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {template.inventoryRefTitle ? (
                                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#ecb613]/10 text-amber-800 dark:text-amber-300 flex items-center gap-1">
                                                    <BookOpen className="w-3 h-3" />
                                                    {template.inventoryRefTitle}
                                                </span>
                                            ) : (
                                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                    Custom Task
                                                </span>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => onDeleteTemplate(template)}
                                            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                                            title="Delete Template"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    {/* Title & Description */}
                                    <div>
                                        <h4 className="font-black text-base text-slate-900 dark:text-white leading-snug">
                                            {template.taskTitle}
                                        </h4>
                                        {template.taskDescription && (
                                            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 line-clamp-3 leading-relaxed">
                                                <AutoLinkText text={template.taskDescription} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Media preview (Audio / File) */}
                                    {template.fileUrl && (
                                        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/60 space-y-1.5">
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                                                {isAudio ? (
                                                    <Mic className="w-3.5 h-3.5 text-[#ecb613] shrink-0" />
                                                ) : (
                                                    <Paperclip className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                                )}
                                                <a 
                                                    href={template.fileUrl} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className="truncate hover:underline text-xs"
                                                >
                                                    {template.fileName || 'Attached Material'}
                                                </a>
                                                {template.fileSize && (
                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                        ({formatFileSize(template.fileSize)})
                                                    </span>
                                                )}
                                            </div>

                                            {isAudio && (
                                                <audio controls src={template.fileUrl} className="w-full h-8 rounded-lg" />
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                                    <span className="text-[11px] text-slate-400 font-medium">
                                        Assigned {template.batches.length} times
                                    </span>

                                    <button
                                        type="button"
                                        onClick={() => onAssignFromTemplate(template)}
                                        className="min-h-[38px] px-4 py-2 bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900 font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
                                    >
                                        <Send className="w-3.5 h-3.5" />
                                        <span>Assign Task</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-12 text-center text-slate-500">
                    No task templates found.
                </div>
            )}
        </div>
    );
}
