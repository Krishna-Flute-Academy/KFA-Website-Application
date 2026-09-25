'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { 
    Layers, 
    Sparkles, 
    ArrowRight, 
    CheckCircle2, 
    Play, 
    Lock, 
    GraduationCap, 
    MessageCircle,
    Music2
} from 'lucide-react';
import PublicNavbar from '../../../src/components/PublicNavbar';
import StudentAccessModal from '../../../src/components/tools/StudentAccessModal';
import { useAuthNavigation } from '../../../src/lib/auth-navigation';
import { trackToolEvent } from '../../../src/lib/analytics';

const PracticeSuiteModal = dynamic(() => import('../../../src/components/PracticeSuiteModal'), { ssr: false });

export default function ClientRhythmMachinePage() {
    const { hasStudentAccess } = useAuthNavigation();
    const [showDrums, setShowDrums] = useState(false);
    const [showAccessModal, setShowAccessModal] = useState(false);

    useEffect(() => {
        trackToolEvent('practice_tools_view', { page: 'rhythm-machine' });
    }, []);

    const whatsappUrl = `https://wa.me/919900119616?text=${encodeURIComponent(
        "Hello Krishna Flute Academy! I was reading about the Rhythm Machine student tool and would like to discuss my Bansuri learning level."
    )}`;

    const handleLaunchClick = () => {
        if (!hasStudentAccess) {
            trackToolEvent('student_tool_interest', { tool: 'Rhythm Machine' });
            setShowAccessModal(true);
        } else {
            trackToolEvent('drums_open', { source: 'rhythm_machine_page' });
            setShowDrums(true);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 antialiased selection:bg-amber-200 selection:text-amber-900 flex flex-col font-sans">
            <PublicNavbar activePath="/practice-tools" />

            {/* Student Access Modal for public visitors */}
            <StudentAccessModal
                isOpen={showAccessModal}
                onClose={() => setShowAccessModal(false)}
                toolName="Rhythm Machine"
            />

            {/* Interactive Tool Modal for authenticated students */}
            {showDrums && hasStudentAccess && (
                <PracticeSuiteModal
                    defaultTab="drums"
                    isComboMode={false}
                    onClose={() => setShowDrums(false)}
                />
            )}

            {/* Breadcrumb Navigation */}
            <div className="bg-slate-100/80 border-b border-slate-200 py-2.5 px-4 sm:px-6 lg:px-8">
                <div className="max-w-6xl mx-auto text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                    <Link href="/" className="hover:text-blue-900 transition-colors">Home</Link>
                    <span>/</span>
                    <Link href="/practice-tools" className="hover:text-blue-900 transition-colors">Practice Tools</Link>
                    <span>/</span>
                    <span className="text-slate-800 font-semibold">Rhythm Machine</span>
                </div>
            </div>

            {/* Hero Section */}
            <header className="bg-gradient-to-b from-blue-950 via-slate-900 to-slate-900 text-white py-16 sm:py-20 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden">
                <div className="max-w-4xl mx-auto relative z-10">
                    <div className="inline-flex items-center gap-2 bg-amber-400/20 border border-amber-400/30 text-amber-300 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-5">
                        <GraduationCap className="w-3.5 h-3.5" />
                        <span>KFA Student Exclusive Tool</span>
                    </div>

                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-4 leading-tight">
                        Rhythm Machine & Tabla Sequencer
                    </h1>

                    <p className="text-sm sm:text-base text-blue-100/90 max-w-2xl mx-auto leading-relaxed">
                        Practise musical phrases with rhythmic accompaniment and strengthen timing, coordination and Taal awareness.
                    </p>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 flex-1 w-full">
                {/* Tool Preview & Launcher Card */}
                <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-10 shadow-sm hover:shadow-md transition-all text-center mb-12 relative overflow-hidden">
                    <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center mx-auto mb-5 shadow-xs">
                        <Layers className="w-8 h-8" />
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold uppercase tracking-wider mb-3">
                        <Lock className="w-3 h-3" />
                        <span>KFA Student Tool</span>
                    </div>

                    <h2 className="text-2xl font-black text-slate-900 mb-2">
                        Rhythm Machine
                    </h2>
                    <p className="text-sm text-slate-600 max-w-lg mx-auto mb-2 leading-relaxed">
                        Practise musical phrases with rhythmic accompaniment and strengthen timing, coordination and Taal awareness.
                    </p>
                    <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
                        Available as part of the KFA student learning experience.
                    </p>

                    {hasStudentAccess ? (
                        <button
                            onClick={handleLaunchClick}
                            className="py-3.5 px-8 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-sm shadow-md hover:shadow-lg transition-all inline-flex items-center gap-2.5 cursor-pointer active:scale-95"
                        >
                            <Play className="w-4 h-4 fill-current" />
                            <span>Open Rhythm Machine</span>
                        </button>
                    ) : (
                        <button
                            onClick={handleLaunchClick}
                            className="py-3.5 px-8 rounded-full bg-gradient-to-r from-blue-900 to-slate-900 hover:from-blue-950 hover:to-black text-amber-300 font-extrabold text-sm shadow-md hover:shadow-lg transition-all inline-flex items-center gap-2.5 cursor-pointer active:scale-95 border border-amber-400/30"
                        >
                            <GraduationCap className="w-4 h-4" />
                            <span>Explore Student Access →</span>
                        </button>
                    )}
                </div>

                {/* Educational Content & What it develops */}
                <div className="grid md:grid-cols-2 gap-8 mb-12">
                    <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs">
                        <h3 className="text-lg font-black text-slate-900 mb-3 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                            Taals & Groove Features
                        </h3>
                        <ul className="space-y-3 text-xs sm:text-sm text-slate-700">
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <span><strong>Hindustani Classical Taals:</strong> Teen Taal (16 Matras), Keherwa (8), Dadra (6), Bhajni (8), and Rupak (7).</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <span><strong>Visual Sam & Khali Indicator:</strong> Clear visual feedback on downbeats (Sam) and offbeats (Khali) to keep musical cycles locked.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <span><strong>Interactive Step Sequencer:</strong> 4 synthesized channels (Kick, Snare, Hi-hat, Shaker) across customizable time signatures.</span>
                            </li>
                        </ul>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs">
                        <h3 className="text-lg font-black text-slate-900 mb-3 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                            What This Tool Helps Develop
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                            In Indian classical Bansuri playing, rhythm is inseparable from melody. Attentive practice with rhythmic accompaniment builds core musicality:
                        </p>
                        <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700">
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <span><strong>Layakari & Laya Control:</strong> Learn to play bandishes smoothly across Vilambit (slow), Madhya (medium), and Drut (fast) tempos.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <span><strong>Landing on Sam:</strong> Master the discipline of completing melodic phrases and Tihai patterns exactly on beat one.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <span><strong>Finger Agility:</strong> Transition clean fingering at faster beats without rushing or dragging tempo.</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Section 18: Available to KFA Students Course Journey */}
                <div className="bg-gradient-to-br from-blue-950 via-slate-900 to-slate-900 text-white rounded-3xl p-8 shadow-md flex flex-col md:flex-row items-center justify-between gap-6 border border-slate-800">
                    <div>
                        <span className="text-xs uppercase tracking-widest font-extrabold text-amber-300 bg-amber-400/20 px-3 py-1 rounded-full inline-block mb-3 border border-amber-400/30">
                            Student Riyaz Ecosystem
                        </span>
                        <h3 className="text-2xl font-extrabold mb-2">
                            Available to KFA Students
                        </h3>
                        <p className="text-blue-100/90 text-sm max-w-lg leading-relaxed">
                            Rhythm Machine and Flute to Notes are part of the interactive practice experience available to Krishna Flute Academy students.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full sm:w-auto">
                        <Link
                            href="/courses"
                            onClick={() => trackToolEvent('student_tool_course_click', { tool: 'Rhythm Machine' })}
                            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-extrabold text-xs sm:text-sm rounded-full transition-all text-center shadow-md"
                        >
                            Explore Bansuri Courses
                        </Link>
                        <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => trackToolEvent('student_tool_enquiry_click', { tool: 'Rhythm Machine' })}
                            className="w-full sm:w-auto px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-xs sm:text-sm rounded-full transition-all text-center"
                        >
                            Discuss My Learning Level
                        </a>
                        <Link
                            href="/login"
                            onClick={() => trackToolEvent('student_tool_login_click', { tool: 'Rhythm Machine' })}
                            className="w-full sm:w-auto px-5 py-3 text-xs text-amber-300 hover:underline text-center"
                        >
                            Student Login
                        </Link>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="bg-gradient-to-r from-blue-900 to-yellow-900 text-white py-10 px-4 text-center text-xs text-blue-200 border-t border-blue-950">
                <p>© 2025 Krishna Flute Academy. All rights reserved. | Practice Smarter with KFA Tools</p>
            </footer>
        </div>
    );
}
