'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
    ChevronDown, 
    ChevronRight, 
    CheckCircle2, 
    Sparkles, 
    MessageCircle, 
    Compass, 
    UserCheck, 
    BookOpen, 
    ArrowRight, 
    Phone, 
    Mail, 
    MapPin, 
    Send,
    HelpCircle,
    Volume2
} from 'lucide-react';
import { CourseData, COURSES_DATA } from '../../../src/data/courses-data';
import { supabase } from '../../../src/lib/supabase';
import PublicNavbar from '../../../src/components/PublicNavbar';

interface Props {
    course: CourseData;
}

export default function ClientCoursePage({ course }: Props) {
    // Accordion state for FAQs
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    // Form states
    const [formName, setFormName] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formPhone, setFormPhone] = useState('');
    const [formMessage, setFormMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);

    const whatsappNumber = '919836952545';
    const courseWhatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(course.whatsappMessage)}`;

    const toggleFaq = (index: number) => {
        setOpenFaq(prev => (prev === index ? null : index));
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formName || !formPhone) {
            alert('Please enter your Name and Phone number.');
            return;
        }

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('inquiries')
                .insert([{
                    name: formName,
                    email: formEmail || null,
                    phone: formPhone,
                    course: course.inquiryCourseValue,
                    message: formMessage || `Course Inquiry for ${course.title}`
                }]);

            if (error) {
                console.error('Error recording inquiry:', error);
            }

            setSubmitSuccess(true);

            // Construct WhatsApp message redirect
            const detailedWhatsappText = `
Hello Krishna Flute Academy, I have an enquiry!

*Course:* ${course.title}
*Name:* ${formName}
*Phone:* ${formPhone}
${formEmail ? `*Email:* ${formEmail}\n` : ''}*Message:* ${formMessage || 'I would like to discuss whether this course is suitable for me.'}
            `.trim();

            const finalUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(detailedWhatsappText)}`;
            window.location.href = finalUrl;
        } catch (err) {
            console.error('Inquiry submission error:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Filter other courses for "Explore Other Learning Levels"
    const otherCourses = Object.values(COURSES_DATA).filter(c => c.slug !== course.slug);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 antialiased selection:bg-amber-200 selection:text-amber-900">
            {/* Academy Public Navigation */}
            <PublicNavbar activePath="/courses" />

            {/* Breadcrumb Navigation */}
            <div className="bg-slate-100/70 border-b border-slate-200 py-2.5 px-4 sm:px-6 lg:px-8">
                <div className="max-w-6xl mx-auto text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                    <Link href="/" className="hover:text-blue-900 transition-colors">Home</Link>
                    <span>/</span>
                    <Link href="/courses" className="hover:text-blue-900 transition-colors">Courses</Link>
                    <span>/</span>
                    <span className="text-slate-800 font-medium">{course.title}</span>
                </div>
            </div>

            {/* Hero Section */}
            <section className="relative overflow-hidden bg-gradient-to-b from-blue-950 via-slate-900 to-slate-900 text-white pt-12 pb-20 px-4 sm:px-6 lg:px-8">
                {/* Decorative background glow */}
                <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 bg-amber-400/15 border border-amber-400/30 text-amber-300 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium mb-6">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>{course.badge}</span>
                    </div>

                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight mb-4">
                        {course.h1}
                    </h1>

                    <p className="text-lg sm:text-xl text-blue-100 font-normal leading-relaxed max-w-2xl mx-auto mb-8">
                        {course.heroSubtitle}
                    </p>

                    {/* Opening Human Statement */}
                    <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-6 sm:p-8 text-left text-slate-100 text-sm sm:text-base leading-relaxed mb-8 shadow-xl">
                        {course.opening.split('\n\n').map((paragraph, idx) => (
                            <p key={idx} className={idx > 0 ? 'mt-4' : ''}>
                                {paragraph}
                            </p>
                        ))}
                    </div>

                    {/* Local + Online Badge */}
                    <p className="text-xs sm:text-sm text-amber-200/90 font-medium bg-amber-950/40 border border-amber-500/20 rounded-lg py-2.5 px-4 max-w-2xl mx-auto mb-8">
                        📍 {course.localAndOnlineNote}
                    </p>

                    {/* Hero CTAs */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                        <a
                            href="#talk-to-academy"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold px-7 py-3.5 rounded-full text-sm sm:text-base transition-all shadow-lg hover:shadow-amber-500/20"
                        >
                            <span>Discuss Which Course Is Right for Me</span>
                            <ArrowRight className="w-4 h-4" />
                        </a>
                        <a
                            href="#progression-stages"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-medium px-6 py-3.5 rounded-full text-sm sm:text-base transition-all"
                        >
                            <span>How You Will Progress</span>
                            <ChevronDown className="w-4 h-4" />
                        </a>
                    </div>
                </div>
            </section>

            {/* Section 1: Who Is This For? */}
            <section className="py-16 md:py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
                <div className="text-center max-w-3xl mx-auto mb-12">
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
                        Who Is This Course For?
                    </h2>
                    <p className="text-slate-600 text-sm sm:text-base">
                        Krishna Flute Academy welcomes students of different stages, matching the guidance to your individual background.
                    </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
                    {course.targetAudience.map((item, idx) => (
                        <div 
                            key={idx}
                            className="flex items-start gap-4 p-5 sm:p-6 bg-white rounded-xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow"
                        >
                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <p className="text-slate-700 text-sm sm:text-base leading-relaxed font-medium">
                                {item}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Section 2: What You'll Develop */}
            <section className="py-16 bg-white border-y border-slate-200 px-4 sm:px-6 lg:px-8">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center max-w-3xl mx-auto mb-12">
                        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
                            What You'll Develop
                        </h2>
                        <p className="text-slate-600 text-sm sm:text-base">
                            Key foundational and musical milestones you will develop throughout this level.
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {course.whatYouWillLearn.map((item, idx) => (
                            <div 
                                key={idx}
                                className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-amber-400/60 transition-all hover:bg-amber-50/20 group"
                            >
                                <div className="w-10 h-10 rounded-xl bg-blue-900 text-amber-400 flex items-center justify-center font-bold text-sm mb-4 shadow-sm group-hover:scale-105 transition-transform">
                                    0{idx + 1}
                                </div>
                                <h3 className="font-bold text-slate-900 text-base sm:text-lg mb-2">
                                    {item.title}
                                </h3>
                                <p className="text-slate-600 text-sm leading-relaxed">
                                    {item.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Section 3: How This Course Helps You Progress */}
            <section id="progression-stages" className="py-16 md:py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
                <div className="text-center mb-12">
                    <div className="inline-block text-xs uppercase tracking-wider font-bold text-blue-900 bg-blue-100 px-3 py-1 rounded-full mb-3">
                        Progression Stages
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
                        How This Course Helps You Progress
                    </h2>
                    <p className="text-slate-600 text-sm sm:text-base max-w-2xl mx-auto">
                        Your learning moves forward step by step, allowing you to build control, confidence, and musical expression in a structured way.
                    </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                    {course.progressionStages.map((stageItem, idx) => (
                        <div 
                            key={idx}
                            className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                        >
                            <div>
                                <span className="inline-block font-mono text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md mb-3">
                                    {stageItem.stage}
                                </span>
                                <h3 className="text-lg font-bold text-slate-900 mb-2.5">
                                    {stageItem.title}
                                </h3>
                                <p className="text-slate-600 text-sm leading-relaxed">
                                    {stageItem.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Section 4: Learn With Structured Guidance */}
            <section className="py-16 md:py-20 bg-gradient-to-br from-blue-950 to-slate-900 text-white px-4 sm:px-6 lg:px-8">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center max-w-3xl mx-auto mb-12">
                        <div className="inline-block text-xs uppercase tracking-wider font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-full mb-3">
                            The KFA Philosophy
                        </div>
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">
                            Learn With Structured Guidance
                        </h2>
                        <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
                            Learning Bansuri is more than memorising notes or copying songs. At Krishna Flute Academy, students are guided step by step to develop sound, listening, technique, rhythm and musical understanding.
                        </p>
                        <p className="text-blue-200/80 text-xs sm:text-sm mt-3">
                            The learning path is adapted according to the student's current ability, progress and musical goals.
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
                            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-400 flex items-center justify-center mb-4">
                                <BookOpen className="w-6 h-6" />
                            </div>
                            <h3 className="font-bold text-white text-base sm:text-lg mb-2">
                                Structured Learning
                            </h3>
                            <p className="text-slate-300 text-sm leading-relaxed">
                                Progress gradually through well-defined steps instead of trying to learn everything at once.
                            </p>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
                            <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-300 flex items-center justify-center mb-4">
                                <UserCheck className="w-6 h-6" />
                            </div>
                            <h3 className="font-bold text-white text-base sm:text-lg mb-2">
                                Personal Guidance
                            </h3>
                            <p className="text-slate-300 text-sm leading-relaxed">
                                Receive direct teacher feedback based on your current playing ability, posture, and learning needs.
                            </p>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
                            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-400 flex items-center justify-center mb-4">
                                <Compass className="w-6 h-6" />
                            </div>
                            <h3 className="font-bold text-white text-base sm:text-lg mb-2">
                                Practice with Purpose
                            </h3>
                            <p className="text-slate-300 text-sm leading-relaxed">
                                Develop a regular, enjoyable, and meaningful approach to daily Riyaz without mindless repetition.
                            </p>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 flex items-center justify-center mb-4">
                                <Volume2 className="w-6 h-6" />
                            </div>
                            <h3 className="font-bold text-white text-base sm:text-lg mb-2">
                                Musical Understanding
                            </h3>
                            <p className="text-slate-300 text-sm leading-relaxed">
                                Learn to understand the music behind the notes rather than simply reproducing them mechanically.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Section 5: Learning Goal / Expected Learning Outcomes */}
            <section className="py-16 md:py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
                <div className="text-center max-w-3xl mx-auto mb-12">
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
                        Expected Learning Outcomes
                    </h2>
                    <p className="text-slate-600 text-sm sm:text-base">
                        What you can realistically expect to achieve upon completing this level with regular practice.
                    </p>
                </div>

                <div className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-6 sm:p-8">
                    <div className="space-y-4">
                        {course.expectedOutcomes.map((outcome, idx) => (
                            <div key={idx} className="flex items-start gap-3 sm:gap-4">
                                <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center flex-shrink-0 mt-0.5 font-bold text-xs">
                                    ✓
                                </div>
                                <p className="text-slate-800 text-sm sm:text-base font-medium leading-relaxed">
                                    {outcome}
                                </p>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-6 pt-4 border-t border-amber-200/60 text-center">
                        Note: Flute mastery is a personal journey. Progress depends on consistent daily Riyaz and individual dedication.
                    </p>
                </div>
            </section>

            {/* Tools That Support Your Riyaz */}
            <section className="py-16 md:py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
                <div className="text-center max-w-3xl mx-auto mb-10">
                    <span className="inline-block text-xs uppercase tracking-wider font-bold text-blue-900 bg-blue-100 px-3 py-1 rounded-full mb-3">
                        Interactive Riyaz
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
                        Tools That Support Your Riyaz
                    </h2>
                    <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                        KFA students can complement guided lessons with interactive tools for pitch, rhythm, timing and listening.
                    </p>
                </div>

                <div className="grid sm:grid-cols-3 gap-6 mb-8">
                    {(course.slug === 'beginner-bansuri' ? [
                        { title: 'Bansuri Tuner', desc: 'Real-time pitch and Swara feedback for steady tone and lip placement.', href: '/practice-tools/bansuri-tuner' },
                        { title: 'Practice Metronome', desc: 'Build rock-solid tempo control and steady rhythm across your alankars.', href: '/practice-tools/metronome' },
                        { title: 'Rhythm / Drum Practice', desc: 'Practise foundational alankars and finger exercises with rhythmic pulse.', href: '/practice-tools' }
                    ] : course.slug === 'intermediate-bansuri' ? [
                        { title: 'Bansuri Tuner', desc: 'Verify precise komal and tivra swara intonation with cents accuracy.', href: '/practice-tools/bansuri-tuner' },
                        { title: 'Practice Metronome', desc: 'Develop speed ramp agility and clean fingerwork transitions.', href: '/practice-tools/metronome' },
                        { title: 'Tanpura Drone (Sur Practice)', desc: 'Immerse your daily raga riyaz in an authentic classical acoustic drone.', href: '/practice-tools/tanpura' }
                    ] : course.slug === 'advanced-bansuri' ? [
                        { title: 'Bansuri Tuner', desc: 'Fine-tune microtones, meends, and delicate shruti inflections.', href: '/practice-tools/bansuri-tuner' },
                        { title: 'Rhythm Machine', desc: 'Practise drut bandishes, taans, and layakari with authentic Hindustani taals.', href: '/practice-tools' },
                        { title: 'Sur to Notation (Ear Training)', desc: 'Transcribe intricate phrases and live sargams straight from your flute.', href: '/practice-tools' }
                    ] : [
                        { title: 'Bansuri Tuner', desc: 'Playful visual feedback to help young flutists produce their first clean notes.', href: '/practice-tools/bansuri-tuner' },
                        { title: 'Practice Metronome', desc: 'Fun rhythm games to keep steady beat while learning nursery and simple songs.', href: '/practice-tools/metronome' },
                        { title: 'Rhythm Practice', desc: 'Gentle, engaging drum accompaniment for children to play along.', href: '/practice-tools' }
                    ]).map((toolItem, idx) => (
                        <div 
                            key={idx}
                            className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                        >
                            <div>
                                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center font-bold text-sm mb-4">
                                    <Sparkles className="w-5 h-5 text-amber-600" />
                                </div>
                                <h3 className="font-bold text-slate-900 text-base mb-2">
                                    {toolItem.title}
                                </h3>
                                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-4">
                                    {toolItem.desc}
                                </p>
                            </div>
                            <Link 
                                href={toolItem.href}
                                className="text-xs font-bold text-blue-900 hover:text-amber-600 transition-colors inline-flex items-center gap-1"
                            >
                                <span>Try Tool</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    ))}
                </div>

                <div className="text-center">
                    <Link
                        href="/practice-tools"
                        className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-blue-900 hover:text-amber-600 hover:underline transition-colors"
                    >
                        <span>Explore All KFA Practice Tools →</span>
                    </Link>
                </div>
            </section>

            {/* Section 6: Already Play Bansuri? (Level Assessment Callout) */}
            <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
                <div className="bg-white border-2 border-blue-900/10 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
                    <div className="text-left">
                        <h2 className="text-xl sm:text-2xl font-bold text-blue-950 mb-2">
                            Already Play Bansuri?
                        </h2>
                        <p className="text-slate-600 text-sm sm:text-base max-w-xl leading-relaxed">
                            Students with previous learning experience do not necessarily need to start from Beginner. Your current playing ability can be assessed so you join the level best suited for you.
                        </p>
                    </div>
                    <a
                        href={courseWhatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto flex-shrink-0 inline-flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-950 text-white font-semibold px-6 py-3 rounded-full text-sm transition-all"
                    >
                        <span>Request Level Assessment</span>
                        <ChevronRight className="w-4 h-4" />
                    </a>
                </div>
            </section>

            {/* Section 7: Frequently Asked Questions */}
            <section className="py-16 md:py-20 bg-slate-100/70 border-y border-slate-200 px-4 sm:px-6 lg:px-8">
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">
                            <HelpCircle className="w-4 h-4 text-amber-500" />
                            <span>Clarifications</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
                            Frequently Asked Questions
                        </h2>
                        <p className="text-slate-600 text-sm">
                            Common questions about our {course.title}.
                        </p>
                    </div>

                    <div className="space-y-3">
                        {course.faqs.map((faq, idx) => {
                            const isOpen = openFaq === idx;
                            return (
                                <div 
                                    key={idx}
                                    className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs"
                                >
                                    <button
                                        onClick={() => toggleFaq(idx)}
                                        className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-4 font-semibold text-slate-900 text-sm sm:text-base hover:bg-slate-50/80 transition-colors"
                                        aria-expanded={isOpen}
                                    >
                                        <span>{faq.question}</span>
                                        <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-900' : ''}`} />
                                    </button>
                                    {isOpen && (
                                        <div className="px-4 pb-5 sm:px-5 pt-1 text-slate-600 text-sm leading-relaxed border-t border-slate-100 bg-slate-50/40">
                                            {faq.answer}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Section 8: Not Sure Which Course Is Right for You? */}
            <section className="py-14 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
                <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-3xl p-8 sm:p-10 text-slate-950 flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg">
                    <div>
                        <h2 className="text-2xl font-bold mb-2">
                            Not sure which course is right for you?
                        </h2>
                        <p className="text-slate-900/80 text-sm sm:text-base max-w-xl leading-relaxed">
                            Every student's musical background is unique. Connect directly with Krishna Flute Academy for a personalized level discussion before starting.
                        </p>
                    </div>
                    <a
                        href={courseWhatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-slate-950 hover:bg-slate-900 text-white font-bold px-6 py-3.5 rounded-full text-sm transition-all flex-shrink-0 shadow-md"
                    >
                        <MessageCircle className="w-4 h-4 text-emerald-400" />
                        <span>Discuss Which Course Is Right for Me</span>
                    </a>
                </div>
            </section>

            {/* Section 9: Talk to Krishna Flute Academy (Enquiry & Contact) */}
            <section id="talk-to-academy" className="py-16 md:py-20 bg-slate-900 text-white px-4 sm:px-6 lg:px-8">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center max-w-2xl mx-auto mb-12">
                        <div className="inline-block text-xs uppercase tracking-wider font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-full mb-3">
                            Start With Teacher Guidance
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                            Talk to Krishna Flute Academy
                        </h2>
                        <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto">
                            Tell us about your musical background and goals. We will gladly help you identify the appropriate starting point.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-5 gap-8 items-start">
                        {/* Quick Contact Info */}
                        <div className="md:col-span-2 space-y-6 text-slate-300">
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
                                <h3 className="font-bold text-white text-lg border-b border-white/10 pb-3">
                                    Quick Discussion
                                </h3>
                                
                                <a 
                                    href={courseWhatsappUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-md"
                                >
                                    <MessageCircle className="w-4 h-4" />
                                    <span>Discuss on WhatsApp</span>
                                </a>

                                <div className="space-y-4 pt-2 text-xs sm:text-sm">
                                    <div className="flex items-start gap-3">
                                        <Phone className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                                        <span>+91 98369 52545</span>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <Mail className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                                        <span>kgbhaumik86@gmail.com</span>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <MapPin className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                                        <span>Electronic City Phase 1, Bangalore (Bengaluru), India</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Inquiry Form */}
                        <div className="md:col-span-3 bg-white text-slate-900 rounded-2xl p-6 sm:p-8 shadow-xl">
                            {submitSuccess ? (
                                <div className="text-center py-8 space-y-4">
                                    <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                                        <CheckCircle2 className="w-8 h-8" />
                                    </div>
                                    <h4 className="text-xl font-bold text-slate-900">Enquiry Received!</h4>
                                    <p className="text-sm text-slate-600">
                                        Thank you for reaching out. We have opened WhatsApp so you can send your note directly, and we will get back to you shortly.
                                    </p>
                                </div>
                            ) : (
                                <form onSubmit={handleFormSubmit} className="space-y-4">
                                    <h3 className="font-bold text-slate-900 text-lg mb-2">
                                        Send an Enquiry
                                    </h3>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                            Your Name *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formName}
                                            onChange={e => setFormName(e.target.value)}
                                            placeholder="Enter your full name"
                                            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                                        />
                                    </div>

                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                                Phone / WhatsApp *
                                            </label>
                                            <input
                                                type="tel"
                                                required
                                                value={formPhone}
                                                onChange={e => setFormPhone(e.target.value)}
                                                placeholder="+91..."
                                                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                                Email Address
                                            </label>
                                            <input
                                                type="email"
                                                value={formEmail}
                                                onChange={e => setFormEmail(e.target.value)}
                                                placeholder="name@example.com"
                                                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                            Selected Course
                                        </label>
                                        <input
                                            type="text"
                                            disabled
                                            value={course.title}
                                            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-600 text-sm cursor-not-allowed"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                            Your Musical Background & Goals
                                        </label>
                                        <textarea
                                            rows={3}
                                            value={formMessage}
                                            onChange={e => setFormMessage(e.target.value)}
                                            placeholder="Tell us if you have any previous music experience, hand size considerations, or specific goals..."
                                            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full bg-blue-900 hover:bg-blue-950 text-white font-bold py-3.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50"
                                    >
                                        <Send className="w-4 h-4" />
                                        <span>{isSubmitting ? 'Submitting...' : 'Send Enquiry & Connect on WhatsApp'}</span>
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Section 10: Explore Other Learning Levels */}
            <section className="py-16 md:py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
                <div className="text-center max-w-3xl mx-auto mb-10">
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
                        Explore Other Learning Levels
                    </h2>
                    <p className="text-slate-600 text-sm">
                        Find the learning pathway that best matches your current stage.
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    {otherCourses.map((other) => (
                        <Link
                            key={other.slug}
                            href={`/courses/${other.slug}`}
                            className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-all group flex flex-col justify-between"
                        >
                            <div>
                                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block mb-1">
                                    {other.badge}
                                </span>
                                <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-900 transition-colors mb-2">
                                    {other.title}
                                </h3>
                                <p className="text-slate-600 text-xs sm:text-sm line-clamp-3 leading-relaxed mb-4">
                                    {other.heroSubtitle}
                                </p>
                            </div>
                            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-blue-900 font-bold text-xs">
                                <span>Learn More</span>
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
}
