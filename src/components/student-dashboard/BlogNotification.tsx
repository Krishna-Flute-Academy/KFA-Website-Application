'use client';

import React, { useState, useEffect } from 'react';
import { X, BookOpen, ChevronRight, ExternalLink, Sparkles, Play, Youtube, Bell } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { stripHtml } from '../../lib/text-utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BlogPost {
    id: string;
    title: string;
    slug: string;
    excerpt?: string;
    featured_image?: string;
    published_at?: string | null;
    target_url?: string;
}

interface YouTubeVideo {
    videoId: string;
    title: string;
    published?: string;
    description?: string;
    thumbnail: string;
    url: string;
}

interface BlogNotificationProps {
    studentId: string;
    broadcasts?: any[];
}

interface SystemNotificationSettings {
    blog_enabled: boolean;
    video_enabled: boolean;
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
    try {
        localStorage.setItem(`${baseKey}-${studentId}`, JSON.stringify(data));
    } catch (e) {
        console.warn('Could not save seen state to localStorage:', e);
    }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BlogNotification({ studentId, broadcasts }: BlogNotificationProps) {
    const [newPost,  setNewPost]  = useState<BlogPost | null>(null);
    const [newVideo, setNewVideo] = useState<YouTubeVideo | null>(null);

    // Announcement Details Modal (opened on click on both desktop and mobile)
    const [showModal, setShowModal] = useState(false);

    // ── Fetch both in parallel with Admin Pause Settings Check ────────────────
    useEffect(() => {
        if (!studentId) return;

        const fetchAll = async () => {
            try {
                // 1. Fetch system notification settings (blog_enabled, video_enabled)
                let blogEnabled = true;
                let videoEnabled = true;

                try {
                    const { data: settingsRow } = await supabase
                        .from('message_templates')
                        .select('content')
                        .eq('name', 'system_notification_settings')
                        .maybeSingle();

                    if (settingsRow?.content) {
                        const parsed = JSON.parse(settingsRow.content) as Partial<SystemNotificationSettings>;
                        if (parsed.blog_enabled === false) blogEnabled = false;
                        if (parsed.video_enabled === false) videoEnabled = false;
                    }
                } catch (e) {
                    // Default to enabled if table/row not populated
                    blogEnabled = true;
                    videoEnabled = true;
                }

                let blogBc: any = null;
                let videoBc: any = null;

                if (broadcasts && broadcasts.length > 0) {
                    blogBc = broadcasts.find((b: any) =>
                        b.channel === 'blog' || b.recipients?.some((r: any) => r._meta && r.type === 'blog')
                    );
                    videoBc = broadcasts.find((b: any) =>
                        b.channel === 'video' || b.recipients?.some((r: any) => r._meta && r.type === 'video')
                    );
                }

                // Blog & YouTube in parallel (respecting enable/pause toggle)
                const [blogResult, videoResult] = await Promise.allSettled([
                    !blogBc && blogEnabled
                        ? supabase
                            .from('blog_posts')
                            .select('id, title, slug, excerpt, featured_image, published_at')
                            .eq('published', true)
                            .order('published_at', { ascending: false })
                            .limit(1)
                            .maybeSingle()
                        : Promise.resolve({ data: null }),
                    !videoBc && videoEnabled
                        ? fetch('/api/latest-youtube-video').then(r => r.ok ? r.json() : null)
                        : Promise.resolve(null)
                ]);

                // Process Blog
                if (blogBc) {
                    const meta = blogBc.recipients?.find((r: any) => r._meta && r.type === 'blog') || {};
                    const post: BlogPost = {
                        id: blogBc.id,
                        title: blogBc.subject,
                        slug: meta.target_url || '/blog',
                        excerpt: stripHtml(blogBc.content || ''),
                        featured_image: meta.image_url || undefined,
                        target_url: meta.target_url || '/blog'
                    };
                    const seen = getSeen(BLOG_KEY, studentId);
                    if (seen.bannerDismissed !== post.id) {
                        setNewPost(post);
                    }
                } else if (blogEnabled && blogResult.status === 'fulfilled' && blogResult.value?.data) {
                    const post = blogResult.value.data as BlogPost;
                    const seen = getSeen(BLOG_KEY, studentId);
                    if (seen.bannerDismissed !== post.id) {
                        setNewPost(post);
                    }
                }

                // Process YouTube
                if (videoBc) {
                    const meta = videoBc.recipients?.find((r: any) => r._meta && r.type === 'video') || {};
                    const video: YouTubeVideo = {
                        videoId: videoBc.id,
                        title: videoBc.subject,
                        description: stripHtml(videoBc.content || ''),
                        thumbnail: meta.image_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&q=80',
                        url: meta.target_url || 'https://www.youtube.com'
                    };
                    const seen = getSeen(VIDEO_KEY, studentId);
                    if (seen.bannerDismissed !== video.videoId) {
                        setNewVideo(video);
                    }
                } else if (videoEnabled && videoResult.status === 'fulfilled' && videoResult.value?.videoId) {
                    const video = videoResult.value as YouTubeVideo;
                    const seen = getSeen(VIDEO_KEY, studentId);
                    if (seen.bannerDismissed !== video.videoId) {
                        setNewVideo(video);
                    }
                }
            } catch (err) {
                console.warn('Error checking Blog/Video notifications:', err);
            }
        };

        fetchAll();
    }, [studentId, broadcasts]);

    // ── Mark Helpers ──────────────────────────────────────────────────────────

    const markBlogSeen = () => {
        if (!newPost) return;
        const seen = getSeen(BLOG_KEY, studentId);
        setSeen(BLOG_KEY, studentId, { ...seen, popupShown: newPost.id, bannerDismissed: newPost.id });
    };

    const markVideoSeen = () => {
        if (!newVideo) return;
        const seen = getSeen(VIDEO_KEY, studentId);
        setSeen(VIDEO_KEY, studentId, { ...seen, popupShown: newVideo.videoId, bannerDismissed: newVideo.videoId });
    };

    // ── Read / Watch Actions ──────────────────────────────────────────────────

    const readBlog = () => {
        if (!newPost) return;
        const postToOpen = newPost;
        markBlogSeen();
        setNewPost(null);
        if (!newVideo) setShowModal(false);

        const destination = postToOpen.target_url || (postToOpen.slug
            ? (postToOpen.slug.startsWith('http') || postToOpen.slug.startsWith('/') ? postToOpen.slug : `/blog/${postToOpen.slug}`)
            : '/blog');
        window.open(destination, '_blank');
    };

    const watchVideo = () => {
        if (!newVideo) return;
        const videoToOpen = newVideo;
        markVideoSeen();
        setNewVideo(null);
        if (!newPost) setShowModal(false);

        window.open(videoToOpen.url, '_blank');
    };

    // ── Dismiss Actions ───────────────────────────────────────────────────────

    const dismissAll = () => {
        if (newPost) {
            markBlogSeen();
            setNewPost(null);
        }
        if (newVideo) {
            markVideoSeen();
            setNewVideo(null);
        }
        setShowModal(false);
    };

    const dismissSingle = (type: 'blog' | 'video') => {
        if (type === 'blog' && newPost) {
            markBlogSeen();
            setNewPost(null);
        } else if (type === 'video' && newVideo) {
            markVideoSeen();
            setNewVideo(null);
        }
        if ((type === 'blog' && !newVideo) || (type === 'video' && !newPost)) {
            setShowModal(false);
        }
    };

    // ── Nothing to show ───────────────────────────────────────────────────────
    if (!newPost && !newVideo) return null;

    const newCount = (newPost ? 1 : 0) + (newVideo ? 1 : 0);

    return (
        <>
            {/* ══════════ NON-INTRUSIVE NOTIFICATION INDICATOR (Desktop & Mobile) ══════════ */}
            {!showModal && (
                <div
                    className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm z-[9990] rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300 border border-amber-500/40"
                    style={{
                        background: 'linear-gradient(135deg, #180900, #121222)',
                    }}
                >
                    {/* Top gradient accent line */}
                    <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #a15912, #f5c842, #cc0000, #f5c842, #a15912)' }} />

                    <div className="p-3 sm:p-3.5 flex items-center gap-3">
                        {/* Icon */}
                        <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-inner"
                            style={{ background: 'rgba(236,182,19,0.2)' }}
                        >
                            <Bell className="w-4 h-4 text-amber-400 animate-pulse" />
                        </div>

                        {/* Title & Preview */}
                        <button
                            onClick={() => setShowModal(true)}
                            className="flex-1 min-w-0 text-left cursor-pointer group"
                        >
                            <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-amber-400 text-[10px] font-black uppercase tracking-wider">
                                    {newCount === 1 ? '1 New Update' : `${newCount} New Updates`}
                                </span>
                                <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                            </div>
                            <p className="text-white text-xs font-semibold truncate leading-snug group-hover:text-amber-300 transition-colors">
                                {newPost && newVideo
                                    ? 'New Blog Article & YouTube Lesson'
                                    : newPost
                                        ? newPost.title
                                        : newVideo?.title ?? 'Latest Academy Release'}
                            </p>
                        </button>

                        {/* View CTA */}
                        <button
                            onClick={() => setShowModal(true)}
                            className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-950 bg-[#ecb613] hover:bg-[#ecb613]/90 transition-all active:scale-95 shadow-md flex items-center gap-1 cursor-pointer"
                        >
                            <span>View</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>

                        {/* Dismiss */}
                        <button
                            onClick={dismissAll}
                            className="shrink-0 p-1 text-white/40 hover:text-white/80 transition-colors cursor-pointer rounded-lg hover:bg-white/10"
                            title="Dismiss updates"
                            aria-label="Dismiss updates"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* ══════════ ANNOUNCEMENT DETAILS DRAWER / MODAL ══════════ */}
            {showModal && (
                <div
                    className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setShowModal(false)}
                >
                    <div
                        className="relative w-full sm:max-w-2xl bg-gradient-to-b from-[#180900] via-[#12101e] to-[#0c0c16] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-white/10 overflow-hidden max-h-[88vh] flex flex-col animate-in slide-in-from-bottom-6 duration-300 text-left"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header bar */}
                        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #a15912, #f5c842, #cc0000, #f5c842, #a15912)' }} />

                        {/* Top bar with drag handle and close */}
                        <div className="px-5 py-4 flex items-center justify-between border-b border-white/10">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                                    <Bell className="w-4 h-4" />
                                </div>
                                <div>
                                    <h2 className="text-white font-bold text-base leading-tight">What&apos;s New at KFA</h2>
                                    <p className="text-white/50 text-[11px]">Latest lessons, articles and announcements</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                                aria-label="Close"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Content Body: Stacked or Grid cards */}
                        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 max-h-[calc(88vh-80px)]">
                            {/* ── Blog Card ── */}
                            {newPost && (
                                <div
                                    className="rounded-2xl overflow-hidden shadow-xl border border-amber-500/30 flex flex-col md:flex-row bg-[#221000]/60"
                                >
                                    {newPost.featured_image && (
                                        <div className="md:w-56 h-40 md:h-auto relative overflow-hidden shrink-0 bg-black/40">
                                            <img
                                                src={newPost.featured_image}
                                                alt={newPost.title}
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent md:hidden" />
                                            <div className="absolute top-2 left-2 flex items-center gap-1 bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                <Sparkles className="w-2.5 h-2.5" /> Blog Article
                                            </div>
                                        </div>
                                    )}

                                    <div className="p-4 sm:p-5 flex flex-col flex-1 min-w-0">
                                        {!newPost.featured_image && (
                                            <div className="flex items-center gap-1 mb-2 bg-amber-500/20 text-amber-400 text-[10px] font-black px-2 py-0.5 rounded-full w-fit uppercase tracking-wider border border-amber-500/30">
                                                <Sparkles className="w-2.5 h-2.5" /> Blog Article
                                            </div>
                                        )}
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div>
                                                <p className="text-amber-400/70 text-[10px] font-bold uppercase tracking-wider">From the Academy Blog</p>
                                                <h3 className="text-white font-bold text-sm sm:text-base leading-snug mt-0.5">{newPost.title}</h3>
                                            </div>
                                            <button
                                                onClick={() => dismissSingle('blog')}
                                                className="text-white/30 hover:text-white/70 p-1 transition-colors shrink-0"
                                                title="Dismiss this post"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        {newPost.excerpt && (
                                            <p className="text-amber-100/60 text-xs leading-relaxed line-clamp-2 sm:line-clamp-3 mb-4">{newPost.excerpt}</p>
                                        )}

                                        <div className="mt-auto pt-2 flex items-center gap-3">
                                            <button
                                                onClick={readBlog}
                                                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 transition-all active:scale-95 shadow-lg cursor-pointer"
                                            >
                                                <BookOpen className="w-3.5 h-3.5" />
                                                <span>Read Article</span>
                                                <ExternalLink className="w-3 h-3 opacity-70" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── YouTube Video Card ── */}
                            {newVideo && (
                                <div
                                    className="rounded-2xl overflow-hidden shadow-xl border border-rose-500/30 flex flex-col md:flex-row bg-[#1a0505]/60"
                                >
                                    {/* Thumbnail */}
                                    <div
                                        className="md:w-56 h-40 md:h-auto relative overflow-hidden shrink-0 bg-black/40 group cursor-pointer"
                                        onClick={watchVideo}
                                    >
                                        <img
                                            src={newVideo.thumbnail}
                                            alt={newVideo.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                            <div className="w-12 h-12 rounded-full bg-rose-600 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                                                <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                                            </div>
                                        </div>
                                        <div className="absolute top-2 left-2 flex items-center gap-1 bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                            <Youtube className="w-2.5 h-2.5" /> Video Lesson
                                        </div>
                                    </div>

                                    <div className="p-4 sm:p-5 flex flex-col flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div>
                                                <p className="text-rose-400/70 text-[10px] font-bold uppercase tracking-wider">Krishna Flute Academy · YouTube</p>
                                                <h3 className="text-white font-bold text-sm sm:text-base leading-snug mt-0.5">{newVideo.title}</h3>
                                            </div>
                                            <button
                                                onClick={() => dismissSingle('video')}
                                                className="text-white/30 hover:text-white/70 p-1 transition-colors shrink-0"
                                                title="Dismiss this video"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        {newVideo.description && (
                                            <p className="text-slate-400 text-xs leading-relaxed line-clamp-2 sm:line-clamp-3 mb-4">{newVideo.description}</p>
                                        )}

                                        <div className="mt-auto pt-2 flex items-center gap-3">
                                            <button
                                                onClick={watchVideo}
                                                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 transition-all active:scale-95 shadow-lg cursor-pointer"
                                            >
                                                <Play className="w-3.5 h-3.5 fill-white" />
                                                <span>Watch on YouTube</span>
                                                <ExternalLink className="w-3 h-3 opacity-70" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
