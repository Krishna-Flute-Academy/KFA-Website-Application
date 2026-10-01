'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
    MessageSquare, PlusCircle, Search, User, LogOut, CalendarDays,
    Menu, X, Sparkles, BookOpen, ExternalLink, ShieldCheck 
} from 'lucide-react';
import { supabaseAuth } from '../../lib/supabase-auth';
import { resolveUserBadge, CommunityBadge } from '../../lib/community';
import { getAuthNavigation } from '../../lib/auth-navigation';
import CommunityNotificationBell from './CommunityNotificationBell';

interface CommunityNavbarProps {
    searchQuery?: string;
    onSearchChange?: (q: string) => void;
}

export default function CommunityNavbar({ searchQuery, onSearchChange }: CommunityNavbarProps) {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userName, setUserName] = useState<string>('');
    const [userAvatar, setUserAvatar] = useState<string | null>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const checkAuth = async () => {
            try {
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (!session?.user) {
                    if (isMounted) setLoading(false);
                    return;
                }

                if (isMounted) {
                    setUser(session.user);
                    const name = session.user.user_metadata?.full_name || 
                                 session.user.user_metadata?.name || 
                                 session.user.email?.split('@')[0] || 'Member';
                    setUserName(name);
                    setUserAvatar(session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null);
                }

                // Check role in public.users
                const { data: userData } = await supabaseAuth
                    .from('users')
                    .select('name, role, profile_pic_url')
                    .eq('id', session.user.id)
                    .maybeSingle();

                if (isMounted && userData) {
                    if (userData.name) setUserName(userData.name);
                    if (userData.role) setUserRole(userData.role);
                    if (userData.profile_pic_url) setUserAvatar(userData.profile_pic_url);
                } else if (isMounted) {
                    // Check community_profiles for external community members
                    const { data: cProf } = await supabaseAuth
                        .from('community_profiles')
                        .select('display_name, avatar_url')
                        .eq('id', session.user.id)
                        .maybeSingle();
                    if (cProf) {
                        if (cProf.display_name) setUserName(cProf.display_name);
                        if (cProf.avatar_url) setUserAvatar(cProf.avatar_url);
                    }
                }
            } catch (e) {
                console.warn('[CommunityNavbar] Auth check error:', e);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        checkAuth();

        const { data: authListener } = supabaseAuth.auth.onAuthStateChange((_, session) => {
            if (!session) {
                setUser(null);
                setUserRole(null);
            }
        });

        return () => {
            isMounted = false;
            authListener?.subscription?.unsubscribe();
        };
    }, []);

    const handleSignOut = async () => {
        await supabaseAuth.auth.signOut();
        if (typeof window !== 'undefined') {
            localStorage.removeItem('kfa-user-role');
        }
        setUser(null);
        setUserRole(null);
        router.refresh();
    };

    const badge: CommunityBadge = resolveUserBadge(userRole);
    const authNav = getAuthNavigation(user, userRole);

    const getDashboardLink = () => {
        if (!userRole) return '/community';
        return authNav.href;
    };

    return (
        <header className="sticky top-0 z-40 h-[65px] bg-white/95 dark:bg-[#1a140e]/95 backdrop-blur-md border-b border-amber-900/10 dark:border-amber-500/10 shadow-xs transition-colors">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16 gap-4">
                    {/* Brand Logo & Desktop Navigation */}
                    <div className="flex items-center gap-8 shrink-0">
                        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
                            <img
                                src="/image.png"
                                alt="Krishna Flute Academy"
                                className="h-9 w-9 object-contain transform group-hover:scale-105 transition-transform shrink-0"
                            />
                            <div className="flex flex-col">
                                <span className="text-sm font-black text-amber-950 dark:text-amber-100 tracking-tight leading-none whitespace-nowrap">
                                    Krishna Flute Academy
                                </span>
                                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1 mt-0.5 whitespace-nowrap">
                                    <Sparkles className="w-3 h-3 text-amber-600 shrink-0" /> Community
                                </span>
                            </div>
                        </Link>

                        {/* Desktop Navigation Links (anchored to logo to prevent horizontal shift) */}
                        <nav className="hidden md:flex items-center gap-6 shrink-0">
                            <Link 
                                href="/community" 
                                className="text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-amber-700 dark:hover:text-amber-400 transition-colors whitespace-nowrap"
                            >
                                Discussions
                            </Link>
                            <Link
                                href="/community/events"
                                className="text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-amber-700 dark:hover:text-amber-400 transition-colors whitespace-nowrap"
                            >
                                Events
                            </Link>
                            <Link 
                                href="/courses" 
                                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-400 transition-colors whitespace-nowrap"
                            >
                                Courses
                            </Link>
                            <Link 
                                href="/blog" 
                                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-400 transition-colors whitespace-nowrap"
                            >
                                Blog
                            </Link>
                            {userRole === 'admin' && (
                                <Link 
                                    href="/teacher-dashboard/community" 
                                    className="text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-900/40 px-2.5 py-1 rounded-full hover:bg-amber-200/80 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                                >
                                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> Community Admin
                                </Link>
                            )}
                        </nav>
                    </div>

                    {/* Right Action Section (reserved footprint across loading and auth resolution) */}
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {/* Notification Bell Footprint: always reserves 36x36px */}
                        {loading ? (
                            <div className="w-9 h-9 rounded-xl shrink-0" aria-hidden="true" />
                        ) : user ? (
                            <CommunityNotificationBell currentUserId={user.id} />
                        ) : null}

                        {/* New Discussion Button: stable footprint */}
                        <Link
                            href="/community/new"
                            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-[#a15912] hover:bg-[#8a4b0f] text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs hover:shadow-md transform active:scale-95 transition-all shrink-0 whitespace-nowrap"
                        >
                            <PlusCircle className="w-4 h-4 shrink-0" />
                            <span>Ask / Discuss</span>
                        </Link>

                        {/* User Profile or Login */}
                        {loading ? (
                            <div className="flex items-center gap-2.5 shrink-0" aria-hidden="true">
                                <div className="w-8 h-8 rounded-full bg-amber-900/10 dark:bg-amber-500/10 animate-pulse shrink-0" />
                                <div className="hidden lg:flex flex-col gap-1 w-20 shrink-0">
                                    <div className="h-3 w-16 bg-amber-900/10 dark:bg-amber-500/10 rounded animate-pulse" />
                                    <div className="h-2.5 w-12 bg-amber-900/10 dark:bg-amber-500/10 rounded animate-pulse" />
                                </div>
                                <div className="hidden sm:block w-8 h-8 rounded-lg shrink-0" />
                            </div>
                        ) : user ? (
                            <div className="flex items-center gap-2.5 shrink-0">
                                <Link 
                                    href={getDashboardLink()}
                                    className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors shrink-0"
                                    title="Go to Dashboard"
                                >
                                    {userAvatar ? (
                                        <img 
                                            src={userAvatar} 
                                            alt={userName} 
                                            className="w-8 h-8 rounded-full object-cover border border-amber-300 dark:border-amber-700 shrink-0" 
                                        />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-amber-700 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                            {userName.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="hidden lg:flex flex-col text-left">
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight truncate max-w-[110px]">
                                            {userName}
                                        </span>
                                        <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 truncate max-w-[110px]">
                                            {badge}
                                        </span>
                                    </div>
                                </Link>

                                <button
                                    onClick={handleSignOut}
                                    title="Sign Out"
                                    className="hidden sm:flex w-8 h-8 p-1.5 text-slate-500 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors items-center justify-center shrink-0"
                                >
                                    <LogOut className="w-4 h-4 shrink-0" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 shrink-0">
                                <Link
                                    href="/community/join"
                                    className="hidden sm:inline-flex px-3.5 py-1.5 sm:px-4 sm:py-2 bg-amber-100 hover:bg-amber-200/80 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-xs sm:text-sm font-bold rounded-xl transition-colors shrink-0 whitespace-nowrap"
                                >
                                    Join Community
                                </Link>
                                <Link
                                    href="/login?redirect=/community"
                                    className="px-3.5 py-1.5 sm:px-4 sm:py-2 border border-amber-800/30 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs sm:text-sm font-bold rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors shrink-0 whitespace-nowrap"
                                >
                                    Login
                                </Link>
                            </div>
                        )}

                        {/* Mobile Menu Toggle Button: stable footprint */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="md:hidden w-9 h-9 p-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center shrink-0"
                            aria-label="Toggle menu"
                        >
                            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Dropdown Menu */}
            {mobileMenuOpen && (
                <div className="md:hidden border-t border-amber-900/10 dark:border-amber-500/10 bg-white dark:bg-[#1a140e] px-4 pt-3 pb-6 space-y-3 shadow-xl">
                    <Link
                        href="/community/new"
                        onClick={() => setMobileMenuOpen(false)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#a15912] text-white text-sm font-bold rounded-xl shadow-xs"
                    >
                        <PlusCircle className="w-4 h-4" />
                        <span>Start a Discussion / Ask</span>
                    </Link>
                    <Link
                        href="/community/events/new"
                        onClick={() => setMobileMenuOpen(false)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-amber-700/30 text-amber-900 dark:text-amber-200 text-sm font-bold rounded-xl"
                    >
                        <CalendarDays className="w-4 h-4" />
                        <span>Share an Event</span>
                    </Link>

                    <div className="pt-2 space-y-1">
                        <Link
                            href="/community"
                            onClick={() => setMobileMenuOpen(false)}
                            className="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-slate-800"
                        >
                            All Discussions
                        </Link>
                        <Link
                            href="/community/events"
                            onClick={() => setMobileMenuOpen(false)}
                            className="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-slate-800"
                        >
                            Community Events
                        </Link>
                        <Link
                            href="/#courses"
                            onClick={() => setMobileMenuOpen(false)}
                            className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-slate-800"
                        >
                            Academy Courses
                        </Link>
                        <Link
                            href="/blog"
                            onClick={() => setMobileMenuOpen(false)}
                            className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-slate-800"
                        >
                            Blog & Insights
                        </Link>
                        <Link
                            href="/"
                            onClick={() => setMobileMenuOpen(false)}
                            className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-slate-800"
                        >
                            Academy Home
                        </Link>
                        {userRole === 'admin' && (
                            <Link
                                href="/teacher-dashboard/community"
                                onClick={() => setMobileMenuOpen(false)}
                                className="block px-3 py-2 rounded-lg text-sm font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40"
                            >
                                Community Admin Management
                            </Link>
                        )}
                        {user ? (
                            <>
                                {userRole ? (
                                    <Link
                                        href={getDashboardLink()}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="block px-3 py-2 rounded-lg text-sm font-semibold text-amber-700 hover:bg-amber-50"
                                    >
                                        {authNav.label} ({badge})
                                    </Link>
                                ) : (
                                    <div className="px-3 py-2 text-xs font-semibold text-slate-500">
                                        Signed in as {userName} ({badge})
                                    </div>
                                )}
                                <button
                                    onClick={() => {
                                        setMobileMenuOpen(false);
                                        handleSignOut();
                                    }}
                                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
                                >
                                    Sign Out
                                </button>
                            </>
                        ) : (
                            <div className="space-y-1">
                                <Link
                                    href="/community/join"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="block px-3 py-2 rounded-lg text-sm font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40"
                                >
                                    Join Community (Free)
                                </Link>
                                <Link
                                    href="/login?redirect=/community"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-amber-50"
                                >
                                    Sign In
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
}
