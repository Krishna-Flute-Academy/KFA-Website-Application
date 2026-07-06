'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
    MessageSquare, Video, Loader2, Send, Share2, Users, 
    TrendingUp, Clock, Star, Trash2, UserPlus, Search, 
    Calendar, User, Zap, FileText
} from 'lucide-react';
import { supabaseAuth } from '../../lib/supabase-auth';

interface EnrolledStudent {
    id: string;
    student_id: string;
    name: string;
    profile_pic_url: string | null;
    joined_at: string;
    mock_score: number;
    mock_progress: number;
    mock_attendance: number;
    mock_milestone: string;
    mock_status: 'Consistent' | 'Improving' | 'At Risk';
    level?: string;
    is_makeup?: boolean;
}

interface OverviewTabProps {
    isMeetingView: boolean;
    handleSendClassMessage: (e: React.FormEvent) => void;
    messageSubject: string;
    setMessageSubject: (val: string) => void;
    messageContent: string;
    setMessageContent: React.Dispatch<React.SetStateAction<string>>;
    isSendingMessage: boolean;
    classBroadcasts: any[];
    setSelectedAnnouncement: (b: any) => void;
    students: EnrolledStudent[];
    avgAttendance: string;
    schedules: any[];
    getRealStudentProgress: (studentId: string, defaultMockVal: number) => number;
    openDirectoryModal: () => void;
    paginatedStudents: EnrolledStudent[];
    removingStudentId: string | null;
    handleRemoveStudent: (student: EnrolledStudent) => Promise<void>;
    currentPage: number;
    setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
    totalPages: number;
    PAGE_SIZE: number;
    setShowMessageModal: (val: boolean) => void;
    classroomId: string;
    classroom: any;
    DAY_NAMES: string[];
    formatTime12hr: (time: string) => string;
    formatLocalDate: (dateStr: string) => Date;
    announcementSearchQuery: string;
    setAnnouncementSearchQuery: (val: string) => void;
    filteredAnnouncements: any[];
}

export default function OverviewTab({
    isMeetingView,
    handleSendClassMessage,
    messageSubject,
    setMessageSubject,
    messageContent,
    setMessageContent,
    isSendingMessage,
    classBroadcasts,
    setSelectedAnnouncement,
    students,
    avgAttendance,
    schedules,
    getRealStudentProgress,
    openDirectoryModal,
    paginatedStudents,
    removingStudentId,
    handleRemoveStudent,
    currentPage,
    setCurrentPage,
    totalPages,
    PAGE_SIZE,
    setShowMessageModal,
    classroomId,
    classroom,
    DAY_NAMES,
    formatTime12hr,
    formatLocalDate,
    announcementSearchQuery,
    setAnnouncementSearchQuery,
    filteredAnnouncements
}: OverviewTabProps) {
    const getStatusColor = (status: string) => {
        if (status === 'Consistent') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
        if (status === 'Improving') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
        return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
    };

    const [composerTab, setComposerTab] = useState<'message' | 'note'>('message');
    const [recipientType, setRecipientType] = useState<'all' | string>('all');
    
    // Note Form States
    const [noteTitle, setNoteTitle] = useState('');
    const [noteContent, setNoteContent] = useState('');
    const [noteColor, setNoteColor] = useState('yellow');
    const [isSavingNote, setIsSavingNote] = useState(false);
    const [noteSuccess, setNoteSuccess] = useState(false);
    
    // Message Status States
    const [isSendingDirectMessage, setIsSendingDirectMessage] = useState(false);
    const [directMessageSuccess, setDirectMessageSuccess] = useState(false);

    const handleSendClassNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!noteTitle.trim()) return;
        setIsSavingNote(true);
        setNoteSuccess(false);
        try {
            const { data: { session } } = await supabaseAuth.auth.getSession();
            const teacherId = session?.user?.id;
            if (!teacherId) throw new Error('No instructor session found.');

            const { error } = await supabaseAuth
                .from('class_notes')
                .insert([{
                    classroom_id: classroomId,
                    teacher_id: teacherId,
                    title: noteTitle.trim(),
                    content: noteContent.trim() || null,
                    color: noteColor
                }]);

            if (error) throw error;

            setNoteTitle('');
            setNoteContent('');
            setNoteSuccess(true);
            setTimeout(() => setNoteSuccess(false), 3000);
        } catch (err) {
            console.error('Error creating class note during session:', err);
            alert('Failed to save class note. Please try again.');
        } finally {
            setIsSavingNote(false);
        }
    };

    const handleSendMessageFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (recipientType === 'all') {
            handleSendClassMessage(e);
            return;
        }

        if (!messageContent.trim()) return;
        setIsSendingDirectMessage(true);
        setDirectMessageSuccess(false);
        try {
            const { data: { session } } = await supabaseAuth.auth.getSession();
            const teacherId = session?.user?.id;
            if (!teacherId) throw new Error('No instructor session found.');

            const { error } = await supabaseAuth
                .from('messages')
                .insert([{
                    sender_id: teacherId,
                    receiver_id: recipientType,
                    message_text: messageContent.trim()
                }]);

            if (error) throw error;

            setMessageContent('');
            setDirectMessageSuccess(true);
            setTimeout(() => setDirectMessageSuccess(false), 3000);
        } catch (err) {
            console.error('Error sending direct message during session:', err);
            alert('Failed to send direct message. Please try again.');
        } finally {
            setIsSendingDirectMessage(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 text-left">
            {isMeetingView && (
                <div className="grid grid-cols-12 gap-6">
                    {/* Broadcast/Note Composer */}
                    <div className="col-span-12 lg:col-span-8">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 hover:shadow-md transition-shadow text-left">
                            {/* Tab Bar */}
                            <div className="flex border-b border-slate-100 dark:border-slate-800 pb-2 mb-4 gap-4">
                                <button
                                    type="button"
                                    onClick={() => setComposerTab('message')}
                                    className={`pb-1 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                                        composerTab === 'message'
                                            ? 'text-[#ecb613] border-[#ecb613]'
                                            : 'text-slate-400 border-transparent hover:text-slate-600'
                                    }`}
                                >
                                    <MessageSquare size={14} /> Send Message
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setComposerTab('note')}
                                    className={`pb-1 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                                        composerTab === 'note'
                                            ? 'text-[#ecb613] border-[#ecb613]'
                                            : 'text-slate-400 border-transparent hover:text-slate-600'
                                    }`}
                                >
                                    <FileText size={14} /> Add Class Note
                                </button>
                            </div>

                            {composerTab === 'message' ? (
                                <form onSubmit={handleSendMessageFormSubmit} className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-extrabold text-slate-900 dark:text-white text-md flex items-center gap-2">
                                            <MessageSquare className="text-[#ecb613] size-4" />
                                            Send Message to Class
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const meetLink = "Join Google Meet: https://meet.google.com/abc-defg-hij";
                                                setMessageContent(prev => prev ? `${prev}\n\n${meetLink}` : meetLink);
                                            }}
                                            className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 hover:scale-[1.02] border border-blue-200/50 dark:border-blue-900/30 cursor-pointer"
                                        >
                                            <Video size={12} /> 🔗 Share Meet Link
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Recipient Dropdown */}
                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide">Recipient</label>
                                            <select
                                                value={recipientType}
                                                onChange={(e) => setRecipientType(e.target.value)}
                                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#ecb613] outline-none text-slate-800 dark:text-slate-100 cursor-pointer"
                                            >
                                                <option value="all">All Enrolled Students (Broadcast)</option>
                                                {students.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name} (Direct Message)</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Subject (only for broadcast/all) */}
                                        {recipientType === 'all' && (
                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-black text-slate-505 uppercase tracking-wide">Subject</label>
                                                <input
                                                    type="text"
                                                    value={messageSubject}
                                                    onChange={(e) => setMessageSubject(e.target.value)}
                                                    placeholder="e.g. Google Meet URL - Session started"
                                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#ecb613] outline-none placeholder:text-slate-400 text-slate-800 dark:text-slate-100"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-1">
                                        <label className="block text-[10px] font-black text-slate-505 uppercase tracking-wide">Message text</label>
                                        <textarea
                                            rows={3}
                                            value={messageContent}
                                            onChange={(e) => setMessageContent(e.target.value)}
                                            placeholder={recipientType === 'all' ? "Type announcement message..." : "Type direct message to student..."}
                                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-[#ecb613] outline-none text-slate-808 dark:text-slate-100 font-semibold"
                                        />
                                    </div>

                                    {directMessageSuccess && (
                                        <p className="text-xs text-emerald-500 font-bold">✓ Direct message sent successfully!</p>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={isSendingMessage || isSendingDirectMessage || !messageContent.trim()}
                                        className="w-full py-3 bg-[#ecb613] hover:bg-amber-600 text-slate-900 font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md disabled:opacity-50 cursor-pointer"
                                    >
                                        {(isSendingMessage || isSendingDirectMessage) ? (
                                            <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4" /> 
                                                {recipientType === 'all' ? 'Broadcast Message to Class' : 'Send Message to Student'}
                                            </>
                                        )}
                                    </button>
                                </form>
                            ) : (
                                <form onSubmit={handleSendClassNote} className="space-y-4">
                                    <h3 className="font-extrabold text-slate-900 dark:text-white text-md flex items-center gap-2">
                                        <FileText className="text-[#ecb613] size-4" />
                                        Create Live Class Note
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Title */}
                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-black text-slate-555 uppercase tracking-wide">Note Title</label>
                                            <input
                                                type="text"
                                                value={noteTitle}
                                                onChange={(e) => setNoteTitle(e.target.value)}
                                                placeholder="e.g. Today's Raga Practice Notes"
                                                required
                                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#ecb613] outline-none text-slate-800 dark:text-slate-100"
                                            />
                                        </div>

                                        {/* Color Picker */}
                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-black text-slate-555 uppercase tracking-wide">Note Sticky Color</label>
                                            <div className="flex gap-2.5 py-1">
                                                {['yellow', 'green', 'blue', 'pink'].map(c => {
                                                    const colorMap: Record<string, string> = {
                                                        yellow: 'bg-yellow-100 border-yellow-300 dark:bg-yellow-950/40 dark:border-yellow-900',
                                                        green: 'bg-emerald-100 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-900',
                                                        blue: 'bg-blue-100 border-blue-300 dark:bg-blue-950/40 dark:border-blue-900',
                                                        pink: 'bg-rose-100 border-rose-300 dark:bg-rose-950/40 dark:border-rose-900'
                                                    };
                                                    const active = noteColor === c;
                                                    return (
                                                        <button
                                                            key={c}
                                                            type="button"
                                                            onClick={() => setNoteColor(c)}
                                                            className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${colorMap[c]} ${
                                                                active ? 'scale-110 ring-2 ring-[#ecb613]' : 'opacity-60'
                                                            }`}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="block text-[10px] font-black text-slate-555 uppercase tracking-wide">Note Details / Content</label>
                                        <textarea
                                            rows={3}
                                            value={noteContent}
                                            onChange={(e) => setNoteContent(e.target.value)}
                                            placeholder="Write note contents or practice guides..."
                                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-[#ecb613] outline-none text-slate-808 dark:text-slate-100 font-semibold"
                                        />
                                    </div>

                                    {noteSuccess && (
                                        <p className="text-xs text-emerald-500 font-bold">✓ Class note added successfully! Students will see this live.</p>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={isSavingNote || !noteTitle.trim()}
                                        className="w-full py-3 bg-[#ecb613] hover:bg-amber-600 text-slate-900 font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md disabled:opacity-50 cursor-pointer"
                                    >
                                        {isSavingNote ? (
                                            <><Loader2 className="w-4 h-4 animate-spin" /> Saving Note...</>
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4" /> Save and Add Class Note
                                            </>
                                        )}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>

                    {/* Broadcast History */}
                    <div className="col-span-12 lg:col-span-4">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 hover:shadow-md transition-shadow h-full flex flex-col min-h-[385px] max-h-[385px] overflow-hidden text-left">
                            <h4 className="font-extrabold text-slate-900 dark:text-white text-md mb-4 flex items-center gap-2 flex-shrink-0">
                                <Share2 size={16} className="text-amber-500" />
                                Recently Sent
                            </h4>
                            <div className="space-y-3.5 overflow-y-auto pr-1 flex-1">
                                {classBroadcasts.map((b, i) => (
                                    <div 
                                        key={b.id || i} 
                                        onClick={() => setSelectedAnnouncement(b)}
                                        className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-100 dark:border-slate-800 text-xs hover:border-[#ecb613] transition-colors relative cursor-pointer text-left group"
                                    >
                                        <div className="flex justify-between items-center gap-2 mb-1.5 text-left">
                                            <span className="font-bold text-slate-900 dark:text-white truncate group-hover:text-[#ecb613] transition-colors">{b.subject}</span>
                                            <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                                                {new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium line-clamp-3 whitespace-pre-wrap text-left">{b.content}</p>
                                    </div>
                                ))}
                                {classBroadcasts.length === 0 && (
                                    <p className="text-xs text-slate-455 dark:text-slate-500 text-center py-8 italic font-semibold">
                                        No broadcasts sent to this class yet.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {!isMeetingView && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                    {/* Stat 1: Active Enrollment */}
                    <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-violet-500/5 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500"></div>
                        <div className="space-y-1.5 text-left relative z-10">
                            <span className="text-2xl font-black text-slate-900 dark:text-white">{students.length}</span>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Enrolled Students</p>
                            <p className="text-[10px] text-slate-400 font-semibold">Active members of this class</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-500 shrink-0 relative z-10">
                            <Users className="w-6 h-6" />
                        </div>
                    </div>

                    {/* Stat 2: Consistency Index */}
                    <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500"></div>
                        <div className="space-y-1.5 text-left relative z-10">
                            <span className="text-2xl font-black text-slate-900 dark:text-white">{avgAttendance}%</span>
                            <p className="text-xs font-bold text-slate-505 dark:text-slate-400">Average Attendance</p>
                            <p className="text-[10px] text-slate-400 font-semibold">Consistent engagement rate</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0 relative z-10">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                    </div>

                    {/* Stat 3: Weekly Sessions */}
                    <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500"></div>
                        <div className="space-y-1.5 text-left relative z-10">
                            <span className="text-2xl font-black text-slate-900 dark:text-white">{schedules.length} Session(s)</span>
                            <p className="text-xs font-bold text-slate-505 dark:text-slate-400">Weekly Sessions</p>
                            <p className="text-[10px] text-slate-400 font-semibold">Scheduled lesson slots</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0 relative z-10">
                            <Clock className="w-6 h-6" />
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-12 gap-6">
                {/* Left Column: Progress & Student Roster */}
                <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
                    {/* Progress Summary Card */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Individual Progress Summary</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-405 mt-1">Milestone tracking for the current week</p>
                            </div>
                        </div>
                        <div className="space-y-6">
                            {students.slice(0, 4).map(student => (
                                <div key={student.id} className="flex items-center gap-4 group">
                                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0">
                                        {student.profile_pic_url ? (
                                            <img alt={student.name} className="w-full h-full object-cover" src={student.profile_pic_url} loading="lazy" />
                                        ) : (
                                            <span className="text-xs font-bold text-slate-505 dark:text-slate-400">{student.name.charAt(0)}</span>
                                        )}
                                    </div>
                                    {(() => {
                                        const realProgress = getRealStudentProgress(student.student_id, student.mock_progress);
                                        return (
                                            <>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between mb-1.5 gap-2 items-center">
                                                        <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#ecb613] transition-colors truncate">{student.name}</span>
                                                        <span className="text-[10px] font-black tracking-wider uppercase text-amber-600 dark:text-[#ecb613] bg-amber-500/10 dark:bg-[#ecb613]/10 px-2 py-0.5 rounded-lg font-mono shrink-0">
                                                            {student.level}
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                                        <div className={`h-full transition-all duration-500 ${
                                                            realProgress >= 80 
                                                                ? 'bg-emerald-500' 
                                                                : (realProgress >= 40 ? 'bg-[#ecb613]' : 'bg-rose-500')
                                                        }`} style={{ width: `${realProgress}%` }}></div>
                                                    </div>
                                                </div>
                                                <span className="text-xs font-bold text-slate-400 w-8 text-right shrink-0">{realProgress}%</span>
                                            </>
                                        );
                                    })()}
                                </div>
                            ))}
                            {students.length === 0 && (
                                <div className="py-8 text-center bg-slate-50 dark:bg-slate-805/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                    <p className="text-slate-500 text-sm font-medium">No students enrolled yet.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Student Roster Table */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center flex-wrap gap-4">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Student Roster</h3>
                            <div className="flex gap-3">
                                <button 
                                    onClick={openDirectoryModal}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-[#ecb613] shadow-md shadow-[#ecb613]/20 hover:bg-[#ecb613]/90 text-slate-900 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                                >
                                    <UserPlus className="w-3.5 h-3.5" />
                                    Add from Directory
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-455 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                    <tr>
                                        <th className="px-6 py-4">Student Name</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Avg. Score</th>
                                        <th className="px-6 py-4">Attendance</th>
                                        <th className="px-6 py-4">Joined Date</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {paginatedStudents.map(student => (
                                        <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-600 shrink-0">
                                                        {student.profile_pic_url ? (
                                                            <img alt={student.name} className="w-full h-full object-cover" src={student.profile_pic_url} loading="lazy" />
                                                        ) : (
                                                            <span className="text-xs font-bold text-slate-505 dark:text-slate-400">{student.name.charAt(0)}</span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <Link href={`/teacher-dashboard/students/${student.student_id}`} className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#ecb613] transition-colors">{student.name}</Link>
                                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">ID: {student.student_id.substring(0, 8)}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wide inline-block border ${getStatusColor(student.mock_status)} border-transparent dark:border-current/20`}>
                                                    {student.mock_status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-sm font-bold text-slate-900 dark:text-white">{student.mock_score.toFixed(1)}</span>
                                                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-600 dark:text-slate-300">
                                                {student.mock_attendance}%
                                            </td>
                                            <td className="px-6 py-4 text-xs font-semibold text-slate-505 dark:text-slate-400">
                                                {new Date(student.joined_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleRemoveStudent(student)}
                                                    disabled={removingStudentId === student.id}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg transition-all disabled:opacity-50 cursor-pointer"
                                                    title="Remove from this classroom"
                                                >
                                                    {removingStudentId === student.id
                                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        : <Trash2 className="w-3.5 h-3.5" />}
                                                    Remove
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {paginatedStudents.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center bg-slate-50 dark:bg-slate-800/30">
                                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-3">No students enrolled yet.</p>
                                                <button
                                                    onClick={openDirectoryModal}
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#ecb613] text-slate-900 rounded-xl text-xs font-bold hover:bg-[#ecb613]/90 transition-colors shadow-sm cursor-pointer"
                                                >
                                                    <UserPlus className="w-4 h-4" /> Add from Directory
                                                </button>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-205 dark:border-slate-800 flex justify-between items-center rounded-b-2xl">
                            <span className="text-[10px] font-black text-slate-455 dark:text-slate-400 uppercase tracking-widest">
                                Showing {paginatedStudents.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0} - {Math.min(currentPage * PAGE_SIZE, students.length)} of {students.length} students
                            </span>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer animate-in fade-in"
                                >
                                    Previous
                                </button>
                                <button 
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    className="px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer animate-in fade-in"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Quick Actions, Schedules, and Announcements */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                    {!isMeetingView && (
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Quick Actions</h4>
                                <Zap className="w-5 h-5 text-amber-500 fill-amber-500 animate-pulse" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => setShowMessageModal(true)}
                                    className="p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-[#ecb613]/10 rounded-xl text-center transition-all group border border-slate-205 dark:border-slate-700 hover:border-[#ecb613]/30 flex flex-col items-center justify-center cursor-pointer"
                                >
                                    <MessageSquare className="w-6 h-6 text-[#ecb613] mb-2 group-hover:scale-110 transition-transform" />
                                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white uppercase tracking-wide">Message All</span>
                                </button>
                                <Link 
                                    href={`/teacher-dashboard/classrooms/${classroomId}/meeting`}
                                    className="p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-[#ecb613]/10 rounded-xl text-center transition-all group border border-slate-205 dark:border-slate-700 hover:border-[#ecb613]/30 flex flex-col items-center justify-center"
                                >
                                    <Video className="w-6 h-6 text-[#ecb613] mb-2 group-hover:scale-110 transition-transform" />
                                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white uppercase tracking-wide">Start Session</span>
                                </Link>
                            </div>
                        </div>
                    )}

                    {classroom?.teacher_name && (
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Class Instructor</h4>
                                <User className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div className="flex items-center gap-3 bg-emerald-50/50 dark:bg-emerald-950/10 p-3 rounded-xl border border-emerald-200/50 dark:border-emerald-900/30">
                                <div className="w-8 h-8 rounded-full bg-[#ecb613]/15 flex items-center justify-center font-bold text-[#ecb613] text-xs shrink-0 select-none">
                                    {classroom.teacher_name.charAt(0)}
                                </div>
                                <div className="flex flex-col text-left">
                                    <span className="text-xs font-bold text-slate-905 dark:text-white">
                                        {classroom.teacher_name}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                                        Primary Teacher
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Class Schedule</h4>
                            <Clock className="w-5 h-5 text-[#ecb613]" />
                        </div>
                        <div className="space-y-3">
                            {classroom?.type === 'temporary' ? (
                                classroom.class_date ? (
                                    <div className="flex justify-between items-center bg-amber-50/50 dark:bg-amber-955/10 p-3 rounded-xl border border-amber-200/50 dark:border-amber-900/30">
                                        <div className="flex flex-col text-left">
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                {formatLocalDate(classroom.class_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                            {classroom.start_time && (
                                                <span className="text-[10px] text-slate-455 dark:text-slate-400 font-medium mt-0.5">
                                                    {formatTime12hr(classroom.start_time.slice(0,5))} – {formatTime12hr(classroom.end_time?.slice(0,5) || '')}
                                                </span>
                                            )}
                                        </div>
                                        <Calendar className="w-4 h-4 text-amber-550 shrink-0" />
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-455 italic">No schedule set</p>
                                )
                            ) : schedules.length === 0 ? (
                                <p className="text-xs text-slate-455 italic">No schedule set</p>
                            ) : (
                                schedules.slice(0, 3).map(slot => (
                                    <div key={slot.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{DAY_NAMES[slot.day_of_week]}</span>
                                        <span className="text-xs font-medium text-[#ecb613]">{formatTime12hr(slot.start_time)} - {formatTime12hr(slot.end_time)}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {!isMeetingView && (
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-4">
                            <div className="flex flex-col gap-3">
                                <div className="text-left">
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Class Announcements</h3>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-405 font-semibold mt-0.5">Recent highlights broadcasted to this class</p>
                                </div>
                                <div className="relative w-full">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                                    <input 
                                        className="pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-xl text-xs w-full focus:ring-2 focus:ring-[#ecb613] outline-none transition-all placeholder:text-slate-400 font-semibold text-slate-800 dark:text-slate-100" 
                                        placeholder="Search announcements..." 
                                        type="text" 
                                        value={announcementSearchQuery}
                                        onChange={(e) => setAnnouncementSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                            
                            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                                {filteredAnnouncements.map((bc, idx) => (
                                    <div 
                                        key={bc.id || idx} 
                                        onClick={() => setSelectedAnnouncement(bc)}
                                        className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-100 dark:border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-[#ecb613] transition-colors relative cursor-pointer text-left group"
                                    >
                                        <div className="flex-1 min-w-0 text-left">
                                            <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate block group-hover:text-[#ecb613] transition-colors">{bc.subject}</span>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium line-clamp-1 mt-0.5">{bc.content}</p>
                                        </div>
                                        <span className="text-[9px] text-slate-455 dark:text-slate-500 font-semibold shrink-0">
                                            {new Date(bc.created_at).toLocaleDateString('en-IN', {
                                                month: 'short',
                                                day: 'numeric'
                                            })}
                                        </span>
                                    </div>
                                ))}
                                {filteredAnnouncements.length === 0 && (
                                    <div className="py-6 text-center bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                        <p className="text-slate-455 text-xs font-semibold">
                                            {announcementSearchQuery ? 'No announcements match your search.' : 'No announcements sent yet.'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
