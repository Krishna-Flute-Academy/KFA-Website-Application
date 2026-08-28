'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, User, Eye, Tag, ArrowLeft, Share2 } from 'lucide-react';
import Link from 'next/link';
import { supabase, BlogPost } from '../../../src/lib/supabase';
import { sanitizeHtml } from '../../../src/lib/text-utils';
import ReadingProgressBar from '../../../src/components/ReadingProgressBar';
import TableOfContents from '../../../src/components/TableOfContents';

interface ClientBlogPostProps {
    post: BlogPost;
}

export default function ClientBlogPost({ post: initialPost }: ClientBlogPostProps) {
    const [post, setPost] = useState<BlogPost>(initialPost);

    useEffect(() => {
        // Increment view count on mount
        const incrementViewCount = async () => {
            if (post?.id) {
                try {
                    const { data: current } = await supabase
                        .from('blog_posts')
                        .select('view_count')
                        .eq('id', post.id)
                        .single();

                    if (current) {
                        const newCount = (current.view_count || 0) + 1;
                        await supabase
                            .from('blog_posts')
                            .update({ view_count: newCount })
                            .eq('id', post.id);

                        setPost(prev => ({ ...prev, view_count: newCount }));
                    }
                } catch (error) {
                    console.error('Error updating view count:', error);
                }
            }
        };

        incrementViewCount();
    }, [post?.id]);

    const handleCopyLink = (e: React.MouseEvent) => {
        e.stopPropagation();
        const url = `${window.location.origin}/blog/${post?.slug || post?.id}`;
        navigator.clipboard.writeText(url).then(() => {
            alert("Link copied to clipboard!");
        });
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Not published';
        return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    if (!post) {
        return null;
    }

    // We process the HTML to add IDs to headings for the Table of Contents.
    // To avoid hydration mismatches, we only do this after the initial render on the client side.
    const [processedContent, setProcessedContent] = useState<string>('');

    useEffect(() => {
        if (!post?.content || typeof window === 'undefined') return;

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(post.content, 'text/html');
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
    }, [post?.content]);

    // Fallback to raw post content if processing hasn't finished yet
    const displayContent = processedContent || post?.content || '';

    return (
        <div className="min-h-screen py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-blue-50/50 pt-28">
            <ReadingProgressBar />

            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-10 lg:items-start">

                {/* Sidebar - Table of Contents (Mobile primary, Desktop right sidebar) */}
                <aside className="w-full lg:w-1/4 flex-shrink-0 lg:order-last">
                    <TableOfContents contentHtml={displayContent} />
                </aside>

                {/* Main Content Column */}
                <div className="lg:w-3/4 max-w-4xl mx-auto lg:mx-0 flex-grow lg:order-first">
                    <Link href="/blog/" className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-800 mb-8 transition-colors group">
                        <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" /> <span>Back to all posts</span>
                    </Link>

                    <article className="bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {post?.featured_image && (
                            <img src={post.featured_image} alt={post.title} className="w-full h-80 md:h-96 object-cover" />
                        )}
                        <div className="p-6 md:p-8 lg:p-10">
                            <div className="flex justify-between items-start mb-6">
                                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-blue-900 leading-tight">
                                    {post?.title}
                                </h1>
                                <button onClick={handleCopyLink} className="p-2 ml-4 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors flex-shrink-0" title="Share link">
                                    <Share2 className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex flex-wrap gap-4 mb-8 text-blue-700 bg-blue-50/50 p-4 rounded-xl">
                                <div className="flex items-center gap-2"><User className="w-5 h-5 text-blue-500" /> <span className="font-medium">{post?.author_name || 'Admin'}</span></div>
                                <div className="flex items-center gap-2" suppressHydrationWarning>
                                    <Calendar className="w-5 h-5 text-blue-500" />
                                    <span suppressHydrationWarning>{formatDate(post?.published_at)}</span>
                                </div>
                                <div className="flex items-center gap-2"><Eye className="w-5 h-5 text-blue-500" /> <span>{post?.view_count || 0} views</span></div>
                            </div>

                            {post?.tags?.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-8">
                                    {post.tags.map((tag, i) => (
                                        <span key={i} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex items-center gap-1">
                                            <Tag className="w-3 h-3" /> {tag}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Prose Container with Fluid Typography */}
                            <div className="overflow-x-auto w-full bg-white">
                                <div
                                    className="prose prose-blue max-w-none text-blue-800/90 tiptap prose-styles-preserved
                                    text-[clamp(1rem,0.95rem+0.25vw,1.125rem)] leading-relaxed
                                    [&_strong]:text-blue-900 [&_b]:text-blue-900 
                                    [&_h1]:text-blue-950 [&_h2]:text-blue-950 [&_h3]:text-blue-950 
                                    [&_img]:rounded-xl [&_img]:shadow-md
                                    [&_table]:block [&_table]:overflow-x-auto [&_table]:whitespace-nowrap [&_table]:w-full [&_table]:border-collapse [&_th]:bg-blue-50 [&_th]:p-3 [&_td]:p-3 [&_td]:border [&_th]:border [&_th]:min-w-[120px] [&_td]:min-w-[120px] [&_td]:border-blue-200 [&_th]:border-blue-200
                                    [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&_li::marker]:text-blue-600
                                    "
                                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(displayContent) }}
                                />
                            </div>
                        </div>
                    </article>
                </div>
            </div>
        </div>
    );
}
