'use client';

import React from 'react';
import { 
    Sparkles, Plus, BookOpen, Sliders, Search, X, 
    ChevronDown, ChevronUp, Trash2, Loader2, Film, Music, 
    FileText, Lock, Unlock, CheckCircle, Check, UserPlus
} from 'lucide-react';

interface CurriculumTabProps {
    curriculumTab: 'classwide' | 'individual';
    setCurriculumTab: (tab: 'classwide' | 'individual') => void;
    activeAttendanceRoster: any[];
    selectedStudentForCurriculum: any;
    setSelectedStudentForCurriculum: (student: any) => void;
    allocatedInventoryItems: any[];
    hasAnyVisibleModule: boolean;
    curriculumSearchQuery: string;
    setCurriculumSearchQuery: (query: string) => void;
    handleExpandAllCurriculum: () => void;
    handleCollapseAllCurriculum: () => void;
    visibleCurriculum: any[];
    expandedHeadlines: Record<string, boolean>;
    setExpandedHeadlines: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    expandedModules: Record<string, boolean>;
    setExpandedModules: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    expandedChapters: Record<string, boolean>;
    setExpandedChapters: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    handleDeallocateItem: (allocationId: string) => Promise<void>;
    deletingAssignmentId: string | null;
    isUpdatingProgress: string | null;
    getLessonPacingStatus: (lessonId: string) => {
        cardBorder: string;
        textStyle: string;
        badgeStyle: string;
        isLocked: boolean;
        isUnlocked: boolean;
        statusLabel: string;
    };
    setSelectedTopic: (lesson: any) => void;
    openAllocationDrawer: (lesson: any) => void;
    livePreviewData: any;
    selectedStudentPermissions: any;
    syllabusLessons: any[];
    setIsInventoryDrawerOpen: (open: boolean) => void;
}

export default function CurriculumTab({
    curriculumTab,
    setCurriculumTab,
    activeAttendanceRoster,
    selectedStudentForCurriculum,
    setSelectedStudentForCurriculum,
    allocatedInventoryItems,
    hasAnyVisibleModule,
    curriculumSearchQuery,
    setCurriculumSearchQuery,
    handleExpandAllCurriculum,
    handleCollapseAllCurriculum,
    visibleCurriculum,
    expandedHeadlines,
    setExpandedHeadlines,
    expandedModules,
    setExpandedModules,
    expandedChapters,
    setExpandedChapters,
    handleDeallocateItem,
    deletingAssignmentId,
    isUpdatingProgress,
    getLessonPacingStatus,
    setSelectedTopic,
    openAllocationDrawer,
    livePreviewData,
    selectedStudentPermissions,
    syllabusLessons,
    setIsInventoryDrawerOpen
}: CurriculumTabProps) {
    return (
        <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
            {/* Section 1: Dashboard Header */}
            <section className="mb-8">
                <div className="relative overflow-hidden p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md shadow-amber-500/[0.01]">
                    {/* Decorative glowing gradient sphere */}
                    <div className="absolute -right-16 -bottom-16 w-72 h-72 bg-gradient-to-tr from-amber-500/10 via-amber-500/[0.02] to-transparent rounded-full blur-3xl pointer-events-none select-none"></div>
                    <div className="absolute left-1/3 top-0 w-64 h-64 bg-amber-500/[0.02] rounded-full blur-3xl pointer-events-none select-none"></div>
                    
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                        <div className="space-y-3 text-left">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] text-amber-600 dark:text-amber-400 font-extrabold tracking-widest uppercase select-none">
                                <Sparkles className="size-3 text-amber-500 animate-pulse" />
                                <span>Classroom Learning Path</span>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-none text-slate-900 dark:text-white">
                                Curriculum <span className="bg-gradient-to-r from-[#ecb613] to-amber-500 bg-clip-text text-transparent">Tutorials</span>
                            </h1>
                            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium max-w-xl leading-relaxed">
                                An interactive learning roadmap. Students access these modules, audio files, sheet music PDFs, and step-by-step video guides directly in their student portals.
                            </p>
                        </div>
                        <button 
                            onClick={() => setIsInventoryDrawerOpen(true)}
                            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-950 font-black text-xs tracking-wider uppercase transition-all shadow-md shadow-[#ecb613]/10 hover:-translate-y-0.5 active:translate-y-0 active:scale-98 self-start md:self-center shrink-0 border border-[#ecb613]/10 cursor-pointer"
                            type="button"
                        >
                            <Plus className="size-4 stroke-[3]" />
                            <span>Add from Inventory</span>
                        </button>
                    </div>

                    {/* Class-wide vs Individual Sub-tabs */}
                    <div className="flex border-b border-slate-200 dark:border-slate-800 gap-8 mt-6">
                        <button
                            onClick={() => setCurriculumTab('classwide')}
                            className={`pb-3 text-xs font-black uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
                                curriculumTab === 'classwide' 
                                    ? 'border-[#ecb613] text-[#ecb613]' 
                                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-400'
                            }`}
                        >
                            Class-wide Roster Lock
                        </button>
                        <button
                            onClick={() => {
                                setCurriculumTab('individual');
                                if (!selectedStudentForCurriculum && activeAttendanceRoster.length > 0) {
                                    setSelectedStudentForCurriculum(activeAttendanceRoster[0]);
                                }
                            }}
                            className={`pb-3 text-xs font-black uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
                                curriculumTab === 'individual' 
                                    ? 'border-[#ecb613] text-[#ecb613]' 
                                    : 'border-transparent text-slate-400 hover:text-slate-655 dark:text-slate-500 dark:hover:text-slate-400'
                            }`}
                        >
                            Individual Override Pacing
                        </button>
                    </div>
                </div>
            </section>

            {/* Section 2: Student Horizontal Scroll Bar for Individual Override Mode */}
            {curriculumTab === 'individual' && (
                <div className="flex items-center gap-3 overflow-x-auto py-4 px-4 scrollbar-hide border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl mb-8 shadow-sm">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider shrink-0">Select Student:</span>
                    {activeAttendanceRoster.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No students in this classroom.</p>
                    ) : (
                        activeAttendanceRoster.map(s => {
                            const isSelected = selectedStudentForCurriculum?.student_id === s.student_id;
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => setSelectedStudentForCurriculum(s)}
                                    className={`flex items-center gap-2.5 px-4 py-2 rounded-full transition-all shrink-0 border ${
                                        isSelected 
                                            ? 'bg-[#ecb613]/10 border-[#ecb613]/30 text-[#ecb613] shadow-sm font-bold scale-[1.02]' 
                                            : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <div className="w-6 h-6 rounded-full overflow-hidden bg-[#ecb613]/20 flex items-center justify-center shrink-0">
                                        {s.profile_pic_url ? (
                                            <img src={s.profile_pic_url} alt={s.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-[10px] text-[#ecb613] font-black">{s.name.charAt(0)}</span>
                                        )}
                                    </div>
                                    <span className="text-xs leading-none">{s.name}</span>
                                </button>
                            );
                        })
                    )}
                </div>
            )}

            {/* Two-Column Responsive Grid */}
            <div className="grid grid-cols-12 gap-8 items-start">
                <div className={`${curriculumTab === 'individual' && selectedStudentForCurriculum ? 'col-span-12 lg:col-span-8' : 'col-span-12'} space-y-6`}>
                    {allocatedInventoryItems.length === 0 ? (
                        <div className="p-16 text-center bg-slate-50/50 dark:bg-slate-900/40 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/80 rounded-3xl shadow-sm text-slate-400 flex flex-col items-center justify-center min-h-[400px]">
                            <div className="w-20 h-20 rounded-2xl bg-amber-500/10 dark:bg-amber-500/[0.05] border border-amber-500/20 flex items-center justify-center text-amber-500 mb-6 shadow-inner animate-bounce">
                                <BookOpen className="size-10 text-amber-500" />
                            </div>
                            <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">No Learning Path Set</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md leading-relaxed text-center font-semibold">
                                You haven't allocated any study materials yet. Open the Inventory Library to allocate levels, chapters, or individual lessons.
                            </p>
                        </div>
                    ) : !hasAnyVisibleModule ? (
                        <div className="p-16 text-center bg-slate-50/50 dark:bg-slate-900/40 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/80 rounded-3xl shadow-sm text-slate-400 flex flex-col items-center justify-center min-h-[400px] border-dashed">
                            <div className="w-20 h-20 rounded-2xl bg-amber-500/10 dark:bg-amber-500/[0.05] border border-amber-500/20 flex items-center justify-center text-amber-500 mb-6 shadow-inner animate-pulse">
                                <Sliders className="size-10 text-amber-500" />
                            </div>
                            <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">No Allocated Topics</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md leading-relaxed text-center font-medium">
                                This student has no active or unlocked study materials in their personalized learning path yet.
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-505 mt-2.5 max-w-sm text-center leading-normal">
                                You can switch to the <strong>Class-wide Roster Lock</strong> tab to unlock specific topics for them, or assign specialized materials individually from the Inventory Library.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Action bar (Search & Collapse) */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-slate-50/50 dark:bg-slate-900/30 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-sm mb-2 animate-in fade-in duration-300">
                                {/* Left: Search input */}
                                <div className="relative flex-1 max-w-md">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400 dark:text-slate-550" />
                                    <input
                                        type="text"
                                        placeholder="Search levels, chapters, topics..."
                                        value={curriculumSearchQuery}
                                        onChange={(e) => setCurriculumSearchQuery(e.target.value)}
                                        className="w-full pl-11 pr-10 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#ecb613] focus:ring-1 focus:ring-[#ecb613]/30 transition-all font-semibold"
                                    />
                                    {curriculumSearchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setCurriculumSearchQuery('')}
                                            className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-405 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                                        >
                                            <X className="size-3" />
                                        </button>
                                    )}
                                </div>

                                {/* Right: Expand/Collapse controls */}
                                <div className="flex items-center gap-3 self-end md:self-auto">
                                    <button
                                        type="button"
                                        onClick={handleExpandAllCurriculum}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-305 dark:hover:border-slate-700 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 rounded-2xl shadow-xs transition-all hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                                    >
                                        <ChevronDown className="size-4 text-[#ecb613]" />
                                        <span>Expand All</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCollapseAllCurriculum}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-305 dark:hover:border-slate-700 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 rounded-2xl shadow-xs transition-all hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                                    >
                                        <ChevronUp className="size-4 text-[#ecb613]" />
                                        <span>Collapse All</span>
                                    </button>
                                </div>
                            </div>

                            {visibleCurriculum.length === 0 ? (
                                /* Search empty state */
                                <div className="p-16 text-center bg-slate-50/50 dark:bg-slate-900/40 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/80 rounded-3xl shadow-sm text-slate-405 flex flex-col items-center justify-center min-h-[300px] border-dashed">
                                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-6 animate-pulse">
                                        <Search className="size-8 text-amber-500" />
                                    </div>
                                    <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">No Matching Results</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-sm leading-relaxed text-center font-medium">
                                        We couldn't find any levels, chapters, or topics matching "{curriculumSearchQuery}".
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setCurriculumSearchQuery('')}
                                        className="mt-6 px-5 py-2.5 bg-slate-100 dark:bg-slate-850 hover:bg-amber-500 hover:text-white border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
                                    >
                                        Clear Search Query
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-12">
                                    {visibleCurriculum.map((group) => {
                                        const isHeadlineExpanded = expandedHeadlines[group.categoryName] !== false;
                                        return (
                                            <div key={group.categoryName} className="space-y-6">
                                                {/* Category / Headline Header */}
                                                <div 
                                                    onClick={() => setExpandedHeadlines(prev => ({ ...prev, [group.categoryName]: !isHeadlineExpanded }))}
                                                    className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3 pl-1 cursor-pointer select-none group/headline transition-all duration-300"
                                                >
                                                    <div className="flex items-center gap-3 text-left">
                                                        <div className="w-2.5 h-6 rounded-full bg-gradient-to-b from-[#ecb613] to-amber-600 shadow-sm shadow-amber-500/25" />
                                                        <div>
                                                            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest font-mono group-hover/headline:text-[#ecb613] transition-colors duration-200">
                                                                {group.categoryName}
                                                            </h3>
                                                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono mt-0.5">
                                                                {group.modules.length} {group.modules.length === 1 ? 'Module' : 'Modules'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-505 group-hover/headline:bg-[#ecb613]/10 group-hover/headline:text-[#ecb613] group-hover/headline:scale-105 transition-all duration-300">
                                                            {isHeadlineExpanded ? (
                                                                <ChevronUp className="size-4 transition-transform duration-300" />
                                                            ) : (
                                                                <ChevronDown className="size-4 transition-transform duration-300" />
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Modules Under This Category */}
                                                {isHeadlineExpanded && (
                                                    <div className="space-y-8 pl-3 md:pl-6 border-l-2 border-slate-200 dark:border-slate-800 text-left">
                                                        {group.modules.map((mod: any) => {
                                                            const isModuleExpanded = expandedModules[mod.id] !== false;
                                                            const hasModuleAssignment = !!mod.allocationId;
                                                            return (
                                                                <div key={mod.id} className="space-y-4">
                                                                    {/* Collapsible Module/Level Header */}
                                                                    {hasModuleAssignment ? (
                                                                        <div 
                                                                            onClick={() => setExpandedModules(prev => ({ ...prev, [mod.id]: !isModuleExpanded }))}
                                                                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:shadow-amber-500/[0.02] hover:border-[#ecb613]/40 cursor-pointer select-none transition-all duration-300 text-left group/level-capsule animate-in fade-in"
                                                                        >
                                                                            <div className="flex items-center gap-4">
                                                                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#ecb613]/20 to-[#ecb613]/5 dark:from-[#ecb613]/10 dark:to-[#ecb613]/0 border border-[#ecb613]/20 flex items-center justify-center text-[#ecb613] shadow-xs shrink-0 transition-transform duration-300 group-hover/level-capsule:scale-105">
                                                                                    <BookOpen className="size-5" />
                                                                                </div>
                                                                                <div className="space-y-1 text-left">
                                                                                    <div className="flex items-center gap-2.5 flex-wrap">
                                                                                        <h3 className="font-black text-base md:text-lg text-slate-800 dark:text-white leading-tight tracking-tight">
                                                                                            {mod.title}
                                                                                        </h3>
                                                                                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-[#ecb613]/10 text-[#ecb613] border border-[#ecb613]/20">
                                                                                            Level Allocated
                                                                                        </span>
                                                                                    </div>
                                                                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider font-mono">
                                                                                        {mod.chapters.length} {mod.chapters.length === 1 ? 'Chapter' : 'Chapters'}
                                                                                    </p>
                                                                                </div>
                                                                            </div>

                                                                            <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/80 pt-3 sm:pt-0" onClick={e => e.stopPropagation()}>
                                                                                <button 
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleDeallocateItem(mod.allocationId!);
                                                                                    }}
                                                                                    disabled={deletingAssignmentId === mod.allocationId}
                                                                                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black text-rose-500 hover:text-white bg-rose-500/10 hover:bg-rose-500 transition-all duration-200 border border-transparent hover:border-rose-600/10 shadow-xs cursor-pointer text-left"
                                                                                    title="Deallocate level from class"
                                                                                    type="button"
                                                                                >
                                                                                    {deletingAssignmentId === mod.allocationId ? (
                                                                                        <Loader2 className="size-3.5 animate-spin" />
                                                                                    ) : (
                                                                                        <Trash2 className="size-3.5" />
                                                                                    )}
                                                                                    <span>Remove</span>
                                                                                </button>
                                                                                <div 
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setExpandedModules(prev => ({ ...prev, [mod.id]: !isModuleExpanded }));
                                                                                    }}
                                                                                    className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-[#ecb613]/10 hover:text-[#ecb613] hover:scale-105 transition-all duration-300 cursor-pointer border border-transparent hover:border-[#ecb613]/25"
                                                                                >
                                                                                    {isModuleExpanded ? (
                                                                                        <ChevronUp className="size-4" />
                                                                                    ) : (
                                                                                        <ChevronDown className="size-4" />
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div 
                                                                            onClick={() => setExpandedModules(prev => ({ ...prev, [mod.id]: !isModuleExpanded }))}
                                                                            className="flex items-center justify-between cursor-pointer select-none group/module bg-slate-100/50 hover:bg-slate-200/50 dark:bg-slate-850/20 dark:hover:bg-slate-800/40 p-3.5 rounded-2xl transition-all duration-300 border border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                                                                        >
                                                                            <div className="flex items-center gap-3 text-left">
                                                                                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center text-slate-505 dark:text-slate-400 group-hover/module:bg-[#ecb613]/10 group-hover/module:text-[#ecb613] transition-all duration-300">
                                                                                    <BookOpen className="size-4" />
                                                                                </div>
                                                                                <div className="text-left">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <h4 className="text-sm font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                                                                                            {mod.title}
                                                                                        </h4>
                                                                                        <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
                                                                                            Custom Pacing
                                                                                        </span>
                                                                                    </div>
                                                                                    <p className="text-[9px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider font-mono mt-0.5">
                                                                                        {mod.chapters.length} {mod.chapters.length === 1 ? 'Chapter' : 'Chapters'}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                            <div className="w-8 h-8 rounded-lg bg-slate-200/50 dark:bg-slate-800/50 flex items-center justify-center text-slate-400 group-hover/module:text-[#ecb613] transition-all duration-300">
                                                                                {isModuleExpanded ? (
                                                                                    <ChevronUp className="size-4" />
                                                                                ) : (
                                                                                    <ChevronDown className="size-4" />
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {/* Chapters Under This Module */}
                                                                    {(isModuleExpanded || hasModuleAssignment) && (
                                                                        <div className="space-y-6 pl-3 md:pl-6 border-l border-slate-200 dark:border-slate-800/60">
                                                                            {mod.chapters.map((chap: any) => {
                                                                                const isChapterExpanded = expandedChapters[chap.id] !== false;
                                                                                const hasChapterAssignment = !!chap.allocationId;
                                                                                return (
                                                                                    <div 
                                                                                        key={chap.id} 
                                                                                        className="rounded-2xl border border-slate-200 dark:border-slate-800/80 overflow-hidden bg-slate-50/[0.1] dark:bg-slate-900/10 transition-all duration-300 hover:border-slate-250 dark:hover:border-slate-700/80 shadow-xs text-left"
                                                                                    >
                                                                                        {/* Chapter Header */}
                                                                                        <div 
                                                                                            onClick={() => setExpandedChapters(prev => ({ ...prev, [chap.id]: !isChapterExpanded }))}
                                                                                            className="px-5 py-4 bg-slate-50/50 dark:bg-slate-900/20 hover:bg-slate-100/50 dark:hover:bg-slate-850/20 transition-all flex items-center justify-between cursor-pointer select-none border-b border-transparent data-[expanded=true]:border-slate-100 dark:data-[expanded=true]:border-slate-800"
                                                                                            data-expanded={isChapterExpanded}
                                                                                        >
                                                                                            <div className="flex items-center gap-4">
                                                                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ecb613]/10 to-[#ecb613]/5 border border-[#ecb613]/20 flex items-center justify-center text-[#ecb613] text-xs font-black font-mono shadow-xs">
                                                                                                    Ch{chap.chapter_number}
                                                                                                </div>
                                                                                                <div className="text-left">
                                                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                                                        <h5 className="text-sm font-black text-slate-800 dark:text-slate-100 leading-tight">
                                                                                                            {chap.title}
                                                                                                        </h5>
                                                                                                        {hasChapterAssignment && (
                                                                                                            <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-gradient-to-r from-[#ecb613]/15 to-[#ecb613]/5 text-[#ecb613] border border-[#ecb613]/20">
                                                                                                                Chapter Allocated
                                                                                                            </span>
                                                                                                        )}
                                                                                                    </div>
                                                                                                    <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold mt-1 uppercase tracking-wider font-mono">
                                                                                                        {chap.lessons.length} {chap.lessons.length === 1 ? 'Study Unit' : 'Study Units'}
                                                                                                    </p>
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                                                                                                {hasChapterAssignment && (
                                                                                                                    <button 
                                                                                                                        onClick={(e) => {
                                                                                                                            e.stopPropagation();
                                                                                                                            handleDeallocateItem(chap.allocationId!);
                                                                                                                        }}
                                                                                                                        disabled={deletingAssignmentId === chap.allocationId}
                                                                                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black text-rose-500 hover:text-white bg-rose-505/10 hover:bg-rose-500 transition-all duration-200 border border-transparent hover:border-rose-600/10 shadow-xs cursor-pointer text-left"
                                                                                                                        title="Deallocate chapter from class"
                                                                                                                        type="button"
                                                                                                                    >
                                                                                                                        {deletingAssignmentId === chap.allocationId ? (
                                                                                                                            <Loader2 className="size-3 animate-spin" />
                                                                                                                        ) : (
                                                                                                                            <Trash2 className="size-3" />
                                                                                                                        )}
                                                                                                                        <span>Remove</span>
                                                                                                                    </button>
                                                                                                                )}
                                                                                                <div 
                                                                                                    onClick={(e) => {
                                                                                                        e.stopPropagation();
                                                                                                        setExpandedChapters(prev => ({ ...prev, [chap.id]: !isChapterExpanded }));
                                                                                                    }}
                                                                                                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-850 flex items-center justify-center text-slate-450 hover:text-[#ecb613] hover:bg-[#ecb613]/10 transition-all duration-300 cursor-pointer"
                                                                                                >
                                                                                                    {isChapterExpanded ? (
                                                                                                        <ChevronUp className="size-4" />
                                                                                                    ) : (
                                                                                                        <ChevronDown className="size-4" />
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>

                                                                                        {/* Chapter Lessons */}
                                                                                        {isChapterExpanded && (
                                                                                            <div className="p-5 bg-white dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800/80 space-y-4">
                                                                                                {chap.lessons.length === 0 ? (
                                                                                                    <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl">
                                                                                                        No lesson materials uploaded for this chapter.
                                                                                                    </p>
                                                                                                ) : (
                                                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative pl-3 border-l border-slate-200/60 dark:border-slate-800">
                                                                                                        {chap.lessons.map((lesson: any) => {
                                                                                                            const isUpdating = isUpdatingProgress === lesson.id;
                                                                                                            const pacing = getLessonPacingStatus(lesson.id);

                                                                                                            const isAudio = lesson.material_type === 'audio';
                                                                                                            const isVideo = lesson.material_type === 'video';
                                                                                                            const isPdf = lesson.material_type === 'pdf';

                                                                                                            return (
                                                                                                                <div 
                                                                                                                    key={lesson.id} 
                                                                                                                    onClick={() => setSelectedTopic(lesson)}
                                                                                                                    className={`group rounded-2xl p-4 border flex items-center justify-between gap-4 cursor-pointer hover:border-[#ecb613]/40 hover:bg-slate-100/40 dark:hover:bg-slate-800/40 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 hover:shadow-md text-left ${pacing.cardBorder}`}
                                                                                                                >
                                                                                                                    {/* Left side: Material Type Icon */}
                                                                                                                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                                                                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs border transition-colors ${
                                                                                                                            isPdf 
                                                                                                                                ? 'text-blue-500 bg-blue-500/10 dark:bg-blue-500/[0.05] border-blue-500/20'
                                                                                                                                : isVideo 
                                                                                                                                ? 'text-rose-505 bg-rose-500/10 dark:bg-rose-500/[0.05] border-rose-500/20' 
                                                                                                                                : isAudio 
                                                                                                                                ? 'text-amber-505 bg-amber-500/10 border-amber-500/20' 
                                                                                                                                : 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                                                                                                                        }`}>
                                                                                                                            {isVideo ? (
                                                                                                                                <Film className="size-4.5" />
                                                                                                                            ) : isAudio ? (
                                                                                                                                <Music className="size-4.5" />
                                                                                                                            ) : (
                                                                                                                                <FileText className="size-4.5" />
                                                                                                                            )}
                                                                                                                        </div>

                                                                                                                        {/* Middle: Details */}
                                                                                                                        <div className="text-left min-w-0 flex-1">
                                                                                                                            <div className="flex items-center gap-2">
                                                                                                                                <span className={`text-[9px] font-black uppercase tracking-wider font-mono ${pacing.textStyle}`}>
                                                                                                                                    Topic {lesson.lesson_number}
                                                                                                                                </span>
                                                                                                                                {isUpdating && <Loader2 className="w-3 h-3 animate-spin text-[#ecb613]" />}
                                                                                                                                {lesson.isExplicit && (
                                                                                                                                    <span className="px-1.5 py-0.25 rounded text-[8px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                                                                                                        Topic Allocated
                                                                                                                                    </span>
                                                                                                                                )}
                                                                                                                            </div>
                                                                                                                            <h5 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 leading-snug truncate mt-0.5">{lesson.title}</h5>
                                                                                                                            {lesson.description && (
                                                                                                                                <p className="text-[10px] text-slate-500 dark:text-slate-450 line-clamp-1 leading-relaxed font-semibold mt-0.5">{lesson.description}</p>
                                                                                                                            )}
                                                                                                                        </div>
                                                                                                                    </div>

                                                                                                                    {/* Right side: Status indicator & actions */}
                                                                                                                    <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                                                                                                                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 border ${pacing.badgeStyle}`}>
                                                                                                                            {pacing.isLocked ? (
                                                                                                                                <Lock className="size-3" />
                                                                                                                            ) : pacing.isUnlocked ? (
                                                                                                                                <Unlock className="size-3" />
                                                                                                                            ) : (
                                                                                                                                <CheckCircle className="size-3" />
                                                                                                                            )}
                                                                                                                            <span>{pacing.statusLabel}</span>
                                                                                                                        </div>
                                                                                                                        <button
                                                                                                                            type="button"
                                                                                                                            title="Manage pacing overrides"
                                                                                                                            onClick={() => {
                                                                                                                                if (isUpdating) return;
                                                                                                                                openAllocationDrawer(lesson);
                                                                                                                            }}
                                                                                                                            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-850 hover:bg-[#ecb613]/10 hover:text-[#ecb613] hover:border-[#ecb613]/30 flex items-center justify-center text-slate-400 dark:text-slate-400 border border-transparent transition-all cursor-pointer"
                                                                                                                        >
                                                                                                                            <Sliders className="size-3.5" />
                                                                                                                        </button>
                                                                                                                        {lesson.isExplicit && (
                                                                                                                            <button
                                                                                                                                type="button"
                                                                                                                                onClick={() => handleDeallocateItem(lesson.allocationId)}
                                                                                                                                disabled={deletingAssignmentId === lesson.allocationId}
                                                                                                                                className="w-8 h-8 rounded-xl bg-rose-505/10 hover:bg-rose-500 text-rose-500 hover:text-white flex items-center justify-center border border-transparent transition-all cursor-pointer"
                                                                                                                                title="Deallocate topic from class"
                                                                                                                            >
                                                                                                                                {deletingAssignmentId === lesson.allocationId ? (
                                                                                                                                    <Loader2 className="size-3.5 animate-spin" />
                                                                                                                                ) : (
                                                                                                                                    <Trash2 className="size-3.5" />
                                                                                                                                )}
                                                                                                                            </button>
                                                                                                                        )}
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                            );
                                                                                                        })}
                                                                                                    </div>
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
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Column Sticky Live Portal Simulation Card */}
                {curriculumTab === 'individual' && selectedStudentForCurriculum && (
                    <div className="col-span-12 lg:col-span-4 lg:sticky lg:top-20 space-y-6">
                        {livePreviewData ? (
                            <div className="bg-stone-50 border border-stone-200/80 rounded-[32px] p-6 text-stone-850 shadow-2xl ring-8 ring-stone-100/50 flex flex-col gap-6 relative overflow-hidden text-left animate-in fade-in">
                                {/* Decorative subtle gradient background mesh */}
                                <div className="absolute -right-24 -top-24 w-48 h-48 bg-gradient-to-tr from-[#ecb613]/10 via-emerald-500/5 to-rose-500/5 rounded-full blur-2xl pointer-events-none"></div>

                                {/* Title / Status */}
                                <div className="flex items-center justify-between border-b border-stone-200/80 pb-4 relative z-10">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
                                        <span className="text-[10px] font-black tracking-widest uppercase text-stone-500 font-mono">STUDENT VIEW PREVIEW (LIVE)</span>
                                    </div>
                                    <span className="bg-[#ecb613]/15 text-amber-800 border border-[#ecb613]/20 text-[8px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider font-mono">
                                        Mobile Portal
                                    </span>
                                </div>

                                {/* Student Profile Info */}
                                <div className="flex items-center gap-4 relative z-10">
                                    <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center overflow-hidden ring-2 ring-stone-200 shadow-sm shrink-0">
                                        {selectedStudentForCurriculum.profile_pic_url ? (
                                            <img src={selectedStudentForCurriculum.profile_pic_url} alt={selectedStudentForCurriculum.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-[#ecb613] text-xl font-bold">{selectedStudentForCurriculum.name.charAt(0)}</span>
                                        )}
                                    </div>
                                    <div className="min-w-0 text-left">
                                        <h4 className="font-extrabold text-sm text-stone-900 leading-snug truncate">{selectedStudentForCurriculum.name}</h4>
                                        <p className="text-[10px] text-stone-500 font-semibold leading-none mt-1 truncate">Syllabus Completion</p>
                                    </div>
                                </div>

                                {/* Overall Syllabus Progress Bar */}
                                <div className="space-y-2 relative z-10">
                                    <div className="flex items-center justify-between text-xs font-bold">
                                        <span className="text-stone-500 font-mono">{livePreviewData.progressPercentage}% Completed</span>
                                        <span className="text-amber-705 font-mono">{syllabusLessons.filter(l => selectedStudentPermissions.completedLessons.has(l.id)).length} / {syllabusLessons.length} units</span>
                                    </div>
                                    <div className="w-full h-2.5 bg-stone-200 rounded-full overflow-hidden shadow-inner">
                                        <div 
                                            className="h-full bg-gradient-to-r from-emerald-500 to-[#ecb613] transition-all duration-500 rounded-full"
                                            style={{ width: `${livePreviewData.progressPercentage}%` }}
                                        ></div>
                                    </div>
                                </div>

                                {/* Currently Learning Section (Green/White Accent) */}
                                <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-5 space-y-4 relative z-10 shadow-sm transition-all hover:bg-emerald-50/80 text-left">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-black uppercase text-emerald-800 tracking-wider font-mono">Currently Learning</span>
                                        <span className="bg-emerald-100 text-emerald-805 border border-emerald-205 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                                            Unlocked
                                        </span>
                                    </div>
                                    {livePreviewData.currentlyLearning ? (
                                        <div className="space-y-3">
                                            <h5 className="font-extrabold text-sm text-emerald-950 leading-snug">{livePreviewData.currentlyLearning.title}</h5>
                                            {livePreviewData.currentlyLearning.description && (
                                                <p className="text-[11px] text-emerald-900/80 font-medium leading-relaxed line-clamp-3">{livePreviewData.currentlyLearning.description}</p>
                                            )}
                                            
                                            {/* Media content indicator */}
                                            <div className="flex items-center gap-2 pt-2.5 border-t border-emerald-100">
                                                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-xs">
                                                    {livePreviewData.currentlyLearning.material_type === 'video' ? (
                                                        <Film className="size-3.5" />
                                                    ) : livePreviewData.currentlyLearning.material_type === 'audio' ? (
                                                        <Music className="size-3.5" />
                                                    ) : (
                                                        <FileText className="size-3.5" />
                                                    )}
                                                </div>
                                                <div className="text-left">
                                                    <span className="text-[9px] font-black uppercase text-emerald-705/85 tracking-wider font-mono leading-none block font-semibold">STUDY MATERIAL</span>
                                                    <span className="text-[10px] text-emerald-900 font-extrabold capitalize mt-0.5 leading-none block">
                                                        {livePreviewData.currentlyLearning.material_type || 'Reading Guide'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-emerald-700 italic text-center py-2">No active learning topic.</p>
                                    )}
                                </div>

                                {/* Allocated Curriculum Pathway */}
                                <div className="space-y-3 relative z-10 text-left">
                                    <span className="text-[9px] font-black uppercase text-stone-500 tracking-wider font-mono block">YOUR LEARNING PATHWAY</span>
                                    {!livePreviewData.allocatedTopics || livePreviewData.allocatedTopics.length === 0 ? (
                                        <div className="p-4 bg-stone-100 border border-stone-200/60 rounded-2xl text-center text-xs text-stone-400 font-medium italic">
                                            No topics allocated yet.
                                        </div>
                                    ) : (
                                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                                            {livePreviewData.allocatedTopics.map((lesson: any, idx: number) => {
                                                const isCompleted = selectedStudentPermissions.completedLessons.has(lesson.id);
                                                return (
                                                    <div key={lesson.id} className={`flex items-center gap-3 p-3 border rounded-xl shadow-xs transition-all ${
                                                        isCompleted 
                                                            ? "bg-emerald-50/30 border-emerald-100 hover:bg-emerald-50/50" 
                                                            : "bg-white border-stone-200 hover:border-amber-400"
                                                    }`}>
                                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                                            isCompleted 
                                                                ? "bg-emerald-100 text-emerald-700" 
                                                                : "bg-amber-105 text-amber-700"
                                                        }`}>
                                                            {isCompleted ? (
                                                                <Check className="size-4" />
                                                            ) : lesson.material_type === 'video' ? (
                                                                <Film className="size-3.5" />
                                                            ) : lesson.material_type === 'audio' ? (
                                                                <Music className="size-3.5" />
                                                            ) : (
                                                                <FileText className="size-3.5" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 flex-1 text-left">
                                                            <span className={`text-[8px] font-black tracking-wider font-mono block ${
                                                                isCompleted ? "text-emerald-700" : "text-amber-700"
                                                            }`}>
                                                                {isCompleted ? "COMPLETED • DONE" : `UNLOCKED • TOPIC ${idx + 1}`}
                                                            </span>
                                                            <h6 className="text-[11px] font-bold text-stone-900 leading-tight truncate mt-0.5">{lesson.title}</h6>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white border border-stone-200 rounded-[32px] p-8 text-center text-stone-400 text-xs shadow-sm flex flex-col items-center justify-center min-h-[250px] border-dashed">
                                <UserPlus className="size-8 text-stone-300 mb-3 animate-pulse" />
                                <span>Select a student to initialize live student view simulation.</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
