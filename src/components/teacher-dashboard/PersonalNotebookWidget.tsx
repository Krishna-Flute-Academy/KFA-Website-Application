'use client';

import React from 'react';
import { StickyNote, Plus, Loader2, Lightbulb, Edit, Trash2 } from 'lucide-react';

interface PersonalNote {
    id: string;
    title: string;
    content: string;
    color: string;
    classroom_id: string;
    classroom_name?: string;
    created_at: string;
}

interface PersonalNotebookWidgetProps {
    notes: PersonalNote[];
    classrooms: any[];
    notesLoading: boolean;
    setNoteForm: (form: any) => void;
    setShowNoteModal: (show: boolean) => void;
    handleDeleteNote: (id: string) => Promise<void>;
}

/**
 * PersonalNotebookWidget displays sticky notes for curriculum outlines, concert plans, or ideation.
 */
export default function PersonalNotebookWidget({
    notes,
    classrooms,
    notesLoading,
    setNoteForm,
    setShowNoteModal,
    handleDeleteNote
}: PersonalNotebookWidgetProps) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-auto max-h-[380px] md:h-[480px] text-left">
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-50/50 to-orange-50/10 dark:from-amber-950/10 dark:to-orange-950/5">
                <div className="flex items-center gap-2">
                    <StickyNote className="w-4 h-4 sm:w-5 sm:h-5 text-[#ecb613]" />
                    <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">Personal Notebook</h3>
                </div>
                <button 
                    onClick={() => {
                        setNoteForm({ id: '', title: '', content: '', color: 'yellow', classroom_id: classrooms[0]?.id || '' });
                        setShowNoteModal(true);
                    }}
                    className="px-2.5 py-1.5 flex items-center gap-1 bg-[#ecb613]/10 hover:bg-[#ecb613]/20 text-[#ecb613] rounded-lg transition-colors text-[10px] sm:text-xs font-bold"
                >
                    <Plus size={12} /> Add
                </button>
            </div>
            
            <div className="p-3 sm:p-6 flex-1 overflow-y-auto space-y-4 custom-scrollbar bg-slate-50/30 dark:bg-slate-900/10">
                {notesLoading ? (
                    <div className="flex flex-col items-center justify-center py-10 md:h-full space-y-2">
                        <Loader2 className="w-6 h-6 animate-spin text-[#ecb613]" />
                        <p className="text-xs text-slate-400">Loading your ideas...</p>
                    </div>
                ) : notes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 md:h-full text-center p-4">
                        <Lightbulb className="w-8 h-8 text-slate-350 mb-2 animate-bounce" />
                        <p className="text-sm font-semibold text-slate-500">Your notebook is empty</p>
                        <p className="text-xs text-slate-400 max-w-[240px] mt-1 leading-relaxed">
                            Jot down class structures, concert plans, or teaching ideas.
                        </p>
                    </div>
                ) : (
                    notes.map(note => {
                        let colorClasses = 'bg-amber-50 dark:bg-amber-955/20 border-amber-200 dark:border-amber-900/30 text-amber-955 dark:text-amber-200';
                        if (note.color === 'blue') colorClasses = 'bg-blue-50 dark:bg-blue-955/20 border-blue-200 dark:border-blue-900/30 text-blue-955 dark:text-blue-200';
                        if (note.color === 'green') colorClasses = 'bg-emerald-50 dark:bg-emerald-955/20 border-emerald-200 dark:border-emerald-900/30 text-emerald-955 dark:text-emerald-200';
                        if (note.color === 'pink') colorClasses = 'bg-rose-50 dark:bg-rose-955/20 border-rose-200 dark:border-rose-900/30 text-rose-955 dark:text-rose-200';
                        
                        return (
                            <div key={note.id} className={`p-4 rounded-xl border shadow-xs transition-all hover:shadow-sm ${colorClasses}`}>
                                <div className="flex justify-between items-start">
                                    <h4 className="font-bold text-sm leading-tight">{note.title}</h4>
                                    <div className="flex items-center gap-1.5 ml-2">
                                        <button 
                                            onClick={() => {
                                                setNoteForm({
                                                    id: note.id,
                                                    title: note.title,
                                                    content: note.content,
                                                    color: note.color,
                                                    classroom_id: note.classroom_id
                                                });
                                                setShowNoteModal(true);
                                            }} 
                                            className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors text-slate-600 dark:text-slate-400"
                                            title="Edit Note"
                                        >
                                            <Edit size={12} />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteNote(note.id)} 
                                            className="p-1 hover:bg-red-500/10 hover:text-red-500 rounded transition-colors text-slate-600 dark:text-slate-400"
                                            title="Delete Note"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs mt-2 whitespace-pre-line leading-relaxed opacity-90">{note.content}</p>
                                <div className="flex items-center justify-between border-t border-black/5 dark:border-white/5 mt-3 pt-2 text-[9px] font-semibold uppercase tracking-wider opacity-75">
                                    <span>Class: {note.classroom_name}</span>
                                    <span>{new Date(note.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
