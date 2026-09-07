'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    X, ExternalLink, Sparkles, Play, Youtube, Bell, BookOpen, 
    Calendar, Folder, ChevronRight, ChevronLeft, Move, Globe, Check, Minus
} from 'lucide-react';
import { supabaseAuth } from '../../lib/supabase-auth';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FeaturedUpdate {
    id: string;
    creator_id?: string;
    title: string;
    description?: string | null;
    url: string;
    thumbnail_url?: string | null;
    content_type: string;
    cta_label?: string | null;
    recipients?: any[];
    status: 'draft' | 'active' | 'paused' | 'archived';
    start_date?: string | null;
    end_date?: string | null;
    notify_reset_at?: string | null;
    created_at?: string;
    updated_at?: string;
}

interface FeaturedUpdatesWidgetProps {
    studentId: string;
    broadcasts?: any[]; // Kept for interface backward compatibility
}

export type ReadTrackingRecord = Record<string, string>; // updateId -> readAt ISO string

const READS_KEY_PREFIX = 'kfa_student_featured_reads';
const POS_KEY = 'kfa_floating_widget_pos';

// ─── Read State Helpers (Structured for easy swap to Supabase table later) ───

export function getStudentReads(studentId: string): ReadTrackingRecord {
    try {
        const raw = localStorage.getItem(`${READS_KEY_PREFIX}_${studentId}`);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

export function saveStudentRead(studentId: string, updateId: string): ReadTrackingRecord {
    try {
        const current = getStudentReads(studentId);
        current[updateId] = new Date().toISOString();
        localStorage.setItem(`${READS_KEY_PREFIX}_${studentId}`, JSON.stringify(current));
        return { ...current };
    } catch {
        return {};
    }
}

export function isUpdateRead(update: FeaturedUpdate, reads: ReadTrackingRecord): boolean {
    const readAt = reads[update.id];
    if (!readAt) return false;
    if (update.notify_reset_at) {
        const resetTime = new Date(update.notify_reset_at).getTime();
        const readTime = new Date(readAt).getTime();
        if (resetTime > readTime) return false;
    }
    return true;
}

function getSavedPosition(): { x: number; y: number } | null {
    try {
        const raw = localStorage.getItem(POS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
                return parsed;
            }
        }
    } catch {}
    return null;
}

function savePosition(pos: { x: number; y: number }) {
    try {
        localStorage.setItem(POS_KEY, JSON.stringify(pos));
    } catch {}
}

// Helper to get type-specific badge style and icon
function getTypeMeta(contentType: string) {
    const type = (contentType || 'other').toLowerCase();
    switch (type) {
        case 'youtube':
            return { label: 'YouTube Video', icon: Youtube, color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' };
        case 'blog':
        case 'article':
            return { label: 'Academy Article', icon: BookOpen, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
        case 'tutorial':
            return { label: 'Tutorial Lesson', icon: Play, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
        case 'event':
            return { label: 'Academy Event', icon: Calendar, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
        case 'resource':
            return { label: 'Learning Resource', icon: Folder, color: 'bg-sky-500/20 text-sky-400 border-sky-500/30' };
        case 'announcement':
            return { label: 'Announcement', icon: Bell, color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
        case 'external':
            return { label: 'Featured Link', icon: Globe, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
        default:
            return { label: 'Featured Update', icon: Sparkles, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
    }
}

export default function BlogNotification({ studentId }: FeaturedUpdatesWidgetProps) {
    const [updates, setUpdates] = useState<FeaturedUpdate[]>([]);
    const [reads, setReads] = useState<ReadTrackingRecord>({});
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isExpanded, setIsExpanded] = useState(false);

    // Desktop draggable coordinates
    const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({ mouseX: 0, mouseY: 0, startX: 0, startY: 0 });
    const widgetRef = useRef<HTMLDivElement | null>(null);

    // ── Fetch active targeted featured updates from Supabase ─────────────────
    useEffect(() => {
        if (!studentId) return;

        const loadReadsAndUpdates = async () => {
            try {
                const currentReads = getStudentReads(studentId);
                setReads(currentReads);

                // Strict RLS evaluates role = 'student', active status, date range, master toggle, and recipient targeting
                const { data, error } = await supabaseAuth
                    .from('featured_updates')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) {
                    console.warn('[FeaturedUpdates] Fetch error (RLS or table status):', error.message);
                    return;
                }

                if (data && data.length > 0) {
                    const activeUpdates = data as FeaturedUpdate[];
                    setUpdates(activeUpdates);

                    // Find unread updates
                    const firstUnreadIdx = activeUpdates.findIndex(u => !isUpdateRead(u, currentReads));
                    if (firstUnreadIdx !== -1) {
                        // Unread updates exist -> auto-open to the first unread update
                        setCurrentIndex(firstUnreadIdx);
                        setIsExpanded(true);
                    } else {
                        // All updates are already read -> keep as quiet floating pill
                        setCurrentIndex(0);
                        setIsExpanded(false);
                    }
                } else {
                    setUpdates([]);
                }
            } catch (err) {
                console.warn('[FeaturedUpdates] Failed to load updates:', err);
            }
        };

        loadReadsAndUpdates();
    }, [studentId]);

    // ── Initialize or restore desktop position ───────────────────────────────
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const saved = getSavedPosition();
        if (saved) {
            const maxX = Math.max(16, window.innerWidth - 380);
            const maxY = Math.max(16, window.innerHeight - 340);
            setPos({
                x: Math.max(16, Math.min(maxX, saved.x)),
                y: Math.max(16, Math.min(maxY, saved.y))
            });
        }
    }, []);

    // ── Drag Handlers ────────────────────────────────────────────────────────
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('a')) return;

        isDraggingRef.current = true;
        const rect = widgetRef.current?.getBoundingClientRect();
        const currentX = rect ? rect.left : (window.innerWidth - 380);
        const currentY = rect ? rect.top : (window.innerHeight - 340);

        dragStartRef.current = {
            mouseX: e.clientX,
            mouseY: e.clientY,
            startX: currentX,
            startY: currentY
        };

        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current) return;
            const deltaX = e.clientX - dragStartRef.current.mouseX;
            const deltaY = e.clientY - dragStartRef.current.mouseY;
            const widgetWidth = widgetRef.current?.offsetWidth || 360;
            const widgetHeight = widgetRef.current?.offsetHeight || 120;

            const newX = Math.max(16, Math.min(window.innerWidth - widgetWidth - 16, dragStartRef.current.startX + deltaX));
            const newY = Math.max(16, Math.min(window.innerHeight - widgetHeight - 16, dragStartRef.current.startY + deltaY));

            setPos({ x: newX, y: newY });
        };

        const handleMouseUp = () => {
            if (isDraggingRef.current) {
                isDraggingRef.current = false;
                document.body.style.userSelect = '';
                document.body.style.cursor = '';
                setPos(currentPos => {
                    if (currentPos) savePosition(currentPos);
                    return currentPos;
                });
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    // ── Computed States ──────────────────────────────────────────────────────
    const unreadCount = useMemo(() => {
        return updates.filter(u => !isUpdateRead(u, reads)).length;
    }, [updates, reads]);

    const currentUpdate = updates[currentIndex] || updates[0];
    const isCurrentRead = currentUpdate ? isUpdateRead(currentUpdate, reads) : false;

    // ── Mark as Read & Actions ───────────────────────────────────────────────
    const handleMarkAsRead = (updateId: string) => {
        if (!studentId || !updateId) return;
        const updatedReads = saveStudentRead(studentId, updateId);
        setReads(updatedReads);

        // Check if there are other unread updates left
        const nextUnreadIdx = updates.findIndex((u, idx) => idx !== currentIndex && !isUpdateRead(u, updatedReads));
        if (nextUnreadIdx !== -1) {
            // Advance to next unread
            setCurrentIndex(nextUnreadIdx);
        } else {
            // All updates are now read -> collapse gracefully into the floating pill
            setIsExpanded(false);
        }
    };

    const handleOpenCTA = () => {
        if (!currentUpdate) return;
        // Also mark as read upon clicking CTA
        if (!isCurrentRead) {
            handleMarkAsRead(currentUpdate.id);
        }
        window.open(currentUpdate.url, '_blank');
    };

    // If there are no active updates targeted to this student, render nothing
    if (updates.length === 0 || !currentUpdate) {
        return null;
    }

    const typeMeta = getTypeMeta(currentUpdate.content_type);
    const TypeIcon = typeMeta.icon;

    return (
        <>
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* DESKTOP VIEW (sm and above)                                         */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <div
                ref={widgetRef}
                style={pos ? { left: `${pos.x}px`, top: `${pos.y}px` } : { right: '24px', bottom: '24px' }}
                className="hidden sm:block fixed z-[9990] select-none"
            >
                {/* 1. COLLAPSED FLOATING PILL */}
                {!isExpanded ? (
                    <div
                        onMouseDown={handleMouseDown}
                        onClick={() => setIsExpanded(true)}
                        className={`group flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-2xl border backdrop-blur-xl cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200 ${
                            unreadCount > 0
                                ? 'border-amber-500/60 bg-gradient-to-r from-[#210c00] via-[#1a0f2b] to-[#12081f] text-white ring-2 ring-amber-500/20 shadow-amber-500/10'
                                : 'border-slate-700/80 bg-slate-900/90 text-slate-200 hover:border-amber-500/40'
                        }`}
                        title="Click to view KFA Updates"
                    >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                            unreadCount > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'
                        }`}>
                            <Sparkles className={`w-3.5 h-3.5 ${unreadCount > 0 ? 'animate-pulse' : ''}`} />
                        </div>

                        <span className="text-xs font-black tracking-wide text-white">
                            What&apos;s New
                        </span>

                        {unreadCount > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#ecb613] text-slate-950 shadow-xs">
                                {unreadCount} NEW
                            </span>
                        ) : (
                            <span className="text-[10px] font-bold text-slate-400 group-hover:text-amber-400 transition-colors">
                                {updates.length} {updates.length === 1 ? 'update' : 'updates'}
                            </span>
                        )}

                        <span className="text-white/30 group-hover:text-white/70 transition-colors ml-0.5">
                            <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                    </div>
                ) : (
                    /* 2. EXPANDED CAROUSEL CARD */
                    <div className="w-92 rounded-3xl shadow-2xl border border-amber-500/40 overflow-hidden backdrop-blur-xl animate-in fade-in duration-200">
                        {/* Background Gradient */}
                        <div 
                            className="absolute inset-0 -z-10" 
                            style={{ background: 'linear-gradient(145deg, #1a0a00 0%, #120e1f 50%, #0d0a14 100%)' }} 
                        />

                        {/* Top Accent Strip */}
                        <div className="h-1 w-full bg-gradient-to-r from-amber-600 via-[#ecb613] to-rose-600" />

                        {/* Header (Acts as drag handle) */}
                        <div
                            onMouseDown={handleMouseDown}
                            className="px-4 py-3 flex items-center justify-between border-b border-white/10 cursor-grab active:cursor-grabbing bg-white/[0.03]"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-white text-xs font-black tracking-wide truncate">
                                        What&apos;s New at KFA
                                    </h3>
                                    <p className="text-[10px] font-bold text-amber-400/80">
                                        {updates.length > 1 ? `Update ${currentIndex + 1} of ${updates.length}` : 'Featured Update'}
                                        {unreadCount > 0 && ` · ${unreadCount} unread`}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                {/* Drag Icon Indicator */}
                                <span title="Drag to reposition widget" className="p-1 text-white/30 hover:text-white/70 transition-colors">
                                    <Move className="w-3.5 h-3.5" />
                                </span>

                                {/* Minimize Button (Collapse into pill without marking as read) */}
                                <button
                                    type="button"
                                    onClick={() => setIsExpanded(false)}
                                    className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all text-xs font-bold"
                                    title="Minimize to floating pill"
                                >
                                    <Minus className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Body Content */}
                        <div className="p-4 space-y-3.5 text-left">
                            {/* Optional Thumbnail / Header Media */}
                            {currentUpdate.thumbnail_url ? (
                                <div 
                                    className="relative w-full h-36 rounded-2xl overflow-hidden bg-black/40 border border-white/10 group cursor-pointer" 
                                    onClick={handleOpenCTA}
                                >
                                    <img
                                        src={currentUpdate.thumbnail_url}
                                        alt={currentUpdate.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                    
                                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider backdrop-blur-md border border-white/20 bg-black/60 text-amber-300">
                                            <TypeIcon className="w-2.5 h-2.5" />
                                            <span>{typeMeta.label}</span>
                                        </div>
                                        {!isCurrentRead ? (
                                            <span className="px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase bg-[#ecb613] text-slate-950 shadow-sm">
                                                NEW
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded-full text-[8.5px] font-bold uppercase bg-black/50 text-white/60 border border-white/10">
                                                ✓ READ
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${typeMeta.color}`}>
                                        <TypeIcon className="w-3 h-3" />
                                        <span>{typeMeta.label}</span>
                                    </span>
                                    {!isCurrentRead ? (
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-[#ecb613] text-slate-950 shadow-sm">
                                            NEW
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-white/10 text-white/60">
                                            ✓ READ
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Title & Description */}
                            <div>
                                <h4 className="text-white text-sm font-black leading-snug hover:text-amber-300 transition-colors">
                                    {currentUpdate.title}
                                </h4>
                                {currentUpdate.description && (
                                    <p className="text-slate-300/80 text-xs leading-relaxed mt-1.5 line-clamp-3">
                                        {currentUpdate.description}
                                    </p>
                                )}
                            </div>

                            {/* Actions & Pagination Footer */}
                            <div className="pt-1 flex items-center justify-between gap-2 border-t border-white/10">
                                {/* Multi-update pagination controls */}
                                {updates.length > 1 ? (
                                    <div className="flex items-center gap-1 text-white/50">
                                        <button
                                            type="button"
                                            onClick={() => setCurrentIndex(prev => (prev > 0 ? prev - 1 : updates.length - 1))}
                                            className="p-1 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
                                            title="Previous update"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <span className="text-[10px] font-bold text-white/70 px-1">
                                            {currentIndex + 1}/{updates.length}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setCurrentIndex(prev => (prev < updates.length - 1 ? prev + 1 : 0))}
                                            className="p-1 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
                                            title="Next update"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <span className="text-[10px] font-semibold text-white/40">Academy Notice</span>
                                )}

                                <div className="flex items-center gap-2 ml-auto">
                                    {/* Mark as Read / Dismiss Action */}
                                    {!isCurrentRead ? (
                                        <button
                                            type="button"
                                            onClick={() => handleMarkAsRead(currentUpdate.id)}
                                            className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-white/70 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1 cursor-pointer"
                                            title="Mark this update as read"
                                        >
                                            <Check className="w-3 h-3 text-emerald-400" />
                                            <span>Mark as Read</span>
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setIsExpanded(false)}
                                            className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                                            title="Collapse into floating pill"
                                        >
                                            Close
                                        </button>
                                    )}

                                    {/* Open CTA Action */}
                                    <button
                                        type="button"
                                        onClick={handleOpenCTA}
                                        className="px-4 py-2 rounded-xl text-xs font-black text-slate-950 bg-[#ecb613] hover:bg-[#ecb613]/90 active:scale-95 shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                                    >
                                        <span>{currentUpdate.cta_label || 'Learn More'}</span>
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* MOBILE VIEW (sm:hidden - Mobile Bottom Action)                      */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {!isExpanded ? (
                /* Mobile Floating Action Pill */
                <div
                    onClick={() => setIsExpanded(true)}
                    className={`sm:hidden fixed bottom-20 right-3.5 z-[9990] flex items-center gap-2 px-3.5 py-2 rounded-full shadow-2xl border backdrop-blur-xl cursor-pointer active:scale-95 transition-all duration-200 ${
                        unreadCount > 0
                            ? 'border-amber-500/60 bg-gradient-to-r from-[#210c00] via-[#1a0f2b] to-[#12081f] text-white ring-2 ring-amber-500/20'
                            : 'border-slate-700/80 bg-slate-900/90 text-slate-200'
                    }`}
                >
                    <Sparkles className={`w-3.5 h-3.5 ${unreadCount > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} />
                    <span className="text-xs font-black text-white">What&apos;s New</span>
                    {unreadCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-[#ecb613] text-slate-950">
                            {unreadCount}
                        </span>
                    )}
                </div>
            ) : (
                /* Mobile Bottom Sheet Card */
                <div className="sm:hidden fixed bottom-3 left-3 right-3 z-[9990] rounded-2xl shadow-2xl border border-amber-500/40 overflow-hidden backdrop-blur-xl animate-in slide-in-from-bottom-3 duration-200">
                    <div 
                        className="absolute inset-0 -z-10" 
                        style={{ background: 'linear-gradient(145deg, #180900 0%, #120e1f 100%)' }} 
                    />
                    <div className="h-0.5 w-full bg-gradient-to-r from-amber-600 via-[#ecb613] to-rose-600" />

                    <div className="p-3.5 space-y-2.5 text-left">
                        {/* Header Row */}
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${typeMeta.color}`}>
                                    <TypeIcon className="w-2.5 h-2.5" />
                                    <span className="truncate">{typeMeta.label}</span>
                                </span>
                                {updates.length > 1 && (
                                    <span className="text-[10px] font-bold text-amber-400">
                                        ({currentIndex + 1}/{updates.length})
                                    </span>
                                )}
                                {!isCurrentRead ? (
                                    <span className="px-1.5 py-0.2 rounded-full text-[8px] font-black bg-[#ecb613] text-slate-950">
                                        NEW
                                    </span>
                                ) : (
                                    <span className="px-1.5 py-0.2 rounded-full text-[8px] font-bold bg-white/10 text-white/60">
                                        READ
                                    </span>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsExpanded(false)}
                                className="p-1 rounded-lg text-white/60 hover:text-white"
                                aria-label="Minimize"
                            >
                                <Minus className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex items-start gap-3">
                            {currentUpdate.thumbnail_url && (
                                <img
                                    src={currentUpdate.thumbnail_url}
                                    alt={currentUpdate.title}
                                    className="w-16 h-16 rounded-xl object-cover border border-white/10 shrink-0"
                                />
                            )}
                            <div className="min-w-0 flex-1">
                                <h4 className="text-white text-xs font-black leading-snug line-clamp-2">
                                    {currentUpdate.title}
                                </h4>
                                {currentUpdate.description && (
                                    <p className="text-slate-300/80 text-[11px] leading-tight line-clamp-2 mt-1">
                                        {currentUpdate.description}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="pt-1 flex items-center justify-between gap-2 border-t border-white/10">
                            {updates.length > 1 ? (
                                <div className="flex items-center gap-1 text-white/60">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentIndex(prev => (prev > 0 ? prev - 1 : updates.length - 1))}
                                        className="p-1 rounded hover:bg-white/10"
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="text-[10px] font-bold text-white/70">
                                        {currentIndex + 1}/{updates.length}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setCurrentIndex(prev => (prev < updates.length - 1 ? prev + 1 : 0))}
                                        className="p-1 rounded hover:bg-white/10"
                                    >
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ) : <div />}

                            <div className="flex items-center gap-2">
                                {!isCurrentRead ? (
                                    <button
                                        type="button"
                                        onClick={() => handleMarkAsRead(currentUpdate.id)}
                                        className="px-2 py-1 text-[11px] font-bold text-white/70 hover:text-white"
                                    >
                                        Mark Read
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setIsExpanded(false)}
                                        className="px-2 py-1 text-[11px] font-bold text-white/50 hover:text-white"
                                    >
                                        Close
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleOpenCTA}
                                    className="px-3.5 py-1.5 rounded-xl text-xs font-black text-slate-950 bg-[#ecb613] shadow-md flex items-center gap-1.5 active:scale-95 cursor-pointer"
                                >
                                    <span>{currentUpdate.cta_label || 'View'}</span>
                                    <ExternalLink className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
