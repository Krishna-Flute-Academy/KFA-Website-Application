import React from 'react';
import PublicNavbar from '../../src/components/PublicNavbar';

export default function BlogLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 antialiased selection:bg-amber-200 selection:text-amber-900">
            <PublicNavbar activePath="/blog" />
            {children}
        </div>
    );
}
