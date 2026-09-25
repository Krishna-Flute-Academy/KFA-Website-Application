'use client';

import { useState, useEffect } from 'react';
import { supabaseAuth } from './supabase-auth';

export interface AuthNavigationInfo {
    label: string;
    href: string;
    isAuthenticated: boolean;
    role: string | null;
}

/**
 * Determines the appropriate dashboard route and user-facing navigation label
 * based on authenticated session state and user role.
 */
export function getAuthNavigation(session: any, role: string | null): AuthNavigationInfo {
    if (!session) {
        return {
            label: 'Login',
            href: '/login',
            isAuthenticated: false,
            role: null
        };
    }

    const normalizedRole = role?.toLowerCase()?.trim() || null;

    if (normalizedRole === 'admin') {
        return {
            label: 'Admin Dashboard',
            href: '/teacher-dashboard',
            isAuthenticated: true,
            role: normalizedRole
        };
    }

    if (normalizedRole === 'teacher') {
        return {
            label: 'Teacher Dashboard',
            href: '/teacher-dashboard',
            isAuthenticated: true,
            role: normalizedRole
        };
    }

    if (normalizedRole === 'pending') {
        return {
            label: 'Pending Approval',
            href: '/pending-approval',
            isAuthenticated: true,
            role: normalizedRole
        };
    }

    // Default for student, mentor, or any authenticated academy user
    return {
        label: 'My Dashboard',
        href: '/student-dashboard',
        isAuthenticated: true,
        role: normalizedRole
    };
}

/**
 * Checks whether the current user has eligible access to KFA Student Tools.
 * Active students, mentors, teachers, and admins have access.
 * Unauthenticated visitors and pending approval users do not.
 */
export function hasStudentToolsAccess(session: any, role: string | null): boolean {
    if (!session?.user) return false;
    const normalizedRole = role?.toLowerCase()?.trim();
    if (!normalizedRole || normalizedRole === 'pending') return false;
    return ['student', 'mentor', 'teacher', 'admin'].includes(normalizedRole);
}

/**
 * React hook that reacts to Supabase auth session and role changes.
 * Initializes immediately from local storage cache to eliminate layout flash,
 * then silently validates with cached session and onAuthStateChange.
 */
export function useAuthNavigation() {
    const [userSession, setUserSession] = useState<any>(() => {
        if (typeof window !== 'undefined') {
            try {
                const stored = localStorage.getItem('kfa-auth-token');
                if (stored) return JSON.parse(stored);
            } catch {}
        }
        return null;
    });

    const [userRole, setUserRole] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('kfa-user-role');
        }
        return null;
    });

    useEffect(() => {
        let isMounted = true;

        const checkAuth = async () => {
            try {
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (!isMounted) return;
                setUserSession(session);

                if (session?.user) {
                    const { data } = await supabaseAuth
                        .from('users')
                        .select('role')
                        .eq('id', session.user.id)
                        .maybeSingle();

                    if (!isMounted) return;
                    if (data?.role) {
                        setUserRole(data.role);
                        if (typeof window !== 'undefined') {
                            localStorage.setItem('kfa-user-role', data.role.toLowerCase());
                        }
                    }
                } else {
                    setUserRole(null);
                    if (typeof window !== 'undefined') {
                        localStorage.removeItem('kfa-user-role');
                    }
                }
            } catch (err) {
                // Non-blocking
            }
        };

        checkAuth();

        const { data: { subscription } } = supabaseAuth.auth.onAuthStateChange(async (_event, session) => {
            if (!isMounted) return;
            setUserSession(session);

            if (session?.user) {
                try {
                    const { data } = await supabaseAuth
                        .from('users')
                        .select('role')
                        .eq('id', session.user.id)
                        .maybeSingle();

                    if (!isMounted) return;
                    if (data?.role) {
                        setUserRole(data.role);
                        if (typeof window !== 'undefined') {
                            localStorage.setItem('kfa-user-role', data.role.toLowerCase());
                        }
                    }
                } catch {
                    // Non-blocking
                }
            } else {
                setUserRole(null);
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('kfa-user-role');
                }
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const authNav = getAuthNavigation(userSession, userRole);
    const hasStudentAccess = hasStudentToolsAccess(userSession, userRole);

    return {
        userSession,
        userRole,
        hasStudentAccess,
        ...authNav
    };
}
