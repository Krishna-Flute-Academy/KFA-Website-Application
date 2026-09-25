'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { 
    Sparkles, 
    ArrowRight, 
    CheckCircle2, 
    Play, 
    Lock, 
    GraduationCap, 
    MessageCircle,
    Music
} from 'lucide-react';
import PublicNavbar from '../../../src/components/PublicNavbar';
import StudentAccessModal from '../../../src/components/tools/StudentAccessModal';
import { useAuthNavigation } from '../../../src/lib/auth-navigation';
import { trackToolEvent } from '../../../src/lib/analytics';

const SurToNotationModal = dynamic(() => import('../../../src/components/tools/sur-to-notation/SurToNotationModal'), { ssr: false });

export default function ClientFluteToNotesPage() {
    const { hasStudentAccess } = useAuthNavigation();
    const [showSurToNotation, setShowSurToNotation] = useState(false);
    const [showAccessModal, setShowAccessModal] = useState(false);

    useEffect(() => {
        trackToolEvent('practice_tools_view', { page: 'flute-to-notes' });
    }, []);

    const whatsappUrl = `https://wa.me/919900119616?text=${encodeURIComponent(
        "Hello Krishna Flute Academy! I was reading about the Flute to Notes (Sur to Notation) student tool and would like to discuss my Bansuri learning level."
    )}`;

    const handleLaunchClick = () => {
        if (!hasStudentAccess) {
            trackToolEvent('student_tool_interest', { tool: 'Flute to Notes (Sur to Notation)' });
            setShowAccessModal(true);
        } else {
            trackToolEvent('sur_to_notation_open', { source: 'flute_to_notes_page' });
            setShowSurToNotation(true);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 antialiased selection:bg-amber-200 selection:text-amber-900 flex flex-col font-sans">
            <PublicNavbar activePath="/practice-tools" />

            {/* Student Access Modal for public visitors */}
            <StudentAccessModal
                isOpen={showAccessModal}
                onClose={() => setShowAccessModal(false)}
                toolName="Flute to Notes (Sur to Notation)"
            />

            {/* Interactive Tool Modal for authenticated students */}
            {showSurToNotation && hasStudentAccess && (
                <SurToNotationModal onClose={() => setShowSurToNotation(false)} />
            )}

            {/* Breadcrumb Navigation */}
            <div className="bg-slate-100/80 border-b border-slate-200 py-2.5 px-4 sm:px-6 lg:px-8">
                <div className="max-w-6xl mx-auto text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                    <Link href="/" className="hover:text-blue-900 transition-colors">Home</Link>
                    <span>/</span>
                    <Link href="/practice-tools" className="hover:text-blue-900 transition-colors">Practice Tools</Link>
                    <span>/</span>
                    <span className="text-slate-800 font-semibold">Flute to Notes</span>
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
                        Flute to Notes (Sur to Notation)
                    </h1>

                    <p className="text-sm sm:text-base text-blue-100/90 max-w-2xl mx-auto leading-relaxed">
                        Strengthen the connection between what you hear, what you play and how musical notes are understood through interactive Bansuri practice.
                    </p>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 flex-1 w-full">
                {/* Tool Preview & Launcher Card */}
                <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-10 shadow-sm hover:shadow-md transition-all text-center mb-12 relative overflow-hidden">
                    <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center mx-auto mb-5 shadow-xs">
                        <Sparkles className="w-8 h-8" />
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold uppercase tracking-wider mb-3">
                        <Lock className="w-3 h-3" />
                        <span>KFA Student Tool</span>
                    </div>

                    <h2 className="text-2xl font-black text-slate-900 mb-2">
                        Flute to Notes (Sur to Notation)
                    </h2>
                    <p className="text-sm text-slate-600 max-w-lg mx-auto mb-2 leading-relaxed">
                        Strengthen the connection between what you hear, what you play and how musical notes are understood through interactive Bansuri practice.
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
                            <span>Open Flute to Notes</span>
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
                            <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                            Live Transcription Highlights
                        </h3>
                        <ul className="space-y-3 text-xs sm:text-sm text-slate-700">
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <span><strong>Real-Time Acoustic Ear Training:</strong> Recognizes notes played on any scale Bansuri by aligning the tonic Sa to your flute root.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <span><strong>Indian Classical Bhatkhande Sargam:</strong> Displays authentic swaras including Shuddha, Komal, Tivra Ma, and Mandra/Tara saptaks.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <span><strong>Export & Rehearsal Review:</strong> Save transcribed phrases as digital notation text to review your practice runs.</span>
                            </li>
                        </ul>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs">
                        <h3 className="text-lg font-black text-slate-900 mb-3 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                            What This Tool Helps Develop
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                            Transitioning from mechanical fingering to mindful listening is a key leap in learning Bansuri:
                        </p>
                        <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700">
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <span><strong>Ear-to-Hand Reflex:</strong> Verify that the swara in your mind matches the actual note produced by your breath and embouchure.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <span><strong>Intonation Accuracy:</strong> Immediate feedback prevents practicing accidental flat or sharp notes repeatedly.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <span><strong>Phrase Articulation:</strong> Visual feedback encourages clean attacks and distinct separation between successive notes.</span>
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
                            onClick={() => trackToolEvent('student_tool_course_click', { tool: 'Flute to Notes (Sur to Notation)' })}
                            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-extrabold text-xs sm:text-sm rounded-full transition-all text-center shadow-md"
                        >
                            Explore Bansuri Courses
                        </Link>
                        <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => trackToolEvent('student_tool_enquiry_click', { tool: 'Flute to Notes (Sur to Notation)' })}
                            className="w-full sm:w-auto px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-xs sm:text-sm rounded-full transition-all text-center"
                        >
                            Discuss My Learning Level
                        </a>
                        <Link
                            href="/login"
                            onClick={() => trackToolEvent('student_tool_login_click', { tool: 'Flute to Notes (Sur to Notation)' })}
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
