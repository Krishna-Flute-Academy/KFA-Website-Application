'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { Loader2 } from 'lucide-react';
import TeacherSidebar from '../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../src/components/TeacherHeader';
import TeacherMentorManagement from '../../../src/components/teacher-dashboard/TeacherMentorManagement';

export default function TeacherMentorsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabaseAuth.auth.getSession();
            if (!session) {
                router.replace('/login');
                return;
            }

            const { data: profile } = await supabaseAuth
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (!profile || (profile.role !== 'teacher' && profile.role !== 'admin')) {
                router.replace('/student-dashboard');
                return;
            }

            setUser(profile);
            setLoading(false);
        };

        checkUser();
    }, [router]);

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.replace('/login');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
            <TeacherSidebar teacherProfile={user} handleLogout={handleLogout} />
            
            <div className="flex-1 flex flex-col min-w-0">
                <TeacherHeader 
                    title="Mentor Allocation"
                    userName={user?.name}
                    avatarUrl={user?.profile_pic_url}
                    backLink={user?.role === 'admin' ? '/admin-dashboard' : '/teacher-dashboard'} 
                />
                
                <main className="flex-1 overflow-y-auto">
                    <TeacherMentorManagement />
                </main>
            </div>
        </div>
    );
}
