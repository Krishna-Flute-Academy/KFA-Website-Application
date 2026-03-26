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
        } else {
            // Default to metadata role
            let userRole = data.user?.user_metadata?.role;

            // Prioritize the custom users table in case the role was updated manually in the database
            if (data.user) {
                const { data: userData, error: userError } = await supabaseAuth
                    .from('users')
                    .select('role')
                    .eq('id', data.user.id)
                    .single();

                if (!userError && userData && userData.role) {
                    userRole = userData.role;
                }
            }

            // Perform case-insensitive check and redirect
            const normalizedRole = userRole?.toString().toLowerCase();
            console.log('Login successful. Detected role:', normalizedRole);

            if (normalizedRole === 'teacher') {
                router.push('/teacher-dashboard');
            } else {
                router.push('/');
            }
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
                        <h1 className="text-4xl font-bold leading-tight mb-4">Master the Divine Art</h1>
                        <p className="text-lg opacity-90 max-w-md">Join thousands of students learning the traditional Indian flute from the masters of the Krishna Flute Academy.</p>
                    </div>
                </div>

                {/* Right Side: Login Form */}
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
                            <h3 className="text-3xl font-bold mb-2">
                                {isTeacher ? 'Teacher Login' : 'Student Login'}
                            </h3>
                            <p className="text-slate-600 dark:text-slate-400">Enter your credentials to access your musical journey.</p>
                        </div>

                        {/* Form */}
                        <form className="space-y-5" onSubmit={handleLogin}>
                            {error && (
                                <div className="p-3 bg-red-100 border border-red-400 text-red-700 text-sm rounded">
                                    {error}
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
                                        disabled={loading}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                                <div className="relative group">
                                    <input
                                        className="w-full h-12 px-4 pr-12 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#a15912] focus:border-transparent outline-none transition-all"
                                        placeholder="Enter your password"
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={loading}
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

                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        className="rounded border-slate-300 dark:border-slate-600 text-[#a15912] focus:ring-[#a15912] h-4 w-4"
                                        type="checkbox"
                                    />
                                    <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-[#a15912] transition-colors">Remember me</span>
                                </label>
                                <Link className="text-sm font-medium text-[#a15912] hover:underline" href="/forgot-password">
                                    Forgot Password?
                                </Link>
                            </div>

                            <button
                                disabled={loading}
                                className="w-full h-12 bg-[#a15912] text-white font-bold rounded-lg shadow-lg shadow-[#a15912]/20 hover:bg-[#8a4b0f] transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                <span>{loading ? 'Signing In...' : 'Sign In'}</span>
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                )}
                            </button>
                        </form>

                        {/* Footer */}
                        <div className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
                            Don't have an account?
                            <Link className="font-bold text-[#a15912] hover:underline ml-1" href="/signup">
                                Create Account
                            </Link>
                        </div>

                        {/* Secondary Login Options */}
                        <div className="mt-10">
                            <div className="relative flex items-center mb-6">
                                <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                                <span className="px-3 text-xs uppercase tracking-widest text-slate-400">or continue with</span>
                                <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button className="flex items-center justify-center h-12 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                    <img alt="Google logo" className="w-5 h-5 mr-2" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDv4zmXYCTh5sTm4x07R8yVWqKYHnK1hke9QYzDq_4AS_IdVmAId0E7R9RHG5MgpdIZdH8ZaEo3mcVUKIaLrdlFkkVX98wn99fq80cKghl3hNwHlp2SxbCKxU3xewlXTrwJ5PadJp2iaK7LaWTAs1Qc8IUiVN5untLWe5ez7ER6Wd_Lw2Wu28oqGiirAgUrO_SnLRZ6HmVBZYuHLpzS2C9VMIVYvW4lRW1DCZ2jm5hsOUG8T37u1kVuwrA6mfNUk6je7fVH5Vza2bMw" />
                                    <span className="text-sm font-medium">Google</span>
                                </button>
                                <button className="flex items-center justify-center h-12 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="currentColor" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                                        <path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z" /><path d="M10 2c1 .5 2 2 2 5" />
                                    </svg>
                                    <span className="text-sm font-medium">Apple</span>
                                </button>
                            </div>
                        </div>
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
