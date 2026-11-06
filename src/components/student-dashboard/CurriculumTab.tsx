'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    Loader2, BookOpen, Clock, Award, Users, ChevronRight, ChevronDown, Check, Music, Video, Info, FileText, Search, ExternalLink, X, Star, Layers, Sparkles
} from 'lucide-react';
import AutoLinkText from '../common/AutoLinkText';
import LessonViewer from './LessonViewer';
import { stripHtml } from '../../lib/text-utils';
import { formatCurriculumSubtitle, getCurriculumMediaInfo, parseModuleCategory } from '../../lib/curriculum-media';

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
    courseCategories?: any[];
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
    lessonDescriptions?: Record<string, string>;
    loadingDescriptionLessonId?: string | null;
    descriptionErrorLessonId?: string | null;
    onRetryLessonDescription?: (lessonId: string) => void;
    isReadOnly?: boolean;
    curriculumMode?: 'full' | 'readonly_paused' | 'readonly_frozen';
    openMobileViewerRequested?: boolean;
    onResetMobileViewerRequest?: () => void;
}

const cleanModuleDescription = (desc: string) => {
    if (!desc) return '';
    const clean = desc.replace(/^\[(.*?)\]\s*/, '');
    return stripHtml(clean);
};


/**
 * CurriculumTab displays the syllabus and detailed lesson information for students.
 */
export default function CurriculumTab({
    classroom,
    courseCategories = [],
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
    onToggleStudentSpotlight,
    lessonDescriptions = {},
    loadingDescriptionLessonId = null,
    descriptionErrorLessonId = null,
    onRetryLessonDescription,
    isReadOnly = false,
    curriculumMode = 'full',
    openMobileViewerRequested = false,
    onResetMobileViewerRequest
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

        // Open mobile viewer drawer on mobile viewport
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            setIsMobileViewerOpen(true);
        }
    };

    // Close mobile viewer and restore focus if applicable
    const handleCloseMobileViewer = () => {
        setIsMobileViewerOpen(false);
        if (lastSelectedRowRef.current) {
            lastSelectedRowRef.current.focus();
        }
    };

    // Open mobile viewer if student navigated directly to a tutorial from Home page
    useEffect(() => {
        if (openMobileViewerRequested) {
            if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                setIsMobileViewerOpen(true);
            }
            onResetMobileViewerRequest?.();
        }
    }, [openMobileViewerRequested, onResetMobileViewerRequest]);

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

    interface CategoryProgressGroup {
        id: string;
        name: string;
        order: number;
        modules: any[];
        totalLessons: number;
        completedLessons: number;
        progressPct: number;
    }

    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

    const groupedCategories = useMemo<CategoryProgressGroup[]>(() => {
        const catMap = new Map<string, { id: string; name: string; order: number; modules: any[] }>();

        filteredModules.forEach(mod => {
            const parsed = parseModuleCategory(mod, courseCategories);
            const key = parsed.categoryId || parsed.categoryName;
            if (!catMap.has(key)) {
                catMap.set(key, {
                    id: key,
                    name: parsed.categoryName,
                    order: parsed.categoryOrder,
                    modules: []
                });
            }
            catMap.get(key)!.modules.push(mod);
        });

        const groups: CategoryProgressGroup[] = Array.from(catMap.values()).map(cat => {
            const modIds = new Set(cat.modules.map(m => m.id));
            const catChapters = courseChapters.filter(c => modIds.has(c.module_id));
            const catChapIds = new Set(catChapters.map(c => c.id));

            const catLessons = unlockedLessons.filter(l => catChapIds.has(l.chapter_id));
            const total = catLessons.length;
            const completed = catLessons.filter(l => getLessonStatus(l.id, l.chapter_id) === 'completed').length;
            const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

            return {
                id: cat.id,
                name: cat.name,
                order: cat.order,
                modules: cat.modules,
                totalLessons: total,
                completedLessons: completed,
                progressPct
            };
        });

        const canonicalOrder: Record<string, number> = {
            'proficiency levels': 1,
            'specialized modules': 2,
            'compositions': 3,
            'songs': 4,
            'practice': 5
        };

        groups.sort((a, b) => {
            const orderA = canonicalOrder[a.name.toLowerCase()] ?? a.order;
            const orderB = canonicalOrder[b.name.toLowerCase()] ?? b.order;
            if (orderA !== orderB) return orderA - orderB;
            return a.name.localeCompare(b.name);
        });

        return groups;
    }, [filteredModules, courseCategories, courseChapters, unlockedLessons, getLessonStatus]);

    const displayedCategories = useMemo(() => {
        if (selectedCategoryFilter === 'all') return groupedCategories;
        return groupedCategories.filter(c => c.id === selectedCategoryFilter || c.name === selectedCategoryFilter);
    }, [groupedCategories, selectedCategoryFilter]);

    const getLevelBadge = (levelNum: number, categoryName: string) => {
        if (categoryName.toLowerCase() !== 'proficiency levels') {
            return null;
        }
        switch (levelNum) {
            case 1:
                return (
                    <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/25 rounded-full text-[9px] text-emerald-700 font-extrabold tracking-wide uppercase">
                        Beginner
                    </span>
                );
            case 2:
                return (
                    <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/25 rounded-full text-[9px] text-amber-700 font-extrabold tracking-wide uppercase">
                        Elementary
                    </span>
                );
            case 3:
                return (
                    <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/25 rounded-full text-[9px] text-blue-700 font-extrabold tracking-wide uppercase">
                        Intermediate
                    </span>
                );
            case 4:
                return (
                    <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/25 rounded-full text-[9px] text-purple-700 font-extrabold tracking-wide uppercase">
                        Advanced
                    </span>
                );
            default:
                return (
                    <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-full text-[9px] text-slate-600 font-extrabold tracking-wide uppercase">
                        Level {levelNum}
                    </span>
                );
        }
    };

    const getCategoryStyling = (catName: string) => {
        const lower = catName.toLowerCase();
        if (lower.includes('proficiency') || lower.includes('level')) {
            return {
                accent: 'bg-amber-500',
                border: 'border-amber-200',
                headerBg: 'bg-gradient-to-r from-amber-50 via-amber-50/40 to-white',
                pillBorder: 'border-amber-300',
                pillText: 'text-amber-800',
                icon: <Award className="w-4 h-4 text-amber-600 shrink-0" />
            };
        }
        if (lower.includes('composition')) {
            return {
                accent: 'bg-indigo-500',
                border: 'border-indigo-200',
                headerBg: 'bg-gradient-to-r from-indigo-50 via-indigo-50/40 to-white',
                pillBorder: 'border-indigo-300',
                pillText: 'text-indigo-800',
                icon: <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
            };
        }
        if (lower.includes('song')) {
            return {
                accent: 'bg-sky-500',
                border: 'border-sky-200',
                headerBg: 'bg-gradient-to-r from-sky-50 via-sky-50/40 to-white',
                pillBorder: 'border-sky-300',
                pillText: 'text-sky-800',
                icon: <Music className="w-4 h-4 text-sky-600 shrink-0" />
            };
        }
        if (lower.includes('practice')) {
            return {
                accent: 'bg-rose-500',
                border: 'border-rose-200',
                headerBg: 'bg-gradient-to-r from-rose-50 via-rose-50/40 to-white',
                pillBorder: 'border-rose-300',
                pillText: 'text-rose-800',
                icon: <Star className="w-4 h-4 text-rose-600 shrink-0" />
            };
        }
        return {
            accent: 'bg-emerald-500',
            border: 'border-emerald-200',
            headerBg: 'bg-gradient-to-r from-emerald-50 via-emerald-50/40 to-white',
            pillBorder: 'border-emerald-300',
            pillText: 'text-emerald-800',
            icon: <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
        };
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300 select-none" onCopy={(event) => event.preventDefault()} onCut={(event) => event.preventDefault()} onContextMenu={(event) => event.preventDefault()}>
            {/* Read-Only Status Banner */}
            {isReadOnly && (
                <div className={`p-4 sm:p-5 rounded-2xl border flex items-start gap-3.5 text-left shadow-2xs ${
                    curriculumMode === 'readonly_paused'
                        ? 'bg-amber-50/90 border-amber-200 text-amber-950'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}>
                    <Info className={`w-5 h-5 shrink-0 mt-0.5 ${curriculumMode === 'readonly_paused' ? 'text-amber-600' : 'text-slate-500'}`} />
                    <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold">
                                {curriculumMode === 'readonly_paused' ? 'Learning Paused — Read-Only Mode' : 'Former Student — Read-Only Mode'}
                            </h4>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                curriculumMode === 'readonly_paused'
                                    ? 'bg-amber-200/70 text-amber-900 border border-amber-300'
                                    : 'bg-slate-200 text-slate-700 border border-slate-300'
                            }`}>
                                Read-Only
                            </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            {curriculumMode === 'readonly_paused'
                                ? 'Your learning is temporarily paused. Your curriculum progress has been safely preserved and remains available for your review and self-paced practice. Progress checklist changes are suspended.'
                                : 'Your regular classes are concluded, but your full learning history has been preserved so you can continue revisiting your curriculum and practice materials.'}
                        </p>
                    </div>
                </div>
            )}

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
                            <div className="space-y-6">
                                {/* Category Quick Navigation / Progress Pills */}
                                {groupedCategories.length > 1 && (
                                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedCategoryFilter('all')}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border ${
                                                selectedCategoryFilter === 'all'
                                                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                                    : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                                            }`}
                                        >
                                            <Layers className="w-3.5 h-3.5" />
                                            <span>All Sections</span>
                                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                                                selectedCategoryFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                {completedLessonsCount}/{totalAllocatedLessons}
                                            </span>
                                        </button>

                                        {groupedCategories.map(cat => {
                                            const isSelected = selectedCategoryFilter === cat.id || selectedCategoryFilter === cat.name;
                                            const style = getCategoryStyling(cat.name);
                                            return (
                                                <button
                                                    key={cat.id}
                                                    type="button"
                                                    onClick={() => setSelectedCategoryFilter(isSelected ? 'all' : cat.id)}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border ${
                                                        isSelected
                                                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                                                    }`}
                                                >
                                                    {style.icon}
                                                    <span>{cat.name}</span>
                                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                                        isSelected
                                                            ? 'bg-white/20 text-white'
                                                            : cat.progressPct === 100
                                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                                                    }`}>
                                                        {cat.completedLessons}/{cat.totalLessons}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Category Sections */}
                                {displayedCategories.map((cat) => {
                                    const isCatExpanded = searchQuery.trim() !== '' ? true : (expandedCategories[cat.id] ?? true);
                                    const style = getCategoryStyling(cat.name);

                                    return (
                                        <div key={cat.id} className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/20 shadow-xs">
                                            {/* Category Main Heading */}
                                            <div className={`p-3.5 sm:p-4 ${style.headerBg} border-b border-slate-150 flex items-center justify-between gap-3`}>
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedCategories(prev => ({ ...prev, [cat.id]: !isCatExpanded }))}
                                                    className="flex items-center gap-2.5 sm:gap-3 flex-1 text-left cursor-pointer group min-w-0"
                                                    aria-expanded={isCatExpanded}
                                                >
                                                    <span className={`w-2 h-5 ${style.accent} rounded-full shrink-0 group-hover:scale-y-110 transition-transform`} />
                                                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                        {style.icon}
                                                        <h3 className="font-black text-xs sm:text-sm text-slate-800 tracking-wide uppercase truncate">
                                                            {cat.name}
                                                        </h3>
                                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200 shrink-0">
                                                            {cat.modules.length} {cat.name.toLowerCase() === 'proficiency levels' ? (cat.modules.length === 1 ? 'Level' : 'Levels') : (cat.modules.length === 1 ? 'Module' : 'Modules')}
                                                        </span>
                                                    </div>
                                                </button>

                                                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                                    {/* Category Progress Bar & Badge */}
                                                    <div className="flex items-center gap-2">
                                                        <div className="hidden sm:block w-20 bg-slate-200/80 rounded-full h-2 overflow-hidden">
                                                            <div
                                                                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                                                                style={{ width: `${cat.progressPct}%` }}
                                                            />
                                                        </div>
                                                        <span className={`text-[10px] sm:text-[11px] font-black px-2.5 py-0.5 sm:py-1 rounded-full border ${
                                                            cat.progressPct === 100
                                                                ? 'bg-emerald-100/90 border-emerald-300 text-emerald-800'
                                                                : 'bg-white border-slate-200 text-slate-700'
                                                        }`}>
                                                            {cat.completedLessons}/{cat.totalLessons} ({cat.progressPct}%)
                                                        </span>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedCategories(prev => ({ ...prev, [cat.id]: !isCatExpanded }))}
                                                        className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/60 transition-colors cursor-pointer"
                                                        aria-label={`Toggle ${cat.name}`}
                                                    >
                                                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isCatExpanded ? '' : '-rotate-90'}`} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Category Modules */}
                                            {isCatExpanded && (
                                                <div className="p-3 sm:p-4 space-y-3 bg-white/60">
                                                    {cat.modules.map((module) => {
                                                        const isModExpanded = searchQuery.trim() !== '' ? true : !!expandedModules[module.id];
                                                        const chapters = filteredChapters.filter(c => c.module_id === module.id);
                                                        const levelBadge = getLevelBadge(module.module_number, cat.name);
                                                        
                                                        return (
                                                            <div key={module.id} className="border border-slate-150 rounded-2xl overflow-hidden transition-all shadow-xs bg-white">
                                                                {/* Module Row */}
                                                                <button 
                                                                    onClick={() => setExpandedModules(prev => ({ ...prev, [module.id]: !prev[module.id] }))}
                                                                    className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 bg-slate-50/60 hover:bg-slate-100/70 text-left border-b border-slate-100 transition-colors cursor-pointer"
                                                                    aria-expanded={isModExpanded}
                                                                >
                                                                    <div className="min-w-0 flex-1 pr-4">
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">
                                                                                {cat.name.toLowerCase() === 'proficiency levels' ? `Level ${module.module_number}` : `Module ${module.module_number}`}
                                                                            </span>
                                                                            {levelBadge}
                                                                        </div>
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
                                                                                                    {(() => {
                                                                                                        const mediaInfo = getCurriculumMediaInfo(lesson);
                                                                                                        return (
                                                                                                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                                                                                                {formatCurriculumSubtitle(lesson)}{mediaInfo.hasMedia && lesson.file_size ? ` · 💾 ${lesson.file_size}` : ''}
                                                                                                            </p>
                                                                                                        );
                                                                                                    })()}
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
                                                                                                    {!isReadOnly ? (
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
                                                                                                    ) : (
                                                                                                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                                                                                                            isCompleted
                                                                                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                                                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                                                                                                        }`}>
                                                                                                            {isCompleted ? '✓ Done' : 'Syllabus'}
                                                                                                        </span>
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
                                                        })
                                                    )}
                                                </div>
                                            )}
                                                    </div>
                                                );
                                            })}
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
                                description={selectedTopic ? lessonDescriptions[selectedTopic.id] : undefined}
                                isLoadingDescription={selectedTopic ? (loadingDescriptionLessonId === selectedTopic.id && lessonDescriptions[selectedTopic.id] === undefined) : false}
                                descriptionError={selectedTopic ? descriptionErrorLessonId === selectedTopic.id : false}
                                onRetryDescription={selectedTopic && onRetryLessonDescription ? () => onRetryLessonDescription(selectedTopic.id) : undefined}
                                status={selectedTopic ? getLessonStatus(selectedTopic.id, selectedTopic.chapter_id) : 'unlocked'}
                                breadcrumb={selectedTopic ? getTopicBreadcrumbs(selectedTopic) : ''}
                                isStudentSpotlight={selectedTopic ? studentSpotlights?.studentSpotlight?.lesson_id === selectedTopic.id : false}
                                onToggleSpotlight={isReadOnly ? undefined : onToggleStudentSpotlight}
                                onOpenMaterial={() => setShowMaterialPopup(true)}
                                onToggleComplete={isReadOnly ? undefined : handleToggleLessonComplete}
                                isReadOnly={isReadOnly}
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
                                description={selectedTopic ? lessonDescriptions[selectedTopic.id] : undefined}
                                isLoadingDescription={selectedTopic ? (loadingDescriptionLessonId === selectedTopic.id && lessonDescriptions[selectedTopic.id] === undefined) : false}
                                descriptionError={selectedTopic ? descriptionErrorLessonId === selectedTopic.id : false}
                                onRetryDescription={selectedTopic && onRetryLessonDescription ? () => onRetryLessonDescription(selectedTopic.id) : undefined}
                                status={getLessonStatus(selectedTopic.id, selectedTopic.chapter_id)}
                                breadcrumb={getTopicBreadcrumbs(selectedTopic)}
                                isStudentSpotlight={selectedTopic ? studentSpotlights?.studentSpotlight?.lesson_id === selectedTopic.id : false}
                                isTeacherSpotlight={selectedTopic ? studentSpotlights?.teacherSpotlight?.lesson_id === selectedTopic.id : false}
                                onToggleSpotlight={isReadOnly ? undefined : onToggleStudentSpotlight}
                                onOpenMaterial={() => {
                                    setIsMobileViewerOpen(false);
                                    setShowMaterialPopup(true);
                                }}
                                onToggleComplete={isReadOnly ? undefined : handleToggleLessonComplete}
                                onClose={handleCloseMobileViewer}
                                isReadOnly={isReadOnly}
                                isMobile={true}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
