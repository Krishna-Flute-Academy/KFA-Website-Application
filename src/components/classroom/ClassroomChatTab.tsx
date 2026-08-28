'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
    Loader2, MessageSquare, Search, Send, Users, X, Info, Smile, 
    Paperclip, MoreVertical, CheckCheck, ArrowLeft 
} from 'lucide-react';
import AutoLinkText from '../common/AutoLinkText';

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
    const [showGroupInfo, setShowGroupInfo] = useState(true); // Toggle right sidebar (WhatsApp Group Info style)
    const [isSearching, setIsSearching] = useState(false); // Header search bar state
    const chatEndRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

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

    // Auto-focus search input when search is toggled on
    useEffect(() => {
        if (isSearching) {
            searchInputRef.current?.focus();
        }
    }, [isSearching]);

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

    // Helper to format timestamps like WhatsApp
    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    // Helper to group messages by date and sender consecutive blocks
    const processedMessages = useMemo(() => {
        const result: Array<{
            type: 'date' | 'message';
            dateLabel?: string;
            message?: ClassroomChatMessage;
            isConsecutive?: boolean;
        }> = [];

        let lastDateStr = '';
        let lastSenderId = '';
        let lastMessageTime: number = 0;

        filteredMessages.forEach((msg) => {
            const msgDate = new Date(msg.created_at);
            const dateStr = msgDate.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            // Render Date Header if date changes
            if (dateStr !== lastDateStr) {
                const todayStr = new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                const tempYesterday = new Date();
                tempYesterday.setDate(tempYesterday.getDate() - 1);
                const yesterdayStr = tempYesterday.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

                let label = dateStr;
                if (dateStr === todayStr) label = 'TODAY';
                else if (dateStr === yesterdayStr) label = 'YESTERDAY';

                result.push({ type: 'date', dateLabel: label });
                lastDateStr = dateStr;
                lastSenderId = ''; // Reset consecutive check on new day
            }

            // Determine if consecutive send from same user within 2 minutes
            const msgTime = msgDate.getTime();
            const isConsecutive = msg.sender_id === lastSenderId && (msgTime - lastMessageTime) < 120000;

            result.push({
                type: 'message',
                message: msg,
                isConsecutive
            });

            lastSenderId = msg.sender_id;
            lastMessageTime = msgTime;
        });

        return result;
    }, [filteredMessages]);

    // Renders Right Panel (WhatsApp Group Info clone)
    const renderGroupInfo = (isDrawer: boolean = false) => (
        <div className="flex flex-col h-full bg-white dark:bg-[#121b22] text-left select-none border-l border-slate-200 dark:border-slate-800">
            {/* Group Info Header */}
            <div className="p-3.5 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-[#1f2c34]">
                {isDrawer ? (
                    <button 
                        onClick={() => setShowGroupInfo(false)}
                        className="p-1 hover:bg-slate-250 dark:hover:bg-[#2a3942] rounded-full text-slate-500 dark:text-slate-350 cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                ) : (
                    <button
                        onClick={() => setShowGroupInfo(false)}
                        className="xl:hidden p-1 hover:bg-slate-200 dark:hover:bg-[#2a3942] rounded-full text-slate-500 cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
                <h4 className="font-extrabold text-xs text-slate-800 dark:text-[#e9edef]">Group Info</h4>
            </div>

            <div className="flex-1 overflow-y-auto wa-scrollbar">
                {/* Visual Avatar Card (Reduced size) */}
                <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-[#111b21] border-b border-slate-100 dark:border-slate-800/60">
                    <div className="w-16 h-16 rounded-full bg-[#00a884]/10 dark:bg-emerald-500/10 border border-[#00a884]/20 flex items-center justify-center text-[#00a884] font-black text-xl shadow-xs mb-3">
                        {getInitial(classroom?.name)}
                    </div>
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-[#e9edef] text-center leading-snug">{classroom?.name || 'Class Discussion'}</h3>
                    <p className="text-[10px] text-slate-400 dark:text-[#8696a0] mt-0.5 text-center font-bold">Group · {participants.length} participants</p>
                </div>

                {/* Description Box */}
                <div className="p-4 bg-white dark:bg-[#111b21] border-b border-slate-100 dark:border-slate-800/60 text-left">
                    <span className="text-[9px] font-black text-slate-400 dark:text-[#8696a0] uppercase block">Description</span>
                    <p className="text-xs text-slate-650 dark:text-[#d1d7db] mt-1 leading-relaxed font-semibold">
                        Official chat for {classroom?.name || 'this class'}. Announcements, discussions, and practice summaries will be coordinated here.
                    </p>
                </div>

                {/* Participants List */}
                <div className="p-4 bg-white dark:bg-[#111b21] text-left">
                    <span className="text-[9px] font-black text-slate-400 dark:text-[#8696a0] uppercase block mb-2 px-1">
                        {participants.length} Participants
                    </span>

                    <div className="space-y-0.5">
                        {participants.map((p) => {
                            const isInstructor = p.role === 'teacher' || p.role === 'admin';
                            return (
                                <div key={p.id} className="flex items-center gap-2.5 py-1.5 px-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#202c33] transition-colors">
                                    {/* Reduced roster avatar size */}
                                    <div className={`w-7 h-7 rounded-full overflow-hidden flex items-center justify-center shrink-0 text-[10px] font-black border ${
                                        isInstructor
                                            ? 'bg-amber-100 border-amber-200 text-amber-700 dark:bg-amber-955/20 dark:border-amber-800 dark:text-amber-300'
                                            : 'bg-slate-100 border-slate-205 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                                    }`}>
                                        {p.profile_pic_url ? (
                                            <img src={p.profile_pic_url} alt={p.name} className="w-full h-full object-cover" />
                                        ) : (
                                            getInitial(p.name)
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-extrabold text-xs text-slate-800 dark:text-[#e9edef] truncate flex items-center justify-between">
                                            <span>{p.name}</span>
                                            {p.id === currentUser?.id && (
                                                <span className="text-[7px] bg-slate-200 dark:bg-[#2a3942] text-slate-655 dark:text-[#8696a0] px-1 rounded uppercase font-black">Me</span>
                                            )}
                                        </p>
                                        <p className={`text-[8px] font-black uppercase tracking-wider ${
                                            isInstructor ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-[#8696a0]'
                                        }`}>
                                            {p.role || 'student'}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-6 animate-in fade-in duration-300 relative">
            {/* Custom scrollbar and wallpapers */}
            <style dangerouslySetInnerHTML={{__html: `
                .wa-wallpaper {
                    background-color: #efeae2;
                    background-image: 
                        radial-gradient(rgba(0, 0, 0, 0.08) 1px, transparent 0),
                        radial-gradient(rgba(0, 0, 0, 0.08) 1px, transparent 0);
                    background-size: 12px 12px;
                    background-position: 0 0, 6px 6px;
                }
                .dark .wa-wallpaper {
                    background-color: #0b141a;
                    background-image: 
                        radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 0),
                        radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 0);
                    background-size: 12px 12px;
                    background-position: 0 0, 6px 6px;
                }
                .wa-scrollbar::-webkit-scrollbar {
                    width: 5px;
                }
                .wa-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .wa-scrollbar::-webkit-scrollbar-thumb {
                    background-color: rgba(100, 116, 139, 0.15);
                    border-radius: 10px;
                }
                .wa-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: rgba(100, 116, 139, 0.3);
                }
            `}} />

            {/* Chat Frame Container */}
            <section className="bg-[#efeae2] dark:bg-[#0b141a] border border-slate-200 dark:border-slate-800/80 rounded-3xl h-[650px] flex flex-col overflow-hidden text-left relative shadow-xs">
                
                {/* Chat Top Header */}
                <div className="h-14 px-4 bg-[#f0f2f5] dark:bg-[#1f2c34] border-b border-slate-200/40 dark:border-slate-800 flex items-center justify-between z-10 select-none">
                    {isSearching ? (
                        /* Header in Search Mode */
                        <div className="flex-1 flex items-center gap-3 animate-in fade-in slide-in-from-left-3 duration-200">
                            <button 
                                type="button" 
                                onClick={() => {
                                    setIsSearching(false);
                                    setSearchQuery('');
                                }}
                                className="p-1 hover:bg-slate-200 dark:hover:bg-[#2a3942] rounded-full text-slate-600 dark:text-[#aebac1] cursor-pointer"
                            >
                                <ArrowLeft className="w-4.5 h-4.5" />
                            </button>
                            <div className="flex-1 flex items-center gap-2 bg-white dark:bg-[#2a3942] rounded-full px-3 py-1 border border-slate-200/80 dark:border-slate-700/60 shadow-3xs">
                                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search messages..."
                                    className="flex-1 bg-transparent border-none outline-none text-xs font-semibold text-slate-800 dark:text-[#e9edef] placeholder:text-slate-450"
                                />
                                {searchQuery && (
                                    <button 
                                        type="button" 
                                        onClick={() => setSearchQuery('')}
                                        className="text-slate-400 hover:text-slate-655"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Normal Header Mode */
                        <>
                            <div className="flex items-center gap-2.5 min-w-0 cursor-pointer" onClick={() => setShowGroupInfo(!showGroupInfo)}>
                                {/* Reduced Group Icon Avatar size from w-10 to w-8 */}
                                <div className="w-8.5 h-8.5 rounded-full bg-[#00a884]/15 dark:bg-emerald-500/10 border border-[#00a884]/15 text-[#00a884] dark:text-emerald-400 font-black text-xs flex items-center justify-center shrink-0 shadow-3xs">
                                    {getInitial(classroom?.name)}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-[#e9edef] truncate leading-tight">
                                        {classroom?.name || 'Class Discussion'}
                                    </h3>
                                    <span className="text-[9.5px] text-slate-500 dark:text-[#8696a0] font-bold mt-0.5 block truncate">
                                        Roster Details ({participants.length} members)
                                    </span>
                                </div>
                            </div>

                            {/* Header Buttons */}
                            <div className="flex items-center gap-1 text-slate-600 dark:text-[#aebac1]">
                                {/* Search Icon Trigger */}
                                <button 
                                    type="button" 
                                    onClick={() => setIsSearching(true)}
                                    title="Search chat"
                                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#2a3942] rounded-full transition-colors cursor-pointer"
                                >
                                    <Search className="w-4.5 h-4.5" />
                                </button>
                                
                                {/* Info Sidebar Trigger */}
                                <button 
                                    type="button" 
                                    title="Toggle Group Info"
                                    onClick={() => setShowGroupInfo(!showGroupInfo)}
                                    className={`p-1.5 rounded-full transition-all cursor-pointer ${
                                        showGroupInfo 
                                            ? 'bg-[#00a884]/10 text-[#00a884] dark:bg-emerald-500/10 dark:text-emerald-400' 
                                            : 'hover:bg-slate-200 dark:hover:bg-[#2a3942]'
                                    }`}
                                >
                                    <Users className="w-4.5 h-4.5" />
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Chat Message Box Area */}
                <div className="flex-1 overflow-y-auto p-3.5 space-y-2 wa-scrollbar flex flex-col wa-wallpaper relative">
                    {processedMessages.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 select-none bg-white/70 dark:bg-[#111b21]/70 backdrop-blur-xs rounded-2xl m-4 border border-slate-200/40 dark:border-slate-800/40">
                            <div className="w-12 h-12 bg-[#00a884]/10 rounded-full flex items-center justify-center mb-3">
                                <MessageSquare className="w-6 h-6 text-[#00a884]" />
                            </div>
                            <h4 className="text-xs font-black text-slate-800 dark:text-[#e9edef]">
                                Classroom Space
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-[#8696a0] max-w-[240px] leading-relaxed mt-1 font-semibold">
                                {searchQuery ? 'No matching messages found.' : 'Message logs are synchronized. Text your classmate updates or submit practice logs here.'}
                            </p>
                        </div>
                    ) : (
                        processedMessages.map((item, idx) => {
                            if (item.type === 'date') {
                                return (
                                    <div key={`date-${idx}`} className="self-center my-2 select-none">
                                        <span className="bg-white dark:bg-[#1f2c34] px-2.5 py-0.5 rounded-md shadow-3xs text-[9px] font-black text-slate-550 dark:text-[#8696a0] uppercase border border-slate-200/20 dark:border-slate-800/10">
                                            {item.dateLabel}
                                        </span>
                                    </div>
                                );
                            }

                            const message = item.message!;
                            const isMe = message.sender_id === currentUser?.id;
                            const senderName = message.sender?.name || (isMe ? currentUser?.name : 'Class member') || 'Class member';
                            const senderRole = message.sender?.role || (isMe ? currentUser?.role : null);
                            const isTeacherMessage = senderRole === 'teacher' || senderRole === 'admin';
                            const isConsecutive = item.isConsecutive;

                            return (
                                <div
                                    key={message.id}
                                    className={`flex max-w-[85%] sm:max-w-[70%] transition-all ${
                                        isMe ? 'self-end justify-end' : 'self-start justify-start'
                                    } ${isConsecutive ? 'mt-0.5' : 'mt-2'}`}
                                >
                                    {/* Message Bubble (Tighter padding, explicit read ticks, legibility styling) */}
                                    <div className={`px-2.5 py-1 rounded-xl shadow-3xs border text-xs leading-relaxed relative flex flex-col min-w-[80px] pb-5 ${
                                        isMe
                                            ? 'bg-[#d9fdd3] dark:bg-[#005c4b] border-[#d9fdd3] dark:border-[#005c4b]'
                                            : isTeacherMessage
                                            ? 'bg-[#e7f3ff] dark:bg-[#1c3549] border-[#e7f3ff] dark:border-[#1c3549] font-medium'
                                            : 'bg-white dark:bg-[#202c33] border-white dark:border-[#202c33]'
                                    } ${isConsecutive ? 'rounded-t-xl' : ''} ${
                                        isMe ? 'rounded-tr-none' : 'rounded-tl-none'
                                    }`}>
                                        
                                        {/* Sender Name (Only shown if NOT consecutive and NOT self) */}
                                        {!isMe && !isConsecutive && (
                                            <div className="flex items-center gap-1 mb-0.5 select-none">
                                                <span className={`text-[9.5px] font-black ${
                                                    isTeacherMessage ? 'text-[#005c4b] dark:text-[#ecb613]' : 'text-blue-600 dark:text-blue-400'
                                                }`}>{senderName}</span>
                                                {senderRole && (
                                                    <span className={`text-[6.5px] font-black px-1 py-0.2 rounded uppercase tracking-wider ${
                                                        isTeacherMessage
                                                            ? 'bg-[#005c4b]/10 text-[#005c4b] dark:bg-amber-450/15 dark:text-amber-300'
                                                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-450'
                                                    }`}>
                                                        {senderRole}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Text message (Enhanced readability) */}
                                        <p className={`whitespace-pre-wrap select-text pr-2.5 leading-snug font-medium ${
                                            isMe 
                                                ? 'text-slate-900 dark:text-[#f0f2f5]' 
                                                : isTeacherMessage
                                                ? 'text-[#00254d] dark:text-[#eef7ff]'
                                                : 'text-slate-900 dark:text-[#e9edef]'
                                        }`}>
                                            <AutoLinkText text={message.message_text} preserveNewlines />
                                        </p>
                                        
                                        {/* Time and Blue checks (Explicit high-contrast colors, absolute aligned to avoid text overlap) */}
                                        <span className="self-end text-[8px] select-none flex items-center gap-0.5 leading-none absolute bottom-1 right-1.5 font-bold">
                                            <span className={
                                                isMe 
                                                    ? 'text-emerald-850/85 dark:text-[#97dfb5]' 
                                                    : 'text-slate-500 dark:text-[#8696a0]'
                                            }>
                                                {formatTime(message.created_at)}
                                            </span>
                                            {isMe && (
                                                <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                                            )}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Chat Bottom Editor Input (WhatsApp pill shape) */}
                <form onSubmit={submitMessage} className="px-3 py-2.5 bg-[#f0f2f5] dark:bg-[#1f2c34] flex items-center gap-2 select-none z-10 border-t border-slate-200/30 dark:border-slate-800/40">
                    <div className="flex-1 flex items-center gap-2.5 bg-white dark:bg-[#2a3942] rounded-full px-4 py-1.5 shadow-3xs border border-transparent focus-within:border-slate-250 dark:focus-within:border-slate-700">
                        <button type="button" className="text-[#64748b] dark:text-[#8696a0] hover:text-slate-700 dark:hover:text-[#d1d7db] cursor-pointer shrink-0">
                            <Smile className="w-5 h-5" />
                        </button>
                        
                        <textarea
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && !event.shiftKey) {
                                    event.preventDefault();
                                    submitMessage();
                                }
                            }}
                            placeholder={classroom ? "Type a message" : "Select a classroom to chat..."}
                            disabled={!classroom || !currentUser}
                            rows={1}
                            className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm text-slate-800 dark:text-[#e9edef] transition-all resize-none max-h-20 min-h-[22px] py-1 custom-scrollbar disabled:opacity-60 placeholder:text-slate-450 dark:placeholder:text-[#8696a0]"
                        />

                        <button type="button" className="text-[#64748b] dark:text-[#8696a0] hover:text-slate-700 dark:hover:text-[#d1d7db] cursor-pointer shrink-0 hidden xs:block">
                            <Paperclip className="w-4.5 h-4.5" />
                        </button>
                    </div>

                    {/* Send Button */}
                    <button
                        type="submit"
                        disabled={sending || !draft.trim() || !classroom || !currentUser}
                        className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#008f72] text-white flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed shrink-0 cursor-pointer"
                        aria-label="Send classroom message"
                    >
                        {sending ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
                    </button>
                </form>
            </section>

            {/* Right Pane Group Info (Desktop View, shown when showGroupInfo is true) */}
            {showGroupInfo && (
                <aside className="hidden xl:block bg-white dark:bg-[#121b22] border border-slate-205 dark:border-slate-800 rounded-3xl overflow-hidden h-[650px] flex flex-col shadow-xs">
                    {renderGroupInfo(false)}
                </aside>
            )}

            {/* Slide-over Drawer for Group Info (Shown on smaller screens) */}
            {showGroupInfo && (
                <div className="fixed inset-0 z-[500] xl:hidden">
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 bg-[#000000]/40 backdrop-blur-xs transition-opacity duration-300"
                        onClick={() => setShowGroupInfo(false)}
                    />
                    
                    {/* Drawer container */}
                    <aside className="fixed top-0 right-0 h-full w-80 max-w-[82vw] bg-white dark:bg-[#121b22] z-50 flex flex-col animate-in slide-in-from-right duration-300">
                        {renderGroupInfo(true)}
                    </aside>
                </div>
            )}
        </div>
    );
}
