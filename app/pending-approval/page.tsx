'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../src/lib/supabase-auth';
import { Clock, LogOut, Music, Loader2 } from 'lucide-react';
import Link from 'next/link';

const isNetworkError = (error: any) => {
    if (!error) return false;
    const msg = error.message || String(error);
    return msg.includes('Failed to fetch') || 
           msg.includes('Load failed') || 
           msg.includes('NetworkError') || 
           msg.includes('connection refused') ||
           (error.name === 'TypeError' && msg.includes('fetch'));
};

export default function PendingApprovalPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [userEmail, setUserEmail] = useState('');

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (!session) {
                    router.push('/login');
                    return;
                }

                setUserEmail(session.user.email || '');

                // Re-fetch role to check if it has been updated
                const { data: userData, error } = await supabaseAuth
                    .from('users')
                    .select('role')
                    .eq('id', session.user.id)
                    .maybeSingle();

                if (error) throw error;

                if (userData && userData.role && userData.role !== 'pending') {
                    const normalizedRole = userData.role.toLowerCase();
                    if (normalizedRole === 'admin' || normalizedRole === 'teacher') {
                        router.push('/teacher-dashboard');
                    } else if (normalizedRole === 'student') {
                        router.push('/student-dashboard');
                    }
                } else {
                    setLoading(false);
                }
            } catch (error: any) {
                if (isNetworkError(error)) {
                    console.warn('Network issue checking user approval status (will retry):', error?.message || error);
                } else {
                    console.error('Error checking user approval status:', error?.message || error);
                }
                setLoading(false);
            }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 15000); // Check status every 15s
        return () => clearInterval(interval);
    }, [router]);

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/login');
    };

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8f7f6] dark:bg-[#211911]">
                <Loader2 className="w-10 h-10 animate-spin text-[#a15912] mb-4" />
                <p className="text-slate-600 dark:text-slate-400 font-medium">Verifying authorization status...</p>
            </div>
        );
    }

    return (
        <div className="bg-[#f8f7f6] dark:bg-[#211911] font-sans text-slate-900 dark:text-slate-100 antialiased min-h-screen flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 text-center relative overflow-hidden">
                {/* Brand Logo/Header */}
                <div className="flex flex-col items-center mb-6">
                    <div className="w-14 h-14 bg-[#a15912] rounded-2xl flex items-center justify-center text-white mb-4 shadow-md shadow-[#a15912]/20">
                        <Music className="h-7 w-7" />
                    </div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Krishna Flute Academy</h2>
                </div>

                {/* Clock Indicator */}
                <div className="my-8 flex justify-center">
                    <div className="relative flex items-center justify-center w-20 h-20 bg-amber-50 dark:bg-amber-950/20 rounded-full border border-amber-100 dark:border-amber-900/30">
                        <Clock className="w-10 h-10 text-[#a15912] animate-pulse" />
                    </div>
                </div>

                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mb-3">Pending Role Allocation</h1>
                <p className="text-slate-650 dark:text-slate-400 text-sm leading-relaxed mb-6">
                    Welcome to the Academy! Your account <span className="font-semibold text-slate-900 dark:text-slate-200">({userEmail})</span> has been created successfully.
                </p>
                
                <div className="bg-[#f8f7f6] dark:bg-slate-800/40 border border-slate-150 dark:border-slate-800/60 rounded-2xl p-4 text-xs text-left text-slate-600 dark:text-slate-400 leading-relaxed mb-6 space-y-2">
                    <p className="font-bold text-slate-850 dark:text-slate-200">What happens next?</p>
                    <p>An administrator will review your registration details shortly and allocate your portal role (Admin, Teacher, or Student) along with your class assignments.</p>
                    <p>This screen will automatically refresh and redirect you as soon as your role is assigned.</p>
                </div>

                {/* Contact support */}
                <div className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-6 mb-6">
                    <p className="font-medium">Need immediate assistance or role change?</p>
                    <p className="mt-1">
                        Email: <a href="mailto:krishnafluteacademy@gmail.com" className="text-[#a15912] font-semibold hover:underline">krishnafluteacademy@gmail.com</a>
                    </p>
                    <p>
                        Phone: <a href="tel:+919836952545" className="text-[#a15912] font-semibold hover:underline">+91 98369 52545</a>
                    </p>
                </div>

                {/* Log out */}
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 h-12 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 font-bold rounded-xl transition-all"
                >
                    <LogOut className="w-5 h-5" />
                    <span>Sign Out</span>
                </button>
            </div>
        </div>
    );
}
