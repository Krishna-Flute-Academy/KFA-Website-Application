'use client';

import React, { useState } from 'react';
import { supabaseAuth } from '../../lib/supabase-auth';
import { Eye, EyeOff, Lock, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';

interface ForcePasswordChangeModalProps {
    isOpen: boolean;
    userEmail?: string;
    onComplete: () => void;
}

export default function ForcePasswordChangeModal({
    isOpen,
    userEmail = '',
    onComplete
}: ForcePasswordChangeModalProps) {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);

        if (newPassword.length < 6) {
            setErrorMsg('New password must be at least 6 characters long.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setErrorMsg('Passwords do not match. Please re-enter.');
            return;
        }

        setSaving(true);
        try {
            const updatePromise = supabaseAuth.auth.updateUser({
                password: newPassword,
                data: {
                    must_change_password: false,
                    password_changed_at: new Date().toISOString()
                }
            });

            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Password update timed out. Please check your connection and try again.')), 30000)
            );

            const { error } = await Promise.race([updatePromise, timeoutPromise]);

            if (error) {
                throw error;
            }

            try {
                await supabaseAuth.auth.refreshSession();
            } catch (refreshErr) {
                console.warn('Session refresh after password update skipped:', refreshErr);
            }

            setSuccess(true);
            setTimeout(() => {
                onComplete();
            }, 1200);
        } catch (err: any) {
            console.error('Failed to update temporary password:', err);
            setErrorMsg(err?.message || 'Failed to update password. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="force-password-change-title"
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
        >
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-8 text-left relative overflow-hidden">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#a15912] dark:text-[#ecb613] bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 px-3 py-1.5 rounded-full w-fit mb-4">
                    <Lock className="w-3.5 h-3.5" />
                    Security Step Required
                </div>

                <h2 id="force-password-change-title" className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    Set Your New Password
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                    You signed in using a temporary password provided by the academy{userEmail ? ` for ${userEmail}` : ''}. Please create your own personal password to secure your account.
                </p>

                {success ? (
                    <div className="py-6 flex flex-col items-center text-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                            <CheckCircle2 className="w-7 h-7" />
                        </div>
                        <h3 className="text-base font-bold text-emerald-800 dark:text-emerald-300">
                            Password Updated Successfully!
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Opening your student dashboard...
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {errorMsg && (
                            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-start gap-2">
                                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label htmlFor="force-new-password" className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                                New Password <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    id="force-new-password"
                                    type={showNewPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="At least 6 characters"
                                    required
                                    disabled={saving}
                                    autoComplete="new-password"
                                    className="w-full h-11 pl-4 pr-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-[#a15912] focus:border-transparent outline-none transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    aria-label="Toggle new password visibility"
                                >
                                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="force-confirm-password" className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                                Confirm New Password <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    id="force-confirm-password"
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Re-enter your new password"
                                    required
                                    disabled={saving}
                                    autoComplete="new-password"
                                    className="w-full h-11 pl-4 pr-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-[#a15912] focus:border-transparent outline-none transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    aria-label="Toggle confirm password visibility"
                                >
                                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full h-11 mt-2 bg-[#a15912] hover:bg-[#8a4b0f] text-white text-sm font-bold rounded-xl shadow-lg shadow-[#a15912]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Updating Password...</span>
                                </>
                            ) : (
                                <span>Save New Password & Continue</span>
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
