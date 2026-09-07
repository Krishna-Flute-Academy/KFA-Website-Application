'use client';

import React, { useEffect, useState } from 'react';
import { FileText, Info, Music, BookOpen, ZoomIn, ZoomOut, RotateCcw, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { detectMaterialType } from '../lib/curriculum-media';

interface Props {
    url?: string | null;
    title: string;
    materialType?: string | null;
    viewerName?: string | null;
    viewerEmail?: string | null;
    getYouTubeEmbedUrl?: (url: string) => string;
    showWatermark?: boolean;
}

export default function SecureCurriculumMaterial({ url, title, materialType, viewerName, viewerEmail, getYouTubeEmbedUrl = value => value, showWatermark = false }: Props) {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // Reset zoom and pan position whenever the material URL changes
    useEffect(() => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
        setIsDragging(false);
    }, [url]);

    const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 4));
    const handleZoomOut = () => {
        setScale(prev => {
            const next = Math.max(prev - 0.25, 0.5);
            if (next <= 1) setPosition({ x: 0, y: 0 });
            return next;
        });
    };
    const handleZoomReset = () => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    };

    // Mouse dragging handlers
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

    // Touch dragging handlers for mobile devices
    const handleTouchStart = (e: React.TouchEvent) => {
        if (scale <= 1 || e.touches.length !== 1) return;
        const touch = e.touches[0];
        setIsDragging(true);
        setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging || e.touches.length !== 1) return;
        const touch = e.touches[0];
        setPosition({ x: touch.clientX - dragStart.x, y: touch.clientY - dragStart.y });
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
    };

    // Mouse wheel zoom handler
    const handleWheel = (e: React.WheelEvent) => {
        const zoomFactor = e.deltaY < 0 ? 0.15 : -0.15;
        setScale(prevScale => {
            const newScale = Math.min(Math.max(0.5, prevScale + zoomFactor), 4);
            if (newScale <= 1) setPosition({ x: 0, y: 0 });
            return newScale;
        });
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
    const detectedType = detectMaterialType(url, materialType);
    const isYouTube = detectedType === 'youtube';
    const isPdf = detectedType === 'pdf';
    const isAudio = detectedType === 'audio';
    const isVideo = detectedType === 'video';
    const isImage = detectedType === 'image';
    const isLink = detectedType === 'link';

    return (
        <div className="relative w-full h-full overflow-hidden select-none" onContextMenu={event => event.preventDefault()} onDragStart={event => event.preventDefault()} onCopy={event => event.preventDefault()}>
            {!url || detectedType === 'none' ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-slate-400 bg-white dark:bg-slate-900">
                    <Info className="w-12 h-12 text-slate-300 mb-3" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No material available</p>
                </div>
            ) : isYouTube ? (
                <iframe src={getYouTubeEmbedUrl(url)} className="w-full h-full border-0" allow="accelerometer; autoplay; encrypted-media; gyroscope" referrerPolicy="strict-origin-when-cross-origin" title={title} />
            ) : isPdf ? (
                <div className="relative w-full h-full bg-slate-900 flex flex-col overflow-hidden select-none">
                    {/* Top PDF Quick Action Bar */}
                    <div className="w-full bg-slate-950/90 border-b border-slate-800 px-4 py-2 flex items-center justify-between z-10 shrink-0 text-slate-300 text-xs font-mono">
                        <div className="flex items-center gap-2 truncate pr-2">
                            <FileText className="size-4 text-red-400 shrink-0" />
                            <span className="truncate font-bold text-white text-[11px]">{title}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 hover:text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                            >
                                <ExternalLink className="size-3" />
                                Open Full View
                            </a>
                        </div>
                    </div>

                    {/* PDF Viewer Frame */}
                    <div className="w-full flex-1 min-h-0 bg-slate-800 relative">
                        <object
                            data={`${url}#toolbar=1&navpanes=0&scrollbar=1&page=1&view=FitH`}
                            type="application/pdf"
                            className="w-full h-full border-0 bg-white"
                        >
                            <iframe
                                src={`${url}#toolbar=1&navpanes=0&scrollbar=1&page=1&view=FitH`}
                                className="w-full h-full border-0 bg-white"
                                title={title}
                            />
                        </object>
                    </div>
                </div>
            ) : isAudio ? (
                <div className="w-full h-full p-8 bg-white dark:bg-slate-900 flex flex-col items-center justify-center gap-6"><Music className="w-16 h-16 text-amber-500" /><h4 className="font-bold text-slate-800 dark:text-white">{title}</h4><audio src={url} controls controlsList="nodownload noplaybackrate" className="w-full max-w-xl" /></div>
            ) : isVideo ? (
                <video src={url} controls controlsList="nodownload noplaybackrate nofullscreen" disablePictureInPicture className="w-full h-full object-contain bg-black" />
            ) : isImage ? (
                <div className="relative w-full h-full bg-slate-950 flex flex-col overflow-hidden select-none">
                    {/* Top Image Quick Action Bar */}
                    <div className="w-full bg-slate-950/90 border-b border-slate-800 px-4 py-2 flex items-center justify-between z-10 shrink-0 text-slate-300 text-xs font-mono">
                        <div className="flex items-center gap-2 truncate pr-2">
                            <ImageIcon className="size-4 text-emerald-400 shrink-0" />
                            <span className="truncate font-bold text-white text-[11px]">{title}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 hover:text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                            >
                                <ExternalLink className="size-3" />
                                Open Full View
                            </a>
                        </div>
                    </div>

                    {/* Zoomable & Pannable Image Canvas Container */}
                    <div 
                        className="relative w-full flex-1 min-h-0 bg-slate-950 flex items-center justify-center overflow-hidden cursor-default select-none"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUpOrLeave}
                        onMouseLeave={handleMouseUpOrLeave}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        onWheel={handleWheel}
                    >
                        {/* Zoomable & Pannable Image Wrapper */}
                        <div 
                            className="select-none flex items-center justify-center w-full h-full p-2"
                            style={{
                                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                                transition: isDragging ? 'none' : 'transform 150ms ease-out',
                                cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                                transformOrigin: 'center center',
                            }}
                        >
                            <img 
                                src={url} 
                                alt={title} 
                                draggable={false} 
                                className="max-w-full max-h-full object-contain pointer-events-none select-none rounded-lg shadow-2xl" 
                            />
                        </div>

                        {/* Floating Zoom & Pan Control Bar */}
                        <ZoomControlBar 
                            scale={scale} 
                            position={position} 
                            onZoomIn={handleZoomIn} 
                            onZoomOut={handleZoomOut} 
                            onReset={handleZoomReset} 
                        />
                    </div>
                </div>
            ) : isLink ? (
                <div className="relative w-full h-full bg-slate-900 flex flex-col overflow-hidden select-none">
                    {/* Top Link Quick Action Bar */}
                    <div className="w-full bg-slate-950/90 border-b border-slate-800 px-4 py-2 flex items-center justify-between z-10 shrink-0 text-slate-300 text-xs font-mono">
                        <div className="flex items-center gap-2 truncate pr-2">
                            <BookOpen className="size-4 text-blue-400 shrink-0" />
                            <span className="truncate font-bold text-white text-[11px]">{title}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 hover:text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                            >
                                <ExternalLink className="size-3" />
                                Open Full View
                            </a>
                        </div>
                    </div>

                    {/* Embedded Web / Blog Iframe */}
                    <div className="w-full flex-1 min-h-0 bg-white relative">
                        <iframe
                            src={url}
                            className="w-full h-full border-0 bg-white"
                            title={title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            loading="lazy"
                        />
                    </div>
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

function ZoomControlBar({
    scale,
    position,
    onZoomIn,
    onZoomOut,
    onReset,
}: {
    scale: number;
    position: { x: number; y: number };
    onZoomIn: () => void;
    onZoomOut: () => void;
    onReset: () => void;
}) {
    return (
        <div className="absolute top-4 right-4 z-40 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-2xl p-1.5 flex items-center gap-1 shadow-xl text-slate-300 select-none">
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onZoomOut(); }}
                disabled={scale <= 0.5}
                className="size-8 rounded-xl flex items-center justify-center hover:bg-slate-800 hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none"
                title="Zoom Out (-)"
            >
                <ZoomOut className="size-4" />
            </button>
            <span className="text-[10px] font-black font-mono px-1.5 uppercase text-slate-300 select-none min-w-[42px] text-center">
                {Math.round(scale * 100)}%
            </span>
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onZoomIn(); }}
                disabled={scale >= 4}
                className="size-8 rounded-xl flex items-center justify-center hover:bg-slate-800 hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none"
                title="Zoom In (+)"
            >
                <ZoomIn className="size-4" />
            </button>
            <div className="h-4 w-px bg-slate-700/60 mx-0.5" />
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onReset(); }}
                disabled={scale === 1 && position.x === 0 && position.y === 0}
                className="size-8 rounded-xl flex items-center justify-center hover:bg-slate-800 hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none"
                title="Reset Zoom & Pan"
            >
                <RotateCcw className="size-3.5" />
            </button>
        </div>
    );
}
