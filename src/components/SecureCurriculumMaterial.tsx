'use client';

import React, { useEffect } from 'react';
import { FileText, Info, Music } from 'lucide-react';

interface Props {
    url?: string | null;
    title: string;
    materialType?: string | null;
    viewerName?: string | null;
    viewerEmail?: string | null;
    getYouTubeEmbedUrl?: (url: string) => string;
}

export default function SecureCurriculumMaterial({ url, title, materialType, viewerName, viewerEmail, getYouTubeEmbedUrl = value => value }: Props) {
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
    const isImage = /\.(png|jpe?g|gif|svg|webp)$/.test(lowerUrl);

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
                <div className="w-full h-full p-4 flex items-center justify-center bg-slate-950"><img src={url} alt={title} draggable={false} className="max-w-full max-h-full object-contain pointer-events-none" /></div>
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-slate-900"><FileText className="w-16 h-16 text-slate-400 mb-4" /><h4 className="font-bold text-slate-800 dark:text-white">Preview unavailable</h4><p className="text-xs text-slate-500 max-w-md mt-2">For content protection, this file type cannot be opened or downloaded from the dashboard.</p></div>
            )}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 overflow-hidden opacity-[0.16]"><div className="absolute inset-[-20%] grid grid-cols-3 gap-x-12 gap-y-20 rotate-[-24deg] place-items-center">{Array.from({ length: 24 }).map((_, index) => <span key={index} className="whitespace-nowrap text-[11px] font-black uppercase tracking-wider text-white mix-blend-difference">{watermark}</span>)}</div></div>
        </div>
    );
}
