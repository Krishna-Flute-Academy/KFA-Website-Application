'use client';

import React from 'react';
import { BookOpen, Clock, Award, Check, Music, Video, Info, FileText, X, Star } from 'lucide-react';
import AutoLinkText from '../common/AutoLinkText';
import { sanitizeHtml } from '../../lib/text-utils';

interface LessonViewerProps {
    topic: any;
    description?: string;
    isLoadingDescription?: boolean;
    descriptionError?: boolean;
    onRetryDescription?: () => void;
    status: 'completed' | 'unlocked' | 'locked';
    breadcrumb?: string;
    isStudentSpotlight?: boolean;
    isTeacherSpotlight?: boolean;
    onToggleSpotlight?: (lessonId: string) => Promise<void> | void;
    onOpenMaterial?: () => void;
    onToggleComplete: (lessonId: string, currentStatus: string) => Promise<void> | void;
    onClose?: () => void;
    isMobile?: boolean;
}

const getCleanDuration = (duration: string, fileSize: string) => {
    if (!duration) return '';
    if (fileSize && duration.includes(fileSize)) {
        const parts = duration.split('•');
        return parts[0].trim();
    }
    return duration;
};

export default function LessonViewer({
    topic,
    description,
    isLoadingDescription = false,
    descriptionError = false,
    onRetryDescription,
    status,
    breadcrumb,
    isStudentSpotlight = false,
    isTeacherSpotlight = false,
    onToggleSpotlight,
    onOpenMaterial,
    onToggleComplete,
    onClose,
    isMobile = false
}: LessonViewerProps) {
    if (!topic) {
        return (
            <div className="py-12 px-6 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center border border-amber-100 shadow-xs">
                    <BookOpen className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                    <p className="text-xs font-extrabold text-slate-700">No Topic Selected</p>
                    <p className="text-[10px] text-slate-400 max-w-[220px] mx-auto mt-1 leading-relaxed">
                        Click on any allocated lesson on the left to view its descriptions, material files, and practice guide.
                    </p>
                </div>
            </div>
        );
    }

    const isCompleted = status === 'completed';
    const hasResource = !!(topic.material_url || topic.link_url);
    const activeDescription = description !== undefined ? description : topic?.description;

    return (
        <div className="space-y-4 text-left">
            {/* Spotlight Banner / Highlights */}
            {isTeacherSpotlight && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm">⭐</span>
                        <span className="text-[11px] font-black text-amber-900 truncate font-mono uppercase tracking-wider">
                            Teacher Recommended Spotlight
                        </span>
                    </div>
                    <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">
                        High Priority
                    </span>
                </div>
            )}

            {/* Header & Breadcrumb */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="min-w-0 flex-1">
                    {breadcrumb && (
                        <span className="text-[9px] font-extrabold text-amber-600 uppercase tracking-wider block mb-1 truncate">
                            {breadcrumb}
                        </span>
                    )}
                    <h4 className="font-black text-slate-900 text-sm sm:text-base leading-snug">
                        {topic.lesson_number ? `Topic ${topic.lesson_number}: ` : ''}{topic.title}
                    </h4>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {onToggleSpotlight && (
                        <button
                            type="button"
                            onClick={() => onToggleSpotlight(topic.id)}
                            className={`p-1.5 rounded-xl border transition-all flex items-center gap-1 cursor-pointer text-xs font-bold ${
                                isStudentSpotlight
                                    ? 'bg-amber-100 border-amber-300 text-amber-800 shadow-2xs'
                                    : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-amber-600 hover:bg-amber-50/50'
                            }`}
                            title={isStudentSpotlight ? 'My Spotlight (Click to remove)' : 'Set as My Spotlight'}
                        >
                            <Star className={`w-4 h-4 ${isStudentSpotlight ? 'fill-amber-500 text-amber-500' : ''}`} />
                            <span className="hidden sm:inline text-[10px]">
                                {isStudentSpotlight ? 'My Spotlight' : 'Spotlight'}
                            </span>
                        </button>
                    )}

                    <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                        isCompleted
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}>
                        {isCompleted ? 'Completed ✓' : 'Active'}
                    </span>
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                            aria-label="Close topic viewer"
                        >
                            <X className="w-4.5 h-4.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Description HTML / Loading Skeleton / Error State */}
            {isLoadingDescription ? (
                <div className="space-y-2.5 py-4 px-3.5 bg-slate-50/60 rounded-2xl border border-slate-100 animate-pulse">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Loading lesson guide...</span>
                    </div>
                    <div className="h-2.5 bg-slate-200/80 rounded w-5/6" />
                    <div className="h-2.5 bg-slate-200/80 rounded w-full" />
                    <div className="h-2.5 bg-slate-200/80 rounded w-4/6" />
                </div>
            ) : descriptionError ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-3 text-left">
                    <p className="text-xs font-semibold text-rose-700">Unable to load lesson instructions.</p>
                    {onRetryDescription && (
                        <button
                            type="button"
                            onClick={onRetryDescription}
                            className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0"
                        >
                            Retry
                        </button>
                    )}
                </div>
            ) : activeDescription ? (
                <div 
                    className="text-xs text-slate-600 leading-relaxed tutorial-content max-w-none bg-slate-50/50 p-3.5 rounded-2xl border border-slate-100"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(activeDescription) }}
                />
            ) : null}

            {/* Metadata Badges */}
            <div className="flex flex-wrap gap-2 pt-0.5">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-600 bg-slate-100/80 border border-slate-200/60 px-2.5 py-1 rounded-full">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {getCleanDuration(topic.duration, topic.file_size) || '5 mins'}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-600 bg-slate-100/80 border border-slate-200/60 px-2.5 py-1 rounded-full">
                    <Award className="w-3 h-3 text-slate-400" />
                    {topic.difficulty || 'Easy'}
                </span>
                {topic.file_size && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-600 bg-slate-100/80 border border-slate-200/60 px-2.5 py-1 rounded-full">
                        💾 {topic.file_size}
                    </span>
                )}
                {topic.material_type && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#7C5E3F] bg-[#FAF5EE] border border-[#7C5E3F]/10 px-2.5 py-1 rounded-full capitalize">
                        {topic.material_type === 'pdf' ? <FileText className="w-3 h-3" /> : 
                         topic.material_type === 'audio' ? <Music className="w-3 h-3" /> : 
                         (topic.material_type === 'video' || topic.material_type === 'youtube_url') ? <Video className="w-3 h-3" /> : 
                         <Info className="w-3 h-3" />}
                        {topic.material_type === 'youtube_url' ? 'YouTube Video' : topic.material_type}
                    </span>
                )}
            </div>

            {/* Key Practice Focus / Bullet Points */}
            {topic.bullet_points && topic.bullet_points.length > 0 && (
                <div className="pt-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 font-mono">
                        Key Practice Focus
                    </span>
                    <ul className="space-y-2 text-left bg-amber-50/40 border border-amber-100/80 p-3 rounded-2xl">
                        {topic.bullet_points.map((pt: string, idx: number) => (
                            <li key={idx} className="text-xs text-slate-700 flex items-start gap-2 leading-relaxed">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                                <span className="flex-1"><AutoLinkText text={pt} /></span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-3 border-t border-slate-100">
                {hasResource ? (
                    <button
                        type="button"
                        onClick={onOpenMaterial}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-950 text-xs font-black rounded-xl shadow-xs transition-all active:scale-[0.98] cursor-pointer"
                    >
                        <BookOpen className="w-4 h-4 text-slate-900" /> 
                        <span>Open Learning Material</span>
                    </button>
                ) : (
                    <button
                        type="button"
                        disabled
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-400 text-xs font-bold rounded-xl cursor-not-allowed"
                    >
                        <Info className="w-4 h-4" /> 
                        <span>No Attached File</span>
                    </button>
                )}

                <button
                    type="button"
                    onClick={() => onToggleComplete(topic.id, status)}
                    className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all border flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer ${
                        isCompleted
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                >
                    {isCompleted ? (
                        <>
                            <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                            <span>Completed</span>
                        </>
                    ) : (
                        <span>Mark Complete</span>
                    )}
                </button>
            </div>
        </div>
    );
}
