'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { Loader2, History, Activity, Clock, Monitor, Smartphone, Search, RefreshCw } from 'lucide-react';
import TeacherSidebar from '../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../src/components/TeacherHeader';
import { useToast } from '../../../src/lib/ToastContext';

interface SessionLog {
    id: string;
    user_id: string;
    login_at: string;
    logout_at: string | null;
    last_activity_at: string;
    duration_seconds: number | null;
    user_agent: string | null;
    users?: {
        name: string;
        email: string;
        role: string;
    } | null;
}

export default function UserSessionsDashboard() {
    const router = useRouter();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string; role?: string } | null>(null);
    const [sessions, setSessions] = useState<SessionLog[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterOnline, setFilterOnline] = useState<'all' | 'online' | 'offline'>('all');
    const [refreshing, setRefreshing] = useState(false);

    const isOnline = (session: SessionLog) => {
        if (session.logout_at) return false;
        // If last activity is within 2 minutes, consider online
        const lastActivity = new Date(session.last_activity_at).getTime();
        const diffMs = Date.now() - lastActivity;
        return diffMs < 2 * 60 * 1000;
    };

    const fetchSessions = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const { data, error } = await supabaseAuth
                .from('user_sessions')
                .select(`
                    id,
                    user_id,
                    login_at,
                    logout_at,
                    last_activity_at,
                    duration_seconds,
                    user_agent,
                    users (
                        name,
                        email,
                        role
                    )
                `)
                .order('last_activity_at', { ascending: false })
                .limit(200);

            if (error) throw error;

            const formatted = ((data || []) as any[]).map(session => {
                let userObj = null;
                if (session.users) {
                    userObj = Array.isArray(session.users) ? session.users[0] : session.users;
                }
                return {
                    ...session,
                    users: userObj
                };
            });

            setSessions(formatted);
        } catch (err: any) {
            console.error('Error fetching sessions:', err);
            showToast(err.message || 'Failed to fetch sessions', 'error');
        } finally {
            if (!silent) setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchSessions(true);
    };

    useEffect(() => {
        let isMounted = true;

        const checkAdminAndFetch = async () => {
            try {
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (!session) {
                    router.push('/login?type=teacher');
                    return;
                }

                const userId = session.user.id;
                const { data: profile, error: profileError } = await supabaseAuth
                    .from('users')
                    .select('name, email, role')
                    .eq('id', userId)
                    .single();

                if (profileError || profile?.role !== 'admin') {
                    router.push('/teacher-dashboard');
                    return;
                }

                if (isMounted) {
                    setTeacherProfile({ id: userId, name: profile.name, email: profile.email, role: profile.role });
                    await fetchSessions();
                }
            } catch (err) {
                console.error(err);
                router.push('/teacher-dashboard');
            }
        };

        checkAdminAndFetch();

        // Subscribe to real-time changes
        const channel = supabaseAuth
            .channel('realtime-user-sessions')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'user_sessions' }, () => {
                fetchSessions(true);
            })
            .subscribe();

        // Interval to refresh online status display every 15 seconds
        const timer = setInterval(() => {
            setSessions(prev => [...prev]);
        }, 15000);

        return () => {
            isMounted = false;
            supabaseAuth.removeChannel(channel);
            clearInterval(timer);
        };
    }, []);

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    const parseUserAgent = (ua: string | null) => {
        if (!ua) return { device: 'Unknown', icon: Monitor };
        const lower = ua.toLowerCase();
        if (lower.includes('mobile') || lower.includes('android') || lower.includes('iphone')) {
            return { device: 'Mobile', icon: Smartphone };
        }
        return { device: 'Desktop', icon: Monitor };
    };

    const formatDuration = (seconds: number | null, session: SessionLog) => {
        let secs = seconds;
        if (!secs) {
            const login = new Date(session.login_at).getTime();
            const lastActive = new Date(session.last_activity_at).getTime();
            secs = Math.max(0, Math.floor((lastActive - login) / 1000));
        }

        if (secs < 60) return `${secs}s`;
        const mins = Math.floor(secs / 60);
        if (mins < 60) return `${mins}m ${secs % 60}s`;
        const hours = Math.floor(mins / 60);
        return `${hours}h ${mins % 60}m`;
    };

    const filteredSessions = sessions.filter(session => {
        const userName = session.users?.name || '';
        const userEmail = session.users?.email || '';
        const matchesSearch = userName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             userEmail.toLowerCase().includes(searchQuery.toLowerCase());
        
        const online = isOnline(session);
        if (filterOnline === 'online') return matchesSearch && online;
        if (filterOnline === 'offline') return matchesSearch && !online;
        return matchesSearch;
    });

    const onlineCount = sessions.filter(isOnline).length;
    const totalSessions = sessions.length;
    
    const avgDurationSeconds = (() => {
        const finishedSessions = sessions.filter(s => s.duration_seconds !== null || !isOnline(s));
        if (finishedSessions.length === 0) return 0;
        
        const sum = finishedSessions.reduce((acc, s) => {
            let dur = s.duration_seconds;
            if (!dur) {
                const login = new Date(s.login_at).getTime();
                const active = new Date(s.last_activity_at).getTime();
                dur = Math.max(0, Math.floor((active - login) / 1000));
            }
            return acc + dur;
        }, 0);
        return Math.floor(sum / finishedSessions.length);
    })();

    const formatAvgDuration = (secs: number) => {
        if (secs < 60) return `${secs} secs`;
        const mins = Math.round(secs / 60);
        if (mins < 60) return `${mins} mins`;
        const hours = (mins / 60).toFixed(1);
        return `${hours} hours`;
    };

    return (
        <div className="bg-[#f8f8f6] dark:bg-[#1a1608] text-slate-900 dark:text-slate-100 font-sans min-h-screen">
            <div className="flex h-screen overflow-hidden">
                <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

                <main className="flex-1 flex flex-col min-w-0">
                    <TeacherHeader 
                        title="Login Sessions" 
                        backLink="/admin-dashboard/"
                    />

                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-12 space-y-8 font-sans">
                        {/* Title Section */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">Login Audit logs</h1>
                                <p className="text-slate-500 dark:text-slate-400 mt-2.5">Monitor active users, session durations, and device logins in real-time.</p>
                            </div>
                            <button
                                onClick={handleRefresh}
                                className="self-start sm:self-center px-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-semibold flex items-center gap-2"
                                disabled={refreshing}
                            >
                                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-500' : 'text-slate-500'}`} />
                                Refresh Status
                            </button>
                        </div>

                        {/* Metric Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
                                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
                                    <Activity className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Online Now</p>
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{onlineCount} Users</h3>
                                </div>
                            </div>
                            
                            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
                                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-xl">
                                    <History className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Logins Tracked</p>
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalSessions} Sessions</h3>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
                                <div className="p-3.5 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-xl">
                                    <Clock className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Avg. Stay Duration</p>
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{formatAvgDuration(avgDurationSeconds)}</h3>
                                </div>
                            </div>
                        </div>

                        {/* Search and Filters */}
                        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs w-full">
                            <div className="relative w-full md:max-w-md">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name or email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-amber-500 dark:focus:border-amber-500"
                                />
                            </div>

                            <div className="flex gap-2 w-full md:w-auto shrink-0 overflow-x-auto">
                                <button
                                    onClick={() => setFilterOnline('all')}
                                    className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${filterOnline === 'all' 
                                        ? 'bg-amber-500 text-white' 
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-450 hover:bg-slate-200 dark:hover:bg-slate-750'}`}
                                >
                                    All Sessions
                                </button>
                                <button
                                    onClick={() => setFilterOnline('online')}
                                    className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${filterOnline === 'online' 
                                        ? 'bg-emerald-500 text-white' 
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-455 hover:bg-slate-200 dark:hover:bg-slate-750'}`}
                                >
                                    <span className="w-2 h-2 bg-white rounded-full"></span>
                                    Online Now
                                </button>
                                <button
                                    onClick={() => setFilterOnline('offline')}
                                    className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${filterOnline === 'offline' 
                                        ? 'bg-slate-600 text-white' 
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-455 hover:bg-slate-200 dark:hover:bg-slate-750'}`}
                                >
                                    Ended Sessions
                                </button>
                            </div>
                        </div>

                        {/* Sessions Logs Table */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                            <th className="px-6 py-4">User</th>
                                            <th className="px-6 py-4">Portal Role</th>
                                            <th className="px-6 py-4">Logged In</th>
                                            <th className="px-6 py-4">Logged Out</th>
                                            <th className="px-6 py-4">Duration</th>
                                            <th className="px-6 py-4">Device</th>
                                            <th className="px-6 py-4">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm font-semibold text-slate-750 dark:text-slate-300">
                                        {filteredSessions.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-bold">
                                                    No sessions match the current query
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredSessions.map((session) => {
                                                const online = isOnline(session);
                                                const { device, icon: DeviceIcon } = parseUserAgent(session.user_agent);
                                                return (
                                                    <tr key={session.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors">
                                                        <td className="px-6 py-4.5">
                                                            <div>
                                                                <p className="font-black text-slate-900 dark:text-white leading-tight">
                                                                    {session.users?.name || 'Unknown User'}
                                                                </p>
                                                                <p className="text-xs text-slate-400 font-medium mt-0.5">
                                                                    {session.users?.email || ''}
                                                                </p>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4.5">
                                                            <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-md ${
                                                                session.users?.role === 'admin' 
                                                                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' 
                                                                    : session.users?.role === 'teacher'
                                                                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-400'
                                                            }`}>
                                                                {session.users?.role || 'student'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                                                            {new Date(session.login_at).toLocaleString()}
                                                        </td>
                                                        <td className="px-6 py-4.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                                                            {session.logout_at ? (
                                                                new Date(session.logout_at).toLocaleString()
                                                            ) : (
                                                                <span className="italic text-slate-450 dark:text-slate-500 font-medium">
                                                                    {online ? 'Active now' : 'Session timeout'}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4.5 font-bold text-slate-900 dark:text-white">
                                                            {formatDuration(session.duration_seconds, session)}
                                                        </td>
                                                        <td className="px-6 py-4.5 text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                                            <DeviceIcon className="w-4.5 h-4.5 shrink-0 text-slate-400 dark:text-slate-500" />
                                                            <span className="text-xs font-bold">{device}</span>
                                                        </td>
                                                        <td className="px-6 py-4.5">
                                                            {online ? (
                                                                <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-full border border-emerald-100 dark:border-emerald-900/30 animate-pulse">
                                                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                                                                    Online
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-450 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 rounded-full border border-transparent">
                                                                    <span className="w-1.5 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full"></span>
                                                                    Offline
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
