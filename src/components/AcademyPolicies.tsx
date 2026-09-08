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
    X,
    TrendingUp,
    BookOpen,
    HelpCircle,
    Play,
    ChevronDown,
    ChevronUp,
    ArrowRight,
    Eye,
    EyeOff,
    ArrowUp,
    ArrowDown,
    ExternalLink,
    Check
} from 'lucide-react';
import { supabaseAuth } from '../lib/supabase-auth';
import { HowToGuide, HowToStep, DEFAULT_HOW_TO_GUIDES, POLICY_ID_NAMES, isMethodBasedGuide } from '../lib/howToGuides';
import HowToGuideViewer from './HowToGuideViewer';

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

interface AcademyPoliciesProps {
    isAdmin?: boolean;
    initialSubTab?: 'policies' | 'how-to';
    targetGuideId?: string | null;
    onClearTargetGuide?: () => void;
}

const getIconById = (id: string) => {
    switch (id) {
        case 'conduct': return UserCheck;
        case 'attendance': return Calendar;
        case 'fees': return CreditCard;
        case 'ip': return Lock;
        case 'progress': return TrendingUp;
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
    },
    {
        id: 'progress',
        title: 'Student Progress & Evaluation',
        icon: TrendingUp,
        subtitle: 'Guidelines on how progress, task submissions, attendance, and grades are evaluated.',
        points: [
            {
                title: 'Overview of Evaluation Metrics',
                description: 'A student\'s overall progress is the simple average of four key areas:\n\n1. Proficiency Progress: How much of the assigned syllabus is completed.\n2. Task Submission: The percentage of homework tasks submitted.\n3. Attendance Rate: The percentage of scheduled classes attended.\n4. Average Score: The average grade received on reviewed assignments.\n\nTo find the overall progress, we add these four scores together and divide by 4.'
            },
            {
                title: 'Proficiency Level Progress',
                description: 'This shows how many lessons a student has completed out of the total unlocked (or completed) lessons. Unlike total allocated lessons, it reflects the completion rate of the material the student has actively reached.\n\nExample: If a student has unlocked 4 lessons and completed 2, their proficiency progress is 50%.',
                isCritical: true
            },
            {
                title: 'Task Submission Rate',
                description: 'Calculates the percentage of assigned homework submitted at the student\'s current learning level.\n\nExample: If 4 tasks are assigned and the student submits 3, the submission rate is 75%.\n\n*Note: This rate automatically resets to 0% whenever a student moves to the next proficiency level.*',
                isCritical: true
            },
            {
                title: 'Monthly Attendance Rate',
                description: 'This is the percentage of scheduled classes the student attended in the current month.\n\nExample: If 4 classes are held in the month and the student attends 3, their attendance rate is 75%. If no classes are held in the current month, it falls back to their all-time attendance average.',
                isCritical: true
            },
            {
                title: 'Average Academic Score',
                description: 'The average grade of all homework assignments reviewed and marked by the teacher.\n\nExample: If a student receives scores of 8, 9, and 7 on three assignments, their average score is 8 out of 10 (which counts as 80% towards the average).',
                isCritical: true
            },
            {
                title: 'Academic Standing (Consistency Status)',
                description: 'The student\'s status is determined dynamically by evaluating their active metrics against warning thresholds:\n\n• Consistent (Green): Attendance is 85% or above, Task Submission is 75% or above, and Average Academic Score is 7.0/10 or above.\n• Improving (Amber): No "At Risk" thresholds are hit, but at least one metric falls into borderline ranges: Attendance (75%–84%), Task Submission (60%–74%), or Avg. Score (5.0–6.9).\n• At Risk (Red): Any single metric falls below the warning thresholds: Attendance below 75%, Task Submission below 60%, or Avg. Score below 5.0.',
                isCritical: true
            }
        ]
    }
];

export default function AcademyPolicies({ 
    isAdmin: isAdminProp,
    initialSubTab = 'policies',
    targetGuideId = null,
    onClearTargetGuide
}: AcademyPoliciesProps) {
    // ── Main Top-Level Tab State ──────────────────────────────────────────────
    const [mainTab, setMainTab] = useState<'policies' | 'how-to'>(initialSubTab);

    // ── Policies Tab State ───────────────────────────────────────────────────
    const [activeSection, setActiveSection] = useState<string>('conduct');
    const [sectionsList, setSectionsList] = useState<PolicySection[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(!!isAdminProp);
    const [isSavingPolicy, setIsSavingPolicy] = useState(false);
    const [editingSection, setEditingSection] = useState<PolicySection | null>(null);

    // ── How-To Guides State ───────────────────────────────────────────────────
    const [guidesList, setGuidesList] = useState<HowToGuide[]>([]);
    const [loadingGuides, setLoadingGuides] = useState(true);
    const [expandedGuideId, setExpandedGuideId] = useState<string | null>(targetGuideId || null);
    const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);
    const [editingGuide, setEditingGuide] = useState<HowToGuide | null>(null);
    const [isSavingGuide, setIsSavingGuide] = useState(false);

    // Sync prop changes
    useEffect(() => {
        if (isAdminProp !== undefined) {
            setIsAdmin(isAdminProp);
        }
    }, [isAdminProp]);

    useEffect(() => {
        if (initialSubTab) {
            setMainTab(initialSubTab);
        }
    }, [initialSubTab]);

    useEffect(() => {
        if (targetGuideId) {
            setMainTab('how-to');
            setExpandedGuideId(targetGuideId);
        }
    }, [targetGuideId]);

    // Local policy cache
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

    // Local guides cache
    const loadLocalGuides = () => {
        if (typeof window !== 'undefined') {
            const local = localStorage.getItem('kfa-student-how-to-guides');
            if (local) {
                try {
                    const parsed = JSON.parse(local);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setGuidesList(parsed);
                        return;
                    }
                } catch (e) {
                    console.error('Error parsing local guides:', e);
                }
            }
        }
        setGuidesList(DEFAULT_HOW_TO_GUIDES);
    };

    // Fetch policies and guides on mount
    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);
            setLoadingGuides(true);
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
                const { data: polData, error: polErr } = await supabaseAuth
                    .from('academy_policies')
                    .select('*')
                    .order('id');
                
                if (polErr || !polData || polData.length === 0) {
                    loadLocalPolicies();
                } else {
                    const mapped = polData.map(item => ({
                        id: item.id,
                        title: item.title,
                        subtitle: item.subtitle,
                        icon: getIconById(item.id),
                        points: item.points || []
                    }));
                    setSectionsList(mapped);
                }

                // 3. Fetch how-to guides from Supabase
                const { data: guidesData, error: guidesErr } = await supabaseAuth
                    .from('student_how_to_guides')
                    .select('*')
                    .order('display_order', { ascending: true });

                if (guidesErr || !guidesData || guidesData.length === 0) {
                    loadLocalGuides();
                } else {
                    setGuidesList(guidesData);
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('kfa-student-how-to-guides', JSON.stringify(guidesData));
                    }
                }
            } catch (err) {
                console.error('Failed to load online policies & guides:', err);
                loadLocalPolicies();
                loadLocalGuides();
            } finally {
                setLoading(false);
                setLoadingGuides(false);
            }
        };

        fetchAllData();
    }, []);

    // ── Save Policy (Admin) ───────────────────────────────────────────────────
    const handleSavePolicy = async () => {
        if (!editingSection) return;
        setIsSavingPolicy(true);
        try {
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
            setIsSavingPolicy(false);
        }
    };

    // ── Save / Create How-To Guide (Admin) ─────────────────────────────────────
    const handleSaveGuide = async (guideToSave: HowToGuide) => {
        setIsSavingGuide(true);
        try {
            const derivedSlug = guideToSave.slug || guideToSave.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `guide-${Date.now()}`;
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guideToSave.id);
            
            const payload: Record<string, any> = {
                slug: derivedSlug,
                title: guideToSave.title,
                description: guideToSave.description,
                video_url: guideToSave.video_url || null,
                steps: guideToSave.steps,
                related_policy_id: guideToSave.related_policy_id || null,
                display_order: guideToSave.display_order,
                is_active: guideToSave.is_active,
                updated_at: new Date().toISOString()
            };
            if (isUUID) {
                payload.id = guideToSave.id;
            }

            const { data: savedData, error } = await supabaseAuth
                .from('student_how_to_guides')
                .upsert(payload, { onConflict: 'slug' })
                .select();

            if (error) throw error;

            const savedItem: HowToGuide = (savedData && savedData[0]) ? savedData[0] : { ...guideToSave, slug: derivedSlug };

            let updated: HowToGuide[];
            const exists = guidesList.some(g => g.id === guideToSave.id || g.slug === derivedSlug);
            if (exists) {
                updated = guidesList.map(g => (g.id === guideToSave.id || g.slug === derivedSlug) ? savedItem : g);
            } else {
                updated = [...guidesList, savedItem];
            }
            updated.sort((a, b) => a.display_order - b.display_order);
            setGuidesList(updated);

            if (typeof window !== 'undefined') {
                localStorage.setItem('kfa-student-how-to-guides', JSON.stringify(updated));
            }
            setEditingGuide(null);
        } catch (err) {
            console.error('Error saving guide to Supabase, saving locally:', err);
            const derivedSlug = guideToSave.slug || guideToSave.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `guide-${Date.now()}`;
            const localSaved: HowToGuide = { ...guideToSave, slug: derivedSlug };
            let updated: HowToGuide[];
            const exists = guidesList.some(g => g.id === guideToSave.id || g.slug === derivedSlug);
            if (exists) {
                updated = guidesList.map(g => (g.id === guideToSave.id || g.slug === derivedSlug) ? localSaved : g);
            } else {
                updated = [...guidesList, localSaved];
            }
            updated.sort((a, b) => a.display_order - b.display_order);
            setGuidesList(updated);
            if (typeof window !== 'undefined') {
                localStorage.setItem('kfa-student-how-to-guides', JSON.stringify(updated));
            }
            setEditingGuide(null);
        } finally {
            setIsSavingGuide(false);
        }
    };

    // ── Toggle Guide Active / Inactive (Admin) ─────────────────────────────────
    const handleToggleGuideActive = async (guide: HowToGuide) => {
        const updatedGuide = { ...guide, is_active: !guide.is_active };
        await handleSaveGuide(updatedGuide);
    };

    // ── Reorder Guide Up / Down (Admin) ───────────────────────────────────────
    const handleReorderGuide = async (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= guidesList.length) return;

        const updated = [...guidesList];
        const [moved] = updated.splice(index, 1);
        updated.splice(newIndex, 0, moved);

        // Reassign display_order
        const reordered = updated.map((g, idx) => ({ ...g, display_order: idx + 1 }));
        setGuidesList(reordered);

        try {
            for (const g of reordered) {
                await supabaseAuth
                    .from('student_how_to_guides')
                    .update({ display_order: g.display_order, updated_at: new Date().toISOString() })
                    .eq('id', g.id);
            }
        } catch (e) {
            console.warn('Failed to persist guide reorder:', e);
        }

        if (typeof window !== 'undefined') {
            localStorage.setItem('kfa-student-how-to-guides', JSON.stringify(reordered));
        }
    };

    // ── Delete Guide (Admin) ──────────────────────────────────────────────────
    const handleDeleteGuide = async (guideId: string) => {
        if (!confirm('Are you sure you want to delete this how-to guide?')) return;
        try {
            await supabaseAuth.from('student_how_to_guides').delete().eq('id', guideId);
        } catch (e) {
            console.warn('Failed to delete guide online:', e);
        }
        const updated = guidesList.filter(g => g.id !== guideId);
        setGuidesList(updated);
        if (typeof window !== 'undefined') {
            localStorage.setItem('kfa-student-how-to-guides', JSON.stringify(updated));
        }
    };

    // Filter guides for students: students only see active guides; admin sees all with active status
    const visibleGuides = isAdmin ? guidesList : guidesList.filter(g => g.is_active);

    const activeData = sectionsList.find(s => s.id === activeSection) || sectionsList[0];
    const ActiveIcon = activeData ? activeData.icon : Scroll;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#7C5E3F]" />
                <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest animate-pulse">
                    Loading Policies & Guidelines...
                </p>
            </div>
        );
    }

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
                                Student Portal Information Centre
                            </span>
                        </div>
                    </div>
                    <h1 className="text-xl md:text-3xl font-black tracking-tight leading-tight">
                        Policies & How-To
                    </h1>
                    <p className="text-xs md:text-sm font-medium text-slate-200/90 max-w-2xl leading-relaxed">
                        Everything you need to know about KFA policies and using your student portal.
                    </p>
                </div>
            </div>

            {/* Top Navigation: Two Primary Tabs [ Academy Policies ] [ How-To Guides ] */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-1.5 shadow-xs flex gap-2">
                <button
                    type="button"
                    onClick={() => {
                        setMainTab('policies');
                        if (onClearTargetGuide) onClearTargetGuide();
                    }}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs md:text-sm font-black transition-all flex items-center justify-center gap-2 ${
                        mainTab === 'policies'
                            ? 'bg-[#FAF5EE] text-[#7C5E3F] border border-[#7C5E3F]/30 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                >
                    <Scroll className="w-4 h-4" />
                    <span>Academy Policies</span>
                </button>

                <button
                    type="button"
                    onClick={() => setMainTab('how-to')}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs md:text-sm font-black transition-all flex items-center justify-center gap-2 ${
                        mainTab === 'how-to'
                            ? 'bg-[#FAF5EE] text-[#7C5E3F] border border-[#7C5E3F]/30 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                >
                    <BookOpen className="w-4 h-4" />
                    <span>How-To Guides</span>
                    <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-[#a15912]">
                        {visibleGuides.length}
                    </span>
                </button>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                TAB 1: ACADEMY POLICIES
            ════════════════════════════════════════════════════════════════════ */}
            {mainTab === 'policies' && (
                <div className="flex flex-col gap-6 animate-in fade-in duration-200">
                    {/* Policy Subsections Buttons */}
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

                    {/* Policy Details Card */}
                    <div className="bg-white border border-slate-150 rounded-3xl p-6 md:p-8 flex flex-col justify-between shadow-xs text-left">
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

                                {/* Cross-Link to How-To Guide if applicable */}
                                {activeData.id === 'attendance' && (
                                    <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between gap-3 text-amber-950">
                                        <div className="flex items-center gap-2 text-xs">
                                            <HelpCircle className="w-4 h-4 text-[#d46211] shrink-0" />
                                            <span className="font-semibold">
                                                Need step-by-step guidance on submitting an absence excuse?
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMainTab('how-to');
                                                setExpandedGuideId('how-to-apply-leave');
                                            }}
                                            className="text-xs font-extrabold text-[#d46211] hover:underline flex items-center gap-1 shrink-0"
                                        >
                                            View Guide: How to Apply for Leave <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}

                                {activeData.id === 'progress' && (
                                    <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between gap-3 text-amber-950">
                                        <div className="flex items-center gap-2 text-xs">
                                            <HelpCircle className="w-4 h-4 text-[#d46211] shrink-0" />
                                            <span className="font-semibold">
                                                Need instructions on submitting homework recordings or Drive links?
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMainTab('how-to');
                                                setExpandedGuideId('how-to-submit-task');
                                            }}
                                            className="text-xs font-extrabold text-[#d46211] hover:underline flex items-center gap-1 shrink-0"
                                        >
                                            View Guide: How to Submit a Task <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}

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
            )}

            {/* ═══════════════════════════════════════════════════════════════════
                TAB 2: HOW-TO GUIDES
            ════════════════════════════════════════════════════════════════════ */}
            {mainTab === 'how-to' && (
                <div className="space-y-6 animate-in fade-in duration-200 text-left">
                    {/* Admin Actions Bar */}
                    {isAdmin && (
                        <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 flex items-center justify-between gap-3">
                            <div>
                                <span className="text-xs font-black text-amber-900 block">
                                    Admin Guide Management
                                </span>
                                <span className="text-[11px] text-amber-700">
                                    Create, edit, reorder, or toggle active/inactive status for student portal guides.
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditingGuide({
                                    id: `guide-${Date.now()}`,
                                    slug: '',
                                    title: '',
                                    description: '',
                                    video_url: '',
                                    steps: [{ order: 1, text: '' }],
                                    related_policy_id: null,
                                    display_order: guidesList.length + 1,
                                    is_active: true
                                })}
                                className="px-3.5 py-2 bg-[#7C5E3F] hover:bg-[#6A4E31] text-white text-xs font-extrabold rounded-xl flex items-center gap-1.5 transition-colors shrink-0 shadow-xs"
                            >
                                <Plus className="w-4 h-4" /> Add Guide
                            </button>
                        </div>
                    )}

                    {/* How-To Guides List */}
                    {visibleGuides.length === 0 ? (
                        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400">
                            <HelpCircle className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                            <p className="font-bold text-sm">No how-to guides available yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {visibleGuides.map((guide, index) => {
                                const isExpanded = expandedGuideId === guide.id;
                                const relatedPolicyName = guide.related_policy_id ? POLICY_ID_NAMES[guide.related_policy_id] : null;

                                return (
                                    <div
                                        key={guide.id}
                                        id={guide.id}
                                        className={`bg-white border rounded-3xl p-5 sm:p-6 transition-all duration-200 shadow-xs ${
                                            isExpanded 
                                                ? 'border-amber-400 ring-4 ring-amber-500/5' 
                                                : 'border-slate-200/90 hover:border-slate-300'
                                        }`}
                                    >
                                        {/* Card Top: Title, Badges, Admin tools */}
                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                            <div className="space-y-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="w-6 h-6 rounded-lg bg-orange-50 text-[#d46211] border border-orange-100 flex items-center justify-center font-black text-xs shrink-0">
                                                        {index + 1}
                                                    </span>
                                                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                                                        {guide.title}
                                                    </h3>
                                                    {isAdmin && !guide.is_active && (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200">
                                                            Paused / Inactive
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 leading-relaxed max-w-2xl pl-8 sm:pl-8">
                                                    {guide.description}
                                                </p>
                                            </div>

                                            {/* Action Buttons: Watch Tutorial, View Steps, Admin Tools */}
                                            <div className="flex items-center gap-2 shrink-0 pl-8 sm:pl-0">
                                                {guide.video_url && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setVideoModalUrl(guide.video_url || null)}
                                                        className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-[#d46211] font-bold text-xs rounded-xl flex items-center gap-1 transition-colors border border-amber-200/70"
                                                    >
                                                        <Play className="w-3.5 h-3.5 fill-current" />
                                                        <span>Watch Tutorial</span>
                                                    </button>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedGuideId(isExpanded ? null : guide.id)}
                                                    className="px-3 py-1.5 bg-[#FAF5EE] hover:bg-[#F2EADB] text-[#7C5E3F] font-bold text-xs rounded-xl flex items-center gap-1 transition-colors border border-[#7C5E3F]/20"
                                                >
                                                    <span>{isExpanded ? 'Hide Steps' : 'View Steps'}</span>
                                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                </button>

                                                {/* Admin Card Actions */}
                                                {isAdmin && (
                                                    <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleGuideActive(guide)}
                                                            title={guide.is_active ? 'Pause / Deactivate' : 'Activate Guide'}
                                                            className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-lg transition-colors"
                                                        >
                                                            {guide.is_active ? <Eye className="w-3.5 h-3.5 text-emerald-600" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
                                                        </button>

                                                        <button
                                                            type="button"
                                                            disabled={index === 0}
                                                            onClick={() => handleReorderGuide(index, 'up')}
                                                            title="Move Up"
                                                            className="p-1.5 hover:bg-slate-100 text-slate-500 disabled:opacity-30 rounded-lg transition-colors"
                                                        >
                                                            <ArrowUp className="w-3.5 h-3.5" />
                                                        </button>

                                                        <button
                                                            type="button"
                                                            disabled={index === visibleGuides.length - 1}
                                                            onClick={() => handleReorderGuide(index, 'down')}
                                                            title="Move Down"
                                                            className="p-1.5 hover:bg-slate-100 text-slate-500 disabled:opacity-30 rounded-lg transition-colors"
                                                        >
                                                            <ArrowDown className="w-3.5 h-3.5" />
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => setEditingGuide({ ...guide, steps: guide.steps.map(s => ({ ...s })) })}
                                                            title="Edit Guide"
                                                            className="p-1.5 hover:bg-slate-100 text-[#7C5E3F] rounded-lg transition-colors"
                                                        >
                                                            <Edit className="w-3.5 h-3.5" />
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteGuide(guide.id)}
                                                            title="Delete Guide"
                                                            className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Expanded Step-by-Step Instructions */}
                                        {isExpanded && (
                                            <div className="mt-5 pt-4 border-t border-slate-150 space-y-4 animate-in fade-in duration-200">
                                                <HowToGuideViewer
                                                    guide={guide}
                                                    mode="embedded"
                                                    hideHeader={true}
                                                    onNavigateToPolicy={(policyId) => {
                                                        setMainTab('policies');
                                                        setActiveSection(policyId);
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════
                MODAL: WATCH TUTORIAL VIDEO
            ════════════════════════════════════════════════════════════════════ */}
            {videoModalUrl && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-black rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative border border-white/10 flex flex-col">
                        <div className="flex items-center justify-between p-3 bg-zinc-900 border-b border-zinc-800 text-white">
                            <span className="text-xs font-bold">Tutorial Video</span>
                            <button
                                type="button"
                                onClick={() => setVideoModalUrl(null)}
                                className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="aspect-video w-full">
                            <iframe 
                                src={videoModalUrl} 
                                title="Tutorial Video"
                                className="w-full h-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════
                MODAL: ADMIN EDIT POLICY CLAUSES
            ════════════════════════════════════════════════════════════════════ */}
            {editingSection && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 select-text animate-fadeIn">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 text-left">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                            <div className="flex items-center gap-2">
                                <Edit className="w-5 h-5 text-[#7C5E3F]" />
                                <h3 className="font-bold text-base text-slate-900 dark:text-white">Edit Policy: {editingSection.title}</h3>
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

                            <div className="space-y-4">
                                {editingSection.points.map((pt, idx) => (
                                    <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-700 relative group text-left">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Clause #{idx + 1}</span>
                                            <div className="flex items-center gap-2">
                                                <label className="flex items-center gap-1.5 text-xs text-amber-700 font-bold cursor-pointer">
                                                    <input 
                                                        type="checkbox"
                                                        checked={!!pt.isCritical}
                                                        onChange={(e) => {
                                                            const pts = [...editingSection.points];
                                                            pts[idx].isCritical = e.target.checked;
                                                            setEditingSection({ ...editingSection, points: pts });
                                                        }}
                                                        className="rounded text-amber-600 focus:ring-amber-500"
                                                    />
                                                    Critical / Highlight
                                                </label>
                                                <button 
                                                    onClick={() => {
                                                        const pts = editingSection.points.filter((_, i) => i !== idx);
                                                        setEditingSection({ ...editingSection, points: pts });
                                                    }}
                                                    className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <input 
                                                type="text"
                                                value={pt.title}
                                                onChange={(e) => {
                                                    const pts = [...editingSection.points];
                                                    pts[idx].title = e.target.value;
                                                    setEditingSection({ ...editingSection, points: pts });
                                                }}
                                                placeholder="Clause Title"
                                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                                            />
                                            <textarea 
                                                value={pt.description}
                                                rows={4}
                                                onChange={(e) => {
                                                    const pts = [...editingSection.points];
                                                    pts[idx].description = e.target.value;
                                                    setEditingSection({ ...editingSection, points: pts });
                                                }}
                                                placeholder="Clause Description..."
                                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50 dark:bg-slate-900/50">
                            <button 
                                onClick={() => setEditingSection(null)}
                                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSavePolicy}
                                disabled={isSavingPolicy}
                                className="px-5 py-2.5 bg-[#7C5E3F] hover:bg-[#6A4E31] text-white text-xs font-extrabold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                            >
                                {isSavingPolicy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════
                MODAL: ADMIN EDIT / CREATE HOW-TO GUIDE
            ════════════════════════════════════════════════════════════════════ */}
            {editingGuide && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 select-text animate-fadeIn">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 text-left">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                            <div className="flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-[#7C5E3F]" />
                                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                                    {editingGuide.title ? `Edit Guide: ${editingGuide.title}` : 'Add New How-To Guide'}
                                </h3>
                            </div>
                            <button 
                                onClick={() => setEditingGuide(null)} 
                                className="p-1 hover:bg-slate-200 rounded-full text-slate-400"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    Guide Title
                                </label>
                                <input
                                    type="text"
                                    value={editingGuide.title}
                                    onChange={(e) => setEditingGuide({ ...editingGuide, title: e.target.value })}
                                    placeholder="e.g., How to Request a Makeup Class"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 outline-none"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    Short Description
                                </label>
                                <textarea
                                    rows={2}
                                    value={editingGuide.description}
                                    onChange={(e) => setEditingGuide({ ...editingGuide, description: e.target.value })}
                                    placeholder="A concise summary of what the student will learn..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 outline-none leading-relaxed"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                        Related Policy (Optional)
                                    </label>
                                    <select
                                        value={editingGuide.related_policy_id || ''}
                                        onChange={(e) => setEditingGuide({ ...editingGuide, related_policy_id: e.target.value || null })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none"
                                    >
                                        <option value="">None</option>
                                        <option value="attendance">Attendance & Leaves Policy</option>
                                        <option value="progress">Student Progress & Evaluation</option>
                                        <option value="fees">Fees & Payments Policy</option>
                                        <option value="conduct">General Conduct & Riyaaz</option>
                                        <option value="ip">Learning Materials & Copyright</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                        Tutorial Video URL (Optional)
                                    </label>
                                    <input
                                        type="url"
                                        value={editingGuide.video_url || ''}
                                        onChange={(e) => setEditingGuide({ ...editingGuide, video_url: e.target.value })}
                                        placeholder="https://..."
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-4 pt-1">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={editingGuide.is_active}
                                        onChange={(e) => setEditingGuide({ ...editingGuide, is_active: e.target.checked })}
                                        className="rounded text-[#7C5E3F] focus:ring-[#7C5E3F]"
                                    />
                                    Active / Published to Students
                                </label>
                            </div>

                            {/* Steps Editor */}
                            <div className="border-t border-slate-150 pt-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                                        Step-by-Step Instructions
                                    </h4>
                                    {!isMethodBasedGuide(editingGuide) && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const currentSteps = (editingGuide.steps as HowToStep[]) || [];
                                                const newSteps = [...currentSteps, { order: currentSteps.length + 1, text: '' }];
                                                setEditingGuide({ ...editingGuide, steps: newSteps });
                                            }}
                                            className="px-2.5 py-1 bg-[#7C5E3F] text-white text-[10px] font-bold rounded-lg flex items-center gap-1"
                                        >
                                            <Plus className="w-3 h-3" /> Add Step
                                        </button>
                                    )}
                                </div>

                                {isMethodBasedGuide(editingGuide) ? (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                                        <p className="font-bold">Multi-Method Structure (3 Methods Configured)</p>
                                        <p className="text-[11px] text-amber-700">
                                            This guide uses interactive submission method options (YouTube Unlisted, Google Drive Shared, Portal Upload). The method tabs and steps are preserved.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {((editingGuide.steps as HowToStep[]) || []).map((st, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                                                    {idx + 1}
                                                </span>
                                                <input
                                                    type="text"
                                                    value={st.text}
                                                    onChange={(e) => {
                                                        const newSteps = [...(editingGuide.steps as HowToStep[])];
                                                        newSteps[idx] = { order: idx + 1, text: e.target.value };
                                                        setEditingGuide({ ...editingGuide, steps: newSteps });
                                                    }}
                                                    placeholder={`Step ${idx + 1} instruction...`}
                                                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newSteps = (editingGuide.steps as HowToStep[]).filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 }));
                                                        setEditingGuide({ ...editingGuide, steps: newSteps });
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3 bg-slate-50">
                            <button
                                type="button"
                                onClick={() => setEditingGuide(null)}
                                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isSavingGuide || !editingGuide.title.trim()}
                                onClick={() => handleSaveGuide(editingGuide)}
                                className="px-5 py-2.5 bg-[#7C5E3F] hover:bg-[#6A4E31] disabled:opacity-50 text-white text-xs font-extrabold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                            >
                                {isSavingGuide && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                Save Guide
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
