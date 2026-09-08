import React, { useState, useEffect } from 'react';
import { 
    X, 
    Play, 
    BookOpen, 
    ArrowRight, 
    CheckCircle2, 
    ExternalLink,
    HelpCircle,
    FileText,
    Copy,
    Check,
    Youtube,
    Folder,
    UploadCloud
} from 'lucide-react';
import { 
    HowToGuide, 
    HowToStep,
    HowToMethod,
    DEFAULT_HOW_TO_GUIDES, 
    POLICY_ID_NAMES, 
    TEACHER_SUBMISSION_EMAIL,
    findGuideBySlugOrId,
    isMethodBasedGuide
} from '../lib/howToGuides';

export interface HowToGuideViewerProps {
    guideSlug?: string | null;
    guide?: HowToGuide | null;
    allGuides?: HowToGuide[];
    isOpen?: boolean;
    onClose?: () => void;
    onNavigateToPolicy?: (policyId: string) => void;
    mode?: 'modal' | 'embedded';
    className?: string;
    returnActionLabel?: string;
    hideHeader?: boolean;
}

export default function HowToGuideViewer({
    guideSlug,
    guide: initialGuide,
    allGuides,
    isOpen = true,
    onClose,
    onNavigateToPolicy,
    mode = 'modal',
    className = '',
    returnActionLabel = 'Got it',
    hideHeader = false
}: HowToGuideViewerProps) {
    const [guide, setGuide] = useState<HowToGuide | null>(initialGuide || null);
    const [isPlayingVideo, setIsPlayingVideo] = useState(false);
    const [selectedMethodKey, setSelectedMethodKey] = useState<string>('youtube');
    const [copiedEmail, setCopiedEmail] = useState(false);

    // Resolve guide by slug or id whenever slug or initialGuide changes
    useEffect(() => {
        if (initialGuide) {
            setGuide(initialGuide);
            return;
        }
        if (guideSlug) {
            // First check passed allGuides, fallback to localStorage, fallback to DEFAULT_HOW_TO_GUIDES
            let resolved = findGuideBySlugOrId(guideSlug, allGuides);
            if (!resolved && typeof window !== 'undefined') {
                try {
                    const cached = localStorage.getItem('kfa-student-how-to-guides');
                    if (cached) {
                        const parsed: HowToGuide[] = JSON.parse(cached);
                        resolved = findGuideBySlugOrId(guideSlug, parsed);
                    }
                } catch {
                    // ignore JSON parse error
                }
            }
            if (!resolved) {
                resolved = findGuideBySlugOrId(guideSlug, DEFAULT_HOW_TO_GUIDES);
            }
            setGuide(resolved || null);
        }
    }, [guideSlug, initialGuide, allGuides]);

    // Reset video player and active method when modal opens or guide changes
    useEffect(() => {
        if (!isOpen) {
            setIsPlayingVideo(false);
            setCopiedEmail(false);
        }
    }, [isOpen]);

    const isMethodBased = isMethodBasedGuide(guide);
    const methods: HowToMethod[] = isMethodBased ? ((guide?.steps as unknown) as HowToMethod[]) : [];

    useEffect(() => {
        if (isMethodBased && methods.length > 0) {
            setSelectedMethodKey(methods[0].key);
        }
    }, [guide?.id, guide?.slug, isMethodBased]);

    if (mode === 'modal' && !isOpen) {
        return null;
    }

    // Graceful fallback if guide is not found or inactive
    if (!guide || (!guide.is_active && !guideSlug?.startsWith('admin-preview'))) {
        if (mode === 'modal') {
            return (
                <div 
                    role="dialog" 
                    aria-modal="true" 
                    className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-in fade-in duration-200"
                >
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center space-y-4 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center mx-auto">
                            <HelpCircle className="w-6 h-6" />
                        </div>
                        <h3 className="text-base font-extrabold text-slate-800 dark:text-white">Guide Unavailable</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            This tutorial guide is currently being updated. You can check the Policies & How-To library or ask your instructor for assistance.
                        </p>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                        >
                            Close
                        </button>
                    </div>
                </div>
            );
        }
        return null;
    }

    // Helper to extract YouTube video ID
    const getYouTubeId = (url: string) => {
        const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
        return match ? match[1] : null;
    };

    const handleCopyEmail = (email: string) => {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(email);
            setCopiedEmail(true);
            setTimeout(() => setCopiedEmail(false), 2500);
        }
    };

    const ytId = guide.video_url ? getYouTubeId(guide.video_url) : null;
    const relatedPolicyName = guide.related_policy_id ? (POLICY_ID_NAMES[guide.related_policy_id] || guide.related_policy_id) : null;

    // Resolve active method if method-based
    const activeMethod = isMethodBased 
        ? (methods.find(m => m.key === selectedMethodKey) || methods[0])
        : null;

    const content = (
        <div className="flex flex-col h-full max-h-[90vh] sm:max-h-[85vh]">
            {/* Header */}
            {!hideHeader && (
                <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4 bg-gradient-to-r from-amber-50/50 via-white to-orange-50/30 dark:from-slate-850 dark:to-slate-900 shrink-0">
                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-extrabold uppercase tracking-wider font-mono">
                            <BookOpen className="w-3 h-3" />
                            How-To Guide
                        </div>
                        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
                            {guide.title}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-md">
                            {guide.description}
                        </p>
                    </div>
                    {mode === 'modal' && onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close guide"
                            className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            )}

            {/* Scrollable Body */}
            <div className={`space-y-5 overflow-y-auto flex-1 overscroll-contain text-left ${hideHeader ? 'p-1' : 'p-5 sm:p-6'}`}>
                {/* Optional Video Section — Only rendered when video_url is present */}
                {guide.video_url && (
                    <div className="rounded-2xl overflow-hidden border border-amber-200/80 dark:border-amber-900/40 bg-amber-500/5 p-3.5 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold text-amber-900 dark:text-amber-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                                <Play className="w-3.5 h-3.5 fill-amber-700 text-amber-700" />
                                Video Walkthrough
                            </span>
                            {!isPlayingVideo && (
                                <button
                                    type="button"
                                    onClick={() => setIsPlayingVideo(true)}
                                    className="text-xs font-bold text-[#d46211] hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                    ▶ Watch Tutorial
                                </button>
                            )}
                        </div>

                        {isPlayingVideo ? (
                            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black shadow-inner">
                                {ytId ? (
                                    <iframe
                                        src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`}
                                        title={guide.title}
                                        className="w-full h-full border-0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                ) : (
                                    <video
                                        src={guide.video_url}
                                        controls
                                        autoPlay
                                        className="w-full h-full object-contain"
                                    />
                                )}
                            </div>
                        ) : (
                            <div 
                                onClick={() => setIsPlayingVideo(true)}
                                className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-900 flex flex-col items-center justify-center text-white cursor-pointer group shadow-sm hover:brightness-105 transition-all"
                            >
                                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center group-hover:scale-110 group-hover:bg-[#d46211] transition-all">
                                    <Play className="w-6 h-6 fill-white text-white ml-0.5" />
                                </div>
                                <span className="mt-2 text-xs font-bold tracking-wide text-white/90">
                                    Click to Play Video Tutorial
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* ── METHOD-BASED GUIDE (e.g., Task Submission with 3 Options) ──────── */}
                {isMethodBased && activeMethod ? (
                    <div className="space-y-4">
                        {/* Method Selector Tabs */}
                        <div className="space-y-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 font-mono block">
                                Choose your submission method:
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                {methods.map((method) => {
                                    const isSelected = method.key === selectedMethodKey;
                                    return (
                                        <button
                                            key={method.key}
                                            type="button"
                                            onClick={() => setSelectedMethodKey(method.key)}
                                            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                                isSelected 
                                                    ? 'bg-amber-500/10 border-amber-500/70 ring-2 ring-amber-500/20 shadow-xs' 
                                                    : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
                                            }`}
                                        >
                                            <div>
                                                <div className="flex items-center justify-between gap-1 mb-1">
                                                    <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                                                        {method.shortTitle || method.title}
                                                    </span>
                                                    {method.badge && (
                                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                                                            method.requiresTeacherAccess 
                                                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300' 
                                                                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                                        }`}>
                                                            {method.badge}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-snug">
                                                    {method.description}
                                                </p>
                                            </div>
                                            <span className={`text-[10px] font-bold mt-2.5 inline-flex items-center gap-0.5 ${
                                                isSelected ? 'text-[#d46211]' : 'text-slate-400'
                                            }`}>
                                                {isSelected ? 'Viewing Steps ↓' : 'Select Method →'}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Active Method Container */}
                        <div className="space-y-4 pt-1 animate-in fade-in duration-150">
                            {/* Access Warning (Required for Google Drive and Portal Upload) */}
                            {activeMethod.requiresTeacherAccess && (
                                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-300/80 dark:border-amber-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
                                    <div className="flex items-start gap-2.5 min-w-0">
                                        <span className="text-lg shrink-0">🔐</span>
                                        <div className="min-w-0">
                                            <h5 className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-300 font-mono">
                                                Teacher Access Required
                                            </h5>
                                            <p className="text-xs text-amber-800 dark:text-amber-200 mt-0.5 font-medium leading-relaxed">
                                                Please make sure <span className="font-bold underline">{activeMethod.teacherEmail || TEACHER_SUBMISSION_EMAIL}</span> has permission to view your recording.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleCopyEmail(activeMethod.teacherEmail || TEACHER_SUBMISSION_EMAIL)}
                                        className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-900 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer self-start sm:self-center min-h-[36px]"
                                    >
                                        {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-950" /> : <Copy className="w-3.5 h-3.5" />}
                                        <span>{copiedEmail ? 'Copied! ✓' : 'Copy Email'}</span>
                                    </button>
                                </div>
                            )}

                            {/* Steps for Active Method */}
                            <div className="space-y-2.5">
                                <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-400 font-mono">
                                    {activeMethod.title} ({activeMethod.steps.length} Steps)
                                </h5>
                                <div className="space-y-2">
                                    {activeMethod.steps.map((step, idx) => (
                                        <div 
                                            key={step.order || idx}
                                            className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-900/60 transition-colors"
                                        >
                                            <div className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center font-mono font-black text-xs shrink-0 mt-0.5">
                                                {step.order || idx + 1}
                                            </div>
                                            <p className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed pt-0.5 font-medium">
                                                {step.text}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Explanatory Note Callout */}
                            {activeMethod.importantNote && (
                                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/70 dark:border-slate-800 text-left">
                                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                                        💡 {activeMethod.importantNote}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* ── SIMPLE FLAT STEPS GUIDE (e.g., How to Apply for Leave) ───────── */
                    <div className="space-y-3">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 font-mono">
                            Step-by-Step Instructions ({(guide.steps as HowToStep[]).length} Steps)
                        </h4>
                        
                        <div className="space-y-2.5">
                            {(guide.steps as HowToStep[]).map((step, idx) => (
                                <div 
                                    key={step.order || idx}
                                    className="flex items-start gap-3.5 p-3 sm:p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-900/60 transition-colors"
                                >
                                    <div className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center font-mono font-black text-xs shrink-0 mt-0.5">
                                        {step.order || idx + 1}
                                    </div>
                                    <p className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed pt-0.5 font-medium">
                                        {step.text}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Optional Related Policy Section — ONLY rendered if related_policy_id is non-null */}
                {guide.related_policy_id && relatedPolicyName && (
                    <div className="pt-2">
                        <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-slate-850 border border-amber-200/70 dark:border-slate-800 flex items-center justify-between gap-3 text-left">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-[#7C5E3F] dark:text-amber-400 shrink-0">
                                    <FileText className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                                        Governing Academy Policy
                                    </span>
                                    <span className="text-xs font-bold text-slate-800 dark:text-white truncate block">
                                        {relatedPolicyName}
                                    </span>
                                </div>
                            </div>

                            {onNavigateToPolicy && (
                                <button
                                    type="button"
                                    onClick={() => onNavigateToPolicy(guide.related_policy_id!)}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#d46211] hover:underline shrink-0 cursor-pointer min-h-[36px] px-2"
                                >
                                    Read Policy
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Sticky Action Footer */}
            {mode === 'modal' && (
                <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/60 flex items-center justify-between gap-3 shrink-0">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                        Follow these steps to complete your action
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full sm:w-auto px-6 py-3 bg-[#7C5E3F] hover:bg-[#654b32] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 min-h-[44px]"
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        {returnActionLabel}
                    </button>
                </div>
            )}
        </div>
    );

    if (mode === 'embedded') {
        return (
            <div className={`bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden ${className}`}>
                {content}
            </div>
        );
    }

    // Modal view: Responsive desktop dialog / mobile bottom sheet
    return (
        <div 
            role="dialog" 
            aria-modal="true" 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-in fade-in duration-200"
        >
            <div 
                className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 text-left"
            >
                {content}
            </div>
        </div>
    );
}
