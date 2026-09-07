'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
    Sparkles, Target, Lightbulb, Loader2, Calendar, User
} from 'lucide-react';
import { supabaseAuth } from '../../lib/supabase-auth';

interface MentorHubTabProps {
    profile: any;
}

export default function MentorHubTab({ profile }: MentorHubTabProps) {
    const [mentorNotes, setMentorNotes] = useState<any[]>([]);
    const [loadingNotes, setLoadingNotes] = useState(true);
    const [noteTypeFilter, setNoteTypeFilter] = useState<'all' | 'focus' | 'practice' | 'improvement' | 'strength' | 'general'>('all');

    // Fetch Guidance Notes
    useEffect(() => {
        const fetchGuidanceNotes = async () => {
            if (!profile?.id) return;
            setLoadingNotes(true);
            try {
                // Try fetching with mentor_id join first, fallback to basic query if needed
                const { data, error } = await supabaseAuth
                    .from('mentor_notes')
                    .select(`
                        id,
                        student_id,
                        classroom_id,
                        mentor_id,
                        title,
                        note,
                        note_type,
                        is_active,
                        created_at,
                        users:mentor_id (name, role)
                    `)
                    .eq('student_id', profile.id)
                    .order('created_at', { ascending: false });

                if (error) {
                    // Fallback to query without join
                    const { data: rawNotes, error: rawErr } = await supabaseAuth
                        .from('mentor_notes')
                        .select('*')
                        .eq('student_id', profile.id)
                        .order('created_at', { ascending: false });
                    
                    if (rawErr) throw rawErr;
                    setMentorNotes(rawNotes || []);
                } else {
                    setMentorNotes(data || []);
                }
            } catch (err) {
                console.warn('Error fetching mentor notes in MentorHubTab:', err);
            } finally {
                setLoadingNotes(false);
            }
        };

        fetchGuidanceNotes();
    }, [profile?.id]);

    // Active note
    const activeNote = useMemo(() => {
        return mentorNotes.find(n => n.is_active);
    }, [mentorNotes]);

    // Filtered guidance notes
    const filteredNotes = useMemo(() => {
        if (noteTypeFilter === 'all') return mentorNotes;
        return mentorNotes.filter(n => n.note_type === noteTypeFilter);
    }, [mentorNotes, noteTypeFilter]);

    return (
        <div className="space-y-6 animate-in fade-in duration-300 text-left">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-amber-900 via-[#7C5E3F] to-amber-800 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden text-left">
                <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-200 text-xs font-bold mb-2 border border-amber-400/30 font-mono">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Teacher & Academy Guidance</span>
                    </div>
                    <h2 className="text-2xl font-black tracking-tight">Mentor Hub</h2>
                    <p className="text-amber-100/80 text-xs mt-1 max-w-xl font-medium">
                        Guidance from your teachers and academy mentors to help you improve your learning and practice.
                    </p>
                </div>
            </div>

            {/* Current Active Guidance Banner */}
            {activeNote && (
                <div className="bg-gradient-to-br from-amber-500/15 via-[#FAF5EE] to-orange-500/10 dark:from-amber-950/40 dark:via-slate-900 dark:to-orange-950/20 border-2 border-amber-400 dark:border-amber-600/70 rounded-3xl p-6 shadow-md relative text-left">
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono shadow-2xs">
                                ● CURRENT GUIDANCE
                            </span>
                            <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-mono">
                                {activeNote.note_type}
                            </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">
                            {new Date(activeNote.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                    </div>

                    <h3 className="text-lg font-black text-slate-900 dark:text-white leading-snug">
                        {activeNote.title || 'Focus This Week'}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 mt-2 leading-relaxed whitespace-pre-wrap font-medium">
                        {activeNote.note}
                    </p>

                    <div className="mt-4 pt-3 border-t border-amber-300/40 dark:border-amber-900/40 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-amber-600" />
                            <span>Mentor: <strong className="text-slate-900 dark:text-white">{activeNote.users?.name || 'Krishna Sir'}</strong></span>
                        </span>
                        <span className="text-amber-700 dark:text-amber-400 font-bold">
                            Active on Dashboard
                        </span>
                    </div>
                </div>
            )}

            {/* History & Filter Section */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                            <Target className="w-5 h-5 text-amber-600" />
                            <span>Guidance History</span>
                        </h3>
                        <p className="text-xs text-slate-400">All tips, focus points, and practice suggestions given by your instructors.</p>
                    </div>

                    {/* Note Type Filters */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                        {[
                            { id: 'all', label: 'All Notes' },
                            { id: 'focus', label: 'Focus' },
                            { id: 'practice', label: 'Practice' },
                            { id: 'improvement', label: 'Improvement' },
                            { id: 'strength', label: 'Strength' },
                            { id: 'general', label: 'General' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setNoteTypeFilter(tab.id as any)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                    noteTypeFilter === tab.id
                                        ? 'bg-[#7C5E3F] text-white shadow-xs'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {loadingNotes ? (
                    <div className="py-12 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-amber-600 mx-auto mb-2" />
                        <p className="text-xs text-slate-400 font-medium">Loading mentor notes...</p>
                    </div>
                ) : filteredNotes.length === 0 ? (
                    <div className="py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center bg-slate-50/50 dark:bg-slate-850/40">
                        <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-600 flex items-center justify-center mx-auto mb-3">
                            <Lightbulb className="w-6 h-6" />
                        </div>
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">No guidance notes found</h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                            {noteTypeFilter === 'all'
                                ? 'When your teachers provide practice tips, posture feedback, or focus points, they will appear here.'
                                : `No notes tagged with "${noteTypeFilter}".`
                            }
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3 pt-1">
                        {filteredNotes.map(note => (
                            <div 
                                key={note.id}
                                className={`p-4 rounded-2xl border transition-all ${
                                    note.is_active 
                                        ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300/80 dark:border-amber-800 shadow-xs' 
                                        : 'bg-[#FDFBF7] dark:bg-slate-850/60 border-slate-200/80 dark:border-slate-800 hover:border-amber-400/40'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded font-mono ${
                                            note.note_type === 'focus' ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300' :
                                            note.note_type === 'practice' ? 'bg-blue-100 text-blue-900 dark:bg-blue-950/40 dark:text-blue-300' :
                                            note.note_type === 'strength' ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300' :
                                            note.note_type === 'improvement' ? 'bg-rose-100 text-rose-900 dark:bg-rose-950/40 dark:text-rose-300' :
                                            'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                                        }`}>
                                            {note.note_type}
                                        </span>
                                        {note.is_active && (
                                            <span className="text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono">
                                                Active
                                            </span>
                                        )}
                                        <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                                            {note.title || 'Teacher Guidance'}
                                        </span>
                                    </div>
                                    <span className="text-[11px] text-slate-400 font-medium">
                                        {new Date(note.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                </div>

                                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-medium">
                                    {note.note}
                                </p>

                                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                                    <span className="flex items-center gap-1.5">
                                        <User className="w-3 h-3 text-slate-400" />
                                        <span>From: <strong className="text-slate-700 dark:text-slate-300">{note.users?.name || 'Krishna Sir'}</strong></span>
                                    </span>
                                    <span className="font-mono text-[10px]">
                                        KFA Mentor System
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
