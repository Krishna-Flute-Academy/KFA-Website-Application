'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, BookOpen, ChevronDown, ChevronUp, FileText, Video, Music, Image as ImageIcon } from 'lucide-react';
import { getCurriculumMediaInfo } from '../../../lib/curriculum-media';

interface InventoryPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    categories: any[];
    modules: any[];
    chapters: any[];
    lessons: any[];
    onSelectLesson: (lesson: { id: string; title: string }) => void;
}

export default function InventoryPickerModal({
    isOpen,
    onClose,
    categories,
    modules,
    chapters,
    lessons,
    onSelectLesson
}: InventoryPickerModalProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
    const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
    const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});

    const getCategoryForModule = (mod: any, cats: any[]) => {
        if (mod.category_id) {
            const cat = cats.find(c => c.id === mod.category_id);
            if (cat) return { id: cat.id, name: cat.name };
        }
        const desc = mod.description || '';
        const match = desc.match(/^\[(.*?)\]/);
        if (match) {
            const catName = match[1].trim();
            const cat = cats.find(c => c.name.toLowerCase() === catName.toLowerCase());
            if (cat) return { id: cat.id, name: cat.name };
            return { id: catName, name: catName };
        }
        const defaultCatName = mod.module_number < 100 ? 'Proficiency Levels' : 'Specialized Modules';
        const cat = cats.find(c => c.name.toLowerCase() === defaultCatName.toLowerCase());
        if (cat) return { id: cat.id, name: cat.name };
        return { id: 'default', name: defaultCatName };
    };

    const getLessonMaterialIcon = (type: string, hasUrl: boolean) => {
        if (!hasUrl) return <FileText className="w-3.5 h-3.5 text-slate-400" />;
        switch (type?.toLowerCase()) {
            case 'pdf': return <FileText className="w-3.5 h-3.5 text-red-500" />;
            case 'video': return <Video className="w-3.5 h-3.5 text-amber-500" />;
            case 'audio': return <Music className="w-3.5 h-3.5 text-blue-500" />;
            case 'image': return <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />;
            default: return <FileText className="w-3.5 h-3.5 text-slate-500" />;
        }
    };

    const filteredCurriculumTree = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        const categoriesMap: Record<string, { id: string; name: string; modules: any[] }> = {};

        categories.forEach(cat => {
            categoriesMap[cat.id] = { id: cat.id, name: cat.name, modules: [] };
        });

        const modulesMap: Record<string, { id: string; title: string; module_number: number; chapters: any[] }> = {};
        modules.forEach(mod => {
            const catInfo = getCategoryForModule(mod, categories);
            if (!categoriesMap[catInfo.id]) {
                categoriesMap[catInfo.id] = { id: catInfo.id, name: catInfo.name, modules: [] };
            }

            const modNode = { id: mod.id, title: mod.title, module_number: mod.module_number, chapters: [] };
            modulesMap[mod.id] = modNode;
            categoriesMap[catInfo.id].modules.push(modNode);
        });

        const chaptersMap: Record<string, { id: string; title: string; chapter_number: number; lessons: any[] }> = {};
        chapters.forEach(chap => {
            const chapNode = { id: chap.id, title: chap.title, chapter_number: chap.chapter_number, lessons: [] };
            chaptersMap[chap.id] = chapNode;

            const modNode = modulesMap[chap.module_id];
            if (modNode) {
                modNode.chapters.push(chapNode);
            }
        });

        lessons.forEach(lesson => {
            const chapNode = chaptersMap[lesson.chapter_id];
            if (chapNode) {
                chapNode.lessons.push(lesson);
            }
        });

        const result: any[] = [];

        Object.values(categoriesMap).forEach(cat => {
            const catMatches = cat.name.toLowerCase().includes(query);
            const filteredModules: any[] = [];

            cat.modules.forEach(mod => {
                const modMatches = mod.title.toLowerCase().includes(query);
                const filteredChapters: any[] = [];

                mod.chapters.forEach(chap => {
                    const chapMatches = chap.title.toLowerCase().includes(query);
                    const filteredLessons: any[] = [];

                    chap.lessons.forEach(lesson => {
                        const lessonTitleMatches = lesson.title.toLowerCase().includes(query);
                        const fileNameMatches = (lesson.file_name || '').toLowerCase().includes(query);
                        if (lessonTitleMatches || fileNameMatches || chapMatches || modMatches || catMatches) {
                            filteredLessons.push(lesson);
                        }
                    });

                    if (filteredLessons.length > 0 || chapMatches) {
                        filteredChapters.push({
                            ...chap,
                            lessons: filteredLessons
                        });
                    }
                });

                if (filteredChapters.length > 0 || modMatches) {
                    filteredModules.push({
                        ...mod,
                        chapters: filteredChapters
                    });
                }
            });

            if (filteredModules.length > 0 || catMatches) {
                result.push({
                    ...cat,
                    modules: filteredModules
                });
            }
        });

        return result;
    }, [categories, modules, chapters, lessons, searchQuery]);

    useEffect(() => {
        if (searchQuery.trim() !== '') {
            const newExpandedCats: Record<string, boolean> = {};
            const newExpandedMods: Record<string, boolean> = {};
            const newExpandedChaps: Record<string, boolean> = {};

            filteredCurriculumTree.forEach(cat => {
                newExpandedCats[cat.id] = true;
                cat.modules.forEach((mod: any) => {
                    newExpandedMods[mod.id] = true;
                    mod.chapters.forEach((chap: any) => {
                        newExpandedChaps[chap.id] = true;
                    });
                });
            });

            setExpandedCategories(newExpandedCats);
            setExpandedModules(newExpandedMods);
            setExpandedChapters(newExpandedChaps);
        }
    }, [searchQuery, filteredCurriculumTree]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 text-left">
                {/* Header */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 rounded-t-3xl shrink-0">
                    <div>
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Select from Inventory Library</h3>
                        <p className="text-xs text-slate-500 font-semibold mt-0.5">Choose a learning material file or lesson topic to attach</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                        type="button"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900 shrink-0">
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input 
                            type="text"
                            placeholder="Search headlines, modules, chapters, topics..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-[#ecb613] focus:border-[#ecb613] outline-none transition-all placeholder:text-slate-400 text-slate-900 dark:text-white"
                        />
                        {searchQuery && (
                            <button 
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                type="button"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Collapsible Tree Body */}
                <div className="p-5 overflow-y-auto flex-1 space-y-3 bg-[#f8f8f6]/30 dark:bg-[#221d10]/30">
                    {filteredCurriculumTree.length > 0 ? (
                        filteredCurriculumTree.map(cat => {
                            const isCatExpanded = expandedCategories[cat.id] ?? false;
                            return (
                                <div key={cat.id} className="space-y-1.5 border border-slate-200 dark:border-slate-800/85 rounded-2xl p-3 bg-white dark:bg-slate-900/60 shadow-sm">
                                    {/* Category Headline */}
                                    <div 
                                        onClick={() => setExpandedCategories(prev => ({ ...prev, [cat.id]: !isCatExpanded }))}
                                        className="flex items-center justify-between cursor-pointer select-none group/cat pb-1.5 border-b border-dashed border-slate-200/60 dark:border-slate-800/60"
                                    >
                                        <div className="flex items-center gap-2">
                                            <BookOpen className="w-4 h-4 text-[#ecb613]" />
                                            <span className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider font-mono">
                                                {cat.name}
                                            </span>
                                        </div>
                                        <div className="text-slate-400 group-hover/cat:text-[#ecb613] transition-colors">
                                            {isCatExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </div>
                                    </div>

                                    {/* Modules */}
                                    {isCatExpanded && (
                                        <div className="space-y-2 pl-1.5 pt-1.5">
                                            {cat.modules.map((mod: any) => {
                                                const isModExpanded = expandedModules[mod.id] ?? false;
                                                return (
                                                    <div key={mod.id} className="space-y-1 bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/40 rounded-xl p-2.5">
                                                        <div 
                                                            onClick={() => setExpandedModules(prev => ({ ...prev, [mod.id]: !isModExpanded }))}
                                                            className="flex items-center justify-between cursor-pointer select-none group/mod"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-md bg-[#ecb613]/10 flex items-center justify-center text-[#ecb613] text-xs font-bold font-mono">
                                                                    M{mod.module_number}
                                                                </div>
                                                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover/mod:text-[#ecb613] transition-colors">
                                                                    {mod.title}
                                                                </span>
                                                            </div>
                                                            <div className="text-slate-400 group-hover/mod:text-[#ecb613] transition-colors">
                                                                {isModExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                            </div>
                                                        </div>

                                                        {isModExpanded && (
                                                            <div className="space-y-1.5 pl-3 pt-2">
                                                                {mod.chapters.map((chap: any) => {
                                                                    const isChapExpanded = expandedChapters[chap.id] ?? false;
                                                                    return (
                                                                        <div key={chap.id} className="space-y-1 border-l-2 border-slate-200 dark:border-slate-700 pl-3">
                                                                            <div 
                                                                                onClick={() => setExpandedChapters(prev => ({ ...prev, [chap.id]: !isChapExpanded }))}
                                                                                className="flex items-center justify-between cursor-pointer select-none group/chap"
                                                                            >
                                                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover/chap:text-[#ecb613] transition-colors">
                                                                                    Chapter {chap.chapter_number}: {chap.title}
                                                                                </span>
                                                                                <div className="text-slate-400 group-hover/chap:text-[#ecb613] transition-colors">
                                                                                    {isChapExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                                                </div>
                                                                            </div>

                                                                            {isChapExpanded && (
                                                                                <div className="space-y-1 pt-1.5 pl-1">
                                                                                    {chap.lessons.map((lesson: any) => {
                                                                                        const mediaInfo = getCurriculumMediaInfo(lesson);
                                                                                        return (
                                                                                            <button
                                                                                                key={lesson.id}
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    onSelectLesson({
                                                                                                        id: lesson.id,
                                                                                                        title: lesson.title
                                                                                                    });
                                                                                                    onClose();
                                                                                                }}
                                                                                                className="w-full text-left p-2 hover:bg-[#ecb613]/10 dark:hover:bg-[#ecb613]/20 rounded-lg border border-transparent hover:border-[#ecb613]/30 transition-all flex items-center gap-2.5 group/lesson"
                                                                                            >
                                                                                                <div className="w-7 h-7 rounded-md bg-[#f8f8f6] dark:bg-slate-900 flex items-center justify-center text-[#ecb613] shrink-0 border border-slate-100 dark:border-slate-800">
                                                                                                    {getLessonMaterialIcon(mediaInfo.mediaType || lesson.material_type, mediaInfo.hasMedia)}
                                                                                                </div>
                                                                                                <div className="min-w-0 flex-1">
                                                                                                    <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate group-hover/lesson:text-[#ecb613] transition-colors">
                                                                                                        {lesson.title}
                                                                                                    </h5>
                                                                                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate">
                                                                                                        {lesson.material_url 
                                                                                                            ? `File: ${lesson.file_name || 'Material'}${mediaInfo.badgeLabel ? ` • ${mediaInfo.badgeLabel}` : (lesson.file_size ? ` • ${lesson.file_size}` : '')}` 
                                                                                                            : lesson.link_url 
                                                                                                                ? (mediaInfo.isVideo ? 'Video Link' : `Link: ${lesson.link_url}`) 
                                                                                                                : 'Curriculum Topic'}
                                                                                                    </p>
                                                                                                </div>
                                                                                            </button>
                                                                                        );
                                                                                    })}
                                                                                    {chap.lessons.length === 0 && (
                                                                                        <p className="text-[10px] text-slate-400 italic pl-2">No topics in this chapter.</p>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                                {mod.chapters.length === 0 && (
                                                                    <p className="text-[10px] text-slate-400 italic pl-3">No chapters in this module.</p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {cat.modules.length === 0 && (
                                                <p className="text-[10px] text-slate-400 italic pl-1.5">No modules in this category.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-sm text-slate-500 italic">No matching curriculum items found.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
