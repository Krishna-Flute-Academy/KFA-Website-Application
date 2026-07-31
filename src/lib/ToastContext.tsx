'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Check, AlertCircle, Info, X, Bell } from 'lucide-react';
import { supabaseAuth } from './supabase-auth';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface NotificationPopup {
    id: string;
    title: string;
    message: string;
}

interface ToastContextProps {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [activePopup, setActivePopup] = useState<NotificationPopup | null>(null);
    const shownNotifsRef = useRef<Set<string>>(new Set());

    const showToast = useCallback((message: string, type: ToastType = 'success') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { id, message, type }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const playNotificationSound = useCallback(() => {
        try {
            if (typeof window === 'undefined') return;
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) return;
            
            const audioCtx = new AudioContextClass();
            
            // Note 1: D5 (fundamental frequency, soft sine wave)
            const osc1 = audioCtx.createOscillator();
            const gain1 = audioCtx.createGain();
            osc1.connect(gain1);
            gain1.connect(audioCtx.destination);
            
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
            
            gain1.gain.setValueAtTime(0, audioCtx.currentTime);
            gain1.gain.linearRampToValueAtTime(0.25, audioCtx.currentTime + 0.05);
            gain1.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.8);
            
            osc1.start(audioCtx.currentTime);
            osc1.stop(audioCtx.currentTime + 0.8);
            
            // Note 2: A5 (harmonizing fifth frequency, starting slightly later for chime depth)
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.08); // A5
            
            gain2.gain.setValueAtTime(0, audioCtx.currentTime + 0.08);
            gain2.gain.linearRampToValueAtTime(0.18, audioCtx.currentTime + 0.13);
            gain2.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.9);
            
            osc2.start(audioCtx.currentTime + 0.08);
            osc2.stop(audioCtx.currentTime + 0.9);
            
        } catch (e) {
            console.warn('Failed to play synthesized notification sound:', e);
        }
    }, []);

    const showNotificationPopup = useCallback((title: string, message: string) => {
        const key = `${title}:${message}`;
        if (shownNotifsRef.current.has(key)) {
            return; // skip duplicates within 5 seconds
        }
        shownNotifsRef.current.add(key);
        setTimeout(() => {
            shownNotifsRef.current.delete(key);
        }, 5000);

        // Play the synthesized premium chime sound when the popup triggers
        playNotificationSound();

        const id = Math.random().toString(36).substring(2, 9);
        setActivePopup({ id, title, message });
    }, [playNotificationSound]);

    // Override the native window.alert to automatically convert browser alert popups
    // into beautiful custom toast notifications.
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const originalAlert = window.alert;
            window.alert = (msg: string) => {
                if (!msg) return;
                const lower = msg.toLowerCase();
                const type: ToastType = (
                    lower.includes('fail') || 
                    lower.includes('error') || 
                    lower.includes('invalid') || 
                    lower.includes('please') || 
                    lower.includes('already') ||
                    lower.includes('denied')
                ) ? 'error' : 'success';
                showToast(msg, type);
            };
            return () => {
                window.alert = originalAlert;
            };
        }
    }, [showToast]);

    // Supabase Realtime Notifications listener (global when user is logged in)
    useEffect(() => {
        let isMounted = true;
        let channel: any = null;

        const handleAuthChange = (session: any) => {
            const userId = session?.user?.id;
            
            // Remove existing channel if any
            if (channel) {
                supabaseAuth.removeChannel(channel);
                channel = null;
            }

            if (!userId) return;

            console.log('[Global Realtime] Subscribing to notifications for user:', userId);
            channel = supabaseAuth
                .channel(`global-notifications-${userId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'notifications',
                        filter: `user_id=eq.${userId}`
                    },
                    (payload) => {
                        if (!isMounted) return;
                        const newNotif = payload.new;
                        console.log('[Global Realtime] New notification received:', newNotif);
                        showNotificationPopup(newNotif.title || 'Academy Alert', newNotif.message || '');
                    }
                )
                .subscribe();
        };

        // Get initial session and setup synchronously/safely
        supabaseAuth.auth.getSession().then(({ data: { session } }) => {
            if (isMounted) {
                handleAuthChange(session);
            }
        });

        const { data: { subscription } } = supabaseAuth.auth.onAuthStateChange((event, session) => {
            if (isMounted) {
                handleAuthChange(session);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
            if (channel) {
                supabaseAuth.removeChannel(channel);
            }
        };
    }, [showNotificationPopup]);

    // Service Worker message listener (backup/complementary notification delivery)
    useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            const handleMessage = (event: MessageEvent) => {
                if (event.data && event.data.type === 'PUSH_NOTIFICATION_RECEIVED') {
                    console.log('[Global SW] Received push notification message event:', event.data);
                    showNotificationPopup(event.data.title, event.data.body);
                }
            };
            navigator.serviceWorker.addEventListener('message', handleMessage);
            return () => {
                navigator.serviceWorker.removeEventListener('message', handleMessage);
            };
        }
    }, [showNotificationPopup]);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            
            {/* Global Toasts Container - Bottom Right Corner */}
            <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full select-text pointer-events-none">
                {toasts.map(toast => (
                    <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
                ))}
            </div>

            {/* Global Custom Notification Modal Popup */}
            {activePopup && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="relative max-w-md w-full bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-blue-500/20 flex flex-col items-center text-center overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Decorative glowing background shapes */}
                        <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-yellow-500/10 blur-3xl pointer-events-none" />
                        <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

                        {/* Top close button */}
                        <button 
                            onClick={() => setActivePopup(null)} 
                            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                            aria-label="Close notification"
                        >
                            <X size={20} />
                        </button>

                        {/* Animated bell icon */}
                        <div className="w-16 h-16 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mb-5 animate-bounce shadow-[0_0_20px_rgba(234,179,8,0.2)]">
                            <Bell className="w-8 h-8 text-yellow-400" />
                        </div>

                        {/* Title */}
                        <h3 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-100 mb-3 tracking-wide select-text">
                            {activePopup.title}
                        </h3>

                        {/* Message body */}
                        <div className="text-sm sm:text-base text-slate-300 leading-relaxed mb-6 font-medium max-h-48 overflow-y-auto pr-2 scrollbar-thin select-text">
                            {activePopup.message}
                        </div>

                        {/* CTA Action button */}
                        <button
                            onClick={() => setActivePopup(null)}
                            className="w-full py-3.5 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-slate-950 font-bold rounded-2xl transition-all duration-300 shadow-[0_4px_20px_rgba(234,179,8,0.3)] active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            Okay, Got It
                        </button>
                    </div>
                </div>
            )}
        </ToastContext.Provider>
    );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className="pointer-events-auto bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center justify-between gap-3 border border-slate-800 dark:border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-3">
                {toast.type === 'success' ? (
                    <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : toast.type === 'error' ? (
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                ) : (
                    <Info className="w-5 h-5 text-blue-500 shrink-0" />
                )}
                <p className="text-xs font-bold leading-relaxed">{toast.message}</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white dark:hover:text-slate-900 transition-colors shrink-0">
                <X size={14} />
            </button>
        </div>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}
