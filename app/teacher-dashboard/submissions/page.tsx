'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SubmissionsRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to tasks page where all submissions are reviewed/graded
        router.replace('/teacher-dashboard/tasks');
    }, [router]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#FAF7F0] dark:bg-[#0E1A14] text-slate-800 dark:text-slate-200">
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-[#1B4B43] dark:border-[#7BC2B0] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-semibold tracking-wide">
                    Loading Submissions Dashboard...
                </p>
            </div>
        </div>
    );
}
