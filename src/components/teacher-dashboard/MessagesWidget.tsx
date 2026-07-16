'use client';

import React from 'react';
import Link from 'next/link';
import { MessageSquare, Loader2 } from 'lucide-react';

interface Inquiry {
    id: string;
    name: string;
    email: string;
    phone: string;
    message: string;
    course?: string;
    created_at: string;
}

interface MessagesWidgetProps {
    inquiries: Inquiry[];
    inquiriesLoading: boolean;
}

/**
 * MessagesWidget displays student inquiries from the contact forms.
 * Enables quick email reply actions and WhatsApp chat generation.
 */
export default function MessagesWidget({
    inquiries,
    inquiriesLoading
}: MessagesWidgetProps) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-auto max-h-[380px] md:h-[480px] text-left">
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-50/50 to-orange-50/10 dark:from-amber-955/10 dark:to-orange-955/5">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-[#ecb613]" />
                    <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">Messages & Inquiries</h3>
                </div>
                <Link className="text-[10px] sm:text-xs font-bold text-[#ecb613] hover:underline" href="/teacher-dashboard/messages">Reply</Link>
            </div>
            
            <div className="p-3 sm:p-6 flex-1 overflow-y-auto space-y-4 custom-scrollbar bg-slate-50/30 dark:bg-slate-900/10">
                {inquiriesLoading ? (
                    <div className="flex flex-col items-center justify-center py-10 md:h-full space-y-2">
                        <Loader2 className="w-6 h-6 animate-spin text-[#ecb613]" />
                        <p className="text-xs text-slate-400">Loading student messages...</p>
                    </div>
                ) : inquiries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 md:h-full text-center p-4">
                        <MessageSquare className="w-8 h-8 text-slate-300 mb-2 animate-pulse" />
                        <p className="text-sm font-semibold text-slate-500">No student messages</p>
                        <p className="text-xs text-slate-400 max-w-[240px] mt-1 leading-relaxed">
                            New inquiries from the website contact form will appear here.
                        </p>
                    </div>
                ) : (
                    inquiries.map(inq => {
                        const whatsappText = encodeURIComponent(`Hi ${inq.name}, thank you for contacting Krishna Flute Academy! This is Sri Krishna Gopal Bhaumik. I received your inquiry about the ${inq.course || 'Beginner Course'}.`);
                        const cleanPhone = (inq.phone || '').replace(/[^0-9]/g, '');
                        const whatsappUrl = `https://wa.me/${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}?text=${whatsappText}`;
                        
                        return (
                            <div key={inq.id} className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-xs space-y-2 hover:border-slate-200 dark:hover:border-slate-600 transition-colors">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">{inq.name}</h4>
                                        {inq.course && (
                                            <span className="inline-block px-2 py-0.5 mt-1 bg-yellow-50 dark:bg-yellow-955/20 text-[#a15912] dark:text-yellow-400 rounded-md text-[9px] font-bold uppercase border border-yellow-100 dark:border-yellow-900/30">
                                                {inq.course}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-semibold">
                                        {inq.created_at ? new Date(inq.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Recent'}
                                    </span>
                                </div>
                                {inq.message ? (
                                    <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100/50 dark:border-slate-800/50 italic leading-relaxed whitespace-pre-line">
                                        "{inq.message}"
                                    </p>
                                ) : (
                                    <p className="text-xs text-slate-400 italic">No custom message provided.</p>
                                )}
                                <div className="flex items-center justify-between border-t border-slate-50 dark:border-slate-700/50 pt-2 mt-2">
                                    <div className="flex flex-col text-[10px] text-slate-500">
                                        {inq.email && <a href={`mailto:${inq.email}`} className="hover:text-[#ecb613] hover:underline font-medium truncate max-w-[150px]">{inq.email}</a>}
                                        {inq.phone && <a href={`tel:${inq.phone}`} className="hover:text-[#ecb613] hover:underline font-bold mt-0.5">{inq.phone}</a>}
                                    </div>
                                    {inq.phone && (
                                        <a 
                                            href={whatsappUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-[10px] font-bold transition-all flex items-center gap-1 shadow-sm shadow-emerald-500/10"
                                        >
                                            Chat via WhatsApp
                                        </a>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
