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
    const [role, setRole] = useState('pending');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const [accessCode, setAccessCode] = useState('');
    const [isCodeVerified, setIsCodeVerified] = useState(false);
    const [codeError, setCodeError] = useState<string | null>(null);

    const handleVerifyCode = (e: React.FormEvent) => {
        e.preventDefault();
        setCodeError(null);
        
        const masterCode = process.env.NEXT_PUBLIC_SIGNUP_ACCESS_CODE || 'KFA-START';
        
        if (accessCode.trim().toUpperCase() === masterCode.toUpperCase()) {
            setIsCodeVerified(true);
        } else {
            setCodeError('Invalid access code. Please contact the admin to be enrolled.');
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);

        if (!email || !password || !name || !confirmPassword) {
            setError('Please fill in all fields.');
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

        // Step 2: Insert a row in public.users so the student/teacher appears in the dashboard.
        // This works when email confirmation is disabled (session is available immediately).
        // If email confirmation is enabled, data.session is null — in that case, a
        // database trigger (or the user's first login) must handle the insert.
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
                // Auth user created but DB insert failed — show a soft warning
                console.error('DB insert error after signup:', dbError);
                setError(`Account created but profile setup failed: ${dbError.message}. Please contact support.`);
                setLoading(false);
                return;
            }
        }

        setSuccessMessage('Account created! Redirecting you to login…');
        setLoading(false);
        setTimeout(() => {
            router.push('/login');
        }, 2500);
    };

    return (
        <div className="bg-[#f8f7f6] dark:bg-[#211911] font-sans text-slate-900 dark:text-slate-100 antialiased min-h-screen overflow-hidden">
            <div className="flex min-h-screen w-full">
                {/* Left Side: Image Content */}
                <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#a15912]/10">
                    <div
                        className="absolute inset-0 bg-cover bg-center"
                        title="Close up of a handcrafted wooden bansuri flute on a silk cloth"
                        style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDFmuriD7E2DUGbyVFwITHGKIHWjQsGPWNTIyYLdmRb7XrSsfuyFsJaRn6oZO59IBYHxfEUF1Ca5AP9Jq5rK_M9GQij4KlQzZdrK5to3Nouq28eTavAuLAOab0xHI8xgyF6aUYa5HB6g78CmYJMVHuTtxkmwRQzbiTE6iYB_jd-RlAR2Qktfc_Hnz_B_RoSIbTKZN7EpETTp7xVoJfF2n47da9vdTH7zHUFDbqh0pHPiEqVpra3_8dj_EQa4WsmV-6gaPuUMLwWVynN")' }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#211911]/60 via-transparent to-transparent" />
                    <div className="absolute bottom-12 left-12 right-12 text-white">
                        <h1 className="text-4xl font-bold leading-tight mb-4">Complete Your Journey</h1>
                        <p className="text-lg opacity-90 max-w-md">Join thousands of students learning the traditional Indian flute from the masters of the Krishna Flute Academy.</p>
                    </div>
                </div>

                {/* Right Side: Signup Form */}
                <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 lg:px-24 xl:px-32 bg-[#f8f7f6] dark:bg-[#211911] py-12 lg:py-0 overflow-y-auto">
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
                            <h3 className="text-3xl font-bold mb-2">Create Account</h3>
                            <p className="text-slate-600 dark:text-slate-400">Sign up to begin your musical journey with us.</p>
                        </div>

                        {/* Form */}
                        {!isCodeVerified ? (
                            <form className="space-y-4" onSubmit={handleVerifyCode}>
                                {codeError && (
                                    <div className="p-3 bg-red-100 border border-red-400 text-red-700 text-sm rounded">
                                        {codeError}
                                    </div>
                                )}
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Academy Access Code</label>
                                    <input
                                        className="w-full h-12 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#a15912] focus:border-transparent outline-none transition-all uppercase"
                                        placeholder="Enter your access code"
                                        type="text"
                                        value={accessCode}
                                        onChange={(e) => setAccessCode(e.target.value)}
                                        required
                                    />
                                    <p className="text-xs text-slate-500">You must receive this code from your teacher.</p>
                                </div>
                                <button
                                    type="submit"
                                    className="w-full h-12 mt-4 bg-[#a15912] text-white font-bold rounded-lg shadow-lg shadow-[#a15912]/20 hover:bg-[#8a4b0f] transition-all flex items-center justify-center gap-2 group"
                                >
                                    <span>Continue to Sign Up</span>
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </form>
                        ) : (
                        <form className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500" onSubmit={handleSignup}>
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
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
                                <div className="relative">
                                    <input
                                        className="w-full h-12 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#a15912] focus:border-transparent outline-none transition-all"
                                        placeholder="John Doe"
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        disabled={loading || !!successMessage}
                                        required
                                    />
                                </div>
                            </div>

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

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Phone Number (Optional)</label>
                                <div className="relative">
                                    <input
                                        className="w-full h-12 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#a15912] focus:border-transparent outline-none transition-all"
                                        placeholder="+1 (555) 000-0000"
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        disabled={loading || !!successMessage}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                                <div className="relative group">
                                    <input
                                        className="w-full h-12 px-4 pr-12 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#a15912] focus:border-transparent outline-none transition-all"
                                        placeholder="Create a strong password"
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={loading || !!successMessage}
                                        required
                                    />
                                    <button
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#a15912] flex items-center"
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        aria-label="Toggle password visibility"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Confirm Password</label>
                                <div className="relative group">
                                    <input
                                        className="w-full h-12 px-4 pr-12 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#a15912] focus:border-transparent outline-none transition-all"
                                        placeholder="Confirm your password"
                                        type={showPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        disabled={loading || !!successMessage}
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                disabled={loading || !!successMessage}
                                className="w-full h-12 mt-2 bg-[#a15912] text-white font-bold rounded-lg shadow-lg shadow-[#a15912]/20 hover:bg-[#8a4b0f] transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                <span>{loading ? 'Creating Account...' : 'Sign Up'}</span>
                                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                                {!loading && !successMessage && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                            </button>
                        </form>
                        )}

                        {/* Footer */}
                        <div className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
                            Already have an account?
                            <Link className="font-bold text-[#a15912] hover:underline ml-1" href="/login">
                                Sign In
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
