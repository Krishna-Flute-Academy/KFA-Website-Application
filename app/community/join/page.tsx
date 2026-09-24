'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, ArrowRight, Loader2, Sparkles, Shield, Music, CheckCircle } from 'lucide-react';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { getSafeRedirectUrl } from '../../../src/lib/community';

function JoinCommunityContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTarget = getSafeRedirectUrl(searchParams.get('redirect'));

    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);

        const cleanName = displayName.trim();
        const cleanEmail = email.trim();

        if (!cleanName || !cleanEmail || !password || !confirmPassword) {
            setError('Please fill in all required fields.');
            return;
        }

        if (cleanName.length < 2) {
            setError('Display name must be at least 2 characters long.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }

        setLoading(true);

        try {
            // STEP 1: Create auth user with account_type = 'community'
            // The handle_new_user database trigger will strictly create a community_profiles row
            // and NEVER touch public.users or academy student records.
            const { data, error: signUpError } = await supabaseAuth.auth.signUp({
                email: cleanEmail,
                password,
                options: {
                    data: {
                        account_type: 'community',
                        full_name: cleanName,
                    },
                },
            });

            if (signUpError) {
                setError(signUpError.message);
                setLoading(false);
                return;
            }

            // Client-side self-healing upsert into public.community_profiles
            // Note: Does NOT insert into public.users.
            if (data?.user) {
                try {
                    await supabaseAuth
                        .from('community_profiles')
                        .upsert({
                            id: data.user.id,
                            display_name: cleanName,
                            avatar_url: null,
                        }, { onConflict: 'id' });
                } catch (profErr) {
                    console.warn('[JoinCommunity] Profile upsert notice:', profErr);
                }
            }

            // Check if email confirmation is required or if we have an active session
            if (data?.session) {
                // Active session created immediately
                router.push(redirectTarget);
            } else if (data?.user && (!data.user.identities || data.user.identities.length === 0)) {
                // User already exists
                setError('An account with this email already exists. Please log in instead.');
                setLoading(false);
            } else {
                // Email confirmation link sent
                setSuccessMessage(
                    `Welcome to the KFA Community, ${cleanName}! We've sent a verification link to ${cleanEmail}. Please check your email to activate your account, then sign in.`
                );
                setLoading(false);
            }
        } catch (err: any) {
            console.error('[JoinCommunity] Error:', err);
            setError(err?.message || 'An unexpected error occurred while creating your community account.');
            setLoading(false);
        }
    };

    return (
        <div className="bg-[#f8f7f6] dark:bg-[#211911] font-sans text-slate-900 dark:text-slate-100 antialiased min-h-screen">
            <div className="flex min-h-screen w-full">

                {/* ── Left Hero (Desktop) ── */}
                <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#211911] to-[#3a2617]">
                    <div
                        className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-overlay"
                        style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDFmuriD7E2DUGbyVFwITHGKIHWjQsGPWNTIyYLdmRb7XrSsfuyFsJaRn6oZO59IBYHxfEUF1Ca5AP9Jq5rK_M9GQij4KlQzZdrK5to3Nouq28eTavAuLAOab0xHI8xgyF6aUYa5HB6g78CmYJMVHuTtxkmwRQzbiTE6iYB_jd-RlAR2Qktfc_Hnz_B_RoSIbTKZN7EpETTp7xVoJfF2n47da9vdTH7zHUFDbqh0pHPiEqVpra3_8dj_EQa4WsmV-6gaPuUMLwWVynN")' }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#211911]/90 via-[#211911]/40 to-transparent" />
                    
                    <div className="relative z-10 flex flex-col justify-between p-12 text-white h-full">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#a15912] rounded-xl flex items-center justify-center text-white shadow-lg">
                                <Music className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="font-bold text-lg tracking-tight block">Krishna Flute Academy</span>
                                <span className="text-xs text-amber-300 font-semibold flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" /> Flute Forum & Community
                                </span>
                            </div>
                        </div>

                        <div className="space-y-6 max-w-lg">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-200 text-xs font-semibold backdrop-blur-sm">
                                <span>Free Public Forum Access</span>
                            </div>
                            <h1 className="text-3xl xl:text-4xl font-extrabold leading-tight">
                                Connect with Indian Flute Enthusiasts Worldwide
                            </h1>
                            <p className="text-sm text-slate-300 leading-relaxed">
                                Join discussions on bansuri techniques, flute buying guides, fingering tips, and classical Indian ragas. Learn from peers and mentors across the globe.
                            </p>
                            
                            <div className="space-y-3 pt-2">
                                <div className="flex items-start gap-3">
                                    <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                                        <CheckCircle className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-xs text-slate-300">Ask bansuri questions and receive guidance from experienced players</span>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                                        <CheckCircle className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-xs text-slate-300">Share your riyaz milestones and musical observations</span>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                                        <CheckCircle className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-xs text-slate-300">Access public forum categories completely free</span>
                                </div>
                            </div>
                        </div>

                        <div className="text-xs text-slate-400 border-t border-slate-700/60 pt-4">
                            Krishna Flute Academy &bull; Dedicated to the art of Bansuri
                        </div>
                    </div>
                </div>

                {/* ── Right Content Form ── */}
                <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-20 bg-[#f8f7f6] dark:bg-[#211911] overflow-y-auto py-12">
                    <div className="max-w-[420px] w-full mx-auto">

                        {/* Top Branding */}
                        <div className="mb-6">
                            <Link href="/community" className="inline-flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-400 hover:underline mb-4">
                                &larr; Back to KFA Community
                            </Link>
                            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
                                Join KFA Community
                            </h2>
                            <p className="text-slate-600 dark:text-slate-400 text-sm">
                                Create a free Community account to ask questions, share insights, and reply to flute discussions.
                            </p>
                        </div>

                        {/* Disclaimer Notice Box */}
                        <div className="mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs leading-relaxed space-y-2">
                            <div className="flex items-center gap-2 font-bold text-amber-850 dark:text-amber-300">
                                <Shield className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                                <span>Community Membership Notice</span>
                            </div>
                            <p className="text-[12px] opacity-90">
                                Community membership is <strong>free</strong> and allows you to participate in public KFA Community discussions. It does <strong>not</strong> provide access to Krishna Flute Academy student courses, live classrooms, assignments, or 1-on-1 teacher reviews.
                            </p>
                            <div className="pt-1 text-[11px] text-amber-800/80 dark:text-amber-300/80 border-t border-amber-200/60 dark:border-amber-800/40">
                                Already a student?{' '}
                                <Link 
                                    href={`/login?redirect=${encodeURIComponent(redirectTarget)}`} 
                                    className="font-bold underline text-amber-900 dark:text-amber-100 hover:text-amber-700"
                                >
                                    Sign in with your KFA Student account
                                </Link>
                            </div>
                        </div>

                        {/* Success State */}
                        {successMessage ? (
                            <div className="p-6 bg-green-50 dark:bg-green-950/40 border border-green-300 dark:border-green-800 rounded-2xl text-center space-y-4">
                                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/60 text-green-700 dark:text-green-300 rounded-full flex items-center justify-center mx-auto">
                                    <CheckCircle className="w-6 h-6" />
                                </div>
                                <h3 className="text-base font-bold text-green-900 dark:text-green-200">
                                    Verification Email Sent!
                                </h3>
                                <p className="text-xs text-green-800 dark:text-green-300 leading-relaxed">
                                    {successMessage}
                                </p>
                                <div className="pt-2">
                                    <Link
                                        href={`/login?redirect=${encodeURIComponent(redirectTarget)}`}
                                        className="inline-flex items-center justify-center px-6 py-2.5 bg-[#a15912] hover:bg-[#8a4b0f] text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                                    >
                                        Go to Sign In &rarr;
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Error Banner */}
                                {error && (
                                    <div className="mb-5 p-3.5 bg-rose-50 border border-rose-300 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300 text-xs font-semibold rounded-xl flex items-start gap-2 shadow-xs">
                                        <span className="text-base leading-none shrink-0">⚠️</span>
                                        <span>{error}</span>
                                    </div>
                                )}

                                {/* Join Form */}
                                <form className="space-y-4" onSubmit={handleJoin}>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                            Display Name / Pen Name
                                        </label>
                                        <input
                                            type="text"
                                            value={displayName}
                                            onChange={(e) => setDisplayName(e.target.value)}
                                            placeholder="e.g. BansuriLover42"
                                            disabled={loading}
                                            required
                                            maxLength={50}
                                            className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#a15912] focus:border-transparent outline-none transition-all"
                                        />
                                        <span className="text-[11px] text-slate-500">
                                            This will appear next to your discussions and replies.
                                        </span>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                            Email Address
                                        </label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="you@example.com"
                                            disabled={loading}
                                            required
                                            className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#a15912] focus:border-transparent outline-none transition-all"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                            Password
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="At least 6 characters"
                                                autoComplete="new-password"
                                                disabled={loading}
                                                required
                                                className="w-full h-11 px-4 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#a15912] focus:border-transparent outline-none transition-all"
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

                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                            Confirm Password
                                        </label>
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="Repeat password"
                                            autoComplete="new-password"
                                            disabled={loading}
                                            required
                                            className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#a15912] focus:border-transparent outline-none transition-all"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full h-11 bg-[#a15912] text-white font-bold rounded-xl shadow-lg shadow-[#a15912]/20 hover:bg-[#8a4b0f] transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                <span>Creating Account...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Create Free Community Account</span>
                                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </button>
                                </form>

                                {/* Footer Links */}
                                <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 text-center space-y-2">
                                    <p className="text-xs text-slate-600 dark:text-slate-400">
                                        Already have an account?{' '}
                                        <Link 
                                            href={`/login?redirect=${encodeURIComponent(redirectTarget)}`} 
                                            className="font-bold text-[#a15912] hover:underline"
                                        >
                                            Sign In
                                        </Link>
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        Interested in formal flute lessons?{' '}
                                        <Link href="/#courses" className="font-semibold text-amber-700 dark:text-amber-400 hover:underline">
                                            Explore KFA Academy Courses
                                        </Link>
                                    </p>
                                </div>
                            </>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}

export default function JoinCommunityPage() {
    return (
        <Suspense fallback={
            <div className="h-screen w-full flex items-center justify-center bg-[#f8f7f6] dark:bg-[#211911]">
                <Loader2 className="w-8 h-8 animate-spin text-[#a15912]" />
            </div>
        }>
            <JoinCommunityContent />
        </Suspense>
    );
}
