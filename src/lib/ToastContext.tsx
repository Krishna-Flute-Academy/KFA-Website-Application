'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Check, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextProps {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'success') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { id, message, type }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

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

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {/* Global Toasts Container - Bottom Right Corner */}
            <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full select-text pointer-events-none">
                {toasts.map(toast => (
                    <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
                ))}
            </div>
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
