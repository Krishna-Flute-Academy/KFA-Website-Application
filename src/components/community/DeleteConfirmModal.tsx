'use client';

import React, { useState } from 'react';
import { Trash2, AlertTriangle, ShieldAlert, X } from 'lucide-react';

interface DeleteConfirmModalProps {
    isOpen: boolean;
    itemType: 'post' | 'reply';
    isAdminAction: boolean;
    onClose: () => void;
    onConfirm: (reason?: string) => Promise<void>;
}

const MODERATION_REASONS = [
    'Spam',
    'Inappropriate content',
    'Off-topic',
    'Duplicate',
    'Other'
];

export default function DeleteConfirmModal({
    isOpen,
    itemType,
    isAdminAction,
    onClose,
    onConfirm
}: DeleteConfirmModalProps) {
    const [selectedReason, setSelectedReason] = useState<string>('');
    const [customReason, setCustomReason] = useState<string>('');
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        setIsDeleting(true);
        setError(null);
        try {
            let finalReason: string | undefined = undefined;
            if (isAdminAction) {
                if (selectedReason === 'Other' && customReason.trim()) {
                    finalReason = `Other: ${customReason.trim()}`;
                } else if (selectedReason) {
                    finalReason = selectedReason;
                }
            }
            await onConfirm(finalReason);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to remove content.');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div 
                className="bg-white dark:bg-[#1a140e] border border-amber-900/10 dark:border-amber-500/20 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-confirm-title"
            >
                {/* Header Icon & Title */}
                <div className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                            isAdminAction 
                                ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300' 
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}>
                            {isAdminAction ? (
                                <ShieldAlert className="w-6 h-6" />
                            ) : (
                                <AlertTriangle className="w-6 h-6" />
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            aria-label="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div>
                        <h3 id="delete-confirm-title" className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                            {isAdminAction
                                ? 'Remove this content from the Community?'
                                : itemType === 'post'
                                ? 'Delete this post?'
                                : 'Delete this reply?'}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                            {isAdminAction
                                ? 'As an administrator, removing this content will hide it from the community for moderation and accountability purposes.'
                                : itemType === 'post'
                                ? 'This will remove this post from the community. This action may also affect the discussion underneath it.'
                                : 'This reply will be removed from the discussion.'}
                        </p>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs rounded-xl border border-red-200 dark:border-red-900/50">
                            {error}
                        </div>
                    )}

                    {/* Admin Moderation Optional Reason */}
                    {isAdminAction && (
                        <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                Optional moderation reason:
                            </label>
                            <div className="grid grid-cols-2 gap-1.5">
                                {MODERATION_REASONS.map((r) => (
                                    <button
                                        key={r}
                                        type="button"
                                        onClick={() => setSelectedReason(selectedReason === r ? '' : r)}
                                        className={`px-3 py-2 text-xs font-semibold rounded-xl border text-left transition-all ${
                                            selectedReason === r
                                                ? 'border-red-500 bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-200 font-bold'
                                                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                            {selectedReason === 'Other' && (
                                <input
                                    type="text"
                                    value={customReason}
                                    onChange={(e) => setCustomReason(e.target.value)}
                                    placeholder="Specify details..."
                                    maxLength={120}
                                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#faf8f5] dark:bg-[#120d09] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-red-500 mt-1"
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50/70 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isDeleting}
                        className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isDeleting}
                        className={`inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl text-white shadow-xs transition-all disabled:opacity-50 ${
                            isAdminAction
                                ? 'bg-red-700 hover:bg-red-800'
                                : 'bg-red-600 hover:bg-red-700'
                        }`}
                    >
                        {isDeleting ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Removing...</span>
                            </>
                        ) : (
                            <>
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{isAdminAction ? 'Remove Content' : 'Delete'}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
