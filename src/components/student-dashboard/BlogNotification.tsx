'use client';

import React, { useState, useEffect } from 'react';
import { X, BookOpen, ChevronRight, ExternalLink, Sparkles, Play, Youtube } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BlogPost {
    id: string;
    title: string;
    slug: string;
    excerpt?: string;
    featured_image?: string;
    published_at?: string | null;
}

interface YouTubeVideo {
    videoId: string;
    title: string;
    published: string;
    description?: string;
    thumbnail: string;
    url: string;
}

interface BlogNotificationProps {
    studentId: string;
}

const BLOG_KEY  = 'kfa-student-seen-blog';
const VIDEO_KEY = 'kfa-student-seen-video';

function getSeen(baseKey: string, studentId: string) {
    try {
        const raw = localStorage.getItem(`${baseKey}-${studentId}`);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}
function setSeen(baseKey: string, studentId: string, data: object) {
    localStorage.setItem(`${baseKey}-${studentId}`, JSON.stringify(data));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BlogNotification({ studentId }: BlogNotificationProps) {
    const [newPost,  setNewPost]  = useState<BlogPost | null>(null);
    const [newVideo, setNewVideo] = useState<YouTubeVideo | null>(null);

    // Popup: shows whichever new items exist
    const [showPopup,  setShowPopup]  = useState(false);

    // Banners: individual corner cards after popup is dismissed
    const [showBlogBanner,  setShowBlogBanner]  = useState(false);
    const [showVideoBanner, setShowVideoBanner] = useState(false);

    // ── Fetch both in parallel ────────────────────────────────────────────────
    useEffect(() => {
        if (!studentId) return;

        const fetchAll = async () => {
            // Blog & YouTube in parallel
            const [blogResult, videoResult] = await Promise.allSettled([
                supabase
                    .from('blog_posts')
                    .select('id, title, slug, excerpt, featured_image, published_at')
                    .eq('published', true)
                    .order('published_at', { ascending: false })
                    .limit(1)
                    .maybeSingle(),
                fetch('/api/latest-youtube-video').then(r => r.ok ? r.json() : null)
            ]);

            let hasNew = false;

            // Blog
            if (blogResult.status === 'fulfilled' && blogResult.value.data) {
                const post = blogResult.value.data as BlogPost;
                const seen = getSeen(BLOG_KEY, studentId);
                if (seen.popupShown !== post.id) {
                    setNewPost(post);
                    hasNew = true;
                } else if (seen.bannerDismissed !== post.id) {
                    setShowBlogBanner(true);
                    setNewPost(post);
                }
            }

            // YouTube
            if (videoResult.status === 'fulfilled' && videoResult.value?.videoId) {
                const video = videoResult.value as YouTubeVideo;
                const seen = getSeen(VIDEO_KEY, studentId);
                if (seen.popupShown !== video.videoId) {
                    setNewVideo(video);
                    hasNew = true;
                } else if (seen.bannerDismissed !== video.videoId) {
                    setShowVideoBanner(true);
                    setNewVideo(video);
                }
            }

            // Show combined popup after a short delay if anything is new
            if (hasNew) {
                setTimeout(() => setShowPopup(true), 1500);
            }
        };

        fetchAll();
    }, [studentId]);

    // ── Mark helpers ──────────────────────────────────────────────────────────

    const markBlogPopupSeen = () => {
        if (!newPost) return;
        const seen = getSeen(BLOG_KEY, studentId);
        setSeen(BLOG_KEY, studentId, { ...seen, popupShown: newPost.id });
    };
    const markBlogBannerDismissed = () => {
        if (!newPost) return;
        const seen = getSeen(BLOG_KEY, studentId);
        setSeen(BLOG_KEY, studentId, { ...seen, bannerDismissed: newPost.id });
    };
    const markVideoPopupSeen = () => {
        if (!newVideo) return;
        const seen = getSeen(VIDEO_KEY, studentId);
        setSeen(VIDEO_KEY, studentId, { ...seen, popupShown: newVideo.videoId });
    };
    const markVideoBannerDismissed = () => {
        if (!newVideo) return;
        const seen = getSeen(VIDEO_KEY, studentId);
        setSeen(VIDEO_KEY, studentId, { ...seen, bannerDismissed: newVideo.videoId });
    };

    // ── Popup dismiss (collapses to banners) ──────────────────────────────────

    const dismissPopup = () => {
        if (newPost)  { markBlogPopupSeen();  setShowBlogBanner(true); }
        if (newVideo) { markVideoPopupSeen(); setShowVideoBanner(true); }
        setShowPopup(false);
    };

    // ── Read / Watch (fully dismiss) ──────────────────────────────────────────

    const readBlog = () => {
        if (!newPost) return;
        markBlogPopupSeen();
        markBlogBannerDismissed();
        setShowPopup(false);
        setShowBlogBanner(false);
        // If video is still new, collapse video to banner
        if (newVideo) { markVideoPopupSeen(); setShowVideoBanner(true); }
        window.open(`/blog/${newPost.slug || newPost.id}`, '_blank');
    };

    const watchVideo = () => {
        if (!newVideo) return;
        markVideoPopupSeen();
        markVideoBannerDismissed();
        setShowPopup(false);
        setShowVideoBanner(false);
        // If blog is still new, collapse blog to banner
        if (newPost) { markBlogPopupSeen(); setShowBlogBanner(true); }
        window.open(newVideo.url, '_blank');
    };

    const dismissBlogBanner = () => { markBlogBannerDismissed(); setShowBlogBanner(false); };
    const dismissVideoBanner = () => { markVideoBannerDismissed(); setShowVideoBanner(false); };

    // ── Nothing to show ───────────────────────────────────────────────────────
    if (!newPost && !newVideo) return null;

    // ── How many cards in popup ───────────────────────────────────────────────
    const bothNew  = !!newPost && !!newVideo && showPopup;
    const onlyBlog = !!newPost && !newVideo  && showPopup;
    const onlyVid  = !newPost  && !!newVideo && showPopup;

    return (
        <>
            {/* ══════════ COMBINED POPUP ═══════════════════════════════════════ */}
            {showPopup && (
                <div
                    className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-3 sm:p-4"
                    style={{ background: 'rgba(5,5,15,0.7)', backdropFilter: 'blur(8px)' }}
                    onClick={dismissPopup}
                >
                    <div
                        className={`relative w-full flex flex-col sm:flex-row gap-3 animate-in fade-in slide-in-from-bottom-6 duration-500 ${bothNew ? 'max-w-2xl' : 'max-w-md'}`}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Global close */}
                        <button
                            onClick={dismissPopup}
                            className="absolute -top-3 -right-3 z-20 w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-slate-700 transition-all shadow-lg"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        {/* ── Blog Card ── */}
                        {(bothNew || onlyBlog) && newPost && (
                            <div
                                className="flex-1 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
                                style={{ background: 'linear-gradient(145deg, #1a0a00, #2d1400, #3d1f00)' }}
                            >
                                <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #a15912, #f5c842, #a15912)' }} />

                                {newPost.featured_image && (
                                    <div className="relative h-36 overflow-hidden">
                                        <img src={newPost.featured_image} alt={newPost.title} className="w-full h-full object-cover opacity-80" />
                                        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #1a0a00 0%, transparent 60%)' }} />
                                        <div className="absolute top-2 left-2 flex items-center gap-1 bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                                            <Sparkles className="w-2.5 h-2.5" /> New Post
                                        </div>
                                    </div>
                                )}

                                <div className="p-4 flex flex-col flex-1">
                                    {!newPost.featured_image && (
                                        <div className="flex items-center gap-1 mb-2 bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-black px-2 py-0.5 rounded-full w-fit uppercase tracking-widest">
                                            <Sparkles className="w-2.5 h-2.5" /> New Blog Post
                                        </div>
                                    )}
                                    <div className="flex gap-2 mb-2">
                                        <div className="p-1.5 rounded-lg bg-amber-500/20 shrink-0 h-fit">
                                            <BookOpen className="w-4 h-4 text-amber-400" />
                                        </div>
                                        <div>
                                            <p className="text-amber-300/60 text-[10px] font-medium">From the Academy</p>
                                            <h3 className="text-white font-bold text-sm leading-snug line-clamp-2">{newPost.title}</h3>
                                        </div>
                                    </div>
                                    {newPost.excerpt && (
                                        <p className="text-amber-100/50 text-xs leading-relaxed line-clamp-2 mb-3">{newPost.excerpt}</p>
                                    )}
                                    <button
                                        onClick={readBlog}
                                        className="mt-auto w-full flex items-center justify-center gap-1.5 py-2 rounded-xl font-bold text-xs text-white transition-all active:scale-95 shadow-lg"
                                        style={{ background: 'linear-gradient(135deg, #a15912, #c97a1e)' }}
                                    >
                                        Read Article <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── YouTube Card ── */}
                        {(bothNew || onlyVid) && newVideo && (
                            <div
                                className="flex-1 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
                                style={{ background: 'linear-gradient(145deg, #0d0d1a, #1a1a2e, #16213e)' }}
                            >
                                <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #cc0000, #ff6b6b, #cc0000)' }} />

                                {/* Thumbnail */}
                                <div className="relative h-36 overflow-hidden group cursor-pointer" onClick={watchVideo}>
                                    <img src={newVideo.thumbnail} alt={newVideo.title} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all flex items-center justify-center">
                                        <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                                            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                                        </div>
                                    </div>
                                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow">
                                        <Youtube className="w-2.5 h-2.5" /> New Video
                                    </div>
                                    <div className="absolute inset-x-0 bottom-0 h-12" style={{ background: 'linear-gradient(to top, #0d0d1a, transparent)' }} />
                                </div>

                                <div className="p-4 flex flex-col flex-1">
                                    <div className="flex gap-2 mb-2">
                                        <div className="p-1.5 rounded-lg bg-red-500/20 shrink-0 h-fit">
                                            <Youtube className="w-4 h-4 text-red-400" />
                                        </div>
                                        <div>
                                            <p className="text-red-300/60 text-[10px] font-medium">Krishna Flute Academy · YouTube</p>
                                            <h3 className="text-white font-bold text-sm leading-snug line-clamp-2">{newVideo.title}</h3>
                                        </div>
                                    </div>
                                    {newVideo.description && (
                                        <p className="text-slate-400 text-xs leading-relaxed line-clamp-2 mb-3">{newVideo.description}</p>
                                    )}
                                    <button
                                        onClick={watchVideo}
                                        className="mt-auto w-full flex items-center justify-center gap-1.5 py-2 rounded-xl font-bold text-xs text-white transition-all active:scale-95 shadow-lg"
                                        style={{ background: 'linear-gradient(135deg, #cc0000, #ff4444)' }}
                                    >
                                        <Play className="w-3.5 h-3.5 fill-white" /> Watch Now
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Dismiss hint */}
                    <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/30 text-xs tracking-wide pointer-events-none hidden sm:block">
                        Tap outside to dismiss
                    </p>
                </div>
            )}

            {/* ══════════ CORNER BANNERS (stacked) ═════════════════════════════ */}

            {/* Blog Banner */}
            {showBlogBanner && !showPopup && newPost && (
                <div
                    className={`fixed right-4 z-[9997] max-w-[270px] w-full rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-right-4 fade-in duration-400 transition-all ${showVideoBanner ? 'bottom-40' : 'bottom-4'}`}
                    style={{ background: 'linear-gradient(135deg, #1e0d00, #2d1400)', border: '1px solid rgba(161,89,18,0.4)' }}
                >
                    <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #a15912, #f5c842, #a15912)' }} />
                    <div className="p-3">
                        <div className="flex items-start gap-2">
                            {newPost.featured_image
                                ? <img src={newPost.featured_image} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 opacity-90" />
                                : <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0"><BookOpen className="w-4 h-4 text-amber-400" /></div>
                            }
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 mb-0.5">
                                    <span className="text-amber-400 text-[9px] font-black uppercase tracking-widest">New Blog</span>
                                    <Sparkles className="w-2 h-2 text-amber-400" />
                                </div>
                                <p className="text-white text-xs font-semibold leading-snug line-clamp-2">{newPost.title}</p>
                            </div>
                            <button onClick={dismissBlogBanner} className="shrink-0 p-0.5 text-white/30 hover:text-white/70 transition-colors">
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                        <button onClick={readBlog} className="mt-2.5 w-full flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-bold text-white transition-all active:scale-95" style={{ background: 'linear-gradient(135deg, #a15912, #c97a1e)' }}>
                            <ExternalLink className="w-2.5 h-2.5" /> Read Article
                        </button>
                    </div>
                </div>
            )}

            {/* YouTube Banner */}
            {showVideoBanner && !showPopup && newVideo && (
                <div
                    className="fixed bottom-4 right-4 z-[9998] max-w-[270px] w-full rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-right-4 fade-in duration-400"
                    style={{ background: 'linear-gradient(135deg, #0d0d1a, #1a1a2e)', border: '1px solid rgba(220,38,38,0.35)' }}
                >
                    <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #cc0000, #ff6b6b, #cc0000)' }} />
                    <div className="p-3">
                        <div className="flex items-start gap-2">
                            <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0">
                                <img src={newVideo.thumbnail} alt="" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                    <Play className="w-3 h-3 text-white fill-white" />
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 mb-0.5">
                                    <Youtube className="w-2.5 h-2.5 text-red-500" />
                                    <span className="text-red-400 text-[9px] font-black uppercase tracking-widest">New Video</span>
                                </div>
                                <p className="text-white text-xs font-semibold leading-snug line-clamp-2">{newVideo.title}</p>
                            </div>
                            <button onClick={dismissVideoBanner} className="shrink-0 p-0.5 text-white/30 hover:text-white/70 transition-colors">
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                        <button onClick={watchVideo} className="mt-2.5 w-full flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-bold text-white transition-all active:scale-95" style={{ background: 'linear-gradient(135deg, #cc0000, #ff4444)' }}>
                            <Play className="w-2.5 h-2.5 fill-white" /> Watch on YouTube
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
