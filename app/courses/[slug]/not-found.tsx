import Link from 'next/link';
import { ArrowLeft, Music } from 'lucide-react';

export default function CourseNotFound() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
                <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
                    <Music className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Course Not Found</h1>
                <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                    The Bansuri course you are looking for does not exist or may have been relocated.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        href="/courses"
                        className="inline-flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-950 text-white font-semibold px-5 py-2.5 rounded-full text-sm transition-all"
                    >
                        <span>View All Courses</span>
                    </Link>
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-5 py-2.5 rounded-full text-sm transition-all"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Return Home</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
