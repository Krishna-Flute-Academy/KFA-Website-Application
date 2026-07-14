'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// 2 hours in milliseconds
const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;

export default function AutoLogoutProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Check if user is logged in
    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setIsAuthenticated(!!session);
        };
        
        checkAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setIsAuthenticated(!!session);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setIsAuthenticated(false);
        // Optional: clear any local storage caches
        router.push('/login?message=Logged out due to inactivity');
    };

    const resetTimer = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        
        // Only run timer if user is authenticated and not on a public page
        if (isAuthenticated) {
            timerRef.current = setTimeout(handleLogout, IDLE_TIMEOUT_MS);
        }
    };

    useEffect(() => {
        if (!isAuthenticated) return;

        // Start initial timer
        resetTimer();

        // Events to track activity
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

        const handleActivity = () => {
            // Use requestAnimationFrame or throttle if performance is an issue,
            // but resetting a timeout is generally cheap enough.
            resetTimer();
        };

        events.forEach(event => {
            window.addEventListener(event, handleActivity, { passive: true });
        });

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            events.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
        };
    }, [isAuthenticated, pathname]);

    return <>{children}</>;
}
