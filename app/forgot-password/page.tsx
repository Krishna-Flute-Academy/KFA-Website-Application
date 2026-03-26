'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2 } from 'lucide-react';
import { supabaseAuth } from '../../src/lib/supabase-auth';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);

        if (!email) {
            setError('Please enter your email address.');
            return;
        }

        setLoading(true);
        const { data, error: resetError } = await supabaseAuth.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        });

        if (resetError) {
            setError(resetError.message);
            setLoading(false);
        } else {
            setSuccessMessage('Password reset instructions have been sent to your email.');
            setLoading(false);
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
                        <h1 className="text-4xl font-bold leading-tight mb-4">Regain Access</h1>
                        <p className="text-lg opacity-90 max-w-md">Recover your account to continue your musical journey with the Krishna Flute Academy.</p>
                    </div>
                </div>

                {/* Right Side: Form */}
                <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 lg:px-24 xl:px-32 bg-[#f8f7f6] dark:bg-[#211911]">
                    <div className="max-w-[420px] w-full mx-auto">
                        {/* Header / Logo */}
                        <div className="mb-10 flex flex-col items-center lg:items-start">
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
                            <h3 className="text-3xl font-bold mb-2">Reset Password</h3>
                            <p className="text-slate-600 dark:text-slate-400">Enter your email address and we'll send you a link to reset your password.</p>
                        </div>

                        {/* Form */}
                        <form className="space-y-5" onSubmit={handleResetPassword}>
                            {error && (
                                <div className="p-3 bg-red-100 border border-red-400 text-red-700 text-sm rounded">
                                    {error}
                                </div>
                            )}

                            {successMessage && (
                                <div className="p-3 bg-green-100 border border-green-400 text-green-700 text-sm rounded">
                                    {successMessage}
                                </div>
                            )}

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email Address</label>
                                <div className="relative">
                                    <input
                                        className="w-full h-12 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#a15912] focus:border-transparent outline-none transition-all"
                                        placeholder="name@example.com"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        disabled={loading || !!successMessage}
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                disabled={loading || !!successMessage}
                                className="w-full h-12 bg-[#a15912] text-white font-bold rounded-lg shadow-lg shadow-[#a15912]/20 hover:bg-[#8a4b0f] transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                <span>{loading ? 'Sending...' : 'Send Reset Link'}</span>
                                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                                {!loading && !successMessage && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                            </button>
                        </form>

                        {/* Footer */}
                        <div className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
                            Remember your password?
                            <Link className="font-bold text-[#a15912] hover:underline ml-1" href="/login">
                                Back to Login
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
