'use client';

import React, { useState, useMemo } from 'react';
import { 
    Loader2, BookOpen, Clock, Award, Users, ChevronRight, Check, Music, Video, Info, FileText, Search, ExternalLink
} from 'lucide-react';

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
}

const stripHtml = (html: string) => {
    if (!html) return '';
    return html
        .replace(/<[^>]*>?/gm, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim();
};

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
    onRefreshCurriculum
}: CurriculumTabProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const isOnline = classroom?.description?.includes('[delivery_format:online]');
    const isOffline = classroom?.description?.includes('[delivery_format:offline]');
    const cleanDescription = classroom?.description
        ? classroom.description.replace(/\[delivery_format:(online|offline)\]/g, '').trim()
        : '';

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

            {/* Split layout: classmates on right, curriculum tree on left */}
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
                                    className="p-1.5 sm:p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500 transition-colors disabled:opacity-50"
                                    title="Refresh Curriculum"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isRefreshing ? 'animate-spin' : ''}>
                                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                                        <path d="M3 3v5h5"/>
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="p-6">
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
                                {filteredModules
                                    .map((module) => {
                                        const isModExpanded = searchQuery.trim() !== '' ? true : !!expandedModules[module.id];
                                        const chapters = filteredChapters
                                            .filter(c => c.module_id === module.id);
                                        
                                        return (
                                            <div key={module.id} className="border border-slate-150 rounded-2xl overflow-hidden transition-all shadow-xs">
                                                {/* Module Row */}
                                                <button 
                                                    onClick={() => setExpandedModules(prev => ({ ...prev, [module.id]: !prev[module.id] }))}
                                                    className="w-full flex items-center justify-between px-5 py-4 bg-slate-50/50 hover:bg-slate-50 text-left border-b border-slate-100"
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
                                                    <div className="p-4 bg-white space-y-3">
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
                                                                            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/20 hover:bg-slate-50/60 text-left border-b border-slate-100"
                                                                        >
                                                                            <div className="min-w-0 flex-1 pr-4">
                                                                                <h5 className="font-bold text-xs text-slate-800 truncate">Chapter {chapter.chapter_number}: {chapter.title}</h5>
                                                                            </div>
                                                                            <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${isChapExpanded ? 'rotate-90' : ''}`} />
                                                                        </button>

                                                                        {/* Chapter Lessons */}
                                                                        {isChapExpanded && (
                                                                            <div className="p-2 bg-white space-y-1">
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
                                                                                                onClick={() => {
                                                                                                    if (isLocked) return;
                                                                                                    setSelectedTopic(lesson);
                                                                                                }}
                                                                                                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                                                                                                    isCompleted
                                                                                                        ? 'bg-emerald-50/40 border-emerald-100/50 hover:border-emerald-250/80'
                                                                                                        : isLocked
                                                                                                            ? 'bg-slate-50/30 border-slate-100 opacity-60'
                                                                                                            : 'bg-white border-slate-100 shadow-2xs hover:border-amber-300'
                                                                                                } ${isSelected ? 'border-amber-500 bg-amber-500/5 ring-1 ring-amber-500' : ''} ${!isLocked ? 'cursor-pointer hover:bg-slate-50/40 active:scale-[0.995]' : ''}`}
                                                                                            >
                                                                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                                                                                                        isCompleted
                                                                                                            ? 'bg-emerald-50 border-emerald-150 text-emerald-500'
                                                                                                            : isLocked
                                                                                                                ? 'bg-slate-100 border-slate-200 text-slate-400'
                                                                                                                : 'bg-amber-50 border-amber-100 text-amber-500'
                                                                                                    }`}>
                                                                                                        {isCompleted ? <Check className="w-4 h-4" /> : <Music className="w-4 h-4" />}
                                                                                                    </div>
                                                                                                    <div className="min-w-0 flex-1">
                                                                                                        <h6 className="font-extrabold text-[11px] text-slate-800 truncate">
                                                                                                            {lesson.lesson_number}. {lesson.title}
                                                                                                        </h6>
                                                                                                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                                                                                            {getCleanDuration(lesson.duration, lesson.file_size) || '5 mins'} · {lesson.difficulty || 'Easy'}{lesson.file_size ? ` · 💾 ${lesson.file_size}` : ''}
                                                                                                        </p>
                                                                                                    </div>
                                                                                                </div>

                                                                                                {/* Mark Completed/Locked state trigger */}
                                                                                                {isLocked ? (
                                                                                                    <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md shrink-0">
                                                                                                        Locked
                                                                                                    </span>
                                                                                                ) : (
                                                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                                                        {(lesson.material_url || lesson.link_url) && (
                                                                                                            <button
                                                                                                                onClick={(e) => {
                                                                                                                    e.stopPropagation();
                                                                                                                    setSelectedTopic(lesson);
                                                                                                                    setShowMaterialPopup(true);
                                                                                                                }}
                                                                                                                className="px-2.5 py-1 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-900 rounded-md text-[10px] font-extrabold transition-all"
                                                                                                                title="Quick Open Material"
                                                                                                            >
                                                                                                                Open
                                                                                                            </button>
                                                                                                        )}
                                                                                                        <button
                                                                                                            onClick={(e) => {
                                                                                                                e.stopPropagation();
                                                                                                                handleToggleLessonComplete(lesson.id, status);
                                                                                                            }}
                                                                                                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                                                                                                                isCompleted
                                                                                                                    ? 'bg-emerald-100 hover:bg-emerald-250 text-emerald-700'
                                                                                                                    : 'bg-slate-100 hover:bg-amber-500/10 hover:text-amber-600 text-slate-600 border border-slate-200/50'
                                                                                                            }`}
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
                    </div>
                </div>

                {/* Right Space: Selected Topic Details + Classmates */}
                <div className="space-y-6 lg:col-span-2">
                    {/* Selected Topic Details Card */}
                    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs text-left">
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50/20 px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                                <BookOpen className="w-4.5 h-4.5 text-amber-500" />
                                Topic Details
                            </h3>
                            {selectedTopic && (() => {
                                const status = getLessonStatus(selectedTopic.id, selectedTopic.chapter_id);
                                return (
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                                        status === 'completed'
                                            ? 'bg-emerald-500/10 text-emerald-700'
                                            : 'bg-amber-500/10 text-amber-700'
                                    }`}>
                                        {status}
                                    </span>
                                );
                            })()}
                        </div>
                        
                        <div className="p-6 space-y-5">
                            {selectedTopic ? (() => {
                                const breadcrumb = getTopicBreadcrumbs(selectedTopic);
                                const status = getLessonStatus(selectedTopic.id, selectedTopic.chapter_id);
                                const isCompleted = status === 'completed';

                                return (
                                    <div className="space-y-4">
                                        <div>
                                            {breadcrumb && (
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                                    {breadcrumb}
                                                </span>
                                            )}
                                            <h4 className="font-black text-slate-800 text-sm md:text-base leading-snug">
                                                Topic {selectedTopic.lesson_number}: {selectedTopic.title}
                                            </h4>
                                        </div>

                                        {selectedTopic.description && (
                                            <div 
                                                className="text-xs text-slate-500 leading-relaxed tutorial-content max-w-none"
                                                dangerouslySetInnerHTML={{ __html: selectedTopic.description }}
                                            />
                                        )}

                                        {/* Metadata Badges */}
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full">
                                                <Clock className="w-3 h-3 text-slate-400" />
                                                {getCleanDuration(selectedTopic.duration, selectedTopic.file_size) || '5 mins'}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full">
                                                <Award className="w-3 h-3 text-slate-400" />
                                                {selectedTopic.difficulty || 'Easy'}
                                            </span>
                                            {selectedTopic.file_size && (
                                                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full">
                                                    💾 {selectedTopic.file_size}
                                                </span>
                                            )}
                                            {selectedTopic.material_type && (
                                                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#7C5E3F] bg-[#FAF5EE] border border-[#7C5E3F]/10 px-2.5 py-1 rounded-full capitalize">
                                                    {selectedTopic.material_type === 'pdf' ? <FileText className="w-3 h-3" /> : 
                                                     selectedTopic.material_type === 'audio' ? <Music className="w-3 h-3" /> : 
                                                     (selectedTopic.material_type === 'video' || selectedTopic.material_type === 'youtube_url') ? <Video className="w-3 h-3" /> : 
                                                     <Info className="w-3 h-3" />}
                                                    {selectedTopic.material_type === 'youtube_url' ? 'YouTube' : selectedTopic.material_type}
                                                </span>
                                            )}
                                        </div>

                                        {/* Bullet Points / Study Guide */}
                                        {selectedTopic.bullet_points && selectedTopic.bullet_points.length > 0 && (
                                            <div className="pt-2">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Key Practice Focus</span>
                                                <ul className="space-y-1.5 text-left">
                                                    {selectedTopic.bullet_points.map((pt: string, idx: number) => (
                                                        <li key={idx} className="text-xs text-slate-600 flex items-start gap-2 leading-relaxed">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                                                            <span>{pt}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Actions Panel */}
                                        <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-slate-100">
                                            {selectedTopic.material_url || selectedTopic.link_url ? (
                                                <button
                                                    onClick={() => setShowMaterialPopup(true)}
                                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-xl shadow-xs transition-colors"
                                                >
                                                    <BookOpen className="w-4 h-4" /> Open Material
                                                </button>
                                            ) : (
                                                <button
                                                    disabled
                                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-400 text-xs font-bold rounded-xl cursor-not-allowed"
                                                >
                                                    <Info className="w-4 h-4" /> No file uploaded
                                                </button>
                                            )}

                                            <button
                                                onClick={() => handleToggleLessonComplete(selectedTopic.id, status)}
                                                className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all border ${
                                                    isCompleted
                                                        ? 'bg-emerald-50 border-emerald-250 text-emerald-700 hover:bg-emerald-100'
                                                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                                                }`}
                                            >
                                                {isCompleted ? 'Completed ✓' : 'Mark Complete'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })() : (
                                <div className="py-10 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                                    <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center border border-amber-100 shadow-3xs">
                                        <BookOpen className="w-6 h-6 text-amber-500" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-extrabold text-slate-700">No Topic Selected</p>
                                        <p className="text-[10px] text-slate-400 max-w-[200px] mx-auto mt-1 leading-relaxed">
                                            Click on any allocated lesson on the left to view its descriptions, material files, and practice guide.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Batch Classmates List */}
                    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs text-left">
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50/20 px-6 py-5 border-b border-slate-100">
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
                                <div className="space-y-4">
                                    {classmates.map((mate) => (
                                        <div key={mate.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                                            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                                                {mate.profile_pic_url ? (
                                                    <img src={mate.profile_pic_url} alt={mate.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-[#d46211] text-sm font-extrabold">{mate.name.charAt(0)}</span>
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
        </div>
    );
}
