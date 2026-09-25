'use client';

import React, { useState, useEffect } from 'react';
import { 
    X, Sparkles, AlertCircle, Save, 
    HelpCircle, MessageSquare, Music 
} from 'lucide-react';
import { 
    CommunityPost, CommunityCategory, 
    CommunityPostType, updateCommunityPost 
} from '../../lib/community';
import { sanitizeHtml } from '../../lib/text-utils';

interface EditPostModalProps {
    isOpen: boolean;
    post: CommunityPost;
    categories: CommunityCategory[];
    onClose: () => void;
    onSaved: (updated: { title: string; content: string; categoryId: string; postType: CommunityPostType; category?: CommunityCategory }) => void;
}

export default function EditPostModal({
    isOpen,
    post,
    categories,
    onClose,
    onSaved
}: EditPostModalProps) {
    const [title, setTitle] = useState(post.title || '');
    // Convert HTML <br/> back to newlines for textarea editing
    const [content, setContent] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState(post.category_id || '');
    const [postType, setPostType] = useState<CommunityPostType>(post.post_type || 'question');
    const [showPreview, setShowPreview] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setTitle(post.title || '');
            const rawContent = (post.content || '')
                .replace(/<br\s*[\/]?>/gi, '\n')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"');
            setContent(rawContent);
            setSelectedCategoryId(post.category_id || (categories[0]?.id ?? ''));
            setPostType(post.post_type || 'question');
            setShowPreview(false);
            setError(null);
        }
    }, [isOpen, post, categories]);

    if (!isOpen) return null;

    const insertNotation = (char: string) => {
        setContent(prev => prev + char);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!title.trim() || title.trim().length < 5) {
            setError('Please enter a descriptive title of at least 5 characters.');
            return;
        }

        if (!selectedCategoryId) {
            setError('Please select a category.');
            return;
        }

        if (!content.trim() || content.trim().length < 10) {
            setError('Please provide content of at least 10 characters.');
            return;
        }

        setIsSubmitting(true);
        try {
            const htmlContent = content.replace(/\n/g, '<br/>');
            const res = await updateCommunityPost({
                postId: post.id,
                title: title.trim(),
                content: htmlContent,
                categoryId: selectedCategoryId,
                postType
            });

            if (res.success) {
                const updatedCat = categories.find(c => c.id === selectedCategoryId);
                onSaved({
                    title: title.trim(),
                    content: htmlContent,
                    categoryId: selectedCategoryId,
                    postType,
                    category: updatedCat || post.category
                });
                onClose();
            } else {
                setError(res.error || 'Failed to update post.');
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
            {/* Modal Dialog Card */}
            <div 
                className="bg-white dark:bg-[#1a140e] border border-amber-900/10 dark:border-amber-500/20 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                role="dialog"
                aria-modal="true"
                aria-labelledby="edit-post-heading"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-amber-900/10 dark:border-amber-500/15">
                    <h3 id="edit-post-heading" className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        Edit Discussion
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        aria-label="Close modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Body (Scrollable on small viewports) */}
                <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs rounded-xl flex items-center gap-2 border border-red-200 dark:border-red-900/50">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Post Type Selector */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                            Post Format
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setPostType('question')}
                                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                                    postType === 'question'
                                        ? 'border-amber-600 bg-amber-50/70 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-500 shadow-2xs'
                                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                            >
                                <HelpCircle className="w-3.5 h-3.5" /> Question
                            </button>
                            <button
                                type="button"
                                onClick={() => setPostType('discussion')}
                                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                                    postType === 'discussion'
                                        ? 'border-amber-600 bg-amber-50/70 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-500 shadow-2xs'
                                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                            >
                                <MessageSquare className="w-3.5 h-3.5" /> Discussion
                            </button>
                        </div>
                    </div>

                    {/* Category Selector */}
                    {categories.length > 0 && (
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Category
                            </label>
                            <select
                                value={selectedCategoryId}
                                onChange={(e) => setSelectedCategoryId(e.target.value)}
                                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-[#faf8f5] dark:bg-[#120d09] border border-amber-900/15 dark:border-amber-500/20 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-all"
                            >
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name} {cat.access_scope === 'students' ? '(KFA Students)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Title Input */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                            Title
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="What would you like to discuss or ask?"
                            maxLength={180}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-[#faf8f5] dark:bg-[#120d09] border border-amber-900/15 dark:border-amber-500/20 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-all"
                        />
                    </div>

                    {/* Notation Shortcut Toolbar */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Music className="w-3 h-3 text-amber-600" /> Notation Quick-Insert
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowPreview(!showPreview)}
                                className="text-[11px] font-bold text-amber-800 dark:text-amber-400 hover:underline"
                            >
                                {showPreview ? 'Edit Text' : 'Preview Layout'}
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-1 p-2 bg-amber-50/50 dark:bg-amber-950/30 rounded-xl border border-amber-900/10 dark:border-amber-500/15">
                            {['सा', 'रे', 'ग', 'म', 'प', 'ध', 'नि', 'सां', 'रें', '॒', '॑'].map(sym => (
                                <button
                                    key={sym}
                                    type="button"
                                    onClick={() => insertNotation(sym)}
                                    className="px-2 py-0.5 text-xs font-bold bg-white dark:bg-slate-800 border border-amber-900/15 dark:border-amber-500/20 rounded-md text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-slate-700 transition-colors"
                                >
                                    {sym}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content Textarea or Preview */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                            Content
                        </label>
                        {showPreview ? (
                            <div className="min-h-[160px] p-4 bg-amber-50/30 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl text-sm prose dark:prose-invert max-w-none">
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
                                rows={7}
                                placeholder="Describe your question or discussion topic in detail..."
                                className="w-full p-3.5 rounded-2xl bg-[#faf8f5] dark:bg-[#120d09] border border-amber-900/15 dark:border-amber-500/20 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-all resize-y"
                            />
                        )}
                    </div>
                </form>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-amber-900/10 dark:border-amber-500/15 bg-slate-50/50 dark:bg-slate-900/30">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSubmitting || !title.trim() || !content.trim()}
                        className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#a15912] hover:bg-[#8a4b0f] text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Saving...</span>
                            </>
                        ) : (
                            <>
                                <Save className="w-3.5 h-3.5" />
                                <span>Save Changes</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
