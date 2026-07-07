'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MessageSquare, Search, Send, Users } from 'lucide-react';

interface ClassroomChatMessage {
    id: string;
    classroom_id: string;
    sender_id: string;
    message_text: string;
    created_at: string;
    sender?: {
        name?: string | null;
        role?: string | null;
        profile_pic_url?: string | null;
    } | null;
}

interface ClassroomChatTabProps {
    classroom: { id: string; name?: string | null } | null;
    currentUser: { id: string; name?: string | null; role?: string | null } | null;
    messages: ClassroomChatMessage[];
    participants?: Array<{ id: string; name: string; role?: string | null; profile_pic_url?: string | null }>;
    sending?: boolean;
    onSendMessage: (messageText: string) => Promise<void>;
}

export default function ClassroomChatTab({
    classroom,
    currentUser,
    messages,
    participants = [],
    sending = false,
    onSendMessage
}: ClassroomChatTabProps) {
    const [draft, setDraft] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [localError, setLocalError] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    const filteredMessages = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return messages;
        return messages.filter((message) => {
            const senderName = message.sender?.name || '';
            return (
                message.message_text.toLowerCase().includes(query) ||
                senderName.toLowerCase().includes(query)
            );
        });
    }, [messages, searchQuery]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [filteredMessages.length, classroom?.id]);

    const getInitial = (name?: string | null) => (name?.trim()?.charAt(0)?.toUpperCase() || '?');

    const submitMessage = async (event?: React.FormEvent) => {
        event?.preventDefault();
        const messageText = draft.trim();
        if (!messageText || !classroom?.id || !currentUser?.id || sending) return;

        setLocalError('');
        try {
            await onSendMessage(messageText);
            setDraft('');
        } catch (error: any) {
            console.error('Failed to send classroom message:', error);
            setLocalError(error?.message || 'Failed to send message. Please try again.');
        }
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-6 animate-in fade-in duration-300">
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs h-[680px] flex flex-col overflow-hidden text-left">
                <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="min-w-0">
                        <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest block font-mono">Classroom Chat</span>
                        <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mt-1 truncate">
                            {classroom?.name || 'Class Discussion'}
                        </h3>
                    </div>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Search messages..."
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 transition-all"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 custom-scrollbar flex flex-col">
                    {filteredMessages.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                            <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-3" />
                            <h4 className="text-sm font-extrabold text-slate-700 dark:text-slate-300">
                                {searchQuery ? 'No matching messages' : 'No classroom messages yet'}
                            </h4>
                            <p className="text-xs text-slate-400 max-w-[260px] leading-relaxed mt-1">
                                {searchQuery ? 'Try a different search term.' : 'Start the class discussion with a question, update, or practice note.'}
                            </p>
                        </div>
                    ) : (
                        filteredMessages.map((message) => {
                            const isMe = message.sender_id === currentUser?.id;
                            const senderName = message.sender?.name || (isMe ? currentUser?.name : 'Class member') || 'Class member';
                            const senderRole = message.sender?.role || (isMe ? currentUser?.role : null);

                            return (
                                <div
                                    key={message.id}
                                    className={`flex gap-3 max-w-[92%] ${isMe ? 'self-end flex-row-reverse' : 'self-start'}`}
                                >
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border font-extrabold text-xs ${
                                        isMe
                                            ? 'bg-[#7C5E3F] border-[#7C5E3F] text-white'
                                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                    }`}>
                                        {message.sender?.profile_pic_url ? (
                                            <img src={message.sender.profile_pic_url} alt={senderName} className="w-full h-full object-cover" />
                                        ) : (
                                            getInitial(senderName)
                                        )}
                                    </div>
                                    <div className={`min-w-0 ${isMe ? 'items-end text-right' : 'items-start text-left'} flex flex-col`}>
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400">{senderName}</span>
                                            {senderRole && (
                                                <span className={`text-[7.5px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                                    senderRole === 'teacher' || senderRole === 'admin'
                                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300'
                                                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                                }`}>
                                                    {senderRole}
                                                </span>
                                            )}
                                        </div>
                                        <div className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-3xs ${
                                            isMe
                                                ? 'bg-[#7C5E3F] text-white rounded-br-none'
                                                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-750 rounded-bl-none'
                                        }`}>
                                            <p className="whitespace-pre-wrap select-text">{message.message_text}</p>
                                            <span className={`block text-[8px] mt-1.5 ${isMe ? 'text-amber-50/70' : 'text-slate-400'}`}>
                                                {new Date(message.created_at).toLocaleString([], {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={chatEndRef} />
                </div>

                <form onSubmit={submitMessage} className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                    {localError && (
                        <p className="mb-3 text-xs font-bold text-red-600 dark:text-red-400">{localError}</p>
                    )}
                    <div className="flex items-end gap-2">
                        <textarea
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && !event.shiftKey) {
                                    event.preventDefault();
                                    submitMessage();
                                }
                            }}
                            placeholder={classroom ? `Message ${classroom.name || 'the class'}...` : 'Select a classroom to message...'}
                            disabled={!classroom || !currentUser}
                            rows={1}
                            className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100 transition-all resize-none max-h-28 min-h-[42px] custom-scrollbar disabled:opacity-60"
                        />
                        <button
                            type="submit"
                            disabled={sending || !draft.trim() || !classroom || !currentUser}
                            className="p-3 rounded-xl bg-[#7C5E3F] hover:bg-[#634a31] dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-slate-950 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md cursor-pointer flex items-center justify-center shrink-0"
                            aria-label="Send classroom message"
                        >
                            {sending ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Send className="w-4.5 h-4.5" />}
                        </button>
                    </div>
                </form>
            </section>

            <aside className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs h-fit text-left">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-mono">Participants</span>
                        <h4 className="font-extrabold text-slate-900 dark:text-white text-sm mt-1">Class Members</h4>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-400/10 text-amber-600 dark:text-amber-300 flex items-center justify-center">
                        <Users className="w-4.5 h-4.5" />
                    </div>
                </div>
                <div className="space-y-2 max-h-[520px] overflow-y-auto custom-scrollbar pr-1">
                    {participants.length === 0 ? (
                        <p className="text-xs text-slate-400 py-4 text-center">Participants will appear here.</p>
                    ) : (
                        participants.map((participant) => (
                            <div key={participant.id} className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                <div className="w-8.5 h-8.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center shrink-0 text-xs font-extrabold text-slate-500">
                                    {participant.profile_pic_url ? (
                                        <img src={participant.profile_pic_url} alt={participant.name} className="w-full h-full object-cover" />
                                    ) : (
                                        getInitial(participant.name)
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-extrabold text-xs text-slate-800 dark:text-slate-100 truncate">{participant.name}</p>
                                    <p className="text-[9px] text-slate-400 uppercase font-black tracking-wider">{participant.role || 'student'}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </aside>
        </div>
    );
}
