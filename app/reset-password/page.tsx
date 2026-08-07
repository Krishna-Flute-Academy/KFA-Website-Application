'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Eye, EyeOff, CheckCircle2, ShieldAlert } from 'lucide-react';
import { supabaseAuth } from '../../src/lib/supabase-auth';

export default function ResetPasswordPage() {
    const router = useRouter();
    
    // Form and UI States
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    
    const [checkingSession, setCheckingSession] = useState(true);
    const [sessionError, setSessionError] = useState<string | null>(null);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [countdown, setCountdown] = useState(5);

    // Verify authenticated session on mount
    useEffect(() => {
        const verifySession = async () => {
            try {
                // Wait a moment for any in-flight session initialization to finish
                await new Promise(resolve => setTimeout(resolve, 800));
                
                const { data: { session }, error: err } = await supabaseAuth.auth.getSession();
                
                if (err || !session) {
                    setSessionError('No active recovery session found. Please request a new password reset link.');
                }
            } catch (e) {
                setSessionError('An unexpected error occurred. Please try again.');
            } finally {
                setCheckingSession(false);
            }
        };

        verifySession();
    }, []);

    // Countdown and redirect on success
    useEffect(() => {
        if (!success) return;
        
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    // Sign out to ensure they log in with the new password
                    supabaseAuth.auth.signOut().then(() => {
                        router.push('/login');
                    });
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [success, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (password.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setUpdating(true);
        try {
            const { error: updateError } = await supabaseAuth.auth.updateUser({
                password: password,
            });

            if (updateError) {
                setError(updateError.message);
            } else {
                setSuccess(true);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update password. Please try again.');
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div className="bg-[#f8f7f6] dark:bg-[#211911] font-sans text-slate-900 dark:text-slate-100 antialiased h-screen overflow-hidden">
            <div className="flex h-full w-full">
                {/* Left Side: Image Content */}
                <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#a15912]/10">
                    <div
                        className="absolute inset-0 bg-cover bg-center"
                        title="Close up of a handcrafted wooden bansuri flute on a silk cloth"
                        style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDFmuriD7E2DUGbyVFwITHGKIHWjQsGPWNTIyYLdmRb7XrSsfuyFsJaRn6oZO59IBYHxfEUF1Ca5AP9Jq5rK_M9GQij4KlQzZdrK5to3Nouq28eTavAuLAOab0xHI8xgyF6aUYa5HB6g78CmYJMVHuTtxkmwRQzbiTE6iYB_jd-RlAR2Qktfc_Hnz_B_RoSIbTKZN7EpETTp7xVoJfF2n47da9vdTH7zHUFDbqh0pHPiEqVpra3_8dj_EQa4WsmV-6gaPuUMLwWVynN")' }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#211911]/60 via-transparent to-transparent" />
                    <div className="absolute bottom-12 left-12 right-12 text-white">
                        <h1 className="text-4xl font-bold leading-tight mb-4">Reset Your Password</h1>
                        <p className="text-lg opacity-90 max-w-md">Secure your account with a new password and return to your learning dashboard.</p>
                    </div>
                </div>

                {/* Right Side: Form */}
                <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 lg:px-24 xl:px-32 bg-[#f8f7f6] dark:bg-[#211911]">
                    <div className="max-w-[420px] w-full mx-auto">
                        {/* Header / Logo */}
                        <div className="mb-8 flex flex-col items-center lg:items-start">
                            <div className="flex items-center gap-3 mb-6">
                                <Link href="/" className="flex items-center gap-3 group">
                                    <div className="w-10 h-10 bg-[#a15912] rounded-lg flex items-center justify-center text-white group-hover:bg-[#8a4b0f] transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                        </svg>
                                    </div>
                                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-[#a15912] transition-colors">Krishna Flute Academy</h2>
                                </Link>
                            </div>
                            <h3 className="text-3xl font-bold mb-2">Create New Password</h3>
                            <p className="text-slate-600 dark:text-slate-400">Please enter your new password below.</p>
                        </div>

                        {/* Loading / Verifying Session State */}
                        {checkingSession ? (
                            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                                <Loader2 className="w-8 h-8 animate-spin text-[#a15912]" />
                                <p className="text-sm font-medium text-slate-500">Verifying security token...</p>
                            </div>
                        ) : sessionError ? (
                            /* Invalid Session State */
                            <div className="space-y-6">
                                <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-2xl flex gap-3 text-left">
                                    <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-bold text-red-800 dark:text-red-400">Invalid or Expired Link</h4>
                                        <p className="text-xs text-red-700 dark:text-red-400/80 mt-1 leading-relaxed">{sessionError}</p>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3">
                                    <Link
                                        href="/forgot-password"
                                        className="w-full h-12 bg-[#a15912] text-white font-bold rounded-lg hover:bg-[#8a4b0f] transition-all flex items-center justify-center"
                                    >
                                        Request New Reset Link
                                    </Link>
                                    <Link
                                        href="/login"
                                        className="w-full h-12 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-center"
                                    >
                                        Back to Login
                                    </Link>
                                </div>
                            </div>
                        ) : success ? (
                            /* Success State */
                            <div className="space-y-6 text-center">
                                <div className="p-6 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-2xl flex flex-col items-center gap-3">
                                    <CheckCircle2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
                                    <div>
                                        <h4 className="text-base font-bold text-emerald-800 dark:text-emerald-400">Password Updated</h4>
                                        <p className="text-xs text-emerald-700 dark:text-emerald-400/80 mt-1 leading-relaxed">
                                            Your password has been changed successfully. You will be redirected to the login page in <span className="font-bold">{countdown}</span> seconds.
                                        </p>
                                    </div>
                                </div>
                                <Link
                                    href="/login"
                                    onClick={() => supabaseAuth.auth.signOut()}
                                    className="w-full h-12 bg-[#a15912] text-white font-bold rounded-lg hover:bg-[#8a4b0f] transition-all flex items-center justify-center"
                                >
                                    Log In Now
                                </Link>
                            </div>
                        ) : (
                            /* Active Reset Form */
                            <form className="space-y-5" onSubmit={handleSubmit}>
                                {error && (
                                    <div className="p-3 bg-red-100 border border-red-400 text-red-700 text-sm rounded-lg">
                                        {error}
                                    </div>
                                )}

                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">New Password</label>
                                    <div className="relative">
                                        <input
                                            className="w-full h-12 pl-4 pr-12 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#a15912] focus:border-transparent outline-none transition-all"
                                            placeholder="••••••••"
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            disabled={updating}
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Confirm New Password</label>
                                    <div className="relative">
                                        <input
                                            className="w-full h-12 pl-4 pr-12 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#a15912] focus:border-transparent outline-none transition-all"
                                            placeholder="••••••••"
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            disabled={updating}
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                        >
                                            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    disabled={updating}
                                    className="w-full h-12 bg-[#a15912] text-white font-bold rounded-lg shadow-lg shadow-[#a15912]/20 hover:bg-[#8a4b0f] transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    <span>{updating ? 'Updating Password...' : 'Reset Password'}</span>
                                    {updating && <Loader2 className="w-5 h-5 animate-spin" />}
                                    {!updating && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                                </button>
                            </form>
                        )}

                        {/* Footer */}
                        <div className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
                            Back to
                            <Link className="font-bold text-[#a15912] hover:underline ml-1" href="/login">
                                Login Page
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
