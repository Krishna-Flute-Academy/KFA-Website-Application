'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { Loader2 } from 'lucide-react';

export default function TeacherMentorsPage() {
    const router = useRouter();

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabaseAuth.auth.getSession();
            if (!session) {
                router.replace('/login');
                return;
            }

            const { data: profile } = await supabaseAuth
                .from('users')
                .select('role')
                .eq('id', session.user.id)
                .single();

            if (profile?.role === 'admin') {
                router.replace('/teacher-dashboard/students');
            } else if (profile?.role === 'teacher') {
                router.replace('/teacher-dashboard/classrooms');
            } else {
                router.replace('/student-dashboard');
            }
        };

        checkUser();
    }, [router]);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <p className="text-xs font-semibold text-slate-500">Redirecting to Student Guidance...</p>
        </div>
    );
}
