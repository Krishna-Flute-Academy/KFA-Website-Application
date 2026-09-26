'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
    ArrowLeft, MessageSquare, Eye, ThumbsUp, CheckCircle, 
    Pin, Lock, Share2, Sparkles, GraduationCap, Send, 
    AlertCircle, ShieldCheck, CornerDownRight, Check
} from 'lucide-react';
import CommunityNavbar from './CommunityNavbar';
import AcademyConversionBanner from './AcademyConversionBanner';
import EditPostModal from './EditPostModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import CommunityActionMenu from './CommunityActionMenu';
import { 
    CommunityPost, CommunityReply, CommunityCategory,
    CommunityPostType, getCommunityCategories,
    getCommunityPostBySlug, getCommunityReplies, 
    createCommunityReply, updateCommunityReply,
    deleteCommunityPost, deleteCommunityReply,
    toggleAcceptedAnswer, toggleCommunityReaction, 
    incrementPostView, isContentEdited, CommunityBadge 
} from '../../lib/community';
import { supabaseAuth } from '../../lib/supabase-auth';
import { sanitizeHtml, htmlToPlainText } from '../../lib/text-utils';
import { formatRelativeTime } from './DiscussionCard';

interface DiscussionDetailViewProps {
    slug: string;
}

export default function DiscussionDetailView({ slug }: DiscussionDetailViewProps) {
    const router = useRouter();
    const [post, setPost] = useState<CommunityPost | null>(null);
    const [replies, setReplies] = useState<CommunityReply[]>([]);
    const [categories, setCategories] = useState<CommunityCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Post edit & delete modal states
    const [isEditingPost, setIsEditingPost] = useState(false);
    const [isDeletingPost, setIsDeletingPost] = useState(false);
    const [isAdminDeletePost, setIsAdminDeletePost] = useState(false);

    // Reply inline edit & delete modal states
    const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
    const [editReplyText, setEditReplyText] = useState('');
    const [isSavingReply, setIsSavingReply] = useState(false);
    const [isDeletingReply, setIsDeletingReply] = useState(false);
    const [targetDeleteReplyId, setTargetDeleteReplyId] = useState<string | null>(null);
    const [isAdminDeleteReply, setIsAdminDeleteReply] = useState(false);

    // Auth state
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [currentUserName, setCurrentUserName] = useState<string>('');
    const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

    // Reply form state
    const [replyContent, setReplyContent] = useState('');
    const [isSubmittingReply, setIsSubmittingReply] = useState(false);
    const [replyError, setReplyError] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);

    // Interaction states
    const [postUpvoted, setPostUpvoted] = useState(false);
    const [postUpvotesCount, setPostUpvotesCount] = useState(0);
    const [copiedLink, setCopiedLink] = useState(false);
    const viewedPostIdRef = useRef<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const loadData = async () => {
            setLoading(true);
            setError(null);

            try {
                // Get auth session
                const { data: { session } } = await supabaseAuth.auth.getSession();
                let userId: string | null = null;
                let userRoleVal: string | null = null;

                if (session?.user) {
                    userId = session.user.id;
                    if (isMounted) {
                        setCurrentUser(session.user);
                        const fallbackName = session.user.user_metadata?.full_name || 
                                             session.user.user_metadata?.name || 
                                             session.user.email?.split('@')[0] || 'KFA Member';
                        setCurrentUserName(fallbackName);
                        setCurrentUserAvatar(session.user.user_metadata?.avatar_url || null);
                    }

                    // Look up role in public.users
                    const { data: uData } = await supabaseAuth
                        .from('users')
                        .select('name, role, profile_pic_url')
                        .eq('id', session.user.id)
                        .maybeSingle();

                    if (isMounted && uData) {
                        if (uData.name) setCurrentUserName(uData.name);
                        if (uData.role) {
                            userRoleVal = uData.role;
                            setCurrentUserRole(uData.role);
                        }
                        if (uData.profile_pic_url) setCurrentUserAvatar(uData.profile_pic_url);
                    } else if (isMounted) {
                        // Check community_profiles for external community members
                        const { data: cData } = await supabaseAuth
                            .from('community_profiles')
                            .select('display_name, avatar_url')
                            .eq('id', session.user.id)
                            .maybeSingle();
                        if (cData) {
                            if (cData.display_name) setCurrentUserName(cData.display_name);
                            if (cData.avatar_url) setCurrentUserAvatar(cData.avatar_url);
                        }
                    }
                }

                // Fetch post & replies
                const postData = await getCommunityPostBySlug(slug, userId);
                if (!isMounted) return;

                if (!postData) {
                    setError('Discussion not found or you do not have permission to view it.');
                    setLoading(false);
                    return;
                }

                setPost(postData);
                setPostUpvoted(postData.has_upvoted || false);
                setPostUpvotesCount(postData.upvotes_count || 0);

                // Count one completed, intentional detail-page open. The ref prevents
                // duplicate increments from React effect re-runs for this same open.
                if (viewedPostIdRef.current !== postData.id) {
                    viewedPostIdRef.current = postData.id;
                    const incremented = await incrementPostView(postData.id);
                    if (incremented && isMounted) {
                        setPost(current => current?.id === postData.id
                            ? { ...current, views_count: (current.views_count || 0) + 1 }
                            : current
                        );
                    }
                }

                // Load replies
                const repliesData = await getCommunityReplies(postData.id, userId);
                if (isMounted) {
                    setReplies(repliesData);
                }

                // Load categories for post edit modal
                const cats = await getCommunityCategories();
                if (isMounted) {
                    setCategories(cats);
                }
            } catch (err: any) {
                console.error('[Community] Discussion load error:', err);
                if (isMounted) setError('Failed to load discussion.');
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadData();
        return () => { isMounted = false; };
    }, [slug]);

    // Handle post upvote
    const handleTogglePostUpvote = async () => {
        if (!currentUser || !post) {
            alert('Please log in with your KFA account to upvote discussions.');
            return;
        }

        const nextState = !postUpvoted;
        setPostUpvoted(nextState);
        setPostUpvotesCount(prev => (nextState ? prev + 1 : Math.max(0, prev - 1)));

        const res = await toggleCommunityReaction({
            userId: currentUser.id,
            postId: post.id
        });

        if (!res.success) {
            setPostUpvoted(!nextState);
            setPostUpvotesCount(prev => (!nextState ? prev + 1 : Math.max(0, prev - 1)));
        }
    };

    // Handle reply upvote
    const handleToggleReplyUpvote = async (replyId: string, currentUpvoted: boolean) => {
        if (!currentUser) {
            alert('Please log in with your KFA account to upvote replies.');
            return;
        }

        const nextState = !currentUpvoted;
        setReplies(prev => prev.map(r => {
            if (r.id === replyId) {
                return {
                    ...r,
                    has_upvoted: nextState,
                    upvotes_count: nextState ? r.upvotes_count + 1 : Math.max(0, r.upvotes_count - 1)
                };
            }
            return r;
        }));

        const res = await toggleCommunityReaction({
            userId: currentUser.id,
            replyId
        });

        if (!res.success) {
            // Revert
            setReplies(prev => prev.map(r => {
                if (r.id === replyId) {
                    return {
                        ...r,
                        has_upvoted: currentUpvoted,
                        upvotes_count: currentUpvoted ? r.upvotes_count + 1 : Math.max(0, r.upvotes_count - 1)
                    };
                }
                return r;
            }));
        }
    };

    // Handle toggle accepted answer
    const handleToggleAccepted = async (replyId: string, currentAccepted: boolean) => {
        if (!post) return;
        const canAccept = currentUser?.id === post.author_id || 
                          currentUserRole === 'admin' || 
                          currentUserRole === 'teacher';

        if (!canAccept) {
            alert('Only the post author, teachers, or admins can mark the accepted answer.');
            return;
        }

        const res = await toggleAcceptedAnswer(post.id, replyId, currentAccepted);
        if (res.success) {
            const newStatus = !currentAccepted;
            setPost(prev => prev ? {
                ...prev,
                accepted_reply_id: newStatus ? replyId : null
            } : null);

            setReplies(prev => prev.map(r => ({
                ...r,
                is_accepted: r.id === replyId ? newStatus : false
            })));
        } else {
            alert(res.error || 'Failed to update accepted answer.');
        }
    };

    // Submit new reply
    const handleSubmitReply = async (e: React.FormEvent) => {
        e.preventDefault();
        setReplyError(null);

        if (!currentUser || !post) return;
        if (!replyContent.trim()) {
            setReplyError('Please write your reply before submitting.');
            return;
        }

        setIsSubmittingReply(true);
        try {
            const res = await createCommunityReply({
                postId: post.id,
                content: replyContent,
                authorId: currentUser.id,
                authorName: currentUserName,
                authorAvatar: currentUserAvatar
            });

            if (res.success && res.reply) {
                const newReply: CommunityReply = {
                    ...res.reply,
                    author: {
                        id: currentUser.id,
                        display_name: currentUserName,
                        avatar_url: currentUserAvatar,
                        badge: currentUserRole === 'admin' ? 'Admin' : 
                               currentUserRole === 'teacher' ? 'Teacher' : 'KFA Student'
                    },
                    has_upvoted: false
                };

                setReplies(prev => [...prev, newReply]);
                setPost(prev => prev ? { ...prev, replies_count: (prev.replies_count || 0) + 1 } : null);
                setReplyContent('');
                setShowPreview(false);
            } else {
                setReplyError(res.error || 'Failed to submit reply.');
            }
        } catch (err: any) {
            setReplyError(err.message || 'An error occurred.');
        } finally {
            setIsSubmittingReply(false);
        }
    };

    const handleCopyShare = () => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(window.location.href).then(() => {
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
            });
        }
    };

    // Handle post edited
    const handlePostSaved = (updated: {
        title: string;
        content: string;
        categoryId: string;
        postType: CommunityPostType;
        category?: CommunityCategory;
    }) => {
        setPost(prev => prev ? {
            ...prev,
            title: updated.title,
            content: updated.content,
            category_id: updated.categoryId,
            post_type: updated.postType,
            category: updated.category || prev.category,
            updated_at: new Date().toISOString()
        } : null);
    };

    // Handle post delete confirmation
    const handleConfirmDeletePost = async (reason?: string) => {
        if (!post) return;
        const res = await deleteCommunityPost({
            postId: post.id,
            reason
        });
        if (res.success) {
            router.push('/community');
        } else {
            alert(res.error || 'Failed to delete discussion.');
        }
    };

    // Start inline reply edit
    const startEditReply = (reply: CommunityReply) => {
        setEditingReplyId(reply.id);
        const raw = (reply.content || '')
            .replace(/<br\s*[\/]?>/gi, '\n')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"');
        setEditReplyText(raw);
    };

    // Save inline reply edit
    const handleSaveEditReply = async (replyId: string) => {
        if (!editReplyText.trim()) return;
        setIsSavingReply(true);
        try {
            const htmlContent = editReplyText.replace(/\n/g, '<br/>');
            const res = await updateCommunityReply({
                replyId,
                content: htmlContent
            });
            if (res.success) {
                setReplies(prev => prev.map(r => r.id === replyId ? {
                    ...r,
                    content: htmlContent,
                    updated_at: new Date().toISOString()
                } : r));
                setEditingReplyId(null);
                setEditReplyText('');
            } else {
                alert(res.error || 'Failed to update reply.');
            }
        } finally {
            setIsSavingReply(false);
        }
    };

    // Handle reply delete confirmation
    const handleConfirmDeleteReply = async (reason?: string) => {
        if (!targetDeleteReplyId) return;
        const res = await deleteCommunityReply({
            replyId: targetDeleteReplyId,
            reason
        });
        if (res.success) {
            setReplies(prev => prev.map(r => r.id === targetDeleteReplyId ? {
                ...r,
                is_deleted: true,
                content: '',
                author: { ...r.author, display_name: 'Removed' }
            } : r));
            setPost(prev => prev ? {
                ...prev,
                replies_count: Math.max(0, (prev.replies_count || 1) - 1)
            } : null);
            setIsDeletingReply(false);
            setTargetDeleteReplyId(null);
        } else {
            alert(res.error || 'Failed to delete reply.');
        }
    };

    // Badge styling helper
    const renderBadge = (badge?: CommunityBadge) => {
        if (!badge) return null;
        if (badge === 'Teacher') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-200">
                    <GraduationCap className="w-3.5 h-3.5 text-amber-700" />
                    Teacher
                </span>
            );
        }
        if (badge === 'Admin') {
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                    Admin
                </span>
            );
        }
        if (badge === 'KFA Student') {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300">
                    KFA Student
                </span>
            );
        }
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Community Member
            </span>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#faf8f5] dark:bg-[#120d09] text-slate-900 dark:text-slate-100 flex flex-col font-sans">
                <CommunityNavbar />
                <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4 flex-1 flex flex-col justify-center items-center">
                    <div className="w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-bold text-slate-500">Loading discussion...</p>
                </div>
            </div>
        );
    }

    if (error || !post || post.is_deleted) {
        return (
            <div className="min-h-screen bg-[#faf8f5] dark:bg-[#120d09] text-slate-900 dark:text-slate-100 flex flex-col font-sans">
                <CommunityNavbar />
                <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4 flex-1 flex flex-col justify-center items-center">
                    <div className="w-14 h-14 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded-2xl flex items-center justify-center">
                        <AlertCircle className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        {post?.is_deleted ? 'Discussion Removed' : 'Discussion Unavailable'}
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        {post?.is_deleted
                            ? 'This discussion has been deleted or removed by community moderation.'
                            : error || 'This discussion may be private or restricted to enrolled KFA students.'}
                    </p>
                    <Link
                        href="/community"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#a15912] text-white font-bold text-sm rounded-xl shadow-xs"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Community
                    </Link>
                </div>
            </div>
        );
    }

    const canManageAccepted = currentUser?.id === post.author_id || 
                              currentUserRole === 'admin' || 
                              currentUserRole === 'teacher';

    return (
        <div className="min-h-screen bg-[#faf8f5] dark:bg-[#120d09] text-slate-900 dark:text-slate-100 flex flex-col font-sans">
            <CommunityNavbar />

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
                {/* Breadcrumbs & Back Navigation */}
                <div className="flex items-center justify-between gap-4">
                    <Link
                        href="/community"
                        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-amber-800 dark:text-amber-400 hover:underline"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to all discussions
                    </Link>

                    {post.category && (
                        <Link
                            href={`/community/${post.category.slug}`}
                            className="text-xs font-bold px-3 py-1 bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 rounded-lg hover:bg-amber-200/80 transition-colors"
                        >
                            {post.category.name}
                        </Link>
                    )}
                </div>

                {/* Primary Post Article Card */}
                <article className="bg-white dark:bg-[#1a140e] border border-amber-900/10 dark:border-amber-500/10 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                    {/* Header info */}
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                            {post.visibility === 'students' && (
                                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                                    <Lock className="w-2.5 h-2.5" /> Students Only
                                </span>
                            )}
                            {post.is_pinned && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-900 dark:text-amber-200 flex items-center gap-1">
                                    <Pin className="w-3 h-3 text-amber-600" /> Pinned
                                </span>
                            )}
                            {post.accepted_reply_id && (
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3 text-emerald-600" /> Solved
                                </span>
                            )}
                            {post.is_locked && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 flex items-center gap-1">
                                    <Lock className="w-2.5 h-2.5" /> Locked
                                </span>
                            )}
                        </div>

                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                            {post.title}
                        </h1>

                        {/* Author metadata bar */}
                        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-b border-slate-100 dark:border-amber-900/10 pb-4">
                            <div className="flex items-center gap-3">
                                {post.author?.avatar_url ? (
                                    <img
                                        src={post.author.avatar_url}
                                        alt={post.author.display_name}
                                        className="w-10 h-10 rounded-full object-cover border border-amber-300"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 font-extrabold text-sm flex items-center justify-center">
                                        {post.author?.display_name?.charAt(0) || 'K'}
                                    </div>
                                )}
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                            {post.author?.display_name}
                                        </span>
                                        {renderBadge(post.author?.badge)}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                        <span>Asked {formatRelativeTime(post.created_at)}</span>
                                        {isContentEdited(post.created_at, post.updated_at) && (
                                            <span 
                                                className="text-[11px] text-slate-400 dark:text-slate-500 font-normal"
                                                title={`Edited ${formatRelativeTime(post.updated_at)}`}
                                            >
                                                · Edited
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 sm:gap-3">
                                <button
                                    onClick={handleCopyShare}
                                    className="p-2 text-slate-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-xl transition-colors relative"
                                    title="Share link"
                                >
                                    <Share2 className="w-4 h-4" />
                                    {copiedLink && (
                                        <span className="absolute -top-7 right-0 text-[10px] font-bold bg-slate-900 text-white px-2 py-0.5 rounded-md shadow-md whitespace-nowrap">
                                            Link Copied!
                                        </span>
                                    )}
                                </button>
                                <span className="flex items-center gap-1 text-xs text-slate-400">
                                    <Eye className="w-4 h-4" /> {post.views_count || 0} views
                                </span>
                                <CommunityActionMenu
                                    isAuthor={currentUser?.id === post.author_id}
                                    isAdmin={currentUserRole === 'admin'}
                                    itemType="post"
                                    onEdit={() => setIsEditingPost(true)}
                                    onDelete={(isAdminDel) => {
                                        setIsAdminDeletePost(isAdminDel);
                                        setIsDeletingPost(true);
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Post Content Body */}
                    <div 
                        className="prose dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 text-base leading-relaxed break-words"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
                    />

                    {/* Post Reaction Action Bar */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-amber-900/10">
                        <button
                            onClick={handleTogglePostUpvote}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                                postUpvoted
                                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 shadow-2xs'
                                    : 'bg-slate-50 text-slate-700 hover:bg-amber-50 hover:text-amber-800 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                        >
                            <ThumbsUp className={`w-4 h-4 ${postUpvoted ? 'fill-current text-amber-700' : ''}`} />
                            <span>{postUpvotesCount} Upvotes</span>
                        </button>

                        <div className="text-xs font-semibold text-slate-500">
                            {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
                        </div>
                    </div>
                </article>

                {/* Replies Section */}
                <section id="replies" className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-amber-700" />
                            <span>Answers & Discussion</span>
                            <span className="text-sm font-bold text-slate-400">({replies.length})</span>
                        </h2>
                    </div>

                    {replies.length === 0 ? (
                        <div className="bg-white dark:bg-[#1a140e] rounded-2xl p-8 text-center border border-dashed border-amber-900/15 dark:border-amber-500/15">
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                No replies yet. Be the first to share an answer or perspective!
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {replies.map((reply) => {
                                if (reply.is_deleted) {
                                    return (
                                        <div
                                            key={reply.id}
                                            className="bg-slate-50/70 dark:bg-slate-900/40 rounded-2xl p-4 sm:p-5 border border-dashed border-slate-200 dark:border-slate-800"
                                        >
                                            <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 italic">
                                                This reply has been removed.
                                            </p>
                                        </div>
                                    );
                                }

                                const isTeacherAnswer = reply.author?.badge === 'Teacher' || reply.author?.badge === 'Admin';
                                const isAccepted = reply.is_accepted;
                                const isEditingThisReply = editingReplyId === reply.id;

                                return (
                                    <div
                                        key={reply.id}
                                        className={`bg-white dark:bg-[#1a140e] rounded-3xl p-5 sm:p-6 transition-all ${
                                            isAccepted
                                                ? 'border-2 border-emerald-500/70 shadow-md ring-1 ring-emerald-500/20'
                                                : isTeacherAnswer
                                                ? 'border border-amber-500/40 shadow-xs bg-amber-50/20 dark:bg-amber-950/20'
                                                : 'border border-amber-900/10 dark:border-amber-500/10 shadow-xs'
                                        }`}
                                    >
                                        {/* Status Header for Accepted Answer or Teacher Answer */}
                                        {(isAccepted || isTeacherAnswer) && (
                                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                                                {isAccepted && (
                                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                                                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Accepted Answer ✓
                                                    </span>
                                                )}
                                                {isTeacherAnswer && (
                                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                                                        <GraduationCap className="w-3.5 h-3.5 text-amber-700" /> Teacher Answer
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Reply Author info */}
                                        <div className="flex items-center justify-between gap-4 mb-3">
                                            <div className="flex items-center gap-3">
                                                {reply.author?.avatar_url ? (
                                                    <img
                                                        src={reply.author.avatar_url}
                                                        alt={reply.author.display_name}
                                                        className="w-8 h-8 rounded-full object-cover border border-amber-200"
                                                    />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 font-extrabold text-xs flex items-center justify-center">
                                                        {reply.author?.display_name?.charAt(0) || 'K'}
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                                                            {reply.author?.display_name}
                                                        </span>
                                                        {renderBadge(reply.author?.badge)}
                                                    </div>
                                                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                                        <span>{formatRelativeTime(reply.created_at)}</span>
                                                        {isContentEdited(reply.created_at, reply.updated_at) && (
                                                            <span 
                                                                className="text-slate-400 dark:text-slate-500 font-normal"
                                                                title={`Edited ${formatRelativeTime(reply.updated_at)}`}
                                                            >
                                                                · Edited
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Reply Action Buttons */}
                                            <div className="flex items-center gap-1.5">
                                                {canManageAccepted && (
                                                    <button
                                                        onClick={() => handleToggleAccepted(reply.id, reply.is_accepted)}
                                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                                            reply.is_accepted
                                                                ? 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                                                                : 'text-slate-500 hover:text-emerald-700 hover:bg-emerald-50'
                                                        }`}
                                                        title={reply.is_accepted ? 'Unmark accepted' : 'Mark as accepted answer'}
                                                    >
                                                        <Check className="w-3.5 h-3.5" />
                                                        <span>{reply.is_accepted ? 'Accepted' : 'Mark Accepted'}</span>
                                                    </button>
                                                )}

                                                <CommunityActionMenu
                                                    isAuthor={currentUser?.id === reply.author_id}
                                                    isAdmin={currentUserRole === 'admin'}
                                                    itemType="reply"
                                                    onEdit={() => startEditReply(reply)}
                                                    onDelete={(isAdminDel) => {
                                                        setTargetDeleteReplyId(reply.id);
                                                        setIsAdminDeleteReply(isAdminDel);
                                                        setIsDeletingReply(true);
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        {/* Reply Content or Inline Edit Box */}
                                        {isEditingThisReply ? (
                                            <div className="my-3 space-y-3">
                                                <textarea
                                                    value={editReplyText}
                                                    onChange={(e) => setEditReplyText(e.target.value)}
                                                    rows={4}
                                                    className="w-full p-3.5 rounded-2xl bg-[#faf8f5] dark:bg-[#120d09] border border-amber-900/15 dark:border-amber-500/20 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-all resize-y"
                                                />
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingReplyId(null);
                                                            setEditReplyText('');
                                                        }}
                                                        disabled={isSavingReply}
                                                        className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSaveEditReply(reply.id)}
                                                        disabled={isSavingReply || !editReplyText.trim()}
                                                        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#a15912] hover:bg-[#8a4b0f] text-white text-xs font-bold rounded-xl shadow-2xs transition-all disabled:opacity-50"
                                                    >
                                                        {isSavingReply ? 'Saving...' : 'Save'}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Reply Content Body */}
                                                <div 
                                                    className="prose dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 text-sm leading-relaxed mb-4"
                                                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(reply.content) }}
                                                />

                                                {/* Reply Footer: Upvote action */}
                                                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-50 dark:border-slate-850">
                                                    <button
                                                        onClick={() => handleToggleReplyUpvote(reply.id, reply.has_upvoted || false)}
                                                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                                            reply.has_upvoted
                                                                ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200'
                                                                : 'text-slate-500 hover:text-amber-800 hover:bg-amber-50 dark:hover:bg-slate-800'
                                                        }`}
                                                    >
                                                        <ThumbsUp className={`w-3.5 h-3.5 ${reply.has_upvoted ? 'fill-current text-amber-700' : ''}`} />
                                                        <span>{reply.upvotes_count || 0}</span>
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Reply Form or Login Callout */}
                <div className="bg-white dark:bg-[#1a140e] border border-amber-900/10 dark:border-amber-500/10 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        Leave a Reply
                    </h3>

                    {post.is_locked ? (
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-center text-xs sm:text-sm text-slate-600 dark:text-slate-300 flex items-center justify-center gap-2 font-medium">
                            <Lock className="w-4 h-4 text-slate-400" />
                            <span>This discussion has been locked by a moderator and cannot receive new replies.</span>
                        </div>
                    ) : currentUser ? (
                        <form onSubmit={handleSubmitReply} className="space-y-4">
                            {replyError && (
                                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{replyError}</span>
                                </div>
                            )}

                            {/* Format guidance and Preview toggle */}
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>Supports paragraphs, formatting, and notation notes</span>
                                <button
                                    type="button"
                                    onClick={() => setShowPreview(!showPreview)}
                                    className="font-bold text-amber-800 dark:text-amber-400 hover:underline"
                                >
                                    {showPreview ? 'Edit Message' : 'Preview Format'}
                                </button>
                            </div>

                            {showPreview ? (
                                <div className="min-h-[140px] p-4 bg-amber-50/30 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl text-sm prose dark:prose-invert max-w-none">
                                    {replyContent.trim() ? (
                                        <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(replyContent.replace(/\n/g, '<br/>')) }} />
                                    ) : (
                                        <p className="text-slate-400 italic">No content to preview.</p>
                                    )}
                                </div>
                            ) : (
                                <textarea
                                    value={replyContent}
                                    onChange={(e) => setReplyContent(e.target.value)}
                                    rows={5}
                                    placeholder="Write your constructive reply, answer, or musical observation..."
                                    className="w-full p-4 rounded-2xl bg-[#faf8f5] dark:bg-[#120d09] border border-amber-900/15 dark:border-amber-500/20 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-all resize-y"
                                />
                            )}

                            <div className="flex items-center justify-between pt-2">
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <span>Replying as</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{currentUserName}</span>
                                    {renderBadge(currentUserRole === 'admin' ? 'Admin' : currentUserRole === 'teacher' ? 'Teacher' : (currentUserRole === 'student' || currentUserRole === 'mentor') ? 'KFA Student' : 'Community Member')}
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmittingReply || !replyContent.trim()}
                                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#a15912] hover:bg-[#8a4b0f] text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all disabled:opacity-50"
                                >
                                    {isSubmittingReply ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            <span>Posting...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-3.5 h-3.5" />
                                            <span>Post Reply</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="p-6 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-900/10 dark:border-amber-500/10 rounded-2xl text-center space-y-3">
                            <h4 className="text-sm font-extrabold text-amber-950 dark:text-amber-200">
                                Join the Discussion
                            </h4>
                            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                                Share your insights, ask follow-up questions, and learn together with fellow flute enthusiasts and mentors.
                            </p>
                            <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                                <Link
                                    href={`/community/join?redirect=${encodeURIComponent(`/community/discussion/${post.slug}`)}`}
                                    className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#a15912] hover:bg-[#8a4b0f] text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                                >
                                    Join Community (Free)
                                </Link>
                                <Link
                                    href={`/login?redirect=${encodeURIComponent(`/community/discussion/${post.slug}`)}`}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-amber-850/30 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-bold rounded-xl hover:bg-amber-100/50 transition-all"
                                >
                                    Sign In
                                </Link>
                            </div>
                        </div>
                    )}
                </div>

                {/* Academy Course Conversion Banner */}
                <AcademyConversionBanner />

                {/* Edit Post Modal */}
                {post && (
                    <EditPostModal
                        isOpen={isEditingPost}
                        post={post}
                        categories={categories}
                        onClose={() => setIsEditingPost(false)}
                        onSaved={handlePostSaved}
                    />
                )}

                {/* Delete Post Modal */}
                <DeleteConfirmModal
                    isOpen={isDeletingPost}
                    itemType="post"
                    isAdminAction={isAdminDeletePost}
                    onClose={() => {
                        setIsDeletingPost(false);
                        setIsAdminDeletePost(false);
                    }}
                    onConfirm={handleConfirmDeletePost}
                />

                {/* Delete Reply Modal */}
                <DeleteConfirmModal
                    isOpen={isDeletingReply}
                    itemType="reply"
                    isAdminAction={isAdminDeleteReply}
                    onClose={() => {
                        setIsDeletingReply(false);
                        setTargetDeleteReplyId(null);
                        setIsAdminDeleteReply(false);
                    }}
                    onConfirm={handleConfirmDeleteReply}
                />
            </main>
        </div>
    );
}
