'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
    MessageSquare, ShieldCheck, Pin, Lock, Unlock, 
    Trash2, Search, Filter, ExternalLink, CheckCircle, 
    AlertCircle, RefreshCw, Eye, ThumbsUp, ArrowLeft 
} from 'lucide-react';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { 
    CommunityCategory, CommunityPost, 
    getCommunityCategories, getCommunityPosts, 
    adminUpdatePost, adminDeletePost 
} from '../../../src/lib/community';
import TeacherSidebar from '../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../src/components/TeacherHeader';

export default function AdminCommunityPage() {
    const router = useRouter();
    const [teacherProfile, setTeacherProfile] = useState<any>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [categories, setCategories] = useState<CommunityCategory[]>([]);
    const [discussions, setDiscussions] = useState<CommunityPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const checkAdmin = async () => {
            try {
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (!session?.user) {
                    router.push('/login?type=teacher');
                    return;
                }

                const { data: userRow } = await supabaseAuth
                    .from('users')
                    .select('*')
                    .eq('id', session.user.id)
                    .maybeSingle();

                if (!userRow || (userRow.role !== 'admin' && userRow.role !== 'teacher')) {
                    router.push('/login?type=teacher');
                    return;
                }

                if (isMounted) {
                    setTeacherProfile(userRow);
                    setIsAdmin(userRow.role === 'admin');
                }

                // Fetch categories
                const cats = await getCommunityCategories();
                if (isMounted) setCategories(cats);

                // Fetch discussions
                const postsRes = await getCommunityPosts({
                    categorySlug: undefined,
                    tab: 'recent',
                    page: 1,
                    pageSize: 50
                }, session.user.id);

                if (isMounted) {
                    setDiscussions(postsRes.posts);
                }
            } catch (err) {
                console.error('[AdminCommunity] Load error:', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        checkAdmin();
        return () => { isMounted = false; };
    }, [router]);

    const handleTogglePin = async (post: CommunityPost) => {
        setActionLoadingId(post.id);
        const nextState = !post.is_pinned;
        const res = await adminUpdatePost(post.id, { is_pinned: nextState });
        if (res.success) {
            setDiscussions(prev => prev.map(p => p.id === post.id ? { ...p, is_pinned: nextState } : p));
        } else {
            alert(res.error || 'Failed to update pin status.');
        }
        setActionLoadingId(null);
    };

    const handleToggleLock = async (post: CommunityPost) => {
        setActionLoadingId(post.id);
        const nextState = !post.is_locked;
        const res = await adminUpdatePost(post.id, { is_locked: nextState });
        if (res.success) {
            setDiscussions(prev => prev.map(p => p.id === post.id ? { ...p, is_locked: nextState } : p));
        } else {
            alert(res.error || 'Failed to update lock status.');
        }
        setActionLoadingId(null);
    };

    const handleDelete = async (postId: string) => {
        if (!confirm('Are you sure you want to permanently delete this discussion and all its replies? This action cannot be undone.')) {
            return;
        }

        setActionLoadingId(postId);
        const res = await adminDeletePost(postId);
        if (res.success) {
            setDiscussions(prev => prev.filter(p => p.id !== postId));
        } else {
            alert(res.error || 'Failed to delete discussion.');
        }
        setActionLoadingId(null);
    };

    // Filter discussions locally
    const filteredDiscussions = discussions.filter(post => {
        if (selectedCategory !== 'all' && post.category?.slug !== selectedCategory) {
            return false;
        }
        if (filterStatus === 'pinned' && !post.is_pinned) return false;
        if (filterStatus === 'locked' && !post.is_locked) return false;
        if (filterStatus === 'solved' && !post.accepted_reply_id) return false;
        if (filterStatus === 'unanswered' && post.replies_count > 0) return false;

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchesTitle = post.title.toLowerCase().includes(q);
            const matchesAuthor = post.author?.display_name?.toLowerCase().includes(q);
            return matchesTitle || matchesAuthor;
        }
        return true;
    });

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/login?type=teacher');
    };

    return (
        <div className="flex h-screen bg-[#f8fafc] text-slate-800 font-sans overflow-hidden">
            {/* Sidebar */}
            <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

            {/* Main Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                <TeacherHeader 
                    title="Community Administration" 
                    userName={teacherProfile?.name} 
                    avatarUrl={teacherProfile?.profile_pic_url} 
                />

                <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
                    {/* Page Header */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                                    Community Administration
                                </h1>
                                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900">
                                    Admin View
                                </span>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-500 mt-1">
                                Moderate forum discussions, pin announcements, lock topics, and review discussions.
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <Link
                                href="/community"
                                target="_blank"
                                className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 font-bold text-xs rounded-xl shadow-xs transition-colors"
                            >
                                <ExternalLink className="w-4 h-4 text-slate-500" />
                                <span>Open Public Community</span>
                            </Link>

                            <Link
                                href="/community/new"
                                target="_blank"
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#a15912] hover:bg-[#8a4b0f] text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                            >
                                <MessageSquare className="w-4 h-4" />
                                <span>New Official Topic</span>
                            </Link>
                        </div>
                    </div>

                    {/* Stats Overview */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Posts</div>
                            <div className="text-2xl font-black text-slate-900">{discussions.length}</div>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Solved Topics</div>
                            <div className="text-2xl font-black text-emerald-600">
                                {discussions.filter(d => !!d.accepted_reply_id).length}
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unanswered</div>
                            <div className="text-2xl font-black text-amber-600">
                                {discussions.filter(d => d.replies_count === 0).length}
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pinned Topics</div>
                            <div className="text-2xl font-black text-blue-600">
                                {discussions.filter(d => d.is_pinned).length}
                            </div>
                        </div>
                    </div>

                    {/* Filters & Search Bar */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by topic title or author..."
                                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                            </div>

                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-semibold text-slate-700"
                            >
                                <option value="all">All Categories</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.slug}>{c.name}</option>
                                ))}
                            </select>

                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-semibold text-slate-700"
                            >
                                <option value="all">All Statuses</option>
                                <option value="pinned">Pinned Only</option>
                                <option value="locked">Locked Only</option>
                                <option value="solved">Solved (Accepted Answer)</option>
                                <option value="unanswered">Unanswered</option>
                            </select>
                        </div>
                    </div>

                    {/* Discussions Table */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                        {loading ? (
                            <div className="p-12 text-center text-xs font-bold text-slate-400 space-y-2">
                                <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
                                <div>Loading discussions...</div>
                            </div>
                        ) : filteredDiscussions.length === 0 ? (
                            <div className="p-12 text-center text-xs text-slate-400">
                                No discussions matching the selected filters.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-100">
                                        <tr>
                                            <th className="py-3 px-4">Title & Excerpt</th>
                                            <th className="py-3 px-4">Category</th>
                                            <th className="py-3 px-4">Author</th>
                                            <th className="py-3 px-4 text-center">Replies</th>
                                            <th className="py-3 px-4 text-center">Views</th>
                                            <th className="py-3 px-4 text-center">Status</th>
                                            <th className="py-3 px-4 text-right">Moderation Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredDiscussions.map((d) => (
                                            <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                                                    <div className="font-bold text-slate-900 truncate">
                                                        <Link 
                                                            href={`/community/discussion/${d.slug}`} 
                                                            target="_blank"
                                                            className="hover:text-amber-800 hover:underline"
                                                        >
                                                            {d.title}
                                                        </Link>
                                                    </div>
                                                    <div className="text-[11px] text-slate-400 mt-0.5">
                                                        {new Date(d.created_at).toLocaleDateString()}
                                                    </div>
                                                </td>

                                                <td className="py-3.5 px-4">
                                                    <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                                                        {d.category?.name || 'Category'}
                                                    </span>
                                                </td>

                                                <td className="py-3.5 px-4">
                                                    <div className="font-semibold text-slate-800">
                                                        {d.author?.display_name || 'Member'}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400">
                                                        {d.author?.badge}
                                                    </div>
                                                </td>

                                                <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                                                    {d.replies_count || 0}
                                                </td>

                                                <td className="py-3.5 px-4 text-center font-medium text-slate-500">
                                                    {d.views_count || 0}
                                                </td>

                                                <td className="py-3.5 px-4 text-center">
                                                    <div className="inline-flex items-center gap-1">
                                                        {d.is_pinned && (
                                                            <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold">
                                                                Pinned
                                                            </span>
                                                        )}
                                                        {d.is_locked && (
                                                            <span className="text-[10px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-bold">
                                                                Locked
                                                            </span>
                                                        )}
                                                        {d.accepted_reply_id && (
                                                            <span className="text-[10px] bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded font-bold">
                                                                Solved
                                                            </span>
                                                        )}
                                                        {!d.is_pinned && !d.is_locked && !d.accepted_reply_id && (
                                                            <span className="text-[10px] text-slate-400">
                                                                Open
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="py-3.5 px-4 text-right">
                                                    <div className="inline-flex items-center gap-1">
                                                        {/* Toggle Pin */}
                                                        <button
                                                            onClick={() => handleTogglePin(d)}
                                                            disabled={actionLoadingId === d.id}
                                                            title={d.is_pinned ? 'Unpin discussion' : 'Pin to top'}
                                                            className={`p-1.5 rounded-lg border transition-colors ${
                                                                d.is_pinned 
                                                                    ? 'bg-amber-100 border-amber-300 text-amber-800' 
                                                                    : 'border-slate-200 hover:bg-slate-100 text-slate-500'
                                                            }`}
                                                        >
                                                            <Pin className="w-3.5 h-3.5" />
                                                        </button>

                                                        {/* Toggle Lock */}
                                                        <button
                                                            onClick={() => handleToggleLock(d)}
                                                            disabled={actionLoadingId === d.id}
                                                            title={d.is_locked ? 'Unlock discussion' : 'Lock discussion'}
                                                            className={`p-1.5 rounded-lg border transition-colors ${
                                                                d.is_locked 
                                                                    ? 'bg-slate-800 border-slate-900 text-white' 
                                                                    : 'border-slate-200 hover:bg-slate-100 text-slate-500'
                                                            }`}
                                                        >
                                                            {d.is_locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                                        </button>

                                                        {/* View Discussion */}
                                                        <Link
                                                            href={`/community/discussion/${d.slug}`}
                                                            target="_blank"
                                                            title="View on site"
                                                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                        </Link>

                                                        {/* Delete */}
                                                        {isAdmin && (
                                                            <button
                                                                onClick={() => handleDelete(d.id)}
                                                                disabled={actionLoadingId === d.id}
                                                                title="Delete discussion"
                                                                className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
