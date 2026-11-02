'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TeacherSidebar from '../../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../../src/components/TeacherHeader';
import HistoricalReconciliationReviewModal from '../../../../src/components/teacher-dashboard/fees/HistoricalReconciliationReviewModal';
import { supabaseAuth } from '../../../../src/lib/supabase-auth';
import { Shield, ArrowLeft } from 'lucide-react';

export default function ReconciliationPage() {
    const router = useRouter();
    const [isModalOpen, setIsModalOpen] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<any>(null);

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabaseAuth.auth.getSession();
            if (!session) {
                router.push('/login?type=teacher');
                return;
            }
            const { data: user } = await supabaseAuth
                .from('users')
                .select('id, name, email, role, phone, profile_pic_url')
                .eq('id', session.user.id)
                .single();
            if (user) {
                setTeacherProfile(user);
            }
        };
        init();
    }, [router]);

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/login');
    };

    return (
        <div className="flex h-screen bg-[#FDFBF7] dark:bg-stone-950 text-stone-900 dark:text-stone-100 overflow-hidden font-sans">
            <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <TeacherHeader title="Historical Balance Reconciliation (Phase 2B.2A)" />
                <main className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center">
                    <div className="max-w-md w-full text-center p-8 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-sm space-y-4">
                        <div className="p-3 bg-amber-100 dark:bg-amber-950/50 text-amber-600 rounded-xl w-fit mx-auto">
                            <Shield className="w-8 h-8" />
                        </div>
                        <h2 className="text-xl font-bold">Historical Balance Reconciliation</h2>
                        <p className="text-xs text-stone-500">
                            Staging Review Interface for Historical Student Credit Discrepancies (BR-55)
                        </p>
                        <div className="flex items-center justify-center gap-3 pt-2">
                            <button
                                onClick={() => router.push('/teacher-dashboard/fees')}
                                className="px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-semibold hover:bg-stone-50 dark:hover:bg-stone-800 transition flex items-center gap-1.5"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                Back to Fees
                            </button>
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-stone-950 rounded-xl text-xs font-bold transition shadow-sm"
                            >
                                Open Review Panel
                            </button>
                        </div>
                    </div>

                    <HistoricalReconciliationReviewModal
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                    />
                </main>
            </div>
        </div>
    );
}
