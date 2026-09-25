'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { 
    Music2, 
    Sparkles, 
    ArrowRight, 
    CheckCircle2, 
    Play
} from 'lucide-react';
import PublicNavbar from '../../../src/components/PublicNavbar';
import { trackToolEvent } from '../../../src/lib/analytics';

const PracticeSuiteModal = dynamic(() => import('../../../src/components/PracticeSuiteModal'), { ssr: false });

export default function ClientTanpuraPage() {
    const [showTanpura, setShowTanpura] = useState(false);

    useEffect(() => {
        trackToolEvent('practice_tools_view', { page: 'tanpura' });
    }, []);

    const whatsappUrl = `https://wa.me/919900119616?text=${encodeURIComponent(
        "Hello Krishna Flute Academy! I am practising with your online Tanpura Drone and would like to learn more about your Bansuri Riyaz guidance."
    )}`;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 antialiased selection:bg-amber-200 selection:text-amber-900 flex flex-col font-sans">
            <PublicNavbar activePath="/practice-tools" />

            {showTanpura && (
                <PracticeSuiteModal
                    defaultTab="tanpura"
                    onClose={() => setShowTanpura(false)}
                />
            )}

            {/* Breadcrumb Navigation */}
            <div className="bg-slate-100/80 border-b border-slate-200 py-2.5 px-4 sm:px-6 lg:px-8">
                <div className="max-w-6xl mx-auto text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                    <Link href="/" className="hover:text-blue-900 transition-colors">Home</Link>
                    <span>/</span>
                    <Link href="/practice-tools" className="hover:text-blue-900 transition-colors">Practice Tools</Link>
                    <span>/</span>
                    <span className="text-slate-800 font-semibold">Tanpura Drone</span>
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
                        Online Tanpura Drone for Flute Riyaz
                    </h1>

                    <p className="text-sm sm:text-base text-blue-100/90 max-w-2xl mx-auto leading-relaxed">
                        Immerse your flute practice in an authentic Indian acoustic drone. Calibrate your pitch across 12 Shruti keys and 4 traditional string tuning modes.
                    </p>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 flex-1 w-full">
                {/* Interactive Tool Launcher Card */}
                <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-10 shadow-sm hover:shadow-md transition-all text-center mb-12 relative overflow-hidden">
                    <div className="w-16 h-16 rounded-2xl bg-orange-50 text-[#d46211] border border-orange-200 flex items-center justify-center mx-auto mb-5 shadow-xs">
                        <Music2 className="w-8 h-8" />
                    </div>

                    <h2 className="text-2xl font-black text-slate-900 mb-2">
                        Launch Tanpura Drone
                    </h2>
                    <p className="text-sm text-slate-600 max-w-lg mx-auto mb-6 leading-relaxed">
                        Select your flute's tonic (C, C#, D, E Bass), choose string tuning (Pa-Sa, Ma-Sa, Ni-Sa), and adjust tempo and fine cents tuning.
                    </p>

                    <button
                        onClick={() => {
                            trackToolEvent('tanpura_open', { source: 'tanpura_page' });
                            setShowTanpura(true);
                        }}
                        className="py-3.5 px-8 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-sm shadow-md hover:shadow-lg transition-all inline-flex items-center gap-2.5 cursor-pointer active:scale-95"
                    >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Start Tanpura</span>
                    </button>
                </div>

                {/* Educational Content */}
                <div className="grid md:grid-cols-2 gap-8 mb-12">
                    <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs">
                        <h3 className="text-lg font-black text-slate-900 mb-3 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                            4 Traditional Tuning Modes
                        </h3>
                        <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700">
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <span><strong>Pa - Sa:</strong> Perfect 5th drone for most traditional ragas (Yaman, Bhupali, Bilawal).</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <span><strong>Ma - Sa:</strong> Perfect 4th drone for ragas that omit Pa or emphasize Shuddha Ma (Malkauns, Bageshree).</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <span><strong>Ni - Sa:</strong> Shuddha Ni drone for ragas with dominant Ni (Marwa, Puriya).</span>
                            </li>
                        </ul>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs">
                        <h3 className="text-lg font-black text-slate-900 mb-3 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
                            Why Practice with a Tanpura?
                        </h3>
                        <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700">
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <span><strong>Shruti Alignment:</strong> Helps the ear lock into natural just-intonation intervals.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <span><strong>Breath & Tone Warmup:</strong> Practise Kharaj (low octave) long tones against the drone.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <span><strong>Meditative Focus:</strong> Creates the authentic Indian classical atmosphere for your daily Riyaz.</span>
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
