'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { Loader2 } from 'lucide-react';
import TeacherSidebar from '../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../src/components/TeacherHeader';
import AcademyPolicies from '../../../src/components/AcademyPolicies';

export default function TeacherPoliciesPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<{ id?: string; name: string; email: string; phone?: string | null; role?: string; profile_pic_url?: string | null } | null>(null);

    // Initial Fetch & Auth Verify
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (!session) {
                    router.push('/login?type=teacher');
                    return;
                }
                const { data: profile } = await supabaseAuth
                    .from('users')
                    .select('id, name, email, phone, role, profile_pic_url')
                    .eq('id', session.user.id)
                    .single();

                if (profile?.role !== 'teacher' && profile?.role !== 'admin') {
                    router.push('/');
                    return;
                }

                setTeacherProfile({ id: profile.id, name: profile.name, email: profile.email, phone: profile.phone, role: profile.role, profile_pic_url: profile.profile_pic_url });
            } catch (error) {
                console.error('Error verifying auth:', error);
                router.push('/');
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, [router]);

    // Log Out
    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    return (
        <div className="flex h-screen bg-[#f8f8f6] dark:bg-[#14120c] text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
            <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />
            
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                <TeacherHeader 
                    title="Academy Policies & Guidelines" 
                    avatarUrl={teacherProfile?.profile_pic_url}
                    userName={teacherProfile?.name}
                    backLink={teacherProfile?.role === 'admin' ? '/admin-dashboard' : '/teacher-dashboard'}
                />

                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-[#ecb613] mb-3" />
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest animate-pulse">Loading Policies...</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8">
                        <div className="max-w-6xl mx-auto">
                            <AcademyPolicies isAdmin={teacherProfile?.role === 'admin'} />
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
