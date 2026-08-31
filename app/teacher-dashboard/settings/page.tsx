'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { Loader2, Bell, BookOpen, Youtube, CheckCircle2 } from 'lucide-react';
import TeacherSidebar from '../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../src/components/TeacherHeader';
import SettingsTab from '../../../src/components/student-dashboard/SettingsTab';

export default function TeacherSettingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<{ 
        id: string; 
        name: string; 
        email: string; 
        phone?: string | null; 
        role?: string; 
        profile_pic_url?: string | null;
    } | null>(null);

    // System Notification Settings (Blog & YouTube automatic notifications pause/enable)
    const [systemNotifSettings, setSystemNotifSettings] = useState<{ blog_enabled: boolean; video_enabled: boolean }>({
        blog_enabled: true,
        video_enabled: true
    });
    const [isUpdatingNotifSettings, setIsUpdatingNotifSettings] = useState(false);
    const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null);

    const loadNotifSettings = async () => {
        try {
            const { data } = await supabaseAuth
                .from('message_templates')
                .select('id, content')
                .eq('name', 'system_notification_settings')
                .maybeSingle();
            if (data?.content) {
                const parsed = JSON.parse(data.content);
                setSystemNotifSettings({
                    blog_enabled: parsed.blog_enabled !== false,
                    video_enabled: parsed.video_enabled !== false
                });
            }
        } catch (e) {
            console.warn('Could not load system notification settings:', e);
        }
    };

    const handleToggleSystemNotification = async (channelType: 'blog' | 'video') => {
        if (!teacherProfile?.id) return;
        setIsUpdatingNotifSettings(true);
        setSettingsFeedback(null);
        try {
            const nextSettings = {
                ...systemNotifSettings,
                [channelType === 'blog' ? 'blog_enabled' : 'video_enabled']: !systemNotifSettings[channelType === 'blog' ? 'blog_enabled' : 'video_enabled']
            };

            setSystemNotifSettings(nextSettings);

            const { data: existing } = await supabaseAuth
                .from('message_templates')
                .select('id')
                .eq('name', 'system_notification_settings')
                .maybeSingle();

            const payload = {
                teacher_id: teacherProfile.id,
                name: 'system_notification_settings',
                subject: 'System Automated Notification Settings',
                content: JSON.stringify(nextSettings)
            };

            if (existing?.id) {
                await supabaseAuth
                    .from('message_templates')
                    .update({
                        content: payload.content,
                        subject: payload.subject
                    })
                    .eq('id', existing.id);
            } else {
                await supabaseAuth
                    .from('message_templates')
                    .insert(payload);
            }

            const stateText = nextSettings[channelType === 'blog' ? 'blog_enabled' : 'video_enabled'] ? 'Active (Enabled)' : 'Paused';
            setSettingsFeedback(`${channelType === 'blog' ? 'Blog' : 'YouTube Video'} automatic notifications are now ${stateText}.`);
            setTimeout(() => setSettingsFeedback(null), 4000);
        } catch (e: any) {
            console.error('Failed to update system notification settings:', e);
            setSettingsFeedback('Failed to update notification settings.');
        } finally {
            setIsUpdatingNotifSettings(false);
        }
    };

    const refreshData = async () => {
        try {
            const { data: { session } } = await supabaseAuth.auth.getSession();
            if (!session) return;
            
            const { data: profile, error } = await supabaseAuth
                .from('users')
                .select('id, name, email, phone, role, profile_pic_url')
                .eq('id', session.user.id)
                .single();

            if (error) throw error;

            if (profile) {
                setTeacherProfile({ 
                    id: profile.id, 
                    name: profile.name || '', 
                    email: profile.email || '', 
                    phone: profile.phone || '',
                    role: profile.role || 'teacher',
                    profile_pic_url: profile.profile_pic_url || null
                });
            }
        } catch (e) {
            console.error('Error refreshing profile:', e);
        }
    };

    // Initial Fetch & Auth Verify
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (!session) {
                    router.push('/login?type=teacher');
                    return;
                }
                
                const { data: profile, error } = await supabaseAuth
                    .from('users')
                    .select('id, name, email, phone, role, profile_pic_url')
                    .eq('id', session.user.id)
                    .single();

                if (error) throw error;

                if (profile?.role !== 'teacher' && profile?.role !== 'admin') {
                    router.push('/');
                    return;
                }

                setTeacherProfile({ 
                    id: profile.id, 
                    name: profile.name || '', 
                    email: profile.email || '', 
                    phone: profile.phone || '',
                    role: profile.role || 'teacher',
                    profile_pic_url: profile.profile_pic_url || null
                });

                if (profile.role === 'admin') {
                    await loadNotifSettings();
                }
            } catch (error) {
                console.error('Error verifying auth:', error);
                router.push('/');
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, [router]);

    // Log Out
    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    const isAdmin = teacherProfile?.role === 'admin';
    const basePath = isAdmin ? '/admin-dashboard' : '/teacher-dashboard';

    return (
        <div className="flex h-screen bg-[#f8f8f6] dark:bg-[#14120c] text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
            <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />
            
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                <TeacherHeader 
                    title="Profile & System Settings" 
                    avatarUrl={teacherProfile?.profile_pic_url}
                    userName={teacherProfile?.name}
                    backLink={basePath}
                />

                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-[#ecb613] mb-3" />
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest animate-pulse">Loading Settings...</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 space-y-6 max-w-5xl">
                        {/* Admin Notification Controls */}
                        {isAdmin && (
                            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200/60 dark:border-slate-800 text-left">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
                                        <Bell className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                            Automated Broadcast Controls
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Control whether new Blog and YouTube releases automatically trigger student dashboard notifications
                                        </p>
                                    </div>
                                </div>

                                {settingsFeedback && (
                                    <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                        <span>{settingsFeedback}</span>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Blog Control Card */}
                                    <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex flex-col justify-between gap-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                                                    <BookOpen className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">Blog Post Notifications</h4>
                                                    <p className="text-xs text-slate-400">Automatic popups/banners for new articles</p>
                                                </div>
                                            </div>
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                systemNotifSettings.blog_enabled
                                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                            }`}>
                                                {systemNotifSettings.blog_enabled ? '● Active' : '⏸ Paused'}
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            disabled={isUpdatingNotifSettings}
                                            onClick={() => handleToggleSystemNotification('blog')}
                                            className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                                                systemNotifSettings.blog_enabled
                                                    ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
                                                    : 'bg-emerald-600 text-white hover:bg-emerald-500'
                                            }`}
                                        >
                                            {isUpdatingNotifSettings ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : systemNotifSettings.blog_enabled ? (
                                                '⏸ Pause Blog Notifications'
                                            ) : (
                                                '▶ Resume Blog Notifications'
                                            )}
                                        </button>
                                    </div>

                                    {/* YouTube Control Card */}
                                    <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex flex-col justify-between gap-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="p-2 rounded-xl bg-red-500/10 text-red-600">
                                                    <Youtube className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">YouTube Video Notifications</h4>
                                                    <p className="text-xs text-slate-400">Automatic updates for latest YouTube uploads</p>
                                                </div>
                                            </div>
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                systemNotifSettings.video_enabled
                                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                            }`}>
                                                {systemNotifSettings.video_enabled ? '● Active' : '⏸ Paused'}
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            disabled={isUpdatingNotifSettings}
                                            onClick={() => handleToggleSystemNotification('video')}
                                            className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                                                systemNotifSettings.video_enabled
                                                    ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
                                                    : 'bg-emerald-600 text-white hover:bg-emerald-500'
                                            }`}
                                        >
                                            {isUpdatingNotifSettings ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : systemNotifSettings.video_enabled ? (
                                                '⏸ Pause Video Notifications'
                                            ) : (
                                                '▶ Resume Video Notifications'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <SettingsTab profile={teacherProfile} refreshData={refreshData} />
                    </div>
                )}
            </main>
        </div>
    );
}
