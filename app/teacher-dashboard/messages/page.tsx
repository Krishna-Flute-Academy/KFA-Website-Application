'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import TeacherSidebar from '../../../src/components/TeacherSidebar';
import { 
    Loader2, Search, Megaphone, Sparkles, CreditCard, Users, 
    Presentation, Bell, HelpCircle, Send, FileText, Clock, 
    Calendar, Check, Copy, Mic, Plus, Info, X, ChevronRight, Globe
} from 'lucide-react';

interface Broadcast {
    id: string;
    channel: string;
    recipients: Array<{ id: string; name: string; type: 'class' | 'student' | 'global' | 'custom' }>;
    subject: string;
    content: string;
    created_at: string;
}

const QUICK_TEMPLATES = [
    {
        id: 'welcome',
        name: 'Welcome Kit',
        icon: FileText,
        subject: 'Welcome to Krishna Flute Academy! 🎶',
        content: 'Welcome to KFA! We are thrilled to have you join our flute family. We have unlocked your first dynamic module: Fingering Basics. Let\'s begin this wonderful musical journey together!'
    },
    {
        id: 'fee',
        name: 'Monthly Fee Reminder',
        icon: Clock,
        subject: 'Tuition Fee Invoice Ready 💳',
        content: 'Hi there, this is a gentle reminder that your tuition fee invoice for this month is ready for processing. Please check your billing dashboard to make a payment and avoid class disruptions.'
    },
    {
        id: 'cancel',
        name: 'Class Cancellation',
        icon: Calendar,
        subject: 'Reschedule Notice: Saturday Flute Masterclass ⚠️',
        content: 'Important update: Please note that our scheduled Saturday morning flute classes have been rescheduled to Sunday at the same time due to instructor travel. We apologize for the inconvenience!'
    }
];

const INITIAL_MOCK_BROADCASTS: Broadcast[] = [
    {
        id: 'mock-1',
        channel: 'announcements',
        recipients: [{ id: 'all', name: 'All Students (Global)', type: 'global' }],
        subject: 'New Raag Bhairav Study Material',
        content: 'Hi students, I have uploaded a new interactive play-along video and reference sheet music for Raag Bhairav under the Inventory Library. Please practice the basic Aaroh and Avroh transitions this week!',
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() // 2 hours ago
    },
    {
        id: 'mock-2',
        channel: 'classroom',
        recipients: [{ id: 'class-1', name: 'All Beginners (A1)', type: 'class' }],
        subject: 'Alankars Mastery Homework Assignment',
        content: 'Hello Section A1, your new checklist for Alankars Mastery is active. Please log in to your portal, practice the double-note movements, and mark your topic task as complete before our next live session!',
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString() // 3 days ago
    },
    {
        id: 'mock-3',
        channel: 'new_joiners',
        recipients: [{ id: 'newbies', name: 'New Joiners (May)', type: 'custom' }],
        subject: 'Breath Control Basics & Warm-up Routine',
        content: 'A warm welcome to our newest flute joiners! Please watch the Breath Control II guided video in your portal as your starting sequence. Consistency is key!',
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString() // 6 days ago
    }
];

export default function MessagesDashboardPage() {
    const router = useRouter();

    // ── Global states ──────────────────────────────────────────────────────────
    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string } | null>(null);
    const [dbSetupError, setDbSetupError] = useState(false);
    const [dbChecking, setDbChecking] = useState(true);
    const [sqlCopied, setSqlCopied] = useState(false);

    // Live Database Lists (Roster & Classrooms)
    const [classrooms, setClassrooms] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);

    // ── Broadcast states ───────────────────────────────────────────────────────
    const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
    const [activeChannel, setActiveChannel] = useState<string>('announcements'); // announcements, classroom, custom_groups, new_joiners, fee_management
    
    // Compose Form
    const [selectedRecipients, setSelectedRecipients] = useState<Array<{ id: string; name: string; type: 'class' | 'student' | 'global' | 'custom' }>>([]);
    const [subject, setSubject] = useState('');
    const [content, setContent] = useState('');
    const [isSending, setIsSending] = useState(false);

    // Recipients Modal Selection
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalTab, setModalTab] = useState<'class' | 'student'>('class');
    const [modalSearchQuery, setModalSearchQuery] = useState('');
    const [tempSelectedTargets, setTempSelectedTargets] = useState<string[]>([]); // list of target IDs

    // Logs Search
    const [searchQuery, setSearchQuery] = useState('');

    // ── Auth & Data Loading ────────────────────────────────────────────────────
    useEffect(() => {
        const checkAuthAndLoad = async () => {
            setLoading(true);
            try {
                // 1. Authenticate Teacher
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (!session) {
                    router.push('/login?type=teacher');
                    return;
                }

                const { data: profile } = await supabaseAuth
                    .from('users')
                    .select('id, name, email')
                    .eq('id', session.user.id)
                    .single();
                setTeacherProfile(profile);

                if (!profile) return;

                // 2. Pre-fetch Classrooms and Students for recipients modal
                const { data: rooms } = await supabaseAuth
                    .from('classrooms')
                    .select('id, name')
                    .eq('teacher_id', profile.id);
                setClassrooms(rooms || []);

                const { data: roster } = await supabaseAuth
                    .from('classroom_students')
                    .select(`
                        id,
                        student_id,
                        users!student_id(name)
                    `);
                
                const uniqueStudents = Array.from(
                    new Map((roster || []).map((r: any) => [r.student_id, { id: r.student_id, name: r.users?.name || 'Unknown' }])).values()
                );
                setStudents(uniqueStudents);

                // 3. Test/Query Broadcasts Table
                try {
                    const { data: dbBroadcasts, error: bError } = await supabaseAuth
                        .from('broadcasts')
                        .select('*')
                        .order('created_at', { ascending: false });

                    if (bError) {
                        console.warn('[Messages] Broadcasts table check failed:', bError.message);
                        if (bError.code === '42P01' || bError.code === 'PGRST205' || bError.message?.includes('schema cache') || bError.message?.includes('does not exist')) {
                            setDbSetupError(true);
                        }
                        // Load from cache or fallback
                        const local = localStorage.getItem('kfa_local_broadcasts');
                        setBroadcasts(local ? JSON.parse(local) : INITIAL_MOCK_BROADCASTS);
                    } else {
                        setBroadcasts(dbBroadcasts || []);
                        setDbSetupError(false);
                    }
                } catch (pe) {
                    console.warn('[Messages] Exception querying broadcasts:', pe);
                    const local = localStorage.getItem('kfa_local_broadcasts');
                    setBroadcasts(local ? JSON.parse(local) : INITIAL_MOCK_BROADCASTS);
                }

            } catch (err) {
                console.error('Error during initial portal load:', err);
            } finally {
                setLoading(false);
                setDbChecking(false);
            }
        };

        checkAuthAndLoad();
    }, [router]);

    // Logout Helper
    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/login?type=teacher');
    };

    // ── Save Broadcast Handler ─────────────────────────────────────────────────
    const handleSendBroadcast = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!teacherProfile || isSending) return;

        if (selectedRecipients.length === 0) {
            alert('Please select at least one recipient/target audience first!');
            return;
        }
        if (!subject.trim()) {
            alert('Please specify a broadcast subject!');
            return;
        }
        if (!content.trim()) {
            alert('Please compose your broadcast message!');
            return;
        }

        setIsSending(true);

        const newBroadcast = {
            teacher_id: teacherProfile.id,
            channel: activeChannel,
            recipients: selectedRecipients,
            subject: subject.trim(),
            content: content.trim(),
            created_at: new Date().toISOString()
        };

        try {
            if (dbSetupError) {
                // local fallback save
                const localList = [
                    { id: `local-${Date.now()}`, ...newBroadcast },
                    ...broadcasts
                ];
                setBroadcasts(localList);
                localStorage.setItem('kfa_local_broadcasts', JSON.stringify(localList));
                alert('Broadcast broadcasted in-memory and cached locally!');
                
                // Clear Composer Form
                setSubject('');
                setContent('');
                setSelectedRecipients([]);
            } else {
                // Supabase insert
                const { data, error } = await supabaseAuth
                    .from('broadcasts')
                    .insert(newBroadcast)
                    .select('*');

                if (error) {
                    console.error('Database write error:', error);
                    alert(`Failed to save to database. Broadcasting in-memory: ${error.message}`);
                    const localList = [
                        { id: `local-${Date.now()}`, ...newBroadcast },
                        ...broadcasts
                    ];
                    setBroadcasts(localList);
                    localStorage.setItem('kfa_local_broadcasts', JSON.stringify(localList));
                } else {
                    setBroadcasts(prev => [data[0], ...prev]);
                    alert('Broadcast sent & saved to database successfully!');
                }

                // Clear Composer Form
                setSubject('');
                setContent('');
                setSelectedRecipients([]);
            }
        } catch (err: any) {
            console.error('Exception during broadcast save:', err);
            alert('An unexpected issue occurred while sending.');
        } finally {
            setIsSending(false);
        }
    };

    // ── Quick Templates Click Handler ──────────────────────────────────────────
    const handleApplyTemplate = (tpl: typeof QUICK_TEMPLATES[0]) => {
        setSubject(tpl.subject);
        setContent(tpl.content);
    };

    // ── Recipients Selection Modal Controls ────────────────────────────────────
    const openRecipientsModal = () => {
        // Hydrate initial checked targets
        setTempSelectedTargets(selectedRecipients.map(r => r.id));
        setModalSearchQuery('');
        setIsModalOpen(true);
    };

    const toggleTargetSelection = (id: string) => {
        setTempSelectedTargets(prev => {
            if (prev.includes(id)) {
                return prev.filter(t => t !== id);
            }
            return [...prev, id];
        });
    };

    const applySelectedRecipients = () => {
        const newSelection: Array<{ id: string; name: string; type: 'class' | 'student' | 'global' | 'custom' }> = [];

        tempSelectedTargets.forEach(id => {
            if (id === 'global') {
                newSelection.push({ id: 'global', name: 'All Students (Global)', type: 'global' });
            } else {
                const roomMatch = classrooms.find(r => r.id === id);
                if (roomMatch) {
                    newSelection.push({ id: roomMatch.id, name: roomMatch.name, type: 'class' });
                } else {
                    const studentMatch = students.find(s => s.id === id);
                    if (studentMatch) {
                        newSelection.push({ id: studentMatch.id, name: studentMatch.name, type: 'student' });
                    }
                }
            }
        });

        setSelectedRecipients(newSelection);
        setIsModalOpen(false);
    };

    const removeRecipientChip = (id: string) => {
        setSelectedRecipients(prev => prev.filter(r => r.id !== id));
    };

    // ── Search & Filter Broadcast Logs ─────────────────────────────────────────
    const filteredBroadcasts = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return broadcasts;

        return broadcasts.filter(b => {
            const matchesSubject = b.subject.toLowerCase().includes(query);
            const matchesContent = b.content.toLowerCase().includes(query);
            const matchesRecipient = b.recipients.some(r => r.name.toLowerCase().includes(query));
            return matchesSubject || matchesContent || matchesRecipient;
        });
    }, [broadcasts, searchQuery]);

    // ── Copy SQL Code Block Helper ──────────────────────────────────────────────
    const handleCopySQL = () => {
        const sql = `CREATE TABLE IF NOT EXISTS public.broadcasts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'announcements',
  recipients JSONB NOT NULL DEFAULT '[]',
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all broadcasts" ON public.broadcasts;
CREATE POLICY "Allow all broadcasts" ON public.broadcasts FOR ALL USING (true) WITH CHECK (true);`;
        
        navigator.clipboard.writeText(sql);
        setSqlCopied(true);
        setTimeout(() => setSqlCopied(false), 3000);
    };

    // Filter recipients for the Modal dialog listing based on active search
    const filteredModalItems = useMemo(() => {
        const query = modalSearchQuery.toLowerCase().trim();
        if (modalTab === 'class') {
            return classrooms.filter(c => c.name.toLowerCase().includes(query));
        } else {
            return students.filter(s => s.name.toLowerCase().includes(query));
        }
    }, [classrooms, students, modalTab, modalSearchQuery]);

    if (loading) {
        return (
            <div className="flex h-screen w-screen bg-[#faf8f5] items-center justify-center">
                <div className="text-center flex flex-col items-center">
                    <Loader2 className="animate-spin text-[#0e5f59] w-10 h-10 mb-4" />
                    <p className="font-semibold text-slate-600 tracking-wider text-sm uppercase">Loading Messages Workspace...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex bg-[#faf8f5] min-h-screen text-stone-850 select-none">
            {/* Sidebar Navigation */}
            <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

            {/* Main Application Window */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Modern Workspace Header */}
                <header className="px-8 py-5 border-b border-stone-200 bg-white flex justify-between items-center shrink-0">
                    <div className="relative w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4.5 h-4.5" />
                        <input 
                            className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200/80 rounded-full text-xs outline-none focus:ring-1 focus:ring-[#0e5f59] transition-all placeholder:text-stone-400" 
                            placeholder="Search messages, students, or broadcasts..." 
                            type="text" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-6">
                        <button className="text-stone-500 hover:text-[#0e5f59] transition-colors relative">
                            <Bell className="w-5 h-5" />
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full"></span>
                        </button>
                        <button className="text-stone-500 hover:text-[#0e5f59] transition-colors">
                            <HelpCircle className="w-5 h-5" />
                        </button>
                        
                        <div className="flex items-center gap-2 border-l border-stone-200 pl-6 select-none">
                            <span className="text-xs font-bold text-stone-800 tracking-wide text-right">
                                {teacherProfile?.name || 'Guruji Krishna'}
                                <span className="block text-[9px] font-semibold text-stone-400 uppercase tracking-widest mt-0.5">Master Instructor</span>
                            </span>
                            <div className="size-8.5 rounded-full overflow-hidden border border-stone-200 shadow-xs">
                                <img 
                                    src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80" 
                                    alt="Guruji" 
                                    className="w-full h-full object-cover" 
                                />
                            </div>
                        </div>
                    </div>
                </header>

                {/* Sub-body workspace flow */}
                <div className="flex-1 overflow-y-auto px-8 py-8 flex flex-col gap-8 bg-[#faf8f5]">
                    
                    {/* Database Setup Banner Warning */}
                    {dbSetupError && (
                        <div className="bg-rose-50 border border-rose-200/80 p-5 rounded-2xl flex flex-col gap-4 shadow-sm select-text">
                            <div className="flex gap-3">
                                <Info className="text-rose-500 w-5 h-5 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="text-sm font-extrabold text-rose-900">Broadcasts Table Not Found in Supabase</h4>
                                    <p className="text-xs text-rose-700 font-medium leading-relaxed mt-1">
                                        The <code className="font-mono bg-rose-100 px-1 rounded">broadcasts</code> table doesn't exist yet in your <strong>auth Supabase project</strong> (<code>sevtycwrmhzyfxvxkkgc</code>). 
                                        To enable permanent backend storage for sent messages, open your Supabase SQL Editor and run the script below.
                                    </p>
                                </div>
                            </div>
                            <div className="relative">
                                <pre className="text-[10px] font-mono bg-rose-950/5 text-rose-800 p-4 rounded-xl max-h-32 overflow-y-auto border border-rose-200/60 leading-relaxed">
{`CREATE TABLE IF NOT EXISTS public.broadcasts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'announcements',
  recipients JSONB NOT NULL DEFAULT '[]',
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all broadcasts" ON public.broadcasts FOR ALL USING (true) WITH CHECK (true);`}
                                </pre>
                                <button 
                                    onClick={handleCopySQL}
                                    className="absolute right-3 top-3 px-3 py-1.5 bg-rose-900/10 hover:bg-rose-900/20 text-rose-800 text-[10px] font-bold rounded-lg border border-rose-300 transition-all flex items-center gap-1.5"
                                >
                                    {sqlCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                    {sqlCopied ? 'Copied!' : 'Copy SQL'}
                                </button>
                            </div>
                            <p className="text-[10px] font-semibold text-rose-600 uppercase tracking-widest">
                                💡 App is safely running in local fallback mode. Messages will be preserved temporarily in localStorage.
                            </p>
                        </div>
                    )}

                    {/* Left & Right messaging portal division */}
                    <div className="grid grid-cols-12 gap-8 items-start shrink-0">
                        {/* Channel selector panel (Col-span 4) */}
                        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                            <div className="bg-white p-5 rounded-2xl shadow-xs border border-stone-200/60">
                                <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest">Message Channels</span>
                                <div className="space-y-2 mt-4">
                                    {[
                                        { id: 'announcements', label: 'Announcements', desc: 'Global Broadcast', icon: Megaphone, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/20' },
                                        { id: 'classroom', label: 'Classroom Broadcast', desc: 'Section-wise targets', icon: Presentation, color: 'text-blue-500 bg-blue-50' },
                                        { id: 'custom_groups', label: 'Custom Groups', desc: 'Performers, Beginners...', icon: Users, color: 'text-indigo-500 bg-indigo-50' },
                                        { id: 'new_joiners', label: 'New Joiners', desc: 'Automated workflows', icon: Sparkles, color: 'text-emerald-500 bg-emerald-50' },
                                        { id: 'fee_management', label: 'Fee Management', desc: 'Reminders & Receipts', icon: CreditCard, color: 'text-rose-500 bg-rose-50' },
                                    ].map((channel) => {
                                        const isSelected = activeChannel === channel.id;
                                        return (
                                            <button 
                                                key={channel.id}
                                                onClick={() => {
                                                    setActiveChannel(channel.id);
                                                    setSelectedRecipients([]);
                                                }}
                                                className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all border text-left ${
                                                    isSelected 
                                                        ? 'bg-stone-50 border-stone-200 shadow-sm ring-1 ring-stone-150' 
                                                        : 'bg-white border-transparent hover:bg-stone-50/50'
                                                }`}
                                            >
                                                <div className={`p-2.5 rounded-lg shrink-0 ${channel.color}`}>
                                                    <channel.icon className="w-5 h-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h5 className="text-xs font-bold text-stone-800">{channel.label}</h5>
                                                    <p className="text-[10px] text-stone-400 font-medium mt-0.5">{channel.desc}</p>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-stone-300 ml-auto shrink-0" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Insight card */}
                            <div className="bg-[#eef2f6]/60 border border-blue-100 p-5 rounded-2xl shadow-2xs select-none">
                                <h6 className="text-[10px] font-extrabold text-[#0e5f59] uppercase tracking-widest">Weekly Insight</h6>
                                <p className="text-xs font-semibold leading-relaxed text-slate-600 mt-2">
                                    Engagement is up 24% this week. Keep sending classroom updates! Daily play-along clicks have reached an all-time high of 420 lessons!
                                </p>
                            </div>
                        </div>

                        {/* Broadcast composer workspace (Col-span 8) */}
                        <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
                            <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest">Messaging Workspace</span>
                            
                            {/* Main Composer Form */}
                            <form onSubmit={handleSendBroadcast} className="bg-white p-6 rounded-2xl border border-stone-200/60 shadow-xs flex flex-col gap-6">
                                <div className="flex justify-between items-center border-b border-stone-100 pb-4">
                                    <div>
                                        <h2 className="text-lg font-bold text-stone-900">Enhanced Broadcast</h2>
                                        <p className="text-xs text-stone-400 mt-0.5">Targeted content distribution console</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button 
                                            type="button" 
                                            className="px-4 py-2 hover:bg-stone-50 border border-stone-200 text-stone-600 text-xs font-bold rounded-full transition-all"
                                        >
                                            View Analytics
                                        </button>
                                        <button 
                                            type="submit" 
                                            disabled={isSending}
                                            className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-full transition-all flex items-center gap-2 shadow-sm disabled:bg-stone-300 disabled:cursor-not-allowed"
                                        >
                                            {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                            Send Broadcast
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-12 gap-6 items-start">
                                    {/* Left inputs column: recipients & templates */}
                                    <div className="col-span-12 md:col-span-5 flex flex-col gap-5 border-r border-stone-100/80 pr-4">
                                        {/* Recipients list block */}
                                        <div className="space-y-2.5">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Recipients</span>
                                            
                                            {/* Pills view */}
                                            <div className="flex flex-wrap gap-2">
                                                {selectedRecipients.map((rec) => (
                                                    <span 
                                                        key={rec.id} 
                                                        className="px-2.5 py-1 bg-amber-50 text-[#b45309] text-[10px] font-bold rounded-full border border-amber-200/80 flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150"
                                                    >
                                                        {rec.name}
                                                        <button 
                                                            type="button" 
                                                            onClick={() => removeRecipientChip(rec.id)}
                                                            className="hover:bg-amber-200/40 p-0.5 rounded-full"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                                
                                                <button 
                                                    type="button" 
                                                    onClick={openRecipientsModal}
                                                    className="px-3 py-1 bg-white hover:bg-stone-50 border border-dashed border-stone-300 text-stone-500 hover:text-[#0e5f59] text-[10px] font-bold rounded-full transition-all flex items-center gap-1"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                    Add Classes/Tags
                                                </button>
                                            </div>
                                        </div>

                                        {/* Quick Templates block */}
                                        <div className="space-y-2.5 pt-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Quick Templates</span>
                                            <div className="space-y-2">
                                                {QUICK_TEMPLATES.map((tpl) => {
                                                    const IconComponent = tpl.icon;
                                                    return (
                                                        <button 
                                                            key={tpl.id} 
                                                            type="button" 
                                                            onClick={() => handleApplyTemplate(tpl)}
                                                            className="w-full flex items-center gap-3 p-2.5 bg-white hover:bg-stone-50 rounded-xl border border-stone-200 hover:border-stone-300 transition-all text-left group"
                                                        >
                                                            <div className="p-1.5 bg-stone-100 group-hover:bg-[#0e5f59]/10 rounded-lg text-stone-600 group-hover:text-[#0e5f59] transition-colors shrink-0">
                                                                <IconComponent className="w-4 h-4" />
                                                            </div>
                                                            <span className="text-[11px] font-bold text-stone-700">{tpl.name}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right inputs column: subject & body content editor */}
                                    <div className="col-span-12 md:col-span-7 flex flex-col gap-4">
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Broadcast Subject</label>
                                            <input 
                                                className="px-4 py-2 border border-stone-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-[#0e5f59] font-semibold text-stone-800 bg-white placeholder:text-stone-300"
                                                placeholder="e.g. Important Update: New Practice Schedule" 
                                                type="text" 
                                                value={subject}
                                                onChange={(e) => setSubject(e.target.value)}
                                            />
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Message Content</label>
                                            <div className="border border-stone-200 rounded-xl overflow-hidden flex flex-col bg-white">
                                                {/* Mock Editor Toolbar */}
                                                <div className="px-3 py-2 bg-stone-50 border-b border-stone-150 flex gap-4 text-stone-400 text-xs select-none">
                                                    <span className="font-bold cursor-pointer hover:text-stone-800">B</span>
                                                    <span className="italic cursor-pointer hover:text-stone-800 font-serif">I</span>
                                                    <span className="cursor-pointer hover:text-stone-800">List</span>
                                                    <span className="cursor-pointer hover:text-stone-800">Link</span>
                                                    <span className="cursor-pointer hover:text-stone-800">Img</span>
                                                </div>
                                                <textarea 
                                                    className="p-4 text-xs font-semibold leading-relaxed text-stone-700 placeholder:text-stone-350 resize-none h-44 outline-none border-none bg-white" 
                                                    placeholder="Write your message here. You can use @name to personalize..."
                                                    value={content}
                                                    onChange={(e) => setContent(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Bottom Recent Broadcasts log section */}
                    <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-center border-b border-stone-200/80 pb-3">
                            <h3 className="text-base font-extrabold text-stone-900">Recent Broadcasts</h3>
                            <button 
                                onClick={() => alert('Viewing complete message logs history...')}
                                className="text-amber-600 hover:text-amber-700 text-xs font-bold transition-colors"
                            >
                                View All History
                            </button>
                        </div>

                        <div className="grid grid-cols-12 gap-8 items-start select-text">
                            {/* Broadcast logs list (Col-span 8) */}
                            <div className="col-span-12 lg:col-span-8 flex flex-col gap-3">
                                {filteredBroadcasts.length === 0 ? (
                                    <div className="p-8 bg-white rounded-2xl border border-dashed border-stone-300 text-center">
                                        <Info className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                                        <p className="text-xs font-bold text-stone-500">No broadcasts found matching "{searchQuery}"</p>
                                        <p className="text-[10px] text-stone-400 mt-1">Try refining your search terms or send a new broadcast!</p>
                                    </div>
                                ) : (
                                    filteredBroadcasts.map((bc) => (
                                        <div key={bc.id} className="bg-white p-5 rounded-2xl border border-stone-200/60 shadow-2xs hover:shadow-xs transition-shadow flex flex-col md:flex-row gap-6 justify-between items-start animate-in fade-in-50 duration-200">
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#0e5f59] bg-[#0e5f59]/10 px-2.5 py-0.5 rounded-full">
                                                        {bc.channel.replace('_', ' ')}
                                                    </span>
                                                    <span className="text-[10px] text-stone-400 font-bold">
                                                        {new Date(bc.created_at).toLocaleDateString('en-US', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </span>
                                                </div>
                                                <h4 className="text-sm font-extrabold text-stone-900">{bc.subject}</h4>
                                                <p className="text-xs font-medium text-stone-600 leading-relaxed max-w-2xl">{bc.content}</p>
                                            </div>

                                            <div className="shrink-0 flex flex-col gap-3 min-w-44 text-right justify-between md:h-full">
                                                <div className="space-y-1">
                                                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-stone-400 block">Sent To</span>
                                                    <div className="flex flex-wrap md:justify-end gap-1.5">
                                                        {bc.recipients.map((rec, i) => (
                                                            <span key={i} className="px-2 py-0.5 bg-stone-100 text-stone-600 border border-stone-200 text-[9px] font-bold rounded">
                                                                {rec.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 md:justify-end text-[10px] font-bold text-stone-500">
                                                    <Globe className="w-3.5 h-3.5 text-emerald-500" />
                                                    <span>Active</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Floating mic tip card on the right (Col-span 4) */}
                            <div className="col-span-12 lg:col-span-4 bg-white p-5 rounded-2xl border border-stone-200/60 shadow-2xs flex items-center gap-4 select-none">
                                <div className="p-3 bg-amber-800 text-white rounded-full shrink-0 shadow-sm animate-pulse">
                                    <Mic className="w-6 h-6" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-amber-700">Live Tip</span>
                                    <h5 className="text-xs font-extrabold text-stone-850 mt-0.5">Record Flute Notes</h5>
                                    <p className="text-[10px] font-bold leading-relaxed text-stone-500 mt-1">
                                        Teachers can record and broadcast dynamic flute audio samples directly to inspire student practice checklists!
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Interactive Overlay Target Selector Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-stone-200/60 flex flex-col max-h-[500px]">
                        
                        {/* Modal Header */}
                        <div className="p-6 border-b border-stone-100 flex justify-between items-center">
                            <div>
                                <h3 className="text-base font-extrabold text-stone-900">Select Recipients</h3>
                                <p className="text-[11px] text-stone-400 font-semibold mt-0.5">Pick targeted classrooms or individual students</p>
                            </div>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="text-stone-400 hover:text-stone-600 transition-colors hover:bg-stone-50 p-1.5 rounded-full"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Search and Tab selectors */}
                        <div className="px-6 py-4 flex flex-col gap-4 border-b border-stone-100">
                            {/* Target Class vs Student Toggle */}
                            <div className="bg-stone-100 p-1 rounded-xl flex gap-1 select-none">
                                <button 
                                    onClick={() => setModalTab('class')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg tracking-wide transition-all ${
                                        modalTab === 'class' ? 'bg-white text-[#0e5f59] shadow-sm' : 'text-stone-500 hover:text-stone-800'
                                    }`}
                                >
                                    Classrooms
                                </button>
                                <button 
                                    onClick={() => setModalTab('student')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg tracking-wide transition-all ${
                                        modalTab === 'student' ? 'bg-white text-[#0e5f59] shadow-sm' : 'text-stone-500 hover:text-stone-800'
                                    }`}
                                >
                                    Students
                                </button>
                            </div>

                            {/* Inner Search Box */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
                                <input 
                                    className="w-full pl-9 pr-4 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#0e5f59] font-medium text-stone-800" 
                                    placeholder={`Filter ${modalTab === 'class' ? 'classrooms' : 'students'}...`}
                                    type="text" 
                                    value={modalSearchQuery}
                                    onChange={(e) => setModalSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* List items with checkboxes */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-3 max-h-60">
                            {/* Special global targeting option when Class tab is open */}
                            {modalTab === 'class' && !modalSearchQuery && (
                                <label className="flex items-center gap-3 p-3 bg-stone-50 hover:bg-stone-100/80 rounded-xl cursor-pointer border border-transparent hover:border-stone-200 transition-all">
                                    <input 
                                        type="checkbox" 
                                        checked={tempSelectedTargets.includes('global')}
                                        onChange={() => toggleTargetSelection('global')}
                                        className="rounded border-stone-300 text-amber-600 focus:ring-amber-500 focus:ring-1"
                                    />
                                    <div className="min-w-0 select-none">
                                        <h6 className="text-xs font-bold text-stone-800">All Students (Global)</h6>
                                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mt-0.5">Global Broadcast target</p>
                                    </div>
                                </label>
                            )}

                            {filteredModalItems.length === 0 ? (
                                <p className="text-xs text-stone-400 italic text-center py-4">No matching results found.</p>
                            ) : (
                                filteredModalItems.map((item) => (
                                    <label key={item.id} className="flex items-center gap-3 p-3 bg-stone-50 hover:bg-stone-100/80 rounded-xl cursor-pointer border border-transparent hover:border-stone-200 transition-all">
                                        <input 
                                            type="checkbox" 
                                            checked={tempSelectedTargets.includes(item.id)}
                                            onChange={() => toggleTargetSelection(item.id)}
                                            className="rounded border-stone-300 text-amber-600 focus:ring-amber-500 focus:ring-1"
                                        />
                                        <div className="min-w-0 select-none">
                                            <h6 className="text-xs font-bold text-stone-800 truncate">{item.name}</h6>
                                            <p className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider mt-0.5">
                                                {modalTab === 'class' ? 'Classroom Group' : 'Individual Student'}
                                            </p>
                                        </div>
                                    </label>
                                ))
                            )}
                        </div>

                        {/* Modal Footer actions */}
                        <div className="p-6 border-t border-stone-100 flex justify-end gap-3 shrink-0">
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 hover:bg-stone-50 border border-stone-200 text-stone-600 text-xs font-bold rounded-full transition-all"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={applySelectedRecipients}
                                className="px-5 py-2 bg-[#0e5f59] hover:bg-[#0c4e49] text-white text-xs font-bold rounded-full transition-all shadow-xs"
                            >
                                Apply Targets
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
