'use client';

import React, { useState } from 'react';
import { 
    BookOpen, 
    Calendar, 
    CreditCard, 
    ShieldCheck, 
    Clock, 
    CheckCircle2, 
    Info, 
    Scroll,
    UserCheck,
    Lock
} from 'lucide-react';

interface PolicySection {
    id: string;
    title: string;
    icon: any;
    subtitle: string;
    points: {
        title: string;
        description: string;
        isCritical?: boolean;
    }[];
}

export default function AcademyPolicies() {
    const [activeSection, setActiveSection] = useState<string>('conduct');

    const sections: PolicySection[] = [
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
                    title: 'Leave Notice Period',
                    description: 'If you cannot attend a scheduled class, notify the academy or submit a leave request at least 24 hours in advance.',
                    isCritical: true
                },
                {
                    title: 'Emergency Leaves',
                    description: 'Unexpected emergencies or health issues should be reported as early as possible. Excuses submitted post-class will be approved at the instructor\'s discretion.'
                },
                {
                    title: 'Slot Rescheduling & Make-up Classes',
                    description: 'Make-up classes are not guaranteed for unexcused absences. Excused leaves with timely notice will be rescheduled subject to slot availability.'
                },
                {
                    title: 'Consecutive Absences',
                    description: 'Missing 3 consecutive classes without prior approval or contact will lead to automatic slot suspension, requiring a re-allocation query.'
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
                    description: 'Fees are collected in advance at the start of each billing cycle (monthly or per-class package, depending on your allocation).'
                },
                {
                    title: 'Payment Deadlines & Late Fees',
                    description: 'Dues must be cleared within the first 7 days of the billing cycle. Payments received after the grace period may incur a late fee.',
                    isCritical: true
                },
                {
                    title: 'Non-Refundable Policy',
                    description: 'Fees paid to the academy are non-refundable and non-transferable under any circumstances.'
                },
                {
                    title: 'Class Extension / Suspension',
                    description: 'If you wish to suspend classes temporarily (e.g. for vacations longer than 2 weeks), notify the admin team at least 15 days in advance to lock your slot rate.'
                }
            ]
        },
        {
            id: 'ip',
            title: 'Academic & IP Protection',
            icon: Lock,
            subtitle: 'Protection of curriculum, audio tracks, and learning materials.',
            points: [
                {
                    title: 'Proprietary Learning Material',
                    description: 'All worksheets, notations (Sargam sheets), and custom practice tracks provided in the portal are proprietary materials of Krishna Flute Academy.'
                },
                {
                    title: 'No Unauthorized Sharing',
                    description: 'Sharing sargam notations, class recordings, or proprietary tools outside the academy is strictly prohibited and violates terms of admission.',
                    isCritical: true
                },
                {
                    title: 'Respecting Intellectual Property',
                    description: 'Do not upload class instructional videos or custom loops to public platforms (like YouTube, Drive, or Social Media) without written permission.'
                }
            ]
        }
    ];

    const activeData = sections.find(s => s.id === activeSection) || sections[0];
    const ActiveIcon = activeData.icon;

    return (
        <div className="w-full space-y-6">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-[#7C5E3F] via-[#9F7A56] to-[#FAF5EE]/20 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-md border border-[#E6E1DA]/10 text-left">
                {/* Decorative background circle */}
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
            <div className="flex flex-col lg:flex-row gap-6 items-stretch">
                {/* Left Side: Navigation Links */}
                <div className="lg:w-64 shrink-0 flex flex-row lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-none text-left">
                    {sections.map((section) => {
                        const Icon = section.icon;
                        const active = section.id === activeSection;
                        return (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-xs md:text-sm font-bold border shrink-0 lg:w-full select-none ${
                                    active 
                                        ? 'bg-[#FAF5EE] border-[#7C5E3F]/30 text-[#7C5E3F] shadow-xs' 
                                        : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50/80 hover:text-slate-800'
                                }`}
                            >
                                <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-[#7C5E3F]' : 'text-slate-400'}`} />
                                <span className="truncate">{section.title}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Right Side: Policy Details Card */}
                <div className="flex-1 bg-white border border-slate-150 rounded-3xl p-6 md:p-8 flex flex-col justify-between shadow-xs animate-in fade-in slide-in-from-bottom-2 duration-300 text-left">
                    <div className="space-y-6">
                        {/* Section Title */}
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
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

                        {/* Policy Points */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {activeData.points.map((point, index) => (
                                <div 
                                    key={index} 
                                    className={`p-4 rounded-2xl border transition-all duration-200 hover:shadow-xs text-left ${
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
        </div>
    );
}
