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
