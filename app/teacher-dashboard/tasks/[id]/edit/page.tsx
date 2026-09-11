'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function EditTaskPage() {
    const router = useRouter();
    const params = useParams();
    const assignmentId = params.id as string;

    useEffect(() => {
        if (assignmentId) {
            router.replace(`/teacher-dashboard/tasks?edit=${assignmentId}`);
        } else {
            router.replace('/teacher-dashboard/tasks');
        }
    }, [assignmentId, router]);

    return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8f8f6] dark:bg-[#221d10]">
            <Loader2 className="w-10 h-10 animate-spin text-[#ecb613] mb-4" />
            <p className="font-bold text-slate-600 dark:text-slate-400">Redirecting to task editor...</p>
        </div>
    );
}
