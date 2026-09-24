'use client';

import React from 'react';
import Link from 'next/link';
import { 
    HelpCircle, GraduationCap, Music, MessageSquare, 
    Clock, BookOpen, PlayCircle, Sparkles, Lock, Layers 
} from 'lucide-react';
import { CommunityCategory } from '../../lib/community';

interface CategoryPillsProps {
    categories: CommunityCategory[];
    selectedSlug?: string;
    onSelect?: (slug: string) => void;
}

const ICON_MAP: Record<string, any> = {
    HelpCircle,
    GraduationCap,
    Music,
    MessageSquare,
    Clock,
    BookOpen,
    PlayCircle,
    Sparkles
};

export default function CategoryPills({ categories, selectedSlug, onSelect }: CategoryPillsProps) {
    const isAll = !selectedSlug || selectedSlug === 'all';

    return (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
            <button
                onClick={() => onSelect && onSelect('all')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all snap-start ${
                    isAll
                        ? 'bg-[#a15912] text-white shadow-xs'
                        : 'bg-white dark:bg-[#1a140e] text-slate-700 dark:text-slate-300 border border-amber-900/10 dark:border-amber-500/15 hover:border-amber-600/30 hover:bg-amber-50/50'
                }`}
            >
                <Layers className="w-3.5 h-3.5" />
                <span>All Discussions</span>
            </button>

            {categories.map((cat) => {
                const isSelected = selectedSlug === cat.slug;
                const IconComponent = cat.icon_name && ICON_MAP[cat.icon_name] ? ICON_MAP[cat.icon_name] : MessageSquare;
                const isStudent = cat.access_scope === 'students';

                return (
                    <button
                        key={cat.id}
                        onClick={() => onSelect && onSelect(cat.slug)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all snap-start ${
                            isSelected
                                ? 'bg-[#a15912] text-white shadow-xs'
                                : 'bg-white dark:bg-[#1a140e] text-slate-700 dark:text-slate-300 border border-amber-900/10 dark:border-amber-500/15 hover:border-amber-600/30 hover:bg-amber-50/50'
                        }`}
                    >
                        <IconComponent className="w-3.5 h-3.5" />
                        <span>{cat.name}</span>
                        {isStudent && (
                            <span className={`text-[10px] px-1 py-0.2 rounded ${
                                isSelected ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                            }`} title="KFA Students Only">
                                <Lock className="w-2.5 h-2.5 inline" />
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
