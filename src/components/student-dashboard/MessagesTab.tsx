'use client';

import React from 'react';
import { Mail, Loader2, Volume2 } from 'lucide-react';

interface Broadcast {
    id: string;
    channel: string;
    subject: string;
    content: string;
    audio_attachment?: string | null;
    created_at: string;
    sender?: {
        name: string;
        role: string;
    } | null;
}

interface MessagesTabProps {
    broadcasts: Broadcast[];
    playVoiceNote: (id: string, audioAttachment: string) => void;
    playingAudioId: string | null;
}

/**
 * MessagesTab displays the instructor announcements, bulletins, and audio voice messages.
 */
export default function MessagesTab({
    broadcasts,
    playVoiceNote,
    playingAudioId
}: MessagesTabProps) {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs text-left">
                <h3 className="font-extrabold text-slate-800 text-base mb-1">Message Center</h3>
                <p className="text-xs text-slate-500 mb-6">Timeline of announcements and practice alerts sent by the teacher</p>

                {broadcasts.length === 0 ? (
                    <div className="py-12 border border-dashed border-slate-100 rounded-2xl text-center bg-slate-50/50">
                        <Mail className="w-10 h-10 text-slate-350 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-700">Inbox empty.</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">You don't have any messages yet.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {broadcasts.map((b) => {
                            const isAdmin = b.sender?.role === 'admin';
                            return (
                                <div 
                                    key={b.id} 
                                    className={`transition-all flex flex-col justify-between gap-4 text-left p-5 rounded-2xl ${
                                        isAdmin 
                                            ? 'bg-[#FAF5EE]/70 border-2 border-[#7C5E3F]/35 hover:bg-[#FAF5EE]/90 shadow-xs' 
                                            : 'bg-slate-50/40 border border-slate-150 hover:bg-slate-50/80 shadow-2xs'
                                    }`}
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h4 className="font-extrabold text-xs md:text-sm text-slate-800">{b.subject}</h4>
                                                {isAdmin && (
                                                    <span className="inline-flex items-center gap-1 text-[8px] font-black text-[#7C5E3F] bg-amber-100 px-2 py-0.5 rounded uppercase tracking-wider shrink-0">
                                                        📢 Admin Notice
                                                    </span>
                                                )}
                                            </div>
                                            <span className="inline-block text-[8px] font-black text-amber-600 bg-amber-50 rounded px-1.5 py-0.5 mt-1 uppercase tracking-wider">
                                                Channel: {b.channel}
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                                            {new Date(b.created_at).toLocaleDateString()} at {new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>

                                    <p className="text-xs text-slate-650 leading-relaxed whitespace-pre-wrap">
                                        {b.content}
                                    </p>

                                    {/* Audio Note attachment */}
                                    {b.audio_attachment && (
                                        <div className="pt-2">
                                            <button 
                                                onClick={() => playVoiceNote(b.id, b.audio_attachment!)}
                                                className={`inline-flex items-center gap-2 px-4 py-2 border rounded-full text-xs font-extrabold transition-all shadow-2xs ${
                                                    playingAudioId === b.id 
                                                        ? 'bg-amber-500 text-white border-amber-600'
                                                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                                                }`}
                                            >
                                                {playingAudioId === b.id ? (
                                                    <>
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        Playing Audio...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Volume2 className="w-3.5 h-3.5 text-amber-500" />
                                                        Listen to Voice Note / Flute Tone
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
