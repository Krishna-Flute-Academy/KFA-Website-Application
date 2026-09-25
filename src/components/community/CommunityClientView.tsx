'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
    Search, PlusCircle, HelpCircle, Filter, 
    Sparkles, ArrowRight, MessageSquare, BookOpen, 
    Flame, CheckCircle, Clock, Lock, RefreshCw, X 
} from 'lucide-react';
import CommunityNavbar from './CommunityNavbar';
import DiscussionCard from './DiscussionCard';
import CategoryPills from './CategoryPills';
import AcademyConversionBanner from './AcademyConversionBanner';
import CommunityUpcomingEventsShowcase from './CommunityUpcomingEventsShowcase';
import { 
    CommunityCategory, CommunityPost, 
    getCommunityCategories, getCommunityPosts 
} from '../../lib/community';
import { supabaseAuth } from '../../lib/supabase-auth';

interface CommunityClientViewProps {
    initialCategorySlug?: string;
}

export default function CommunityClientView({ initialCategorySlug }: CommunityClientViewProps) {
    const [categories, setCategories] = useState<CommunityCategory[]>([]);
    const [posts, setPosts] = useState<CommunityPost[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>(initialCategorySlug || 'all');
    const [currentTab, setCurrentTab] = useState<'recent' | 'popular' | 'unanswered' | 'solved'>('recent');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Initial auth & category load
    useEffect(() => {
        let isMounted = true;
        const init = async () => {
            try {
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (isMounted) setCurrentUserId(session?.user?.id || null);

                const cats = await getCommunityCategories();
                if (isMounted) setCategories(cats);
            } catch (e) {
                console.error('[Community] Init error:', e);
            }
        };
        init();
        return () => { isMounted = false; };
    }, []);

    // Fetch discussions when category, tab, or search changes
    const fetchDiscussions = useCallback(async (resetPage = true) => {
        const targetPage = resetPage ? 1 : page + 1;
        if (resetPage) {
            setLoading(true);
            setPage(1);
        } else {
            setLoadingMore(true);
        }

        try {
            const res = await getCommunityPosts({
                categorySlug: selectedCategory === 'all' ? undefined : selectedCategory,
                tab: currentTab,
                searchQuery: searchQuery.trim(),
                page: targetPage,
                pageSize: 15
            }, currentUserId);

            if (resetPage) {
                setPosts(res.posts);
            } else {
                setPosts(prev => [...prev, ...res.posts]);
                setPage(targetPage);
            }
            setTotalCount(res.totalCount);
            setHasMore(res.hasMore);
        } catch (e) {
            console.error('[Community] Fetch posts error:', e);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [selectedCategory, currentTab, searchQuery, page, currentUserId]);

    // Trigger fetch on filter change
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchDiscussions(true);
        }, 200);
        return () => clearTimeout(timer);
    }, [selectedCategory, currentTab, searchQuery, currentUserId]);

    const activeCatObj = categories.find(c => c.slug === selectedCategory);

    return (
        <div className="min-h-screen bg-[#faf8f5] dark:bg-[#120d09] text-slate-900 dark:text-slate-100 flex flex-col font-sans">
            <CommunityNavbar />

            {/* Hero Header */}
            <section className="bg-gradient-to-b from-amber-100/40 via-amber-50/20 to-transparent dark:from-amber-950/20 dark:via-transparent border-b border-amber-900/10 dark:border-amber-500/10 pt-10 pb-8 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center max-w-3xl mx-auto space-y-3">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-200/60 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shadow-2xs">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                            KFA Community Forum
                        </div>

                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-amber-950 dark:text-amber-100 tracking-tight leading-tight">
                            KFA Community
                        </h1>

                        <p className="text-sm sm:text-base md:text-lg font-bold text-amber-800 dark:text-amber-300">
                            Learn • Discuss • Practice • Grow
                        </p>

                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
                            A space for flute learners and music lovers to ask questions, share knowledge, discuss Indian classical music, and grow together.
                        </p>
                    </div>

                    {/* Integrated Search Bar */}
                    <div className="max-w-2xl mx-auto mt-6">
                        <div className="relative flex items-center bg-white dark:bg-[#1a140e] rounded-2xl shadow-sm border border-amber-900/15 dark:border-amber-500/20 focus-within:border-amber-600 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all">
                            <Search className="w-5 h-5 text-amber-700/60 dark:text-amber-400/60 ml-4 pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search flute discussions, raags, fingering, posture, riyaz..."
                                className="w-full px-3.5 py-3 text-sm bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="p-1.5 mr-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    aria-label="Clear search"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Main Content Area */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
                {/* Category Pills Navigation */}
                <div className="mb-6">
                    <CategoryPills
                        categories={categories}
                        selectedSlug={selectedCategory}
                        onSelect={(slug) => setSelectedCategory(slug)}
                    />
                </div>

                <CommunityUpcomingEventsShowcase currentUserId={currentUserId} />

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Discussions List Column (3 Cols) */}
                    <div className="lg:col-span-3 space-y-6">
                        {/* Filter Tabs & Count Header */}
                        <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-[#1a140e] p-3 sm:p-4 rounded-2xl border border-amber-900/10 dark:border-amber-500/10 shadow-xs">
                            {/* Tabs */}
                            <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                                {[
                                    { id: 'recent', label: 'Recent', icon: Clock },
                                    { id: 'popular', label: 'Popular', icon: Flame },
                                    { id: 'unanswered', label: 'Unanswered', icon: HelpCircle },
                                    { id: 'solved', label: 'Solved', icon: CheckCircle }
                                ].map((tab) => {
                                    const Icon = tab.icon;
                                    const active = currentTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setCurrentTab(tab.id as any)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                                active
                                                    ? 'bg-amber-100 text-amber-950 dark:bg-amber-950/80 dark:text-amber-200 shadow-2xs'
                                                    : 'text-slate-600 dark:text-slate-400 hover:text-amber-800 hover:bg-amber-50/60 dark:hover:bg-slate-800'
                                            }`}
                                        >
                                            <Icon className={`w-3.5 h-3.5 ${active ? 'text-amber-700' : 'text-slate-400'}`} />
                                            <span>{tab.label}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Total Results Count */}
                            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                {totalCount} {totalCount === 1 ? 'discussion' : 'discussions'}
                            </div>
                        </div>

                        {/* Selected Category Description Banner (if active) */}
                        {activeCatObj && (
                            <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-900/10 dark:border-amber-500/10 rounded-2xl p-4 flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-sm font-extrabold text-amber-950 dark:text-amber-200">
                                            {activeCatObj.name}
                                        </h2>
                                        {activeCatObj.access_scope === 'students' && (
                                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                                                <Lock className="w-2.5 h-2.5" /> KFA Students Only
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                        {activeCatObj.description}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedCategory('all')}
                                    className="text-xs font-bold text-amber-800 dark:text-amber-400 hover:underline shrink-0"
                                >
                                    View all
                                </button>
                            </div>
                        )}

                        {/* Discussions Feed */}
                        {loading ? (
                            <div className="space-y-4">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="bg-white dark:bg-[#1a140e] p-5 rounded-2xl border border-amber-900/10 animate-pulse space-y-3">
                                        <div className="h-4 bg-amber-100/70 dark:bg-slate-800 rounded-md w-1/4" />
                                        <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded-md w-3/4" />
                                        <div className="h-4 bg-slate-100 dark:bg-slate-850 rounded-md w-full" />
                                        <div className="h-4 bg-slate-100 dark:bg-slate-850 rounded-md w-1/3" />
                                    </div>
                                ))}
                            </div>
                        ) : posts.length === 0 ? (
                            <div className="bg-white dark:bg-[#1a140e] rounded-3xl p-10 text-center border border-dashed border-amber-900/20 dark:border-amber-500/20 space-y-4">
                                <div className="w-14 h-14 bg-amber-100 dark:bg-amber-950/60 rounded-2xl flex items-center justify-center mx-auto text-amber-700">
                                    <MessageSquare className="w-7 h-7" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                    No discussions found
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                                    {searchQuery 
                                        ? `No results matching "${searchQuery}". Try different keywords or browse categories.`
                                        : 'Be the first to ask a flute question or share knowledge in this topic!'}
                                </p>
                                <div className="pt-2">
                                    <Link
                                        href="/community/new"
                                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#a15912] hover:bg-[#8a4b0f] text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all"
                                    >
                                        <PlusCircle className="w-4 h-4" />
                                        <span>Start a Discussion</span>
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {posts.map((post) => (
                                    <DiscussionCard
                                        key={post.id}
                                        post={post}
                                        currentUserId={currentUserId}
                                    />
                                ))}

                                {/* Load More Pagination */}
                                {hasMore && (
                                    <div className="text-center pt-4">
                                        <button
                                            onClick={() => fetchDiscussions(false)}
                                            disabled={loadingMore}
                                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-white dark:bg-[#1a140e] border border-amber-900/20 dark:border-amber-500/20 hover:border-amber-600 text-xs sm:text-sm font-bold rounded-xl text-slate-800 dark:text-slate-200 shadow-xs hover:shadow-sm transition-all disabled:opacity-50"
                                        >
                                            {loadingMore ? (
                                                <>
                                                    <RefreshCw className="w-4 h-4 animate-spin text-amber-700" />
                                                    <span>Loading discussions...</span>
                                                </>
                                            ) : (
                                                <span>Load More Discussions</span>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Educational Academy Conversion Banner */}
                        <AcademyConversionBanner />
                    </div>

                    {/* Right Sidebar Column (1 Col) */}
                    <aside className="space-y-6">
                        {/* Start Discussion Card */}
                        <div className="bg-gradient-to-br from-[#a15912] to-[#7c440e] text-white p-6 rounded-3xl shadow-lg space-y-4">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                <PlusCircle className="w-6 h-6 text-white" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-base font-extrabold text-white">
                                    Have a Flute Question?
                                </h3>
                                <p className="text-xs text-amber-100 leading-relaxed">
                                    Ask about riyaz difficulties, raag notes, blowing technique, or instrument maintenance.
                                </p>
                            </div>
                            <Link
                                href="/community/new"
                                className="block w-full py-2.5 text-center bg-white hover:bg-amber-50 text-amber-950 font-bold text-xs rounded-xl shadow-xs transition-colors"
                            >
                                Ask a Question
                            </Link>
                        </div>

                        {/* Community Categories Directory */}
                        <div className="bg-white dark:bg-[#1a140e] p-5 rounded-3xl border border-amber-900/10 dark:border-amber-500/10 shadow-xs space-y-3">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Browse Topics
                            </h4>
                            <div className="space-y-1">
                                {categories.map((cat) => {
                                    const isSelected = selectedCategory === cat.slug;
                                    const isStudentOnly = cat.access_scope === 'students';

                                    return (
                                        <button
                                            key={cat.id}
                                            onClick={() => setSelectedCategory(cat.slug)}
                                            className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs font-semibold transition-colors ${
                                                isSelected
                                                    ? 'bg-amber-100 text-amber-950 dark:bg-amber-950/70 dark:text-amber-200'
                                                    : 'text-slate-700 dark:text-slate-300 hover:bg-amber-50/60 dark:hover:bg-slate-800'
                                            }`}
                                        >
                                            <span className="truncate pr-2">{cat.name}</span>
                                            {isStudentOnly && (
                                                <span className="text-[10px] text-purple-700 dark:text-purple-300 font-bold flex items-center gap-0.5 shrink-0">
                                                    <Lock className="w-2.5 h-2.5" />
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Guidelines & Etiquette Card */}
                        <div className="bg-white dark:bg-[#1a140e] p-5 rounded-3xl border border-amber-900/10 dark:border-amber-500/10 shadow-xs space-y-3">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Community Values
                            </h4>
                            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
                                <li className="flex items-start gap-2">
                                    <span className="text-amber-600 font-black">•</span>
                                    <span>Respect Guru-Shishya tradition and fellow flute sadhakas.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-amber-600 font-black">•</span>
                                    <span>Search before asking to build upon existing wisdom.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-amber-600 font-black">•</span>
                                    <span>Mark the best answer as Accepted Answer to help future learners.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-amber-600 font-black">•</span>
                                    <span>Keep discussions focused on authentic Indian classical music and bansuri practice.</span>
                                </li>
                            </ul>
                        </div>
                    </aside>
                </div>

            </main>
        </div>
    );
}
