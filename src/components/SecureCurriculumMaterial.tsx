'use client';

import React, { useEffect, useState } from 'react';
import { FileText, Info, Music, BookOpen, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface Props {
    url?: string | null;
    title: string;
    materialType?: string | null;
    viewerName?: string | null;
    viewerEmail?: string | null;
    getYouTubeEmbedUrl?: (url: string) => string;
    showWatermark?: boolean;
}

export default function SecureCurriculumMaterial({ url, title, materialType, viewerName, viewerEmail, getYouTubeEmbedUrl = value => value, showWatermark = true }: Props) {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 4));
    const handleZoomOut = () => {
        setScale(prev => {
            const next = Math.max(prev - 0.25, 0.5);
            if (next === 1) setPosition({ x: 0, y: 0 });
            return next;
        });
    };
    const handleZoomReset = () => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (scale <= 1) return;
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    };

    const handleMouseUpOrLeave = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        const blockShortcut = (event: KeyboardEvent) => {
            const key = event.key.toLowerCase();
            if ((event.ctrlKey || event.metaKey) && ['s', 'p', 'u', 'c'].includes(key)) event.preventDefault();
        };
        const blockClipboard = (event: ClipboardEvent) => event.preventDefault();
        const blockContextMenu = (event: MouseEvent) => event.preventDefault();
        document.addEventListener('keydown', blockShortcut, true);
        document.addEventListener('copy', blockClipboard, true);
        document.addEventListener('cut', blockClipboard, true);
        document.addEventListener('contextmenu', blockContextMenu, true);
        return () => {
            document.removeEventListener('keydown', blockShortcut, true);
            document.removeEventListener('copy', blockClipboard, true);
            document.removeEventListener('cut', blockClipboard, true);
            document.removeEventListener('contextmenu', blockContextMenu, true);
            window.getSelection()?.removeAllRanges();
        };
    }, []);

    const watermark = 'Krishna Flute Academy';
    const lowerUrl = (url || '').toLowerCase().split('?')[0];
    const isYouTube = lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be');
    const isPdf = materialType === 'pdf' || lowerUrl.endsWith('.pdf');
    const isAudio = materialType === 'audio' || /\.(mp3|wav|m4a|ogg)$/.test(lowerUrl);
    const isVideo = materialType === 'video' || /\.(mp4|webm|ogv)$/.test(lowerUrl);
    const isImage = materialType === 'image' || /\.(png|jpe?g|gif|svg|webp)$/.test(lowerUrl);
    const isLink = materialType === 'link' || (!isYouTube && !isPdf && !isAudio && !isVideo && !isImage && !!url);

    return (
        <div className="relative w-full h-full overflow-hidden select-none" onContextMenu={event => event.preventDefault()} onDragStart={event => event.preventDefault()} onCopy={event => event.preventDefault()}>
            {!url ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-slate-400 bg-white dark:bg-slate-900"><Info className="w-12 h-12 text-slate-300 mb-3" /><p className="text-sm font-bold text-slate-700 dark:text-slate-300">No material file is available for this topic.</p></div>
            ) : isYouTube ? (
                <iframe src={getYouTubeEmbedUrl(url)} className="w-full h-full border-0" allow="accelerometer; autoplay; encrypted-media; gyroscope" referrerPolicy="strict-origin-when-cross-origin" title={title} />
            ) : isPdf ? (
                <div className="relative w-full h-full bg-white">
                    <iframe src={`${url}#toolbar=0&navpanes=0&scrollbar=0`} className="pointer-events-none w-full h-full border-0 bg-white" tabIndex={-1} title={title} />
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 rounded-full bg-slate-950/80 px-4 py-2 text-[10px] font-bold text-white">Protected PDF preview — selection and download disabled</div>
                </div>
            ) : isAudio ? (
                <div className="w-full h-full p-8 bg-white dark:bg-slate-900 flex flex-col items-center justify-center gap-6"><Music className="w-16 h-16 text-amber-500" /><h4 className="font-bold text-slate-800 dark:text-white">{title}</h4><audio src={url} controls controlsList="nodownload noplaybackrate" className="w-full max-w-xl" /></div>
            ) : isVideo ? (
                <video src={url} controls controlsList="nodownload noplaybackrate nofullscreen" disablePictureInPicture className="w-full h-full object-contain bg-black" />
            ) : isImage ? (
                <div 
                    className="relative w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden cursor-default select-none"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUpOrLeave}
                    onMouseLeave={handleMouseUpOrLeave}
                >
                    {/* Zoomable Image Wrapper */}
                    <div 
                        className="transition-transform duration-150 ease-out select-none flex items-center justify-center"
                        style={{
                            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                            width: '100%',
                            height: '100%',
                        }}
                    >
                        <img 
                            src={url} 
                            alt={title} 
                            draggable={false} 
                            className="max-w-full max-h-full object-contain pointer-events-none select-none" 
                        />
                    </div>

                    {/* Floating Zoom & Pan Control Bar */}
                    <div className="absolute top-4 right-4 z-40 bg-slate-900/80 backdrop-blur-md border border-slate-750 rounded-2xl p-1.5 flex items-center gap-1 shadow-lg text-slate-350 select-none">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
                            disabled={scale <= 0.5}
                            className="size-8 rounded-xl flex items-center justify-center hover:bg-slate-800 hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none"
                            title="Zoom Out (-)"
                        >
                            <ZoomOut className="size-4" />
                        </button>
                        <span className="text-[10px] font-black font-mono px-1.5 uppercase text-slate-400 select-none">
                            {Math.round(scale * 100)}%
                        </span>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
                            disabled={scale >= 4}
                            className="size-8 rounded-xl flex items-center justify-center hover:bg-slate-800 hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none"
                            title="Zoom In (+)"
                        >
                            <ZoomIn className="size-4" />
                        </button>
                        <div className="h-4 w-px bg-slate-850 mx-0.5"></div>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleZoomReset(); }}
                            disabled={scale === 1 && position.x === 0 && position.y === 0}
                            className="size-8 rounded-xl flex items-center justify-center hover:bg-slate-800 hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none"
                            title="Reset Zoom & Pan"
                        >
                            <RotateCcw className="size-3.5" />
                        </button>
                    </div>
                </div>
            ) : isLink ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-slate-900">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center border border-slate-100 dark:border-slate-700 shadow-sm mb-4">
                        <BookOpen className="w-8 h-8 text-slate-400" />
                    </div>
                    <h4 className="font-bold text-slate-800 dark:text-white text-base mb-2">Material Link Reference</h4>
                    <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
                        This reference link cannot be embedded directly. Click the button below to open it in a new window.
                    </p>
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-[#7C5E3F] hover:bg-[#634a31] text-white text-xs font-black rounded-xl transition-all shadow-md hover:shadow-lg animate-in fade-in-50 duration-300"
                    >
                        <BookOpen className="w-4 h-4" />
                        Open External Reference
                    </a>
                </div>
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-slate-900"><FileText className="w-16 h-16 text-slate-400 mb-4" /><h4 className="font-bold text-slate-800 dark:text-white">Preview unavailable</h4><p className="text-xs text-slate-500 max-w-md mt-2">For content protection, this file type cannot be opened or downloaded from the dashboard.</p></div>
            )}
            {showWatermark && (
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 overflow-hidden opacity-[0.16]"><div className="absolute inset-[-20%] grid grid-cols-3 gap-x-12 gap-y-20 rotate-[-24deg] place-items-center">{Array.from({ length: 24 }).map((_, index) => <span key={index} className="whitespace-nowrap text-[11px] font-black uppercase tracking-wider text-white mix-blend-difference">{watermark}</span>)}</div></div>
            )}
        </div>
    );
}
