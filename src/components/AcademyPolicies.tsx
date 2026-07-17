'use client';

import React, { useState, useEffect } from 'react';
import { 
    Calendar, 
    CreditCard, 
    ShieldCheck, 
    CheckCircle2, 
    Info, 
    Scroll,
    UserCheck,
    Lock,
    Edit,
    Plus,
    Trash2,
    Loader2,
    X
} from 'lucide-react';
import { supabaseAuth } from '../lib/supabase-auth';

interface PolicyPoint {
    title: string;
    description: string;
    isCritical?: boolean;
}

interface PolicySection {
    id: string;
    title: string;
    icon: any;
    subtitle: string;
    points: PolicyPoint[];
}

const getIconById = (id: string) => {
    switch (id) {
        case 'conduct': return UserCheck;
        case 'attendance': return Calendar;
        case 'fees': return CreditCard;
        case 'ip': return Lock;
        default: return Scroll;
    }
};

const getDefaultSections = (): PolicySection[] => [
    {
        id: 'conduct',
        title: 'General Conduct & Riyaaz',
        icon: UserCheck,
        subtitle: 'Guidelines for daily practice and class discipline.',
        points: [
            {
                title: 'Respect the Guru-Shishya Tradition',
                description: 'Learning music is a journey of patience, discipline, and respect. Every class is an opportunity to learn—not only from your teacher but also from your fellow students.\n\n• Respect your teacher, classmates, and the learning environment.\n• Stay attentive throughout the class and avoid distractions.\n• Observe how your teacher demonstrates techniques and listen carefully to every instruction.\n• Learn by watching and listening to students who perform better than you.\n• Respect everyone\'s practice time and make the best use of every class.'
            },
            {
                title: 'Daily Riyaz (Practice Commitment)',
                description: 'Regular practice is the foundation of musical growth. Even a short daily practice session is more effective than long, irregular sessions.\n\nRecommended Daily Practice:\n• Beginners: 20–30 minutes\n• Intermediate: 30–45 minutes\n• Advanced: 45–60 minutes\n\nConsistency is key to developing finger control, breath support, rhythm, and musical expression.',
                isCritical: true
            },
            {
                title: 'Class Punctuality',
                description: 'Please join or arrive at least 5 minutes before your scheduled class.\n\nBeing on time allows you to settle in, prepare your instrument, and ensures the class begins smoothly without disturbing others.'
            },
            {
                title: 'Class Preparation',
                description: 'To make every class productive, please come prepared.\n\nBefore joining the class:\n• Complete at least 15 minutes of warm-up practice.\n• Keep your flute clean and ready for use.\n• Keep your notebook and practice materials nearby.\n• Ensure your camera, microphone, and internet connection are working properly (for online classes).\n• Join the class a few minutes early so you are ready when the lesson begins.'
            },
            {
                title: 'Positive Learning Environment',
                description: 'Every student has a unique learning pace.\n\n• Do not compare your progress with others.\n• Celebrate your own improvement, no matter how small.\n• Encourage and appreciate fellow students.\n• Stay patient, practice consistently, and enjoy the journey of learning music.\n\nRemember: Progress comes from regular practice, careful observation, and a positive attitude—not from rushing through lessons.'
            }
        ]
    },
    {
        id: 'attendance',
        title: 'Attendance & Leaves',
        icon: Calendar,
        subtitle: 'Rules for leave requests, scheduling, and attendance tracking.',
        points: [
            {
                title: 'Leave & Excuse Request',
                description: 'If you are unable to attend a scheduled class, please submit an Excuse Request or notify the academy at least 24 hours before your class.\n\nProviding advance notice allows us to plan the schedule efficiently and increases the possibility of arranging an alternative class.',
                isCritical: true
            },
            {
                title: 'Emergency Leave Policy',
                description: 'We understand that medical emergencies, family emergencies, and other unforeseen situations may arise.\n\nIf advance notice is not possible, please submit an Excuse Request as soon as you are able, along with a brief explanation.\n\nEach emergency request will be reviewed individually and approved at the instructor\'s discretion.'
            },
            {
                title: 'Alternative Class Policy',
                description: 'Alternative classes are provided only for approved (Excused) absences.\n\nPlease note:\n• Alternative classes are scheduled subject to teacher and slot availability.\n• The academy may arrange an Online or Offline class, depending on availability.\n• Alternative classes are not guaranteed.\n• Missed classes without prior notice or unapproved absences are not eligible for rescheduling.'
            },
            {
                title: 'Monthly Class Cycle',
                description: 'Each billing cycle includes 4 scheduled classes.\n\n• Any approved alternative class must be completed within the same billing cycle.\n• Unused classes cannot be carried forward to the next billing cycle.\n• Classes expire automatically once the billing cycle ends.',
                isCritical: true
            },
            {
                title: 'Billing Cycle & Class Duration',
                description: 'Every student has two important dates:\n• Joining Date: Your joining date is recorded when you enroll and never changes.\n• Billing Date: Your billing date determines your monthly learning cycle and may be revised by the academy if required.\n\nExample 1:\n• Joining Date: 1 Jan | Billing Date: 1st\n• Class Cycle: 1 Jan – 31 Jan | Classes: 4\n\nExample 2:\n• Joining Date: 1 Jan | Billing Date changed to 15th\n• Class Cycle: 15 Jan – 14 Feb | Classes: 4\n\nRegardless of your joining date, every billing cycle includes 4 scheduled classes.'
            },
            {
                title: 'Class Slot Retention',
                description: 'Your class slot is reserved exclusively for you.\n\nMissing 3 consecutive scheduled classes without prior communication or an approved excuse may result in your reserved slot being released.\n\nTo continue classes, a new slot will be allocated based on the academy\'s current availability.'
            }
        ]
    },
    {
        id: 'fees',
        title: 'Fees & Payments',
        icon: CreditCard,
        subtitle: 'Fee structures, billing cycles, and deadlines.',
        points: [
            {
                title: 'Payment Schedule',
                description: 'Fees are charged for one billing cycle (4 classes).\n\n• Each billing cycle includes 4 scheduled classes.\n• Students are expected to complete the payment on or before their billing date.\n• Classes continue according to the academy schedule during the active billing cycle.'
            },
            {
                title: 'Billing Date',
                description: 'Every student has a dedicated Billing Date.\n\n• The billing date determines the start and end of each billing cycle.\n• Your Joining Date remains permanent and cannot be changed.\n• The academy may revise your Billing Date to better align with scheduling requirements.\n• Regardless of the billing date, each billing cycle always includes 4 scheduled classes.\n\nExample:\n• Joining Date: 1 January | Billing Date: 15th\n• Billing Cycle: 15 Jan → 14 Feb\n• Classes Included: 4 Classes'
            },
            {
                title: 'Payment Deadline',
                description: 'Payments should be completed on or before the Billing Date.\n\nIf payment is not received on time:\n• Future classes may be temporarily paused.\n• Your reserved class slot may not be guaranteed until payment is received.\n• Repeated late payments may require rescheduling your regular class slot.',
                isCritical: true
            },
            {
                title: 'Refund & Transfer Policy',
                description: '• Fees once paid are non-refundable.\n• Fees cannot be transferred to another student.\n• Missed classes without an approved Excuse Request are not eligible for refund or adjustment.\n• Expired classes from a completed billing cycle cannot be converted into future credits.',
                isCritical: true
            },
            {
                title: 'Class Pause / Long Leave',
                description: 'If you plan to take a long break due to travel, examinations, work, or personal reasons:\n\n• Please inform the academy at least 15 days in advance.\n• The academy will try its best to reserve your regular slot.\n• Slot reservation cannot be guaranteed for extended breaks and depends on future availability.'
            },
            {
                title: 'Continued Learning',
                description: 'Regular attendance and timely fee payment help us maintain a consistent learning schedule for every student.\n\nOur goal is to provide uninterrupted learning while ensuring fair scheduling for all students.'
            }
        ]
    },
    {
        id: 'ip',
        title: 'Learning Materials & Copyright',
        icon: Lock,
        subtitle: 'Protecting academy learning materials, recordings, and intellectual property.',
        points: [
            {
                title: 'Learning Materials',
                description: 'All study materials provided by Krishna Flute Academy, including notation (Sargam sheets), lesson notes, practice tracks, PDFs, videos, recordings, and portal content, are created exclusively for enrolled students.\n\nThese materials are intended only for your personal learning and remain the intellectual property of the academy.'
            },
            {
                title: 'Sharing Academy Content',
                description: 'Please do not share any academy resources without prior permission.\n\nThis includes:\n• Lesson notes and Sargam sheets\n• Class recordings\n• Practice audio tracks\n• PDFs and learning materials\n• Portal screenshots or premium content\n\nSharing academy materials with non-enrolled students or on public platforms is strictly prohibited.',
                isCritical: true
            },
            {
                title: 'Copyright & Intellectual Property',
                description: 'All teaching materials, recordings, exercises, and curriculum developed by Krishna Flute Academy are protected under applicable copyright laws.\n\nStudents may not:\n• Upload academy materials to YouTube, Facebook, Instagram, Google Drive, Telegram, WhatsApp groups, or any other platform.\n• Sell, redistribute, or reproduce academy content.\n• Use academy content for commercial teaching or training without written permission.',
                isCritical: true
            },
            {
                title: 'Recording & Personal Use',
                description: 'Students may use academy recordings and learning materials only for personal practice and revision.\n\nThese materials must not be:\n• Shared with others.\n• Edited and redistributed.\n• Used for teaching another student.\n• Uploaded publicly without written approval.'
            },
            {
                title: 'Student Performance Videos',
                description: 'The academy may occasionally feature student performances on its website or social media to celebrate learning achievements.\n\nIf a student or parent prefers not to have their performance shared, they may inform the academy, and their preference will be respected.'
            },
            {
                title: 'Respect Our Learning Community',
                description: 'Krishna Flute Academy invests significant time in creating structured lessons, exercises, and practice resources for every student.\n\nBy respecting these policies, you help us continue providing high-quality music education while protecting the hard work behind our curriculum.'
            }
        ]
    }
];

export default function AcademyPolicies({ isAdmin: isAdminProp }: { isAdmin?: boolean }) {
    const [activeSection, setActiveSection] = useState<string>('conduct');
    const [sectionsList, setSectionsList] = useState<PolicySection[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(!!isAdminProp);
    const [isSaving, setIsSaving] = useState(false);

    // Edit Modal State
    const [editingSection, setEditingSection] = useState<PolicySection | null>(null);

    // Sync prop changes
    useEffect(() => {
        if (isAdminProp !== undefined) {
            setIsAdmin(isAdminProp);
        }
    }, [isAdminProp]);

    const loadLocalPolicies = () => {
        if (typeof window !== 'undefined') {
            const local = localStorage.getItem('kfa-academy-policies');
            if (local) {
                try {
                    const parsed = JSON.parse(local);
                    const mapped = parsed.map((item: any) => ({
                        ...item,
                        icon: getIconById(item.id)
                    }));
                    setSectionsList(mapped);
                    return;
                } catch (e) {
                    console.error('Error parsing local policies:', e);
                }
            }
        }
        setSectionsList(getDefaultSections());
    };

    // Load policies on mount and check admin status
    useEffect(() => {
        const fetchUserDataAndPolicies = async () => {
            setLoading(true);
            try {
                // 1. Check cached admin role
                const cachedRole = typeof window !== 'undefined' ? localStorage.getItem('kfa-user-role') : null;
                if (cachedRole === 'admin') {
                    setIsAdmin(true);
                } else {
                    const { data: { session } } = await supabaseAuth.auth.getSession();
                    if (session) {
                        const { data: profile } = await supabaseAuth
                            .from('users')
                            .select('role')
                            .eq('id', session.user.id)
                            .single();
                        if (profile?.role === 'admin') {
                            setIsAdmin(true);
                            localStorage.setItem('kfa-user-role', 'admin');
                        }
                    }
                }

                // 2. Fetch policies from Supabase
                const { data, error } = await supabaseAuth
                    .from('academy_policies')
                    .select('*')
                    .order('id');
                
                if (error) {
                    console.warn('Error loading policies from Supabase, loading fallback cache:', error);
                    loadLocalPolicies();
                } else if (data && data.length > 0) {
                    const mapped = data.map(item => ({
                        id: item.id,
                        title: item.title,
                        subtitle: item.subtitle,
                        icon: getIconById(item.id),
                        points: item.points || []
                    }));
                    setSectionsList(mapped);
                } else {
                    // Seed defaults if database is empty
                    console.log('Database empty, seeding default policy items...');
                    const defaults = getDefaultSections();
                    for (const sec of defaults) {
                        await supabaseAuth.from('academy_policies').insert({
                            id: sec.id,
                            title: sec.title,
                            subtitle: sec.subtitle,
                            points: sec.points
                        });
                    }
                    setSectionsList(defaults);
                }
            } catch (err) {
                console.error('Failed to load online policies:', err);
                loadLocalPolicies();
            } finally {
                setLoading(false);
            }
        };

        fetchUserDataAndPolicies();
    }, []);

    const handleSavePolicy = async () => {
        if (!editingSection) return;
        setIsSaving(true);
        try {
            // Update online database
            const { error } = await supabaseAuth
                .from('academy_policies')
                .upsert({
                    id: editingSection.id,
                    title: editingSection.title,
                    subtitle: editingSection.subtitle,
                    points: editingSection.points,
                    updated_at: new Date().toISOString()
                });
            
            if (error) throw error;
            
            const updated = sectionsList.map(sec => 
                sec.id === editingSection.id ? { ...editingSection } : sec
            );
            setSectionsList(updated);
            
            if (typeof window !== 'undefined') {
                localStorage.setItem('kfa-academy-policies', JSON.stringify(updated.map(s => ({
                    id: s.id,
                    title: s.title,
                    subtitle: s.subtitle,
                    points: s.points
                }))));
            }
            setEditingSection(null);
        } catch (err) {
            console.error('Error saving policies:', err);
            // Local fallback save
            const updated = sectionsList.map(sec => 
                sec.id === editingSection.id ? { ...editingSection } : sec
            );
            setSectionsList(updated);
            if (typeof window !== 'undefined') {
                localStorage.setItem('kfa-academy-policies', JSON.stringify(updated.map(s => ({
                    id: s.id,
                    title: s.title,
                    subtitle: s.subtitle,
                    points: s.points
                }))));
            }
            setEditingSection(null);
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#7C5E3F]" />
                <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest animate-pulse">Loading Academy Guidelines...</p>
            </div>
        );
    }

    const activeData = sectionsList.find(s => s.id === activeSection) || sectionsList[0];
    const ActiveIcon = activeData ? activeData.icon : Scroll;

    return (
        <div className="w-full space-y-6">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-[#7C5E3F] via-[#9F7A56] to-[#FAF5EE]/20 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-md border border-[#E6E1DA]/10 text-left">
                <div className="absolute right-0 top-0 -mt-8 -mr-8 w-48 h-48 bg-white/5 rounded-full blur-xl pointer-events-none" />
                <div className="relative z-10 space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-xs">
                            <Scroll className="w-6 h-6 text-amber-200" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider bg-white/10 px-2.5 py-1 rounded-full border border-white/10">
                                Official Guidelines
                            </span>
                        </div>
                    </div>
                    <h1 className="text-xl md:text-3xl font-black tracking-tight leading-tight">
                        Academy Policies & Terms
                    </h1>
                    <p className="text-xs md:text-sm font-medium text-slate-200/90 max-w-2xl leading-relaxed">
                        Welcome to the Krishna Flute Academy. These guidelines outline the commitments, attendance norms, and fee schedules required to maintain a structured and progress-oriented learning environment.
                    </p>
                </div>
            </div>

            {/* Main Tabs and Content layout */}
            <div className="flex flex-col gap-6">
                {/* Top: Navigation Links */}
                <div className="flex flex-row overflow-x-auto sm:flex-wrap gap-3 pb-2 sm:pb-0 scrollbar-none text-left">
                    {sectionsList.map((section) => {
                        const Icon = section.icon;
                        const active = section.id === activeSection;
                        return (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl transition-all text-xs md:text-sm font-bold border shrink-0 select-none ${
                                    active 
                                        ? 'bg-[#FAF5EE] border-[#7C5E3F]/30 text-[#7C5E3F] shadow-xs' 
                                        : 'bg-white border-slate-150 text-slate-600 hover:bg-slate-50/80 hover:text-slate-800'
                                }`}
                            >
                                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#7C5E3F]' : 'text-slate-400'}`} />
                                <span className="whitespace-nowrap">{section.title}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Bottom: Policy Details Card */}
                <div className="bg-white border border-slate-150 rounded-3xl p-6 md:p-8 flex flex-col justify-between shadow-xs animate-in fade-in slide-in-from-bottom-2 duration-300 text-left">
                    {activeData && (
                        <div className="space-y-6">
                            {/* Section Title & Edit trigger */}
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-[#FAF5EE] flex items-center justify-center text-[#7C5E3F] border border-[#7C5E3F]/10">
                                        <ActiveIcon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-[#3E3A35] font-extrabold text-base md:text-lg leading-tight">
                                            {activeData.title}
                                        </h2>
                                        <p className="text-slate-400 text-xs mt-0.5 font-medium">
                                            {activeData.subtitle}
                                        </p>
                                    </div>
                                </div>
                                {isAdmin && (
                                    <button 
                                        onClick={() => setEditingSection({
                                            ...activeData,
                                            points: activeData.points.map(pt => ({ ...pt }))
                                        })}
                                        className="px-3 py-1.5 flex items-center gap-1.5 bg-[#7C5E3F]/10 hover:bg-[#7C5E3F]/20 text-[#7C5E3F] rounded-lg transition-colors text-xs font-bold shrink-0"
                                    >
                                        <Edit className="w-3.5 h-3.5" /> Edit Policy
                                    </button>
                                )}
                            </div>

                            {/* Policy Points */}
                            <div className="columns-1 md:columns-2 gap-4 space-y-4">
                                {activeData.points.map((point, index) => (
                                    <div 
                                        key={index} 
                                        className={`break-inside-avoid inline-block w-full p-4 rounded-2xl border transition-all duration-200 hover:shadow-xs text-left ${
                                            point.isCritical 
                                                ? 'bg-amber-50/30 border-amber-250/50 hover:bg-amber-50/50' 
                                                : 'bg-slate-50/30 border-slate-100 hover:bg-slate-50/60'
                                        }`}
                                    >
                                        <div className="flex items-start gap-2.5">
                                            <div className="mt-0.5 shrink-0">
                                                {point.isCritical ? (
                                                    <Info className="w-4 h-4 text-amber-600" />
                                                ) : (
                                                    <CheckCircle2 className="w-4 h-4 text-slate-400" />
                                                )}
                                            </div>
                                            <div className="space-y-1">
                                                <h4 className={`text-xs font-black tracking-tight ${point.isCritical ? 'text-[#b45309]' : 'text-slate-800'}`}>
                                                    {point.title}
                                                </h4>
                                                <p className="text-[11px] font-medium leading-relaxed text-slate-500 whitespace-pre-line">
                                                    {point.description}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Academy Statement Footer */}
                    <div className="mt-8 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-400 text-[10px] md:text-xs">
                        <div className="flex items-center gap-1.5 font-medium">
                            <ShieldCheck className="w-4 h-4 text-[#7C5E3F]" />
                            <span>Authorized by KFA Management Team</span>
                        </div>
                        <span className="font-semibold text-[#7C5E3F]/80">Dedicated to Classical Excellence</span>
                    </div>
                </div>
            </div>

            {/* ==================== EDIT POLICY DIALOG MODAL ==================== */}
            {editingSection && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 select-text animate-fadeIn">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                            <div className="flex items-center gap-2">
                                <Edit className="w-5 h-5 text-[#7C5E3F]" />
                                <h3 className="font-bold text-base text-slate-900 dark:text-white">Edit Section: {editingSection.title}</h3>
                            </div>
                            <button 
                                onClick={() => setEditingSection(null)} 
                                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-650"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Meta Inputs */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5 text-left">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Section Title</label>
                                    <input 
                                        type="text"
                                        value={editingSection.title}
                                        onChange={(e) => setEditingSection({ ...editingSection, title: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#7C5E3F]/20 outline-none transition-all text-slate-800 dark:text-slate-100"
                                    />
                                </div>
                                <div className="space-y-1.5 text-left">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Section Subtitle</label>
                                    <input 
                                        type="text"
                                        value={editingSection.subtitle}
                                        onChange={(e) => setEditingSection({ ...editingSection, subtitle: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#7C5E3F]/20 outline-none transition-all text-slate-800 dark:text-slate-100"
                                    />
                                </div>
                            </div>

                            {/* Points Title */}
                            <div className="border-t border-slate-150 dark:border-slate-800 pt-4 flex items-center justify-between">
                                <h4 className="font-bold text-sm text-slate-850 dark:text-slate-200">Guidelines & Clauses</h4>
                                <button 
                                    onClick={() => {
                                        const pts = [...editingSection.points, { title: 'New Clause', description: 'Enter description detail here...', isCritical: false }];
                                        setEditingSection({ ...editingSection, points: pts });
                                    }}
                                    className="px-2.5 py-1.5 bg-[#7C5E3F] hover:bg-[#6A4E31] text-white text-[10px] font-bold rounded-lg flex items-center gap-1 transition-all"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add Clause
                                </button>
                            </div>

                            {/* Points List */}
                            <div className="space-y-4">
                                {editingSection.points.map((pt, idx) => (
                                    <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-150 dark:border-slate-800 rounded-2xl space-y-3 relative">
                                        <button 
                                            onClick={() => {
                                                const pts = editingSection.points.filter((_, k) => k !== idx);
                                                setEditingSection({ ...editingSection, points: pts });
                                            }}
                                            className="absolute top-4 right-4 p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all"
                                            title="Delete Clause"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>

                                        <div className="w-[85%] space-y-3 text-left">
                                            {/* Point Title */}
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Clause Title</label>
                                                <input 
                                                    type="text"
                                                    value={pt.title}
                                                    onChange={(e) => {
                                                        const pts = [...editingSection.points];
                                                        pts[idx].title = e.target.value;
                                                        setEditingSection({ ...editingSection, points: pts });
                                                    }}
                                                    className="w-full bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-[#7C5E3F]"
                                                />
                                            </div>

                                            {/* Point Description */}
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Description</label>
                                                <textarea 
                                                    rows={3}
                                                    value={pt.description}
                                                    onChange={(e) => {
                                                        const pts = [...editingSection.points];
                                                        pts[idx].description = e.target.value;
                                                        setEditingSection({ ...editingSection, points: pts });
                                                    }}
                                                    className="w-full bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-350 focus:ring-1 focus:ring-[#7C5E3F] whitespace-pre-wrap outline-none"
                                                />
                                            </div>

                                            {/* Critical checkbox */}
                                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                                <input 
                                                    type="checkbox"
                                                    checked={!!pt.isCritical}
                                                    onChange={(e) => {
                                                        const pts = [...editingSection.points];
                                                        pts[idx].isCritical = e.target.checked;
                                                        setEditingSection({ ...editingSection, points: pts });
                                                    }}
                                                    className="rounded border-slate-300 dark:border-slate-700 text-[#7C5E3F] focus:ring-[#7C5E3F]/20 size-3.5"
                                                />
                                                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Highlight as Critical (Important alert box)</span>
                                            </label>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Modal Actions */}
                        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-end gap-3">
                            <button 
                                onClick={() => setEditingSection(null)}
                                className="px-5 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all rounded-xl text-xs font-semibold"
                                disabled={isSaving}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSavePolicy}
                                className="px-6 py-2 bg-[#7C5E3F] hover:bg-[#6A4E31] text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                                    </>
                                ) : (
                                    'Save Guidelines'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
