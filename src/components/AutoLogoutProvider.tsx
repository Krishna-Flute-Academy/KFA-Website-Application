'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabaseAuth } from '../lib/supabase-auth';

// 2 hours in milliseconds
const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;

export default function AutoLogoutProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Memory fallback for session ID in case sessionStorage is restricted/disabled (e.g. mobile/private tabs)
    const memorySessionIdRef = useRef<string | null>(null);

    const safeGetSessionId = () => {
        try {
            if (typeof window !== 'undefined' && window.sessionStorage) {
                return window.sessionStorage.getItem('kfa_user_session_id') || memorySessionIdRef.current;
            }
        } catch (e) {}
        return memorySessionIdRef.current;
    };

    const safeSetSessionId = (id: string) => {
        memorySessionIdRef.current = id;
        try {
            if (typeof window !== 'undefined' && window.sessionStorage) {
                window.sessionStorage.setItem('kfa_user_session_id', id);
            }
        } catch (e) {}
    };

    const safeRemoveSessionId = () => {
        memorySessionIdRef.current = null;
        try {
            if (typeof window !== 'undefined' && window.sessionStorage) {
                window.sessionStorage.removeItem('kfa_user_session_id');
            }
        } catch (e) {}
    };

    const generateUUID = () => {
        if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
            return window.crypto.randomUUID();
        }
        // Fallback RFC4122 v4 compliant UUID generator
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    // Check if user is logged in and setup session tracking
    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabaseAuth.auth.getSession();
            setIsAuthenticated(!!session);
        };
        
        checkAuth();

        const { data: { subscription } } = supabaseAuth.auth.onAuthStateChange(async (event, session) => {
            setIsAuthenticated(!!session);

            if (session) {
                const userId = session.user.id;
                let sessionUuid = safeGetSessionId();
                if (!sessionUuid) {
                    sessionUuid = generateUUID();
                    safeSetSessionId(sessionUuid);
                }

                try {
                    const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : '';
                    await supabaseAuth.from('user_sessions').upsert([{
                        id: sessionUuid,
                        user_id: userId,
                        login_at: new Date().toISOString(),
                        last_activity_at: new Date().toISOString(),
                        user_agent: userAgent
                    }], { onConflict: 'id' });

                    // Start heartbeat if not running
                    if (!heartbeatIntervalRef.current) {
                        heartbeatIntervalRef.current = setInterval(async () => {
                            const curSessionId = safeGetSessionId();
                            if (curSessionId) {
                                await supabaseAuth
                                    .from('user_sessions')
                                    .update({ last_activity_at: new Date().toISOString() })
                                    .eq('id', curSessionId);
                            }
                        }, 30000);
                    }
                } catch (e) {
                    console.error('Error starting tracking session:', e);
                }
            } else {
                const prevSessionUuid = safeGetSessionId();
                if (prevSessionUuid) {
                    try {
                        const now = new Date();
                        const { data: sData } = await supabaseAuth
                            .from('user_sessions')
                            .select('login_at')
                            .eq('id', prevSessionUuid)
                            .single();
                        
                        const loginAt = sData?.login_at ? new Date(sData.login_at) : now;
                        const duration = Math.max(0, Math.floor((now.getTime() - loginAt.getTime()) / 1000));
                        
                        await supabaseAuth
                            .from('user_sessions')
                            .update({
                                logout_at: now.toISOString(),
                                duration_seconds: duration
                            })
                            .eq('id', prevSessionUuid);
                    } catch (e) {
                        console.error('Error closing session:', e);
                    } finally {
                        safeRemoveSessionId();
                    }
                }

                if (heartbeatIntervalRef.current) {
                    clearInterval(heartbeatIntervalRef.current);
                    heartbeatIntervalRef.current = null;
                }
            }
        });

        return () => {
            subscription.unsubscribe();
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
                heartbeatIntervalRef.current = null;
            }
        };
    }, []);

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
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
