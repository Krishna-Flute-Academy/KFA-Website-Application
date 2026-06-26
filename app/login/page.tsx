'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { supabaseAuth } from '../../src/lib/supabase-auth';

function LoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const loginType = searchParams.get('type') || 'student';
    const isTeacher = loginType === 'teacher';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    // ── Google OAuth ──────────────────────────────────────────────────────────
    const handleGoogleSignIn = async () => {
        setGoogleLoading(true);
        setError(null);
        const { error: oauthError } = await supabaseAuth.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
                queryParams: {
                    prompt: 'select_account',
                },
            },
        });
        if (oauthError) {
            setError(oauthError.message);
            setGoogleLoading(false);
        }
        // On success the browser is redirected to Google — no further action needed
    };

    // ── Email / Password Login ────────────────────────────────────────────────
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!email || !password) {
            setError('Please enter both email and password.');
            return;
        }

        setLoading(true);
        const { data, error: signInError } = await supabaseAuth.auth.signInWithPassword({
            email,
            password,
        });

        if (signInError) {
            setError(signInError.message);
            setLoading(false);
            return;
        }

        // Auto-promote admin email
        if (data.user && data.user.email?.toLowerCase() === 'pransai.verse@gmail.com') {
            await supabaseAuth
                .from('users')
                .update({ role: 'admin', status: 'active' })
                .eq('id', data.user.id);
        }

        let userRole =
            data.user?.email?.toLowerCase() === 'pransai.verse@gmail.com'
                ? 'admin'
                : data.user?.user_metadata?.role;

        // Always prefer the role stored in the public.users table
        if (data.user) {
            const { data: userData } = await supabaseAuth
                .from('users')
                .select('role')
                .eq('id', data.user.id)
                .maybeSingle();
            if (userData?.role) userRole = userData.role;
        }

        const normalizedRole = userRole?.toString().toLowerCase();

        if (normalizedRole === 'admin') {
            localStorage.setItem('kfa-user-role', normalizedRole);
            router.push('/teacher-dashboard');
        } else if (normalizedRole === 'teacher') {
            localStorage.setItem('kfa-user-role', normalizedRole);
            router.push('/teacher-dashboard');
        } else if (normalizedRole === 'student') {
            router.push('/student-dashboard');
        } else {
            router.push('/pending-approval');
        }
    };

    return (
        <div className="bg-[#f8f7f6] dark:bg-[#211911] font-sans text-slate-900 dark:text-slate-100 antialiased min-h-screen overflow-hidden">
            <div className="flex min-h-screen w-full">

                {/* ── Left: Hero Image ──────────────────────────────────── */}
                <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#a15912]/10">
                    <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDFmuriD7E2DUGbyVFwITHGKIHWjQsGPWNTIyYLdmRb7XrSsfuyFsJaRn6oZO59IBYHxfEUF1Ca5AP9Jq5rK_M9GQij4KlQzZdrK5to3Nouq28eTavAuLAOab0xHI8xgyF6aUYa5HB6g78CmYJMVHuTtxkmwRQzbiTE6iYB_jd-RlAR2Qktfc_Hnz_B_RoSIbTKZN7EpETTp7xVoJfF2n47da9vdTH7zHUFDbqh0pHPiEqVpra3_8dj_EQa4WsmV-6gaPuUMLwWVynN")' }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#211911]/70 via-transparent to-transparent" />
                    <div className="absolute bottom-12 left-12 right-12 text-white">
                        <h1 className="text-4xl font-bold leading-tight mb-4">Master the Divine Art</h1>
                        <p className="text-lg opacity-90 max-w-md">
                            Join thousands of students learning the traditional Indian flute from the masters of the Krishna Flute Academy.
                        </p>
                    </div>
                </div>

                {/* ── Right: Login Form ─────────────────────────────────── */}
                <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 lg:px-24 xl:px-32 bg-[#f8f7f6] dark:bg-[#211911] overflow-y-auto">
                    <div className="max-w-[420px] w-full mx-auto py-12">

                        {/* Logo */}
                        <div className="mb-8 flex flex-col items-center lg:items-start">
                            <Link href="/" className="flex items-center gap-3 group mb-6">
                                <div className="w-10 h-10 bg-[#a15912] rounded-lg flex items-center justify-center text-white group-hover:bg-[#8a4b0f] transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                    </svg>
                                </div>
                                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-[#a15912] transition-colors">
                                    Krishna Flute Academy
                                </span>
                            </Link>
                            <h2 className="text-3xl font-bold mb-1">
                                {isTeacher ? 'Teacher Login' : 'Welcome back'}
                            </h2>
                            <p className="text-slate-600 dark:text-slate-400">Sign in to access your musical journey.</p>
                        </div>

                        {/* Error Banner */}
                        {error && (
                            <div className="mb-5 p-3 bg-red-100 border border-red-400 text-red-700 text-sm rounded-lg">
                                {error}
                            </div>
                        )}

                        {/* ── Google Button ── */}
                        <button
                            id="google-signin-btn"
                            onClick={handleGoogleSignIn}
                            disabled={googleLoading || loading}
                            className="w-full h-12 flex items-center justify-center gap-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 transition-all shadow-sm font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {googleLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                </svg>
                            )}
                            <span>{googleLoading ? 'Redirecting to Google...' : 'Continue with Google'}</span>
                        </button>

                        {/* ── Divider ── */}
                        <div className="relative flex items-center my-6">
                            <div className="flex-grow border-t border-slate-200 dark:border-slate-700" />
                            <span className="px-4 text-xs uppercase tracking-widest text-slate-400 font-medium whitespace-nowrap">
                                or sign in with email
                            </span>
                            <div className="flex-grow border-t border-slate-200 dark:border-slate-700" />
                        </div>

                        {/* ── Email / Password Form ── */}
                        <form className="space-y-4" onSubmit={handleLogin}>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email Address</label>
                                <input
                                    id="email-input"
                                    className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#a15912] focus:border-transparent outline-none transition-all"
                                    placeholder="name@example.com"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={loading || googleLoading}
                                    required
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                                <div className="relative">
                                    <input
                                        id="password-input"
                                        className="w-full h-12 px-4 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#a15912] focus:border-transparent outline-none transition-all"
                                        placeholder="Enter your password"
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete="current-password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={loading || googleLoading}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#a15912]"
                                        aria-label="Toggle password visibility"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" className="rounded border-slate-300 text-[#a15912] focus:ring-[#a15912] h-4 w-4" />
                                    <span className="text-sm text-slate-600 dark:text-slate-400">Remember me</span>
                                </label>
                                <Link className="text-sm font-medium text-[#a15912] hover:underline" href="/forgot-password">
                                    Forgot Password?
                                </Link>
                            </div>

                            <button
                                id="email-signin-btn"
                                disabled={loading || googleLoading}
                                className="w-full h-12 bg-[#a15912] text-white font-bold rounded-xl shadow-lg shadow-[#a15912]/20 hover:bg-[#8a4b0f] transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                <span>{loading ? 'Signing In...' : 'Sign In with Email'}</span>
                                {loading
                                    ? <Loader2 className="w-5 h-5 animate-spin" />
                                    : <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                }
                            </button>
                        </form>

                        {/* Footer */}
                        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
                            Don&apos;t have an account?{' '}
                            <Link className="font-bold text-[#a15912] hover:underline" href="/signup">
                                Create Account
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="h-screen w-full flex items-center justify-center bg-[#f8f7f6] dark:bg-[#211911]">
                <Loader2 className="w-8 h-8 animate-spin text-[#a15912]" />
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}
