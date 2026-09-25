'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { 
    Mic, 
    Sparkles, 
    ShieldCheck, 
    Volume2, 
    ArrowRight, 
    CheckCircle2, 
    MessageCircle,
    Play
} from 'lucide-react';
import PublicNavbar from '../../../src/components/PublicNavbar';
import { trackToolEvent } from '../../../src/lib/analytics';

const FluteTunerModal = dynamic(() => import('../../../src/components/tools/tuner/FluteTunerModal'), { ssr: false });

export default function ClientTunerPage() {
    const [showTuner, setShowTuner] = useState(false);

    useEffect(() => {
        trackToolEvent('practice_tools_view', { page: 'bansuri-tuner' });
    }, []);

    const whatsappUrl = `https://wa.me/919900119616?text=${encodeURIComponent(
        "Hello Krishna Flute Academy! I tried your online Bansuri Tuner and would like to know more about flute learning and classes."
    )}`;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 antialiased selection:bg-amber-200 selection:text-amber-900 flex flex-col font-sans">
            <PublicNavbar activePath="/practice-tools" />

            {showTuner && <FluteTunerModal onClose={() => setShowTuner(false)} />}

            {/* Breadcrumb Navigation */}
            <div className="bg-slate-100/80 border-b border-slate-200 py-2.5 px-4 sm:px-6 lg:px-8">
                <div className="max-w-6xl mx-auto text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                    <Link href="/" className="hover:text-blue-900 transition-colors">Home</Link>
                    <span>/</span>
                    <Link href="/practice-tools" className="hover:text-blue-900 transition-colors">Practice Tools</Link>
                    <span>/</span>
                    <span className="text-slate-800 font-semibold">Bansuri Tuner</span>
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
                        Online Bansuri Tuner & Pitch Detector
                    </h1>

                    <p className="text-sm sm:text-base text-blue-100/90 max-w-2xl mx-auto leading-relaxed">
                        A real-time flute pitch meter designed for Indian classical Bansuri and Western chromatic tuning. Check your Swaras, detect cents deviation, and refine your pitch accuracy.
                    </p>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 flex-1 w-full">
                {/* Interactive Tool Launcher Card */}
                <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-10 shadow-sm hover:shadow-md transition-all text-center mb-12 relative overflow-hidden">
                    <div className="w-16 h-16 rounded-2xl bg-orange-50 text-[#d46211] border border-orange-200 flex items-center justify-center mx-auto mb-5 shadow-xs">
                        <Mic className="w-8 h-8" />
                    </div>

                    <h2 className="text-2xl font-black text-slate-900 mb-2">
                        Launch Bansuri Tuner
                    </h2>
                    <p className="text-sm text-slate-600 max-w-lg mx-auto mb-6 leading-relaxed">
                        This tool uses your device microphone to detect the note you play. Audio is processed for pitch detection entirely on your device and is not recorded or stored.
                    </p>

                    <button
                        onClick={() => {
                            trackToolEvent('tuner_open', { source: 'tuner_page' });
                            setShowTuner(true);
                        }}
                        className="py-3.5 px-8 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-sm shadow-md hover:shadow-lg transition-all inline-flex items-center gap-2.5 cursor-pointer active:scale-95"
                    >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Start Tuner</span>
                    </button>

                    <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-slate-400">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Client-side audio analysis • Zero server recording • Instant feedback</span>
                    </div>
                </div>

                {/* Educational Content: What it does & How it helps */}
                <div className="grid md:grid-cols-2 gap-8 mb-12">
                    <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs">
                        <h3 className="text-lg font-black text-slate-900 mb-3 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                            What the Tool Does
                        </h3>
                        <p className="text-sm text-slate-600 leading-relaxed mb-4">
                            Unlike generic guitar or chromatic tuners, the KFA Bansuri Tuner understands the unique acoustic properties of the Indian bamboo flute:
                        </p>
                        <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700">
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <span><strong>Dual Mode:</strong> Switch between Indian Sargam (Sa, Re, Ga, Ma...) and Chromatic notes.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <span><strong>Flexible Tonic (Sa):</strong> Calibrate to any key flute (C, C#, D, E Bass, G Base, etc.).</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <span><strong>Visual Cent Deviation:</strong> Real-time needle shows if you are sharp (Tivra) or flat (Komal).</span>
                            </li>
                        </ul>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs">
                        <h3 className="text-lg font-black text-slate-900 mb-3 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
                            How It Helps Your Riyaz
                        </h3>
                        <p className="text-sm text-slate-600 leading-relaxed mb-4">
                            In Indian classical music, pitch sensitivity (Sur) is refined through attentive listening and blowing angle adjustments:
                        </p>
                        <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700">
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <span><strong>Embouchure Consistency:</strong> Helps stabilize breath pressure and lip positioning.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <span><strong>Long Tones:</strong> Hold individual Swaras for 8-12 seconds while keeping the needle dead-center.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <span><strong>Developing Muscle Memory:</strong> Learn how rolling the flute inward or outward affects pitch.</span>
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
