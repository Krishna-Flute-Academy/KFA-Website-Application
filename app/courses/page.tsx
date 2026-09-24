import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { 
    ArrowRight, 
    Sparkles, 
    CheckCircle2, 
    SignalLow, 
    SignalMedium, 
    SignalHigh, 
    Heart, 
    MessageCircle,
    Download
} from 'lucide-react';
import PublicNavbar from '../../src/components/PublicNavbar';

export const metadata: Metadata = {
    title: 'Indian Classical Bansuri Courses | Krishna Flute Academy',
    description: 'Explore structured Indian Classical Bansuri learning paths from Beginner to Advanced, including our dedicated Kids Program. Learn in Bangalore or online worldwide.',
    alternates: {
        canonical: 'https://www.krishnafluteacademy.com/courses',
    },
    openGraph: {
        title: 'Indian Classical Bansuri Courses | Krishna Flute Academy',
        description: 'Structured learning paths for different stages of the musical journey. Offline in Bangalore & Online worldwide.',
        url: 'https://www.krishnafluteacademy.com/courses',
        siteName: 'Krishna Flute Academy',
        type: 'website',
        images: [
            {
                url: '/Toppic.jpg',
                width: 1200,
                height: 630,
                alt: 'Krishna Flute Academy Courses',
            },
        ],
    },
};

interface CourseOverviewCard {
    slug: string;
    title: string;
    badge: string;
    heading: string;
    description: string;
    keyOutcomes: string[];
    cta: string;
    link: string;
    icon: React.ReactNode;
    color: string;
    badgeBg: string;
}

const OVERVIEW_COURSES: CourseOverviewCard[] = [
    {
        slug: 'beginner-bansuri',
        title: 'Beginner Bansuri Course',
        badge: 'BEGINNER',
        heading: 'Start Your Bansuri Journey',
        description: 'Build the right foundation in sound, breath, Swaras, rhythm and musical confidence through structured guidance.',
        keyOutcomes: [
            'Develop a clear and stable sound',
            'Build basic Swara and fingering confidence',
            'Improve rhythm and coordination',
            'Begin playing simple melodies'
        ],
        cta: 'Explore Beginner Course →',
        link: '/courses/beginner-bansuri',
        icon: <SignalLow className="w-7 h-7" />,
        color: 'from-blue-600 to-blue-800',
        badgeBg: 'bg-blue-100 text-blue-900 border-blue-200'
    },
    {
        slug: 'intermediate-bansuri',
        title: 'Intermediate Bansuri Course',
        badge: 'INTERMEDIATE',
        heading: 'Develop Technique & Expression',
        description: 'Move beyond basic note playing and develop greater control, musical expression and understanding of Indian Classical Music.',
        keyOutcomes: [
            'Improve tone and pitch control',
            'Develop expressive Bansuri techniques',
            'Explore Raga and Taal',
            'Build stronger musical phrasing'
        ],
        cta: 'Explore Intermediate Course →',
        link: '/courses/intermediate-bansuri',
        icon: <SignalMedium className="w-7 h-7" />,
        color: 'from-amber-600 to-amber-700',
        badgeBg: 'bg-amber-100 text-amber-900 border-amber-200'
    },
    {
        slug: 'advanced-bansuri',
        title: 'Advanced Bansuri Course',
        badge: 'ADVANCED',
        heading: 'Develop as a Musician',
        description: 'Deepen your understanding of Raga, improvisation, technique and musical interpretation while developing greater independence as a Bansuri player.',
        keyOutcomes: [
            'Deepen Raga understanding',
            'Develop improvisation',
            'Refine advanced technique',
            'Build performance confidence'
        ],
        cta: 'Explore Advanced Course →',
        link: '/courses/advanced-bansuri',
        icon: <SignalHigh className="w-7 h-7" />,
        color: 'from-indigo-700 to-slate-900',
        badgeBg: 'bg-purple-100 text-purple-900 border-purple-200'
    },
    {
        slug: 'kids-bansuri',
        title: 'Bansuri for Kids',
        badge: 'KIDS PROGRAM',
        heading: 'Discover Music Through Bansuri',
        description: 'An encouraging introduction to Bansuri that helps young learners develop listening, rhythm, coordination and musical confidence.',
        keyOutcomes: [
            'Discover sound and Swaras',
            'Develop rhythm and listening',
            'Play simple melodies',
            'Build musical confidence'
        ],
        cta: 'Explore Kids Program →',
        link: '/courses/kids-bansuri',
        icon: <Heart className="w-7 h-7" />,
        color: 'from-emerald-600 to-teal-800',
        badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-200'
    }
];

export default function CoursesDirectoryPage() {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 antialiased selection:bg-amber-200 selection:text-amber-900 flex flex-col">
            {/* Main Academy Public Navigation */}
            <PublicNavbar activePath="/courses" />

            {/* Breadcrumb Navigation */}
            <div className="bg-slate-100/70 border-b border-slate-200 py-2.5 px-4 sm:px-6 lg:px-8">
                <div className="max-w-6xl mx-auto text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                    <Link href="/" className="hover:text-blue-900 transition-colors">Home</Link>
                    <span>/</span>
                    <span className="text-slate-800 font-semibold">Courses</span>
                </div>
            </div>

            {/* Header / Hero */}
            <header className="bg-gradient-to-b from-blue-950 via-slate-900 to-slate-900 text-white py-16 sm:py-20 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden">
                <div className="max-w-4xl mx-auto relative z-10">
                    <div className="inline-flex items-center gap-2 bg-amber-400/15 border border-amber-400/30 text-amber-300 px-3.5 py-1.5 rounded-full text-xs font-medium mb-4">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Structured Learning Paths</span>
                    </div>

                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-5 leading-tight">
                        Indian Classical Bansuri Courses
                    </h1>

                    <p className="text-base sm:text-lg text-blue-100/90 max-w-3xl mx-auto leading-relaxed mb-4">
                        Whether you are picking up the Bansuri for the first time, looking to develop your technique, exploring Indian Classical Music more deeply, or searching for flute lessons for your child, Krishna Flute Academy offers structured learning paths for different stages of the musical journey.
                    </p>

                    <p className="text-xs sm:text-sm text-amber-200/90 max-w-2xl mx-auto mb-8 font-medium">
                        Available through guided learning in Bangalore (Bengaluru) and online for students who cannot attend locally.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
                        <a
                            href="https://wa.me/919836952545?text=Hello%20Krishna%20Flute%20Academy%2C%20I%20am%20exploring%20your%20Bansuri%20courses%20and%20am%20not%20sure%20where%20to%20start.%20Could%20we%20discuss%20which%20learning%20path%20is%20right%20for%20me%3F"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-full transition-all shadow-md hover:shadow-lg"
                        >
                            <MessageCircle className="w-4 h-4" />
                            <span>Not Sure Where to Start? Talk to Us</span>
                        </a>

                        <a
                            href="/KFA-Brochure.pdf"
                            download="Krishna-Flute-Academy-Brochure.pdf"
                            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs sm:text-sm font-semibold px-5 py-3 rounded-full transition-all"
                        >
                            <Download className="w-4 h-4" />
                            <span>Download Academy Brochure</span>
                        </a>
                    </div>
                </div>
            </header>

            {/* Course Cards Comparison Grid */}
            <main className="max-w-6xl mx-auto py-16 px-4 sm:px-6 lg:px-8 flex-1 w-full">
                <div className="grid md:grid-cols-2 gap-8">
                    {OVERVIEW_COURSES.map((course) => (
                        <div 
                            key={course.slug}
                            className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
                        >
                            <div>
                                <div className={`p-6 sm:p-8 bg-gradient-to-r ${course.color} text-white flex items-center justify-between`}>
                                    <div>
                                        <span className="text-[11px] uppercase tracking-wider font-extrabold text-amber-200 block mb-1">
                                            {course.badge}
                                        </span>
                                        <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight">
                                            {course.title}
                                        </h2>
                                        <p className="text-xs sm:text-sm text-white/85 font-medium mt-1">
                                            {course.heading}
                                        </p>
                                    </div>
                                    <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white flex-shrink-0 ml-4">
                                        {course.icon}
                                    </div>
                                </div>

                                <div className="p-6 sm:p-8 space-y-6">
                                    <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                                        {course.description}
                                    </p>

                                    <div>
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                                            Key Outcomes You Will Work Toward
                                        </h3>
                                        <ul className="space-y-2.5">
                                            {course.keyOutcomes.map((outcome, idx) => (
                                                <li key={idx} className="flex items-start gap-3 text-slate-700 text-xs sm:text-sm">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                                                    <span>{outcome}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 sm:p-8 pt-4 border-t border-slate-100 flex items-center justify-between gap-4 mt-auto bg-slate-50/50">
                                <span className="text-xs text-slate-500 font-medium">
                                    Guided Learning Pathway
                                </span>
                                <Link
                                    href={course.link}
                                    className="inline-flex items-center gap-2 bg-blue-900 hover:bg-blue-950 text-white font-semibold px-5 py-2.5 rounded-full text-xs sm:text-sm transition-all group-hover:gap-3"
                                >
                                    <span>{course.cta}</span>
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Level Discussion Callout */}
                <div className="mt-16 bg-gradient-to-r from-amber-500 to-amber-600 rounded-3xl p-8 sm:p-10 text-slate-950 flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg">
                    <div>
                        <h2 className="text-2xl font-bold mb-2">
                            Not sure which level is right for you?
                        </h2>
                        <p className="text-slate-900/80 text-sm sm:text-base max-w-xl leading-relaxed">
                            Every student's musical background is unique. Connect directly with Krishna Flute Academy for a personalized level discussion before starting.
                        </p>
                    </div>
                    <a
                        href="https://wa.me/919836952545?text=Hello%20Krishna%20Flute%20Academy%2C%20I%20am%20not%20sure%20which%20Bansuri%20course%20is%20right%20for%20me.%20Can%20we%20discuss%20my%20level%3F"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-slate-950 hover:bg-slate-900 text-white font-bold px-6 py-3.5 rounded-full text-sm transition-all flex-shrink-0 shadow-md"
                    >
                        <MessageCircle className="w-4 h-4 text-emerald-400" />
                        <span>Discuss Which Course Is Right for Me</span>
                    </a>
                </div>
            </main>
        </div>
    );
}
