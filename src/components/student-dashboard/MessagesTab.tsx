'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { supabaseAuth } from '../../lib/supabase-auth';
import { Mail, Loader2, Volume2, Search, MessageSquare, Send, Users, ChevronRight, FileAudio, Megaphone, CreditCard, Sparkles, Bell, Inbox, Check, CheckCheck } from 'lucide-react';

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

const stripHtml = (html: string) => {
    if (!html) return '';
    return html.replace(/<[^>]*>?/gm, '');
};

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
    notifications?: any[];
    setNotifications?: React.Dispatch<React.SetStateAction<any[]>>;
    selectedFeedProp?: { type: 'category' | 'chat'; id: string; name: string } | null;
    mentorInfo?: any;
    mentees?: any[];
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
    admins = [],
    notifications = [],
    setNotifications,
    selectedFeedProp,
    mentorInfo,
    mentees = []
}: MessagesTabProps) {
    // Selection state: can be a category id or a contact object
    const [selectedFeed, setSelectedFeed] = useState<{ type: 'category' | 'chat'; id: string; name: string }>(
        selectedFeedProp || (() => {
            const firstUnread = notifications.find(n => !n.is_read);
            if (firstUnread) {
                const b = broadcasts.find(bc => bc.subject === firstUnread.title || bc.content === firstUnread.message);
                if (b) {
                    if (b.channel === 'custom_groups') return { type: 'category', id: 'custom_groups', name: 'Group Announcements' };
                    if (b.channel === 'announcements') return { type: 'category', id: 'announcements', name: 'Announcements' };
                    if (b.channel === 'classroom') return { type: 'category', id: 'classroom', name: 'Class Announcements' };
                    if (b.channel === 'new_joiners') return { type: 'category', id: 'new_joiners', name: 'New Joiners Notices' };
                    if (b.channel === 'fee_management') return { type: 'category', id: 'fee_management', name: 'Fee & Payments' };
                    if (b.channel === 'voice') return { type: 'category', id: 'voice', name: 'Voice Notes & Tones' };
                }
            }
            return { type: 'category', id: 'classroom', name: 'Class Announcements' };
        })()
    );

    useEffect(() => {
        if (selectedFeedProp) {
            setSelectedFeed(selectedFeedProp);
        }
    }, [selectedFeedProp]);
    
    const [leftSearch, setLeftSearch] = useState('');
    const [rightSearch, setRightSearch] = useState('');
    const [chatInput, setChatInput] = useState('');
    const [sendingMsg, setSendingMsg] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const notificationsRef = useRef(notifications);
    useEffect(() => {
        notificationsRef.current = notifications;
    }, [notifications]);

    // Scroll to bottom of chat when thread changes or a message is sent
    useEffect(() => {
        if (selectedFeed.type === 'chat') {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [directMessages, selectedFeed]);

    // Mark student incoming messages & corresponding notifications as read when active chat thread is opened
    useEffect(() => {
        if (selectedFeed.type === 'chat' && profile?.id) {
            const timer = setTimeout(async () => {
                try {
                    // Mark messages as read
                    const { error } = await supabaseAuth
                        .from('messages')
                        .update({ status: 'read' })
                        .eq('sender_id', selectedFeed.id)
                        .eq('receiver_id', profile.id)
                        .neq('status', 'read');
                    if (error) throw error;

                    // Mark notifications as read using the ref to avoid dependency resets
                    const contactNotifs = notificationsRef.current.filter(n => {
                        if (n.is_read || n.type !== 'messages') return false;
                        const contact = getNotificationContact(n);
                        if (contact?.id) return contact.id === selectedFeed.id;
                        return String(n.title || '').toLowerCase().includes(selectedFeed.name.toLowerCase());
                    });

                    if (contactNotifs.length > 0) {
                        const { error: notifError } = await supabaseAuth
                            .from('notifications')
                            .update({ is_read: true })
                            .in('id', contactNotifs.map(n => n.id));
                        if (notifError) throw notifError;

                        if (setNotifications) {
                            setNotifications(prev => prev.map(n => 
                                contactNotifs.some(cn => cn.id === n.id) ? { ...n, is_read: true } : n
                            ));
                        }
                    }
                } catch (e) {
                    console.error('Failed to mark student messages & notifications as read:', e);
                }
            }, 1000); // 1.0 second delay is plenty and feels responsive

            return () => clearTimeout(timer);
        }
    }, [selectedFeed.id, selectedFeed.type, directMessages.length, profile?.id]);

    // Mark category notifications as read when category is opened
    useEffect(() => {
        if (selectedFeed.type === 'category' && profile?.id) {
            const markCategoryNotifsAsRead = async () => {
                try {
                    const catBroadcasts = broadcasts.filter(b => {
                        if (selectedFeed.id === 'announcements') {
                            return b.channel === 'announcements' || (!b.channel && b.sender?.role === 'admin');
                        } else if (selectedFeed.id === 'classroom') {
                            return b.channel === 'classroom' || (!b.channel && b.sender?.role !== 'admin');
                        } else if (selectedFeed.id === 'custom_groups') {
                            return b.channel === 'custom_groups';
                        } else if (selectedFeed.id === 'new_joiners') {
                            return b.channel === 'new_joiners';
                        } else if (selectedFeed.id === 'fee_management') {
                            return b.channel === 'fee_management';
                        } else if (selectedFeed.id === 'voice') {
                            return !!b.audio_attachment;
                        }
                        return false;
                    });

                    const matchingNotifs = notificationsRef.current.filter(n => {
                        if (n.is_read || (n.type !== 'reminder' && n.type !== 'messages')) return false;
                        return catBroadcasts.some(b => n.title === b.subject || n.message === b.content);
                    });

                    if (matchingNotifs.length > 0) {
                        const { error } = await supabaseAuth
                            .from('notifications')
                            .update({ is_read: true })
                            .in('id', matchingNotifs.map(n => n.id));
                        if (error) throw error;

                        if (setNotifications) {
                            setNotifications(prev => prev.map(n => 
                                matchingNotifs.some(mn => mn.id === n.id) ? { ...n, is_read: true } : n
                            ));
                        }
                    }
                } catch (e) {
                    console.error('Failed to mark category notifications as read:', e);
                }
            };
            markCategoryNotifsAsRead();
        }
    }, [selectedFeed.id, selectedFeed.type, broadcasts, profile?.id]);

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

    const isVideoOrBlogRelease = (item: any) => {
        if (!item) return false;
        const titleLower = String(item.title || item.subject || '').toLowerCase();
        const msgLower = String(item.message || item.content || '').toLowerCase();
        const channelLower = String(item.channel || '').toLowerCase();

        if (channelLower === 'blog' || channelLower === 'video') return true;
        if (titleLower.startsWith('new video:') || titleLower.startsWith('new blog:')) return true;
        if (titleLower.includes('new video') || titleLower.includes('new blog') || titleLower.includes('blog article') || titleLower.includes('video release') || titleLower.includes('blog release')) return true;
        if (msgLower.includes('new video') || msgLower.includes('new blog') || msgLower.includes('blog article') || msgLower.includes('video release') || msgLower.includes('blog release')) return true;

        if (Array.isArray(item.recipients)) {
            if (item.recipients.some((r: any) => r._meta && (r.type === 'blog' || r.type === 'video'))) {
                return true;
            }
        }

        return false;
    };

    const unreadMessageNotifications = useMemo(() => {
        return notifications.filter(n => {
            if (n.is_read) return false;
            if (isVideoOrBlogRelease(n)) return false;
            
            // Check if it matches an active broadcast announcement
            const matchingBroadcast = broadcasts.find(b => n.title === b.subject || n.message === b.content);
            if (matchingBroadcast) {
                if (isVideoOrBlogRelease(matchingBroadcast)) return false;
                return true;
            }

            // Check if it is a direct chat message (messages type and doesn't match a broadcast)
            if (n.type === 'messages' && !matchingBroadcast) return true;

            return false;
        });
    }, [notifications, broadcasts]);

    const contactDirectory = useMemo(() => {
        const contacts: Array<{ id: string; name: string }> = [];
        if (classroom?.teacher_id) contacts.push({ id: classroom.teacher_id, name: teacherName });
        admins.forEach(admin => contacts.push({ id: admin.id, name: admin.name }));
        classmates.forEach(mate => contacts.push({ id: mate.id, name: mate.name }));
        return contacts;
    }, [admins, classmates, classroom?.teacher_id, teacherName]);

    const getNotificationContact = (notification: any) => {
        const title = String(notification.title || '').replace(/^New Message:\s*/i, '').trim().toLowerCase();
        return contactDirectory.find(contact => contact.name.toLowerCase() === title || contact.name.toLowerCase().includes(title) || title.includes(contact.name.toLowerCase()));
    };

    const getUnreadCountForContact = (contactId: string, contactName: string) => {
        return unreadMessageNotifications.filter(n => {
            if (n.type !== 'messages') return false;
            const contact = getNotificationContact(n);
            if (contact?.id) return contact.id === contactId;
            return String(n.title || '').toLowerCase().includes(contactName.toLowerCase());
        }).length;
    };

    const getUnreadCountForCategory = (catId: string) => {
        return unreadMessageNotifications.filter(n => {
            const b = broadcasts.find(bc => n.title === bc.subject || n.message === bc.content);
            if (!b) return false;
            if (catId === 'announcements') {
                return b.channel === 'announcements' || (!b.channel && b.sender?.role === 'admin');
            }
            if (catId === 'classroom') {
                return b.channel === 'classroom' || (!b.channel && b.sender?.role !== 'admin');
            }
            if (catId === 'custom_groups') return b.channel === 'custom_groups';
            if (catId === 'new_joiners') return b.channel === 'new_joiners';
            if (catId === 'fee_management') return b.channel === 'fee_management';
            if (catId === 'voice') return !!b.audio_attachment;
            return false;
        }).length;
    };

    const isBroadcastUnread = (b: any) => {
        if (isVideoOrBlogRelease(b)) return false;
        return notifications.some(n => 
            !n.is_read && 
            (n.type === 'reminder' || n.type === 'messages') &&
            (n.title === b.subject || n.message === b.content)
        );
    };

    // Filter broadcasts based on right panel search and selected category
    const filteredBroadcasts = useMemo(() => {
        let list = broadcasts.filter(b => {
            if (isVideoOrBlogRelease(b)) return false;

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
                if (b.channel !== 'fee_management' && !(b.subject && b.subject.toLowerCase().includes('fee'))) return false;
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

        // For Fee & Payments category, also append direct fee reminder messages & notifications if not already present
        if (selectedFeed.id === 'fee_management') {
            const feeDirectMsgs = directMessages.filter(m => 
                m.message_text && (
                    m.message_text.toLowerCase().includes('fee due reminder') ||
                    m.message_text.toLowerCase().includes('fee payment is due') ||
                    m.message_text.toLowerCase().includes('prepaid classes balance')
                )
            ).map(m => ({
                id: m.id,
                channel: 'fee_management',
                subject: 'Fee Due Billing Reminder',
                content: m.message_text,
                created_at: m.created_at,
                sender: { name: 'Academy Management', role: 'admin' }
            }));

            const feeNotifs = notifications.filter(n =>
                (n.type === 'fee_reminder' || n.type === 'fees' || String(n.title || '').toLowerCase().includes('fees due'))
            ).map(n => ({
                id: n.id,
                channel: 'fee_management',
                subject: n.title || 'Fee Due Billing Reminder',
                content: n.message,
                created_at: n.created_at,
                sender: { name: 'Academy Management', role: 'admin' }
            }));

            const combined = [...list, ...feeDirectMsgs, ...feeNotifs];
            const uniqueMap = new Map();
            combined.forEach(item => {
                const key = (item.content || '').trim();
                if (key && !uniqueMap.has(key)) {
                    uniqueMap.set(key, item);
                }
            });

            return Array.from(uniqueMap.values()).sort((a, b) => 
                new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
            );
        }

        return list;
    }, [broadcasts, selectedFeed, rightSearch, directMessages, notifications]);

    // Active direct messages for the selected chat partner
    const activeChatThread = useMemo(() => {
        if (selectedFeed.type !== 'chat' || !profile?.id) return [];
        return directMessages.filter(m => 
            (m.sender_id === profile.id && m.receiver_id === selectedFeed.id) ||
            (m.sender_id === selectedFeed.id && m.receiver_id === profile.id)
        );
    }, [directMessages, selectedFeed, profile]);

    const latestIncomingMessage = useMemo(() => {
        if (!profile?.id || selectedFeed.type !== 'chat') return null;
        return [...activeChatThread].reverse().find(m => m.sender_id === selectedFeed.id && m.receiver_id === profile.id) || null;
    }, [activeChatThread, profile?.id, selectedFeed]);

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
        <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-5 animate-in fade-in duration-300 min-h-[680px]">
            {/* Left Sidebar Pane: Categories & Contacts */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col h-[680px] text-left min-w-0">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <h3 className="font-extrabold text-slate-808 dark:text-white text-base mb-1">Message Center</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Announcements and direct chat</p>
                    </div>
                    {unreadMessageNotifications.length > 0 && (
                        <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full bg-amber-500 text-white text-[10px] font-black shadow-sm">
                            {unreadMessageNotifications.length}
                        </span>
                    )}
                </div>

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
                        <div className="space-y-1.5">
                            {categories.map((cat) => {
                                const Icon = cat.icon;
                                const active = selectedFeed.type === 'category' && selectedFeed.id === cat.id;
                                const unreadCount = getUnreadCountForCategory(cat.id);
                                const hasUnread = unreadCount > 0;
                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => {
                                            setSelectedFeed({ type: 'category', id: cat.id, name: cat.name });
                                            setRightSearch('');
                                        }}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left cursor-pointer ${
                                            active
                                                ? 'border-[#7C5E3F] bg-[#FAF5EE] text-[#7C5E3F] dark:border-amber-400 dark:bg-slate-800 dark:text-amber-400 shadow-2xs'
                                                : hasUnread
                                                    ? 'border-amber-300 bg-amber-50/30 text-[#7C5E3F] dark:border-amber-900/40 dark:bg-amber-950/10'
                                                    : 'border-slate-100/50 hover:border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-850/50 text-slate-700 dark:text-slate-300'
                                        }`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                                            active 
                                                ? 'bg-[#7C5E3F]/10 border-[#7C5E3F]/20 dark:bg-amber-400/10 dark:border-amber-400/20' 
                                                : hasUnread
                                                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:bg-amber-500/5 dark:border-amber-900/20'
                                                    : 'bg-slate-50 dark:bg-slate-800 border-slate-150 dark:border-slate-700'
                                        }`}>
                                            <Icon className="w-4.5 h-4.5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-1">
                                                <h4 className="font-extrabold text-xs leading-none">{cat.name}</h4>
                                                {unreadCount > 0 && (
                                                    <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-amber-500 text-white text-[8px] font-black shrink-0 leading-none">
                                                        {unreadCount}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[9px] text-slate-400 dark:text-slate-550 mt-1 truncate">{cat.desc}</p>
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
                        <div className="space-y-1.5">
                            {/* Mentor Contact (If student has an assigned mentor) */}
                            {mentorInfo && (() => {
                                const showMentorInSearch = leftSearch === '' || mentorInfo.name.toLowerCase().includes(leftSearch.toLowerCase());
                                if (!showMentorInSearch) return null;
                                const unreadCount = getUnreadCountForContact(mentorInfo.id, mentorInfo.name);
                                return (
                                    <button
                                        onClick={() => {
                                            setSelectedFeed({ type: 'chat', id: mentorInfo.id, name: mentorInfo.name });
                                            setRightSearch('');
                                        }}
                                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left cursor-pointer ${
                                            selectedFeed.type === 'chat' && selectedFeed.id === mentorInfo.id
                                                ? 'border-[#7C5E3F] bg-[#FAF5EE] text-[#7C5E3F] dark:border-amber-400 dark:bg-slate-800 dark:text-amber-400 shadow-2xs'
                                                : unreadCount > 0
                                                    ? 'border-amber-300 bg-amber-50/30 text-[#7C5E3F] dark:border-amber-900/40 dark:bg-amber-950/10'
                                                    : 'border-amber-200/60 bg-amber-50/30 dark:border-amber-900/30 hover:bg-amber-50/70 text-slate-700 dark:text-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center border border-amber-500/30 shrink-0 font-extrabold text-xs">
                                                {mentorInfo.profile_pic_url ? (
                                                    <img src={mentorInfo.profile_pic_url} alt={mentorInfo.name} className="w-full h-full object-cover rounded-lg" />
                                                ) : (
                                                    mentorInfo.name.charAt(0)
                                                )}
                                            </div>
                                            <div className="min-w-0 text-left">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <h4 className="font-extrabold text-xs leading-none">{mentorInfo.name}</h4>
                                                    <span className="text-[7.5px] font-black bg-amber-600 text-white px-1.5 py-0.2 rounded uppercase tracking-wider shrink-0">Your Mentor</span>
                                                </div>
                                                <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 truncate">{mentorInfo.email}</p>
                                            </div>
                                        </div>
                                        {unreadCount > 0 ? (
                                            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-amber-500 text-white text-[9px] font-black shrink-0">{unreadCount}</span>
                                        ) : (
                                            <MessageSquare className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                        )}
                                    </button>
                                );
                            })()}

                            {/* Mentees Contacts (If logged-in user is a mentor) */}
                            {mentees.length > 0 && mentees.map((mentee) => {
                                const showMenteeInSearch = leftSearch === '' || mentee.name.toLowerCase().includes(leftSearch.toLowerCase());
                                if (!showMenteeInSearch) return null;
                                const unreadCount = getUnreadCountForContact(mentee.student_id, mentee.name);
                                const active = selectedFeed.type === 'chat' && selectedFeed.id === mentee.student_id;

                                return (
                                    <button
                                        key={mentee.id}
                                        onClick={() => {
                                            setSelectedFeed({ type: 'chat', id: mentee.student_id, name: mentee.name });
                                            setRightSearch('');
                                        }}
                                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left cursor-pointer ${
                                            active
                                                ? 'border-[#7C5E3F] bg-[#FAF5EE] text-[#7C5E3F] dark:border-amber-400 dark:bg-slate-800 dark:text-amber-400 shadow-2xs'
                                                : unreadCount > 0
                                                    ? 'border-amber-300 bg-amber-50/30 text-[#7C5E3F] dark:border-amber-900/40 dark:bg-amber-950/10'
                                                    : 'border-slate-100/50 hover:border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-850/50 text-slate-700 dark:text-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-500/20 shrink-0 font-extrabold text-xs">
                                                {mentee.profile_pic_url ? (
                                                    <img src={mentee.profile_pic_url} alt={mentee.name} className="w-full h-full object-cover rounded-lg" />
                                                ) : (
                                                    mentee.name.charAt(0)
                                                )}
                                            </div>
                                            <div className="min-w-0 text-left">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <h4 className="font-extrabold text-xs leading-none">{mentee.name}</h4>
                                                    <span className="text-[7.5px] font-black bg-blue-600 text-white px-1.5 py-0.2 rounded uppercase tracking-wider shrink-0">Mentee</span>
                                                </div>
                                                <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 truncate">{mentee.email}</p>
                                            </div>
                                        </div>
                                        {unreadCount > 0 ? (
                                            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-amber-500 text-white text-[9px] font-black shrink-0">{unreadCount}</span>
                                        ) : (
                                            <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        )}
                                    </button>
                                );
                            })}

                            {/* Teacher Contact */}
                            {classroom?.teacher_id && showTeacherInSearch && (() => {
                                const unreadCount = getUnreadCountForContact(classroom.teacher_id!, teacherName);
                                return (
                                <button
                                    onClick={() => {
                                        setSelectedFeed({ type: 'chat', id: classroom.teacher_id!, name: teacherName });
                                        setRightSearch('');
                                    }}
                                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left cursor-pointer ${
                                        selectedFeed.type === 'chat' && selectedFeed.id === classroom.teacher_id
                                            ? 'border-[#7C5E3F] bg-[#FAF5EE] text-[#7C5E3F] dark:border-amber-400 dark:bg-slate-800 dark:text-amber-400 shadow-2xs'
                                            : unreadCount > 0
                                                ? 'border-amber-300 bg-amber-50/30 text-[#7C5E3F] dark:border-amber-900/40 dark:bg-amber-950/10'
                                                : 'border-slate-100/50 hover:border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-850/50 text-slate-700 dark:text-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-[#ecb613] shrink-0 font-extrabold">
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
                                    {unreadCount > 0 ? (
                                        <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-amber-500 text-white text-[9px] font-black shrink-0">{unreadCount}</span>
                                    ) : (
                                        <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    )}
                                </button>
                                );
                            })()}

                             {/* Admin Contacts */}
                             {admins.length > 0 && (
                                 <>
                                     {admins.map((admin) => {
                                         const active = selectedFeed.type === 'chat' && selectedFeed.id === admin.id;
                                         const showAdminInSearch = leftSearch === '' || admin.name.toLowerCase().includes(leftSearch.toLowerCase());
                                         if (!showAdminInSearch) return null;
                                         const unreadCount = getUnreadCountForContact(admin.id, admin.name);
                                         return (
                                             <button
                                                 key={admin.id}
                                                 onClick={() => {
                                                     setSelectedFeed({ type: 'chat', id: admin.id, name: admin.name });
                                                     setRightSearch('');
                                                 }}
                                                 className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left cursor-pointer ${
                                                     active
                                                         ? 'border-[#7C5E3F] bg-[#FAF5EE] text-[#7C5E3F] dark:border-amber-400 dark:bg-slate-800 dark:text-amber-400 shadow-2xs'
                                                         : unreadCount > 0
                                                             ? 'border-amber-300 bg-amber-50/30 text-rose-600 dark:border-amber-900/40 dark:bg-amber-950/10'
                                                             : 'border-slate-100/50 hover:border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-850/50 text-slate-700 dark:text-slate-300'
                                                 }`}
                                             >
                                                 <div className="flex items-center gap-3 min-w-0">
                                                     <div className="w-9 h-9 rounded-lg bg-rose-500/10 flex items-center justify-center border border-rose-500/20 text-rose-500 shrink-0 font-extrabold text-xs">
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
                                                 {unreadCount > 0 ? (
                                                     <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[9px] font-black shrink-0">{unreadCount}</span>
                                                 ) : (
                                                     <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                 )}
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
                                    const unreadCount = getUnreadCountForContact(mate.id, mate.name);
                                    return (
                                        <button
                                            key={mate.id}
                                            onClick={() => {
                                                setSelectedFeed({ type: 'chat', id: mate.id, name: mate.name });
                                                setRightSearch('');
                                            }}
                                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left cursor-pointer ${
                                                active
                                                    ? 'border-[#7C5E3F] bg-[#FAF5EE] text-[#7C5E3F] dark:border-amber-400 dark:bg-slate-800 dark:text-amber-400 shadow-2xs'
                                                    : unreadCount > 0
                                                        ? 'border-amber-300 bg-amber-50/30 text-[#7C5E3F] dark:border-amber-900/40 dark:bg-amber-950/10'
                                                        : 'border-slate-100/50 hover:border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-850/50 text-slate-700 dark:text-slate-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-750 font-extrabold text-slate-500 text-xs">
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
                                            {unreadCount > 0 ? (
                                                <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-slate-700 text-white text-[9px] font-black shrink-0">{unreadCount}</span>
                                            ) : (
                                                <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel: Content View Area (Broadcasts list or Chat window) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col h-[680px] text-left min-w-0">
                {/* Header with Search */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-3 flex-shrink-0">
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

                <div className="flex-shrink-0 mb-4">
                    {unreadMessageNotifications.length > 0 ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/80 dark:bg-amber-950/20 dark:border-amber-900/40 p-3">
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Bell className="w-4 h-4 text-amber-600 shrink-0" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">Incoming message alerts</span>
                                </div>
                                <span className="text-[10px] font-black text-amber-700 dark:text-amber-300 shrink-0">{unreadMessageNotifications.length} unread</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {unreadMessageNotifications.slice(0, 4).map((notif) => {
                                    const contact = getNotificationContact(notif);
                                    return (
                                        <button
                                            key={notif.id}
                                            type="button"
                                            onClick={() => {
                                                const matchingBroadcast = broadcasts.find(b => notif.title === b.subject || notif.message === b.content);
                                                if (matchingBroadcast) {
                                                    let feedId = 'announcements';
                                                    let feedName = 'Announcements';
                                                    if (matchingBroadcast.channel === 'custom_groups') {
                                                        feedId = 'custom_groups';
                                                        feedName = 'Group Announcements';
                                                    } else if (matchingBroadcast.channel === 'classroom' || (!matchingBroadcast.channel && matchingBroadcast.sender?.role !== 'admin')) {
                                                        feedId = 'classroom';
                                                        feedName = 'Class Announcements';
                                                    } else if (matchingBroadcast.channel === 'new_joiners') {
                                                        feedId = 'new_joiners';
                                                        feedName = 'New Joiners Notices';
                                                    } else if (matchingBroadcast.channel === 'fee_management') {
                                                        feedId = 'fee_management';
                                                        feedName = 'Fee & Payments';
                                                    } else if (matchingBroadcast.channel === 'voice') {
                                                        feedId = 'voice';
                                                        feedName = 'Voice Notes & Tones';
                                                    }

                                                    setSelectedFeed({ type: 'category', id: feedId, name: feedName });
                                                    setRightSearch(matchingBroadcast.subject);
                                                    return;
                                                }

                                                const contact = getNotificationContact(notif);
                                                if (contact) {
                                                    setSelectedFeed({ type: 'chat', id: contact.id, name: contact.name });
                                                    setRightSearch('');
                                                }
                                            }}
                                            className="min-w-0 text-left rounded-lg border border-amber-200/70 bg-white/70 dark:bg-slate-900/60 dark:border-amber-900/40 p-2.5 hover:bg-white dark:hover:bg-slate-900 transition-colors cursor-pointer"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate">{notif.title}</span>
                                                <span className="text-[9px] font-bold text-amber-600 shrink-0">{new Date(notif.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{stripHtml(notif.message)}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/20 px-3 py-2.5 flex items-center gap-2">
                            <Inbox className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">No unread message alerts right now.</span>
                        </div>
                    )}
                </div>

                {/* Main View Area */}
                {selectedFeed.type === 'category' ? (
                    /* CATEGORY BROADCASTS VIEW */
                    <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar min-h-0">
                        {filteredBroadcasts.length === 0 ? (
                            <div className="py-20 border border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-center bg-slate-50/50 dark:bg-slate-950/10">
                                <Mail className="w-10 h-10 text-slate-350 mx-auto mb-2 animate-pulse" />
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No announcements found.</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">Try changing your filters or search keywords.</p>
                            </div>
                        ) : (
                            filteredBroadcasts.map((b) => {
                                const isAdmin = b.sender?.role === 'admin';
                                const isUnread = isBroadcastUnread(b);
                                return (
                                    <div 
                                        key={b.id} 
                                        className={`transition-all p-4 rounded-xl border text-left flex flex-col gap-3 relative ${
                                            isUnread
                                                ? 'bg-amber-50/60 dark:bg-amber-950/10 border-amber-400 dark:border-amber-800 shadow-md ring-2 ring-amber-400/20'
                                                : isAdmin 
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
                                                    {isUnread && (
                                                        <span className="inline-flex items-center gap-1 text-[7.5px] font-black text-white bg-amber-500 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 animate-pulse">New</span>
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

                                        <div 
                                            className="text-xs text-slate-655 dark:text-slate-350 leading-relaxed overflow-x-auto"
                                            dangerouslySetInnerHTML={{ __html: b.content }}
                                        />

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
                        {latestIncomingMessage && (
                            <div className="mb-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/20 p-3 flex items-start gap-2.5 flex-shrink-0">
                                <MessageSquare className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Latest incoming</span>
                                        <span className="text-[9px] font-bold text-slate-400">{new Date(latestIncomingMessage.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 line-clamp-2 break-words">{latestIncomingMessage.message_text}</p>
                                </div>
                            </div>
                        )}

                        {/* Messages Thread Bubbles */}
                        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 py-1 custom-scrollbar text-left flex flex-col min-h-0">
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
                                    const isUnread = !isMe && msg.status !== 'read';
                                    return (
                                        <div 
                                            key={msg.id} 
                                            className={`max-w-[78%] p-3.5 rounded-2xl text-xs leading-relaxed break-words relative transition-all duration-300 ${
                                                isMe 
                                                    ? 'bg-[#7C5E3F] text-white self-end rounded-br-none shadow-2xs' 
                                                    : isUnread
                                                        ? 'bg-amber-50/80 dark:bg-amber-955/20 text-[#7C5E3F] dark:text-amber-300 self-start rounded-bl-none border border-amber-400 dark:border-amber-800 shadow-md ring-2 ring-amber-400/10'
                                                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 self-start rounded-bl-none border border-slate-100 dark:border-slate-750'
                                            }`}
                                        >
                                            <p className="whitespace-pre-wrap text-left select-text">{msg.message_text}</p>
                                            <div className="flex justify-end items-center gap-1 mt-1">
                                                {isUnread && (
                                                    <span className="text-[7.5px] font-black uppercase text-amber-600 dark:text-amber-450 mr-1 animate-pulse">New</span>
                                                )}
                                                <span className={`text-[8px] font-medium ${isMe ? 'text-amber-50/60' : 'text-slate-400'}`}>
                                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                {isMe && (
                                                    msg.status === 'read' ? (
                                                        <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] shrink-0" />
                                                    ) : msg.status === 'delivered' ? (
                                                        <CheckCheck className="w-3.5 h-3.5 text-[#8696a0] shrink-0" />
                                                    ) : (
                                                        <Check className="w-3.5 h-3.5 text-[#8696a0] shrink-0" />
                                                    )
                                                )}
                                            </div>
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
