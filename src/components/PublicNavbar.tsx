'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
    Menu, 
    X, 
    User, 
    Facebook, 
    Instagram, 
    Youtube, 
    MessageCircle 
} from 'lucide-react';
import { supabaseAuth } from '../lib/supabase-auth';

interface Props {
    activePath?: string;
}

export default function PublicNavbar({ activePath = '/courses' }: Props) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [userSession, setUserSession] = useState<any>(null);
    const [userRole, setUserRole] = useState<string | null>(null);

    const socialLinks = {
        facebook: 'https://www.facebook.com/krishnafluteacademy/',
        instagram: 'https://www.instagram.com/krishnafluteacademy?igsh=MWw0NjZsNms2czN1aw==',
        youtube: 'https://www.youtube.com/@krishnafluteacademy'
    };

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { session } } = await supabaseAuth.auth.getSession();
                setUserSession(session);
                if (session?.user) {
                    const { data } = await supabaseAuth
                        .from('users')
                        .select('role')
                        .eq('id', session.user.id)
                        .maybeSingle();
                    if (data?.role) setUserRole(data.role);
                }
            } catch (err) {
                // Non-blocking
            }
        };
        checkAuth();
    }, []);

    const getDashboardLink = () => {
        if (!userSession) return '/login';
        const role = userRole?.toLowerCase();
        if (role === 'admin' || role === 'teacher') return '/teacher-dashboard';
        if (role === 'pending') return '/pending-approval';
        return '/student-dashboard';
    };

    return (
        <>
            <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-md border-b border-slate-200 transition-all duration-300">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16 sm:h-20">
                        {/* Logo + Academy Name */}
                        <Link href="/" className="flex items-center space-x-2 sm:space-x-3 shrink-0 group">
                            <img
                                src="/image.png"
                                alt="Krishna Flute Academy Logo"
                                className="h-9 w-9 sm:h-11 sm:w-11 md:h-12 md:w-12 object-contain shrink-0 group-hover:scale-105 transition-transform"
                            />
                            <span className="text-sm sm:text-base md:text-lg font-black text-blue-900 tracking-tight whitespace-nowrap">
                                Krishna Flute Academy
                            </span>
                        </Link>

                        {/* Desktop Navigation Links */}
                        <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
                            <Link 
                                href="/#about" 
                                className="text-blue-700 hover:text-blue-900 transition-colors text-sm lg:text-base font-medium"
                            >
                                About
                            </Link>
                            <Link 
                                href="/#founder" 
                                className="text-blue-700 hover:text-blue-900 transition-colors text-sm lg:text-base font-medium"
                            >
                                Founder
                            </Link>
                            <Link 
                                href="/courses" 
                                className={`text-sm lg:text-base font-medium transition-colors ${activePath.startsWith('/courses') ? 'text-blue-950 font-bold border-b-2 border-amber-500 pb-0.5' : 'text-blue-700 hover:text-blue-900'}`}
                            >
                                Courses
                            </Link>
                            <Link 
                                href="/gallery" 
                                className={`text-sm lg:text-base font-medium transition-colors ${activePath.startsWith('/gallery') ? 'text-blue-950 font-bold border-b-2 border-amber-500 pb-0.5' : 'text-blue-700 hover:text-blue-900'}`}
                            >
                                Gallery
                            </Link>
                            <Link 
                                href="/blog/" 
                                className={`text-sm lg:text-base font-medium transition-colors ${activePath.startsWith('/blog') ? 'text-blue-950 font-bold border-b-2 border-amber-500 pb-0.5' : 'text-blue-700 hover:text-blue-900'}`}
                            >
                                Blog
                            </Link>
                            <Link 
                                href="/community" 
                                className={`text-sm lg:text-base font-medium transition-colors ${activePath.startsWith('/community') ? 'text-blue-950 font-bold border-b-2 border-amber-500 pb-0.5' : 'text-blue-700 hover:text-blue-900'}`}
                            >
                                Community
                            </Link>
                            <Link 
                                href="/#contact" 
                                className="text-blue-700 hover:text-blue-900 transition-colors text-sm lg:text-base font-medium"
                            >
                                Contact
                            </Link>
                        </div>

                        {/* Social Icons + Auth Button */}
                        <div className="flex items-center justify-end shrink-0">
                            <div className="hidden sm:flex items-center space-x-2.5 mr-4">
                                <a 
                                    href={socialLinks.facebook} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="w-8 h-8 md:w-9 md:h-9 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700 transition-all duration-300 transform hover:scale-110 shadow-xs"
                                    aria-label="Facebook"
                                >
                                    <Facebook className="w-4 h-4 text-white" />
                                </a>
                                <a 
                                    href={socialLinks.instagram} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="w-8 h-8 md:w-9 md:h-9 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 rounded-full flex items-center justify-center hover:shadow-lg transition-all duration-300 transform hover:scale-110 shadow-xs"
                                    aria-label="Instagram"
                                >
                                    <Instagram className="w-4 h-4 text-white" />
                                </a>
                                <a 
                                    href={socialLinks.youtube} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="w-8 h-8 md:w-9 md:h-9 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 transition-all duration-300 transform hover:scale-110 shadow-xs"
                                    aria-label="YouTube"
                                >
                                    <Youtube className="w-4 h-4 text-white" />
                                </a>
                            </div>

                            {/* Login / Dashboard Link */}
                            <div className="flex items-center">
                                <Link 
                                    href={getDashboardLink()} 
                                    className="flex items-center justify-center space-x-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-[#a15912] text-white rounded-full font-bold text-xs sm:text-sm transition-all duration-300 shadow-md hover:bg-[#8a4b0f] hover:scale-105 whitespace-nowrap"
                                >
                                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    <span>{userSession ? 'Dashboard' : 'Login'}</span>
                                </Link>
                            </div>

                            {/* Mobile Hamburger Toggle Button */}
                            <button
                                className="md:hidden p-2 ml-2 rounded-lg hover:bg-slate-100 transition-colors text-blue-900"
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                aria-label="Toggle Menu"
                            >
                                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Mobile Navigation Drawer */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 z-[60] md:hidden">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setMobileMenuOpen(false)}
                    />
                    <div className="absolute top-0 right-0 w-4/5 max-w-sm h-full bg-white shadow-2xl flex flex-col justify-between p-6 animate-in slide-in-from-right duration-300">
                        <div>
                            {/* Drawer Header */}
                            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                                <div className="flex items-center space-x-2">
                                    <img
                                        src="/image.png"
                                        alt="KFA Logo"
                                        className="h-8 w-8 object-contain"
                                    />
                                    <span className="font-bold text-blue-900 text-sm">Krishna Flute Academy</span>
                                </div>
                                <button
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                    aria-label="Close Menu"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Navigation Links */}
                            <div className="space-y-3">
                                <Link 
                                    href="/#about" 
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="block text-base font-semibold text-blue-900 hover:text-amber-600 transition-colors py-1.5"
                                >
                                    About
                                </Link>
                                <Link 
                                    href="/#founder" 
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="block text-base font-semibold text-blue-900 hover:text-amber-600 transition-colors py-1.5"
                                >
                                    Founder
                                </Link>
                                <Link 
                                    href="/courses" 
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`block text-base font-semibold transition-colors py-1.5 ${activePath.startsWith('/courses') ? 'text-amber-600 font-bold' : 'text-blue-900 hover:text-amber-600'}`}
                                >
                                    Courses (All Levels)
                                </Link>
                                <Link 
                                    href="/gallery" 
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`block text-base font-semibold transition-colors py-1.5 ${activePath.startsWith('/gallery') ? 'text-amber-600 font-bold' : 'text-blue-900 hover:text-amber-600'}`}
                                >
                                    Gallery
                                </Link>
                                <Link 
                                    href="/blog/" 
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`block text-base font-semibold transition-colors py-1.5 ${activePath.startsWith('/blog') ? 'text-amber-600 font-bold' : 'text-blue-900 hover:text-amber-600'}`}
                                >
                                    Blog
                                </Link>
                                <Link 
                                    href="/community" 
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`block text-base font-semibold transition-colors py-1.5 ${activePath.startsWith('/community') ? 'text-amber-600 font-bold' : 'text-blue-900 hover:text-amber-600'}`}
                                >
                                    Community
                                </Link>
                                <Link 
                                    href="/#contact" 
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="block text-base font-semibold text-blue-900 hover:text-amber-600 transition-colors py-1.5"
                                >
                                    Contact
                                </Link>
                                <Link 
                                    href={getDashboardLink()} 
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="block text-base font-semibold text-amber-700 hover:text-amber-800 transition-colors py-1.5"
                                >
                                    {userSession ? 'Student / Teacher Dashboard' : 'Student Login'}
                                </Link>
                            </div>
                        </div>

                        {/* Drawer Footer with Social + WhatsApp */}
                        <div className="pt-6 border-t border-slate-200 space-y-4">
                            <a
                                href="https://wa.me/919836952545?text=Hello%20Krishna%20Flute%20Academy%2C%20I%20would%20like%20to%20enquire%20about%20your%20Bansuri%20courses."
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-sm"
                            >
                                <MessageCircle className="w-4 h-4" />
                                <span>Chat with us on WhatsApp</span>
                            </a>

                            <div className="flex items-center justify-center space-x-4 pt-2">
                                <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white">
                                    <Facebook className="w-4 h-4" />
                                </a>
                                <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 rounded-full flex items-center justify-center text-white">
                                    <Instagram className="w-4 h-4" />
                                </a>
                                <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-red-600 rounded-full flex items-center justify-center text-white">
                                    <Youtube className="w-4 h-4" />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
