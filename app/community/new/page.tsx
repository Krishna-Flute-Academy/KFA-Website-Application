'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
    ArrowLeft, HelpCircle, MessageSquare, Sparkles, 
    Lock, AlertCircle, Check, Send, Eye, Edit3, Music 
} from 'lucide-react';
import CommunityNavbar from '../../../src/components/community/CommunityNavbar';
import { 
    CommunityCategory, getCommunityCategories, 
    createCommunityPost, CommunityPostType 
} from '../../../src/lib/community';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { sanitizeHtml } from '../../../src/lib/text-utils';

export default function NewDiscussionPage() {
    const router = useRouter();

    const [categories, setCategories] = useState<CommunityCategory[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [postType, setPostType] = useState<CommunityPostType>('question');
    const [showPreview, setShowPreview] = useState(false);

    // Auth & Permissions
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [currentUserName, setCurrentUserName] = useState<string>('');
    const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    // Submission State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const checkAuthAndLoadCategories = async () => {
            try {
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (!session?.user) {
                    if (isMounted) setAuthLoading(false);
                    return;
                }

                if (isMounted) {
                    setCurrentUser(session.user);
                    const name = session.user.user_metadata?.full_name || 
                                 session.user.user_metadata?.name || 
                                 session.user.email?.split('@')[0] || 'KFA Member';
                    setCurrentUserName(name);
                    setCurrentUserAvatar(session.user.user_metadata?.avatar_url || null);
                }

                // Check role in public.users
                const { data: uData } = await supabaseAuth
                    .from('users')
                    .select('name, role, profile_pic_url')
                    .eq('id', session.user.id)
                    .maybeSingle();

                let roleVal: string | null = null;
                let canAccessStudentScope = false;
                if (isMounted && uData) {
                    if (uData.name) setCurrentUserName(uData.name);
                    if (uData.role) {
                        roleVal = uData.role;
                        setCurrentUserRole(uData.role);
                    }
                    if (uData.profile_pic_url) setCurrentUserAvatar(uData.profile_pic_url);
                } else if (isMounted) {
                    // Check community_profiles
                    const { data: cData } = await supabaseAuth
                        .from('community_profiles')
                        .select('display_name, avatar_url, community_role')
                        .eq('id', session.user.id)
                        .maybeSingle();
                    if (cData) {
                        if (cData.display_name) setCurrentUserName(cData.display_name);
                        if (cData.avatar_url) setCurrentUserAvatar(cData.avatar_url);
                        if (cData.community_role === 'student_persona') {
                            canAccessStudentScope = true;
                        }
                    }
                }

                // Fetch available categories
                const cats = await getCommunityCategories();
                if (isMounted) {
                    // Filter categories: student-only categories require student, mentor, teacher, admin role, or student_persona community_role
                    const isEnrolled = (roleVal && ['student', 'mentor', 'teacher', 'admin'].includes(roleVal.toLowerCase())) || canAccessStudentScope;
                    const filteredCats = cats.filter(c => c.access_scope === 'public' || isEnrolled);
                    setCategories(filteredCats);
                    if (filteredCats.length > 0) {
                        setSelectedCategoryId(filteredCats[0].id);
                    }
                }
            } catch (err) {
                console.error('[NewDiscussion] Error:', err);
            } finally {
                if (isMounted) setAuthLoading(false);
            }
        };

        checkAuthAndLoadCategories();
        return () => { isMounted = false; };
    }, []);

    // Quick Indian notation insertion helper
    const insertNotation = (char: string) => {
        setContent(prev => prev + char);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        if (!currentUser) {
            setFormError('Please log in with your KFA account to post.');
            return;
        }

        if (!title.trim() || title.trim().length < 5) {
            setFormError('Please enter a descriptive title of at least 5 characters.');
            return;
        }

        if (!selectedCategoryId) {
            setFormError('Please select a topic category.');
            return;
        }

        if (!content.trim() || content.trim().length < 10) {
            setFormError('Please provide more details in the description (at least 10 characters).');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await createCommunityPost({
                categoryId: selectedCategoryId,
                title: title.trim(),
                content: content.replace(/\n/g, '<br/>'),
                postType,
                authorId: currentUser.id,
                authorName: currentUserName,
                authorAvatar: currentUserAvatar
            });

            if (res.success && res.slug) {
                router.push(`/community/discussion/${res.slug}`);
            } else {
                setFormError(res.error || 'Failed to publish discussion.');
                setIsSubmitting(false);
            }
        } catch (err: any) {
            setFormError(err.message || 'An unexpected error occurred.');
            setIsSubmitting(false);
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen bg-[#faf8f5] dark:bg-[#120d09] flex flex-col items-center justify-center font-sans">
                <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-xs font-bold text-slate-500">Checking permissions...</p>
            </div>
        );
    }

    if (!currentUser) {
        return (
            <div className="min-h-screen bg-[#faf8f5] dark:bg-[#120d09] flex flex-col font-sans">
                <CommunityNavbar />
                <main className="max-w-md mx-auto my-auto p-6 text-center space-y-4">
                    <div className="w-14 h-14 bg-amber-100 text-amber-800 rounded-3xl flex items-center justify-center mx-auto">
                        <Lock className="w-7 h-7" />
                    </div>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                        Sign In Required
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        To maintain a high-quality educational flute learning community, posting discussions requires a free Community or KFA Student account.
                    </p>
                    <div className="pt-2 flex flex-col gap-3">
                        <Link
                            href="/community/join?redirect=/community/new"
                            className="w-full py-3 bg-[#a15912] hover:bg-[#8a4b0f] text-white font-bold text-sm rounded-xl shadow-xs transition-colors"
                        >
                            Join Community (Free)
                        </Link>
                        <Link
                            href="/login?redirect=/community/new"
                            className="w-full py-2.5 border border-amber-850/20 dark:border-amber-500/20 text-amber-900 dark:text-amber-200 font-bold text-xs rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                        >
                            Sign In with Existing Account
                        </Link>
                        <Link
                            href="/community"
                            className="w-full py-2 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors"
                        >
                            Back to Community
                        </Link>
                    </div>
                </main>
            </div>
        );
    }

    const selectedCategory = categories.find(c => c.id === selectedCategoryId);

    return (
        <div className="min-h-screen bg-[#faf8f5] dark:bg-[#120d09] text-slate-900 dark:text-slate-100 flex flex-col font-sans">
            <CommunityNavbar />

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
                {/* Back button */}
                <Link
                    href="/community"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-400 hover:underline"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Community
                </Link>

                <div className="bg-white dark:bg-[#1a140e] border border-amber-900/10 dark:border-amber-500/10 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                            Start a Discussion or Ask a Question
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Share questions, riyaz challenges, raag insights, or flute guidance with the KFA family.
                        </p>
                    </div>

                    {formError && (
                        <div className="p-4 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs sm:text-sm rounded-2xl flex items-center gap-2 border border-red-200 dark:border-red-900">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <span>{formError}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Discussion Type Selector */}
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Post Type
                            </label>
                            <div className="grid grid-cols-2 gap-3 max-w-md">
                                <button
                                    type="button"
                                    onClick={() => setPostType('question')}
                                    className={`flex items-center gap-2 p-3 rounded-2xl border text-xs font-bold transition-all text-left ${
                                        postType === 'question'
                                            ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200'
                                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                                    }`}
                                >
                                    <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                    <div>
                                        <div>Question</div>
                                        <div className="text-[10px] font-normal text-slate-500">I want helpful answers</div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setPostType('discussion')}
                                    className={`flex items-center gap-2 p-3 rounded-2xl border text-xs font-bold transition-all text-left ${
                                        postType === 'discussion'
                                            ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200'
                                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                                    }`}
                                >
                                    <MessageSquare className="w-4 h-4 text-amber-600 shrink-0" />
                                    <div>
                                        <div>Discussion</div>
                                        <div className="text-[10px] font-normal text-slate-500">Share knowledge or thoughts</div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Category Selector */}
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Select Category <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={selectedCategoryId}
                                onChange={(e) => setSelectedCategoryId(e.target.value)}
                                className="w-full p-3.5 rounded-2xl bg-[#faf8f5] dark:bg-[#120d09] border border-amber-900/15 dark:border-amber-500/20 text-slate-900 dark:text-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                            >
                                {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name} {cat.access_scope === 'students' ? '(KFA Students Only)' : ''}
                                    </option>
                                ))}
                            </select>
                            {selectedCategory && (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {selectedCategory.description}
                                </p>
                            )}
                        </div>

                        {/* Title Input */}
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Discussion Title <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. How to maintain consistent air support on Tivra Ma without pitch bending?"
                                className="w-full p-3.5 rounded-2xl bg-[#faf8f5] dark:bg-[#120d09] border border-amber-900/15 dark:border-amber-500/20 text-slate-900 dark:text-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                            />
                            <p className="text-[11px] text-slate-400">
                                Be specific and clear so other flute students and teachers know how to help.
                            </p>
                        </div>

                        {/* Content Area */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Discussion Details <span className="text-red-500">*</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowPreview(!showPreview)}
                                    className="text-xs font-bold text-amber-800 dark:text-amber-400 hover:underline flex items-center gap-1"
                                >
                                    {showPreview ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    <span>{showPreview ? 'Edit Text' : 'Preview'}</span>
                                </button>
                            </div>

                            {/* Quick Indian notation helper toolbar */}
                            <div className="flex flex-wrap items-center gap-1.5 p-2 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-900/10 dark:border-amber-500/10 text-xs">
                                <span className="text-slate-500 font-semibold text-[11px] flex items-center gap-1 mr-1">
                                    <Music className="w-3 h-3 text-amber-700" /> Insert Swara:
                                </span>
                                {['S', 'r', 'R', 'g', 'G', 'm', 'M', 'P', 'd', 'D', 'n', 'N'].map((swara) => (
                                    <button
                                        key={swara}
                                        type="button"
                                        onClick={() => insertNotation(` ${swara} `)}
                                        className="px-2 py-0.5 font-mono font-bold bg-white dark:bg-slate-800 border border-amber-200 dark:border-slate-700 rounded hover:bg-amber-100 text-slate-800 dark:text-slate-200 text-xs"
                                    >
                                        {swara}
                                    </button>
                                ))}
                            </div>

                            {showPreview ? (
                                <div className="min-h-[200px] p-4 bg-amber-50/30 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl text-sm prose dark:prose-invert max-w-none">
                                    {content.trim() ? (
                                        <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(content.replace(/\n/g, '<br/>')) }} />
                                    ) : (
                                        <p className="text-slate-400 italic">No content to preview.</p>
                                    )}
                                </div>
                            ) : (
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    rows={8}
                                    placeholder="Explain your question in detail. Mention what bansuri scale you are using (e.g. C Middle, E Bass), what you have already tried, and what challenges you encounter..."
                                    className="w-full p-4 rounded-2xl bg-[#faf8f5] dark:bg-[#120d09] border border-amber-900/15 dark:border-amber-500/20 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-all resize-y"
                                />
                            )}
                        </div>

                        {/* Submit Button */}
                        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-amber-900/10">
                            <span className="text-xs text-slate-400">
                                Posting as <strong className="text-slate-700 dark:text-slate-300">{currentUserName}</strong>
                            </span>

                            <button
                                type="submit"
                                disabled={isSubmitting || !title.trim() || !content.trim()}
                                className="inline-flex items-center gap-2 px-7 py-3 bg-[#a15912] hover:bg-[#8a4b0f] text-white text-sm font-extrabold rounded-xl shadow-md transform active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>Publishing...</span>
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        <span>Publish Discussion</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}
