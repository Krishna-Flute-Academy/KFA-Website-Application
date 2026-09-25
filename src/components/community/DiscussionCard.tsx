'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
    MessageSquare, Eye, ThumbsUp, CheckCircle, 
    Pin, Lock, Share2, Sparkles, GraduationCap 
} from 'lucide-react';
import { CommunityPost, toggleCommunityReaction, isContentEdited } from '../../lib/community';
import { htmlToPlainText, truncatePlainText } from '../../lib/text-utils';

interface DiscussionCardProps {
    post: CommunityPost;
    currentUserId?: string | null;
    onUpvoteToggle?: (postId: string, hasUpvoted: boolean) => void;
}

export function formatRelativeTime(dateString: string): string {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'Recently';

    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;

    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DiscussionCard({ post, currentUserId, onUpvoteToggle }: DiscussionCardProps) {
    const [upvoted, setUpvoted] = useState(post.has_upvoted || false);
    const [upvoteCount, setUpvoteCount] = useState(post.upvotes_count || 0);
    const [copyNotification, setCopyNotification] = useState(false);
    const [isUpvoting, setIsUpvoting] = useState(false);

    const handleUpvote = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!currentUserId) {
            alert('Please log in with your KFA account to upvote discussions.');
            return;
        }

        if (isUpvoting) return;
        setIsUpvoting(true);

        const nextState = !upvoted;
        setUpvoted(nextState);
        setUpvoteCount(prev => (nextState ? prev + 1 : Math.max(0, prev - 1)));

        const res = await toggleCommunityReaction({
            userId: currentUserId,
            postId: post.id
        });

        if (res.success) {
            if (onUpvoteToggle) onUpvoteToggle(post.id, res.hasUpvoted);
        } else {
            // Revert on failure
            setUpvoted(!nextState);
            setUpvoteCount(prev => (!nextState ? prev + 1 : Math.max(0, prev - 1)));
        }
        setIsUpvoting(false);
    };

    const handleShare = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const url = `${window.location.origin}/community/discussion/${post.slug}`;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(() => {
                setCopyNotification(true);
                setTimeout(() => setCopyNotification(false), 2000);
            });
        }
    };

    const plainTextExcerpt = truncatePlainText(post.content, 180);
    const isStudentOnly = post.visibility === 'students' || post.category?.access_scope === 'students';

    // Badge styling
    const renderBadge = () => {
        const badge = post.author?.badge;
        if (!badge) return null;

        if (badge === 'Teacher') {
            return (
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-200">
                    <GraduationCap className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                    Teacher
                </span>
            );
        }
        if (badge === 'Admin') {
            return (
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200">
                    Admin
                </span>
            );
        }
        if (badge === 'KFA Student') {
            return (
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300">
                    KFA Student
                </span>
            );
        }
        return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Community Member
            </span>
        );
    };

    return (
        <article className="relative bg-white dark:bg-[#1a140e] border border-amber-900/10 dark:border-amber-500/10 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 group">
            {/* Top Bar: Category, Access Scope, Pinned / Solved status */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                    {post.category && (
                        <Link
                            href={`/community/${post.category.slug}`}
                            className="text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 px-2.5 py-1 rounded-lg transition-colors"
                        >
                            {post.category.name}
                        </Link>
                    )}

                    {isStudentOnly && (
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> Students Only
                        </span>
                    )}

                    {post.is_pinned && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-900 dark:text-amber-200 flex items-center gap-1">
                            <Pin className="w-3 h-3 text-amber-600" /> Pinned
                        </span>
                    )}

                    {post.accepted_reply_id && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-emerald-600" /> Solved
                        </span>
                    )}

                    {post.is_locked && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> Locked
                        </span>
                    )}
                </div>

                {/* Share Link Button */}
                <button
                    onClick={handleShare}
                    className="text-slate-400 hover:text-amber-700 dark:hover:text-amber-400 p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors relative"
                    title="Copy discussion link"
                    aria-label="Share discussion"
                >
                    <Share2 className="w-4 h-4" />
                    {copyNotification && (
                        <span className="absolute -top-7 right-0 text-[10px] font-bold bg-slate-900 text-white px-2 py-0.5 rounded-md whitespace-nowrap shadow-md">
                            Copied!
                        </span>
                    )}
                </button>
            </div>

            {/* Post Title */}
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-800 dark:group-hover:text-amber-300 transition-colors leading-snug mb-1.5">
                <Link href={`/community/discussion/${post.slug}`} className="focus:outline-none">
                    {post.title}
                </Link>
            </h3>

            {/* Post Excerpt */}
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed mb-3 font-normal">
                {plainTextExcerpt}
            </p>

            {/* Footer: Author Info & Metrics */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-amber-900/10">
                {/* Author Info */}
                <div className="flex items-center gap-2">
                    {post.author?.avatar_url ? (
                        <img
                            src={post.author.avatar_url}
                            alt={post.author.display_name}
                            className="w-6 h-6 rounded-full object-cover border border-amber-200"
                        />
                    ) : (
                        <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-black text-[10px] flex items-center justify-center">
                            {post.author?.display_name?.charAt(0) || 'K'}
                        </div>
                    )}
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {post.author?.display_name}
                    </span>
                    {renderBadge()}
                    <span className="text-slate-300 dark:text-slate-600 text-xs">•</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {formatRelativeTime(post.created_at)}
                    </span>
                    {isContentEdited(post.created_at, post.updated_at) && (
                        <span 
                            className="text-[11px] text-slate-400 dark:text-slate-500 font-normal"
                            title={`Edited ${formatRelativeTime(post.updated_at)}`}
                        >
                            · Edited
                        </span>
                    )}
                </div>

                {/* Metrics & Upvote Button */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleUpvote}
                        className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg transition-colors ${
                            upvoted
                                ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200'
                                : 'text-slate-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-slate-800'
                        }`}
                        title={upvoted ? 'Remove upvote' : 'Upvote this discussion'}
                    >
                        <ThumbsUp className={`w-3.5 h-3.5 ${upvoted ? 'fill-current text-amber-700' : ''}`} />
                        <span>{upvoteCount}</span>
                    </button>

                    <Link
                        href={`/community/discussion/${post.slug}#replies`}
                        className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
                        title="View replies"
                    >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{post.replies_count || 0}</span>
                    </Link>

                    <span className="flex items-center gap-1 text-xs font-medium text-slate-400 dark:text-slate-500">
                        <Eye className="w-3.5 h-3.5" />
                        <span>{post.views_count || 0}</span>
                    </span>
                </div>
            </div>
        </article>
    );
}
