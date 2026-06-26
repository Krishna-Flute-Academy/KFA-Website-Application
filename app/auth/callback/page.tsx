'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function AuthCallbackPage() {
    const router = useRouter();
    const [status, setStatus] = useState<'loading' | 'no_account' | 'error'>('loading');
    const [userName, setUserName] = useState('');

    useEffect(() => {
        const handleCallback = async () => {
            // Wait a moment for Supabase to process the session from the URL
            await new Promise(resolve => setTimeout(resolve, 500));

            const { data: { session }, error: sessionError } = await supabaseAuth.auth.getSession();

            if (sessionError || !session) {
                setStatus('error');
                return;
            }

            const userId = session.user.id;
            const googleName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || '';
            const googleEmail = session.user.email || '';
            setUserName(googleName);

            // Check if user exists in the public.users table
            const { data: existingUser } = await supabaseAuth
                .from('users')
                .select('role, status, name')
                .eq('id', userId)
                .maybeSingle();

            if (!existingUser) {
                // User signed in with Google but has NO account in our system
                // Sign them out and show "no account" message
                await supabaseAuth.auth.signOut();
                setStatus('no_account');
                return;
            }

            // Existing user — redirect based on role
            const role = existingUser.role?.toLowerCase();

            if (role === 'admin') {
                localStorage.setItem('kfa-user-role', 'admin');
                router.push('/teacher-dashboard');
            } else if (role === 'teacher') {
                localStorage.setItem('kfa-user-role', 'teacher');
                router.push('/teacher-dashboard');
            } else if (role === 'student') {
                router.push('/student-dashboard');
            } else {
                // User exists but has no role assigned yet (pending)
                router.push('/pending-approval');
            }
        };

        handleCallback();
    }, [router]);

    // Loading state
    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-[#f8f7f6] flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 bg-[#a15912] rounded-xl flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                </div>
                <Loader2 className="w-8 h-8 animate-spin text-[#a15912]" />
                <p className="text-slate-600 font-medium">Signing you in...</p>
            </div>
        );
    }

    // No account found state
    if (status === 'no_account') {
        return (
            <div className="min-h-screen bg-[#f8f7f6] flex items-center justify-center px-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    {/* Icon */}
                    <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
                        </svg>
                    </div>

                    <h2 className="text-2xl font-bold text-slate-900 mb-2">No Account Found</h2>
                    <p className="text-slate-600 mb-2">
                        We couldn't find an account linked to{' '}
                        <span className="font-semibold text-slate-800">{userName ? `"${userName}'s" Google account` : 'your Google account'}</span>.
                    </p>
                    <p className="text-slate-500 text-sm mb-6">
                        To join Krishna Flute Academy, you need to create an account first using your academy access code.
                    </p>

                    <div className="flex flex-col gap-3">
                        <Link
                            href="/signup"
                            className="w-full h-12 bg-[#a15912] text-white font-bold rounded-xl flex items-center justify-center hover:bg-[#8a4b0f] transition-colors"
                        >
                            Create New Account
                        </Link>
                        <Link
                            href="/login"
                            className="w-full h-12 border-2 border-slate-200 text-slate-700 font-semibold rounded-xl flex items-center justify-center hover:bg-slate-50 transition-colors"
                        >
                            Back to Login
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Generic error state
    return (
        <div className="min-h-screen bg-[#f8f7f6] flex items-center justify-center px-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Login Failed</h2>
                <p className="text-slate-600 mb-6">Something went wrong during sign-in. Please try again.</p>
                <Link
                    href="/login"
                    className="w-full h-12 bg-[#a15912] text-white font-bold rounded-xl flex items-center justify-center hover:bg-[#8a4b0f] transition-colors"
                >
                    Back to Login
                </Link>
            </div>
        </div>
    );
}
