'use client';

import React, { useState, useEffect } from 'react';
import { X, BookOpen, ChevronRight, ExternalLink, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface BlogPost {
    id: string;
    title: string;
    slug: string;
    excerpt?: string;
    featured_image?: string;
    published_at?: string | null;
    author_name?: string;
}

interface BlogNotificationProps {
    studentId: string;
}

const STORAGE_KEY = 'kfa-student-seen-blog';

export default function BlogNotification({ studentId }: BlogNotificationProps) {
    const [latestPost, setLatestPost] = useState<BlogPost | null>(null);
    const [showPopup, setShowPopup] = useState(false);
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        if (!studentId) return;

        const fetchLatestBlog = async () => {
            const { data, error } = await supabase
                .from('blog_posts')
                .select('id, title, slug, excerpt, featured_image, published_at, author_name')
                .eq('published', true)
                .order('published_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error || !data) return;

            const post = data as BlogPost;

            const stored = localStorage.getItem(`${STORAGE_KEY}-${studentId}`);
            let seen: { popupShown?: string; bannerDismissed?: string } = {};
            try { seen = stored ? JSON.parse(stored) : {}; } catch { seen = {}; }

            if (seen.popupShown !== post.id) {
                setLatestPost(post);
                setTimeout(() => setShowPopup(true), 1500);
            } else if (seen.bannerDismissed !== post.id) {
                setLatestPost(post);
                setShowBanner(true);
            }
        };

        fetchLatestBlog();
    }, [studentId]);

    const markPopupSeen = () => {
        if (!latestPost || !studentId) return;
        const key = `${STORAGE_KEY}-${studentId}`;
        const stored = localStorage.getItem(key);
        let seen: any = {};
        try { seen = stored ? JSON.parse(stored) : {}; } catch { seen = {}; }
        seen.popupShown = latestPost.id;
        localStorage.setItem(key, JSON.stringify(seen));
    };

    const markBannerDismissed = () => {
        if (!latestPost || !studentId) return;
        const key = `${STORAGE_KEY}-${studentId}`;
        const stored = localStorage.getItem(key);
        let seen: any = {};
        try { seen = stored ? JSON.parse(stored) : {}; } catch { seen = {}; }
        seen.bannerDismissed = latestPost.id;
        localStorage.setItem(key, JSON.stringify(seen));
    };

    const handleDismissPopup = () => {
        markPopupSeen();
        setShowPopup(false);
        setShowBanner(true);
    };

    const handleReadNow = () => {
        if (!latestPost) return;
        markPopupSeen();
        markBannerDismissed();
        setShowPopup(false);
        setShowBanner(false);
        window.open(`/blog/${latestPost.slug || latestPost.id}`, '_blank');
    };

    const handleDismissBanner = () => {
        markBannerDismissed();
        setShowBanner(false);
    };

    if (!latestPost) return null;

    return (
        <>
            {/* ── Full Pop-up Modal ─────────────────────────────── */}
            {showPopup && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                    style={{ background: 'rgba(10,10,20,0.6)', backdropFilter: 'blur(6px)' }}
                    onClick={handleDismissPopup}
                >
                    <div
                        className="relative max-w-md w-full rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-6 duration-500"
                        style={{ background: 'linear-gradient(135deg, #1a0a00 0%, #2d1400 60%, #3d1f00 100%)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Gold shimmer top bar */}
                        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #a15912, #f5c842, #a15912)' }} />

                        {/* Close button */}
                        <button
                            onClick={handleDismissPopup}
                            className="absolute top-3 right-3 z-10 p-1.5 rounded-full text-amber-300/70 hover:text-white hover:bg-white/10 transition-all"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        {/* Featured image */}
                        {latestPost.featured_image && (
                            <div className="relative h-48 overflow-hidden">
                                <img
                                    src={latestPost.featured_image}
                                    alt={latestPost.title}
                                    className="w-full h-full object-cover opacity-80"
                                />
                                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #1a0a00 0%, transparent 60%)' }} />
                                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-amber-500 text-white text-xs font-black px-3 py-1 rounded-full shadow-lg uppercase tracking-widest">
                                    <Sparkles className="w-3 h-3" />
                                    New Post
                                </div>
                            </div>
                        )}

                        {/* Content */}
                        <div className="p-5 pb-6">
                            {!latestPost.featured_image && (
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest">
                                        <Sparkles className="w-3 h-3" />
                                        New Blog Post
                                    </div>
                                </div>
                            )}

                            <div className="flex items-start gap-3 mb-3">
                                <div className="p-2 rounded-xl bg-amber-500/20 shrink-0">
                                    <BookOpen className="w-5 h-5 text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-amber-300/70 text-xs font-medium mb-0.5">From the Academy</p>
                                    <h3 className="text-white font-bold text-lg leading-snug line-clamp-2">
                                        {latestPost.title}
                                    </h3>
                                </div>
                            </div>

                            {latestPost.excerpt && (
                                <p className="text-amber-100/60 text-sm leading-relaxed line-clamp-3 mb-4">
                                    {latestPost.excerpt}
                                </p>
                            )}

                            {latestPost.published_at && (
                                <p className="text-amber-400/50 text-xs mb-4">
                                    Published {new Date(latestPost.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </p>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={handleReadNow}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm text-white transition-all active:scale-95 shadow-lg"
                                    style={{ background: 'linear-gradient(135deg, #a15912, #c97a1e)' }}
                                >
                                    Read Article <ChevronRight className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={handleDismissPopup}
                                    className="px-4 py-2.5 rounded-xl font-medium text-sm text-amber-300/70 hover:text-white border border-white/10 hover:bg-white/10 transition-all active:scale-95"
                                >
                                    Later
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Corner Banner (after popup dismissed) ────────── */}
            {showBanner && !showPopup && (
                <div
                    className="fixed bottom-5 right-5 z-[9998] max-w-[280px] w-full rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-right-4 fade-in duration-400"
                    style={{
                        background: 'linear-gradient(135deg, #1e0d00, #2d1400)',
                        border: '1px solid rgba(161,89,18,0.4)'
                    }}
                >
                    <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #a15912, #f5c842, #a15912)' }} />

                    <div className="p-3.5">
                        <div className="flex items-start gap-2.5">
                            {latestPost.featured_image ? (
                                <img
                                    src={latestPost.featured_image}
                                    alt=""
                                    className="w-12 h-12 rounded-lg object-cover shrink-0 opacity-90"
                                />
                            ) : (
                                <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                                    <BookOpen className="w-5 h-5 text-amber-400" />
                                </div>
                            )}

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <span className="text-amber-400 text-[10px] font-black uppercase tracking-widest">New Post</span>
                                    <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                                </div>
                                <p className="text-white text-xs font-semibold leading-snug line-clamp-2">
                                    {latestPost.title}
                                </p>
                            </div>

                            <button
                                onClick={handleDismissBanner}
                                className="shrink-0 p-0.5 text-white/30 hover:text-white/80 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        <button
                            onClick={handleReadNow}
                            className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-95"
                            style={{ background: 'linear-gradient(135deg, #a15912, #c97a1e)' }}
                        >
                            <ExternalLink className="w-3 h-3" />
                            Read on Academy Blog
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
