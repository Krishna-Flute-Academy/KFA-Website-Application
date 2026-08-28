'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, User, Eye, Tag, ArrowLeft, Home, Share2, Search, X } from 'lucide-react';
import Link from 'next/link';
import { supabase, BlogPost } from '../lib/supabase';
import { sanitizeHtml } from '../lib/text-utils';
import ReadingProgressBar from './ReadingProgressBar';
import TableOfContents from './TableOfContents';

interface BlogProps {
    initialPostId?: string | null;
    onBack?: () => void;
}

export const Blog: React.FC<BlogProps> = ({ initialPostId, onBack }) => {
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAllTags, setShowAllTags] = useState(false);
    const [processedContent, setProcessedContent] = useState<string>('');

    // --- Helper: Copy Link ---
    const handleCopyLink = (e: React.MouseEvent, slug: string) => {
        e.stopPropagation();
        const url = `${window.location.origin}/blog/${slug}/`;
        navigator.clipboard.writeText(url).then(() => {
            alert("Link copied!");
        });
    };

    // --- Helper: Get Tags ---
    const getPopularTags = () => {
        const tagCounts: Record<string, number> = {};
        posts.forEach(post => {
            if (post && Array.isArray(post.tags)) {
                post.tags.forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            }
        });
        return Object.entries(tagCounts)
            .sort(([, countA], [, countB]) => countB - countA)
            .map(([tag]) => tag);
    };

    // --- Effects ---
    useEffect(() => {
        if (!selectedPost?.content || typeof window === 'undefined') return;

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(selectedPost.content, 'text/html');
            const headings = doc.querySelectorAll('h1, h2, h3');
            headings.forEach(heading => {
                if (!heading.id && heading.textContent) {
                    heading.id = heading.textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
                }
            });
            setProcessedContent(doc.body.innerHTML);
        } catch (e) {
            console.error("Error processing HTML for TOC:", e);
        }
    }, [selectedPost?.content]);

    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            setError(null);
            try {
                // Fetch all published posts
                const { data: postsData, error: postsError } = await supabase
                    .from('blog_posts')
                    .select('*')
                    .eq('published', true)
                    .order('published_at', { ascending: false });

                if (postsError) throw postsError;

                // FIX 1: Filter out any null/invalid posts immediately
                const validPosts = (postsData || []).filter(p => p && p.title && p.id);
                setPosts(validPosts);

                // Handle initial post selection from URL
                if (initialPostId) {
                    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(initialPostId);

                    let targetPost = null;
                    if (isUUID) {
                        targetPost = validPosts.find(p => p.id === initialPostId);
                    }

                    if (!targetPost) {
                        targetPost = validPosts.find(p => p.slug === initialPostId);
                    }

                    // Fallback to direct fetch if not in the recent list
                    if (!targetPost) {
                        const { data: specificPost } = await supabase
                            .from('blog_posts')
                            .select('*')
                            .or(`id.eq.${isUUID ? initialPostId : '00000000-0000-0000-0000-000000000000'},slug.eq.${initialPostId}`)
                            .maybeSingle();

                        if (specificPost && specificPost.title) {
                            targetPost = specificPost;
                        }
                    }

                    if (targetPost) {
                        setSelectedPost(targetPost);
                        incrementViewCount(targetPost.id);
                    } else if (initialPostId) {
                        console.warn('Requested post not found');
                    }
                }
            } catch (err: any) {
                console.error('Error loading blog data:', {
                    message: err.message,
                    details: err.details,
                    hint: err.hint,
                    code: err.code,
                    fullError: err
                });
                setError(err.message || 'Failed to load blog posts');
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, [initialPostId]);

    const incrementViewCount = async (postId: string) => {
        try {
            const { data: current } = await supabase.from('blog_posts').select('view_count').eq('id', postId).single();
            if (current) {
                await supabase.from('blog_posts').update({ view_count: (current.view_count || 0) + 1 }).eq('id', postId);
            }
        } catch (error) {
            console.error('Error updating view count:', error);
        }
    };

    const handlePostClick = (post: BlogPost) => {
        if (!post) return;
        const identifier = post.slug || post.id;
        window.location.href = `/blog/${identifier}/`;
    };

    const handleBack = () => {
        if (selectedPost) {
            setSelectedPost(null);
            setError(null);
            window.history.pushState({}, '', window.location.pathname);
        } else if (onBack) {
            onBack();
        }
    };

    const handleExit = () => {
        if (onBack) onBack();
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Not published';
        return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const filteredPosts = posts.filter(post => {
        const matchesTag = selectedTag ? post.tags?.includes(selectedTag) : true;
        const lowerQuery = searchQuery.toLowerCase().trim();
        const matchesSearch = lowerQuery === '' ? true : (
            (post.title?.toLowerCase() || '').includes(lowerQuery) ||
            (post.excerpt?.toLowerCase() || '').includes(lowerQuery) ||
            (post.tags?.some(tag => tag.toLowerCase().includes(lowerQuery)) || false)
        );
        return matchesTag && matchesSearch;
    });

    // --- RENDER LOGIC ---
    const renderContent = () => {
        if (loading) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center space-y-4">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xl font-semibold text-blue-700">Loading Wisdom...</p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
                    <div className="bg-red-50 p-8 rounded-2xl shadow-lg max-w-md">
                        <Search className="w-16 h-16 text-red-400 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-red-900 mb-2">Something went wrong</h2>
                        <p className="text-red-700 mb-6">We're having trouble loading the blog right now.</p>
                        <button onClick={handleBack} className="flex items-center justify-center space-x-2 w-full px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-md">
                            <ArrowLeft className="w-5 h-5" /> <span>Back to all posts</span>
                        </button>
                    </div>
                </div>
            );
        }

        // --- SINGLE POST VIEW ---
        if (selectedPost) {
            return (
                <>
                    <ReadingProgressBar />
                    <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-10 lg:items-start">
                        {/* Sidebar - Table of Contents (Mobile primary, Desktop right sidebar) */}
                        <aside className="w-full lg:w-1/4 flex-shrink-0 lg:order-last">
                            <TableOfContents contentHtml={processedContent || selectedPost.content || ''} />
                        </aside>

                        {/* Main Content Column */}
                        <div className="lg:w-3/4 max-w-4xl mx-auto lg:mx-0 flex-grow lg:order-first">
                            <button onClick={handleBack} className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 mb-8 transition-colors group">
                                <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" /> <span>Back to all posts</span>
                            </button>

                            <article className="bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {selectedPost.featured_image && <img src={selectedPost.featured_image} alt={selectedPost.title} className="w-full h-80 md:h-96 object-cover" />}
                                <div className="p-6 md:p-8 lg:p-10">
                                    <div className="flex justify-between items-start mb-6">
                                        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-blue-900 leading-tight">{selectedPost.title}</h1>
                                        <button onClick={(e) => handleCopyLink(e, selectedPost.slug || selectedPost.id)} className="p-2 ml-4 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full flex-shrink-0 transition-colors" title="Share"><Share2 className="w-5 h-5" /></button>
                                    </div>
                                    <div className="flex flex-wrap gap-4 mb-8 text-blue-700 bg-blue-50/50 p-4 rounded-xl">
                                        <div className="flex items-center gap-2"><User className="w-5 h-5 text-blue-500" /> <span className="font-medium">{selectedPost.author_name}</span></div>
                                        <div className="flex items-center gap-2"><Calendar className="w-5 h-5 text-blue-500" /> <span>{formatDate(selectedPost.published_at)}</span></div>
                                        <div className="flex items-center gap-2"><Eye className="w-5 h-5 text-blue-500" /> <span>{selectedPost.view_count} views</span></div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mb-8">
                                        {(selectedPost.tags || []).map((tag, i) => <span key={i} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex items-center gap-1"><Tag className="w-3 h-3" />{tag}</span>)}
                                    </div>

                                    {/* Prose Container with Fluid Typography */}
                                    <div className="overflow-x-auto w-full bg-white">
                                        <div
                                            className="prose prose-blue max-w-none text-blue-800/90 tiptap prose-styles-preserved
                                        text-[clamp(1rem,0.95rem+0.25vw,1.125rem)] leading-relaxed
                                        [&_strong]:text-blue-900 [&_b]:text-blue-900 
                                        [&_h1]:text-blue-950 [&_h2]:text-blue-950 [&_h3]:text-blue-950 
                                        [&_img]:rounded-xl [&_img]:shadow-md
                                        [&_table]:block [&_table]:overflow-x-auto [&_table]:whitespace-nowrap [&_table]:w-full [&_table]:border-collapse [&_th]:bg-blue-50 [&_th]:p-3 [&_td]:p-3 [&_td]:border [&_th]:border [&_th]:min-w-[120px] [&_td]:min-w-[120px] [&_td]:border-blue-200 [&_th]:border-blue-200
                                        [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&_li::marker]:text-blue-600"
                                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(processedContent || selectedPost.content) }}
                                        />
                                    </div>
                                </div>
                            </article>
                        </div>
                    </div>
                </>
            );
        }

        // --- BLOG LIST VIEW ---
        return (
            <div className="max-w-7xl mx-auto">

                <div className="mb-8">
                    <Link
                        href="/"
                        className="inline-flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all shadow-md active:scale-95"
                    >
                        <Home className="w-5 h-5" /> <span>Back to Home</span>
                    </Link>
                </div>

                <div className="text-center mb-10 animate-in fade-in duration-700">
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-blue-900 mb-6 tracking-tight">Our Blog</h1>
                    <div className="w-24 h-1.5 bg-gradient-to-r from-blue-500 via-yellow-400 to-blue-500 mx-auto mb-8 rounded-full"></div>
                    <p className="text-xl text-blue-700 max-w-3xl mx-auto leading-relaxed font-medium italic">Insights, stories, and musical wisdom from Krishna Flute Academy</p>
                </div>

                {/* Search Bar */}
                <div className="max-w-md mx-auto mb-12 relative px-4 sm:px-0">
                    <div className="relative flex items-center bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-blue-100 dark:border-slate-800 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 focus-within:ring-offset-0 transition-all duration-300">
                        <Search className="absolute left-4 w-5 h-5 text-blue-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search articles by title, excerpt, or tags..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-10 py-3.5 bg-transparent rounded-2xl text-blue-900 dark:text-white placeholder-blue-300 text-sm focus:outline-none"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-4 p-1 hover:bg-blue-50 dark:hover:bg-slate-850 rounded-full text-blue-400 hover:text-blue-600 transition-colors"
                                aria-label="Clear search"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {getPopularTags().length > 0 && (
                    <div className="mb-12 text-center animate-in fade-in slide-in-from-top-4 duration-500 delay-150">
                        <div className="flex flex-wrap justify-center gap-3 mb-4">
                            <button
                                onClick={() => setSelectedTag(null)}
                                className={`px-5 py-2 rounded-full transition-all duration-300 font-medium ${selectedTag === null ? 'bg-blue-600 text-white shadow-lg scale-105' : 'bg-white text-blue-600 border border-blue-200 hover:border-blue-400'}`}
                            >
                                All Posts
                            </button>
                            {getPopularTags().slice(0, showAllTags ? undefined : 10).map((tag) => (
                                <button
                                    key={tag}
                                    onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                                    className={`px-5 py-2 rounded-full transition-all duration-300 flex items-center space-x-2 font-medium ${selectedTag === tag ? 'bg-blue-600 text-white shadow-lg scale-105' : 'bg-white text-blue-600 border border-blue-200 hover:border-blue-400'}`}
                                >
                                    <Tag className="w-4 h-4" />
                                    <span>{tag}</span>
                                </button>
                            ))}
                        </div>
                        {getPopularTags().length > 10 && (
                            <button onClick={() => setShowAllTags(!showAllTags)} className="text-sm text-blue-600 font-bold hover:text-blue-800 transition-all hover:underline underline-offset-4">
                                {showAllTags ? 'Show Less Tags' : `Show All Tags (${getPopularTags().length})`}
                            </button>
                        )}
                    </div>
                )}

                {filteredPosts.length === 0 ? (
                    <div className="text-center py-20 bg-blue-50/40 rounded-3xl border border-dashed border-blue-200 animate-in zoom-in duration-500 max-w-2xl mx-auto px-6">
                        <Search className="w-12 h-12 text-blue-300 mx-auto mb-4" />
                        <p className="text-2xl font-bold text-blue-900">No matches found</p>
                        <p className="text-blue-600 mt-2">Try adjusting your search query or tag selections.</p>
                        <div className="mt-6 flex justify-center gap-3">
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="px-5 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 font-bold transition-all shadow-md hover:scale-105"
                                >
                                    Clear Search
                                </button>
                            )}
                            {selectedTag && (
                                <button
                                    onClick={() => setSelectedTag(null)}
                                    className="px-5 py-2 bg-white text-blue-600 border border-blue-200 rounded-full hover:border-blue-400 font-bold transition-all hover:scale-105"
                                >
                                    Clear Tag Filter
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
                        {filteredPosts.map((post, index) => {
                            // FIX 4: Safety Check - Skip invalid posts inside loop
                            if (!post || !post.title) return null;

                            return (
                                <article key={post.id || index} onClick={() => handlePostClick(post)} className="bg-white rounded-3xl shadow-xl overflow-hidden cursor-pointer transform hover:scale-[1.03] transition-all duration-300 hover:shadow-2xl group flex flex-col h-full ring-1 ring-blue-50" style={{ animationDelay: `${index * 50}ms` }}>
                                    {post.featured_image && (
                                        <div className="relative h-56 overflow-hidden">
                                            <img src={post.featured_image} alt={post.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-blue-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <button onClick={(e) => handleCopyLink(e, post.slug || post.id)} className="absolute top-4 right-4 p-2.5 bg-white/95 hover:bg-white text-blue-600 rounded-full shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 z-10" title="Copy Link"><Share2 className="w-5 h-5" /></button>
                                        </div>
                                    )}
                                    <div className="p-8 flex flex-col flex-grow">
                                        <div className="flex gap-2 mb-4">
                                            {post.tags?.slice(0, 2).map((tag, i) => (
                                                <span key={i} className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 bg-blue-50 text-blue-600 rounded-md ring-1 ring-blue-100">{tag}</span>
                                            ))}
                                        </div>
                                        <h2 className="text-2xl font-extrabold text-blue-900 mb-4 group-hover:text-blue-700 transition-colors line-clamp-2 leading-tight">{post.title}</h2>
                                        <p className="text-blue-700 mb-6 line-clamp-3 leading-relaxed font-medium">{post.excerpt}</p>
                                        <div className="mt-auto flex items-center justify-between text-xs font-bold text-blue-500/80 border-t border-blue-50 pt-6">
                                            <div className="flex items-center space-x-2"><Calendar className="w-4 h-4" /> <span>{formatDate(post.published_at)}</span></div>
                                            <div className="flex items-center space-x-2"><Eye className="w-4 h-4" /> <span>{post.view_count} views</span></div>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-blue-50/50 pt-28">
            {renderContent()}
        </div>
    );
};