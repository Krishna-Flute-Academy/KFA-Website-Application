'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, ThumbsUp, GraduationCap, ShieldCheck, Heart, Loader2 } from 'lucide-react';
import { ReactionUser, getCommunityReactionUsers, CommunityBadge } from '../../lib/community';
import { formatRelativeTime } from './DiscussionCard';

interface ReactionUsersModalProps {
    isOpen: boolean;
    onClose: () => void;
    postId?: string;
    replyId?: string;
    title?: string;
    reactionCount?: number;
}

export default function ReactionUsersModal({
    isOpen,
    onClose,
    postId,
    replyId,
    title = 'Reactions',
    reactionCount
}: ReactionUsersModalProps) {
    const [users, setUsers] = useState<ReactionUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [totalCount, setTotalCount] = useState<number>(reactionCount || 0);
    const [hasMore, setHasMore] = useState(false);
    const [offset, setOffset] = useState(0);
    const modalRef = useRef<HTMLDivElement>(null);

    const PAGE_SIZE = 20;

    // Fetch initial reactions
    useEffect(() => {
        if (!isOpen || (!postId && !replyId)) return;

        let isMounted = true;
        setLoading(true);
        setOffset(0);

        getCommunityReactionUsers({
            postId,
            replyId,
            limit: PAGE_SIZE,
            offset: 0
        }).then(res => {
            if (isMounted) {
                setUsers(res.users);
                setTotalCount(res.totalCount || reactionCount || 0);
                setHasMore(res.hasMore);
                setLoading(false);
            }
        }).catch(err => {
            console.warn('[ReactionUsersModal] Error fetching reaction users:', err);
            if (isMounted) {
                setUsers([]);
                setLoading(false);
            }
        });

        return () => {
            isMounted = false;
        };
    }, [isOpen, postId, replyId, reactionCount]);

    // Handle Esc key to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const handleLoadMore = async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);

        const nextOffset = offset + PAGE_SIZE;
        try {
            const res = await getCommunityReactionUsers({
                postId,
                replyId,
                limit: PAGE_SIZE,
                offset: nextOffset
            });
            setUsers(prev => [...prev, ...res.users]);
            setHasMore(res.hasMore);
            setOffset(nextOffset);
        } catch (e) {
            console.warn('[ReactionUsersModal] Error loading more:', e);
        } finally {
            setLoadingMore(false);
        }
    };

    if (!isOpen) return null;

    const renderBadge = (badge: CommunityBadge) => {
        if (badge === 'Teacher') {
            return (
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 shrink-0">
                    <GraduationCap className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                    Teacher
                </span>
            );
        }
        if (badge === 'Admin') {
            return (
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 shrink-0">
                    <ShieldCheck className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                    Admin
                </span>
            );
        }
        if (badge === 'KFA Student') {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 shrink-0">
                    KFA Student
                </span>
            );
        }
        return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 shrink-0">
                Community Member
            </span>
        );
    };

    return (
        <div 
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reactions-modal-title"
        >
            <div 
                ref={modalRef}
                className="w-full sm:max-w-md bg-white dark:bg-[#1a140e] rounded-t-3xl sm:rounded-3xl border border-amber-900/10 dark:border-amber-500/15 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[80vh] animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
            >
                {/* Mobile Drag Indicator */}
                <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 sm:hidden shrink-0" />

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-amber-900/10 dark:border-amber-500/10">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-800 dark:text-amber-300">
                            <ThumbsUp className="w-4 h-4 fill-current" />
                        </div>
                        <h3 id="reactions-modal-title" className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100">
                            {title}
                        </h3>
                        {totalCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                                {totalCount}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* User List Body */}
                <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100 dark:divide-slate-800/60 overscroll-contain">
                    {loading ? (
                        <div className="space-y-4 py-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex items-center gap-3 animate-pulse">
                                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
                                    <div className="flex-1 space-y-1.5">
                                        <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded-md" />
                                        <div className="h-3 w-16 bg-slate-100 dark:bg-slate-850 rounded-md" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : users.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 dark:text-slate-500">
                            <ThumbsUp className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            <p className="text-sm font-medium">No reactions yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {users.map((u, idx) => (
                                <div 
                                    key={`${u.displayName}-${idx}`}
                                    className="flex items-center justify-between py-2.5 px-2 rounded-xl hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-colors gap-3"
                                >
                                    {/* Left: Avatar & Names */}
                                    <div className="flex items-center gap-3 min-w-0">
                                        {u.avatarUrl ? (
                                            <img
                                                src={u.avatarUrl}
                                                alt={u.displayName}
                                                className="w-10 h-10 rounded-full object-cover border border-amber-200 dark:border-amber-800 shrink-0"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-extrabold text-sm flex items-center justify-center shrink-0">
                                                {u.displayName.charAt(0).toUpperCase()}
                                            </div>
                                        )}

                                        <div className="flex flex-col min-w-0">
                                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                                {u.displayName}
                                            </span>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                {renderBadge(u.badge)}
                                                {u.createdAt && (
                                                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                                        · {formatRelativeTime(u.createdAt)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Reaction Icon Indicator */}
                                    <div className="size-7 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center shrink-0 text-amber-700 dark:text-amber-400 shadow-2xs">
                                        <ThumbsUp className="w-3.5 h-3.5 fill-current" />
                                    </div>
                                </div>
                            ))}

                            {/* Load More Button */}
                            {hasMore && (
                                <div className="pt-3 pb-1 text-center">
                                    <button
                                        onClick={handleLoadMore}
                                        disabled={loadingMore}
                                        className="px-4 py-2 text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 rounded-xl transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                                    >
                                        {loadingMore ? (
                                            <>
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                Loading...
                                            </>
                                        ) : (
                                            'View more'
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
