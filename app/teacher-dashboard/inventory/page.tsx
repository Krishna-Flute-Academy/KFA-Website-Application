'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { Loader2, Construction } from 'lucide-react';
import TeacherSidebar from '../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../src/components/TeacherHeader';

export default function InventoryLibrary() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchAuth = async () => {
            const { data: { session } } = await supabaseAuth.auth.getSession();
            if (!session) {
                router.push('/login?type=teacher');
                return;
            }
            const { data: profile } = await supabaseAuth.from('users').select('id, name, email').eq('id', session.user.id).single();
            setTeacherProfile(profile);
            setLoading(false);
        };
        fetchAuth();
    }, [router]);

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8f8f6] dark:bg-[#221d10]">
                <Loader2 className="w-10 h-10 animate-spin text-[#ecb613] mb-4" />
                <p className="font-medium text-slate-600 dark:text-slate-400 tracking-wide uppercase text-xs">Loading...</p>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-[#f8f8f6] dark:bg-[#221d10] text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
            <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <TeacherHeader 
                    title="Inventory Library" 
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                />
                
                <div className="flex-1 flex flex-col items-center justify-center p-8">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 max-w-lg w-full text-center shadow-sm">
                        <div className="w-20 h-20 bg-[#ecb613]/10 dark:bg-[#ecb613]/5 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Construction className="size-10 text-[#ecb613]" />
                        </div>
                        <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">Coming Soon!</h2>
                        <p className="text-slate-500 dark:text-slate-400 leading-relaxed mb-8">
                            The Inventory Library module is currently under construction. Soon you will be able to manage instruments, track sheet music, and request resources right from this dashboard.
                        </p>
                        
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 rounded-full font-medium text-sm border border-slate-100 dark:border-slate-800">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ecb613] opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ecb613]"></span>
                            </span>
                            In Development
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
