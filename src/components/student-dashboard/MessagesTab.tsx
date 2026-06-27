'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Mail, Loader2, Volume2, Search, MessageSquare, Send, Users, User, ChevronRight, FileAudio, Megaphone, CreditCard, Sparkles } from 'lucide-react';

interface Broadcast {
    id: string;
    channel: string;
    subject: string;
    content: string;
    audio_attachment?: string | null;
    created_at: string;
    sender?: {
        name: string;
        role: string;
    } | null;
}

interface Classmate {
    id: string;
    name: string;
    level: string;
    profile_pic_url: string | null;
}

interface ClassroomInfo {
    id: string;
    name: string;
    teacher_id?: string;
    teacher_name?: string;
    teacher_email?: string;
}

interface StudentProfile {
    id: string;
    name: string;
}

interface MessagesTabProps {
    broadcasts: Broadcast[];
    playVoiceNote: (id: string, audioAttachment: string) => void;
    playingAudioId: string | null;
    classroom: ClassroomInfo | null;
    classmates: Classmate[];
    directMessages: any[];
    onSendDirectMessage: (receiverId: string, text: string) => Promise<void>;
    profile: StudentProfile | null;
    admins?: any[];
}

export default function MessagesTab({
    broadcasts,
    playVoiceNote,
    playingAudioId,
    classroom,
    classmates,
    directMessages,
    onSendDirectMessage,
    profile,
    admins = []
}: MessagesTabProps) {
    // Selection state: can be a category id or a contact object
    const [selectedFeed, setSelectedFeed] = useState<{ type: 'category' | 'chat'; id: string; name: string }>(
        { type: 'category', id: 'classroom', name: 'Class Announcements' }
    );
    
    const [leftSearch, setLeftSearch] = useState('');
    const [rightSearch, setRightSearch] = useState('');
    const [chatInput, setChatInput] = useState('');
    const [sendingMsg, setSendingMsg] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom of chat when thread changes or a message is sent
    useEffect(() => {
        if (selectedFeed.type === 'chat') {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [directMessages, selectedFeed]);

    // Categories list based on Admin Dashboard channels
    const categories = [
        { id: 'announcements', name: 'Announcements', icon: Megaphone, desc: 'Global broadcasts from the academy' },
        { id: 'classroom', name: 'Class Announcements', icon: MessageSquare, desc: 'Batch notices from your teacher' },
        { id: 'custom_groups', name: 'Group Announcements', icon: Users, desc: 'Notices for your specific groups' },
        { id: 'new_joiners', name: 'New Joiners Notices', icon: Sparkles, desc: 'Onboarding and welcome guides' },
        { id: 'fee_management', name: 'Fee & Payments', icon: CreditCard, desc: 'Fee reminders and payment receipts' },
        { id: 'voice', name: 'Voice Notes & Tones', icon: FileAudio, desc: 'Voice instructions and flute backing tracks' }
    ];

    // Filter contacts based on left sidebar search
    const filteredClassmates = useMemo(() => {
        return classmates.filter(mate => 
            mate.name.toLowerCase().includes(leftSearch.toLowerCase())
        );
    }, [classmates, leftSearch]);

    const teacherName = classroom?.teacher_name || 'Academy Instructor';
    const showTeacherInSearch = leftSearch === '' || teacherName.toLowerCase().includes(leftSearch.toLowerCase());

    // Filter broadcasts based on right panel search and selected category
    const filteredBroadcasts = useMemo(() => {
        return broadcasts.filter(b => {
            // Category check
            if (selectedFeed.id === 'announcements') {
                if (b.channel !== 'announcements' && !(!b.channel && b.sender?.role === 'admin')) return false;
            } else if (selectedFeed.id === 'classroom') {
                if (b.channel !== 'classroom' && !(!b.channel && b.sender?.role !== 'admin')) return false;
            } else if (selectedFeed.id === 'custom_groups') {
                if (b.channel !== 'custom_groups') return false;
            } else if (selectedFeed.id === 'new_joiners') {
                if (b.channel !== 'new_joiners') return false;
            } else if (selectedFeed.id === 'fee_management') {
                if (b.channel !== 'fee_management') return false;
            } else if (selectedFeed.id === 'voice') {
                if (!b.audio_attachment) return false;
            }

            // Search query check
            const matchesSearch = 
                b.subject.toLowerCase().includes(rightSearch.toLowerCase()) || 
                b.content.toLowerCase().includes(rightSearch.toLowerCase()) ||
                (b.channel || '').toLowerCase().includes(rightSearch.toLowerCase());
            
            return matchesSearch;
        });
    }, [broadcasts, selectedFeed, rightSearch]);

    // Active direct messages for the selected chat partner
    const activeChatThread = useMemo(() => {
        if (selectedFeed.type !== 'chat' || !profile?.id) return [];
        return directMessages.filter(m => 
            (m.sender_id === profile.id && m.receiver_id === selectedFeed.id) ||
            (m.sender_id === selectedFeed.id && m.receiver_id === profile.id)
        );
    }, [directMessages, selectedFeed, profile]);

    // Filtered chat messages based on right panel search
    const filteredChatThread = useMemo(() => {
        if (rightSearch.trim() === '') return activeChatThread;
        return activeChatThread.filter(m => 
            m.message_text.toLowerCase().includes(rightSearch.toLowerCase())
        );
    }, [activeChatThread, rightSearch]);

    // Send message handler
    const handleSendMsg = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || selectedFeed.type !== 'chat') return;
        
        setSendingMsg(true);
        try {
            await onSendDirectMessage(selectedFeed.id, chatInput.trim());
            setChatInput('');
        } catch (e) {
            console.error(e);
        } finally {
            setSendingMsg(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
            {/* Left Sidebar Pane: Categories & Contacts */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col max-h-[650px] text-left">
                <h3 className="font-extrabold text-slate-808 dark:text-white text-base mb-1">Message Center</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Select announcement board or a chat contact</p>

                {/* Left Search */}
                <div className="relative mb-5 flex-shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text"
                        placeholder="Search categories or contacts..."
                        value={leftSearch}
                        onChange={(e) => setLeftSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-55 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 transition-all"
                    />
                </div>

                {/* Categories & Contacts List Scroll Area */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar text-left">
                    {/* Categories Group */}
                    <div>
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-505 uppercase tracking-widest block mb-2 font-mono">Announcements</span>
                        <div className="space-y-1">
                            {categories.map((cat) => {
                                const Icon = cat.icon;
                                const active = selectedFeed.type === 'category' && selectedFeed.id === cat.id;
                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => {
                                            setSelectedFeed({ type: 'category', id: cat.id, name: cat.name });
                                            setRightSearch('');
                                        }}
                                        className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all text-left cursor-pointer ${
                                            active
                                                ? 'border-[#7C5E3F] bg-[#FAF5EE] text-[#7C5E3F] dark:border-amber-400 dark:bg-slate-800 dark:text-amber-400 shadow-2xs'
                                                : 'border-slate-100/50 hover:border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-850/50 text-slate-700 dark:text-slate-300'
                                        }`}
                                    >
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                                            active 
                                                ? 'bg-[#7C5E3F]/10 border-[#7C5E3F]/20 dark:bg-amber-400/10 dark:border-amber-400/20' 
                                                : 'bg-slate-50 dark:bg-slate-800 border-slate-150 dark:border-slate-700'
                                        }`}>
                                            <Icon className="w-4.5 h-4.5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h4 className="font-extrabold text-xs leading-none">{cat.name}</h4>
                                            <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 truncate">{cat.desc}</p>
                                        </div>
                                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Chat Contacts Group */}
                    <div>
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-505 uppercase tracking-widest block mb-2 font-mono">Direct Messages</span>
                        <div className="space-y-1">
                            {/* Teacher Contact */}
                            {classroom?.teacher_id && showTeacherInSearch && (
                                <button
                                    onClick={() => {
                                        setSelectedFeed({ type: 'chat', id: classroom.teacher_id!, name: teacherName });
                                        setRightSearch('');
                                    }}
                                    className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left cursor-pointer ${
                                        selectedFeed.type === 'chat' && selectedFeed.id === classroom.teacher_id
                                            ? 'border-[#7C5E3F] bg-[#FAF5EE] text-[#7C5E3F] dark:border-amber-400 dark:bg-slate-800 dark:text-amber-400 shadow-2xs'
                                            : 'border-slate-100/50 hover:border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-850/50 text-slate-700 dark:text-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8.5 h-8.5 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-[#ecb613] shrink-0 font-extrabold">
                                            {teacherName.charAt(0)}
                                        </div>
                                        <div className="min-w-0 text-left">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <h4 className="font-extrabold text-xs leading-none">{teacherName}</h4>
                                                <span className="text-[7.5px] font-black bg-[#7C5E3F] dark:bg-amber-400 text-white dark:text-slate-950 px-1.5 py-0.2 rounded uppercase tracking-wider shrink-0">Teacher</span>
                                            </div>
                                            <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 truncate">{classroom.teacher_email}</p>
                                        </div>
                                    </div>
                                    <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                </button>
                            )}

                             {/* Admin Contacts */}
                             {admins.length > 0 && (
                                 <>
                                     {admins.map((admin) => {
                                         const active = selectedFeed.type === 'chat' && selectedFeed.id === admin.id;
                                         const showAdminInSearch = leftSearch === '' || admin.name.toLowerCase().includes(leftSearch.toLowerCase());
                                         if (!showAdminInSearch) return null;
                                         return (
                                             <button
                                                 key={admin.id}
                                                 onClick={() => {
                                                     setSelectedFeed({ type: 'chat', id: admin.id, name: admin.name });
                                                     setRightSearch('');
                                                 }}
                                                 className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left cursor-pointer ${
                                                     active
                                                         ? 'border-[#7C5E3F] bg-[#FAF5EE] text-[#7C5E3F] dark:border-amber-400 dark:bg-slate-800 dark:text-amber-400 shadow-2xs'
                                                         : 'border-slate-100/50 hover:border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-850/50 text-slate-700 dark:text-slate-300'
                                                 }`}
                                             >
                                                 <div className="flex items-center gap-3 min-w-0">
                                                     <div className="w-8.5 h-8.5 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 text-rose-500 shrink-0 font-extrabold text-xs">
                                                         {admin.name.charAt(0)}
                                                     </div>
                                                     <div className="min-w-0 text-left">
                                                         <div className="flex items-center gap-1.5 flex-wrap">
                                                             <h4 className="font-extrabold text-xs leading-none">{admin.name}</h4>
                                                             <span className="text-[7.5px] font-black bg-rose-600 text-white px-1.5 py-0.2 rounded uppercase tracking-wider shrink-0">Admin</span>
                                                         </div>
                                                         <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 truncate">{admin.email}</p>
                                                     </div>
                                                 </div>
                                                 <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                             </button>
                                         );
                                     })}
                                 </>
                             )}

                            {/* Classmates Contacts */}
                            {filteredClassmates.length === 0 ? (
                                leftSearch !== '' && (
                                    <p className="text-[10px] text-slate-400 italic text-center py-2">No classmates match your search.</p>
                                )
                            ) : (
                                filteredClassmates.map((mate) => {
                                    const active = selectedFeed.type === 'chat' && selectedFeed.id === mate.id;
                                    return (
                                        <button
                                            key={mate.id}
                                            onClick={() => {
                                                setSelectedFeed({ type: 'chat', id: mate.id, name: mate.name });
                                                setRightSearch('');
                                            }}
                                            className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left cursor-pointer ${
                                                active
                                                    ? 'border-[#7C5E3F] bg-[#FAF5EE] text-[#7C5E3F] dark:border-amber-400 dark:bg-slate-800 dark:text-amber-400 shadow-2xs'
                                                    : 'border-slate-100/50 hover:border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-850/50 text-slate-700 dark:text-slate-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-8.5 h-8.5 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-750 font-extrabold text-slate-500 text-xs">
                                                    {mate.profile_pic_url ? (
                                                        <img src={mate.profile_pic_url} alt={mate.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span>{mate.name.charAt(0)}</span>
                                                    )}
                                                </div>
                                                <div className="min-w-0 text-left">
                                                    <h4 className="font-extrabold text-xs leading-none">{mate.name}</h4>
                                                    <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 truncate">{mate.level}</p>
                                                </div>
                                            </div>
                                            <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel: Content View Area (Broadcasts list or Chat window) */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col h-[650px] text-left">
                {/* Header with Search */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-4 flex-shrink-0">
                    <div className="text-left">
                        <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest block font-mono">
                            {selectedFeed.type === 'category' ? 'Announcement Feed' : 'Direct Conversation'}
                        </span>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <h4 className="text-base font-extrabold text-slate-900 dark:text-white leading-none">{selectedFeed.name}</h4>
                            {selectedFeed.type === 'chat' && (
                                <span className={`text-[7.5px] font-black text-white px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                    selectedFeed.id === classroom?.teacher_id 
                                        ? 'bg-[#7C5E3F] dark:bg-amber-400 dark:text-slate-950' 
                                        : (admins.some(a => a.id === selectedFeed.id) ? 'bg-rose-600' : 'bg-slate-500')
                                }`}>
                                    {selectedFeed.id === classroom?.teacher_id 
                                        ? 'Teacher' 
                                        : (admins.some(a => a.id === selectedFeed.id) ? 'Admin' : 'Classmate')}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Right search input */}
                    <div className="relative w-full sm:w-60">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input 
                            type="text"
                            placeholder="Search in this view..."
                            value={rightSearch}
                            onChange={(e) => setRightSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 transition-all"
                        />
                    </div>
                </div>

                {/* Main View Area */}
                {selectedFeed.type === 'category' ? (
                    /* CATEGORY BROADCASTS VIEW */
                    <div className="flex-1 overflow-y-auto space-y-5 pr-1 custom-scrollbar">
                        {filteredBroadcasts.length === 0 ? (
                            <div className="py-20 border border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-center bg-slate-50/50 dark:bg-slate-950/10">
                                <Mail className="w-10 h-10 text-slate-350 mx-auto mb-2 animate-pulse" />
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No announcements found.</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">Try changing your filters or search keywords.</p>
                            </div>
                        ) : (
                            filteredBroadcasts.map((b) => {
                                const isAdmin = b.sender?.role === 'admin';
                                return (
                                    <div 
                                        key={b.id} 
                                        className={`transition-all p-5 rounded-2xl border text-left flex flex-col gap-3.5 ${
                                            isAdmin 
                                                ? 'bg-[#FAF5EE]/70 dark:bg-slate-850/40 border-[#7C5E3F]/30 hover:bg-[#FAF5EE]/90 shadow-2xs' 
                                                : 'bg-slate-50/40 dark:bg-slate-850/20 border-slate-150 dark:border-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-850/55 shadow-3xs'
                                        }`}
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100/80 dark:border-slate-800 pb-2.5">
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h5 className="font-extrabold text-xs md:text-sm text-slate-800 dark:text-white leading-snug">{b.subject}</h5>
                                                    {isAdmin ? (
                                                        <span className="inline-flex items-center gap-1 text-[7.5px] font-black text-[#7C5E3F] bg-amber-100 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">📢 Admin Notice</span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-[7.5px] font-black text-amber-700 bg-amber-50 dark:bg-amber-955/25 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">🏫 Teacher Notice</span>
                                                    )}
                                                </div>
                                                <span className="inline-block text-[8px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest mt-1 font-mono">
                                                    Channel: {b.channel ? b.channel.replace('_', ' ') : (isAdmin ? 'announcements' : 'classroom')}
                                                </span>
                                            </div>
                                            <span className="text-[9px] font-bold text-slate-400 shrink-0">
                                                {new Date(b.created_at).toLocaleDateString()} at {new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>

                                        <p className="text-xs text-slate-655 dark:text-slate-350 leading-relaxed whitespace-pre-wrap">
                                            {b.content}
                                        </p>

                                        {/* Audio Voice Note attachment */}
                                        {b.audio_attachment && (
                                            <div className="pt-1.5">
                                                <button 
                                                    onClick={() => playVoiceNote(b.id, b.audio_attachment!)}
                                                    className={`inline-flex items-center gap-2 px-4 py-2 border rounded-full text-xs font-extrabold transition-all shadow-3xs cursor-pointer ${
                                                        playingAudioId === b.id 
                                                            ? 'bg-amber-500 text-white border-amber-600'
                                                            : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                                                    }`}
                                                >
                                                    {playingAudioId === b.id ? (
                                                        <>
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            Playing Voice Instruction...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Volume2 className="w-3.5 h-3.5 text-amber-500" />
                                                            Listen to Voice Note / Backing Tone
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : (
                    /* DIRECT CHAT thread WORKSPACE */
                    <>
                        {/* Messages Thread Bubbles */}
                        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 py-1 custom-scrollbar text-left flex flex-col">
                            {filteredChatThread.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
                                    <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-705 animate-pulse" />
                                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        {rightSearch !== '' ? 'No matching messages found' : 'No message history yet'}
                                    </h4>
                                    <p className="text-[10px] text-slate-400 max-w-[220px] leading-relaxed">
                                        {rightSearch !== '' 
                                            ? 'Try typing a different keyword to search the conversation history.' 
                                            : 'Send a message below or select a suggested topic to start your conversation.'}
                                    </p>
                                    {rightSearch === '' && (
                                        <div className="pt-2 flex flex-col gap-1.5 w-full max-w-[280px]">
                                            <p className="text-[8px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest text-center font-mono">Suggested Topics</p>
                                            {[
                                                selectedFeed.id === classroom?.teacher_id || admins.some(a => a.id === selectedFeed.id)
                                                    ? 'Hi, I have a question about the curriculum.'
                                                    : 'Hi! How is your practice going?',
                                                'Hello, could you please guide me on this?',
                                                selectedFeed.id === classroom?.teacher_id || admins.some(a => a.id === selectedFeed.id)
                                                    ? 'Hello, I wanted to ask about class timings.'
                                                    : 'Do you want to practice together?'
                                            ].map((phrase, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => setChatInput(phrase)}
                                                    className="w-full text-center px-3 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-[10px] font-semibold text-slate-600 dark:text-slate-300 rounded-xl border border-slate-100 dark:border-slate-750 transition-all cursor-pointer"
                                                >
                                                    {phrase}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                filteredChatThread.map((msg) => {
                                    const isMe = msg.sender_id === profile?.id;
                                    return (
                                        <div 
                                            key={msg.id} 
                                            className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                                                isMe 
                                                    ? 'bg-[#7C5E3F] text-white self-end rounded-br-none shadow-2xs' 
                                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 self-start rounded-bl-none border border-slate-100 dark:border-slate-750'
                                            }`}
                                        >
                                            <p className="whitespace-pre-wrap text-left select-text">{msg.message_text}</p>
                                            <span className={`block text-[8px] mt-1.5 text-right font-medium ${isMe ? 'text-amber-50/60' : 'text-slate-400'}`}>
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={chatEndRef} />
                        </div>

                         {/* Send Message Input Form */}
                         <form onSubmit={handleSendMsg} className="flex gap-2 items-end border-t border-slate-100 dark:border-slate-800 pt-4 flex-shrink-0">
                             <textarea
                                 value={chatInput}
                                 onChange={(e) => setChatInput(e.target.value)}
                                 placeholder={`Message ${selectedFeed.name}...`}
                                 required
                                 rows={1}
                                 onKeyDown={(e) => {
                                     if (e.key === 'Enter' && !e.shiftKey) {
                                         e.preventDefault();
                                         if (chatInput.trim() && !sendingMsg) {
                                             handleSendMsg(e);
                                         }
                                     }
                                 }}
                                 className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100 transition-all resize-none max-h-24 min-h-[38px] custom-scrollbar"
                             />
                             <button
                                 type="submit"
                                 disabled={sendingMsg || !chatInput.trim()}
                                 className="p-2.5 rounded-xl bg-[#7C5E3F] hover:bg-[#634a31] dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-slate-950 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md cursor-pointer flex items-center justify-center shrink-0"
                             >
                                 {sendingMsg ? (
                                     <Loader2 className="w-4.5 h-4.5 animate-spin" />
                                 ) : (
                                     <Send className="w-4.5 h-4.5" />
                                 )}
                             </button>
                         </form>
                    </>
                )}
            </div>
        </div>
    );
}
