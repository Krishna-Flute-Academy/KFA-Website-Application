'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { 
    Volume2, 
    Music2, 
    Mic, 
    Sparkles, 
    ArrowRight, 
    CheckCircle2, 
    MessageCircle, 
    ShieldCheck, 
    Compass, 
    GraduationCap, 
    Lock, 
    Sliders,
    Layers,
    Play,
    ChevronRight
} from 'lucide-react';
import PublicNavbar from '../../src/components/PublicNavbar';
import { trackToolEvent } from '../../src/lib/analytics';

import { useAuthNavigation } from '../../src/lib/auth-navigation';
import StudentAccessModal from '../../src/components/tools/StudentAccessModal';

// Lazy load practice tools modals for high performance
const FluteTunerModal = dynamic(() => import('../../src/components/tools/tuner/FluteTunerModal'), { ssr: false });
const PracticeSuiteModal = dynamic(() => import('../../src/components/PracticeSuiteModal'), { ssr: false });
const SurToNotationModal = dynamic(() => import('../../src/components/tools/sur-to-notation/SurToNotationModal'), { ssr: false });

export default function ClientPracticeToolsPage() {
    const { hasStudentAccess } = useAuthNavigation();

    // Tool modal states
    const [showTuner, setShowTuner] = useState(false);
    const [showSurToNotation, setShowSurToNotation] = useState(false);
    const [showPracticeSuite, setShowPracticeSuite] = useState(false);
    const [practiceSuiteTab, setPracticeSuiteTab] = useState<'metronome' | 'tanpura' | 'drums' | 'combosetup'>('metronome');
    const [accessModalTool, setAccessModalTool] = useState<string | null>(null);

    useEffect(() => {
        trackToolEvent('practice_tools_view', { page: 'practice-tools' });
    }, []);

    const whatsappConsultationUrl = `https://wa.me/919900119616?text=${encodeURIComponent(
        "Hello Krishna Flute Academy! I was exploring your online practice tools and would like to discuss which Bansuri learning course is right for me."
    )}`;

    const handleOpenTuner = () => {
        trackToolEvent('free_tool_open', { tool: 'tuner', source: 'practice_tools_hub' });
        trackToolEvent('tuner_open', { source: 'practice_tools_hub' });
        trackToolEvent('tool_open', { tool: 'tuner' });
        setShowTuner(true);
    };

    const handleOpenMetronome = () => {
        trackToolEvent('free_tool_open', { tool: 'metronome', source: 'practice_tools_hub' });
        trackToolEvent('metronome_open', { source: 'practice_tools_hub' });
        trackToolEvent('tool_open', { tool: 'metronome' });
        setPracticeSuiteTab('metronome');
        setShowPracticeSuite(true);
    };

    const handleOpenTanpura = () => {
        trackToolEvent('free_tool_open', { tool: 'tanpura', source: 'practice_tools_hub' });
        trackToolEvent('tanpura_open', { source: 'practice_tools_hub' });
        trackToolEvent('tool_open', { tool: 'tanpura' });
        setPracticeSuiteTab('tanpura');
        setShowPracticeSuite(true);
    };

    const handleOpenDrums = () => {
        if (!hasStudentAccess) {
            trackToolEvent('student_tool_interest', { tool: 'rhythm_machine', source: 'practice_tools_hub' });
            setAccessModalTool('Rhythm Machine');
            return;
        }
        trackToolEvent('drums_open', { source: 'practice_tools_hub' });
        trackToolEvent('tool_open', { tool: 'drums' });
        setPracticeSuiteTab('drums');
        setShowPracticeSuite(true);
    };

    const handleOpenCombo = () => {
        if (!hasStudentAccess) {
            trackToolEvent('student_tool_interest', { tool: 'combo_session', source: 'practice_tools_hub' });
            setAccessModalTool('Combo Session Mixer');
            return;
        }
        trackToolEvent('tool_open', { tool: 'combo' });
        setPracticeSuiteTab('combosetup');
        setShowPracticeSuite(true);
    };

    const handleOpenSurToNotation = () => {
        if (!hasStudentAccess) {
            trackToolEvent('student_tool_interest', { tool: 'sur_to_notation', source: 'practice_tools_hub' });
            setAccessModalTool('Flute to Notes (Sur to Notation)');
            return;
        }
        trackToolEvent('sur_to_notation_open', { source: 'practice_tools_hub' });
        trackToolEvent('tool_open', { tool: 'sur_to_notation' });
        setShowSurToNotation(true);
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 antialiased selection:bg-amber-200 selection:text-amber-900 flex flex-col font-sans">
            {/* Top Navigation */}
            <PublicNavbar activePath="/practice-tools" />

            {/* Breadcrumb Navigation */}
            <div className="bg-slate-100/80 border-b border-slate-200 py-2.5 px-4 sm:px-6 lg:px-8">
                <div className="max-w-6xl mx-auto text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                    <Link href="/" className="hover:text-blue-900 transition-colors">Home</Link>
                    <span>/</span>
                    <span className="text-slate-800 font-semibold">Practice Tools</span>
                </div>
            </div>

            {/* Modals */}
            {showTuner && <FluteTunerModal onClose={() => setShowTuner(false)} />}
            {showPracticeSuite && (
                <PracticeSuiteModal
                    defaultTab={practiceSuiteTab}
                    isComboMode={practiceSuiteTab === 'combosetup'}
                    onClose={() => setShowPracticeSuite(false)}
                />
            )}
            {showSurToNotation && <SurToNotationModal onClose={() => setShowSurToNotation(false)} />}

            {/* Student Access Unlock Modal */}
            <StudentAccessModal
                isOpen={accessModalTool !== null}
                onClose={() => setAccessModalTool(null)}
                toolName={accessModalTool || 'KFA Student Practice Tool'}
            />

            {/* Header / Hero */}
            <header className="bg-gradient-to-b from-blue-950 via-slate-900 to-slate-900 text-white py-16 sm:py-24 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden">
                <div className="max-w-4xl mx-auto relative z-10">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 bg-amber-400/15 border border-amber-400/30 text-amber-300 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>KFA Practice Lab</span>
                    </div>

                    {/* H1 */}
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-3 leading-tight">
                        Bansuri Practice Tools
                    </h1>

                    {/* Subtitle */}
                    <p className="text-lg sm:text-xl font-bold text-amber-300 mb-5">
                        Practise Pitch. Strengthen Rhythm. Develop Your Ear.
                    </p>

                    {/* Description */}
                    <p className="text-sm sm:text-base text-blue-100/90 max-w-2xl mx-auto leading-relaxed mb-8">
                        Explore interactive tools created to support focused music practice and complement structured Bansuri learning. Selected core tools are free for everyone, with advanced practice companions available exclusively to Krishna Flute Academy students.
                    </p>

                    {/* Hero CTAs */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
                        <a
                            href="#free-tools"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold text-xs sm:text-sm px-7 py-3 rounded-full shadow-md hover:shadow-lg transition-all"
                        >
                            <span>Explore Free Tools</span>
                            <ArrowRight className="w-4 h-4" />
                        </a>

                        <Link
                            href="/courses"
                            onClick={() => trackToolEvent('tool_to_course_click', { source: 'hero' })}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-xs sm:text-sm px-6 py-3 rounded-full transition-all"
                        >
                            <span>Explore Bansuri Courses</span>
                        </Link>
                    </div>

                    {/* Privacy Guarantee Banner */}
                    <div className="mt-8 flex items-center justify-center gap-2 text-xs text-blue-200/80">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>All audio analysis runs directly in your browser. Microphone audio is never stored or transmitted.</span>
                    </div>
                </div>
            </header>

            {/* Tools Sections Container */}
            <main id="tools-grid" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex-1 w-full">
                
                {/* SECTION 1: Free Bansuri Practice Tools */}
                <section id="free-tools" className="mb-20">
                    <div className="text-center max-w-3xl mx-auto mb-12">
                        <span className="text-xs uppercase tracking-widest font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-200 px-3.5 py-1.5 rounded-full inline-block mb-3">
                            Free For Everyone
                        </span>
                        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 mb-3">
                            Free Bansuri Practice Tools
                        </h2>
                        <p className="text-slate-600 text-sm sm:text-base">
                            Select any free tool below to start practising immediately in your browser — no registration or account required.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                        
                        {/* Tool 1: Bansuri Tuner */}
                        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between group hover:border-amber-400/80">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#d46211] border border-orange-100 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                                        <Mic className="w-6 h-6" />
                                    </div>
                                    <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full uppercase tracking-wider">
                                        Free Practice Tool
                                    </span>
                                </div>

                                <div className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">
                                    Develop: Pitch Accuracy
                                </div>
                                <h3 className="text-xl font-black text-slate-900 mb-2">
                                    Bansuri Tuner
                                </h3>
                                <p className="text-slate-600 text-sm leading-relaxed mb-6">
                                    Use real-time pitch feedback to check notes and develop greater awareness of accurate Swaras across Indian Sargam and chromatic scales.
                                </p>
                            </div>

                            <div className="space-y-2 pt-4 border-t border-slate-100">
                                <button
                                    onClick={handleOpenTuner}
                                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-bold text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                                >
                                    <Play className="w-4 h-4 fill-current" />
                                    <span>Open Tuner</span>
                                </button>
                                <Link
                                    href="/practice-tools/bansuri-tuner"
                                    className="w-full py-1.5 px-3 text-center text-xs font-bold text-blue-800 hover:text-blue-950 hover:underline transition-colors block"
                                >
                                    Tool Details & Guide →
                                </Link>
                            </div>
                        </div>

                        {/* Tool 2: Metronome */}
                        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between group hover:border-amber-400/80">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                                        <Volume2 className="w-6 h-6" />
                                    </div>
                                    <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full uppercase tracking-wider">
                                        Free Practice Tool
                                    </span>
                                </div>

                                <div className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">
                                    Develop: Timing & Tempo
                                </div>
                                <h3 className="text-xl font-black text-slate-900 mb-2">
                                    Practice Metronome
                                </h3>
                                <p className="text-slate-600 text-sm leading-relaxed mb-6">
                                    Practise with a steady pulse, customizable subdivisions, and progressive ramp acceleration to gradually improve rhythmic consistency.
                                </p>
                            </div>

                            <div className="space-y-2 pt-4 border-t border-slate-100">
                                <button
                                    onClick={handleOpenMetronome}
                                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-bold text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                                >
                                    <Play className="w-4 h-4 fill-current" />
                                    <span>Open Metronome</span>
                                </button>
                                <Link
                                    href="/practice-tools/metronome"
                                    className="w-full py-1.5 px-3 text-center text-xs font-bold text-blue-800 hover:text-blue-950 hover:underline transition-colors block"
                                >
                                    Tool Details & Guide →
                                </Link>
                            </div>
                        </div>

                        {/* Tool 3: Tanpura Drone */}
                        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between group hover:border-amber-400/80">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#d46211] border border-orange-100 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                                        <Music2 className="w-6 h-6" />
                                    </div>
                                    <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full uppercase tracking-wider">
                                        Free Practice Tool
                                    </span>
                                </div>

                                <div className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">
                                    Develop: Pitch & Listening
                                </div>
                                <h3 className="text-xl font-black text-slate-900 mb-2">
                                    Tanpura Drone (Sur Practice)
                                </h3>
                                <p className="text-slate-600 text-sm leading-relaxed mb-6">
                                    Strengthen the connection between listening, recognizing Swaras, and tuning your Bansuri with 12 Shruti pitches (Kali & Safed) and 4 drone string tunings.
                                </p>
                            </div>

                            <div className="space-y-2 pt-4 border-t border-slate-100">
                                <button
                                    onClick={handleOpenTanpura}
                                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-bold text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                                >
                                    <Play className="w-4 h-4 fill-current" />
                                    <span>Open Tanpura</span>
                                </button>
                                <Link
                                    href="/practice-tools/tanpura"
                                    className="w-full py-1.5 px-3 text-center text-xs font-bold text-blue-800 hover:text-blue-950 hover:underline transition-colors block"
                                >
                                    Tool Details & Guide →
                                </Link>
                            </div>
                        </div>

                    </div>
                </section>

                {/* SECTION 2: More Practice Tools for KFA Students */}
                <section id="student-tools" className="pt-8 border-t border-slate-200">
                    <div className="text-center max-w-3xl mx-auto mb-12">
                        <span className="text-xs uppercase tracking-widest font-extrabold text-blue-900 bg-blue-100 border border-blue-200 px-3.5 py-1.5 rounded-full inline-block mb-3">
                            KFA Student Exclusive
                        </span>
                        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 mb-3">
                            More Practice Tools for KFA Students
                        </h2>
                        <p className="text-slate-600 text-sm sm:text-base">
                            Advanced practice companions built to accelerate riyaz, rhythmic mastery, and notation recognition. Available for authenticated Krishna Flute Academy students.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-8">
                        
                        {/* Tool 4: Rhythm Machine */}
                        <div className="bg-white rounded-3xl border border-blue-200/80 p-6 sm:p-7 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between group hover:border-blue-400 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-full pointer-events-none" />
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                                        <Layers className="w-6 h-6" />
                                    </div>
                                    <span className="text-[11px] font-extrabold text-blue-800 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                                        <GraduationCap className="w-3.5 h-3.5" />
                                        <span>KFA Student Tool</span>
                                    </span>
                                </div>

                                <div className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1">
                                    Develop: Rhythm & Coordination
                                </div>
                                <h3 className="text-xl font-black text-slate-900 mb-2">
                                    Rhythm Machine
                                </h3>
                                <p className="text-slate-600 text-sm leading-relaxed mb-6">
                                    Practise musical phrases against rhythmic accompaniment in Hindustani taals (Teen Taal, Keherwa, Dadra, Bhajni) and contemporary groove patterns.
                                </p>
                            </div>

                            <div className="space-y-2 pt-4 border-t border-slate-100">
                                {hasStudentAccess ? (
                                    <button
                                        onClick={handleOpenDrums}
                                        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-700 to-blue-800 hover:from-blue-800 hover:to-blue-900 text-white font-bold text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                                    >
                                        <Play className="w-4 h-4 fill-current" />
                                        <span>Open Rhythm Machine</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleOpenDrums}
                                        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                                    >
                                        <Lock className="w-4 h-4 text-slate-950" />
                                        <span>Explore Student Access →</span>
                                    </button>
                                )}
                                <Link
                                    href="/practice-tools/rhythm-machine"
                                    className="w-full py-1.5 px-3 text-center text-xs font-bold text-blue-800 hover:text-blue-950 hover:underline transition-colors block"
                                >
                                    Tool Details & Guide →
                                </Link>
                            </div>
                        </div>

                        {/* Tool 5: Flute to Notes (Sur to Notation) */}
                        <div className="bg-white rounded-3xl border border-purple-200/80 p-6 sm:p-7 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between group hover:border-purple-400 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-bl-full pointer-events-none" />
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                                        <Sparkles className="w-6 h-6" />
                                    </div>
                                    <span className="text-[11px] font-extrabold text-blue-800 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                                        <GraduationCap className="w-3.5 h-3.5" />
                                        <span>KFA Student Tool</span>
                                    </span>
                                </div>

                                <div className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-1">
                                    Develop: Ear Training & Transcription
                                </div>
                                <h3 className="text-xl font-black text-slate-900 mb-2">
                                    Flute to Notes (Sur to Notation)
                                </h3>
                                <p className="text-slate-600 text-sm leading-relaxed mb-6">
                                    Build the connection between what you hear, what you play, and how musical notes are understood. Transcribes live Sargam directly as you play.
                                </p>
                            </div>

                            <div className="space-y-2 pt-4 border-t border-slate-100">
                                {hasStudentAccess ? (
                                    <button
                                        onClick={handleOpenSurToNotation}
                                        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-700 to-blue-800 hover:from-blue-800 hover:to-blue-900 text-white font-bold text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                                    >
                                        <Play className="w-4 h-4 fill-current" />
                                        <span>Open Flute to Notes</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleOpenSurToNotation}
                                        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                                    >
                                        <Lock className="w-4 h-4 text-slate-950" />
                                        <span>Explore Student Access →</span>
                                    </button>
                                )}
                                <Link
                                    href="/practice-tools/flute-to-notes"
                                    className="w-full py-1.5 px-3 text-center text-xs font-bold text-blue-800 hover:text-blue-950 hover:underline transition-colors block"
                                >
                                    Tool Details & Guide →
                                </Link>
                            </div>
                        </div>

                    </div>

                    {/* Dedicated Combo Section: Merged Tanpura + Metronome + Drums */}
                    <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-slate-50 rounded-3xl border-2 border-amber-300/80 p-6 sm:p-8 shadow-sm flex flex-col justify-between mb-8 hover:border-amber-400 transition-all text-left">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                            <div className="max-w-2xl">
                                <div className="flex items-center gap-2 flex-wrap mb-3">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-900 border border-amber-500/30 text-xs font-black uppercase tracking-wider">
                                        <Sliders className="w-4 h-4 text-[#d46211]" />
                                        <span>Combo Riyaz Section • Merged Accompaniment</span>
                                    </div>
                                    <span className="text-[11px] font-extrabold text-blue-800 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5">
                                        <GraduationCap className="w-3.5 h-3.5" />
                                        <span>KFA Student Tool</span>
                                    </span>
                                </div>
                                <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">
                                    Combo Session Mixer
                                </h3>
                                <p className="text-slate-600 text-sm leading-relaxed mb-4">
                                    While all other tools operate as dedicated standalone instruments, the Combo Session Mixer exclusively unites Tanpura drone, Metronome beat, and Drum rhythm accompaniment together into a single synchronized playback session.
                                </p>
                                <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700">
                                    <span className="px-3 py-1 bg-white rounded-lg border border-amber-200/80 shadow-2xs">✓ Downbeat & Sam Synchronized</span>
                                    <span className="px-3 py-1 bg-white rounded-lg border border-amber-200/80 shadow-2xs">✓ Independent Channel Volume Faders</span>
                                    <span className="px-3 py-1 bg-white rounded-lg border border-amber-200/80 shadow-2xs">✓ Simultaneous Riyaz Accompaniment</span>
                                </div>
                            </div>

                            <div className="flex flex-col items-center gap-2 shrink-0">
                                {hasStudentAccess ? (
                                    <button
                                        onClick={handleOpenCombo}
                                        className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                                    >
                                        <Play className="w-4 h-4 fill-current" />
                                        <span>Open Combo Session Mixer</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleOpenCombo}
                                        className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                                    >
                                        <Lock className="w-4 h-4 text-slate-950" />
                                        <span>Explore Student Access →</span>
                                    </button>
                                )}
                                <span className="text-[11px] text-slate-400 font-medium">
                                    Merged 3-Track Synchronized Accompaniment
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Interactive Curriculum & Student Riyaz Suite */}
                    <div className="bg-gradient-to-br from-blue-950 via-slate-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-md flex flex-col justify-between border border-slate-800">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                            <div className="max-w-2xl">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold mb-3 border border-amber-400/30">
                                    <GraduationCap className="w-4 h-4" />
                                    <span>KFA Student Tool</span>
                                </div>
                                <h3 className="text-xl sm:text-2xl font-extrabold text-white mb-2">
                                    Guided Lesson Riyaz & Homework Evaluation
                                </h3>
                                <p className="text-blue-100/90 text-sm leading-relaxed">
                                    Enrolled Krishna Flute Academy students receive structured interactive exercises, step-by-step raga assignments, automated homework recording feedback, and personal teacher check-ins.
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
                                <Link
                                    href="/login"
                                    className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-extrabold text-xs sm:text-sm rounded-full transition-all shadow-md text-center"
                                >
                                    Student Login
                                </Link>
                                <Link
                                    href="/courses"
                                    className="w-full sm:w-auto px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm rounded-full transition-all text-center border border-white/20"
                                >
                                    Explore Courses
                                </Link>
                            </div>
                        </div>

                        <p className="text-xs text-blue-200/80 border-t border-white/10 pt-4 text-center sm:text-left">
                            Available as part of the KFA learning experience.
                        </p>
                    </div>

                </section>
            </main>

            {/* Educational / Bridge Section: Tools Support Practice. Guidance Builds Musicianship. */}
            <section className="py-16 sm:py-24 bg-white border-t border-slate-200 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-6 shadow-xs">
                        <Compass className="w-7 h-7" />
                    </div>

                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">
                        Tools Support Practice. Guidance Builds Musicianship.
                    </h2>

                    <p className="text-slate-700 text-base sm:text-lg leading-relaxed mb-4 max-w-2xl mx-auto">
                        Practice tools can help with pitch, rhythm and listening, but learning Bansuri also requires observation, correction, musical understanding and structured guidance.
                    </p>

                    <p className="text-slate-600 text-sm sm:text-base leading-relaxed mb-8 max-w-2xl mx-auto">
                        Krishna Flute Academy combines guided learning with purposeful Riyaz to help students progress with clarity.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
                        <Link
                            href="/courses"
                            onClick={() => trackToolEvent('tool_to_course_click', { source: 'bridge_section' })}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs sm:text-sm px-7 py-3.5 rounded-full shadow-md hover:shadow-lg transition-all"
                        >
                            <span>Explore Bansuri Courses</span>
                            <ArrowRight className="w-4 h-4" />
                        </Link>

                        <a
                            href={whatsappConsultationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => trackToolEvent('tool_to_enquiry_click', { source: 'bridge_section' })}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-6 py-3.5 rounded-full shadow-md hover:shadow-lg transition-all"
                        >
                            <MessageCircle className="w-4 h-4" />
                            <span>Discuss Which Course Is Right for Me</span>
                        </a>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gradient-to-r from-blue-900 to-yellow-900 text-white py-12 px-4 sm:px-6 lg:px-8 border-t border-blue-950">
                <div className="max-w-6xl mx-auto">
                    <div className="grid md:grid-cols-3 gap-8">
                        <div>
                            <div className="flex items-center space-x-3 mb-4">
                                <img src="/image.png" alt="Krishna Flute Academy" className="h-10 w-10 object-contain" />
                                <span className="text-xl font-bold">Krishna Flute Academy</span>
                            </div>
                            <p className="text-blue-100 leading-relaxed text-sm">
                                Spreading the divine melodies of Krishna's flute through traditional teaching and modern interactive practice tools.
                            </p>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
                            <ul className="space-y-2 text-blue-100 text-sm">
                                <li><Link href="/" className="hover:text-white transition-colors">Home</Link></li>
                                <li><Link href="/courses" className="hover:text-white transition-colors">All Courses</Link></li>
                                <li><Link href="/practice-tools" className="hover:text-white transition-colors font-bold text-amber-300">Practice Tools</Link></li>
                                <li><Link href="/community" className="hover:text-white transition-colors">Community</Link></li>
                                <li><Link href="/gallery" className="hover:text-white transition-colors">Gallery</Link></li>
                                <li><Link href="/blog/" className="hover:text-white transition-colors">Blog</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold mb-4">Practice Tools</h3>
                            <ul className="space-y-2 text-blue-100 text-sm">
                                <li><Link href="/practice-tools/bansuri-tuner" className="hover:text-white transition-colors">Bansuri Tuner</Link></li>
                                <li><Link href="/practice-tools/metronome" className="hover:text-white transition-colors">Practice Metronome</Link></li>
                                <li><Link href="/practice-tools/tanpura" className="hover:text-white transition-colors">Tanpura Drone</Link></li>
                                <li><Link href="/practice-tools/rhythm-machine" className="hover:text-white transition-colors">Rhythm Machine</Link></li>
                                <li><Link href="/practice-tools/flute-to-notes" className="hover:text-white transition-colors">Flute to Notes</Link></li>
                            </ul>
                        </div>
                    </div>
                    <div className="border-t border-blue-700/60 mt-8 pt-8 text-center text-blue-200 text-xs sm:text-sm">
                        <p>© 2025 Krishna Flute Academy. All rights reserved. | Practice Smarter with KFA Tools</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
