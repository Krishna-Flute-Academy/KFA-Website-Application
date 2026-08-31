'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    Loader2, BookOpen, Clock, Award, Users, ChevronRight, ChevronDown, Check, Music, Video, Info, FileText, Search, ExternalLink, X, Star
} from 'lucide-react';
import AutoLinkText from '../common/AutoLinkText';
import LessonViewer from './LessonViewer';
import { stripHtml } from '../../lib/text-utils';

interface ClassroomInfo {
    id: string;
    name: string;
    teacher_id?: string;
    teacher_name?: string;
    teacher_email?: string;
    description?: string;
}

interface Classmate {
    id: string;
    name: string;
    level: string;
    profile_pic_url: string | null;
}

interface CurriculumTabProps {
    classroom: ClassroomInfo | null;
    courseModules: any[];
    courseChapters: any[];
    courseLessons: any[];
    completedLessonsCount: number;
    totalAllocatedLessons: number;
    expandedModules: Record<string, boolean>;
    setExpandedModules: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    expandedChapters: Record<string, boolean>;
    setExpandedChapters: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    getLessonStatus: (lessonId: string, chapterId: string, moduleId?: string) => 'completed' | 'unlocked' | 'locked';
    selectedTopic: any | null;
    setSelectedTopic: (topic: any) => void;
    handleToggleLessonComplete: (lessonId: string, currentStatus: string) => Promise<void>;
    getTopicBreadcrumbs: (topic: any) => string;
    setShowMaterialPopup: (show: boolean) => void;
    classmates: Classmate[];
    onRefreshCurriculum?: () => void;
    studentSpotlights?: { teacherSpotlight: any | null; studentSpotlight: any | null };
    onToggleStudentSpotlight?: (lessonId: string) => Promise<void> | void;
}

const cleanModuleDescription = (desc: string) => {
    if (!desc) return '';
    const clean = desc.replace(/^\[(.*?)\]\s*/, '');
    return stripHtml(clean);
};

const getCleanDuration = (duration: string, fileSize: string) => {
    if (!duration) return '';
    if (fileSize && duration.includes(fileSize)) {
        const parts = duration.split('•');
        return parts[0].trim();
    }
    return duration;
};

/**
 * CurriculumTab displays the syllabus and detailed lesson information for students.
 */
export default function CurriculumTab({
    classroom,
    courseModules,
    courseChapters,
    courseLessons,
    completedLessonsCount,
    totalAllocatedLessons,
    expandedModules,
    setExpandedModules,
    expandedChapters,
    setExpandedChapters,
    getLessonStatus,
    selectedTopic,
    setSelectedTopic,
    handleToggleLessonComplete,
    getTopicBreadcrumbs,
    setShowMaterialPopup,
    classmates,
    onRefreshCurriculum,
    studentSpotlights,
    onToggleStudentSpotlight
}: CurriculumTabProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isMobileViewerOpen, setIsMobileViewerOpen] = useState(false);
    const [mobileClassmatesOpen, setMobileClassmatesOpen] = useState(false);
    const desktopViewerRef = useRef<HTMLDivElement>(null);
    const lastSelectedRowRef = useRef<HTMLDivElement | null>(null);

    const isOnline = classroom?.description?.includes('[delivery_format:online]');
    const isOffline = classroom?.description?.includes('[delivery_format:offline]');
    const cleanDescription = classroom?.description
        ? classroom.description.replace(/\[delivery_format:(online|offline)\]/g, '').trim()
        : '';

    // Lock body scroll on mobile when bottom sheet drawer is open
    useEffect(() => {
        if (isMobileViewerOpen) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [isMobileViewerOpen]);

    // Handle topic selection
    const handleSelectTopic = (lesson: any, rowElement?: HTMLDivElement | null) => {
        setSelectedTopic(lesson);
        if (rowElement) {
            lastSelectedRowRef.current = rowElement;
        }

        // Check viewport width
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            setIsMobileViewerOpen(true);
        } else {
            // On desktop, ensure the sticky viewer is nicely aligned
            if (desktopViewerRef.current) {
                const rect = desktopViewerRef.current.getBoundingClientRect();
                const isPartiallyVisible = rect.top < window.innerHeight && rect.bottom > 100;
                if (!isPartiallyVisible) {
                    desktopViewerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        }
    };

    // Close mobile viewer and restore focus if applicable
    const handleCloseMobileViewer = () => {
        setIsMobileViewerOpen(false);
        if (lastSelectedRowRef.current) {
            lastSelectedRowRef.current.focus();
        }
    };

    // Auto-scroll to selected topic and open mobile drawer if viewport is mobile
    useEffect(() => {
        if (!selectedTopic?.id) return;
        const timer = setTimeout(() => {
            const el = document.querySelector(`[data-lesson-id="${selectedTopic.id}"]`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 150);
        return () => clearTimeout(timer);
    }, [selectedTopic?.id]);

    // Filter out locked lessons (hide locked topics/chapters/modules from student view)
    const unlockedLessons = useMemo(() => {
        return courseLessons.filter(l => getLessonStatus(l.id, l.chapter_id) !== 'locked');
    }, [courseLessons, getLessonStatus]);

    const filteredLessons = useMemo(() => {
        let base = unlockedLessons;
        if (searchQuery.trim()) {
            base = base.filter(l => 
                l.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                (l.description || '').toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        return base;
    }, [unlockedLessons, searchQuery]);

    const filteredChapters = useMemo(() => {
        return courseChapters.filter(chapter => {
            const chapterLessons = filteredLessons.filter(l => l.chapter_id === chapter.id);
            return chapterLessons.length > 0;
        });
    }, [courseChapters, filteredLessons]);

    const filteredModules = useMemo(() => {
        return courseModules.filter(module => {
            const moduleChapters = filteredChapters.filter(c => c.module_id === module.id);
            return moduleChapters.length > 0;
        });
    }, [courseModules, filteredChapters]);

    return (
        <div className="space-y-8 animate-in fade-in duration-300 select-none" onCopy={(event) => event.preventDefault()} onCut={(event) => event.preventDefault()} onContextMenu={(event) => event.preventDefault()}>
            {/* Classroom Header Summary */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row justify-between gap-6">
                <div className="space-y-2 max-w-xl text-left">
                    <div className="flex flex-wrap gap-2">
                        <span className="bg-orange-50 border border-orange-100 text-orange-600 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">Classroom Hub</span>
                        {isOnline && (
                            <span className="bg-blue-50 border border-blue-100 text-blue-650 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                Online Class
                            </span>
                        )}
                        {isOffline && (
                            <span className="bg-emerald-50 border border-emerald-100 text-emerald-655 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                Offline Class
                            </span>
                        )}
                    </div>
                    <h2 className="text-xl md:text-2xl font-black text-slate-900 leading-tight">{classroom?.name || 'Not Enrolled'}</h2>
                    <p className="text-xs text-slate-500 leading-relaxed">{cleanDescription || 'Active practice batch directory. Work through dynamic syllabus modules below.'}</p>
                </div>
                <div className="border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 flex flex-col justify-center shrink-0 text-left">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Your Instructor</p>
                    <p className="font-extrabold text-sm text-slate-800 mt-1">{classroom?.teacher_name}</p>
                    <p className="text-xs text-slate-400">{classroom?.teacher_email}</p>
                </div>
            </div>

            {/* Split layout: Curriculum Tree on Left, Sticky Viewer & Classmates on Right */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
                {/* Left: Curriculum Syllabus Tree */}
                <div className="lg:col-span-3 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs text-left">
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50/20 px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h3 className="font-extrabold text-slate-800 text-sm sm:text-base">Academy Syllabus</h3>
                            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">Allocated lessons. Mark completed to record your learning.</p>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                            {/* Search bar */}
                            <div className="relative w-full sm:w-52 shrink-0">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <input 
                                    type="text"
                                    placeholder="Search syllabus..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none text-slate-850 placeholder:text-slate-400 transition-all"
                                />
                            </div>
                            <div className="bg-amber-500/10 text-amber-700 text-[10px] sm:text-xs font-extrabold px-2.5 sm:px-3 py-1.5 rounded-full shrink-0 text-center">
                                Completed: {completedLessonsCount} / {totalAllocatedLessons}
                            </div>
                            {onRefreshCurriculum && (
                                <button 
                                    onClick={async () => {
                                        setIsRefreshing(true);
                                        await onRefreshCurriculum();
                                        setIsRefreshing(false);
                                    }}
                                    disabled={isRefreshing}
                                    className="p-1.5 sm:p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500 transition-colors disabled:opacity-50 cursor-pointer"
                                    title="Refresh Curriculum"
                                    aria-label="Refresh Curriculum"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isRefreshing ? 'animate-spin' : ''}>
                                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                                        <path d="M3 3v5h5"/>
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>
                    
                    <div className="p-4 sm:p-6">
                        {filteredModules.length === 0 ? (
                            <div className="py-12 text-center text-slate-400">
                                {searchQuery.trim() !== '' ? (
                                    <>
                                        <Search className="w-8 h-8 mx-auto mb-2 text-slate-300 animate-pulse" />
                                        <p className="text-xs font-bold text-slate-500">No matching topics found.</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Try searching with a different keyword.</p>
                                    </>
                                ) : courseLessons.length === 0 ? (
                                    <>
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-slate-300" />
                                        <p className="text-xs">Loading course modules...</p>
                                    </>
                                ) : (
                                    <>
                                        <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                        <p className="text-xs font-bold text-slate-500">No unlocked syllabus materials yet.</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Your instructor has not unlocked any topics for this class yet.</p>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {filteredModules.map((module) => {
                                    const isModExpanded = searchQuery.trim() !== '' ? true : !!expandedModules[module.id];
                                    const chapters = filteredChapters.filter(c => c.module_id === module.id);
                                    
                                    return (
                                        <div key={module.id} className="border border-slate-150 rounded-2xl overflow-hidden transition-all shadow-xs">
                                            {/* Module Row */}
                                            <button 
                                                onClick={() => setExpandedModules(prev => ({ ...prev, [module.id]: !prev[module.id] }))}
                                                className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 bg-slate-50/60 hover:bg-slate-100/70 text-left border-b border-slate-100 transition-colors cursor-pointer"
                                                aria-expanded={isModExpanded}
                                            >
                                                <div className="min-w-0 flex-1 pr-4">
                                                    <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Module {module.module_number}</span>
                                                    <h4 className="font-extrabold text-xs md:text-sm text-slate-800 mt-0.5 truncate">{module.title}</h4>
                                                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">{cleanModuleDescription(module.description)}</p>
                                                </div>
                                                <ChevronRight className={`w-4.5 h-4.5 text-slate-400 transition-transform shrink-0 ${isModExpanded ? 'rotate-90' : ''}`} />
                                            </button>

                                            {/* Module Chapters (Collapsed/Expanded) */}
                                            {isModExpanded && (
                                                <div className="p-3 sm:p-4 bg-white space-y-3">
                                                    {chapters.length === 0 ? (
                                                        <p className="text-[10px] text-slate-400 py-2">No chapters published in this module.</p>
                                                    ) : (
                                                        chapters.map((chapter) => {
                                                            const isChapExpanded = searchQuery.trim() !== '' ? true : !!expandedChapters[chapter.id];
                                                            const lessons = filteredLessons.filter(l => l.chapter_id === chapter.id);

                                                            return (
                                                                <div key={chapter.id} className="border border-slate-100 rounded-xl overflow-hidden">
                                                                    {/* Chapter Row */}
                                                                    <button
                                                                        onClick={() => setExpandedChapters(prev => ({ ...prev, [chapter.id]: !prev[chapter.id] }))}
                                                                        className="w-full flex items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 bg-slate-50/30 hover:bg-slate-50/80 text-left border-b border-slate-100 transition-colors cursor-pointer"
                                                                        aria-expanded={isChapExpanded}
                                                                    >
                                                                        <div className="min-w-0 flex-1 pr-4">
                                                                            <h5 className="font-bold text-xs text-slate-800 truncate">Chapter {chapter.chapter_number}: {chapter.title}</h5>
                                                                        </div>
                                                                        <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${isChapExpanded ? 'rotate-90' : ''}`} />
                                                                    </button>

                                                                    {/* Chapter Lessons */}
                                                                    {isChapExpanded && (
                                                                        <div className="p-2 bg-white space-y-1.5">
                                                                            {lessons.length === 0 ? (
                                                                                <p className="text-[10px] text-slate-400 p-2">No lessons published in this chapter.</p>
                                                                            ) : (
                                                                                lessons.map((lesson) => {
                                                                                    const status = getLessonStatus(lesson.id, chapter.id, module.id);
                                                                                    const isCompleted = status === 'completed';
                                                                                    const isLocked = status === 'locked';
                                                                                    const isSelected = selectedTopic?.id === lesson.id;

                                                                                    return (
                                                                                        <div 
                                                                                            key={lesson.id}
                                                                                            role="button"
                                                                                            tabIndex={isLocked ? -1 : 0}
                                                                                            aria-selected={isSelected}
                                                                                            aria-label={`View lesson ${lesson.lesson_number}: ${lesson.title}`}
                                                                                            onClick={(e) => {
                                                                                                if (isLocked) return;
                                                                                                handleSelectTopic(lesson, e.currentTarget);
                                                                                            }}
                                                                                            onKeyDown={(e) => {
                                                                                                if (isLocked) return;
                                                                                                if (e.key === 'Enter' || e.key === ' ') {
                                                                                                    e.preventDefault();
                                                                                                    handleSelectTopic(lesson, e.currentTarget);
                                                                                                }
                                                                                            }}
                                                                                            className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all ${
                                                                                                isSelected
                                                                                                    ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/40 shadow-sm'
                                                                                                    : isCompleted
                                                                                                        ? 'bg-emerald-50/35 border-emerald-100 hover:border-emerald-250'
                                                                                                        : isLocked
                                                                                                            ? 'bg-slate-50/30 border-slate-100 opacity-60'
                                                                                                            : 'bg-white border-slate-100 shadow-2xs hover:border-amber-300'
                                                                                            } ${!isLocked ? 'cursor-pointer hover:bg-slate-50/70 active:scale-[0.995]' : ''}`}
                                                                                            data-lesson-id={lesson.id}
                                                                                        >
                                                                                            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                                                                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                                                                                                    isSelected
                                                                                                        ? 'bg-amber-500 text-slate-950 border-amber-600 font-bold shadow-xs'
                                                                                                        : isCompleted
                                                                                                            ? 'bg-emerald-50 border-emerald-150 text-emerald-600'
                                                                                                            : isLocked
                                                                                                                ? 'bg-slate-100 border-slate-200 text-slate-400'
                                                                                                                : 'bg-amber-50 border-amber-100 text-amber-500'
                                                                                                }`}>
                                                                                                    {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : <Music className="w-4 h-4" />}
                                                                                                </div>
                                                                                                <div className="min-w-0 flex-1">
                                                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                                                        <h6 className={`font-extrabold text-[11px] sm:text-xs truncate ${isSelected ? 'text-amber-950 font-black' : 'text-slate-800'}`}>
                                                                                                            {lesson.lesson_number}. {lesson.title}
                                                                                                        </h6>
                                                                                                        {isSelected && (
                                                                                                            <span className="hidden sm:inline-block text-[8px] font-black uppercase px-1.5 py-0.2 rounded-md bg-amber-500 text-slate-950 shrink-0 font-mono">
                                                                                                                Viewing
                                                                                                            </span>
                                                                                                        )}
                                                                                                        {studentSpotlights?.teacherSpotlight?.lesson_id === lesson.id && (
                                                                                                            <span className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-900 border border-amber-300 shrink-0 font-mono">
                                                                                                                ⭐ Teacher Spotlight
                                                                                                            </span>
                                                                                                        )}
                                                                                                        {studentSpotlights?.studentSpotlight?.lesson_id === lesson.id && (
                                                                                                            <span className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-800 border border-amber-200 shrink-0 font-mono">
                                                                                                                ★ My Spotlight
                                                                                                            </span>
                                                                                                        )}
                                                                                                    </div>
                                                                                                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                                                                                        {getCleanDuration(lesson.duration, lesson.file_size) || '5 mins'} · {lesson.difficulty || 'Easy'}{lesson.file_size ? ` · 💾 ${lesson.file_size}` : ''}
                                                                                                    </p>
                                                                                                </div>
                                                                                            </div>

                                                                                            {/* Actions: Distinct Open vs Done vs Spotlight */}
                                                                                            {isLocked ? (
                                                                                                <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md shrink-0">
                                                                                                    Locked
                                                                                                </span>
                                                                                            ) : (
                                                                                                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                                                                                    {onToggleStudentSpotlight && (
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            onClick={(e) => {
                                                                                                                e.stopPropagation();
                                                                                                                onToggleStudentSpotlight(lesson.id);
                                                                                                            }}
                                                                                                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                                                                                                studentSpotlights?.studentSpotlight?.lesson_id === lesson.id
                                                                                                                    ? 'bg-amber-100 border-amber-300 text-amber-800 shadow-2xs'
                                                                                                                    : 'bg-white hover:bg-slate-50 text-slate-300 hover:text-amber-500 border-slate-200/80'
                                                                                                            }`}
                                                                                                            title={studentSpotlights?.studentSpotlight?.lesson_id === lesson.id ? 'My Spotlight (Click to remove)' : 'Set as My Spotlight'}
                                                                                                        >
                                                                                                            <Star className={`w-3.5 h-3.5 ${studentSpotlights?.studentSpotlight?.lesson_id === lesson.id ? 'fill-amber-500 text-amber-500' : ''}`} />
                                                                                                        </button>
                                                                                                    )}
                                                                                                    {(lesson.material_url || lesson.link_url) && (
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            onClick={(e) => {
                                                                                                                e.stopPropagation();
                                                                                                                setSelectedTopic(lesson);
                                                                                                                setShowMaterialPopup(true);
                                                                                                            }}
                                                                                                            className="px-2.5 py-1 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-950 rounded-lg text-[10px] font-black transition-all shadow-xs active:scale-95 flex items-center gap-0.5 cursor-pointer"
                                                                                                            title="Quick Open Study Material"
                                                                                                        >
                                                                                                            <span>Open</span>
                                                                                                            <ChevronRight className="w-3 h-3 text-slate-900" />
                                                                                                        </button>
                                                                                                    )}
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        onClick={(e) => {
                                                                                                            e.stopPropagation();
                                                                                                            handleToggleLessonComplete(lesson.id, status);
                                                                                                        }}
                                                                                                        className={`px-2.5 sm:px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                                                                                            isCompleted
                                                                                                                ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-200'
                                                                                                                : 'bg-slate-100 hover:bg-amber-500/10 hover:text-amber-700 text-slate-600 border border-slate-200/60'
                                                                                                        }`}
                                                                                                        title={isCompleted ? "Mark Incomplete" : "Mark Complete"}
                                                                                                    >
                                                                                                        {isCompleted ? '✓' : 'Done'}
                                                                                                    </button>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    );
                                                                                })
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Mobile Classmates Accordion Section (Below syllabus for mobile users) */}
                        <div className="lg:hidden mt-6 pt-4 border-t border-slate-150">
                            <button
                                type="button"
                                onClick={() => setMobileClassmatesOpen(!mobileClassmatesOpen)}
                                className="w-full flex items-center justify-between p-3.5 bg-slate-50/70 rounded-2xl border border-slate-200 hover:bg-slate-100/70 transition-colors text-left"
                            >
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-amber-500" />
                                    <span className="font-bold text-xs text-slate-800">
                                        Batch Classmates ({classmates.length})
                                    </span>
                                </div>
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${mobileClassmatesOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {mobileClassmatesOpen && (
                                <div className="p-3 bg-white rounded-2xl border border-slate-150 mt-2 space-y-2">
                                    {classmates.length === 0 ? (
                                        <p className="text-xs text-slate-400 py-2 text-center">No classmates enrolled yet.</p>
                                    ) : (
                                        classmates.map((mate) => (
                                            <div key={mate.id} className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50/40">
                                                <div className="w-8 h-8 rounded-xl bg-amber-50 border border-slate-150 flex items-center justify-center overflow-hidden shrink-0">
                                                    {mate.profile_pic_url ? (
                                                        <img src={mate.profile_pic_url} alt={mate.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-[#d46211] text-xs font-bold">{mate.name.charAt(0)}</span>
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h5 className="font-bold text-xs text-slate-800 truncate">{mate.name}</h5>
                                                    <span className="inline-block bg-slate-100 text-slate-500 text-[8px] font-extrabold px-1.5 py-0.2 rounded uppercase">
                                                        {mate.level}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Desktop Sticky Viewer + Classmates (Hidden on mobile < 1024px) */}
                <div 
                    ref={desktopViewerRef}
                    className="hidden lg:block space-y-6 lg:col-span-2 lg:sticky lg:top-20 lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 pr-1 text-left"
                >
                    {/* Selected Topic Details Card */}
                    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50/20 px-6 py-4.5 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                                <BookOpen className="w-4.5 h-4.5 text-amber-500" />
                                Topic Details
                            </h3>
                            {selectedTopic && (
                                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest font-mono">
                                    Topic #{selectedTopic.lesson_number}
                                </span>
                            )}
                        </div>
                        
                        <div className="p-6">
                            <LessonViewer
                                topic={selectedTopic}
                                status={selectedTopic ? getLessonStatus(selectedTopic.id, selectedTopic.chapter_id) : 'unlocked'}
                                breadcrumb={selectedTopic ? getTopicBreadcrumbs(selectedTopic) : ''}
                                isStudentSpotlight={selectedTopic ? studentSpotlights?.studentSpotlight?.lesson_id === selectedTopic.id : false}
                                isTeacherSpotlight={selectedTopic ? studentSpotlights?.teacherSpotlight?.lesson_id === selectedTopic.id : false}
                                onToggleSpotlight={onToggleStudentSpotlight}
                                onOpenMaterial={() => setShowMaterialPopup(true)}
                                onToggleComplete={handleToggleLessonComplete}
                                isMobile={false}
                            />
                        </div>
                    </div>

                    {/* Batch Classmates List */}
                    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs text-left">
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50/20 px-6 py-4.5 border-b border-slate-100">
                            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                                <Users className="w-4.5 h-4.5 text-amber-500" />
                                Batch Classmates ({classmates.length})
                            </h3>
                        </div>
                        <div className="p-6">
                            {classmates.length === 0 ? (
                                <div className="py-6 text-center text-slate-400">
                                    <p className="text-xs">No classmates enrolled yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-3.5 max-h-64 overflow-y-auto pr-1">
                                    {classmates.map((mate) => (
                                        <div key={mate.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                                            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                                                {mate.profile_pic_url ? (
                                                    <img src={mate.profile_pic_url} alt={mate.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-[#d46211] text-xs font-extrabold">{mate.name.charAt(0)}</span>
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h5 className="font-bold text-xs text-slate-800 truncate">{mate.name}</h5>
                                                <span className="inline-block bg-slate-100 text-slate-500 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase mt-0.5">
                                                    {mate.level}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Bottom Sheet Drawer (< 1024px) */}
            {isMobileViewerOpen && selectedTopic && (
                <div 
                    className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
                    onClick={handleCloseMobileViewer}
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Lesson details for ${selectedTopic.title}`}
                >
                    <div 
                        className="bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 shadow-2xl max-h-[88vh] flex flex-col animate-in slide-in-from-bottom duration-300 text-left overflow-hidden select-none"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Native Mobile Swipe Handle */}
                        <div 
                            onClick={handleCloseMobileViewer}
                            className="w-full pt-3 pb-1 flex justify-center cursor-pointer shrink-0"
                            title="Close drawer"
                        >
                            <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                        </div>

                        {/* Scrollable Content inside Drawer */}
                        <div className="flex-1 overflow-y-auto px-5 pt-2 pb-8">
                            <LessonViewer
                                topic={selectedTopic}
                                status={getLessonStatus(selectedTopic.id, selectedTopic.chapter_id)}
                                breadcrumb={getTopicBreadcrumbs(selectedTopic)}
                                isStudentSpotlight={selectedTopic ? studentSpotlights?.studentSpotlight?.lesson_id === selectedTopic.id : false}
                                isTeacherSpotlight={selectedTopic ? studentSpotlights?.teacherSpotlight?.lesson_id === selectedTopic.id : false}
                                onToggleSpotlight={onToggleStudentSpotlight}
                                onOpenMaterial={() => {
                                    setIsMobileViewerOpen(false);
                                    setShowMaterialPopup(true);
                                }}
                                onToggleComplete={handleToggleLessonComplete}
                                onClose={handleCloseMobileViewer}
                                isMobile={true}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
