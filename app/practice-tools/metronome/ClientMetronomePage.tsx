'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { 
    Volume2, 
    Sparkles, 
    ArrowRight, 
    CheckCircle2, 
    Play
} from 'lucide-react';
import PublicNavbar from '../../../src/components/PublicNavbar';
import { trackToolEvent } from '../../../src/lib/analytics';

const PracticeSuiteModal = dynamic(() => import('../../../src/components/PracticeSuiteModal'), { ssr: false });

export default function ClientMetronomePage() {
    const [showMetronome, setShowMetronome] = useState(false);

    useEffect(() => {
        trackToolEvent('practice_tools_view', { page: 'metronome' });
    }, []);

    const whatsappUrl = `https://wa.me/919900119616?text=${encodeURIComponent(
        "Hello Krishna Flute Academy! I am practising with your online Metronome and would like to learn more about your structured Bansuri classes."
    )}`;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 antialiased selection:bg-amber-200 selection:text-amber-900 flex flex-col font-sans">
            <PublicNavbar activePath="/practice-tools" />

            {showMetronome && (
                <PracticeSuiteModal
                    defaultTab="metronome"
                    onClose={() => setShowMetronome(false)}
                />
            )}

            {/* Breadcrumb Navigation */}
            <div className="bg-slate-100/80 border-b border-slate-200 py-2.5 px-4 sm:px-6 lg:px-8">
                <div className="max-w-6xl mx-auto text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                    <Link href="/" className="hover:text-blue-900 transition-colors">Home</Link>
                    <span>/</span>
                    <Link href="/practice-tools" className="hover:text-blue-900 transition-colors">Practice Tools</Link>
                    <span>/</span>
                    <span className="text-slate-800 font-semibold">Practice Metronome</span>
                </div>
            </div>

            {/* Hero Section */}
            <header className="bg-gradient-to-b from-blue-950 via-slate-900 to-slate-900 text-white py-16 sm:py-20 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden">
                <div className="max-w-4xl mx-auto relative z-10">
                    <div className="inline-flex items-center gap-2 bg-emerald-400/15 border border-emerald-400/30 text-emerald-300 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Free Online Riyaz Tool</span>
                    </div>

                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-4 leading-tight">
                        Online Flute Practice Metronome
                    </h1>

                    <p className="text-sm sm:text-base text-blue-100/90 max-w-2xl mx-auto leading-relaxed">
                        Develop rock-solid timing, master rhythmic subdivisions, and build finger dexterity with a high-precision Web Audio metronome.
                    </p>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 flex-1 w-full">
                {/* Interactive Tool Launcher Card */}
                <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-10 shadow-sm hover:shadow-md transition-all text-center mb-12 relative overflow-hidden">
                    <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto mb-5 shadow-xs">
                        <Volume2 className="w-8 h-8" />
                    </div>

                    <h2 className="text-2xl font-black text-slate-900 mb-2">
                        Launch Practice Metronome
                    </h2>
                    <p className="text-sm text-slate-600 max-w-lg mx-auto mb-6 leading-relaxed">
                        Custom tempo from 20 to 300 BPM, tap tempo, sound selection (Woodblock / Bell), and progressive tempo ramp acceleration.
                    </p>

                    <button
                        onClick={() => {
                            trackToolEvent('metronome_open', { source: 'metronome_page' });
                            setShowMetronome(true);
                        }}
                        className="py-3.5 px-8 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-sm shadow-md hover:shadow-lg transition-all inline-flex items-center gap-2.5 cursor-pointer active:scale-95"
                    >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Start Metronome</span>
                    </button>
                </div>

                {/* Educational Content */}
                <div className="grid md:grid-cols-2 gap-8 mb-12">
                    <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs">
                        <h3 className="text-lg font-black text-slate-900 mb-3 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                            Key Features
                        </h3>
                        <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700">
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <span><strong>Wide Tempo Range:</strong> 20 BPM for slow breath-holding to 300 BPM for high-speed taans.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <span><strong>Tap Tempo:</strong> Tap in sync with any melody to automatically detect its BPM.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <span><strong>Progressive Tempo Ramp:</strong> Gradually accelerates tempo over time to build agility.</span>
                            </li>
                        </ul>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs">
                        <h3 className="text-lg font-black text-slate-900 mb-3 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
                            How It Supports Bansuri Riyaz
                        </h3>
                        <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700">
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <span><strong>Alankar Practice:</strong> Play basic swara patterns (Sa Re Ga Ma) at constant speed.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <span><strong>Laya Control:</strong> Switch between Vilambit (slow), Madhya (medium), and Drut (fast).</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <span><strong>Finger Agility:</strong> Eliminates unconscious rushing and uneven finger transitions.</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Course Journey Callout */}
                <div className="bg-gradient-to-br from-blue-950 via-slate-900 to-slate-900 text-white rounded-3xl p-8 shadow-md flex flex-col md:flex-row items-center justify-between gap-6 border border-slate-800">
                    <div>
                        <span className="text-xs uppercase tracking-widest font-extrabold text-amber-300 bg-amber-400/20 px-3 py-1 rounded-full inline-block mb-3 border border-amber-400/30">
                            Guided Learning
                        </span>
                        <h3 className="text-2xl font-extrabold mb-2">
                            Practising on Your Own?
                        </h3>
                        <p className="text-blue-100/90 text-sm max-w-lg leading-relaxed">
                            Practice tools can help you work on pitch, rhythm and listening. Structured guidance helps you understand what to practise, identify mistakes and develop musicianship step by step.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full sm:w-auto">
                        <Link
                            href="/courses"
                            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-extrabold text-xs sm:text-sm rounded-full transition-all text-center shadow-md"
                        >
                            Explore Bansuri Courses
                        </Link>
                        <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full sm:w-auto px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-xs sm:text-sm rounded-full transition-all text-center"
                        >
                            Talk to Krishna Flute Academy
                        </a>
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
