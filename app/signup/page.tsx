'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { supabaseAuth } from '../../src/lib/supabase-auth';

export default function SignupPage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!name || !email || !password || !confirmPassword) {
            setError('Please fill in all required fields.');
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

        // Step 1: Create auth user
        const { data, error: signUpError } = await supabaseAuth.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name,
                    phone: phone,
                    role: 'pending',
                }
            }
        });

        if (signUpError) {
            setError(signUpError.message);
            setLoading(false);
            return;
        }

        // Step 2: Insert into public.users with role = 'pending' so admin can approve
        if (data.user && data.session) {
            const { error: dbError } = await supabaseAuth
                .from('users')
                .upsert([{
                    id: data.user.id,
                    name: name,
                    email: email,
                    phone: phone || null,
                    role: 'pending',
                    status: 'active',
                    join_date: new Date().toISOString().split('T')[0],
                }], { onConflict: 'id', ignoreDuplicates: true });

            if (dbError) {
                console.error('DB insert error after signup:', dbError);
                // Don't block the user — the pending-approval page can still show
            }
        }

        setLoading(false);

        if (data.session) {
            // Email confirmation is OFF — session available immediately, insert DB row now
            const { error: dbError } = await supabaseAuth
                .from('users')
                .upsert([{
                    id: data.user!.id,
                    name: name,
                    email: email,
                    phone: phone || null,
                    role: 'pending',
                    status: 'active',
                    join_date: new Date().toISOString().split('T')[0],
                }], { onConflict: 'id', ignoreDuplicates: true });

            if (dbError) console.error('DB insert error after signup:', dbError);

            // Redirect to login so they can sign in
            setSubmitted(true);
            setTimeout(() => router.push('/login?registered=1'), 2500);
        } else {
            // Email confirmation is ON — user must click the link in their inbox.
            // The auth callback (/auth/callback) will insert the DB row using user_metadata.
            setSubmitted(true); // shows the 'check your email' screen
        }
    };

    return (
        <div className="bg-[#f8f7f6] dark:bg-[#211911] font-sans text-slate-900 dark:text-slate-100 antialiased min-h-screen overflow-hidden">
            <div className="flex min-h-screen w-full">
                {/* Left Side: Image */}
                <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#a15912]/10">
                    <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDFmuriD7E2DUGbyVFwITHGKIHWjQsGPWNTIyYLdmRb7XrSsfuyFsJaRn6oZO59IBYHxfEUF1Ca5AP9Jq5rK_M9GQij4KlQzZdrK5to3Nouq28eTavAuLAOab0xHI8xgyF6aUYa5HB6g78CmYJMVHuTtxkmwRQzbiTE6iYB_jd-RlAR2Qktfc_Hnz_B_RoSIbTKZN7EpETTp7xVoJfF2n47da9vdTH7zHUFDbqh0pHPiEqVpra3_8dj_EQa4WsmV-6gaPuUMLwWVynN")' }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#211911]/70 via-transparent to-transparent" />
                    <div className="absolute bottom-12 left-10 right-10 text-white">
                        <h1 className="text-3xl font-bold leading-tight mb-3">Begin Your Musical Journey</h1>
                        <p className="text-base opacity-90 max-w-sm">Submit your details and our team will review your application and assign you the right role in the academy.</p>
                    </div>
                </div>

                {/* Right Side: Form */}
                <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-24 bg-[#f8f7f6] dark:bg-[#211911] py-10 lg:py-0 overflow-y-auto">
                    <div className="max-w-[380px] w-full mx-auto">
                        {/* Header */}
                        <div className="mb-8 flex flex-col items-center lg:items-start w-full">
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
                            {!submitted && (
                                <>
                                    <h3 className="text-2xl font-bold mb-2">Create Account</h3>
                                    <p className="text-slate-650 dark:text-slate-400 text-sm">Fill in your details and submit. An admin will review and approve your account.</p>
                                </>
                            )}
                        </div>

                        {/* Success / Email Check State */}
                        {submitted ? (
                            <div className="flex flex-col items-center text-center gap-5 py-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
                                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-9 h-9 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <h4 className="text-2xl font-black text-slate-900 dark:text-slate-100">Check your email!</h4>
                                <p className="text-slate-650 dark:text-slate-450 text-sm leading-relaxed max-w-sm">
                                    We sent a confirmation link to <strong className="text-slate-900 dark:text-white font-semibold">{email}</strong>.
                                    Click the link to verify your address, then come back to sign in.
                                </p>
                                
                                {/* Admin Review Highlight Card */}
                                <div className="w-full p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-2xl text-left flex items-start gap-3 mt-2 shadow-sm">
                                    <span className="text-lg mt-0.5">⏳</span>
                                    <div>
                                        <h5 className="font-bold text-amber-900 dark:text-amber-300 text-xs uppercase tracking-wider mb-1">Admin Approval Required</h5>
                                        <p className="text-slate-700 dark:text-slate-350 text-xs leading-relaxed">
                                            After you verify your email address, an administrator must review and approve your account details before you will be allowed to log in.
                                        </p>
                                    </div>
                                </div>

                                <Link href="/login" className="mt-4 text-sm font-bold text-[#a15912] hover:underline flex items-center gap-1.5 hover:gap-2 transition-all">
                                    Go to Sign In <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        ) : (
                            <form className="space-y-4 w-full animate-in fade-in duration-300" onSubmit={handleSignup}>
                                {error && (
                                    <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-lg">
                                        {error}
                                    </div>
                                )}

                                {/* Full Name */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Full Name <span className="text-red-500">*</span></label>
                                    <input
                                        className="w-full h-11 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#a15912] focus:border-transparent outline-none transition-all"
                                        placeholder="e.g. Arjun Sharma"
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        disabled={loading}
                                        required
                                    />
                                </div>

                                {/* Email */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email Address <span className="text-red-500">*</span></label>
                                    <input
                                        className="w-full h-11 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#a15912] focus:border-transparent outline-none transition-all"
                                        placeholder="name@example.com"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        disabled={loading}
                                        required
                                    />
                                </div>

                                {/* Phone */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Phone Number <span className="text-slate-400 font-normal">(optional)</span></label>
                                    <input
                                        className="w-full h-11 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#a15912] focus:border-transparent outline-none transition-all"
                                        placeholder="+91 98765 43210"
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        disabled={loading}
                                    />
                                </div>

                                {/* Password */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Password <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <input
                                            className="w-full h-11 px-4 pr-12 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#a15912] focus:border-transparent outline-none transition-all"
                                            placeholder="At least 6 characters"
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            disabled={loading}
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#a15912]"
                                            onClick={() => setShowPassword(!showPassword)}
                                            aria-label="Toggle password visibility"
                                        >
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Confirm Password */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Confirm Password <span className="text-red-500">*</span></label>
                                    <input
                                        className="w-full h-11 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#a15912] focus:border-transparent outline-none transition-all"
                                        placeholder="Re-enter your password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        disabled={loading}
                                        required
                                    />
                                </div>

                                {/* Info note */}
                                <p className="text-xs text-slate-500 dark:text-slate-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-lg px-3 py-2">
                                    ⏳ After submitting, your application will be reviewed by an admin before you can access the portal.
                                </p>

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full h-11 mt-2 bg-[#a15912] text-white font-bold rounded-lg shadow-lg shadow-[#a15912]/20 hover:bg-[#8a4b0f] transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span>Submitting...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Submit Application</span>
                                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </button>
                            </form>
                        )}

                        {/* Footer */}
                        <div className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
                            Already have an account?{' '}
                            <Link className="font-bold text-[#a15912] hover:underline" href="/login">
                                Sign In
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
